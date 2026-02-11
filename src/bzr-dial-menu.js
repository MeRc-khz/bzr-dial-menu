/**
 * bzr-dial-menu.js
 * A native web component implementing a physics-based radial dial menu.
 * 
 * Features:
 * - Hybrid Canvas/DOM rendering
 * - Inertial scrolling with snapping
 * - Haptic/Audio feedback
 * - Shadow DOM encapsulation
 */

class BzrDialMenu extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // State
        this.isOpen = false;
        this.rotation = 0; // Current rotation in radians
        this.velocity = 0;
        this.isDragging = false;
        this.lastAngle = 0;
        this.items = []; // List of item elements
        this.radius = 120;
        this.snapAngle = Math.PI / 4; // 45 degrees default
        this.activeIndex = -1;
        this.targetRotation = null;

        // Physics
        this.friction = 0.95;
        this.spring = 0.1;

        // Animation Loop
        this._raf = null;
        this._boundLoop = this._loop.bind(this);
    }

    static get observedAttributes() {
        return ['radius', 'snap', 'sensitivity', 'justify', 'top', 'bottom'];
    }

    connectedCallback() {
        this.render();
        this.setupEvents();
        this.updateItems();
        this.updatePosition(); // Ensure position is set on connect

        // Host click listener for easier interaction when docked
        this.addEventListener('click', (e) => {
            console.log('Host clicked', e.composedPath());

            // If dragging, ignore
            if (this.isDragging || this.isSliding) return;

            // If closed, open it if we clicked the host (fallback/primary for docked)
            // We check if we are NOT open to avoid conflicting with closing logic (which might be usually handled by overlay)
            if (!this.isOpen) {
                console.log(' Opening via Host Click');
                this.toggle();
            }
        });

        // Initial tick
        this._loop();
    }

    disconnectedCallback() {
        cancelAnimationFrame(this._raf);
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'radius') {
            this.radius = parseInt(newValue) || 120;
            this.updateLayout();
        }
        if (['justify', 'top', 'bottom'].includes(name)) {
            this.updatePosition();
        }
    }

    render() {
        this.shadowRoot.innerHTML = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap');
            
            :host {
                display: block;
                position: fixed;
                top: 50%; /* Vertical center by default */
                right: -40px; /* Center circle on right edge */
                width: 80px; 
                height: 80px;
                z-index: 9999;
                font-family: 'Space Grotesk', sans-serif;
                --primary: #2bee8c;
                --bg: #111;
                --text: #fff;
                transform: translateY(-50%); /* Center strictly */
            }

            :host([justify="left"]) {
                right: auto;
                left: -40px;
            }

            :host([open]) {
                /* When open, we still want to be anchored, but overlay covers screen */
                width: 100%;
                height: 100%;
                top: 0;
                right: 0;
                left: 0;
                transform: none;
                pointer-events: none; /* Let clicks pass to overlay/trigger */
            }

            /* The fullscreen overlay for capturing input and showing the rail */
            #overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                pointer-events: none; /* Pass through when closed */
                touch-action: none;
                transition: background 0.3s, opacity 0.3s, backdrop-filter 0.3s;
                opacity: 0;
                display: block; /* Removed flex */
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
            }
            
            :host([open]) #overlay {
                pointer-events: auto;
                background: rgba(0,0,0,0.60);
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
                opacity: 1;
            }

            /* Trigger Button - Always stays at (0,0) within host */
            /* If host is fullscreen [open], we need to position trigger manually to match the visual edge anchor */
            #trigger {
                position: absolute;
                top: 0; 
                left: 0; 
                width: 80px; height: 80px;
                /* Centered in host when closed */
                margin: 0;
                border-radius: 50%;
                background: var(--primary);
                color: #000;
                display: flex;
                justify-content: center;
                align-items: center;
                cursor: pointer;
                box-shadow: 0 4px 20px rgba(43,238,140,0.3);
                transition: transform 0.2s, background 0.2s;
                z-index: 2;
                font-weight: bold;
                user-select: none;
                pointer-events: auto;
            }

            :host([open]) #trigger {
                /* When open, host is fullscreen. Position manually at edge anchor. */
                top: 50%;
                left: auto;
                right: 0;
                margin-top: -40px;
                margin-right: -40px; /* Half off-screen */
            }

            :host([justify="left"][open]) #trigger {
                right: auto;
                left: 0;
                margin-right: 0;
                margin-left: -40px;
            }
            @keyframes pulse {
                0% { box-shadow: 0 0 0 0 rgba(43, 238, 140, 0.3); }
                70% { box-shadow: 0 0 0 20px rgba(43, 238, 140, 0); }
                100% { box-shadow: 0 0 0 0 rgba(43, 238, 140, 0); }
            }

            #trigger:hover {
                animation: pulse 1.5s infinite;
            }
            
            :host([slide-enabled]) #trigger {
                border: 4px solid #ff0055;
                animation: none;
                box-shadow: 0 0 20px #ff0055;
            }

            /* Container for the rotating dial elements - positioned at FAB location */
            /* Container for the rotating dial elements */
            #dial-container {
                position: absolute;
                top: 50%; 
                left: 50%;
                width: 0; height: 0;
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.8);
                transition: opacity 0.3s, transform 0.3s;
                pointer-events: none;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            :host([open]) #dial-container {
                /* When open, position at edge center */
                left: auto; 
                right: 0;
                transform: scale(1);
                opacity: 1; 
                pointer-events: auto;
            }
            
            :host([open][justify="left"]) #dial-container {
                right: auto; 
                left: 0;
            }

            /* Active Label (Bottom Center) */
            #active-label {
                position: absolute;
                bottom: 15%; 
                left: 50%;
                transform: translateX(-50%);
                color: #ffffff; /* White for max contrast */
                font-size: 32px; /* Larger */
                font-weight: 900;
                text-transform: uppercase;
                letter-spacing: 4px;
                pointer-events: none;
                text-shadow: 0 2px 10px rgba(0,0,0,0.5);
                transition: opacity 0.3s, transform 0.3s;
                opacity: 0;
                z-index: 1000; /* Ensure on top */
            }
            
            :host([open]) #active-label {
                opacity: 1;
            }

            /* The Canvas Rail */
            canvas {
                position: absolute;
                top: -300px; left: -300px;
                width: 600px; height: 600px; /* Big enough area */
                pointer-events: none;
            }
            
            /* The Icons Wrapper */
            #items {
                position: absolute;
                top: 0; left: 0;
            }

            ::slotted(bzr-item) {
                position: absolute;
                width: 60px; height: 60px;
                margin-left: -30px; margin-top: -30px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: var(--text);
                font-size: 12px;
                text-align: center;
                user-select: none;
                -webkit-user-select: none;
                -webkit-user-drag: none;
                will-change: transform;
                /* No transition during drag - instant response */
            }
            
            ::slotted(bzr-item[active]) {
                transform: scale(1.2);
                color: var(--primary);
                text-shadow: 0 0 10px var(--primary);
            }

            /* Content Overlay Modal */
            #content-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0.9);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                opacity: 0;
                transition: opacity 0.3s;
            }

            #content-overlay.active {
                display: flex;
                opacity: 1;
            }

            #content-container {
                background: var(--bg);
                border: 2px solid var(--primary);
                border-radius: 8px;
                padding: 30px;
                max-width: 90%;
                max-height: 90%;
                overflow: auto;
                position: relative;
                box-shadow: 0 10px 50px rgba(43, 238, 140, 0.3);
            }

            #content-close {
                position: absolute;
                top: 10px;
                right: 10px;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: var(--primary);
                color: #000;
                border: none;
                font-size: 24px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                transition: transform 0.2s;
            }

            #content-close:hover {
                transform: scale(1.1);
            }

            #content-body {
                margin-top: 20px;
            }

            /* Media Styles */
            #content-body video,
            #content-body audio {
                width: 100%;
                max-width: 800px;
                border-radius: 8px;
            }

            #content-body iframe {
                width: 100%;
                height: 500px;
                border: none;
                border-radius: 8px;
            }

            /* Form Styles */
            #content-body form {
                max-width: 500px;
            }

            #content-body input,
            #content-body textarea {
                width: 100%;
                padding: 12px;
                margin: 10px 0;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 6px;
                color: var(--text);
                font-size: 16px;
                font-family: inherit;
            }

            #content-body input:focus,
            #content-body textarea:focus {
                outline: none;
                border-color: var(--primary);
                box-shadow: 0 0 10px rgba(43, 238, 140, 0.3);
            }

            #content-body button[type="submit"] {
                background: var(--primary);
                color: #000;
                border: none;
                padding: 12px 30px;
                border-radius: 6px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: transform 0.2s;
                margin-top: 10px;
            }

            #content-body button[type="submit"]:hover {
                transform: scale(1.05);
            }

            #content-body label {
                display: block;
                margin-top: 15px;
                margin-bottom: 5px;
                color: var(--primary);
                font-weight: bold;
            }

            #content-title {
                font-size: 28px;
                font-weight: bold;
                color: var(--primary);
                margin-bottom: 20px;
            }

            /* Fullscreen Mode Overrides */
            #content-container.fullscreen-mode {
                width: 100%;
                height: 100%;
                max-width: 100%;
                max-height: 100%;
                border: none;
                border-radius: 0;
                padding: 0;
                background: #000;
                display: flex;
                flex-direction: column;
            }

            #content-container.fullscreen-mode #content-title {
                position: absolute;
                top: 20px;
                left: 20px;
                z-index: 10;
                text-shadow: 0 2px 5px rgba(0,0,0,0.8);
                pointer-events: none;
            }
            
            #content-container.fullscreen-mode #content-body {
                margin: 0;
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            #content-container.fullscreen-mode #content-close {
                z-index: 20;
                background: rgba(0, 255, 157, 0.2);
                color: #fff;
            }
            #content-container.fullscreen-mode #content-close:hover {
                background: var(--primary);
                color: #000;
            }

            /* Custom Media Controls */
            .media-controls {
                position: absolute;
                bottom: 30px;
                left: 50%;
                transform: translateX(-50%);
                width: 80%;
                max-width: 600px;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(10px);
                padding: 15px 25px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                gap: 15px;
                border: 1px solid rgba(43, 238, 140, 0.3);
                z-index: 15;
                transition: opacity 0.3s;
            }
            
            .media-controls:hover {
                background: rgba(0, 0, 0, 0.8);
                border-color: var(--primary);
            }

            .media-btn {
                background: none;
                border: none;
                color: var(--primary);
                cursor: pointer;
                font-size: 24px;
                padding: 5px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.2s;
            }
            .media-btn:hover { transform: scale(1.2); color: #fff; }
            
            .media-progress-container {
                flex-grow: 1;
                height: 6px;
                background: rgba(255,255,255,0.2);
                border-radius: 3px;
                cursor: pointer;
                position: relative;
                overflow: hidden;
            }
            
            .media-progress-bar {
                height: 100%;
                background: var(--primary);
                width: 0%;
                position: relative;
            }
            
            .media-time {
                font-family: monospace;
                font-size: 14px;
                color: #fff;
                min-width: 100px;
                text-align: center;
            }

        </style>

        <div id="overlay">
            <div id="dial-container">
                <canvas width="600" height="600"></canvas>
                <div id="items">
                    <slot></slot>
                </div>
                <div id="active-label"></div>
            </div>
        </div>
        
        <div id="trigger">
            <slot name="trigger-content">MENU</slot>
        </div>

        <!-- Content Overlay Modal -->
        <div id="content-overlay">
            <div id="content-container">
                <button id="content-close">×</button>
                <div id="content-title"></div>
                <div id="content-body"></div>
            </div>
        </div>
        `;

        this.els = {
            overlay: this.shadowRoot.getElementById('overlay'),
            trigger: this.shadowRoot.getElementById('trigger'),
            container: this.shadowRoot.getElementById('dial-container'),
            canvas: this.shadowRoot.querySelector('canvas'),
            ctx: this.shadowRoot.querySelector('canvas').getContext('2d'),
            itemsSlot: this.shadowRoot.querySelector('slot:not([name])'),
            contentOverlay: this.shadowRoot.getElementById('content-overlay'),
            contentTitle: this.shadowRoot.getElementById('content-title'),
            contentBody: this.shadowRoot.getElementById('content-body'),
            contentClose: this.shadowRoot.getElementById('content-close')
        };
    }

    setupEvents() {
        // Trigger Click handled by Host listener now for robust open
        // We keep this for double-click logic if needed, but for now let's simplify to avoid race conditions.
        /* this.els.trigger.addEventListener('click', ... removed duplicate toggle ... */

        // Double click logic should probably be on Host too if needed, but let's stick to simple open first.
        this.els.trigger.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.slideEnabled = !this.slideEnabled;
            if (this.slideEnabled) {
                this.setAttribute('slide-enabled', '');
                if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
            } else {
                this.removeAttribute('slide-enabled');
                if (navigator.vibrate) navigator.vibrate(50);
            }
        });

        // Trigger Drag Logic
        const startTriggerDrag = (x, y) => {
            if (!this.slideEnabled) return;
            this.isSliding = true;
            this.isDragging = true;
            this.startPos = { x, y };
            const rect = this.getBoundingClientRect();
            this.startHostTop = rect.top;
        };

        this.els.trigger.addEventListener('mousedown', (e) => {
            if (this.slideEnabled) e.preventDefault(); // Prevent text selection
            startTriggerDrag(e.clientX, e.clientY);
        });

        this.els.trigger.addEventListener('touchstart', (e) => {
            if (this.slideEnabled) e.preventDefault();
            startTriggerDrag(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        }, { passive: false });
        this.els.itemsSlot.addEventListener('slotchange', () => this.updateItems());
        this.els.contentClose.addEventListener('click', () => this.hideContent());



        // Drag Interaction on Overlay
        const start = (e) => {
            if (!this.isOpen) return;
            e.preventDefault(); // Prevent default drag behavior/ghosting
            this.isDragging = true;
            this.velocity = 0;
            this.targetRotation = null;

            let x = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
            let y = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

            // Check for Icon Hit
            const path = e.composedPath();
            const hitIcon = path.find(el => el.tagName === 'BZR-ITEM');
            this.iconDragState = hitIcon ? { active: true, startY: y, locked: false } : null;
            this.clickedIcon = hitIcon;

            this.hasMoved = false;
            this.startPos = { x, y };

            // Get FAB center for rotation calculations
            const rect = this.els.trigger.getBoundingClientRect();
            const fabCx = rect.left + rect.width / 2;
            const fabCy = rect.top + rect.height / 2;

            // Check for Inner Ring Hit (if not icon)
            if (!hitIcon) {
                const d = Math.hypot(x - fabCx, y - fabCy);
                // FAB is 40px radius (80px width). Inner ring visual is ~75.
                // Let's say active zone is 40px to 100px.
                if (d > 40 && d < 110) {
                    this.innerRingDrag = { active: true, startY: y, locked: false };
                } else {
                    this.innerRingDrag = null;
                }
            } else {
                this.innerRingDrag = null;
            }

            // Calculate initial angle relative to FAB center (not screen center)
            // This ensures correct rotation direction regardless of justify position
            this.lastAngle = Math.atan2(y - fabCy, x - fabCx);

            // Long Press for Sliding
            this.longPressTimer = setTimeout(() => {
                if (!this.hasMoved && this.iconDragState === null) {
                    this.isSliding = true;
                    if (navigator.vibrate) navigator.vibrate(50); // Feedback
                    // Visual feedback could be added here (e.g., pulse color change)
                }
            }, 600);
        };

        const move = (e) => {
            if (!this.isDragging) return;
            if (!this.isOpen && !this.isSliding) return;
            e.preventDefault();

            let x = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
            let y = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

            // Check for movement threshold
            if (!this.hasMoved) {
                let dx = x - this.startPos.x;
                let dy = y - this.startPos.y;
                if (Math.hypot(dx, dy) > 5) {
                    this.hasMoved = true;
                    // Cancel long press if moved early
                    clearTimeout(this.longPressTimer);
                }
            }

            // Vertical Sliding Logic
            if (this.isSliding) {
                let dy = y - this.startPos.y;
                let newTop = this.startHostTop + dy;

                // Constraints
                const minTop = 0;
                const maxTop = window.innerHeight - 80; // 80 is approx host height

                if (newTop < minTop) newTop = minTop;
                if (newTop > maxTop) newTop = maxTop;

                this.style.top = `${newTop}px`;

                // Sync Container Center (Host Top + Radius)
                this.els.container.style.top = `${newTop + 40}px`;

                return; // Stop other interactions
            }

            // Icon or Inner Ring Auto-Rotate Logic
            const dragState = this.iconDragState || this.innerRingDrag;

            if (dragState && dragState.active) {
                if (dragState.locked) return;

                let dy = y - dragState.startY;
                if (Math.abs(dy) > 10) { // Sensitivity threshold
                    dragState.locked = true;
                    this.isDragging = false; // Stop physics drag

                    let direction = dy > 0 ? 1 : -1;

                    // Default position is right (justify is null/undefined).
                    // Only left-justified dials should NOT invert.
                    const isRight = this.getAttribute('justify') !== 'left';
                    if (isRight) {
                        direction = dy > 0 ? -1 : 1;
                    }

                    let currentSlot = Math.round(this.rotation / this.snapAngle);
                    this.targetRotation = (currentSlot + direction) * this.snapAngle;
                    return;
                }
            }


            // Calculate angle relative to FAB center (not screen center)
            // This ensures correct rotation direction regardless of justify position
            const rect = this.els.trigger.getBoundingClientRect();
            const fabCx = rect.left + rect.width / 2;
            const fabCy = rect.top + rect.height / 2;
            let currentAngle = Math.atan2(y - fabCy, x - fabCx);

            let delta = currentAngle - this.lastAngle;

            // Normalize
            if (delta > Math.PI) delta -= Math.PI * 2;
            if (delta < -Math.PI) delta += Math.PI * 2;

            // In standard radial math (atan2), positive delta is Clockwise.
            // When Right Justified, we WANT standard behavior because dragging "Down" on the left side (where icons are) 
            // naturally produces a positive delta (CW) relative to the center on the right.
            // However, the user reports dragging "Down" moves the dial "Clockwise" which they say is wrong.
            // They want "Down" -> "Counter-Clockwise".
            // So we NEED to invert it if it is behaving Clockwise.

            // Free-spin uses atan2 relative to FAB center, which already produces
            // the correct direction for right-side dials (dragging down = negative delta = CCW).
            // No inversion needed here — only the icon-lock snap path needs it.

            this.rotation += delta;
            this.velocity = delta; // Simple velocity tracking
            this.lastAngle = currentAngle;

            this.checkSnapFeedback();

        };

        const end = () => {
            clearTimeout(this.longPressTimer);
            if (!this.hasMoved && this.clickedIcon && !this.isSliding) {
                // Handle Click - Check for inline content first, then href
                if (this.clickedIcon.hasAttribute('active')) {
                    // Check for inline content types
                    if (this.clickedIcon.hasAttribute('data-audio') ||
                        this.clickedIcon.hasAttribute('data-video') ||
                        this.clickedIcon.hasAttribute('data-image') ||
                        this.clickedIcon.hasAttribute('data-email') ||
                        this.clickedIcon.hasAttribute('data-phone') ||
                        this.clickedIcon.hasAttribute('data-map') ||
                        this.clickedIcon.hasAttribute('data-iframe')) {
                        this.showContent(this.clickedIcon);
                    } else if (this.clickedIcon.hasAttribute('href')) {
                        window.location.href = this.clickedIcon.getAttribute('href');
                    }
                }
            }
            this.isDragging = false;
            this.isSliding = false; // Reset sliding state
            this.iconDragState = null;
            this.innerRingDrag = null;
            this.clickedIcon = null;
        };

        this.els.overlay.addEventListener('mousedown', start);
        this.els.overlay.addEventListener('touchstart', start, { passive: false });

        window.addEventListener('mousemove', move);
        window.addEventListener('touchmove', move, { passive: false });

        window.addEventListener('mouseup', end);
        window.addEventListener('touchend', end);
    }

    updateItems() {
        this.items = this.els.itemsSlot.assignedElements();
        // Calculate snap angle based on count
        if (this.items.length > 0) {
            // This will be overridden by updateLayout for half-dial
            this.snapAngle = (Math.PI * 2) / this.items.length;
        }
        this.updateLayout();
    }

    updatePosition() {
        const top = this.getAttribute('top');
        const bottom = this.getAttribute('bottom');
        const justify = this.getAttribute('justify');

        // Reset overrides first
        this.style.top = '';
        this.style.bottom = '';
        this.style.left = '';
        this.style.right = '';
        this.style.transform = '';

        // Vertical Positioning
        if (top) {
            this.style.top = top;
            this.style.bottom = 'auto'; // ensure overrides CSS
            this.style.transform = ''; // Remove translateY for custom top/bottom
        } else if (bottom) {
            this.style.bottom = bottom;
            this.style.top = 'auto';
            this.style.transform = ''; // Remove translateY for custom top/bottom
        } else {
            // Default to vertical center if no top/bottom
            this.style.top = '50%';
            this.style.transform = 'translateY(-50%)';
        }

        // Horizontal Positioning (Justify)
        if (justify === 'left') {
            this.style.left = '-40px';
            this.style.right = 'auto';
        } else {
            // Default to right (or explicit right)
            this.style.right = '-40px';
            this.style.left = 'auto';
        }
    }

    updateLayout() {
        const count = this.items.length;
        if (count === 0) return;

        // Configuration
        const isRight = this.getAttribute('justify') !== 'left';
        // Arc Size: 180 degrees (PI)
        this.snapAngle = 45 * (Math.PI / 180);

        // Center Angle: PI (180) for Right justify, 0 for Left
        const centerAngle = isRight ? Math.PI : 0;

        // Place item 0 at the perpendicular (centerAngle).
        // Subsequent items fan out by snapAngle increments.
        // This ensures one icon ALWAYS lands at the perpendicular position.
        this.items.forEach((item, index) => {
            let angle = centerAngle + (index * this.snapAngle);
            item.dataset.baseAngle = angle;
        });

        // Position items immediately after layout
        this.positionItems();
    }

    positionItems() {
        const isRight = this.getAttribute('justify') !== 'left';
        let minDiff = Infinity;
        let nearestIndex = -1;

        // First pass: Calculate positions and find nearest
        this.items.forEach((item, index) => {
            const baseAngle = parseFloat(item.dataset.baseAngle);
            let angle = baseAngle + this.rotation;

            // Adjust angle for left-justified to mirror
            if (!isRight) angle = -angle;

            const x = this.radius * Math.cos(angle);
            const y = this.radius * Math.sin(angle);
            item.style.transform = `translate(${x}px, ${y}px)`;

            // Determine active proximity relative to the "active slot" (0 or PI)
            let activeTargetAngle = isRight ? Math.PI : 0;
            let normalizedAngle = angle % (2 * Math.PI);
            if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;

            let diff = Math.abs(normalizedAngle - activeTargetAngle);
            if (diff > Math.PI) diff = 2 * Math.PI - diff; // Handle wrap-around

            if (diff < minDiff) {
                minDiff = diff;
                nearestIndex = index;
            }
        });

        // Second pass: Update active state based on nearest index
        if (nearestIndex !== -1 && nearestIndex !== this.activeIndex) {
            this.activeIndex = nearestIndex;
            this.items.forEach((item, i) => {
                if (i === this.activeIndex) {
                    item.setAttribute('active', '');
                    if (this.els.activeLabel) {
                        this.els.activeLabel.textContent = item.getAttribute('label') || '';
                    }
                } else {
                    item.removeAttribute('active');
                }
            });
            if (navigator.vibrate) navigator.vibrate(20);

            this.dispatchEvent(new CustomEvent('bzr-change', {
                detail: {
                    index: this.activeIndex,
                    item: this.items[this.activeIndex]
                }
            }));
        }
    }

    toggle() {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            this.setAttribute('open', '');
            document.body.style.overflow = 'hidden'; // Lock scroll
            // Centering logic can go here if we wanted strictly JS positioning
        } else {
            this.removeAttribute('open');
            document.body.style.overflow = '';
        }
    }


    showContent(item) {
        const label = item.getAttribute('label') || 'Content';
        this.els.contentTitle.textContent = label;
        this.els.contentBody.innerHTML = '';

        // Reset Style
        this.shadowRoot.getElementById('content-container').classList.remove('fullscreen-mode');

        // Audio with Canvas Visualizer
        if (item.hasAttribute('data-audio')) {
            this.shadowRoot.getElementById('content-container').classList.add('fullscreen-mode');
            const audioSrc = item.getAttribute('data-audio');
            this.createAudioVisualizer(audioSrc, item.hasAttribute('data-autoplay'));
        }

        // Video with Canvas Player
        else if (item.hasAttribute('data-video')) {
            this.shadowRoot.getElementById('content-container').classList.add('fullscreen-mode');
            const videoSrc = item.getAttribute('data-video');
            this.createVideoPlayer(videoSrc, item.hasAttribute('data-autoplay'));
        }

        // Image Viewer
        else if (item.hasAttribute('data-image')) {
            this.shadowRoot.getElementById('content-container').classList.add('fullscreen-mode');
            const imgSrc = item.getAttribute('data-image');
            this.createImageViewer(imgSrc);
        }

        // Email Form
        else if (item.hasAttribute('data-email')) {
            const emailTo = item.getAttribute('data-email');
            const form = document.createElement('form');
            form.innerHTML = `
                <label>To:</label>
                <input type="email" name="to" value="${emailTo}" readonly>
                
                <label>Subject:</label>
                <input type="text" name="subject" placeholder="Enter subject" required>
                
                <label>Message:</label>
                <textarea name="message" rows="6" placeholder="Enter your message" required></textarea>
                
                <button type="submit">Send Email</button>
            `;
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const subject = formData.get('subject');
                const message = formData.get('message');
                window.location.href = `mailto:${emailTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
                this.hideContent();
            });
            this.els.contentBody.appendChild(form);
        }

        // Phone Dialer
        else if (item.hasAttribute('data-phone')) {
            const phoneNumber = item.getAttribute('data-phone');
            const phoneDiv = document.createElement('div');
            phoneDiv.innerHTML = `
                <p style="font-size: 24px; margin: 20px 0; text-align: center;">
                    <a href="tel:${phoneNumber}" style="color: var(--primary); text-decoration: none; font-weight: bold;">
                        📞 ${phoneNumber}
                    </a>
                </p>
                <p style="text-align: center; color: #aaa;">
                    Click the number to call
                </p>
            `;
            this.els.contentBody.appendChild(phoneDiv);
        }

        // Map
        else if (item.hasAttribute('data-map')) {
            const address = item.getAttribute('data-map');

            // Create map container
            const mapContainer = document.createElement('div');
            mapContainer.id = 'osm-map-' + Date.now();
            mapContainer.style.width = '100%';
            mapContainer.style.height = '500px';
            mapContainer.style.borderRadius = '8px';
            mapContainer.style.overflow = 'hidden';
            this.els.contentBody.appendChild(mapContainer);

            // Load Leaflet CSS and JS if not already loaded
            if (!document.getElementById('leaflet-css')) {
                const link = document.createElement('link');
                link.id = 'leaflet-css';
                link.rel = 'stylesheet';
                link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                document.head.appendChild(link);
            }

            if (!window.L) {
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                script.onload = () => this.initializeMap(mapContainer, address);
                document.head.appendChild(script);
            } else {
                this.initializeMap(mapContainer, address);
            }
        }

        // Generic iframe
        else if (item.hasAttribute('data-iframe')) {
            const iframeSrc = item.getAttribute('data-iframe');
            const iframe = document.createElement('iframe');
            iframe.src = iframeSrc;
            this.els.contentBody.appendChild(iframe);
        }

        // Show overlay
        this.els.contentOverlay.classList.add('active');
    }

    hideContent() {
        this.els.contentOverlay.classList.remove('active');
        // Stop current animation loop if any
        if (this._mediaRaf) {
            cancelAnimationFrame(this._mediaRaf);
            this._mediaRaf = null;
        }

        // Clean up media
        const media = this.els.contentBody.querySelectorAll('audio, video');
        media.forEach(m => {
            m.pause();
            m.src = '';
            m.remove();
        });

        if (this.audioCtx) {
            this.audioCtx.close();
            this.audioCtx = null;
        }

        this.els.contentBody.innerHTML = '';
        this.shadowRoot.getElementById('content-container').classList.remove('fullscreen-mode');
    }

    initializeMap(container, address) {
        // Geocode the address using Nominatim (OpenStreetMap's geocoding service)
        const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;

        fetch(geocodeUrl)
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lon = parseFloat(data[0].lon);

                    // Initialize the map
                    const map = window.L.map(container).setView([lat, lon], 15);

                    // Add OpenStreetMap tiles
                    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                        maxZoom: 19
                    }).addTo(map);

                    // Add a marker at the location
                    window.L.marker([lat, lon]).addTo(map)
                        .bindPopup(data[0].display_name)
                        .openPopup();
                } else {
                    container.innerHTML = '<p style="padding: 20px; text-align: center;">Location not found</p>';
                }
            })
            .catch(error => {
                console.error('Geocoding error:', error);
                container.innerHTML = '<p style="padding: 20px; text-align: center;">Error loading map</p>';
            });
    }

    createMediaControls(mediaElement, container) {
        const controls = document.createElement('div');
        controls.className = 'media-controls';

        const playBtn = document.createElement('button');
        playBtn.className = 'media-btn';
        playBtn.innerHTML = '▶'; // Play icon

        const progressContainer = document.createElement('div');
        progressContainer.className = 'media-progress-container';

        const progressBar = document.createElement('div');
        progressBar.className = 'media-progress-bar';
        progressContainer.appendChild(progressBar);

        const timeDisplay = document.createElement('div');
        timeDisplay.className = 'media-time';
        timeDisplay.textContent = '0:00 / 0:00';

        controls.appendChild(playBtn);
        controls.appendChild(progressContainer);
        controls.appendChild(timeDisplay);

        container.appendChild(controls); // Append to parent (contentBody usually)

        // Logic
        const togglePlay = () => {
            if (mediaElement.paused) {
                mediaElement.play();
                playBtn.innerHTML = '⏸';
            } else {
                mediaElement.pause();
                playBtn.innerHTML = '▶';
            }
        };

        playBtn.onclick = togglePlay;
        mediaElement.addEventListener('click', togglePlay); // Click video/canvas to toggle

        // Progress Update
        const formatTime = (s) => {
            if (isNaN(s)) return '0:00';
            const m = Math.floor(s / 60);
            const sec = Math.floor(s % 60).toString().padStart(2, '0');
            return `${m}:${sec}`;
        };

        mediaElement.addEventListener('timeupdate', () => {
            const pct = (mediaElement.currentTime / mediaElement.duration) * 100;
            progressBar.style.width = `${pct}%`;
            timeDisplay.textContent = `${formatTime(mediaElement.currentTime)} / ${formatTime(mediaElement.duration)}`;
        });

        mediaElement.addEventListener('ended', () => {
            playBtn.innerHTML = '▶';
        });

        // Seek
        progressContainer.addEventListener('click', (e) => {
            const rect = progressContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pct = clickX / rect.width;
            mediaElement.currentTime = pct * mediaElement.duration;
        });

        // Opacity Logic: Fade out controls when idle
        let idleTimer;
        container.addEventListener('mousemove', () => {
            controls.style.opacity = '1';
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                if (!mediaElement.paused) controls.style.opacity = '0';
            }, 3000);
        });
    }

    createAudioVisualizer(audioSrc, autoplay = false) {
        // Create full screen canvas
        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();

        this.els.contentBody.appendChild(canvas);
        const ctx = canvas.getContext('2d');

        // Audio Element
        const audio = document.createElement('audio');
        audio.src = audioSrc;
        audio.style.display = 'none';
        audio.crossOrigin = 'anonymous'; // Helper for some servers
        if (autoplay) audio.autoplay = true;
        this.els.contentBody.appendChild(audio);

        // Custom Overlay Controls
        this.createMediaControls(audio, this.els.contentBody);

        // Web Audio Initialization
        // Must be resumed on user gesture. Since we are in a click handler context, this should work.
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();

        const analyser = this.audioCtx.createAnalyser();
        analyser.fftSize = 512;

        const source = this.audioCtx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(this.audioCtx.destination);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!this.els.contentOverlay.classList.contains('active')) return;
            this._mediaRaf = requestAnimationFrame(draw);

            analyser.getByteFrequencyData(dataArray);

            // Draw Background
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Circular Visualizer
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            const radius = Math.min(cx, cy) * 0.4;

            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 255, 157, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Bars
            const barWidth = 4;
            const count = 120; // Number of bars around circle
            const step = (Math.PI * 2) / count;

            for (let i = 0; i < count; i++) {
                // Map i to index in frequency data (focus on lower/mids)
                const dataIndex = Math.floor((i / count) * (bufferLength * 0.7));
                const value = dataArray[dataIndex];
                const percent = value / 255;
                const height = percent * (Math.min(cx, cy) * 0.5);

                const angle = i * step - Math.PI / 2;

                const x1 = cx + Math.cos(angle) * radius;
                const y1 = cy + Math.sin(angle) * radius;
                const x2 = cx + Math.cos(angle) * (radius + height);
                const y2 = cy + Math.sin(angle) * (radius + height);

                ctx.strokeStyle = `hsl(${120 + percent * 60}, 100%, 50%)`; // Green to Cyan
                ctx.lineWidth = barWidth;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        };

        // Ensure context is running (browser policy)
        audio.onplay = () => {
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            draw();
        };

        if (autoplay) {
            // Try to start immediately if trusted
            // But usually wait for onplay
        }
    }

    createVideoPlayer(videoSrc, autoplay = false) {
        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();

        this.els.contentBody.appendChild(canvas);
        const ctx = canvas.getContext('2d');

        const video = document.createElement('video');
        video.src = videoSrc;
        video.style.display = 'none'; // Draw via canvas only
        video.crossOrigin = 'anonymous';
        if (autoplay) video.autoplay = true;
        this.els.contentBody.appendChild(video);

        this.createMediaControls(video, this.els.contentBody); // Use video element for timing/play control

        const render = () => {
            if (!this.els.contentOverlay.classList.contains('active')) return;
            this._mediaRaf = requestAnimationFrame(render);

            if (video.paused || video.ended) return;

            // Draw Logic: Cover or Contain? User asked for Full Screen at any aspect ratio.
            // Let's do 'Contain' (Letterboxing) so we don't crop content, but fill background black.

            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const vw = video.videoWidth;
            const vh = video.videoHeight;
            const cw = canvas.width;
            const ch = canvas.height;

            if (vw === 0 || vh === 0) return;

            const result = this.calculateAspectRatioFit(vw, vh, cw, ch);

            ctx.drawImage(video, result.offsetX, result.offsetY, result.width, result.height);
        };

        video.addEventListener('play', () => {
            render();
        });

        // If autoplay works immediately
        if (autoplay) {
            render();
        }
    }

    createImageViewer(imgSrc) {
        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();

        this.els.contentBody.appendChild(canvas);
        const ctx = canvas.getContext('2d');

        const img = new Image();
        img.src = imgSrc;
        img.onload = () => {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const result = this.calculateAspectRatioFit(img.naturalWidth, img.naturalHeight, canvas.width, canvas.height);
            ctx.drawImage(img, result.offsetX, result.offsetY, result.width, result.height);
        };
    }

    calculateAspectRatioFit(srcWidth, srcHeight, maxWidth, maxHeight) {
        const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
        const width = srcWidth * ratio;
        const height = srcHeight * ratio;
        return {
            width,
            height,
            offsetX: (maxWidth - width) / 2,
            offsetY: (maxHeight - height) / 2
        };
    }

    checkSnapFeedback() {
        // Detect if we crossed a "tick"
        // TODO: Implement sophisticated tick logic
        // For now, simple visual check in loop
    }

    _loop() {
        this._raf = requestAnimationFrame(this._boundLoop);

        if (!this.isOpen && Math.abs(this.velocity) < 0.001 && this.targetRotation === null) return;

        // Auto-rotation override
        if (this.targetRotation !== null) {
            let diff = this.targetRotation - this.rotation;
            if (Math.abs(diff) < 0.005) {
                this.rotation = this.targetRotation;
                this.targetRotation = null;
                this.velocity = 0;
            } else {
                this.rotation += diff * 0.15;
            }
            this.draw();
            this.positionItems();
            return;
        }

        // Physics
        if (!this.isDragging) {
            // Inertia
            this.rotation += this.velocity;
            this.velocity *= this.friction;

            // Snapping
            // Find nearest slot
            if (Math.abs(this.velocity) < 0.01) {
                let slot = Math.round(this.rotation / this.snapAngle);
                let target = slot * this.snapAngle;
                let diff = target - this.rotation;

                this.velocity += diff * this.spring;
            }
        }

        this.draw();
        this.positionItems();
    }

    draw() {
        const ctx = this.els.ctx;
        ctx.clearRect(0, 0, 600, 600);

        // Draw Rail
        const cx = 300;
        const cy = 300;

        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Active Indicator (at 3 o'clock? or 12?)
        // Standard: 3 o'clock (0 degrees).
        // Right Justified: 9 o'clock (PI degrees) - Lefty mode / Visible side.

        const isRight = this.getAttribute('justify') === 'right';
        const indicatorAngle = isRight ? Math.PI : 0;

        ctx.strokeStyle = '#00ff9d';
        ctx.lineWidth = 4;
        ctx.beginPath();

        // Calculate position based on angle
        // 0: cx + r, cy
        // PI: cx - r, cy
        let ix = cx + Math.cos(indicatorAngle) * this.radius;
        let iy = cy + Math.sin(indicatorAngle) * this.radius;

        // Draw a small tick/line
        // Tangent is vertical.
        ctx.moveTo(ix, iy - 10);
        ctx.lineTo(ix, iy + 10);
        ctx.stroke();

        // Optional: Velocity Warp?
        if (Math.abs(this.velocity) > 0.05) {
            ctx.strokeStyle = `rgba(0,255,157,${Math.min(1, Math.abs(this.velocity) * 5)})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, this.radius + 10, this.rotation, this.rotation + Math.PI / 4);
            ctx.stroke();
        }

        this.drawInnerControls(ctx, cx, cy);
    }

    drawInnerControls(ctx, cx, cy) {
        // Inner radius for the jog dial area
        const r = 75;

        ctx.save();

        // 1. Subtle Track
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 30; // 60px - 90px zone
        ctx.stroke();

        // 2. Directional Arrows
        ctx.strokeStyle = '#00ff9d';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        // Right Side Arrow (Clockwise / Down)
        // Arc from -10deg to +10deg
        ctx.beginPath();
        ctx.arc(cx, cy, r, -0.2, 0.2);
        ctx.stroke();

        // Arrowhead at bottom (0.2 rad)
        let x = cx + Math.cos(0.2) * r;
        let y = cy + Math.sin(0.2) * r;
        // Simple triangle
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 5, y - 5);
        ctx.lineTo(x + 2, y - 8);
        // Actually slightly complex to align with tangent. 
        // Let's use drawing primitives relative to angle.

        this.drawArrowHead(ctx, cx, cy, r, 0.2, 1); // 1 = clockwise (Down)
        this.drawArrowHead(ctx, cx, cy, r, -0.2, -1); // -1 = counter (Up)

        // Left Side Arrow
        // We want them to point "Outward" (Up at top, Down at bottom) to indicate scroll direction.
        // Upper Left (PI - 0.2): CW is Up. So dir = 1.
        // Lower Left (PI + 0.2): CCW is Down. So dir = -1.
        this.drawArrowHead(ctx, cx, cy, r, Math.PI - 0.2, 1);
        this.drawArrowHead(ctx, cx, cy, r, Math.PI + 0.2, -1);

        ctx.restore();
    }

    drawArrowHead(ctx, cx, cy, r, angle, dir) {
        let x = cx + Math.cos(angle) * r;
        let y = cy + Math.sin(angle) * r;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle + (Math.PI / 2 * dir)); // Tangent

        ctx.fillStyle = '#00ff9d';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-4, -8);
        ctx.lineTo(4, -8);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }


}



// Helper Item Component
class BzrItem extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        let icon = this.getAttribute('icon') || '';
        let label = this.getAttribute('label') || '';
        this.render();

        this.addEventListener('click', (e) => {
            // Only navigate if active? User said: "user should be a to click IT... to navigate"
            // Usually implies clicking the active one.
            // Let's allow clicking any if it has an href, but maybe prioritize active check?
            // "click it as the select icon" -> implies it must be selected first?
            // For now, let's just check if it has href. 
            // If we want to strictly follow "click AS the selected icon", we might check 'active'.
            if (this.hasAttribute('active') && this.hasAttribute('href')) {
                window.location.href = this.getAttribute('href');
            }
        });
    }

    static get observedAttributes() { return ['active', 'icon', 'label']; }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            this.render();
        }
    }

    render() {
        let icon = this.getAttribute('icon') || '';
        let label = this.getAttribute('label') || '';

        this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                justify-content: center;
                cursor: pointer;
                user-select: none;
                -webkit-user-select: none;
            }
            .icon-wrapper {
                position: relative;
                width: 60px; height: 60px;
                display: flex; align-items: center; justify-content: center;
                border-radius: 50%;
                /* No transition - instant response during drag */
            }
            img { 
                width: 40px; 
                height: 40px; 
                object-fit: contain; 
                z-index: 2; 
                position: relative;
                user-select: none;
                -webkit-user-select: none;
                -webkit-user-drag: none;
                pointer-events: none;
            }
            .placeholder { width: 40px; height: 40px; background:#333; border-radius:50%; z-index: 2; }
            
            .label { 
                display: none; /* Hidden - moved to main dial overlay */
            }
            
            /* Active State */
            :host([active]) .label { opacity: 0; }
            
            :host([active]) .icon-wrapper {
                 /* We don't want the wrapper to scale everything, maybe just the ring? */
                 /* Previous code scaled the host relative to dial. */
            }

            /* Pulsating Glow Ring */
            @keyframes pulse-ring {
                0% { box-shadow: 0 0 0 0 rgba(0, 255, 157, 0.4); border-color: rgba(0, 255, 157, 0.8); }
                70% { box-shadow: 0 0 0 15px rgba(0, 255, 157, 0); border-color: rgba(0, 255, 157, 0); }
                100% { box-shadow: 0 0 0 0 rgba(0, 255, 157, 0); border-color: rgba(0, 255, 157, 0); }
            }
            
            :host([active]) .icon-wrapper::after {
                content: '';
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                border-radius: 50%;
                border: 2px solid #00ff9d;
                animation: pulse-ring 2s infinite;
                z-index: 1;
            }

        </style>
        <div class="icon-wrapper">
            ${icon ? `<img src="${icon}">` : '<div class="placeholder"></div>'}
        </div>
        <div class="label">${label}</div>
        `;
    }
}
customElements.define('bzr-dial-menu', BzrDialMenu);
customElements.define('bzr-item', BzrItem);

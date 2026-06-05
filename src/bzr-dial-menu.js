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
        
        // License validation
        this._licenseValid = this._validateLicense();
        if (!this._licenseValid && typeof console !== 'undefined') {
            console.warn('bzr-dial-ui: No valid license key. Purchase at https://bzzrr.link');
        }

        this.attachShadow({ mode: 'open' });

        // Watermark for unlicensed use
        this._unlicensed = !this._licenseValid;

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
        this.friction = 0.985;
        this.spring = 0.1;

        // Animation Loop
        this._raf = null;
        this._boundLoop = this._loop.bind(this);
    }

    /**
     * Validate license key format: BZRD-XXXX-XXXX-XXXX-XXXX
     * Full validation requires server-side check.
     */
    _validateLicense() {
        const key = this.getAttribute('license');
        if (!key) return false;
        return /^BZRD-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(key);
    }

    static get observedAttributes() {
        return ['radius', 'snap', 'sensitivity', 'justify', 'top', 'bottom'];
    }

    connectedCallback() {
        this.render();
        this.setupEvents();

        this.updateItems();
        this.updatePosition();

        // Host click listener for easier interaction when docked
        this.addEventListener('click', (e) => {
            console.log('Host clicked', e.composedPath());

            // If dragging, ignore
            if (this.isDragging || this.isSliding) return;

            // If closed, open it if we clicked the host (fallback/primary for docked)
            if (!this.isOpen) {
                console.log(' Opening via Host Click');
                this.toggle();
            }
        });

        // Initial tick
        this._loop();

        // Unlicensed watermark
        if (this._unlicensed) {
            this._addWatermark();
        }
    }

    _addWatermark() {
        const style = document.createElement('style');
        style.textContent = `
            .bzr-watermark {
                position: fixed;
                bottom: 12px;
                right: 12px;
                background: rgba(0,0,0,0.7);
                color: #f59e0b;
                font-family: 'Space Grotesk', monospace;
                font-size: 10px;
                padding: 4px 8px;
                border-radius: 4px;
                z-index: 99999;
                pointer-events: none;
                letter-spacing: 0.5px;
            }
        `;
        document.head.appendChild(style);
        const wm = document.createElement('div');
        wm.className = 'bzr-watermark';
        wm.textContent = 'bzr-dial-ui — UNLICENSED — bzzrr.link';
        document.body.appendChild(wm);
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
                top: 0;
                right: 0;
                width: calc(var(--trigger-size, 80px) + var(--trigger-inset, 20px));
                height: calc(var(--trigger-size, 80px) + var(--trigger-inset, 20px));
                z-index: 9999;
                font-family: 'Space Grotesk', sans-serif;
                --primary: #2bee8c;
                --bg: #111;
                --text: #fff;
                --trigger-size: 80px;
                --trigger-inset: calc(var(--trigger-size) / 2 * 0.5);
            }

            @keyframes pulse {
                0% { box-shadow: 0 0 0 0 rgba(43, 238, 140, 0.3); }
                70% { box-shadow: 0 0 0 20px rgba(43, 238, 140, 0); }
                100% { box-shadow: 0 0 0 0 rgba(43, 238, 140, 0); }
            }

            #trigger:hover {
                animation: pulse 1.5s infinite;
            }

            :host([justify="left"]) {
                right: auto;
                left: 0px;
            }

            :host([justify="left"]) #trigger {
                right: auto;
                left: var(--trigger-inset, 20px);
            }

            /* Open: host goes fullscreen but invisible; overlay handles interaction */
            :host([open]) {
                width: 100%;
                height: 100%;
                pointer-events: none;
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
                z-index: 9998;
            }

            /* When open: fullscreen overlay captures all input */
            :host([open]) #overlay {
                pointer-events: auto;
                background: rgba(0,0,0,0.60);
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
                opacity: 1;
            }

            /* Trigger = always position:fixed at the viewport edge, regardless of host state */
            #trigger {
                position: fixed;
                top: 50%;
                right: var(--trigger-inset, 20px);
                transform: translateY(-50%);
                width: var(--trigger-size, 80px);
                height: var(--trigger-size, 80px);
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

            /* Container for the rotating dial elements — atom model.
               When closed: collapsed at host origin (clipped to 80x80 host).
               When open: JS positions .dial-fixed at the trigger center in viewport
               coordinates so the ring radiates from the screen edge. */
            #dial-container {
                position: absolute;
                top: 0;
                left: 0;
                width: 0; height: 0;
                opacity: 0;
                transition: opacity 0.3s;
                pointer-events: none;
            }

            :host([open]) #dial-container {
                opacity: 1;
                pointer-events: auto;
            }

            #dial-container.dial-fixed {
                position: fixed;
            }

            :host([justify="left"]) #dial-container.dial-fixed {
                /* left-justify: mirror the ring direction */
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

            /* The Canvas Rail — centered on the trigger/origin point */
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

            /* Exit item - always red tinted */
            ::slotted(bzr-item[data-exit]) {
                opacity: 0.6;
                transition: opacity 0.2s;
            }
            ::slotted(bzr-item[data-exit][active]) {
                opacity: 1;
                color: #ff4444;
                text-shadow: 0 0 10px #ff4444;
            }

            /* ═══ Content Overlay Modal ═══ */
            #content-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                opacity: 0;
                transition: opacity 0.3s ease;
                padding: 24px;
                pointer-events: none;
            }

            #content-overlay.active {
                display: flex;
                opacity: 1;
                pointer-events: auto;
            }

            #content-container {
                background: #111;
                border: 1px solid #333;
                border-radius: 16px;
                width: 100%;
                max-width: 720px;
                max-height: calc(100vh - 48px);
                display: flex;
                flex-direction: column;
                position: relative;
                box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
                overflow: hidden;
                pointer-events: auto;
            }

            /* Modal Header */
            #content-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 20px 24px;
                border-bottom: 1px solid #222;
                flex-shrink: 0;
            }

            #content-title {
                font-size: 18px;
                font-weight: 700;
                color: var(--primary);
                letter-spacing: -0.3px;
                margin: 0;
            }

            #content-close {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: rgba(255,255,255,0.08);
                color: #888;
                border: none;
                font-size: 20px;
                line-height: 1;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.15s ease;
                flex-shrink: 0;
            }

            #content-close:hover {
                background: var(--primary);
                color: #000;
                transform: scale(1.1);
            }

            /* Modal Body */
            #content-body {
                padding: 24px;
                overflow-y: auto;
                flex: 1;
            }

            /* ─── Media: Audio / Video ─── */
            .modal-media-wrap {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 20px;
            }

            .modal-media-canvas {
                width: 100%;
                max-width: 600px;
                aspect-ratio: 16/9;
                background: #000;
                border-radius: 12px;
                overflow: hidden;
            }

            .modal-media-canvas canvas {
                width: 100%;
                height: 100%;
            }

            /* ─── Image Viewer ─── */
            .modal-image-wrap {
                display: flex;
                align-items: center;
                justify-content: center;
                background: #000;
                border-radius: 12px;
                overflow: hidden;
                min-height: 200px;
            }

            .modal-image-wrap img {
                max-width: 100%;
                max-height: 70vh;
                object-fit: contain;
            }

            /* ─── Form Styles ─── */
            #content-body form {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            #content-body label {
                font-size: 12px;
                font-weight: 600;
                color: var(--primary);
                text-transform: uppercase;
                letter-spacing: 1px;
                margin: 0;
            }

            #content-body input,
            #content-body textarea {
                width: 100%;
                padding: 14px 16px;
                background: rgba(255,255,255,0.05);
                border: 1px solid #333;
                border-radius: 10px;
                color: var(--text);
                font-size: 15px;
                font-family: inherit;
                transition: border-color 0.15s, box-shadow 0.15s;
                box-sizing: border-box;
            }

            #content-body input:focus,
            #content-body textarea:focus {
                outline: none;
                border-color: var(--primary);
                box-shadow: 0 0 0 3px rgba(43, 238, 140, 0.15);
            }

            #content-body textarea {
                min-height: 120px;
                resize: vertical;
            }

            #content-body .form-actions {
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                margin-top: 8px;
            }

            #content-body .btn {
                padding: 12px 28px;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s;
                border: none;
                font-family: inherit;
            }

            #content-body .btn-primary {
                background: var(--primary);
                color: #000;
            }

            #content-body .btn-primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(43, 238, 140, 0.3);
            }

            #content-body .btn-ghost {
                background: transparent;
                color: #888;
                border: 1px solid #333;
            }

            #content-body .btn-ghost:hover {
                border-color: #555;
                color: #ccc;
            }

            /* ─── Phone Card ─── */
            .modal-phone-card {
                text-align: center;
                padding: 20px 0;
            }

            .modal-phone-icon {
                font-size: 48px;
                margin-bottom: 16px;
            }

            .modal-phone-number {
                font-size: 32px;
                font-weight: 700;
                color: var(--primary);
                margin-bottom: 8px;
                letter-spacing: -0.5px;
            }

            .modal-phone-hint {
                font-size: 14px;
                color: #666;
                margin-bottom: 24px;
            }

            .modal-phone-call-btn {
                display: inline-flex;
                align-items: center;
                gap: 10px;
                padding: 16px 40px;
                background: var(--primary);
                color: #000;
                border-radius: 12px;
                font-size: 16px;
                font-weight: 700;
                text-decoration: none;
                transition: all 0.15s;
            }

            .modal-phone-call-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(43, 238, 140, 0.3);
            }

            /* ─── Map ─── */
            .modal-map-wrap {
                border-radius: 12px;
                overflow: hidden;
                border: 1px solid #333;
            }

            .modal-map-wrap > div {
                width: 100% !important;
                height: 400px !important;
            }

            /* ─── Iframe ─── */
            #content-body iframe {
                width: 100%;
                height: 500px;
                border: none;
                border-radius: 12px;
                background: #000;
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
                <div id="content-header">
                    <div id="content-title"></div>
                    <button id="content-close">×</button>
                </div>
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
        // Click delay timer to distinguish single vs double click
        this._clickTimer = null;
        this._resizeHandlers = [];

        // Reposition dial container on viewport resize when open
        let _resizeTimer = null;
        window.addEventListener('resize', () => {
            if (!this.isOpen) return;
            clearTimeout(_resizeTimer);
            _resizeTimer = setTimeout(() => this._positionDialContainer(), 100);
        });

        // Trigger click handler - toggles menu and closes content overlay
        this.els.trigger.addEventListener('click', (e) => {
            // If dragging or sliding, ignore
            if (this.isDragging || this.isSliding) return;

            // Clear any pending click timer
            clearTimeout(this._clickTimer);

            // Capture the current state at click time
            const wasOpen = this.isOpen;

            // Delay the click action to see if a double-click is coming
            this._clickTimer = setTimeout(() => {
                // If was open when clicked, close both the menu and any content overlay
                if (wasOpen) {
                    this.hideContent();
                    this.toggle();
                }
                // If was closed, the event already bubbled to host listener which opened it
            }, 250); // 250ms delay to detect double-click
        });

        // Double click to enable slide mode
        this.els.trigger.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            e.preventDefault();

            // Cancel the pending single-click action
            clearTimeout(this._clickTimer);

            // Close the menu if it's open (from the first click)
            if (this.isOpen) {
                this.hideContent();
                this.toggle();
            }

            // Toggle slide mode
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
        this.els.contentClose.addEventListener('click', () => {
            this.hideContent();
            if (this.isOpen) this.toggle();
        });

        // Click on backdrop (outside modal card) closes content + dial
        this.els.contentOverlay.addEventListener('click', (e) => {
            if (e.target === this.els.contentOverlay) {
                this.hideContent();
                if (this.isOpen) this.toggle();
            }
        });



        // Drag Interaction on Overlay
        const start = (e) => {
            if (!this.isOpen) return;
            e.preventDefault(); // Prevent default drag behavior/ghosting
            console.log('[bzr-start] isOpen=' + this.isOpen + ' target=' + (e.target ? e.target.tagName : 'null'));
            this.isDragging = true;
            this.velocity = 0;
            this.targetRotation = null;

            let x = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
            let y = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

            // Check for Icon Hit
            const path = e.composedPath();
            const hitIcon = path.find(el => el.tagName === 'BZR-ITEM');
            console.log('[bzr-start] hitIcon=' + (hitIcon ? hitIcon.getAttribute('label') : 'null') + ' pathLen=' + path.length);
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

                // Clear transform to avoid translateY offset issues
                this.style.transform = 'none';
                this.style.top = `${newTop}px`;

                // Reposition the dial container to follow the trigger
                if (this.isOpen) {
                    this._positionDialContainer();
                }

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

                    // Drag down (dy > 0) → decrease rotation by one slot.
                    // For right dials: items above have higher baseAngles (225°, 270°),
                    //   so negative rotation brings them down to the perpendicular (180°).
                    // For left dials: mirroring in positionItems means the same direction works.
                    let direction = dy > 0 ? -1 : 1;

                    let currentSlot = Math.round(this.rotation / this.snapAngle);
                    let targetSlot = currentSlot + direction;
                    this.targetRotation = targetSlot * this.snapAngle;
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

            this.rotation += delta;

            // Mirror velocity for left-justify so drag direction matches visual
            const isLeft = this.getAttribute('justify') === 'left';
            if (isLeft) this.velocity = -delta;
            else this.velocity = delta;
            this.lastAngle = currentAngle;

            this.checkSnapFeedback();

        };

        const end = () => {
            clearTimeout(this.longPressTimer);

            console.log('[bzr-end] hasMoved=' + this.hasMoved + ' clickedIcon=' + (this.clickedIcon ? this.clickedIcon.getAttribute('label') : 'null') + ' isSliding=' + this.isSliding + ' isOpen=' + this.isOpen);

            // If we were sliding, persist the new position
            if (this.isSliding && this.hasMoved) {
                const currentTop = this.style.top;
                if (currentTop) {
                    // Store the position as an attribute so it persists
                    this.setAttribute('top', currentTop);
                }
            }

            if (!this.hasMoved && this.clickedIcon && !this.isSliding) {
                // Handle Click on an icon
                const isActive = this.clickedIcon.hasAttribute('active');
                console.log('[bzr-end] clicked icon active=' + isActive + ' label=' + this.clickedIcon.getAttribute('label'));
                if (isActive) {
                    // Icon is already at the active slot (9 o'clock) — open its content
                    if (this.clickedIcon.hasAttribute('data-audio') ||
                        this.clickedIcon.hasAttribute('data-video') ||
                        this.clickedIcon.hasAttribute('data-image') ||
                        this.clickedIcon.hasAttribute('data-email') ||
                        this.clickedIcon.hasAttribute('data-phone') ||
                        this.clickedIcon.hasAttribute('data-map') ||
                        this.clickedIcon.hasAttribute('data-iframe')) {
                        this.showContent(this.clickedIcon);
                        console.log('[bzr-end] calling showContent for ' + this.clickedIcon.getAttribute('label'));
                    } else if (this.clickedIcon.hasAttribute('href')) {
                        window.location.href = this.clickedIcon.getAttribute('href');
                    }
                } else {
                    // Icon is NOT at the active slot — snap it to 9 o'clock
                    // Find the index of the clicked icon
                    const idx = this.items.indexOf(this.clickedIcon);
                    if (idx !== -1) {
                        // Calculate rotation needed to bring this item to the active slot
                        const baseAngle = parseFloat(this.clickedIcon.dataset.baseAngle);
                        const isRight = this.getAttribute('justify') !== 'left';
                        const anchor = this.getAttribute('anchor') || (isRight ? 'right' : 'left');
                        let activeSlotAngle;
                        if (anchor === 'left')       activeSlotAngle = 0;
                        else if (anchor === 'top')   activeSlotAngle = Math.PI / 2;
                        else if (anchor === 'bottom') activeSlotAngle = -Math.PI / 2;
                        else                         activeSlotAngle = Math.PI;

                        // For left-justify, positionItems mirrors: angle = -angle
                        // So we need: -(baseAngle + rotation) = activeSlotAngle (mod 2π)
                        // rotation = -baseAngle - activeSlotAngle
                        let targetRot;
                        if (!isRight) {
                            targetRot = -baseAngle - activeSlotAngle;
                        } else {
                            targetRot = activeSlotAngle - baseAngle;
                        }
                        // Normalize to nearest equivalent rotation (add multiples of snapAngle
                        // to minimize the distance from current rotation)
                        const currentSlot = Math.round(this.rotation / this.snapAngle);
                        const targetSlot = Math.round(targetRot / this.snapAngle);
                        // Pick the slot closest to current rotation
                        let bestSlot = targetSlot;
                        let bestDist = Math.abs((targetSlot * this.snapAngle) - this.rotation);
                        for (let k = -2; k <= 2; k++) {
                            const s = targetSlot + k;
                            const dist = Math.abs((s * this.snapAngle) - this.rotation);
                            if (dist < bestDist) {
                                bestDist = dist;
                                bestSlot = s;
                            }
                        }
                        this.targetRotation = bestSlot * this.snapAngle;
                        if (navigator.vibrate) navigator.vibrate(20);
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

        // Click overlay backdrop: close content+dial if content showing, or exit slide mode
        this.els.overlay.addEventListener('click', (e) => {
            const contentShowing = this.els.contentOverlay.classList.contains('active');
            if (contentShowing) {
                this.hideContent();
                if (this.isOpen) this.toggle();
            } else if (this.slideEnabled && !this.isOpen && !this.isDragging) {
                // Exit slide mode
                this.slideEnabled = false;
                this.removeAttribute('slide-enabled');
                if (navigator.vibrate) navigator.vibrate(50);
            }
        });
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
        // Host edge is flush with the viewport edge (right:0 or left:0).
        // The trigger nub center sits on that edge via CSS.
        if (justify === 'left') {
            this.style.left = '0px';
            this.style.right = 'auto';
        } else {
            // Default to right (or explicit right)
            this.style.right = '0px';
            this.style.left = 'auto';
        }
    }

    updateLayout() {
        const count = this.items.length;
        if (count === 0) return;

        const isRight = this.getAttribute('justify') !== 'left';
        const anchor = this.getAttribute('anchor') || (isRight ? 'right' : 'left');

        // Active slot angle: where the selected item appears (the "perpendicular" at the edge)
        // Right anchor → items fan leftward, active at PI (9 o'clock / left)
        // Left anchor  → items fan rightward, active at 0 (3 o'clock / right)
        // Top anchor   → items fan downward, active at PI/2 (6 o'clock / bottom)
        // Bottom anchor→ items fan upward, active at -PI/2 (12 o'clock / top)
        let activeSlotAngle;
        if (anchor === 'left')       activeSlotAngle = 0;
        else if (anchor === 'top')   activeSlotAngle = Math.PI / 2;
        else if (anchor === 'bottom') activeSlotAngle = -Math.PI / 2;
        else                         activeSlotAngle = Math.PI; // right (default)

        // Full-dial: items evenly spaced across 360° (2*PI)
        this.snapAngle = (Math.PI * 2) / count;

        // Start from the active slot angle so item[0] appears at the active position
        // when rotation=0. Subsequent items fan out counterclockwise.
        const startAngle = activeSlotAngle;

        this.items.forEach((item, index) => {
            let angle = startAngle + (index * this.snapAngle);
            item.dataset.baseAngle = angle;
        });

        this.positionItems();
    }

    positionItems() {
        const isRight = this.getAttribute('justify') !== 'left';
        const anchor = this.getAttribute('anchor') || (isRight ? 'right' : 'left');
        let minDiff = Infinity;
        let nearestIndex = -1;

        // Active slot is the "perpendicular" — where items face outward from the edge
        let activeTargetAngle;
        if (anchor === 'left')       activeTargetAngle = 0;           // 3 o'clock
        else if (anchor === 'top')   activeTargetAngle = Math.PI / 2;  // 6 o'clock
        else if (anchor === 'bottom') activeTargetAngle = -Math.PI / 2; // 12 o'clock
        else                         activeTargetAngle = Math.PI;      // 9 o'clock (right default)

        // First pass: Calculate positions and find nearest to active slot
        this.items.forEach((item, index) => {
            const baseAngle = parseFloat(item.dataset.baseAngle);
            // Apply rotation: positive rotation = counterclockwise
            let angle = baseAngle + this.rotation;

            // For left-justify, mirror the angle so items fan outward (rightward) from left edge
            if (!isRight) angle = -angle;

            // Position the item using translate relative to the dial center
            const x = this.radius * Math.cos(angle);
            const y = this.radius * Math.sin(angle);
            item.style.transform = `translate(${x}px, ${y}px)`;

            // Find which item is closest to the active slot
            // Normalize angle to [0, 2π)
            let normalizedAngle = angle % (2 * Math.PI);
            if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;

            let diff = Math.abs(normalizedAngle - activeTargetAngle);
            if (diff > Math.PI) diff = 2 * Math.PI - diff;

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

    /** Position the dial-container origin at the trigger center in viewport coords.
     *  Called on open, slide, and any time the trigger position changes. */
    _positionDialContainer() {
        const rect = this.els.trigger.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dc = this.els.container;
        dc.classList.add('dial-fixed');
        dc.style.left = `${cx}px`;
        dc.style.top = `${cy}px`;
    }

    toggle() {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            this.setAttribute('open', '');
            document.body.style.overflow = 'hidden';
            this._positionDialContainer();
        } else {
            this.hideContent();
            this.els.container.classList.remove('dial-fixed');
            this.els.container.style.left = '';
            this.els.container.style.top = '';
            this.removeAttribute('open');
            document.body.style.overflow = '';
        }
    }


    showContent(item) {
        const label = item.getAttribute('label') || 'Content';
        console.log('[showContent] label=' + label);
        this.els.contentTitle.textContent = label;
        this.els.contentBody.innerHTML = '';

        // ─── Audio ───
        if (item.hasAttribute('data-audio')) {
            this.createAudioModal(item.getAttribute('data-audio'), item.hasAttribute('data-autoplay'));
        }
        // ─── Video ───
        else if (item.hasAttribute('data-video')) {
            this.createVideoModal(item.getAttribute('data-video'), item.hasAttribute('data-autoplay'));
        }
        // ─── Image ───
        else if (item.hasAttribute('data-image')) {
            this.createImageModal(item.getAttribute('data-image'));
        }
        // ─── Email ───
        else if (item.hasAttribute('data-email')) {
            this.createEmailModal(item.getAttribute('data-email'));
        }
        // ─── Phone ───
        else if (item.hasAttribute('data-phone')) {
            this.createPhoneModal(item.getAttribute('data-phone'));
        }
        // ─── Map ───
        else if (item.hasAttribute('data-map')) {
            this.createMapModal(item.getAttribute('data-map'));
        }
        // ─── Iframe ───
        else if (item.hasAttribute('data-iframe')) {
            const iframeSrc = item.getAttribute('data-iframe');
            const iframe = document.createElement('iframe');
            iframe.src = iframeSrc;
            this.els.contentBody.appendChild(iframe);
        }

        // Show modal — disable dial overlay pointer events so it doesn't steal touches
        this.els.overlay.style.pointerEvents = 'none';
        this.els.contentOverlay.classList.add('active');
    }

    hideContent() {
        this.els.contentOverlay.classList.remove('active');
        // Re-enable dial overlay pointer events
        this.els.overlay.style.pointerEvents = '';
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

        // Clean up window resize listeners from media players
        this._resizeHandlers.forEach(handler => {
            window.removeEventListener('resize', handler);
        });
        this._resizeHandlers = [];

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
        const showControls = () => {
            controls.style.opacity = '1';
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                if (!mediaElement.paused && !mediaElement.ended) controls.style.opacity = '0';
            }, 3000);
        };
        container.addEventListener('mousemove', showControls);
        container.addEventListener('click', showControls);
    }

    // ═══ Audio Modal ═══
    createAudioModal(audioSrc, autoplay = false) {
        const wrap = document.createElement('div');
        wrap.className = 'modal-media-wrap';

        const canvasEl = document.createElement('div');
        canvasEl.className = 'modal-media-canvas';
        const canvas = document.createElement('canvas');
        canvasEl.appendChild(canvas);
        wrap.appendChild(canvasEl);

        this.els.contentBody.appendChild(wrap);
        const ctx = canvas.getContext('2d');

        const audio = document.createElement('audio');
        audio.src = audioSrc;
        audio.crossOrigin = 'anonymous';
        if (autoplay) audio.autoplay = true;
        this.els.contentBody.appendChild(audio);

        this.createMediaControls(audio, wrap);

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
        const analyser = this.audioCtx.createAnalyser();
        analyser.fftSize = 256;
        const source = this.audioCtx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(this.audioCtx.destination);
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!this.els.contentOverlay.classList.contains('active')) return;
            this._mediaRaf = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            const w = canvas.width = canvasEl.clientWidth * 2;
            const h = canvas.height = canvasEl.clientHeight * 2;
            const cx = w / 2, cy = h / 2;
            const radius = Math.min(cx, cy) * 0.35;

            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, w, h);

            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 255, 157, 0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();

            const barCount = 80;
            const step = (Math.PI * 2) / barCount;
            for (let i = 0; i < barCount; i++) {
                const dataIndex = Math.floor((i / barCount) * (bufferLength * 0.6));
                const pct = dataArray[dataIndex] / 255;
                const barH = pct * radius * 0.8;
                const angle = i * step - Math.PI / 2;
                const x1 = cx + Math.cos(angle) * radius;
                const y1 = cy + Math.sin(angle) * radius;
                const x2 = cx + Math.cos(angle) * (radius + barH);
                const y2 = cy + Math.sin(angle) * (radius + barH);
                ctx.strokeStyle = `hsl(${140 + pct * 40}, 100%, ${40 + pct * 30}%)`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        };

        audio.onplay = () => {
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
            draw();
        };
    }

    // ═══ Video Modal ═══
    createVideoModal(videoSrc, autoplay = false) {
        const wrap = document.createElement('div');
        wrap.className = 'modal-media-wrap';

        const canvasEl = document.createElement('div');
        canvasEl.className = 'modal-media-canvas';
        const canvas = document.createElement('canvas');
        canvasEl.appendChild(canvas);
        wrap.appendChild(canvasEl);

        this.els.contentBody.appendChild(wrap);
        const ctx = canvas.getContext('2d');

        const video = document.createElement('video');
        video.src = videoSrc;
        video.crossOrigin = 'anonymous';
        video.playsInline = true;
        if (autoplay) video.autoplay = true;
        this.els.contentBody.appendChild(video);

        this.createMediaControls(video, wrap);

        const render = () => {
            if (!this.els.contentOverlay.classList.contains('active')) return;
            this._mediaRaf = requestAnimationFrame(render);
            if (video.paused || video.ended) return;

            const w = canvas.width = canvasEl.clientWidth * 2;
            const h = canvas.height = canvasEl.clientHeight * 2;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, h);

            const vw = video.videoWidth, vh = video.videoHeight;
            if (vw && vh) {
                const r = this.calculateAspectRatioFit(vw, vh, w, h);
                ctx.drawImage(video, r.offsetX, r.offsetY, r.width, r.height);
            }
        };

        video.addEventListener('play', () => render());
        if (autoplay) render();
    }

    // ═══ Image Modal ═══
    createImageModal(imgSrc) {
        const wrap = document.createElement('div');
        wrap.className = 'modal-image-wrap';
        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = 'Gallery image';
        wrap.appendChild(img);
        this.els.contentBody.appendChild(wrap);
    }

    // ═══ Email Modal ═══
    createEmailModal(emailTo) {
        const form = document.createElement('form');

        const toGroup = document.createElement('div');
        toGroup.innerHTML = '<label for="email-to">To</label>';
        const toInput = document.createElement('input');
        toInput.type = 'email'; toInput.id = 'email-to'; toInput.name = 'to';
        toInput.value = emailTo; toInput.readOnly = true;
        toGroup.appendChild(toInput);
        form.appendChild(toGroup);

        const subjGroup = document.createElement('div');
        subjGroup.innerHTML = '<label for="email-subject">Subject</label>';
        const subjInput = document.createElement('input');
        subjInput.type = 'text'; subjInput.id = 'email-subject'; subjInput.name = 'subject';
        subjInput.placeholder = 'Enter subject'; subjInput.required = true;
        subjGroup.appendChild(subjInput);
        form.appendChild(subjGroup);

        const msgGroup = document.createElement('div');
        msgGroup.innerHTML = '<label for="email-message">Message</label>';
        const msgInput = document.createElement('textarea');
        msgInput.id = 'email-message'; msgInput.name = 'message';
        msgInput.placeholder = 'Enter your message'; msgInput.required = true;
        msgGroup.appendChild(msgInput);
        form.appendChild(msgGroup);

        const actions = document.createElement('div');
        actions.className = 'form-actions';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button'; cancelBtn.className = 'btn btn-ghost';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => this.hideContent());
        const sendBtn = document.createElement('button');
        sendBtn.type = 'submit'; sendBtn.className = 'btn btn-primary';
        sendBtn.textContent = 'Send Email';
        actions.appendChild(cancelBtn);
        actions.appendChild(sendBtn);
        form.appendChild(actions);

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            window.location.href = `mailto:${emailTo}?subject=${encodeURIComponent(fd.get('subject'))}&body=${encodeURIComponent(fd.get('message'))}`;
            this.hideContent();
        });

        this.els.contentBody.appendChild(form);
    }

    // ═══ Phone Modal ═══
    createPhoneModal(phoneNumber) {
        const card = document.createElement('div');
        card.className = 'modal-phone-card';
        card.innerHTML = `
            <div class="modal-phone-icon">📞</div>
            <div class="modal-phone-number">${phoneNumber}</div>
            <div class="modal-phone-hint">Tap to call this number</div>
        `;
        const callBtn = document.createElement('a');
        callBtn.href = `tel:${phoneNumber}`;
        callBtn.className = 'modal-phone-call-btn';
        callBtn.innerHTML = '📱 Call Now';
        card.appendChild(callBtn);
        this.els.contentBody.appendChild(card);
    }

    // ═══ Map Modal ═══
    createMapModal(address) {
        const wrap = document.createElement('div');
        wrap.className = 'modal-map-wrap';
        const mapDiv = document.createElement('div');
        mapDiv.id = 'osm-map-' + Date.now();
        wrap.appendChild(mapDiv);
        this.els.contentBody.appendChild(wrap);

        if (!document.getElementById('leaflet-css')) {
            const link = document.createElement('link');
            link.id = 'leaflet-css'; link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }
        if (!window.L) {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = () => this.initializeMap(mapDiv, address);
            document.head.appendChild(script);
        } else {
            this.initializeMap(mapDiv, address);
        }
    }

    calculateAspectRatioFit(srcWidth, srcHeight, maxWidth, maxHeight) {

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

            // Snapping — wrap around for free spin wheel
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

        // Active indicator — small dot at the active slot position
        // Right-anchored (default): PI (9 o'clock / left)
        // Left-anchored: 0 (3 o'clock / right)
        const isLeft = this.getAttribute('justify') === 'left';
        const indicatorAngle = isLeft ? 0 : Math.PI;
        const ix = cx + Math.cos(indicatorAngle) * this.radius;
        const iy = cy + Math.sin(indicatorAngle) * this.radius;

        ctx.fillStyle = '#00ff9d';
        ctx.beginPath();
        ctx.arc(ix, iy, 6, 0, Math.PI * 2);
        ctx.fill();

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
        // Reserved for future use — inner jog dial removed for clean icon path
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

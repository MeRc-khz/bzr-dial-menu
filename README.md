# LZ-Dial Component - Configuration Guide

## Table of Contents
1. [Quick Start](#quick-start)
2. [Component Attributes](#component-attributes)
3. [Item Configuration](#item-configuration)
4. [Customization](#customization)
5. [Events](#events)
6. [JavaScript API](#javascript-api)
7. [Examples](#examples)

---

## Quick Start

### 1. Include the Component
```html
<script src="lz-dial.js"></script>
```

### 2. Basic Usage
```html
<lz-dial>
    <lz-item label="Home" icon="home.svg" href="#home"></lz-item>
    <lz-item label="Settings" icon="settings.svg" href="#settings"></lz-item>
    <lz-item label="Profile" icon="profile.svg" href="#profile"></lz-item>
</lz-dial>
```

---

## Component Attributes

### `<lz-dial>` Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `radius` | Number | `120` | Radius of the dial circle in pixels |
| `justify` | String | `center` | Position of the FAB: `left`, `center`, or `right` |
| `snap` | String | `auto` | Snap behavior (currently auto-calculated) |
| `sensitivity` | String | - | Drag sensitivity (reserved for future use) |

#### Examples:

**Default (centered):**
```html
<lz-dial>
    <!-- items -->
</lz-dial>
```

**Left-aligned FAB:**
```html
<lz-dial justify="left">
    <!-- items -->
</lz-dial>
```

**Right-aligned FAB:**
```html
<lz-dial justify="right">
    <!-- items -->
</lz-dial>
```

**Custom radius:**
```html
<lz-dial radius="180">
    <!-- items -->
</lz-dial>
```

**Combined:**
```html
<lz-dial radius="150" justify="right">
    <!-- items -->
</lz-dial>
```

---

## Item Configuration

### `<lz-item>` Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `label` | String | **Yes** | Display name shown when item is active |
| `icon` | URL | No | Path or URL to icon image (SVG, PNG, etc.) |
| `href` | URL | No | Navigation URL when active item is clicked |

#### Examples:

**With icon and link:**
```html
<lz-item 
    label="Home" 
    icon="https://api.iconify.design/mdi:home.svg?color=%23ffffff" 
    href="#home">
</lz-item>
```

**Without icon (shows placeholder):**
```html
<lz-item label="Settings" href="#settings"></lz-item>
```

**Without link (display only):**
```html
<lz-item label="Info" icon="info.svg"></lz-item>
```

### Inline Content Attributes

Display rich media and interactive content inline instead of navigating away!

| Attribute | Type | Description |
|-----------|------|-------------|
| `data-audio` | URL | Audio file to play inline |
| `data-video` | URL | Video file to play inline |
| `data-email` | Email | Show email form for this address |
| `data-phone` | Phone | Show phone dialer for this number |
| `data-map` | Address | Show OpenStreetMap for this location |
| `data-iframe` | URL | Embed any website in iframe |
| `data-autoplay` | Flag | Auto-play audio/video (optional) |

**Note:** Content attributes take priority over `href`. If both are present, content is shown inline.

#### Inline Content Examples:

**Audio Player:**
```html
<lz-item 
    label="Podcast" 
    icon="music.svg"
    data-audio="episode.mp3"
    data-autoplay>
</lz-item>
```

**Video Player:**
```html
<lz-item 
    label="Tutorial" 
    icon="video.svg"
    data-video="tutorial.mp4">
</lz-item>
```

**Email Form:**
```html
<lz-item 
    label="Contact" 
    icon="email.svg"
    data-email="hello@example.com">
</lz-item>
```

**Phone Dialer:**
```html
<lz-item 
    label="Call Us" 
    icon="phone.svg"
    data-phone="+1-555-123-4567">
</lz-item>
```

**OpenStreetMap:**
```html
<lz-item 
    label="Location" 
    icon="map.svg"
    data-map="Eiffel Tower, Paris, France">
</lz-item>
```

**Embed Website:**
```html
<lz-item 
    label="Docs" 
    icon="web.svg"
    data-iframe="https://docs.example.com">
</lz-item>
```

### Overlay Features

When inline content is active, the overlay provides:
- **Responsive Design**: Adapts to screen size and orientation
- **Theming**: Inherits component CSS variables (colors, fonts)
- **Backdrop Blur**: Focuses attention on content
- **Auto-cleanup**: Media (audio/video) automatically stops when the overlay is closed
- **Accessibility**: focus management and keyboard navigation support


---

## Customization

### Custom Trigger Button

You can customize the FAB button content using the `trigger-content` slot:

```html
<lz-dial>
    <!-- Custom trigger content -->
    <div slot="trigger-content" style="font-size:24px;">☰</div>
    
    <!-- Items -->
    <lz-item label="Home" icon="home.svg"></lz-item>
</lz-dial>
```

**Examples:**

**Icon:**
```html
<div slot="trigger-content">
    <img src="menu-icon.svg" style="width:30px;">
</div>
```

**Text:**
```html
<div slot="trigger-content" style="font-weight:bold;">
    MENU
</div>
```

**Emoji:**
```html
<div slot="trigger-content" style="font-size:32px;">
    🎯
</div>
```

### CSS Custom Properties

The component uses CSS custom properties that you can override:

```css
lz-dial {
    --primary: #00ff9d;    /* Primary color (active items, glow) */
    --bg: #111;            /* Background color */
    --text: #fff;          /* Text color */
}
```

**Example:**
```html
<style>
    lz-dial {
        --primary: #ff6b6b;  /* Red theme */
        --bg: #2c3e50;
        --text: #ecf0f1;
    }
</style>

<lz-dial>
    <!-- items -->
</lz-dial>
```

---

## Events

### `lz-change`

Fired when the active item changes (when an item reaches the active position).

**Event Detail:**
```javascript
{
    index: Number,      // Index of the active item (0-based)
    item: HTMLElement   // The lz-item element
}
```

**Usage:**
```javascript
const dial = document.querySelector('lz-dial');

dial.addEventListener('lz-change', (event) => {
    const { index, item } = event.detail;
    const label = item.getAttribute('label');
    
    console.log(`Active item: ${label} (index: ${index})`);
});
```

**Example - Update UI:**
```javascript
dial.addEventListener('lz-change', (event) => {
    const label = event.detail.item.getAttribute('label');
    document.getElementById('status').textContent = `Selected: ${label}`;
});
```

**Example - Track Analytics:**
```javascript
dial.addEventListener('lz-change', (event) => {
    const label = event.detail.item.getAttribute('label');
    analytics.track('dial_item_selected', { item: label });
});
```

---

## JavaScript API

### Properties

```javascript
const dial = document.querySelector('lz-dial');

// Read current state
console.log(dial.isOpen);        // Boolean: is dial open?
console.log(dial.rotation);      // Number: current rotation in radians
console.log(dial.activeIndex);   // Number: index of active item
console.log(dial.items);         // Array: all lz-item elements
console.log(dial.radius);        // Number: dial radius
```

### Methods

```javascript
const dial = document.querySelector('lz-dial');

// Toggle open/close
dial.toggle();

// Programmatically open/close
dial.isOpen = true;   // Open
dial.isOpen = false;  // Close
dial.toggle();        // Toggle
```

### Dynamic Item Management

**Add items dynamically:**
```javascript
const dial = document.querySelector('lz-dial');

const newItem = document.createElement('lz-item');
newItem.setAttribute('label', 'New Item');
newItem.setAttribute('icon', 'new-icon.svg');
newItem.setAttribute('href', '#new');

dial.appendChild(newItem);
```

**Remove items:**
```javascript
const items = dial.querySelectorAll('lz-item');
items[2].remove(); // Remove third item
```

**Update items:**
```javascript
const item = dial.querySelector('lz-item[label="Home"]');
item.setAttribute('label', 'Dashboard');
item.setAttribute('icon', 'dashboard.svg');
```

---

## Examples

### Example 1: Simple Navigation Menu

```html
<lz-dial justify="right">
    <div slot="trigger-content">☰</div>
    
    <lz-item label="Home" icon="home.svg" href="/"></lz-item>
    <lz-item label="About" icon="info.svg" href="/about"></lz-item>
    <lz-item label="Services" icon="services.svg" href="/services"></lz-item>
    <lz-item label="Contact" icon="contact.svg" href="/contact"></lz-item>
</lz-dial>
```

### Example 2: App Actions

```html
<lz-dial radius="150" justify="left">
    <div slot="trigger-content">+</div>
    
    <lz-item label="New Post" icon="edit.svg"></lz-item>
    <lz-item label="Upload Photo" icon="camera.svg"></lz-item>
    <lz-item label="Create Event" icon="calendar.svg"></lz-item>
    <lz-item label="Start Chat" icon="message.svg"></lz-item>
</lz-dial>

<script>
    const dial = document.querySelector('lz-dial');
    
    dial.addEventListener('lz-change', (e) => {
        const label = e.detail.item.getAttribute('label');
        
        // Handle action based on label
        switch(label) {
            case 'New Post':
                openPostEditor();
                break;
            case 'Upload Photo':
                openPhotoUploader();
                break;
            // ... etc
        }
    });
</script>
```

### Example 3: Settings Panel

```html
<lz-dial>
    <lz-item label="Profile" icon="user.svg" href="#profile"></lz-item>
    <lz-item label="Privacy" icon="lock.svg" href="#privacy"></lz-item>
    <lz-item label="Notifications" icon="bell.svg" href="#notifications"></lz-item>
    <lz-item label="Appearance" icon="palette.svg" href="#appearance"></lz-item>
    <lz-item label="Help" icon="help.svg" href="#help"></lz-item>
    <lz-item label="Logout" icon="logout.svg" href="/logout"></lz-item>
</lz-dial>
```

### Example 4: With Custom Styling

```html
<style>
    #custom-dial {
        --primary: #e74c3c;
        --bg: #34495e;
        --text: #ecf0f1;
    }
</style>

<lz-dial id="custom-dial" radius="160" justify="right">
    <div slot="trigger-content" style="font-size:28px; font-weight:bold;">
        ⚡
    </div>
    
    <lz-item label="Dashboard" icon="dashboard.svg" href="/dashboard"></lz-item>
    <lz-item label="Analytics" icon="chart.svg" href="/analytics"></lz-item>
    <lz-item label="Reports" icon="report.svg" href="/reports"></lz-item>
    <lz-item label="Settings" icon="settings.svg" href="/settings"></lz-item>
</lz-dial>
```

### Example 5: Using Iconify Icons

```html
<lz-dial>
    <lz-item 
        label="Home" 
        icon="https://api.iconify.design/mdi:home.svg?color=%23ffffff">
    </lz-item>
    <lz-item 
        label="Search" 
        icon="https://api.iconify.design/mdi:magnify.svg?color=%23ffffff">
    </lz-item>
    <lz-item 
        label="Favorites" 
        icon="https://api.iconify.design/mdi:heart.svg?color=%23ffffff">
    </lz-item>
    <lz-item 
        label="Settings" 
        icon="https://api.iconify.design/mdi:cog.svg?color=%23ffffff">
    </lz-item>
</lz-dial>
```

---

## Interaction Guide

### User Interactions

1. **Open/Close:** Click the FAB button
2. **Rotate Dial:** 
   - Drag anywhere on the outer ring
   - Drag on icons
   - Drag on inner ring
3. **Quick Navigate:**
   - Swipe up/down on an icon to snap to next/prev item
4. **Select Item:**
   - Click the active (highlighted) item to navigate to its `href`

### Best Practices

1. **Number of Items:** 4-8 items work best for usability
2. **Icon Size:** Use 40x40px icons for best results
3. **Labels:** Keep labels short (1-2 words)
4. **Positioning:** Use `justify` to position FAB where it won't interfere with content
5. **Mobile:** Component is touch-optimized, works great on mobile

---

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

**Requirements:**
- Custom Elements (Web Components)
- Shadow DOM
- ES6 JavaScript

---

## Troubleshooting

### Icons not showing?
- Check icon URL is correct and accessible
- Verify CORS if using external icons
- Check browser console for errors

### Dial not rotating correctly?
- Ensure you're using the latest version
- Check that `justify` attribute matches your layout

### Performance issues?
- Reduce number of items (keep under 10)
- Use optimized SVG icons
- Ensure icons are properly sized (40x40px recommended)

---

## Recent Updates

### Performance Improvements
- **Zero Latency Drag**: Removed generic CSS transitions on drag elements and implemented `will-change: transform` to eliminate ghosting and delay.
- **Optimized Event Handling**: Added `user-select: none` and `pointer-events: none` to prevent default browser drag behaviors interfering with the component.

### Bug Fixes
- **Drag Direction**: Fixed an issue where dragging on the outer ring caused rotation in the wrong direction. The rotation pivot point now correctly uses the FAB center instead of the screen center.

## Future Roadmap

Potential upcoming features:
- PDF viewer integration
- Image gallery/lightbox mode
- Calendar/Date picker interface
- Form builder integration

---

## License

Part of the Lawn Czar UI project.

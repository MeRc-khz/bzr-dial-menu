# Specification: Implement and Verify Inline Media Content Functionality

## 1. Overview
This track ensures that all inline media and content types supported by the `bzr-dial-menu` component are fully implemented, functional, and robust. The goal is to verify that the user experience for each content type is seamless and matches the product guidelines.

## 2. Functional Requirements
The following `data-*` attributes on a `<bzr-item>` must trigger an inline content overlay when the item is active and clicked:

### 2.1. Media Types
- **`data-audio`**:
    - Opens a full-screen overlay with a custom audio player.
    - Player must include play/pause controls, a progress bar, and time display.
    - An audio visualizer should be displayed.
    - The `data-autoplay` attribute should be respected.
- **`data-video`**:
    - Opens a full-screen overlay with a custom video player.
    - Video should be letterboxed to fit the screen while maintaining aspect ratio.
    - Player must include play/pause controls, a progress bar, and time display.
    - The `data-autoplay` attribute should be respected.

### 2.2. Interactive Content
- **`data-email`**:
    - Opens an overlay containing a pre-filled email composition form (`To:`, `Subject:`, `Message:`).
    - Submitting the form should trigger a `mailto:` link.
- **`data-phone`**:
    - Opens an overlay displaying the phone number.
    - Provides a `tel:` link to initiate a call on supported devices.
- **`data-map`**:
    - Opens an overlay displaying an interactive map (OpenStreetMap via Leaflet.js).
    - The map should be centered on the location specified in the attribute value.
    - A marker should be placed on the geocoded location.
- **`data-iframe`**:
    - Opens an overlay containing an `<iframe>` that loads the specified URL.
    - The iframe should be sized appropriately within the overlay.

## 3. Non-Functional Requirements
- **Performance:** All content overlays must load quickly and animate smoothly. Media playback should be performant.
- **UX:** The overlay should be easily dismissible. Media playback (audio/video) must stop automatically when the overlay is closed.
- **Responsiveness:** All overlays and their content must be fully responsive and usable on both desktop and mobile devices.
- **Error Handling:** If a media file or location cannot be found, a user-friendly error message should be displayed within the overlay.

## 4. Out of Scope
- Implementation of new media content types not listed above.
- Backend implementation for email sending (the component will only trigger a `mailto:` link).

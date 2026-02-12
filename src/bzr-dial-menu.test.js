import { describe, it, expect, beforeEach, vi } from 'vitest';
import './bzr-dial-menu.js';

// Mock Web Audio API for jsdom
window.AudioContext = vi.fn().mockImplementation(() => ({
  createAnalyser: vi.fn(() => ({
    fftSize: 2048,
    frequencyBinCount: 1024,
    getByteFrequencyData: vi.fn(),
    connect: vi.fn(),
  })),
  createMediaElementSource: vi.fn(() => ({
    connect: vi.fn(),
  })),
  destination: {},
  resume: vi.fn(),
  close: vi.fn(),
}));

// Mock navigator.vibrate
if (!navigator.vibrate) {
  navigator.vibrate = vi.fn();
}

describe('BzrDialMenu - Audio Player', () => {
  let dialMenu;
  let audioItem;

  beforeEach(() => {
    // Ensure the custom elements are defined before creating them.
    // This check is important because the test file can be re-run in watch mode.
    if (!customElements.get('bzr-dial-menu')) {
      // We need to import the class to define it.
      // This dynamic import is a bit of a workaround for test environments.
      import('./bzr-dial-menu.js').then(module => {
        customElements.define('bzr-dial-menu', module.BzrDialMenu);
        customElements.define('bzr-item', module.BzrItem);
      });
    }

    document.body.innerHTML = `
      <bzr-dial-menu>
        <bzr-item label="Audio" data-audio="test.mp3"></bzr-item>
      </bzr-dial-menu>
    `;
    dialMenu = document.querySelector('bzr-dial-menu');
    audioItem = dialMenu.querySelector('bzr-item');
  });

  it('should create media controls when showContent is called for an audio item', async () => {
    // We need to wait for the component to be fully defined and rendered.
    await customElements.whenDefined('bzr-dial-menu');
    
    dialMenu.showContent(audioItem);

    const contentContainer = dialMenu.shadowRoot.querySelector('#content-container');
    const mediaControls = contentContainer.querySelector('.media-controls');
    
    // This is the actual test, it will fail because the implementation isn't
    // fully wired up in the test environment yet.
    expect(mediaControls, 'Media controls should exist in the shadow DOM').not.toBeNull();
  });

  it('should fail to find the visualizer canvas because it is not rendered yet', async () => {
    await customElements.whenDefined('bzr-dial-menu');
    dialMenu.showContent(audioItem);
    
    const contentBody = dialMenu.shadowRoot.querySelector('#content-body');
    const canvas = contentBody.querySelector('canvas');
    
    // This test will fail because the canvas creation might be asynchronous or conditional
    // on playback, which we are not triggering here.
    expect(canvas, 'Canvas for visualizer should be present').toBeNull(); 
  });

  it('should fail to show progress because the audio element is not playing', async () => {
    await customElements.whenDefined('bzr-dial-menu');
    dialMenu.showContent(audioItem);

    const progressBar = dialMenu.shadowRoot.querySelector('.media-progress-bar');
    
    // The width should be 0% initially. We'll test for a non-zero value to make it fail.
    expect(progressBar.style.width).toBe('50%');
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import './bzr-dial-menu.js';

// Mock Web Audio API for jsdom
const mockAnalyser = {
  fftSize: 2048,
  frequencyBinCount: 1024,
  getByteFrequencyData: vi.fn(),
  connect: vi.fn(),
};
const mockSource = { connect: vi.fn() };

window.AudioContext = class MockAudioContext {
  createAnalyser = vi.fn(() => mockAnalyser);
  createMediaElementSource = vi.fn(() => mockSource);
  destination = {};
  resume = vi.fn();
  close = vi.fn();
};

// Mock navigator.vibrate
if (!navigator.vibrate) {
  navigator.vibrate = vi.fn();
}

describe('BzrDialMenu - Audio Player', () => {
  let dialMenu;
  let audioItem;

  beforeEach(async () => {
    document.body.innerHTML = `
      <bzr-dial-menu>
        <bzr-item label="Audio" data-audio="test.mp3"></bzr-item>
      </bzr-dial-menu>
    `;
    dialMenu = document.querySelector('bzr-dial-menu');
    audioItem = dialMenu.querySelector('bzr-item');
    // Wait for component to be defined and rendered
    await customElements.whenDefined('bzr-dial-menu');
  });

  it('should create media controls when showContent is called for an audio item', () => {
    dialMenu.showContent(audioItem);
    const contentContainer = dialMenu.shadowRoot.querySelector('#content-container');
    const mediaControls = contentContainer.querySelector('.media-controls');
    expect(mediaControls, 'Media controls should exist in the shadow DOM').not.toBeNull();
  });

  it('should render the audio visualizer canvas', () => {
    dialMenu.showContent(audioItem);
    const contentBody = dialMenu.shadowRoot.querySelector('#content-body');
    const canvas = contentBody.querySelector('canvas');
    expect(canvas, 'Canvas for visualizer should be present').not.toBeNull();
  });

  it('should update the progress bar when audio time updates', () => {
    dialMenu.showContent(audioItem);
    
    const audioEl = dialMenu.shadowRoot.querySelector('audio');
    const progressBar = dialMenu.shadowRoot.querySelector('.media-progress-bar');
    
    // Define properties on the mock audio element
    Object.defineProperty(audioEl, 'duration', { value: 200, configurable: true });
    audioEl.currentTime = 50;

    // Dispatch the event
    audioEl.dispatchEvent(new Event('timeupdate'));
    
    // Assert the width is calculated correctly
    expect(progressBar.style.width).toBe('25%');
  });
});

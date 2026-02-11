// Canvas-based Media Player Methods for bzr-dial-menu component

// Add these methods to the LZDial class

createAudioVisualizer(audioSrc, autoplay = false) {
    const container = document.createElement('div');
    container.style.cssText = 'width: 100%; max-width: 900px; margin: 0 auto;';
    
    // Canvas for visualizer
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 400;
    canvas.style.cssText = 'width: 100%; height: auto; background: #000; border-radius: 8px; display: block;';
    
    // Audio element (hidden)
    const audio = document.createElement('audio');
    audio.src = audioSrc;
    audio.style.display = 'none';
    
    // Controls container
    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; align-items: center; gap: 15px; margin-top: 20px; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 8px;';
    
    // Play/Pause button
    const playBtn = document.createElement('button');
    playBtn.innerHTML = '▶️';
    playBtn.style.cssText = 'font-size: 32px; background: none; border: none; cursor: pointer; padding: 0; transition: transform 0.2s;';
    playBtn.onmouseenter = () => playBtn.style.transform = 'scale(1.2)';
    playBtn.onmouseleave = () => playBtn.style.transform = 'scale(1)';
    
    // Progress bar
    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = 'flex: 1; height: 8px; background: rgba(255,255,255,0.2); border-radius: 4px; cursor: pointer; position: relative;';
    
    const progressBar = document.createElement('div');
    progressBar.style.cssText = 'height: 100%; background: var(--primary); border-radius: 4px; width: 0%; transition: width 0.1s;';
    progressContainer.appendChild(progressBar);
    
    // Time display
    const timeDisplay = document.createElement('div');
    timeDisplay.style.cssText = 'font-family: monospace; font-size: 14px; color: #fff; min-width: 100px; text-align: right;';
    timeDisplay.textContent = '0:00 / 0:00';
    
    // Volume control
    const volumeContainer = document.createElement('div');
    volumeContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    
    const volumeIcon = document.createElement('span');
    volumeIcon.textContent = '🔊';
    volumeIcon.style.fontSize = '20px';
    
    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.min = '0';
    volumeSlider.max = '100';
    volumeSlider.value = '100';
    volumeSlider.style.cssText = 'width: 80px; cursor: pointer;';
    
    volumeContainer.appendChild(volumeIcon);
    volumeContainer.appendChild(volumeSlider);
    
    controls.appendChild(playBtn);
    controls.appendChild(progressContainer);
    controls.appendChild(timeDisplay);
    controls.appendChild(volumeContainer);
    
    container.appendChild(canvas);
    container.appendChild(controls);
    container.appendChild(audio);
    this.els.contentBody.appendChild(container);
    
    // Setup Web Audio API
    const ctx = canvas.getContext('2d');
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 2048;
    const source = this.audioContext.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(this.audioContext.destination);
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // Visualizer animation
    const draw = () => {
        this.visualizerAnimationId = requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);
        
        // Clear canvas
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw waveform
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#00ff9d';
        ctx.beginPath();
        
        const sliceWidth = canvas.width / bufferLength;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            
            x += sliceWidth;
        }
        
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        
        // Draw frequency bars
        analyser.getByteFrequencyData(dataArray);
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barX = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
            
            const hue = (i / bufferLength) * 120 + 160;
            ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.6)`;
            ctx.fillRect(barX, canvas.height - barHeight, barWidth, barHeight);
            
            barX += barWidth + 1;
        }
    };
    
    // Event listeners
    let isPlaying = false;
    playBtn.onclick = () => {
        if (isPlaying) {
            audio.pause();
            playBtn.innerHTML = '▶️';
        } else {
            audio.play();
            playBtn.innerHTML = '⏸️';
        }
        isPlaying = !isPlaying;
    };
    
    audio.onplay = () => draw();
    audio.onpause = () => {
        if (this.visualizerAnimationId) {
            cancelAnimationFrame(this.visualizerAnimationId);
        }
    };
    
    audio.ontimeupdate = () => {
        const progress = (audio.currentTime / audio.duration) * 100;
        progressBar.style.width = progress + '%';
        
        const formatTime = (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };
        
        timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration || 0)}`;
    };
    
    progressContainer.onclick = (e) => {
        const rect = progressContainer.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audio.currentTime = percent * audio.duration;
    };
    
    volumeSlider.oninput = (e) => {
        audio.volume = e.target.value / 100;
        volumeIcon.textContent = e.target.value > 50 ? '🔊' : e.target.value > 0 ? '🔉' : '🔇';
    };
    
    if (autoplay) {
        audio.play().then(() => {
            playBtn.innerHTML = '⏸️';
            isPlaying = true;
        });
    }
}

createVideoPlayer(videoSrc, autoplay = false) {
    const container = document.createElement('div');
    container.style.cssText = 'width: 100%; max-width: 1200px; margin: 0 auto; position: relative;';
    
    // Canvas for video
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width: 100%; height: auto; background: #000; border-radius: 8px; display: block; max-height: 70vh;';
    
    // Video element (hidden)
    const video = document.createElement('video');
    video.src = videoSrc;
    video.style.display = 'none';
    video.crossOrigin = 'anonymous';
    
    // Controls container
    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; align-items: center; gap: 15px; margin-top: 15px; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 8px;';
    
    // Play/Pause button
    const playBtn = document.createElement('button');
    playBtn.innerHTML = '▶️';
    playBtn.style.cssText = 'font-size: 32px; background: none; border: none; cursor: pointer; padding: 0; transition: transform 0.2s;';
    playBtn.onmouseenter = () => playBtn.style.transform = 'scale(1.2)';
    playBtn.onmouseleave = () => playBtn.style.transform = 'scale(1)';
    
    // Progress bar
    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = 'flex: 1; height: 8px; background: rgba(255,255,255,0.2); border-radius: 4px; cursor: pointer;';
    
    const progressBar = document.createElement('div');
    progressBar.style.cssText = 'height: 100%; background: var(--primary); border-radius: 4px; width: 0%;';
    progressContainer.appendChild(progressBar);
    
    // Time display
    const timeDisplay = document.createElement('div');
    timeDisplay.style.cssText = 'font-family: monospace; font-size: 14px; color: #fff; min-width: 100px; text-align: right;';
    timeDisplay.textContent = '0:00 / 0:00';
    
    // Fullscreen button
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.innerHTML = '⛶';
    fullscreenBtn.style.cssText = 'font-size: 24px; background: none; border: none; cursor: pointer; color: #fff; padding: 0;';
    fullscreenBtn.onclick = () => {
        if (container.requestFullscreen) {
            container.requestFullscreen();
        }
    };
    
    controls.appendChild(playBtn);
    controls.appendChild(progressContainer);
    controls.appendChild(timeDisplay);
    controls.appendChild(fullscreenBtn);
    
    container.appendChild(canvas);
    container.appendChild(controls);
    container.appendChild(video);
    this.els.contentBody.appendChild(container);
    
    // Setup canvas rendering
    const ctx = canvas.getContext('2d');
    
    video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    };
    
    const drawVideo = () => {
        if (!video.paused && !video.ended) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            requestAnimationFrame(drawVideo);
        }
    };
    
    // Event listeners
    let isPlaying = false;
    playBtn.onclick = () => {
        if (isPlaying) {
            video.pause();
            playBtn.innerHTML = '▶️';
        } else {
            video.play();
            playBtn.innerHTML = '⏸️';
            drawVideo();
        }
        isPlaying = !isPlaying;
    };
    
    video.ontimeupdate = () => {
        const progress = (video.currentTime / video.duration) * 100;
        progressBar.style.width = progress + '%';
        
        const formatTime = (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };
        
        timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration || 0)}`;
    };
    
    progressContainer.onclick = (e) => {
        const rect = progressContainer.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        video.currentTime = percent * video.duration;
    };
    
    // Click canvas to play/pause
    canvas.onclick = () => playBtn.onclick();
    
    if (autoplay) {
        video.play().then(() => {
            playBtn.innerHTML = '⏸️';
            isPlaying = true;
            drawVideo();
        });
    }
}

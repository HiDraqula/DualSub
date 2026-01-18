// Runs AUTOMATICALLY inside iframe when page loads
(function() {
  'use strict';
  
  console.log('iframe-subs.js loaded in iframe');
  
  // Listen for postMessage from main extension content script
  window.addEventListener('message', function(e) {
    // Verify message origin for security
    if (e.data.from !== 'dual-subs-extension') return;
    
    if (e.data.action === 'getTracks') {
      console.log('iframe-subs: Received getTracks request');
      
      const video = document.querySelector('video');
      if (!video) {
        console.log('iframe-subs: No video found');
        return;
      }
      
      if (!video.textTracks || video.textTracks.length === 0) {
        console.log('iframe-subs: No text tracks found');
        return;
      }
      
      // Extract all available subtitle tracks
      const tracks = Array.from(video.textTracks).map((track, i) => {
        const trackInfo = {
          id: i,
          label: track.label || `Track ${i + 1}`,
          language: track.language || 'unknown',
          kind: track.kind || 'subtitles',
          mode: track.mode || 'disabled'
        };
        console.log(`iframe-subs: Track ${i}:`, trackInfo);
        return trackInfo;
      }).filter(t => t.mode !== 'disabled'); // Only return enabled tracks
      
      // Send tracks BACK to main content script
      e.source.postMessage({
        action: 'tracksFound',
        tracks: tracks,
        videoInfo: {
          duration: video.duration,
          currentTime: video.currentTime,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight
        }
      }, '*');
      
      console.log(`iframe-subs: Found and sent ${tracks.length} subtitle tracks`);
    }
  }, false);
  
  // Also listen for track changes and notify parent automatically
  function monitorTracks() {
    const video = document.querySelector('video');
    if (!video || !video.textTracks) return;
    
    Array.from(video.textTracks).forEach((track, i) => {
      track.addEventListener('cuechange', () => {
        if (window.parent && window.parent.postMessage) {
          window.parent.postMessage({
            action: 'trackUpdate',
            from: 'iframe-subs',
            trackId: i,
            activeCues: Array.from(track.activeCues || []).map(cue => cue.text)
          }, '*');
        }
      });
    });
  }
  
  // Start monitoring once video is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', monitorTracks);
  } else {
    monitorTracks();
  }
  
})();

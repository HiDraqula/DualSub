(function() {
  'use strict';
  
  // Watch for JW Player video creation
  const observer = new MutationObserver(() => {
    const video = document.querySelector('video');
    if (video && video.textTracks?.length > 0) {
      console.log('🎥 JWPLAYER VIDEO FOUND:', video.textTracks.length, 'tracks');
      
      // Force all tracks visible
      Array.from(video.textTracks).forEach(track => {
        track.mode = 'showing';
      });
      
      // Report to parent
      window.parent.postMessage({
        action: 'JWPLAYER_TRACKS',
        tracks: Array.from(video.textTracks).map((t, i) => ({
          id: i,
          label: t.label || `Track ${i+1}`,
          language: t.language || 'unknown'
        })),
        videoId: location.href
      }, '*');
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Also listen for postMessages
  window.addEventListener('message', (e) => {
    if (e.data.action === 'DUAL_SUBS_FIND_VIDEO') {
      const video = document.querySelector('video');
      if (video && video.textTracks?.length > 0) {
        window.parent.postMessage({
          action: 'JWPLAYER_TRACKS',
          tracks: Array.from(video.textTracks).map((t, i) => ({
            id: i, label: t.label || `Track ${i+1}`, language: t.language
          }))
        }, '*');
      }
    }
  });
})();

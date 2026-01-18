// Runs AUTOMATICALLY inside iframe when page loads
(function() {
  // Listen for postMessage from main extension
  window.addEventListener('message', function(e) {
    if (e.data.action === 'getTracks' && e.data.from === 'dual-subs-extension') {
      const video = document.querySelector('video');
      if (video && video.textTracks && video.textTracks.length > 0) {
        const tracks = Array.from(video.textTracks).map((track, i) => ({
          id: i,
          label: track.label || `Track ${i+1}`,
          language: track.language || 'unknown',
          mode: track.mode
        })).filter(t => t.mode !== 'disabled');
        
        // Send tracks BACK to main extension
        e.source.postMessage({
          action: 'tracksFound',
          tracks: tracks
        }, '*');
        
        console.log('iframe-subs: Found', tracks.length, 'subtitle tracks');
      }
    }
  });
})();


// // Runs INSIDE iframe - no CORS issues
// window.addEventListener('message', (e) => {
//   if (e.data.action === 'getTracks') {
//     const video = document.querySelector('video');
//     if (video?.textTracks) {
//       const tracks = Array.from(video.textTracks).map((t,i) => ({
//         id: i, label: t.label, language: t.language
//       }));
//       e.source.postMessage({ action: 'tracksFound', tracks }, '*');
//     }
//   }
// });

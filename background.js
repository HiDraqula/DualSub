// Service Worker - HTML Dumper + Debug Console
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadFile') {
    chrome.downloads.download({
      url: request.url, filename: request.filename, saveAs: true
    }, () => sendResponse({success: true}));
    return true;
  }
  
  // DUMP FULL PAGE HTML
  if (request.action === 'dumpHtml') {
    chrome.tabs.sendMessage(sender.tab.id, {action: 'getPageHtml'}, (htmlResponse) => {
      if (htmlResponse?.html) {
        const blob = new Blob([htmlResponse.html], {type: 'text/html'});
        chrome.downloads.download({
          url: URL.createObjectURL(blob),
          filename: `net20-${Date.now()}.html`,
          saveAs: true
        });
      }
      sendResponse({success: !!htmlResponse});
    });
    return true;
  }
  
  // FORCE INJECT iframe-subs.js into ALL iframes
  if (request.action === 'forceInject') {
    chrome.scripting.executeScript({
      target: {tabId: sender.tab.id, allFrames: true},
      func: () => {
        const script = document.createElement('script');
        script.textContent = `(${iframeFinder.toString()})();`;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
      }
    });
  }
});

// iframeFinder function - will be injected
function iframeFinder() {
  window.addEventListener('message', (e) => {
    if (e.data.action === 'DUAL_SUBS_FIND_VIDEO') {
      const video = document.querySelector('video');
      if (video) {
        console.log('🎥 IFRAME VIDEO FOUND!', video.textTracks?.length);
        window.parent.postMessage({
          action: 'VIDEO_REPORT',
          videoId: location.href,
          tracks: Array.from(video.textTracks || []).map((t,i) => ({
            id: i, label: t.label || `Track ${i+1}`
          }))
        }, '*');
      }
    }
  });
}

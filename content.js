// Runs AUTOMATICALLY inside iframe when page loads
(function() {
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
        
        e.source.postMessage({
          action: 'tracksFound',
          tracks: tracks
        }, '*');
        
        console.log('iframe-subs: Found', tracks.length, 'subtitle tracks');
      }
    }
  });
})();

let isEnabled = false;
let status = {
  active: false,
  tracks: {},
  selectedTracks: { primary: null, secondary: null },
  videoInfo: {},
  allTracks: [],
  domInfo: { iframes: 0, videos: 0, iframesWithVideo: 0 },
  logs: [],
  htmlSnippet: "",
  iframeMessageSent: false,
  videoSource: null,
  dualSubOverlay: null
};

let checkInterval = null;

// Remove CORS headers
chrome.webRequest.onHeadersReceived.addListener(
  function(details) {
    return {
      responseHeaders: details.responseHeaders.filter(header => 
        !['content-security-policy', 'x-frame-options'].includes(header.name.toLowerCase())
      )
    };
  },
  { urls: ["*://net20.cc/*"] },
  ["blocking", "responseHeaders"]
);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getStatus") {
    sendResponse(status);
  } else if (request.action === "deepScan") {
    deepScan();
    sendResponse({ success: true });
  } else if (request.action === "toggleSubs") {
    toggleDualSubs();
    sendResponse({ success: true, enabled: isEnabled });
  } else if (request.action === "selectTrack1") {
    status.selectedTracks.primary = request.trackId;
    updateDualSubs();
    sendResponse(status);
  } else if (request.action === "selectTrack2") {
    status.selectedTracks.secondary = request.trackId;
    updateDualSubs();
    sendResponse(status);
  } else if (request.action === "exportFullHtml") {
    const fullHtml = document.documentElement.outerHTML;
    status.htmlSnippet = fullHtml.substring(0, 10000) + `\n\n[... ${fullHtml.length - 10000} chars truncated]`;
    downloadHtml('page-full.html', status.htmlSnippet);
    sendResponse(status);
  } else if (request.action === "exportIframeHtml") {
    exportIframeHtml();
    sendResponse(status);
  }
});

function downloadHtml(filename, content) {
  const blob = new Blob([content], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  chrome.runtime.sendMessage({
    action: 'downloadFile',
    filename: filename,
    url: url
  });
}

function exportIframeHtml() {
  const iframes = document.querySelectorAll("iframe");
  let iframeInfo = "<html><body><h2>Iframe Analysis</h2>";
  iframes.forEach((iframe, i) => {
    iframeInfo += `<h3>IFRAME ${i}</h3>`;
    iframeInfo += `<p>src: ${iframe.src}</p>`;
    iframeInfo += `<p>width: ${iframe.offsetWidth}px, height: ${iframe.offsetHeight}px</p>`;
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeInfo += `<p>HTML: ${iframeDoc.body.innerHTML.substring(0, 1000)}...</p>`;
      } else {
        iframeInfo += `<p>HTML: CORS BLOCKED</p>`;
      }
    } catch (e) {
      iframeInfo += `<p>HTML: ${e.message}</p>`;
    }
  });
  iframeInfo += "</body></html>";
  downloadHtml('iframes.html', iframeInfo);
}

function createIndicator() {
  if (document.querySelector("#dual-subs-indicator")) return;
  const indicator = document.createElement("div");
  indicator.id = "dual-subs-indicator";
  Object.assign(indicator.style, {
    position: "fixed", top: "10px", right: "10px", minWidth: "200px", minHeight: "24px",
    background: "rgba(0, 123, 255, 0.95)", color: "white", padding: "6px 10px",
    borderRadius: "12px", fontSize: "11px", fontWeight: "600", zIndex: "1000000",
    fontFamily: "-apple-system, system-ui, sans-serif", boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
    pointerEvents: "none", lineHeight: "1.2", textAlign: "center"
  });
  document.body.appendChild(indicator);
  return indicator;
}

function createDualSubOverlay() {
  if (status.dualSubOverlay) return status.dualSubOverlay;
  
  const overlay = document.createElement('div');
  overlay.id = 'dual-subs-overlay';
  Object.assign(overlay.style, {
    position: 'fixed', bottom: '10%', left: '50%', transform: 'translateX(-50%)',
    maxWidth: '90%', zIndex: '1000001', pointerEvents: 'none',
    fontFamily: '-apple-system, sans-serif', textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
  });
  document.body.appendChild(overlay);
  status.dualSubOverlay = overlay;
  return overlay;
}

function deepScan() {
  status.domInfo = {
    iframes: document.querySelectorAll("iframe").length,
    videos: document.querySelectorAll("video").length,
    iframesWithVideo: 0,
    elementsWithTracks: 0
  };
  const iframes = document.querySelectorAll("iframe");
  iframes.forEach((iframe, i) => {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        const iframeVideos = iframeDoc.querySelectorAll("video");
        status.domInfo.iframesWithVideo += iframeVideos.length;
      }
    } catch (e) {
      status.logs.push(`iframe-${i}: CORS blocked`);
    }
  });
}

function initDualSubs() {
  const indicator = createIndicator();
  if (!indicator) return false;
  deepScan();

  const iframe = document.querySelector("iframe");
  if (iframe && !status.iframeMessageSent) {
    try {
      iframe.contentWindow.postMessage({
        action: "getTracks",
        from: "dual-subs-extension"
      }, "*");
      status.iframeMessageSent = true;
      status.logs.push("📤 Sent postMessage to iframe");
    } catch (e) {
      status.logs.push("❌ postMessage error: " + e.message);
    }
  }

  let video = document.querySelector("video");
  if (video?.textTracks?.length > 0) {
    status.allTracks = Array.from(video.textTracks)
      .map((t, i) => ({ id: i, label: t.label || `Track ${i+1}`, language: t.language || "unknown" }))
      .filter(t => t.mode !== 'disabled');
    status.videoSource = "main-video";
    updateIndicator(indicator);
    return true;
  }

  const iframes = document.querySelectorAll("iframe");
  for (let iframe of iframes) {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        video = iframeDoc.querySelector("video");
        if (video?.textTracks?.length > 0) {
          status.allTracks = Array.from(video.textTracks)
            .map((t, i) => ({ id: i, label: t.label || `Track ${i+1}`, language: t.language || "unknown" }))
            .filter(t => t.mode !== 'disabled');
          status.videoSource = "iframe-direct";
          updateIndicator(indicator);
          return true;
        }
      }
    } catch (e) {}
  }
  updateIndicator(indicator, false);
  return status.allTracks.length > 0;
}

function updateIndicator(indicator, hasTracks = true) {
  if (hasTracks && status.allTracks.length) {
    indicator.style.background = status.active ? "rgba(40, 167, 69, 0.95)" : "rgba(0, 123, 255, 0.95)";
    indicator.textContent = `${status.allTracks.length} tracks | ${status.active ? 'ON' : 'OFF'}`;
  } else {
    indicator.style.background = "rgba(255, 193, 7, 0.95)";
    indicator.textContent = `🔍 ${status.domInfo.iframes} iframes, ${status.domInfo.videos} videos`;
  }
}

function toggleDualSubs() {
  isEnabled = !isEnabled;
  status.active = isEnabled;
  if (isEnabled) {
    startDualSubs();
  } else {
    stopDualSubs();
  }
}

function startDualSubs() {
  if (status.allTracks.length < 2) return;
  const overlay = createDualSubOverlay();
  overlay.innerHTML = '';
  
  // Listen for track changes
  window.addEventListener('message', handleTrackUpdate);
  const video = document.querySelector('video') || getIframeVideo();
  if (video) {
    video.addEventListener('timeupdate', updateDualDisplay);
    status.videoInfo.currentVideo = video;
  }
}

function stopDualSubs() {
  if (status.dualSubOverlay) {
    status.dualSubOverlay.innerHTML = '';
  }
  window.removeEventListener('message', handleTrackUpdate);
  if (status.videoInfo.currentVideo) {
    status.videoInfo.currentVideo.removeEventListener('timeupdate', updateDualDisplay);
  }
}

function updateDualDisplay() {
  if (!isEnabled || !status.dualSubOverlay) return;
  
  const primaryTrack = status.selectedTracks.primary !== null ? 
    status.allTracks[status.selectedTracks.primary] : status.allTracks[0];
  const secondaryTrack = status.selectedTracks.secondary !== null ? 
    status.allTracks[status.selectedTracks.secondary] : status.allTracks[1];
  
  if (!primaryTrack || !secondaryTrack) return;
  
  const video = status.videoInfo.currentVideo || document.querySelector('video');
  if (!video || !video.textTracks) return;
  
  const primaryCue = getActiveCue(video.textTracks[primaryTrack.id]);
  const secondaryCue = getActiveCue(video.textTracks[secondaryTrack.id]);
  
  status.dualSubOverlay.innerHTML = `
    <div style="color: white; font-size: 24px; padding: 8px 12px; background: rgba(0,0,0,0.7); margin-bottom: 4px; border-radius: 4px;">
      ${secondaryCue || ''}
    </div>
    <div style="color: yellow; font-size: 28px; font-weight: bold; padding: 12px 16px; background: rgba(0,0,0,0.8); border-radius: 6px;">
      ${primaryCue || ''}
    </div>
  `;
}

function getActiveCue(track) {
  if (!track || track.mode !== 'showing') return '';
  const activeCues = track.activeCues;
  return activeCues && activeCues.length > 0 ? activeCues[0].text : '';
}

function getIframeVideo() {
  const iframe = document.querySelector('iframe');
  if (iframe && iframe.contentDocument) {
    return iframe.contentDocument.querySelector('video');
  }
  return null;
}

function updateDualSubs() {
  if (isEnabled) {
    stopDualSubs();
    startDualSubs();
  }
}

// Initialize
setTimeout(() => {
  chrome.storage.sync.get("dualSubsEnabled").then((result) => {
    isEnabled = result.dualSubsEnabled || false;
    status.active = isEnabled;
  });
  
  checkInterval = setInterval(initDualSubs, 1000);
  document.addEventListener("fullscreenchange", initDualSubs);
  
  const observer = new MutationObserver(initDualSubs);
  observer.observe(document.body, { childList: true, subtree: false });
  
  setInterval(() => {
    if (!status.allTracks.length) status.iframeMessageSent = false;
  }, 5000);
}, 300);

Object.defineProperty(window, "devtools", { value: false, writable: false });

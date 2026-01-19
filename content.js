let status = {
  active: false,
  allTracks: [],
  selectedTracks: { primary: null, secondary: null },
  domInfo: { iframes: 0, videos: 0 },
  logs: [],
  video: null,
  overlay: null,
};
let isEnabled = false;

// FIXED chrome.runtime.onMessage
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getStatus") {
    sendResponse(status);
    return true;
  }
  if (request.action === "deepScan") {
    deepScan();
    sendResponse({ success: true });
    return true;
  }
  if (request.action === "exportDebugJson") {
    downloadFile("debug.json", JSON.stringify(status, null, 2));
    sendResponse({ success: true });
    return true;
  }
  if (request.action === "dumpHtml") {
    const html = document.documentElement.outerHTML;
    downloadFile("page.html", html);
    sendResponse({ html });
    return true;
  }
  if (request.action === "forceInject") {
    chrome.runtime.sendMessage({ action: "forceInject" });
    sendResponse({ success: true });
  }
});

// LISTEN FOR VIDEO REPORTS FROM OTHER FRAMES
window.addEventListener("message", (e) => {
  if (e.data.action === "VIDEO_REPORT" && e.data.tracks?.length > 0) {
    status.allTracks = e.data.tracks;
    status.video = { remote: true, id: e.data.videoId };
    status.logs.push(`📡 Got ${e.data.tracks.length} tracks from iframe!`);
    status.domInfo.videos = 1;
    updateIndicator();
  }
});

function downloadFile(filename, content) {
  chrome.runtime.sendMessage({ action: "downloadFile", filename, url: URL.createObjectURL(new Blob([content], { type: "text/plain" })) });
}

// NUCLEAR VIDEO FINDER - Works in ANY frame
// function findVideoNucular(doc = document, path = '') {
//   console.log(`🔍 Scanning ${path}`);

//   // Direct video
//   let video = doc.querySelector('video');
//   if (video) {
//     status.logs.push(`🎥 VIDEO FOUND: ${path}`);
//     forceEnableTracks(video);
//     status.video = video;
//     extractTracks(video);
//     createOverlayInContext(doc);
//     return video;
//   }

//   // All iframes
//   const iframes = doc.querySelectorAll('iframe');
//   status.domInfo.iframes += iframes.length;

//   for(let i = 0; i < iframes.length; i++) {
//     try {
//       const iframeDoc = iframes[i].contentDocument || iframes[i].contentWindow?.document;
//       if (iframeDoc) {
//         const foundVideo = findVideoNucular(iframeDoc, `${path}iframe-${i}/`);
//         if (foundVideo) return foundVideo;
//       }
//     } catch(e) {
//       status.logs.push(`iframe-${i}: CORS BLOCKED (expected)`);
//     }
//   }
//   return null;
// }

// function forceEnableTracks(video) {
//   if (!video.textTracks) return;
//   for(let i = 0; i < video.textTracks.length; i++) {
//     video.textTracks[i].mode = 'showing';
//   }
//   status.logs.push(`✅ Forced ${video.textTracks.length} tracks to SHOWING`);
// }

function extractTracks(video) {
  if (!video.textTracks?.length) return;
  status.allTracks = Array.from(video.textTracks).map((track, i) => ({
    id: i,
    label: track.label || `Track ${i + 1}`,
    language: track.language || "unknown",
    mode: track.mode,
  }));
  status.domInfo.videos = 1;
  status.logs.push(`🎉 Extracted ${status.allTracks.length} tracks`);
}

function createOverlayInContext(doc) {
  if (status.overlay) return;
  status.overlay = doc.createElement("div");
  status.overlay.id = "dual-subs-overlay";
  Object.assign(status.overlay.style, {
    position: "absolute",
    bottom: "25%",
    left: "50%",
    transform: "translateX(-50%)",
    maxWidth: "95%",
    zIndex: "2147483647",
    pointerEvents: "none",
    background: "rgba(0,0,0,0.9)",
    color: "#ffff00",
    padding: "20px 25px",
    borderRadius: "15px",
    fontSize: "32px",
    fontWeight: "bold",
    textShadow: "2px 2px 4px black",
    textAlign: "center",
    minHeight: "70px",
  });
  (doc.querySelector("video")?.parentElement || doc.body).appendChild(status.overlay);
}

function createIndicator() {
  if (document.getElementById("dual-subs-indicator")) return;
  const indicator = document.createElement("div");
  indicator.id = "dual-subs-indicator";
  Object.assign(indicator.style, {
    position: "fixed",
    top: "10px",
    right: "10px",
    width: "260px",
    height: "45px",
    background: "rgba(0,123,255,0.95)",
    color: "white",
    borderRadius: "12px",
    fontSize: "13px",
    zIndex: "2147483647",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "600",
    boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
  });
  document.body.appendChild(indicator);
}

function updateIndicator() {
  const indicator = document.getElementById("dual-subs-indicator");
  if (!indicator) return;

  if (status.allTracks.length > 0) {
    indicator.style.background = isEnabled ? "rgba(40,167,69,0.95)" : "rgba(0,123,255,0.95)";
    indicator.textContent = `${status.allTracks.length} tracks | ${isEnabled ? "ON" : "OFF"}`;
  } else {
    indicator.style.background = "rgba(255,193,7,0.95)";
    indicator.textContent = `🔍 ${status.domInfo.iframes} iframes, ${status.domInfo.videos} videos`;
  }
}

// FIX iframe counting - reset before each scan

function deepScan() {
  status.logs = ["=== DEEP SCAN ==="];
  status.domInfo = { iframes: document.querySelectorAll("iframe").length, videos: 0 };

  // Try postMessage to ALL iframes
  document.querySelectorAll("iframe").forEach((iframe, i) => {
    try {
      iframe.contentWindow.postMessage(
        {
          action: "DUAL_SUBS_FIND_VIDEO",
          from: "dual-subs",
        },
        "*",
      );
      status.logs.push(`📤 postMessage to iframe ${i}`);
    } catch (e) {
      status.logs.push(`iframe ${i}: message sent`);
    }
  });

  // Check local video
  const video = document.querySelector("video");
  if (video) {
    status.logs.push("🎥 LOCAL VIDEO FOUND");
    status.domInfo.videos = 1;
  }

  updateIndicator();
}

// FIXED recursive video finder - proper counting
function findVideoNucular(doc = document, path = "", depth = 0) {
  status.domInfo.nestedDepth = Math.max(status.domInfo.nestedDepth, depth);

  // Count THIS frame's iframes
  const iframes = Array.from(doc.querySelectorAll("iframe"));
  status.domInfo.iframes += iframes.length;

  // Look for video in THIS frame
  const video = doc.querySelector("video");
  if (video) {
    status.domInfo.videos++;
    status.domInfo.iframesWithVideo++;
    status.logs.push(`🎥 VIDEO FOUND: ${path} (${video.videoWidth}x${video.videoHeight})`);

    forceEnableTracks(video);
    status.video = video;
    extractTracks(video);
    createOverlayInContext(doc);
    return true;
  }

  // Recursively check child iframes (NO CORS TRY-CATCH needed here)
  for (let iframe of iframes) {
    status.logs.push(`📦 Checking ${path}iframe-${iframes.indexOf(iframe)}`);
    // postMessage to blocked iframes instead of trying CORS access
    try {
      iframe.contentWindow.postMessage(
        {
          action: "DUAL_SUBS_FIND_VIDEO",
          from: "content-script",
        },
        "*",
      );
    } catch (e) {
      status.logs.push(`🔒 iframe-${iframes.indexOf(iframe)}: postMessage sent`);
    }
  }

  return false;
}

function toggleDualSubs() {
  isEnabled = !isEnabled;
  status.active = isEnabled;
  if (isEnabled && status.video && status.allTracks.length >= 2) {
    startDualSubs();
  } else {
    stopDualSubs();
  }
  updateIndicator();
}

let rafId;
function startDualSubs() {
  function updateDisplay() {
    if (!status.video || !status.overlay || status.allTracks.length < 2) return;

    const primaryId = status.selectedTracks.primary ?? 0;
    const secondaryId = status.selectedTracks.secondary ?? 1;

    const primaryCue = status.video.textTracks[primaryId]?.activeCues?.[0]?.text || "";
    const secondaryCue = status.video.textTracks[secondaryId]?.activeCues?.[0]?.text || "";

    status.overlay.innerHTML = `
      <div style="font-size:24px;color:#ccc;margin-bottom:10px;opacity:${secondaryCue ? 0.9 : 0};font-weight:normal;">
        ${secondaryCue}
      </div>
      <div style="font-size:36px;color:#ffff00;opacity:${primaryCue ? 1 : 0};">
        ${primaryCue}
      </div>
    `;
    rafId = requestAnimationFrame(updateDisplay);
  }
  rafId = requestAnimationFrame(updateDisplay);
}

function stopDualSubs() {
  if (rafId) cancelAnimationFrame(rafId);
  if (status.overlay) status.overlay.innerHTML = "";
}

// INIT - Run every 2 seconds
setTimeout(() => {
  deepScan(); // Initial scan
  setInterval(deepScan, 3000); // Every 3 seconds instead of 2
}, 1500);
setTimeout(() => {
  // Also run on DOM changes
  const observer = new MutationObserver(deepScan);
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
}, 1000);

let isEnabled = false;
let status = {
  active: false,
  tracks: {},
  videoInfo: {},
  allTracks: [],
  domInfo: { iframes: 0, videos: 0, iframesWithVideo: 0 },
  logs: [],
  htmlSnippet: "",
};
let checkInterval = null;

status.iframeMessageSent = false;
status.videoSource = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getStatus") {
    sendResponse(status);
  } else if (request.action === "deepScan") {
    deepScan();
    sendResponse({ success: true });
  }
  //   else if (request.action === "exportHtml") {
  //     status.htmlSnippet = document.body.innerHTML.substring(0, 5000) + '...';
  //     sendResponse(status);
  //   }}
  else if (request.action === "exportFullHtml") {
    const fullHtml = document.documentElement.outerHTML;
    status.htmlSnippet =
      fullHtml.substring(0, 10000) +
      `\n\n[... ${fullHtml.length - 10000} chars truncated]`;
    sendResponse(status);
  } else if (request.action === "exportIframeHtml") {
    const iframes = document.querySelectorAll("iframe");
    let iframeInfo = "";
    iframes.forEach((iframe, i) => {
      iframeInfo += `IFRAME ${i}:\n`;
      iframeInfo += `  src: ${iframe.src}\n`;
      iframeInfo += `  width: ${iframe.offsetWidth}px\n`;
      iframeInfo += `  height: ${iframe.offsetHeight}px\n`;
      try {
        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          iframeInfo += `  HTML: ${iframeDoc.body.innerHTML.substring(0, 500)}...\n`;
        } else {
          iframeInfo += `  HTML: CORS BLOCKED\n`;
        }
      } catch (e) {
        iframeInfo += `  HTML: ${e.message}\n`;
      }
      iframeInfo += "\n";
    });
    status.iframeHtml = iframeInfo;
    sendResponse(status);
  }
});

function createIndicator() {
  if (document.querySelector("#dual-subs-indicator")) return;

  const indicator = document.createElement("div");
  indicator.id = "dual-subs-indicator";
  Object.assign(indicator.style, {
    position: "fixed",
    top: "10px",
    right: "10px",
    minWidth: "200px",
    minHeight: "24px",
    background: "rgba(0, 123, 255, 0.95)",
    color: "white",
    padding: "6px 10px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "600",
    zIndex: "1000000",
    fontFamily: "-apple-system, system-ui, sans-serif",
    boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
    pointerEvents: "none",
    lineHeight: "1.2",
    textAlign: "center",
  });
  document.body.appendChild(indicator);
  return indicator;
}

function deepScan() {
  // Count everything
  status.domInfo = {
    iframes: document.querySelectorAll("iframe").length,
    videos: document.querySelectorAll("video").length,
    iframesWithVideo: 0,
    elementsWithTracks: 0,
  };

  // Check ALL iframes for video
  const iframes = document.querySelectorAll("iframe");
  iframes.forEach((iframe, i) => {
    try {
      const iframeDoc =
        iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        const iframeVideos = iframeDoc.querySelectorAll("video");
        status.domInfo.iframesWithVideo += iframeVideos.length;
        if (iframeVideos.length > 0) {
          status.logs.push(`iframe-${i}: ${iframeVideos.length} videos`);
        }
      }
    } catch (e) {
      status.logs.push(`iframe-${i}: CORS blocked`);
    }
  });

  // Find ANY element with textTracks
  const allVideos = document.querySelectorAll("video");
  allVideos.forEach((video) => {
    if (video.textTracks?.length > 0) {
      status.domInfo.elementsWithTracks++;
      status.logs.push(
        `video found: ${video.videoWidth}x${video.videoHeight}, ${video.textTracks.length} tracks`,
      );
    }
  });
}

function initDualSubs() {
  const indicator = document.getElementById("dual-subs-indicator");
  if (!indicator) return false;

  deepScan(); // Always update DOM info

  // 🔥 NEW: Try postMessage to iframe FIRST
  const iframe = document.querySelector("iframe");
  if (iframe && !status.iframeMessageSent) {
    try {
      // Send message TO iframe asking for tracks
      iframe.contentWindow.postMessage(
        {
          action: "getTracks",
          from: "dual-subs-extension",
        },
        "*",
      );

      status.iframeMessageSent = true;
      status.logs.push("📤 Sent postMessage to iframe - waiting for tracks...");

      // Listen FOR iframe response (one-time listener)
      const messageHandler = (e) => {
        if (e.data.action === "tracksFound" && e.data.tracks) {
          status.allTracks = e.data.tracks;
          status.videoSource = "iframe-postmessage";
          indicator.style.background = "rgba(40, 167, 69, 0.95)";
          indicator.textContent = `${e.data.tracks.length} tracks from iframe! 🎉`;
          status.logs.push(
            `✅ Got ${e.data.tracks.length} tracks from iframe!`,
          );

          // Enable dual subs toggle
          status.active = isEnabled;

          // Remove listener after success
          window.removeEventListener("message", messageHandler);
        }
      };
      window.addEventListener("message", messageHandler);
    } catch (e) {
      status.logs.push("❌ postMessage error: " + e.message);
    }
  }

  // Original fallback logic (main document video)
  if (status.domInfo.videos === 0 && status.domInfo.iframesWithVideo === 0) {
    indicator.style.background = "rgba(255, 193, 7, 0.95)";
    indicator.textContent = `🔍 ${status.domInfo.iframes} iframes, 0 videos`;
    return false;
  }

  // Try main document video first
  let video = document.querySelector("video");
  if (video?.textTracks?.length > 0) {
    status.allTracks = Array.from(video.textTracks)
      .map((t, i) => ({
        id: i,
        label: t.label || `Track ${i + 1}`,
        language: t.language || "unknown",
      }))
      .filter((t) => t.mode !== "disabled");

    indicator.style.background = status.allTracks.length
      ? "rgba(0, 123, 255, 0.95)"
      : "rgba(255, 193, 7, 0.95)";
    indicator.textContent = `${status.allTracks.length || 0} tracks | ${status.domInfo.videos} videos`;
    status.videoSource = "main-video";
    return true;
  }

  // Original iframe check (direct access)
  const iframes = document.querySelectorAll("iframe");
  for (let iframe of iframes) {
    try {
      const iframeDoc =
        iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        video = iframeDoc.querySelector("video");
        if (video?.textTracks?.length > 0) {
          status.logs.push("✅ Video found in iframe (direct access)!");
          status.allTracks = Array.from(video.textTracks)
            .map((t, i) => ({
              id: i,
              label: t.label || `Track ${i + 1}`,
              language: t.language || "unknown",
            }))
            .filter((t) => t.mode !== "disabled");
          indicator.style.background = "rgba(40, 167, 69, 0.95)";
          indicator.textContent = `${status.allTracks.length} iframe tracks (direct)`;
          status.videoSource = "iframe-direct";
          return true;
        }
      }
    } catch (e) {
      // CORS expected here - postMessage handles it
    }
  }

  return status.allTracks.length > 0; // Return true if postMessage got tracks
}

// function initDualSubs() {
//   const indicator = document.getElementById("dual-subs-indicator");
//   if (!indicator) return false;

//   deepScan(); // Always update DOM info

//   if (status.domInfo.videos === 0 && status.domInfo.iframesWithVideo === 0) {
//     indicator.style.background = "rgba(255, 193, 7, 0.95)";
//     indicator.textContent = `🔍 ${status.domInfo.iframes} iframes, 0 videos`;
//     return false;
//   }

//   // Try main document video first
//   let video = document.querySelector("video");
//   if (video?.textTracks?.length > 0) {
//     status.allTracks = Array.from(video.textTracks)
//       .map((t, i) => ({
//         id: i,
//         label: t.label || `Track ${i + 1}`,
//         language: t.language || "unknown",
//       }))
//       .filter((t) => t.mode !== "disabled");

//     indicator.style.background = status.allTracks.length
//       ? "rgba(0, 123, 255, 0.95)"
//       : "rgba(255, 193, 7, 0.95)";
//     indicator.textContent = `${status.allTracks.length || 0} tracks | ${status.domInfo.videos} videos`;
//     return true;
//   }

//   // Check iframes
//   const iframes = document.querySelectorAll("iframe");
//   for (let iframe of iframes) {
//     try {
//       const iframeDoc =
//         iframe.contentDocument || iframe.contentWindow?.document;
//       if (iframeDoc) {
//         video = iframeDoc.querySelector("video");
//         if (video?.textTracks?.length > 0) {
//           status.logs.push("✅ Video found in iframe!");
//           indicator.style.background = "rgba(40, 167, 69, 0.95)";
//           indicator.textContent = "🎥 Iframe video ready";
//           return true;
//         }
//       }
//     } catch (e) {}
//   }

//   return false;
// }

setTimeout(() => {
  createIndicator();
  chrome.storage.sync.get("dualSubsEnabled").then((result) => {
    isEnabled = result.dualSubsEnabled || false;
  });

  checkInterval = setInterval(initDualSubs, 1000);
  document.addEventListener("fullscreenchange", initDualSubs);

  const observer = new MutationObserver(initDualSubs);
  observer.observe(document.body, { childList: true, subtree: false });

  // Reset postMessage flag periodically for retries
  setInterval(() => {
    if (!status.allTracks.length) {
      status.iframeMessageSent = false;
    }
  }, 5000);
}, 300);

Object.defineProperty(window, "devtools", { value: false, writable: false });

///////////////////////////
// let isEnabled = false;
// let status = {
//   active: false,
//   tracks: {},
//   videoInfo: {},
//   allTracks: [],
//   logs: []
// };
// let checkInterval = null;
// let currentVideo = null;

// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === "getStatus") {
//     sendResponse(status);
//   } else if (request.action === "toggleSubs") {
//     isEnabled = request.enabled;
//     chrome.storage.sync.set({ dualSubsEnabled: isEnabled });
//     initDualSubs();
//   }
// });

// function createIndicator() {
//   if (document.querySelector("#dual-subs-indicator")) return;

//   const indicator = document.createElement("div");
//   indicator.id = "dual-subs-indicator";
//   Object.assign(indicator.style, {
//     position: "fixed",
//     top: "10px",
//     right: "10px",
//     minWidth: "180px",
//     minHeight: "24px",
//     background: "rgba(0, 123, 255, 0.95)",
//     color: "white",
//     padding: "6px 10px",
//     borderRadius: "12px",
//     fontSize: "11px",
//     fontWeight: "600",
//     zIndex: "1000000",
//     fontFamily: "-apple-system, system-ui, sans-serif",
//     boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
//     pointerEvents: "none",
//     userSelect: "none",
//     lineHeight: "1.2",
//     textAlign: "center",
//     border: "1px solid rgba(255,255,255,0.2)"
//   });
//   document.body.appendChild(indicator);
//   return indicator;
// }

// function initDualSubs() {
//   const video = document.querySelector("video");
//   if (!video) {
//     document.getElementById("dual-subs-indicator")?.style.setProperty("background", "rgba(255, 193, 7, 0.95)");
//     document.getElementById("dual-subs-indicator") && (document.getElementById("dual-subs-indicator").textContent = "🔍 Scanning...");
//     return false;
//   }

//   currentVideo = video;
//   status.videoInfo = {
//     duration: video.duration ? `${Math.floor(video.duration/60)}:${(video.duration%60).toString().padStart(2,'0')}m` : "Live",
//     width: video.videoWidth,
//     height: video.videoHeight,
//     fullscreen: document.fullscreenElement !== null
//   };

//   if (!video.textTracks || video.textTracks.length === 0) {
//     document.getElementById("dual-subs-indicator")?.style.setProperty("background", "rgba(255, 193, 7, 0.95)");
//     document.getElementById("dual-subs-indicator") && (document.getElementById("dual-subs-indicator").textContent = "⏳ Loading tracks...");
//     return false;
//   }

//   // Collect ALL subtitle tracks
//   status.allTracks = Array.from(video.textTracks)
//     .map((track, i) => ({
//       id: i,
//       label: track.label || `Track ${i+1}`,
//       language: track.language || 'unknown',
//       mode: track.mode
//     }))
//     .filter(track => track.mode !== 'disabled');

//   const germanTrack = status.allTracks.find(t =>
//     t.label.toLowerCase().includes("german") || t.language === "de"
//   );
//   const englishTrack = status.allTracks.find(t =>
//     t.label.toLowerCase().includes("english") || t.language === "en"
//   );

//   status.tracks = { german: !!germanTrack, english: !!englishTrack };

//   const indicator = document.getElementById("dual-subs-indicator");
//   if (!germanTrack || !englishTrack) {
//     indicator.style.background = "rgba(255, 152, 0, 0.95)";
//     indicator.textContent = `📺 ${status.videoInfo.duration || '?'} | ${status.allTracks.length} tracks`;
//   } else {
//     indicator.style.background = isEnabled ? "rgba(40, 167, 69, 0.95)" : "rgba(0, 123, 255, 0.95)";
//     indicator.textContent = isEnabled
//       ? `✅ Dual subs ON | ${status.videoInfo.duration}`
//       : `➕ ${status.allTracks.length} tracks ready`;
//   }

//   if (!isEnabled || !germanTrack || !englishTrack) return true;

//   // Show subtitles
//   let overlay = document.querySelector(".dual-subs-overlay");
//   if (!overlay) {
//     overlay = document.createElement("div");
//     overlay.className = "dual-subs-overlay";
//     Object.assign(overlay.style, {
//       position: "absolute",
//       bottom: "20%",
//       left: "50%",
//       transform: "translateX(-50%)",
//       pointerEvents: "none",
//       zIndex: "999999",
//       fontSize: "20px",
//       lineHeight: "1.3",
//       maxWidth: "90%",
//       textAlign: "center",
//       background: "rgba(0,0,0,0.85)",
//       padding: "12px 16px",
//       borderRadius: "12px",
//       backdropFilter: "blur(8px)",
//       boxShadow: "0 4px 20px rgba(0,0,0,0.5)"
//     });
//     video.parentElement.style.position = "relative";
//     video.parentElement.appendChild(overlay);
//   }

//   overlay.style.display = "block";

//   const germanVtt = video.textTracks[germanTrack.id];
//   const englishVtt = video.textTracks[englishTrack.id];

//   if (!overlay.dataset.listenersAttached) {
//     function updateSubs() {
//       const cue1 = germanVtt.activeCues?.[0]?.text || "";
//       const cue2 = englishVtt.activeCues?.[0]?.text || "";
//       overlay.innerHTML = cue1 || cue2 ? `
//         <div style="color: #fff; text-shadow: 2px 2px 4px #000; margin-bottom: 6px; font-weight: 500;">🇩🇪 ${cue1}</div>
//         <div style="color: #ffd700; text-shadow: 2px 2px 4px #000; font-weight: 500;">🇺🇸 ${cue2}</div>
//       ` : '';
//     }
//     germanVtt.oncuechange = englishVtt.oncuechange = updateSubs;
//     overlay.dataset.listenersAttached = "true";
//   }

//   return true;
// }

// setTimeout(() => {
//   createIndicator();
//   chrome.storage.sync.get("dualSubsEnabled").then((result) => {
//     isEnabled = result.dualSubsEnabled || false;
//   });

//   // Continuous scan + fullscreen
//   checkInterval = setInterval(initDualSubs, 800);
//   document.addEventListener('fullscreenchange', initDualSubs);
//   document.addEventListener('webkitfullscreenchange', initDualSubs);

//   const observer = new MutationObserver(initDualSubs);
//   observer.observe(document.body, { childList: true, subtree: false });

// }, 300);

// // Anti-devtools
// Object.defineProperty(window, "devtools", { value: false, writable: false });

///////////////////
// let isEnabled = false;
// let status = { active: false, tracks: {}, logs: [] };
// let checkInterval = null;

// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === "getStatus") {
//     sendResponse(status);
//   }
// });

// function createIndicator() {
//   if (document.querySelector("#dual-subs-indicator")) return;

//   const indicator = document.createElement("div");
//   indicator.id = "dual-subs-indicator";
//   Object.assign(indicator.style, {
//     position: "fixed",
//     top: "10px",
//     right: "10px",
//     width: "160px",
//     height: "30px",
//     background: "#ff4444",
//     color: "white",
//     padding: "6px 10px",
//     borderRadius: "15px",
//     fontSize: "11px",
//     fontWeight: "bold",
//     zIndex: "1000000",
//     fontFamily: "system-ui",
//     boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
//     pointerEvents: "none",
//     userSelect: "none",
//     lineHeight: "1.2",
//     textAlign: "center"
//   });
//   document.body.appendChild(indicator);
//   return indicator;
// }

// function initDualSubs() {
//   const video = document.querySelector("video");
//   if (!video) {
//     indicator.textContent = "SCANNING...";
//     return false;
//   }

//   // Wait for textTracks to load (async)
//   if (!video.textTracks || video.textTracks.length === 0) {
//     indicator.textContent = "LOADING TRACKS...";
//     return false;
//   }

//   const tracks = Array.from(video.textTracks);
//   const germanTrack = tracks.find(t => t.label?.toLowerCase().includes("german") || t.language === "de");
//   const englishTrack = tracks.find(t => t.label?.toLowerCase().includes("english") || t.language === "en");

//   status.tracks = { german: !!germanTrack, english: !!englishTrack };

//   if (!germanTrack || !englishTrack) {
//     indicator.textContent = `DE:${germanTrack?'✓':'✗'} EN:${englishTrack?'✓':'✗'}`;
//     indicator.style.background = "#ffaa00";
//     return false;
//   }

//   // SUCCESS! Tracks found
//   status.active = isEnabled;
//   indicator.textContent = isEnabled ? "SUBS ON ✅" : "READY";
//   indicator.style.background = isEnabled ? "#00aa00" : "#0099ff";

//   if (!isEnabled) return true;

//   // Create/show overlay
//   let overlay = document.querySelector(".dual-subs-overlay");
//   if (!overlay) {
//     overlay = document.createElement("div");
//     overlay.className = "dual-subs-overlay";
//     Object.assign(overlay.style, {
//       position: "absolute",
//       bottom: "20%",
//       left: "50%",
//       transform: "translateX(-50%)",
//       pointerEvents: "none",
//       zIndex: "999999",
//       fontSize: "20px",
//       lineHeight: "1.3",
//       maxWidth: "90%",
//       textAlign: "center",
//       background: "rgba(0,0,0,0.8)",
//       padding: "12px",
//       borderRadius: "8px",
//       display: "block"
//     });
//     video.parentElement.style.position = "relative";
//     video.parentElement.appendChild(overlay);
//   }

//   overlay.style.display = "block";

//   // Update subtitles
//   function updateSubs() {
//     const cue1 = germanTrack.activeCues?.[0]?.text || "";
//     const cue2 = englishTrack.activeCues?.[0]?.text || "";
//     overlay.innerHTML = `
//       <div style="color: white; text-shadow: 2px 2px 4px black; margin-bottom: 6px;">🇩🇪 ${cue1}</div>
//       <div style="color: yellow; text-shadow: 2px 2px 4px black;">🇺🇸 ${cue2}</div>
//     `;
//   }

//   // Attach listeners once
//   if (!overlay.dataset.listenersAttached) {
//     germanTrack.oncuechange = updateSubs;
//     englishTrack.oncuechange = updateSubs;
//     overlay.dataset.listenersAttached = "true";
//     status.logs.push("Dual subs active!");
//   }

//   updateSubs();
//   return true;
// }

// setTimeout(() => {
//   const indicator = createIndicator();

//   // Load enabled state
//   chrome.storage.sync.get("dualSubsEnabled").then((result) => {
//     isEnabled = result.dualSubsEnabled || false;
//   });

//   // 🔥 KEY FIX: Continuous scanning every 1s + fullscreen detection
//   checkInterval = setInterval(() => {
//     initDualSubs();
//   }, 1000);

//   // Also listen for fullscreen changes
//   document.addEventListener('fullscreenchange', initDualSubs);
//   document.addEventListener('webkitfullscreenchange', initDualSubs);

//   // Watch for video elements (gentle observer)
//   const videoObserver = new MutationObserver(() => {
//     initDualSubs();
//   });
//   videoObserver.observe(document.body, {
//     childList: true,
//     subtree: false
//   });

// }, 500);

// // Anti-devtools
// Object.defineProperty(window, "devtools", { value: false, writable: false });

/////////////////////////////
// let isEnabled = false;
// let status = { active: false, tracks: {}, logs: [] };

// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === "getStatus") {
//     sendResponse(status);
//   }
// });

// // FIXED: Safe indicator (smaller + correct CSS)
// function createIndicator() {
//   if (document.querySelector("#dual-subs-indicator")) return;

//   const indicator = document.createElement("div");
//   indicator.id = "dual-subs-indicator";
//   Object.assign(indicator.style, {
//     position: "fixed",
//     top: "10px",
//     right: "10px",
//     width: "160px",        // FIXED: no maxWidth/Height
//     height: "30px",
//     background: "#ff4444",
//     color: "white",
//     padding: "6px 10px",
//     borderRadius: "15px",
//     fontSize: "11px",
//     fontWeight: "bold",
//     zIndex: "1000000",
//     fontFamily: "system-ui",
//     boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
//     pointerEvents: "none",
//     userSelect: "none",
//     lineHeight: "1.2",
//     textAlign: "center"
//   });
//   document.body.appendChild(indicator);
//   return indicator;
// }

// setTimeout(() => {
//   const indicator = createIndicator();
//   indicator.textContent = "DUAL SUBS ✓";

//   let video = null;
//   let germanTrack = null;
//   let englishTrack = null;
//   let overlay = null;

//   function initDualSubs() {
//     // FIXED: Target ONLY video container area
//     video = document.querySelector("video");
//     if (!video?.textTracks?.length) {
//       indicator.textContent = "NO VIDEO";
//       indicator.style.background = "#ffaa00";
//       return;
//     }

//     const tracks = Array.from(video.textTracks);
//     germanTrack = tracks.find(t => t.label?.toLowerCase().includes("german") || t.language === "de");
//     englishTrack = tracks.find(t => t.label?.toLowerCase().includes("english") || t.language === "en");

//     status.tracks = { german: !!germanTrack, english: !!englishTrack };

//     if (!germanTrack || !englishTrack) {
//       indicator.textContent = `DE:${germanTrack?'✓':'✗'} EN:${englishTrack?'✓':'✗'}`;
//       indicator.style.background = "#ffaa00";
//       return;
//     }

//     status.active = isEnabled;
//     indicator.textContent = isEnabled ? "SUBS ON ✅" : "READY";
//     indicator.style.background = isEnabled ? "#00aa00" : "#0099ff";

//     if (!isEnabled) return;

//     // FIXED: Create overlay ONCE only
//     if (!overlay) {
//       overlay = document.createElement("div");
//       overlay.className = "dual-subs-overlay";
//       Object.assign(overlay.style, {
//         position: "absolute",
//         bottom: "20%",
//         left: "50%",
//         transform: "translateX(-50%)",
//         pointerEvents: "none",     // ← CRITICAL
//         zIndex: "999999",
//         fontSize: "20px",          // FIXED: no maxHeight
//         lineHeight: "1.3",
//         maxWidth: "90%",
//         textAlign: "center",
//         background: "rgba(0,0,0,0.8)",
//         padding: "12px",
//         borderRadius: "8px",
//         display: "block"
//       });
//       video.parentElement.style.position = "relative";
//       video.parentElement.appendChild(overlay);
//     }

//     // FIXED: Event listeners ONCE only
//     if (!overlay.dataset.listenersAttached) {
//       function updateSubs() {
//         const cue1 = germanTrack.activeCues?.[0]?.text || "";
//         const cue2 = englishTrack.activeCues?.[0]?.text || "";
//         overlay.innerHTML = `
//           <div style="color: white; text-shadow: 2px 2px 4px black; margin-bottom: 6px;">🇩🇪 ${cue1}</div>
//           <div style="color: yellow; text-shadow: 2px 2px 4px black;">🇺🇸 ${cue2}</div>
//         `;
//       }

//       germanTrack.oncuechange = updateSubs;
//       englishTrack.oncuechange = updateSubs;
//       overlay.dataset.listenersAttached = "true";
//       status.logs.push("Dual subs active!");
//     }
//   }

//   // Load enabled state FIRST
//   chrome.storage.sync.get("dualSubsEnabled").then((result) => {
//     isEnabled = result.dualSubsEnabled || false;
//     initDualSubs();
//   });

//   // FIXED: Observer ONLY on video area (not whole page)
//   initDualSubs();
//   const videoObserver = new MutationObserver((mutations) => {
//     let shouldReinit = false;
//     for (const mutation of mutations) {
//       if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
//         if (document.querySelector("video")) {
//           shouldReinit = true;
//           break;
//         }
//       }
//     }
//     if (shouldReinit) initDualSubs();
//   });

//   // Watch ONLY common video containers
//   videoObserver.observe(document.body, {
//     childList: true,
//     subtree: false  // ← FIXED: no subtree = FAST
//   });

// }, 1500);

// // Anti-devtools
// Object.defineProperty(window, "devtools", { value: false, writable: false });

/////////////////////////////////////
// let isEnabled = false;
// let status = { active: false, tracks: {}, logs: [] };

// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === "getStatus") {
//     sendResponse(status);
//   }
// });

// // Status indicator (top-right corner, always visible)
// function createIndicator() {
//   if (document.querySelector("#dual-subs-indicator")) return;

//   const indicator = document.createElement("div");
//   indicator.id = "dual-subs-indicator";
//   Object.assign(indicator.style, {
//     position: "fixed",
//     maxWidth: "300px",
//     maxHight: "100px",
//     top: "10px",
//     right: "10px",
//     background: "#ff4444",
//     color: "white",
//     padding: "8px 12px",
//     borderRadius: "20px",
//     fontSize: "12px",
//     fontWeight: "bold",
//     zIndex: "1000000",
//     fontFamily: "system-ui",
//     boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
//     pointerEvents: "none", // ← CRITICAL: allows clicks through
//     userSelect: "none", // ← prevents text selection
//     touchAction: "none", // ← mobile fix
//   });
//   document.body.appendChild(indicator);
//   return indicator;
// }

// setTimeout(() => {
//   const indicator = createIndicator();
//   indicator.textContent = "DUAL SUBS LOADED";

//   function initDualSubs() {
//     const video = document.querySelector("video");
//     if (!video?.textTracks?.length) {
//       status.logs.push("No video or tracks found");
//       indicator.textContent = "NO VIDEO";
//       indicator.style.background = "#ffaa00";
//       return;
//     }

//     const tracks = Array.from(video.textTracks);
//     const german = tracks.find(
//       (t) => t.label?.toLowerCase().includes("german") || t.language === "de",
//     );
//     const english = tracks.find(
//       (t) => t.label?.toLowerCase().includes("english") || t.language === "en",
//     );

//     status.tracks = { german: !!german, english: !!english };

//     if (!german || !english) {
//       status.logs.push(`Tracks found: DE=${!!german}, EN=${!!english}`);
//       indicator.textContent = `TRACKS: DE${german ? "✓" : "✗"} EN${english ? "✓" : "✗"}`;
//       indicator.style.background = "#ffaa00";
//       return;
//     }

//     status.active = isEnabled;
//     indicator.textContent = isEnabled ? "DUAL SUBS ON ✅" : "DUAL SUBS READY";
//     indicator.style.background = isEnabled ? "#00aa00" : "#0099ff";

//     if (!isEnabled) return;

//     // Create overlay (only if enabled)
//     let overlay = document.querySelector(".dual-subs-overlay");
//     if (!overlay) {
//       overlay = document.createElement("div");
//       overlay.className = "dual-subs-overlay";
//       Object.assign(overlay.style, {
//         display: "none",
//         position: "absolute",
//         bottom: "20%",
//         left: "50%",
//         transform: "translateX(-50%)",
//         pointerEvents: "none",
//         zIndex: "999999",
//         fontSize: "22px",
//         lineHeight: "1.3",
//         maxWidth: "90%",
//         maxHight: "300px",
//         textAlign: "center",
//         background: "rgba(0,0,0,0.7)",
//         padding: "10px",
//         borderRadius: "8px",
//       });
//       video.parentElement.style.position = "relative";
//       video.parentElement.appendChild(overlay);
//     }

//     function updateSubs() {
//       const cue1 = german.activeCues?.[0]?.text || "";
//       const cue2 = english.activeCues?.[0]?.text || "";
//       overlay.innerHTML = `
//         <div style="color: white; text-shadow: 2px 2px 4px black; margin-bottom: 8px; font-size: 20px;">🇩🇪 ${cue1}</div>
//         <div style="color: yellow; text-shadow: 2px 2px 4px black; font-size: 20px;">🇺🇸 ${cue2}</div>
//       `;
//     }

//     german.oncuechange = english.oncuechange = updateSubs;
//     updateSubs();
//     status.logs.push("Dual subs active!");
//   }

//   // Check chrome storage for enable/disable
//   chrome.storage.sync.get("dualSubsEnabled").then((result) => {
//     isEnabled = result.dualSubsEnabled || false;
//     initDualSubs();
//   });

//   initDualSubs();
//   const observer = new MutationObserver(initDualSubs);
//   observer.observe(document.body, { childList: true, subtree: true });
// }, 1000);
// function updateIndicator(text, color) {
//   const indicator = document.getElementById('dual-subs-indicator');
//   if (!indicator) return;

//   indicator.textContent = text;
//   indicator.style.background = color;
//   indicator.style.display = isEnabled ? 'none' : 'block';  // Hide when active
// }
// // Replace indicator.textContent = ... with:
// if (!isEnabled) updateIndicator('NO VIDEO', '#ffaa00');

// ///////////////////////////////////////////////////

// // Anti-devtools detection + safe delay
// Object.defineProperty(window, "devtools", { value: false, writable: false });

// setTimeout(() => {
//   function initDualSubs() {
//     const video = document.querySelector('video');
//     if (!video || !video.textTracks?.length) return;

//     const tracks = Array.from(video.textTracks);
//     const german = tracks.find(t => t.label?.toLowerCase().includes('german') || t.language === 'de');
//     const english = tracks.find(t => t.label?.toLowerCase().includes('english') || t.language === 'en');

//     if (!german || !english) {
//       console.log('Dualsub: German/English tracks not found');
//       return;
//     }

//     // Create overlay
//     let overlay = document.querySelector('.dual-subs-overlay');
//     if (!overlay) {
//       overlay = document.createElement('div');
//       overlay.className = 'dual-subs-overlay';
//       Object.assign(overlay.style, {
//         position: 'absolute',
//         bottom: '20%',
//         left: '50%',
//         transform: 'translateX(-50%)',
//         pointerEvents: 'none',
//         zIndex: '999999',
//         fontSize: '18px',
//         lineHeight: '1.4',
//         maxWidth: '90%',
//         textAlign: 'center'
//       });
//       video.parentElement.style.position = 'relative';
//       video.parentElement.appendChild(overlay);
//     }

//     // Update subtitles on cue change
//     function updateSubs() {
//       const cue1 = german.activeCues?.[0]?.text || '';
//       const cue2 = english.activeCues?.[0]?.text || '';

//       overlay.innerHTML = `
//         <div style="color: white; text-shadow: 2px 2px 4px black; margin-bottom: 4px;">${cue1}</div>
//         <div style="color: yellow; text-shadow: 2px 2px 4px black;">${cue2}</div>
//       `;
//     }

//     // Listen for subtitle changes
//     german.oncuechange = english.oncuechange = updateSubs;
//     video.textTracks.addEventListener('change', updateSubs);

//     console.log('Dualsub: German + English subtitles active');
//   }

//   initDualSubs();

//   // Watch for dynamic video players
//   const observer = new MutationObserver(initDualSubs);
//   observer.observe(document.body, { childList: true, subtree: true });

// }, 2000);

///////////////////////////////////////////////
// const video = document.querySelector("video");
// const tracks = Array.from(video.textTracks);
// const germanTrack = tracks.find((t) => t.label.includes("German"));
// const englishTrack = tracks.find((t) => t.label.includes("English"));

// // Clone and style second track as overlay
// const overlay = document.createElement("div");
// overlay.className = "dual-subs-overlay";
// document.body.appendChild(overlay);

// // Listen for cue changes and render both
// Wait longer and use passive observers

///////////////////////////////////////////
// setTimeout(() => {
//   const video = document.querySelector('video');
//   if (!video || video.textTracks.length === 0) return;

//   const tracks = Array.from(video.textTracks);
//   const german = tracks.find(t => t.label?.includes('German'));
//   const english = tracks.find(t => t.label?.includes('English'));

//   if (!german || !english) return;

//   // Passive MutationObserver only
//   const observer = new MutationObserver(() => {
//     renderDualSubs(german, english);
//   });
//   observer.observe(document.body, { childList: true, subtree: true });

// }, 3000); // 3s delay

// function renderDualSubs(track1, track2) {
//   // Minimal DOM injection - append to video parent only
//   let overlay = document.querySelector('.dual-subs-overlay');
//   if (!overlay) {
//     overlay = document.createElement('div');
//     overlay.className = 'dual-subs-overlay';
//     overlay.style.cssText = `
//       position: absolute; bottom: 20%; left: 50%; transform: translateX(-50%);
//       pointer-events: none; z-index: 9999; font-size: 18px;
//     `;
//     video.parentElement.style.position = 'relative';
//     video.parentElement.appendChild(overlay);
//   }

//   // Render active cues only
//   const cues1 = track1.activeCues;
//   const cues2 = track2.activeCues;
//   overlay.innerHTML = `
//     <div style="color: white; text-shadow: 2px 2px 4px black;">${cues1?.[0]?.text || ''}</div>
//     <div style="color: yellow; text-shadow: 2px 2px 4px black;">${cues2?.[0]?.text || ''}</div>
//   `;
// }

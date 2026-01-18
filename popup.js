let isEnabled = false;

document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const debugInfoEl = document.getElementById('debugInfo');
  const track1El = document.getElementById('track1');
  const track2El = document.getElementById('track2');
  const toggleBtn = document.getElementById('toggleSubs');
  const logsEl = document.getElementById('logs');
  const domScanEl = document.getElementById('domScan');
  const iframeCountEl = document.getElementById('iframeCount');
  const videoCountEl = document.getElementById('videoCount');
  const trackCountEl = document.getElementById('trackCount');
  const scanDeepBtn = document.getElementById('scanDeep');
  const exportFullBtn = document.getElementById('exportFull');
  const exportIframeBtn = document.getElementById('exportIframe');

  // Debug buttons
  scanDeepBtn.onclick = () => sendMessage('deepScan', 'Scanning iframes...');
  exportFullBtn.onclick = () => sendMessage('exportFullHtml', 'Exporting full HTML...');
  exportIframeBtn.onclick = () => sendMessage('exportIframeHtml', 'Exporting iframe HTML...');
  
  toggleBtn.onclick = () => {
    sendMessage('toggleSubs', 'Toggling subtitles...');
    isEnabled = !isEnabled;
    updateUI();
  };

  track1El.onclick = track2El.onclick = () => {
    logsEl.textContent = 'No tracks detected. Run Deep Scan first.';
  };

  // Auto-update every 2 seconds
  setInterval(() => sendMessage('getStatus'), 2000);

  function sendMessage(action, logMsg = '') {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab.url?.includes('net20.cc')) {
        if (logMsg) logsEl.textContent = logMsg;
        chrome.tabs.sendMessage(tab.id, { action }, updateFromResponse);
      } else {
        logsEl.textContent = 'Please navigate to net20.cc first';
      }
    });
  }

  function updateFromResponse(response) {
    if (chrome.runtime.lastError) {
      logsEl.textContent = 'Extension error - reload extension';
      return;
    }

    // Status
    const trackTotal = response.allTracks?.length || 0;
    statusEl.textContent = response.active ? 'Dual subtitles ACTIVE' : 
                          trackTotal ? `${trackTotal} subtitle tracks` : 
                          response.domInfo?.iframes ? `${response.domInfo.iframes} iframe(s) found` : 
                          'Scanning page...';
    
    statusEl.className = `status ${response.active ? 'active' : trackTotal ? 'ready' : 'ready'}`;

    // Debug info
    if (response.domInfo) {
      debugInfoEl.style.display = 'block';
      domScanEl.textContent = `${response.domInfo.iframes || 0} iframes, ${response.domInfo.videos || 0} videos`;
      iframeCountEl.textContent = response.domInfo.iframes || 0;
      videoCountEl.textContent = response.domInfo.videos || 0;
      trackCountEl.textContent = trackTotal;
    }

    // Update tracks
    track1El.textContent = `Track 1: ${response.selectedTracks?.primary || 'None'}`;
    track2El.textContent = `Track 2: ${response.selectedTracks?.secondary || 'None'}`;

    // Clean logs
    logsEl.textContent = (response.logs || []).slice(-5).join('\n') || 
                        response.domInfo?.iframes ? '1 iframe detected. CORS blocking access.' : 
                        'Ready';
  }

  function updateUI() {
    toggleBtn.textContent = isEnabled ? 'Disable Dual Subs' : 'Enable Dual Subs';
    toggleBtn.className = `toggle-${isEnabled ? 'on' : 'off'}`;
  }
});


// let isEnabled = false;

// document.addEventListener('DOMContentLoaded', async () => {
//   const statusEl = document.getElementById('status');
//   const debugInfoEl = document.getElementById('debugInfo');
//   const track1El = document.getElementById('track1');
//   const track2El = document.getElementById('track2');
//   const toggleBtn = document.getElementById('toggle');
//   const logsEl = document.getElementById('logs');
//   const domScanEl = document.getElementById('domScan');
//   const iframeCountEl = document.getElementById('iframeCount');
//   const videoCountEl = document.getElementById('videoCount');
//   const scanDeepBtn = document.getElementById('scanDeep');
//   const exportHtmlBtn = document.getElementById('exportHtml');

//   // Debug buttons
//   scanDeepBtn.onclick = async () => {
//     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
//     if (tab.url?.includes('net20.cc')) {
//       chrome.tabs.sendMessage(tab.id, { action: 'deepScan' }, updateFromResponse);
//       logsEl.textContent = 'Scanning iframes...';
//     }
//   };

//   exportHtmlBtn.onclick = async () => {
//     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
//     if (tab.url?.includes('net20.cc')) {
//       chrome.tabs.sendMessage(tab.id, { action: 'exportHtml' }, (response) => {
//         logsEl.textContent = response?.htmlSnippet?.substring(0, 200) + '...';
//       });
//     }
//   };

//   toggleBtn.onclick = async () => {
//     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
//     if (tab.url?.includes('net20.cc')) {
//       chrome.tabs.sendMessage(tab.id, { action: 'toggleSubs', enabled: !isEnabled });
//     }
//     isEnabled = !isEnabled;
//     updateUI();
//   };

//   track1El.onclick = track2El.onclick = () => {
//     logsEl.textContent = 'No tracks found yet. Run Deep Scan first.';
//   };

//   // Poll status
//   setInterval(async () => {
//     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
//     if (tab.url?.includes('net20.cc')) {
//       chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, updateFromResponse);
//     }
//   }, 1500);

//   function updateFromResponse(response) {
//     if (chrome.runtime.lastError) {
//       logsEl.textContent = 'Extension not loaded on this page';
//       return;
//     }

//     // Status
//     statusEl.textContent = response.active ? '✅ Dual subtitles active' : 
//                           response.allTracks?.length ? `${response.allTracks.length} tracks` : 
//                           response.domInfo?.videos || response.domInfo?.iframes ? '📺 Video structure found' : 
//                           '🔍 Scanning DOM...';
    
//     statusEl.className = `status ${response.active ? 'active' : response.allTracks?.length || response.domInfo?.videos ? 'ready' : 'ready'}`;
    
//     // Debug info
//     if (response.domInfo) {
//       debugInfoEl.style.display = 'block';
//       domScanEl.textContent = `${response.domInfo.iframes || 0} iframes, ${response.domInfo.videos || 0} videos`;
//       iframeCountEl.textContent = response.domInfo.iframes || 0;
//       videoCountEl.textContent = response.domInfo.videos || 0;
//     }
    
//     // Clean logs (no emoji spam)
//     logsEl.textContent = (response.logs || []).slice(-3).map(log => log.replace(/iframe-\d+:/, '')).join('\n') || 
//                         '1 iframe found! Click Deep Scan → CORS blocking access.';
//   }

//   function updateUI() {
//     toggleBtn.textContent = isEnabled ? '⏹️ Disable Dual Subs' : '▶️ Enable Dual Subs';
//     toggleBtn.className = `toggle-${isEnabled ? 'on' : 'off'}`;
//   }
// });


// let selectedTracks = { primary: null, secondary: null };
// let isEnabled = false;

// document.addEventListener('DOMContentLoaded', async () => {
//   const statusEl = document.getElementById('status');
//   const videoInfoEl = document.getElementById('videoInfo');
//   const track1El = document.getElementById('track1');
//   const track2El = document.getElementById('track2');
//   const tracksListEl = document.getElementById('tracksList');
//   const toggleBtn = document.getElementById('toggle');
//   const logsEl = document.getElementById('logs');
//   const domScanEl = document.getElementById('domScan');
//   const iframeCountEl = document.getElementById('iframeCount');
//   const videoCountEl = document.getElementById('videoCount');
//   const htmlPreviewEl = document.getElementById('htmlPreview');
//   const exportHtmlBtn = document.getElementById('exportHtml');
//   const scanDeepBtn = document.getElementById('scanDeep');

//   // Track selection
//   track1El.onclick = () => selectTrack(0, track1El);
//   track2El.onclick = () => selectTrack(1, track2El);

//   async function selectTrack(slot, element) {
//     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
//     if (!tab.url?.includes('net20.cc')) return;
    
//     chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (status) => {
//       if (status?.allTracks?.length) {
//         showTracksList(status.allTracks, slot);
//       } else if (status?.domInfo) {
//         logsEl.textContent = `Found ${status.domInfo.iframes} iframes, ${status.domInfo.videos} videos`;
//       }
//     });
//   }

//   function showTracksList(tracks, slot) {
//     tracksListEl.innerHTML = tracks.map(track => `
//       <div class="track-item ${selectedTracks[slot === 0 ? 'primary' : 'secondary'] === track.id ? 'active' : ''}" 
//            data-slot="${slot}" data-id="${track.id}" data-label="${track.label}" data-lang="${track.language}">
//         <span class="track-flag">${getFlag(track.language)}</span>
//         ${track.label || 'Unknown'} (${track.language})
//       </div>
//     `).join('');
//     tracksListEl.style.display = 'block';
    
//     // Add click handlers
//     tracksListEl.querySelectorAll('.track-item').forEach(item => {
//       item.onclick = () => {
//         const slotKey = item.dataset.slot == 0 ? 'primary' : 'secondary';
//         selectedTracks[slotKey] = parseInt(item.dataset.id);
//         document.querySelectorAll('.track-item').forEach(el => el.classList.remove('active'));
//         item.classList.add('active');
//         tracksListEl.style.display = 'none';
//         logsEl.textContent = `Selected ${item.dataset.label} for ${slotKey}`;
//       };
//     });
//   }

//   // Debug buttons
//   exportHtmlBtn.onclick = async () => {
//     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
//     chrome.tabs.sendMessage(tab.id, { action: 'exportHtml' }, (response) => {
//       htmlPreviewEl.textContent = response?.htmlSnippet || 'No HTML (CORS?)';
//       htmlPreviewEl.style.display = 'block';
//       htmlPreviewEl.scrollTop = 0;
//     });
//   };

//   scanDeepBtn.onclick = async () => {
//     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
//     chrome.tabs.sendMessage(tab.id, { action: 'deepScan' }, (response) => {
//       logsEl.textContent = 'Deep scan complete!';
//       updateStatus(chrome.runtime.lastError ? {} : response);
//     });
//   };

//   toggleBtn.onclick = async () => {
//     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
//     chrome.tabs.sendMessage(tab.id, { action: 'toggleSubs', enabled: !isEnabled });
//     isEnabled = !isEnabled;
//     updateUI();
//   };

//   // Tab switching
//   window.switchTab = (tabName) => {
//     document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
//     document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
//     document.getElementById(tabName + 'Tab').classList.add('active');
//     event.target.classList.add('active');
//   };

//   // Poll status every second
//   setInterval(async () => {
//     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
//     if (tab.url?.includes('net20.cc')) {
//       chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
//         if (response) {
//           updateStatus(response);
//         }
//       });
//     }
//   }, 1000);

//   function updateStatus(response) {
//     // Status tab
//     statusEl.textContent = response.active ? '✅ Dual subtitles active' : 
//                           response.allTracks?.length ? `${response.allTracks.length} tracks found` : 
//                           response.domInfo?.videos || response.domInfo?.iframes ? '📺 Video structure found' : 
//                           '🔍 Scanning DOM...';
    
//     statusEl.className = `status ${response.active ? 'active' : response.allTracks?.length || response.domInfo?.videos ? 'ready' : 'ready'}`;
    
//     // Debug tab
//     domScanEl.textContent = `${response.domInfo?.iframes || 0} iframes, ${response.domInfo?.videos || 0} videos`;
//     iframeCountEl.textContent = response.domInfo?.iframes || 0;
//     videoCountEl.textContent = response.domInfo?.videos || 0;
    
//     // Video info
//     if (response.videoInfo?.duration) {
//       videoInfoEl.style.display = 'block';
//       videoInfoEl.innerHTML = `
//         📹 ${response.videoInfo.duration} | 
//         ${response.videoInfo.width || '?' }x${response.videoInfo.height || '?'} | 
//         ${response.videoInfo.fullscreen ? '⛶ Fullscreen' : '🖥️ Windowed'}
//       `;
//     } else {
//       videoInfoEl.style.display = 'none';
//     }
    
//     // Logs
//     logsEl.textContent = (response.logs || []).slice(-4).join('\n') || 'Ready - click Deep Scan!';
//   }

//   function updateUI() {
//     toggleBtn.textContent = isEnabled ? '⏹️ Disable Dual Subs' : '▶️ Enable Dual Subs';
//     toggleBtn.className = `toggle-${isEnabled ? 'on' : 'off'}`;
//   }

//   function getFlag(lang) {
//     const flags = { de: '🇩🇪', en: '🇺🇸', es: '🇪🇸', fr: '🇫🇷', it: '🇮🇹', ru: '🇷🇺', pt: '🇵🇹' };
//     return flags[lang] || '🌐';
//   }

//   updateStatus({});
// });


// let selectedTracks = { primary: null, secondary: null };
// let isEnabled = false;

// document.addEventListener("DOMContentLoaded", async () => {
//   const statusEl = document.getElementById("status");
//   const videoInfoEl = document.getElementById("videoInfo");
//   const track1El = document.getElementById("track1");
//   const track2El = document.getElementById("track2");
//   const tracksListEl = document.getElementById("tracksList");
//   const toggleBtn = document.getElementById("toggle");
//   const logsEl = document.getElementById("logs");

//   // Track selection
//   track1El.onclick = () => selectTrack(0, track1El);
//   track2El.onclick = () => selectTrack(1, track2El);

//   async function selectTrack(slot, element) {
//     const [tab] = await chrome.tabs.query({
//       active: true,
//       currentWindow: true,
//     });
//     if (!tab.url?.includes("net20.cc")) return;

//     chrome.tabs.sendMessage(tab.id, { action: "getStatus" }, (status) => {
//       if (status?.allTracks?.length) {
//         showTracksList(status.allTracks, slot);
//       }
//     });
//   }

//   function showTracksList(tracks, slot) {
//     const tracksListEl = document.getElementById("tracksList");
//     tracksListEl.innerHTML = tracks
//       .map(
//         (track) => `
//       <div class="track-item ${selectedTracks[slot === 0 ? "primary" : "secondary"] === track.id ? "active" : ""}" 
//            onclick="selectTrackFinal(${slot}, ${track.id}, '${track.label}', '${track.language}')">
//         <span class="track-flag">${getFlag(track.language)}</span>
//         ${track.label} (${track.language})
//       </div>
//     `,
//       )
//       .join("");
//     tracksListEl.style.display = "block";
//   }

//   toggleBtn.onclick = async () => {
//     const [tab] = await chrome.tabs.query({
//       active: true,
//       currentWindow: true,
//     });
//     chrome.tabs.sendMessage(tab.id, {
//       action: "toggleSubs",
//       enabled: !isEnabled,
//     });
//     isEnabled = !isEnabled;
//     updateUI();
//   };

//   // Poll status
//   setInterval(async () => {
//     const [tab] = await chrome.tabs.query({
//       active: true,
//       currentWindow: true,
//     });
//     if (tab.url?.includes("net20.cc")) {
//       chrome.tabs.sendMessage(tab.id, { action: "getStatus" }, (response) => {
//         if (response) {
//           updateStatus(response);
//         }
//       });
//     }
//   }, 1000);

//   function updateStatus(response) {
//     // const statusEl = document.getElementById("status");
//     const domScanEl = document.getElementById("domScan");
//     const iframeCountEl = document.getElementById("iframeCount");
//     const videoCountEl = document.getElementById("videoCount");

//     statusEl.textContent = response.active
//       ? "✅ Dual subtitles active"
//       : response.allTracks.length
//         ? `${response.allTracks.length} tracks found`
//         : response.videoInfo.duration
//           ? "📺 Video ready"
//           : "Loading...";

//     statusEl.className = `status ${response.active ? "active" : response.allTracks.length ? "ready" : "ready"}`;

//     if (response.videoInfo.duration) {
//       videoInfoEl.style.display = "block";
//       videoInfoEl.innerHTML = `
//         📹 ${response.videoInfo.duration} | 
//         ${response.videoInfo.width}x${response.videoInfo.height} | 
//         ${response.videoInfo.fullscreen ? "⛶ Fullscreen" : "🖥️ Windowed"}
//       `;
//     }

//     // Debug tab
//     domScanEl.textContent = `${response.domInfo?.iframes || 0} iframes, ${response.domInfo?.videos || 0} videos`;
//     iframeCountEl.textContent = response.domInfo?.iframes || 0;
//     videoCountEl.textContent = response.domInfo?.videos || 0;  

//     logsEl.textContent = response.logs.slice(-3).join("\n") || "Ready";
//   }

//   document.getElementById("exportHtml").onclick = async () => {
//     const [tab] = await chrome.tabs.query({
//       active: true,
//       currentWindow: true,
//     });
//     chrome.tabs.sendMessage(tab.id, { action: "exportHtml" }, (response) => {
//       const preview = document.getElementById("htmlPreview");
//       preview.textContent = response?.htmlSnippet || "No HTML captured";
//       preview.style.display = "block";
//     });
//   };

//   document.getElementById("scanDeep").onclick = async () => {
//     const [tab] = await chrome.tabs.query({
//       active: true,
//       currentWindow: true,
//     });
//     chrome.tabs.sendMessage(tab.id, { action: "deepScan" }, (response) => {
//       updateStatus(chrome.runtime.lastError ? {} : response);
//     });
//   };

//   function updateUI() {
//     toggleBtn.textContent = isEnabled
//       ? "⏹️ Disable Dual Subs"
//       : "▶️ Enable Dual Subs";
//     toggleBtn.className = `toggle-${isEnabled ? "on" : "off"}`;
//   }
// });

// function getFlag(lang) {
//   const flags = { de: "🇩🇪", en: "🇺🇸", es: "🇪🇸", fr: "🇫🇷", it: "🇮🇹" };
//   return flags[lang] || "🌐";
// }

// window.selectTrackFinal = (slot, id, label, lang) => {
//   selectedTracks[slot === 0 ? "primary" : "secondary"] = id;
//   document
//     .querySelectorAll(".track-item")
//     .forEach((el) => el.classList.remove("active"));
//   event.target.classList.add("active");
//   document.getElementById("tracksList").style.display = "none";
// };

// window.switchTab = (tabName) => {
//   document
//     .querySelectorAll(".tab-content")
//     .forEach((tab) => tab.classList.remove("active"));
//   document
//     .querySelectorAll(".tab-btn")
//     .forEach((btn) => btn.classList.remove("active"));
//   document.getElementById(tabName + "Tab").classList.add("active");
//   event.target.classList.add("active");
// };

///////////////////////////
// let isEnabled = false;

// document.addEventListener('DOMContentLoaded', async () => {
//   const statusEl = document.getElementById('status');
//   const tracksEl = document.getElementById('tracks');
//   const toggleBtn = document.getElementById('toggle');
//   const logsEl = document.getElementById('logs');

//   // Load stored state
//   const result = await chrome.storage.sync.get(['dualSubsEnabled', 'tracksFound', 'logs']);
//   isEnabled = result.dualSubsEnabled || false;
//   updateUI();

//   toggleBtn.onclick = async () => {
//     isEnabled = !isEnabled;
//     await chrome.storage.sync.set({ dualSubsEnabled: isEnabled });
//     updateUI();
//     logsEl.textContent += `\n[${new Date().toLocaleTimeString()}] ${isEnabled ? 'ENABLED' : 'DISABLED'}\n`;
//     logsEl.scrollTop = logsEl.scrollHeight;
//   };

//   // Poll content script status every 2s
//   setInterval(async () => {
//     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
//     if (tab.url?.includes('net20.cc')) {
//       chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
//         if (response) {
//           statusEl.textContent = response.status || 'No response';
//           statusEl.className = `status ${response.active ? 'active' : 'inactive'}`;
//           tracksEl.textContent = `Tracks: ${response.tracks?.german ? 'DE ✓' : 'DE ✗'}, ${response.tracks?.english ? 'EN ✓' : 'EN ✗'}`;

//           if (response.logs) {
//             logsEl.textContent += `\n${response.logs}\n`;
//             logsEl.scrollTop = logsEl.scrollHeight;
//           }
//         }
//       });
//     }
//   }, 2000);

//   function updateUI() {
//     toggleBtn.textContent = isEnabled ? 'Disable Dual Subs' : 'Enable Dual Subs';
//     toggleBtn.className = `toggle-${isEnabled ? 'on' : 'off'}`;
//   }
// });

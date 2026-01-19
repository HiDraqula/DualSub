document.addEventListener("DOMContentLoaded", () => {
  const statusEl = document.getElementById("status");
  const debugInfoEl = document.getElementById("debugInfo");
  const track1El = document.getElementById("track1");
  const track2El = document.getElementById("track2");
  const toggleBtn = document.getElementById("toggleSubs");
  const logsEl = document.getElementById("logs");
  const domScanEl = document.getElementById("domScan");
  const iframeCountEl = document.getElementById("iframeCount");
  const videoCountEl = document.getElementById("videoCount");
  const trackCountEl = document.getElementById("trackCount");
  const scanDeepBtn = document.getElementById("scanDeep");
  const exportFullBtn = document.getElementById("exportFull");
  const exportIframeBtn = document.getElementById("exportIframe");
  const exportDebugBtn = document.getElementById("exportDebug");
  let isEnabled = false;

  scanDeepBtn.onclick = () => sendMessage("deepScan", "Scanning iframes...");
  exportFullBtn.onclick = () => sendMessage("exportFullHtml", "Exporting full HTML...");
  exportIframeBtn.onclick = () => sendMessage("exportIframeHtml", "Exporting iframe HTML...");
  exportDebugBtn.onclick = () => sendMessage("exportDebugJson", "Exporting debug JSON...");

  // Add these onclick handlers
  document.getElementById("dumpHtml").onclick = () => sendMessage("dumpHtml", "Dumping HTML...");
  document.getElementById("forceInject").onclick = () => sendMessage("forceInject", "Injecting everywhere...");
  // document.getElementById("exportDebug").onclick = () => sendMessage("exportDebugJson", "Exporting JSON...");

  toggleBtn.onclick = () => {
    sendMessage("toggleSubs", "Toggling dual subtitles...");
    isEnabled = !isEnabled;
    updateToggleUI();
  };

  track1El.onclick = () => promptTrackSelection("selectTrack1");
  track2El.onclick = () => promptTrackSelection("selectTrack2");

  setInterval(updateStatus, 2000);
  updateStatus();

  function sendMessage(action, logMsg = "") {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab.url?.includes("net20.cc")) {
        if (logMsg) logsEl.textContent = logMsg;
        chrome.tabs.sendMessage(tab.id, { action }, updateFromResponse);
      } else {
        logsEl.textContent = "Please navigate to net20.cc first";
      }
    });
  }

  function promptTrackSelection(action) {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab.url?.includes("net20.cc")) {
        chrome.tabs.sendMessage(tab.id, { action: "getStatus" }, (response) => {
          if (response?.allTracks) {
            const trackIndex = prompt(action === "selectTrack1" ? "Select Primary Track (0-based index):" : "Select Secondary Track (0-based index):", "0");
            if (trackIndex !== null && !isNaN(trackIndex)) {
              sendMessage(action, `Setting ${action}...`);
              chrome.tabs.sendMessage(tab.id, { action, trackId: parseInt(trackIndex) });
            }
          }
          logsEl.textContent += `\nTracks: ${response.allTracks?.length || 0}, Active: ${response.active}`;
        });
      }
    });
  }

  // function updateFromResponse(response) {
  //   if (chrome.runtime.lastError) {
  //     logsEl.textContent = "Extension error - reload extension";
  //     return;
  //   }

  //   const trackTotal = response.allTracks?.length || 0;
  //   statusEl.textContent = response.active ? "✅ Dual subtitles ACTIVE" : trackTotal ? `${trackTotal} tracks ready` : response.domInfo?.iframes ? `${response.domInfo.iframes} iframe(s)` : "Scanning...";

  //   statusEl.className = `status ${response.active ? "active" : trackTotal ? "ready" : "scan"}`;

  //   if (response.domInfo) {
  //     debugInfoEl.style.display = "block";
  //     domScanEl.textContent = `${response.domInfo.iframes || 0} iframes, ${response.domInfo.videos || 0} videos`;
  //     iframeCountEl.textContent = response.domInfo.iframes || 0;
  //     videoCountEl.textContent = response.domInfo.videos || 0;
  //     trackCountEl.textContent = trackTotal;
  //   }

  //   // track1El.textContent = `Track 1: ${response.selectedTracks?.primary !== null ? response.allTracks?.[response.selectedTracks.primary]?.label || "Track " + response.selectedTracks.primary : "None (click)"}`;
  //   // track2El.textContent = `Track 2: ${response.selectedTracks?.secondary !== null ? response.allTracks?.[response.selectedTracks.secondary]?.label || "Track " + response.selectedTracks.secondary : "None (click)"}`;
  //   // SAFE VERSION
  //   const primaryId = response.selectedTracks?.primary ?? null;
  //   const primaryLabel = primaryId !== null && response.allTracks?.[primaryId]?.label ? response.allTracks[primaryId].label : "None (click)";
  //   track1El.textContent = `Track 1: ${primaryLabel}`;

  //   const secondaryId = response.selectedTracks?.secondary ?? null;
  //   const secondaryLabel = secondaryId !== null && response.allTracks?.[secondaryId]?.label ? response.allTracks[secondaryId].label : "None (click)";
  //   track2El.textContent = `Track 2: ${secondaryLabel}`;

  //   logsEl.textContent = (response.logs || []).slice(-3).join("\n") || (response.domInfo?.iframes ? "Ready - click Deep Scan for details" : "Navigate to net20.cc");
  // }

  function updateFromResponse(response) {
    if (chrome.runtime.lastError || !response) {
      logsEl.textContent = "Extension error - reload extension";
      return;
    }

    const trackTotal = response.allTracks?.length || 0;
    statusEl.textContent = response.active ? "✅ Dual subtitles ACTIVE" : trackTotal ? `${trackTotal} tracks ready` : response.domInfo?.iframes ? `${response.domInfo.iframes} iframe(s)` : "Scanning...";

    statusEl.className = `status ${response.active ? "active" : trackTotal ? "ready" : "scan"}`;

    // SAFE TRACK DISPLAY
    const primaryId = response.selectedTracks?.primary ?? null;
    const primaryLabel = primaryId !== null && response.allTracks?.[primaryId]?.label ? response.allTracks[primaryId].label : "None (click)";
    track1El.textContent = `Track 1: ${primaryLabel}`;

    const secondaryId = response.selectedTracks?.secondary ?? null;
    const secondaryLabel = secondaryId !== null && response.allTracks?.[secondaryId]?.label ? response.allTracks[secondaryId].label : "None (click)";
    track2El.textContent = `Track 2: ${secondaryLabel}`;

    // Debug info
    if (response.domInfo) {
      debugInfoEl.style.display = "block";
      domScanEl.textContent = `${response.domInfo.iframes || 0} iframes, ${response.domInfo.videos || 0} videos`;
      iframeCountEl.textContent = response.domInfo.iframes || 0;
      videoCountEl.textContent = response.domInfo.videos || 0;
      trackCountEl.textContent = trackTotal;
    }

    logsEl.textContent = (response.logs || []).slice(-3).join("\n") || "Ready";
  }

  function updateStatus() {
    sendMessage("getStatus");
  }

  function updateToggleUI() {
    toggleBtn.textContent = isEnabled ? "Disable Dual Subs" : "Enable Dual Subs";
    toggleBtn.className = `toggle-${isEnabled ? "on" : "off"}`;
  }
});

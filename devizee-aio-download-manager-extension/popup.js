document.addEventListener("DOMContentLoaded", async () => {
  const pauseBtn = document.getElementById("pauseBtn");
  const pauseIcon = document.getElementById("pauseIcon");
  const pauseText = document.getElementById("pauseText");
  const statusBadge = document.getElementById("statusBadge");
  const interceptToggle = document.getElementById("interceptToggle");
  const pillToggle = document.getElementById("pillToggle");
  const tabMediaStatus = document.getElementById("tabMediaStatus");
  const sendTabBtn = document.getElementById("sendTabBtn");
  const optionsLink = document.getElementById("optionsLink");

  // Load stored settings
  const settings = await chrome.storage.local.get({
    paused: false,
    interceptDownloads: false,
    showFloatingPill: true
  });

  function updatePauseUI(isPaused) {
    if (isPaused) {
      pauseBtn.className = "btn-pause paused-state";
      pauseIcon.textContent = "▶";
      pauseText.textContent = "Resume Link Grabbing";
      statusBadge.textContent = "Paused";
      statusBadge.className = "status-pill status-paused";
    } else {
      pauseBtn.className = "btn-pause active-state";
      pauseIcon.textContent = "⏸";
      pauseText.textContent = "Pause Link Grabbing";
      statusBadge.textContent = "Active";
      statusBadge.className = "status-pill status-active";
    }
  }

  updatePauseUI(settings.paused);
  interceptToggle.checked = settings.interceptDownloads;
  pillToggle.checked = settings.showFloatingPill !== false;

  // Broadcast visibility to every open tab instantly
  async function broadcastPillVisibility(isVisible) {
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      if (t.id) {
        chrome.tabs.sendMessage(t.id, {
          action: "updatePillVisibility",
          visible: isVisible
        }).catch(() => { });
      }
    }
  }

  // Master Pause Click Listener
  pauseBtn.addEventListener("click", async () => {
    const curr = await chrome.storage.local.get({ paused: false, showFloatingPill: true });
    const nextPaused = !curr.paused;
    await chrome.storage.local.set({ paused: nextPaused });
    updatePauseUI(nextPaused);
    broadcastPillVisibility(!nextPaused && curr.showFloatingPill !== false);
  });

  // Floating Pill Toggle Listener (Instant DOM removal / recreation)
  pillToggle.addEventListener("change", async (e) => {
    const isChecked = e.target.checked;
    await chrome.storage.local.set({ showFloatingPill: isChecked });
    const curr = await chrome.storage.local.get({ paused: false });
    broadcastPillVisibility(isChecked && !curr.paused);
  });

  // Intercept Toggle Listener
  interceptToggle.addEventListener("change", async (e) => {
    await chrome.storage.local.set({ interceptDownloads: e.target.checked });
  });

  // Check Active Tab for Media
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let activeUrl = tab?.url || "";

  const isStream = activeUrl && (
    activeUrl.includes("youtube.com") ||
    activeUrl.includes("youtu.be") ||
    activeUrl.includes("vimeo.com") ||
    activeUrl.includes("soundcloud.com") ||
    activeUrl.includes("dailymotion.com") ||
    activeUrl.includes("twitch.tv") ||
    activeUrl.includes("tiktok.com") ||
    activeUrl.includes("bilibili.com")
  );

  if (isStream) {
    tabMediaStatus.innerHTML = `<strong>Streaming Media Detected:</strong><br><span style="color:#94a3b8;font-size:11px;">${tab.title || activeUrl}</span>`;
    sendTabBtn.disabled = false;
  } else if (activeUrl.startsWith("http")) {
    tabMediaStatus.innerHTML = `Page URL available for download probing:<br><span style="color:#94a3b8;font-size:11px;">${tab.title || activeUrl}</span>`;
    sendTabBtn.disabled = false;
  } else {
    tabMediaStatus.textContent = "No downloadable media detected on current page.";
    sendTabBtn.disabled = true;
  }

  sendTabBtn.addEventListener("click", async () => {
    if (!activeUrl) return;
    sendTabBtn.textContent = "Sending to Devizee...";
    sendTabBtn.disabled = true;

    chrome.runtime.sendMessage({ action: "sendTabToDevizee", url: activeUrl }, () => {
      sendTabBtn.textContent = "Sent to Devizee ✓";
      setTimeout(() => window.close(), 1000);
    });
  });

  optionsLink.addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("options.html"));
    }
  });
});
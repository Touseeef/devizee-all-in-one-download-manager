/**
 * Devizee Download Manager Relay - Background Service Worker (Manifest V3)
 * Fast detector and relay for passive downloads and streaming media.
 */

const NATIVE_HOST_NAME = "com.devizee.native_host";

const SUPPORTED_STREAM_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "vimeo.com",
  "soundcloud.com",
  "dailymotion.com",
  "twitch.tv",
  "tiktok.com",
  "bilibili.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com"
];

// Default configuration
const DEFAULT_SETTINGS = {
  interceptDownloads: false, // Privacy-first default: OFF
  paused: false,             // Master pause toggle for all grabbing
  minFileSizeMB: 10,         // Minimum threshold for browser downloads
  excludedDomains: ["localhost", "127.0.0.1"]
};

// Initialize settings and context menus on install
chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(null);
  const updated = { ...DEFAULT_SETTINGS, ...current };
  await chrome.storage.local.set(updated);

  chrome.contextMenus.create({
    id: "devizee-download",
    title: "Download with Devizee",
    contexts: ["page", "link", "video", "audio"]
  });

  updateBadgeForActiveTab();
});

// Update badge when tab changes or updates
chrome.tabs.onActivated.addListener(updateBadgeForActiveTab);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    updateBadgeForTab(tab);
  }
});

async function updateBadgeForActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) updateBadgeForTab(tab);
}

async function updateBadgeForTab(tab) {
  if (!tab || !tab.url) return;
  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);

  if (settings.paused) {
    chrome.action.setBadgeText({ text: "OFF", tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: "#64748b", tabId: tab.id });
    return;
  }

  const isStream = isSupportedStreamUrl(tab.url);
  if (isStream) {
    chrome.action.setBadgeText({ text: "GET", tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: "#3b82f6", tabId: tab.id });
  } else {
    chrome.action.setBadgeText({ text: "", tabId: tab.id });
  }
}

function isSupportedStreamUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    return SUPPORTED_STREAM_DOMAINS.some(d => url.hostname === d || url.hostname.endsWith("." + d));
  } catch {
    return false;
  }
}

// Context Menu Click Handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "devizee-download") return;

  const targetUrl = info.linkUrl || info.srcUrl || info.pageUrl || tab?.url;
  if (!targetUrl) return;

  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
  if (settings.paused) {
    console.log("[Devizee] Link grabbing is paused. Ignoring context menu action.");
    return;
  }

  await relayUrlToDevizee(targetUrl);
});

// Passive File Download Interception
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  handleDownloadInterception(downloadItem);
  // Allow default behavior while async check evaluates
  return false;
});

async function handleDownloadInterception(downloadItem) {
  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);

  // Gated behind explicit setting and not paused
  if (!settings.interceptDownloads || settings.paused) {
    return;
  }

  const urlStr = downloadItem.finalUrl || downloadItem.url;
  if (!urlStr || urlStr.startsWith("blob:") || urlStr.startsWith("data:")) {
    return;
  }

  try {
    const url = new URL(urlStr);

    // Check domain exclusions
    if (settings.excludedDomains.some(d => url.hostname === d || url.hostname.endsWith("." + d))) {
      return;
    }

    // Check size threshold if fileSize is reported (> 0)
    const minBytes = settings.minFileSizeMB * 1024 * 1024;
    if (downloadItem.fileSize > 0 && downloadItem.fileSize < minBytes) {
      return; // Under threshold, let browser handle it
    }

    // Cancel the Chromium browser download
    chrome.downloads.cancel(downloadItem.id, () => {
      if (chrome.runtime.lastError) {
        console.warn("[Devizee] Could not cancel browser download:", chrome.runtime.lastError.message);
      }
    });

    // Erase cancelled download entry from history to keep it clean
    setTimeout(() => {
      chrome.downloads.erase({ id: downloadItem.id }).catch(() => {});
    }, 1000);

    // Relay to Devizee
    await relayUrlToDevizee(urlStr);

  } catch (err) {
    console.error("[Devizee] Interception error:", err);
  }
}

// Transport: Native Messaging Primary with Protocol Fallback
async function relayUrlToDevizee(urlStr) {
  let cookies = [];
  try {
    const parsed = new URL(urlStr);
    cookies = await chrome.cookies.getAll({ domain: parsed.hostname });
  } catch {}

  const payload = {
    action: "download",
    url: urlStr,
    cookies: cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain, path: c.path }))
  };

  try {
    // Attempt Chrome Native Messaging first
    chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, payload, (response) => {
      if (chrome.runtime.lastError) {
        console.log("[Devizee] Native messaging host unreachable, falling back to protocol handler:", chrome.runtime.lastError.message);
        fallbackToProtocolHandler(urlStr);
      } else {
        console.log("[Devizee] Successfully sent payload via native messaging:", response);
      }
    });
  } catch (e) {
    fallbackToProtocolHandler(urlStr);
  }
}

function fallbackToProtocolHandler(urlStr) {
  const deepLink = `streamgrab://download?url=${encodeURIComponent(urlStr)}`;
  chrome.tabs.create({ url: deepLink, active: false }, (tab) => {
    // Clean up temporary tab quickly
    setTimeout(() => {
      if (tab?.id) chrome.tabs.remove(tab.id).catch(() => {});
    }, 1200);
  });
}

// Listen for popup requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "sendTabToDevizee") {
    relayUrlToDevizee(request.url).then(() => {
      sendResponse({ success: true });
    });
    return true; // async
  }
  if (request.action === "testNativeHost") {
    chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, { action: "ping" }, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, response });
      }
    });
    return true;
  }
});

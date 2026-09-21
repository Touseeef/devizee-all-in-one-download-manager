/**
 * Devizee Download Manager Relay - Content Script
 * Clean, flat purple floating video grabber pill.
 */

(function () {
    const STREAM_DOMAINS = [
        "youtube.com",
        "youtu.be",
        "vimeo.com",
        "soundcloud.com",
        "dailymotion.com",
        "tiktok.com",
        "twitch.tv",
        "bilibili.com"
    ];

    function isStreamSite() {
        const host = window.location.hostname.toLowerCase();
        return STREAM_DOMAINS.some(d => host === d || host.endsWith("." + d));
    }

    function removePill() {
        const el = document.getElementById("devizee-grab-pill");
        if (el) el.remove();
    }

    function createGrabPill() {
        if (document.getElementById("devizee-grab-pill")) return;

        const targetContainer = document.body || document.documentElement;
        if (!targetContainer) return;

        const pill = document.createElement("div");
        pill.id = "devizee-grab-pill";

        pill.innerHTML = `
      <div id="devizee-grab-drag-area" title="Drag to reposition">
        <div id="devizee-grab-handle">
          <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
            <circle cx="2" cy="2" r="1.2" />
            <circle cx="6" cy="2" r="1.2" />
            <circle cx="2" cy="6" r="1.2" />
            <circle cx="6" cy="6" r="1.2" />
            <circle cx="2" cy="10" r="1.2" />
            <circle cx="6" cy="10" r="1.2" />
          </svg>
        </div>
        <div id="devizee-grab-label">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Devizee</span>
        </div>
      </div>
      <button id="devizee-grab-btn" type="button">Grab Video</button>
      <button id="devizee-grab-close" type="button" title="Dismiss">&times;</button>
    `;

        targetContainer.appendChild(pill);

        // Grab action
        const grabBtn = pill.querySelector("#devizee-grab-btn");
        grabBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            grabBtn.textContent = "Sending...";
            grabBtn.disabled = true;

            chrome.runtime.sendMessage(
                { action: "sendTabToDevizee", url: window.location.href },
                (res) => {
                    if (chrome.runtime.lastError) {
                        console.error("[Devizee] Error:", chrome.runtime.lastError.message);
                        grabBtn.textContent = "Error";
                    } else if (res && !res.success) {
                        grabBtn.textContent = "Failed";
                    } else {
                        grabBtn.textContent = "Sent ✓";
                    }

                    setTimeout(() => {
                        if (grabBtn) {
                            grabBtn.textContent = "Grab Video";
                            grabBtn.disabled = false;
                        }
                    }, 2000);
                }
            );
        });

        // Dismiss action
        const closeBtn = pill.querySelector("#devizee-grab-close");
        closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            removePill();
        });

        // Drag behavior
        const dragArea = pill.querySelector("#devizee-grab-drag-area");
        let isDragging = false;
        let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

        dragArea.addEventListener("mousedown", (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = pill.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            pill.style.right = "auto";
            pill.style.left = initialLeft + "px";
            pill.style.top = initialTop + "px";

            const onMouseMove = (ev) => {
                if (!isDragging) return;
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                pill.style.left = Math.max(10, Math.min(window.innerWidth - pill.offsetWidth - 10, initialLeft + dx)) + "px";
                pill.style.top = Math.max(10, Math.min(window.innerHeight - pill.offsetHeight - 10, initialTop + dy)) + "px";
            };

            const onMouseUp = () => {
                isDragging = false;
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });
    }

    function evaluate() {
        chrome.storage.local.get({ paused: false, showFloatingPill: true }, (res) => {
            // If user paused everything or toggled the pill off, destroy it
            if (res.paused === true || res.showFloatingPill === false) {
                removePill();
                return;
            }

            // Check if it's a known stream site OR has an active video/audio element
            const hasMedia = document.querySelector("video, audio") !== null;
            if (isStreamSite() || hasMedia) {
                createGrabPill();
            } else {
                removePill();
            }
        });
    }

    // SPA navigation hooks
    window.addEventListener("yt-navigate-finish", evaluate);
    window.addEventListener("popstate", evaluate);
    window.addEventListener("DOMContentLoaded", evaluate);
    window.addEventListener("load", evaluate);

    // Direct toggle message from popup
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === "updatePillVisibility") {
            if (msg.visible) {
                evaluate();
            } else {
                removePill();
            }
        }
    });

    // Storage changes
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local") {
            if (changes.showFloatingPill !== undefined || changes.paused !== undefined) {
                evaluate();
            }
        }
    });

    // Mutation observer for dynamically loaded video players
    const observer = new MutationObserver(() => {
        if (!document.getElementById("devizee-grab-pill")) {
            evaluate();
        }
    });

    const root = document.body || document.documentElement;
    if (root) {
        observer.observe(root, { childList: true, subtree: true });
    }

    evaluate();
})();
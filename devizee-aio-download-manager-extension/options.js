document.addEventListener("DOMContentLoaded", async () => {
  const thresholdInput = document.getElementById("thresholdInput");
  const exclusionsInput = document.getElementById("exclusionsInput");
  const saveBtn = document.getElementById("saveBtn");
  const saveStatus = document.getElementById("saveStatus");
  const testHostBtn = document.getElementById("testHostBtn");
  const testHostResult = document.getElementById("testHostResult");

  const settings = await chrome.storage.local.get({
    minFileSizeMB: 10,
    excludedDomains: ["localhost", "127.0.0.1"]
  });

  thresholdInput.value = settings.minFileSizeMB;
  exclusionsInput.value = settings.excludedDomains.join("\n");

  saveBtn.addEventListener("click", async () => {
    const minMb = Math.max(1, parseInt(thresholdInput.value, 10) || 10);
    const exclusions = exclusionsInput.value
      .split("\n")
      .map(d => d.trim().toLowerCase())
      .filter(Boolean);

    await chrome.storage.local.set({
      minFileSizeMB: minMb,
      excludedDomains: exclusions
    });

    saveStatus.textContent = "Saved ✓";
    setTimeout(() => { saveStatus.textContent = ""; }, 2500);
  });

  testHostBtn.addEventListener("click", () => {
    testHostResult.textContent = "Testing...";
    testHostResult.style.color = "#94a3b8";

    chrome.runtime.sendMessage({ action: "testNativeHost" }, (res) => {
      if (res && res.success) {
        testHostResult.textContent = "Native Host Connected ✓";
        testHostResult.style.color = "#10b981";
      } else {
        testHostResult.textContent = `Host not detected (using protocol fallback)`;
        testHostResult.style.color = "#f59e0b";
      }
    });
  });
});

let pageYear = null;
let totalAdjusted = 0;
let isEnabled = true;
let observerTimeout = null;

async function initialize() {
  const storage = await chrome.storage.local.get(['enabled']);
  isEnabled = storage.enabled !== false;

  if (!isEnabled) return;

  await loadCPIData();
  pageYear = detectPageYear();

  processPage();
  setupMutationObserver();
  sendStatsToPopup();
}

function processPage() {
  if (!isEnabled || !pageYear) return;

  const count = findAndReplacePrices(document.body, pageYear, {
    calculateInflation,
    formatPrice,
    parsePrice
  });

  totalAdjusted += count;
}

function setupMutationObserver() {
  const observer = new MutationObserver((mutations) => {
    if (!isEnabled) return;

    if (observerTimeout) {
      clearTimeout(observerTimeout);
    }

    observerTimeout = setTimeout(() => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const count = findAndReplacePrices(node, pageYear, {
              calculateInflation,
              formatPrice,
              parsePrice
            });
            totalAdjusted += count;
          }
        });
      });

      sendStatsToPopup();
    }, 500);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function sendStatsToPopup() {
  chrome.runtime.sendMessage({
    action: 'updateStats',
    data: {
      priceCount: totalAdjusted,
      detectedYear: pageYear,
      enabled: isEnabled
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleEnabled') {
    isEnabled = message.enabled;
    if (!isEnabled) {
      document.querySelectorAll('.inflation-adjusted-price').forEach(span => {
        span.outerHTML = span.textContent;
      });
      totalAdjusted = 0;
    } else {
      processPage();
    }
    sendStatsToPopup();
    sendResponse({ success: true });
  } else if (message.action === 'getStats') {
    sendResponse({
      priceCount: totalAdjusted,
      detectedYear: pageYear,
      enabled: isEnabled
    });
  }
  return true;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

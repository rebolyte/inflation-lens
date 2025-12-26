import { loadCPIData, calculateInflation, formatPrice, parsePrice } from '../lib/inflation-calculator.js';
import { detectPageYear } from './date-detector.js';
import { findAndReplacePrices } from './price-replacer.js';

/** @type {number | null} */
let pageYear = null;

/** @type {number} */
let totalAdjusted = 0;

/** @type {boolean} */
let isEnabled = true;

/** @type {ReturnType<typeof setTimeout> | null} */
let observerTimeout = null;

/**
 * @returns {Promise<void>}
 */
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

/**
 * @returns {void}
 */
function processPage() {
  if (!isEnabled || !pageYear) return;

  const count = findAndReplacePrices(document.body, pageYear, {
    calculateInflation,
    formatPrice,
    parsePrice
  });

  totalAdjusted += count;
}

/**
 * @returns {void}
 */
function setupMutationObserver() {
  const observer = new MutationObserver((mutations) => {
    if (!isEnabled || !pageYear) return;

    if (observerTimeout) {
      clearTimeout(observerTimeout);
    }

    observerTimeout = setTimeout(() => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE && node instanceof Element && pageYear) {
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

/**
 * @returns {void}
 */
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
        if (span.textContent) {
          span.outerHTML = span.textContent;
        }
      });
      totalAdjusted = 0;
    } else {
      processPage();
    }
    sendStatsToPopup();
    // @ts-ignore - sendResponse type mismatch in Chrome types
    sendResponse({ success: true });
  } else if (message.action === 'getStats') {
    // @ts-ignore - sendResponse type mismatch in Chrome types
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

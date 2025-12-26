import { loadCPIData, calculateInflation, formatPrice, parsePrice, getAdjustedYear } from '../lib/inflation-calculator.js';
import { detectPageYear } from './date-detector.js';
import { findAndReplacePrices } from './price-replacer.js';

/** @type {number | null} */
let pageYear = null;

/** @type {number} */
let totalAdjusted = 0;

/** @type {boolean} */
let isEnabled = true;

/** @type {boolean} */
let swapInPlace = false;

/** @type {ReturnType<typeof setTimeout> | null} */
let observerTimeout = null;

/**
 * @returns {Promise<void>}
 */
async function initialize() {
  console.log('[Inflation Lens] Content script initializing');
  const storage = await chrome.storage.local.get(['enabled', 'swapInPlace']);
  isEnabled = storage.enabled !== false;
  swapInPlace = storage.swapInPlace === true;

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
    parsePrice,
    getAdjustedYear
  }, swapInPlace);

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
              parsePrice,
              getAdjustedYear
            }, swapInPlace);
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
      enabled: isEnabled,
      swapInPlace: swapInPlace
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleEnabled') {
    isEnabled = message.enabled;
    if (!isEnabled) {
      document.querySelectorAll('.inflation-adjusted-price').forEach(span => {
        const originalPrice = span.getAttribute('data-original-price');
        if (originalPrice) {
          span.outerHTML = originalPrice;
        } else if (span.textContent) {
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
  } else if (message.action === 'toggleSwapInPlace') {
    swapInPlace = message.swapInPlace;
    document.querySelectorAll('.inflation-adjusted-price').forEach(span => {
      const originalPrice = span.getAttribute('data-original-price');
      const adjustedPrice = span.getAttribute('data-adjusted-price');
      const originalYear = span.getAttribute('data-original-year');
      if (originalPrice && adjustedPrice) {
        const adjustedYear = getAdjustedYear ? getAdjustedYear() : null;
      const adjustedPriceText = adjustedYear 
        ? `${adjustedPrice} (${adjustedYear})`
        : adjustedPrice;
      if (swapInPlace) {
        span.textContent = adjustedPrice;
      } else {
        span.textContent = originalPrice;
      }
      const tooltipText = `${originalPrice} in ${originalYear} = ${adjustedPriceText}`;
      span.setAttribute('data-tooltip', tooltipText);
      }
    });
    sendStatsToPopup();
    // @ts-ignore - sendResponse type mismatch in Chrome types
    sendResponse({ success: true });
  } else if (message.action === 'getStats') {
    // @ts-ignore - sendResponse type mismatch in Chrome types
    sendResponse({
      priceCount: totalAdjusted,
      detectedYear: pageYear,
      enabled: isEnabled,
      swapInPlace: swapInPlace
    });
  }
  return true;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

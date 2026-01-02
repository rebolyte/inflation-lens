import { loadCPIData, calculateInflation, formatPrice, parsePrice, getAdjustedYear } from '../lib/inflation-calculator.js';
import { detectPageYear, validateYear, detectFromMetaTags, detectFromJsonLd, detectFromUrl } from './date-detector.js';
import { findAndReplacePrices } from './price-replacer.js';

/**
 * @typedef {Object} ExtensionState
 * @property {number | null} pageYear - The year used for inflation calculations
 * @property {number | null} detectedYear - The year detected from page metadata
 * @property {number} totalAdjusted - Count of prices adjusted on the page
 * @property {boolean} isEnabled - Whether the extension is currently enabled
 * @property {boolean} swapInPlace - Whether to swap prices in place or show tooltip
 * @property {number | null} rafId - RAF ID for batching DOM mutations
 * @property {Set<Element>} pendingNodes - Nodes pending processing from mutations
 * @property {MutationObserver | null} observer - MutationObserver instance
 */

/** @type {ExtensionState} */
const state = {
  pageYear: null,
  detectedYear: null,
  totalAdjusted: 0,
  isEnabled: true,
  swapInPlace: false,
  rafId: null,
  pendingNodes: new Set(),
  observer: null
};

/**
 * Initializes the content script and starts price detection/replacement.
 * Loads CPI data, detects page year from metadata, and processes the page.
 * Sets up mutation observer to handle dynamically added content.
 * @returns {Promise<void>}
 */
async function initialize() {
  console.log('[Inflation Lens] Content script initializing');
  const storage = await chrome.storage.local.get(['enabled', 'swapInPlace']);
  state.isEnabled = storage.enabled !== false;
  state.swapInPlace = storage.swapInPlace === true;

  if (!state.isEnabled) return;

  await loadCPIData();
  state.detectedYear = detectFromMetaTags() || detectFromJsonLd() || detectFromUrl();
  state.pageYear = state.detectedYear || detectPageYear();

  processPage();
  setupMutationObserver();
  sendStatsToPopup();
}

/**
 * Processes the entire page to find and replace prices with inflation-adjusted values.
 * Only runs if extension is enabled and a valid page year has been detected.
 * @returns {void}
 */
function processPage() {
  if (!state.isEnabled || !state.pageYear) return;

  const count = findAndReplacePrices(document.body, state.pageYear, {
    calculateInflation,
    formatPrice,
    parsePrice,
    getAdjustedYear
  }, state.swapInPlace);

  state.totalAdjusted += count;
}

/**
 * Sets up a MutationObserver to detect and process dynamically added content.
 * Uses requestAnimationFrame batching to efficiently handle rapid DOM changes.
 * Collects all added nodes and processes them in a single animation frame.
 * @returns {void}
 */
function setupMutationObserver() {
  // Don't create duplicate observers
  if (state.observer) return;

  state.observer = new MutationObserver((mutations) => {
    if (!state.isEnabled || !state.pageYear) return;

    // Collect all added nodes
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE && node instanceof Element) {
          state.pendingNodes.add(node);
        }
      });
    });

    // Use RAF to batch processing - only schedule if not already scheduled
    if (!state.rafId) {
      state.rafId = requestAnimationFrame(() => {
        try {
          // Process all pending nodes that are still connected to DOM
          state.pendingNodes.forEach(node => {
            if (node.isConnected && state.pageYear) {
              const count = findAndReplacePrices(node, state.pageYear, {
                calculateInflation,
                formatPrice,
                parsePrice,
                getAdjustedYear
              }, state.swapInPlace);
              state.totalAdjusted += count;
            }
          });

          // Clear pending nodes and RAF ID
          state.pendingNodes.clear();
          state.rafId = null;
          sendStatsToPopup();
        } catch (error) {
          // Handle errors gracefully (e.g., if page navigates away)
          console.error('[Inflation Lens] Error processing mutations:', error);
          state.pendingNodes.clear();
          state.rafId = null;
        }
      });
    }
  });

  state.observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/**
 * Reverts all price adjustments on the page back to their original values.
 * Removes all inflation-adjusted spans and replaces them with the original price text.
 * @returns {void}
 */
function revertAllPrices() {
  document.querySelectorAll('.inflation-adjusted-price').forEach(span => {
    const originalPrice = span.getAttribute('data-original-price');
    // originalPrice is always set in price-replacer.js:86, so we can simplify
    if (originalPrice && span.parentNode) {
      span.parentNode.replaceChild(
        document.createTextNode(originalPrice),
        span
      );
    }
  });
  state.totalAdjusted = 0;
}

/**
 * Sends current statistics to the popup for display.
 * Includes price count, detected year, current year, and enabled state.
 * Message is fire-and-forget (no response expected).
 * @returns {void}
 */
function sendStatsToPopup() {
  chrome.runtime.sendMessage({
    action: 'updateStats',
    data: {
      priceCount: state.totalAdjusted,
      detectedYear: state.detectedYear,
      currentYear: state.pageYear,
      enabled: state.isEnabled,
      swapInPlace: state.swapInPlace
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleEnabled') {
    state.isEnabled = message.enabled;
    if (!state.isEnabled) {
      // Disconnect observer when disabled to stop wasting resources
      if (state.observer) {
        state.observer.disconnect();
        state.observer = null;
      }
      revertAllPrices();
    } else {
      processPage();
      // Reconnect observer when re-enabled
      setupMutationObserver();
    }
    sendStatsToPopup();
    // @ts-ignore - sendResponse type mismatch in Chrome types
    sendResponse({ success: true });
  } else if (message.action === 'updateYear') {
    const newYear = message.year !== null && message.year !== undefined ? validateYear(message.year) : null;
    revertAllPrices();
    state.pageYear = newYear || state.detectedYear || detectPageYear();
    if (state.isEnabled && state.pageYear) {
      processPage();
    }
    sendStatsToPopup();
    // @ts-ignore - sendResponse type mismatch in Chrome types
    sendResponse({ success: true });
  } else if (message.action === 'toggleSwapInPlace') {
    state.swapInPlace = message.swapInPlace;
    document.querySelectorAll('.inflation-adjusted-price').forEach(span => {
      const originalPrice = span.getAttribute('data-original-price');
      const adjustedPrice = span.getAttribute('data-adjusted-price');
      const originalYear = span.getAttribute('data-original-year');
      if (originalPrice && adjustedPrice && originalYear) {
        const adjustedYear = getAdjustedYear ? getAdjustedYear() : null;
        const adjustedPriceText = adjustedYear
          ? `${adjustedPrice} (${adjustedYear})`
          : adjustedPrice;

        if (state.swapInPlace) {
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
      priceCount: state.totalAdjusted,
      detectedYear: state.detectedYear,
      currentYear: state.pageYear,
      enabled: state.isEnabled,
      swapInPlace: state.swapInPlace
    });
  }
  return true;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

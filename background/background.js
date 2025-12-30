console.log('[Inflation Lens] Background script initializing');

/**
 * Initialize extension storage with default values on installation or update.
 * Sets enabled state to true by default.
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Inflation Lens] Extension installed/updated');
  chrome.storage.local.set({
    enabled: true,
    swapInPlace: false
  });
});

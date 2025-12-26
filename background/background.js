console.log('[Inflation Lens] Background script initializing');

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Inflation Lens] Extension installed/updated');
  chrome.storage.local.set({
    enabled: true,
    disabledDomains: []
  });
});

/**
 * @param {Object} request
 * @param {chrome.runtime.MessageSender} sender
 * @param {function} sendResponse
 * @returns {boolean}
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  return true;
});

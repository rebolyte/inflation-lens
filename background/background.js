chrome.runtime.onInstalled.addListener(() => {
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

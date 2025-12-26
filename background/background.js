/**
 * Initializes default settings when the extension is installed
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    enabled: true,
    disabledDomains: []
  });
});

/**
 * Listens for messages from content scripts and popup
 * @param {Object} request - The message request object
 * @param {chrome.runtime.MessageSender} sender - Information about the sender
 * @param {function} sendResponse - Function to send a response
 * @returns {boolean} True to indicate async response
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  return true;
});

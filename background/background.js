chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    enabled: true,
    disabledDomains: []
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  return true;
});

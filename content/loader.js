// Content script loader - dynamically imports ES modules
(async () => {
  const src = chrome.runtime.getURL("content/inflation-detector.js");
  const contentMain = await import(src);
  // inflation-detector.js runs its initialization code on import
})();

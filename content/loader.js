// Content script loader - dynamically imports ES modules
(async () => {
  const tooltipsScript = document.createElement('script');
  tooltipsScript.src = chrome.runtime.getURL("vendor/easy-tooltips-1.2.9.min.js");
  document.head.appendChild(tooltipsScript);

  const src = chrome.runtime.getURL("content/inflation-detector.js");
  const contentMain = await import(src);
  // inflation-detector.js runs its initialization code on import
})();

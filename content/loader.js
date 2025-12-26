// Content script loader - dynamically imports ES modules
(async () => {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/6673c1f3-8ed8-48e6-b2ac-6de09baac5f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'loader.js:3',message:'Loader script started',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  try {
    const src = chrome.runtime.getURL("content/inflation-detector.js");
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6673c1f3-8ed8-48e6-b2ac-6de09baac5f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'loader.js:8',message:'About to import module',data:{src},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const contentMain = await import(src);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6673c1f3-8ed8-48e6-b2ac-6de09baac5f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'loader.js:13',message:'Module imported successfully',data:{keys:Object.keys(contentMain||{})},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6673c1f3-8ed8-48e6-b2ac-6de09baac5f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'loader.js:18',message:'Module import FAILED',data:{error:String(err),stack:err.stack},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
  }
})();

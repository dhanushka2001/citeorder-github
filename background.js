// background.js - Service Worker
// Creates offscreen document and routes messages to it

let creating; // Promise to track offscreen document creation

async function setupOffscreenDocument() {
  // Check if offscreen document already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('offscreen.html')]
  });

  if (existingContexts.length > 0) {
    return; // Already exists
  }

  // Create offscreen document
  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_SCRAPING'], // Closest reason for WASM execution
      justification: 'Load and execute WASM module for footnote processing'
    });
    await creating;
    creating = null;
  }
}

// Forward messages to offscreen document
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PROCESS_CITEORDER') {
    (async () => {
      try {
        // Ensure offscreen document exists
        await setupOffscreenDocument();
        
        // Forward message to offscreen document
        const response = await chrome.runtime.sendMessage(request);
        sendResponse(response);
      } catch (error) {
        sendResponse({ 
          success: false, 
          error: 'Background error: ' + error.message 
        });
      }
    })();
    
    return true; // Async response
  }
});

console.log('🚀 Citeorder background service worker loaded');

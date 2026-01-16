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

// Enable/disable icon based on GitHub editor URL
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.disable(); // default: grey everywhere

  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: [
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: {
              hostEquals: "github.com",
              pathContains: "/edit/"
            }
          })
        ],
        actions: [new chrome.declarativeContent.ShowAction()]
      }
    ]);
  });
});


{/*
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.disable(); // disabled by default
});

// Enable/disable icon based on GitHub editor URL
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.url || changeInfo.status !== 'complete') return;

  const isGithubEditor =
    tab.url.startsWith("https://github.com/") &&
    tab.url.includes("/edit/");

  if (isGithubEditor) {
    chrome.action.enable(tabId);
  } else {
    chrome.action.disable(tabId);
  }
});
*/}


chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== "citeorder-status") return;

  // Relay to the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.id) return;

    chrome.tabs.sendMessage(tabs[0].id, msg);
  });
});


console.log('🚀 Citeorder background service worker loaded');

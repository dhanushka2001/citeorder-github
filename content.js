// content.js - Chrome Extension for Citeorder
// Communicates with background worker for WASM execution

// Inject page bridge for accessing CodeMirror
function injectPageBridge() {
  if (document.getElementById('citeorder-page-bridge')) return;
  
  const script = document.createElement('script');
  script.id = 'citeorder-page-bridge';
  script.src = chrome.runtime.getURL('page-bridge.js');
  script.onload = () => console.log('✅ Page bridge loaded');
  script.onerror = (e) => console.error('❌ Failed to load page bridge:', e);
  (document.head || document.documentElement).appendChild(script);
}

// Call this after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectPageBridge);
} else {
  injectPageBridge();
}

// Get editor content via page bridge
function getEditorText() {
  return new Promise((resolve, reject) => {
    const requestId = 'get_' + Date.now();
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('Timeout getting editor text'));
    }, 5000);
    
    function handler(event) {
      if (event.source !== window) return;
      if (event.data.type !== 'CITEORDER_TEXT_RESPONSE') return;
      if (event.data.requestId !== requestId) return;
      
      clearTimeout(timeout);
      window.removeEventListener('message', handler);
      
      if (event.data.success) {
        resolve({ text: event.data.text, method: event.data.method });
      } else {
        reject(new Error(event.data.error));
      }
    }
    
    window.addEventListener('message', handler);
    window.postMessage({ type: 'CITEORDER_GET_TEXT', requestId }, '*');
  });
}

// Set editor content via page bridge
function setEditorText(text) {
  return new Promise((resolve, reject) => {
    const requestId = 'set_' + Date.now();
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('Timeout setting editor text'));
    }, 5000);
    
    function handler(event) {
      if (event.source !== window) return;
      if (event.data.type !== 'CITEORDER_SET_RESPONSE') return;
      if (event.data.requestId !== requestId) return;
      
      clearTimeout(timeout);
      window.removeEventListener('message', handler);
      
      if (event.data.success) {
        resolve({ method: event.data.method });
      } else {
        reject(new Error(event.data.error));
      }
    }
    
    window.addEventListener('message', handler);
    window.postMessage({ type: 'CITEORDER_SET_TEXT', requestId, text }, '*');
  });
}

// Process text via background worker
function processWithBackground(text, flags) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: 'PROCESS_CITEORDER',
        text: text,
        flags: flags
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Unknown error'));
        }
      }
    );
  });
}

// Check if we're on a markdown editor page
function isMarkdownEditor() {
  return document.querySelector(".cm-editor, textarea.js-code-textarea, file-editor") !== null;
}
function getGithubColor(varName, fallback) {
  const root = document.documentElement;
  const value = getComputedStyle(root).getPropertyValue(varName);
  return value?.trim() || fallback;
}

// Inject the Citeorder toolbar
function injectToolbar() {
  if (document.getElementById("citeorder-toolbar")) return;
  if (!isMarkdownEditor()) return;
  const targetParent = document.querySelector('.file-editor-textarea, .cm-editor, textarea.js-code-textarea');
  if (!targetParent) return;

  const toolbar = document.createElement("div");
  toolbar.id = "citeorder-toolbar";

  // First, insert it into the DOM
  targetParent.parentElement.insertBefore(toolbar, targetParent);
  
  function applyColors() {
    const colorMode = document.documentElement.getAttribute('data-color-mode');
    const isDark = colorMode === 'dark' || (colorMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    toolbar.style.background = isDark ? '#161b22' : '#f6f8fa';
    toolbar.style.borderBottomColor = isDark ? '#30363d' : '#d0d7de';
  }

  toolbar.style.cssText = `
    padding: 8px;
    border-bottom: 1px solid;
    display: flex;
    align-items: center;
    gap: 12px;
  `;
  
  // Apply colors immediately
  applyColors();  

  // Also reapply when theme changes
  const observer = new MutationObserver(() => applyColors());
  observer.observe(document.documentElement, { 
    attributes: true, 
    attributeFilter: ['data-color-mode', 'data-dark-theme', 'data-light-theme'] 
  });  

  toolbar.innerHTML = `
    <button id="citeorder-run" style="
      padding: 5px 12px;
      background: #29903b;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.2s ease;
    ">Reorder Footnotes</button>
    <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
      <input type="checkbox" id="cite-q" style="cursor: pointer;">
      <span>Relaxed quotes</span>
    </label>
    <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
      <input type="checkbox" id="cite-d" style="cursor: pointer;">
      <span>Relaxed duplicates</span>
    </label>
    <span id="citeorder-status" style="margin-left: auto; font-size: 12px; color: #666;"></span>
  `;

  // Add hover effect
  const runButton = document.getElementById("citeorder-run");
  runButton.onmouseover = () => runButton.style.background = '#2da44e';
  runButton.onmouseout = () => runButton.style.background = '#29903b';
  runButton.onclick = runCiteorder;

  targetParent.parentElement.insertBefore(toolbar, targetParent);
  
  document.getElementById("citeorder-run").onclick = runCiteorder;
  
  console.log("✓ Citeorder toolbar injected");
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "citeorder-status") return;

  const statusEl = document.getElementById("citeorder-status");
  if (!statusEl) return;

  if (msg.status === "error") {
    statusEl.textContent = "❌ " + msg.message;
  } else {
    statusEl.textContent = msg.message;
  }

  setTimeout(() => {
    statusEl.textContent = "";
  }, 5000);
});

// Main function: run citeorder on the editor content
async function runCiteorder() {
  const statusEl = document.getElementById("citeorder-status");
  const button = document.getElementById("citeorder-run");
  
  try {
    if (button) button.disabled = true;
    if (statusEl) statusEl.textContent = "⚙️ Processing...";

    console.log("🔄 Running citeorder...");

    // Get editor content via page bridge
    const { text: originalText, method } = await getEditorText();
    console.log("📄 Editor method:", method);
    console.log("📄 Input text length:", originalText.length);
    console.log("📄 Input line count:", originalText.split('\n').length);
    console.log("📄 First 100 chars:", originalText.substring(0, 100));
    console.log("📄 Last 100 chars:", originalText.substring(originalText.length - 100));

    // Get flags
    const flags = {
      q: document.getElementById("cite-q")?.checked || false,
      d: document.getElementById("cite-d")?.checked || false
    };

    // Process via background worker
    const response = await processWithBackground(originalText, flags);
    
    console.log("📋 Processing complete");
    if (response.stdout || response.stderr) {
      console.log("Output:", response.stdout || response.stderr);
    }

    // Check result
    if (response.result === null || response.message === 'No changes required') {
      if (statusEl) statusEl.textContent = "✓ No changes required";
      console.log("ℹ️ No changes required");
      setTimeout(() => { if (statusEl) statusEl.textContent = ""; }, 3000);
      return;
    }

    if (response.result === originalText) {
      if (statusEl) statusEl.textContent = "✓ No changes made";
      console.log("ℹ️ Output matches input");
      setTimeout(() => { if (statusEl) statusEl.textContent = ""; }, 3000);
      return;
    }

    // Update editor
    console.log("📝 Setting result, length:", response.result.length);
    console.log("📝 Result line count:", response.result.split('\n').length);
    console.log("📝 First 100 chars:", response.result.substring(0, 100));
    console.log("📝 Last 100 chars:", response.result.substring(response.result.length - 100));
    
    await setEditorText(response.result);
    
    if (statusEl) statusEl.textContent = "✅ Footnotes reordered!";
    console.log("✓ Citeorder completed successfully");

    setTimeout(() => { if (statusEl) statusEl.textContent = ""; }, 5000);

  } catch (error) {
    // console.error("✗ Citeorder error:", error);
    // if (statusEl) statusEl.textContent = "❌ " + error.message;
    
    // Clear error after 5 seconds
    // setTimeout(() => { if (statusEl) statusEl.textContent = ""; }, 5000);
  } finally {
    if (button) button.disabled = false;
  }
}

// Watch for editor to appear and inject toolbar
const observer = new MutationObserver(() => {
  if (isMarkdownEditor()) {
    injectToolbar();
  }
});

observer.observe(document.body, { 
  childList: true, 
  subtree: true 
});

// Try injecting immediately
injectToolbar();

console.log("🚀 Citeorder extension loaded");

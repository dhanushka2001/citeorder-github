// offscreen.js - Handles WASM execution in offscreen document
// Offscreen documents can load WASM without CSP issues

let modulePromise = null;

// Load WASM module
async function getModule() {
  if (!modulePromise) {
    modulePromise = new Promise(async (resolve, reject) => {
      try {
        console.log('🔧 Loading WASM in offscreen document...');
        
        // Load the WASM JS glue code
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('wasm/citeorder.js');
        
        script.onload = async () => {
          console.log('✓ citeorder.js loaded');
          
          if (typeof CiteorderModule !== 'function') {
            throw new Error('CiteorderModule not found');
          }
          
          try {
            const Module = await CiteorderModule({
              locateFile: (path) => chrome.runtime.getURL('wasm/' + path),
              print: (text) => console.log('citeorder:', text),
              printErr: (text) => console.error('citeorder:', text),
              noInitialRun: true // Don't call main() on startup!
            });
            
            console.log('✅ WASM module loaded');
            resolve(Module);
          } catch (err) {
            console.error('❌ WASM init failed:', err);
            reject(err);
          }
        };
        
        script.onerror = () => {
          reject(new Error('Failed to load citeorder.js'));
        };
        
        document.head.appendChild(script);
        
      } catch (error) {
        console.error('❌ Load error:', error);
        reject(error);
      }
    });
  }
  return modulePromise;
}

// Process markdown with citeorder CLI
async function processCiteorder(text, flags) {
  try {
    const Module = await getModule();
    const FS = Module.FS;
    
    // Setup virtual filesystem
    const inputFile = '/input.md';
    const outputFile = '/input-fixed.md';
    
    // Normalize line endings to \n (Unix style) before processing
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    console.log('📝 Normalized:', text.length, '→', normalizedText.length, 'bytes');
    
    // Write input
    FS.writeFile(inputFile, normalizedText);
    // FS.writeFile(inputFile, text);
    console.log('📝 Wrote', normalizedText.length, 'bytes to', inputFile);
    console.log('📝 First 200 chars:', normalizedText.substring(0, 200));
    console.log('📝 Line count:', normalizedText.split('\n').length);
    // console.log('📝 Wrote', text.length, 'bytes to', inputFile);
    // console.log('📝 First 200 chars:', text.substring(0, 200));
    // console.log('📝 Line count:', text.split('\n').length);
    
    // Verify file exists
    try {
      const stat = FS.stat(inputFile);
      console.log('✓ File exists, size:', stat.size);
      
      // Try to read it back to verify
      const readback = FS.readFile(inputFile, { encoding: 'utf8' });
      console.log('✓ Readback successful, length:', readback.length);
      console.log('✓ File matches:', readback === text);
    } catch (e) {
      console.error('❌ File not found after write:', e);
    }
    
    // Build arguments
    const args = [];
    if (flags.q) args.push('-q');
    if (flags.d) args.push('-d');
    args.push(inputFile);
    
    console.log('🔧 Command:', 'citeorder', args.join(' '));
    console.log('🔧 Args array:', args);
    console.log('🔧 Args contents:', JSON.stringify(args));
    
    // Capture stdout/stderr
    let stdout = '';
    let stderr = '';
    Module.print = (t) => { stdout += t + '\n'; };
    Module.printErr = (t) => { stderr += t + '\n'; };
    
    // Run CLI
    // callMain adds argv[0] automatically, so only pass actual arguments
    console.log('▶️ Calling main with args:', args);
    let exitStatus = 0;
    try {
      const returnCode = Module.callMain(args);
      console.log('✓ callMain completed with return code:', returnCode);
      exitStatus = returnCode;
    } catch (e) {
      console.log('⚠️ callMain threw:', e, 'status:', e.status);
      // Emscripten throws on exit() - capture the status
      if (e === 'ExitStatus') {
        exitStatus = 0; // Normal exit
      } else if (typeof e.status === 'number') {
        exitStatus = e.status; // Error exit
        console.log('❌ Program exited with status:', exitStatus);
      } else {
        throw e; // Unexpected error
      }
    }
    
    // Read output
    let result = null;
    console.log('📤 Checking for output file...');
    console.log('📤 Exit status:', exitStatus);
    console.log('📤 stdout:', stdout);
    console.log('📤 stderr:', stderr);
    
    // If exit status is non-zero, the program failed
    if (exitStatus !== 0) {
      const output = (stdout + stderr).trim();
      throw new Error(output || 'Program exited with error status ' + exitStatus);
    }
    
    try {
      result = FS.readFile(outputFile, { encoding: 'utf8' });
      console.log('✓ Read output file, length:', result.length);
      
      // Cleanup
      try {
        FS.unlink(inputFile);
        FS.unlink(outputFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    } catch (e) {
      console.log('⚠️ No output file:', e.message);
      // No output file - check for "No changes required"
      const output = (stdout + stderr).trim();
      console.log('📋 Combined output:', output);
      if (output.includes('No changes required') || output.includes('no changes')) {
        return { result: null, message: 'No changes required', stdout, stderr };
      }
      throw new Error(output || e.message);
    }
    
    return { result, stdout, stderr };
    
  } catch (error) {
    throw new Error('Processing failed: ' + error.message);
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PROCESS_CITEORDER') {
    processCiteorder(request.text, request.flags)
      .then(result => {
        sendResponse({ success: true, ...result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Async response
  }
});

console.log('🚀 Citeorder offscreen document ready');

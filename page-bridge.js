// page-bridge.js - Runs in page context to access CodeMirror
(function() {
  'use strict';
  
  // Force CodeMirror to render all lines by scrolling aggressively
  async function forceRenderAllLines() {
    const cmScroller = document.querySelector('.cm-scroller');
    if (!cmScroller) return false;
    
    console.log('📜 Forcing all lines to render...');
    
    const originalScrollTop = cmScroller.scrollTop;
    const scrollHeight = cmScroller.scrollHeight;
    const clientHeight = cmScroller.clientHeight;
    
    console.log('📏 Scroll info - height:', scrollHeight, 'client:', clientHeight, 'current:', originalScrollTop);
    
    // Scroll in steps to force rendering of all content
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const scrollPos = (scrollHeight / steps) * i;
      cmScroller.scrollTop = scrollPos;
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const lineCount = document.querySelectorAll('.cm-line').length;
      console.log(`📜 Step ${i}/${steps}: scroll=${scrollPos}, lines=${lineCount}`);
    }
    
    // Scroll back to top
    cmScroller.scrollTop = 0;
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Scroll to bottom one more time
    cmScroller.scrollTop = scrollHeight;
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Restore original position
    cmScroller.scrollTop = originalScrollTop;
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const finalLineCount = document.querySelectorAll('.cm-line').length;
    console.log('✅ Scroll complete, final line count:', finalLineCount);
    return true;
  }
  
  async function getEditorContent() {
    console.log('🔍 Getting editor content...');
    
    // Try to find GitHub's internal data structures
    // GitHub uses Primer ViewComponents and keeps data in various places
    
    // Method 1: Look for the textarea and check its attributes/data
    const allTextareas = document.querySelectorAll('textarea');
    console.log('🔍 Found', allTextareas.length, 'textareas total');
    for (let i = 0; i < allTextareas.length; i++) {
      const ta = allTextareas[i];
      console.log(`🔍 textarea[${i}]:`, 
        'value.length=', ta.value.length,
        'id=', ta.id, 
        'name=', ta.name,
        'style.display=', ta.style.display,
        'hidden=', ta.hidden
      );
      
      // Try to get value even if hidden
      if (ta.value && ta.value.length > 100) {
        console.log(`✅ Using textarea[${i}], length:`, ta.value.length);
        return { success: true, text: ta.value, method: 'textarea-' + i };
      }
      
      // Check if textarea has a linked editor
      const form = ta.closest('form');
      if (form) {
        console.log('🔍 Found form, checking for file-attachment');
        const fileAttachment = form.querySelector('file-attachment');
        if (fileAttachment) {
          console.log('🔍 file-attachment found');
        }
      }
    }
    
    // Method 2: Try file-editor component
    const fileEditor = document.querySelector('file-editor');
    console.log('🔍 file-editor:', fileEditor);
    if (fileEditor) {
      // Check all properties
      console.log('🔍 file-editor properties:', Object.keys(fileEditor));
      
      if (fileEditor.value !== undefined) {
        console.log('✅ Using file-editor.value, length:', fileEditor.value.length);
        return { success: true, text: fileEditor.value, method: 'file-editor' };
      }
      
      // Try common property names
      const props = ['value', '_value', 'content', '_content', 'text', '_text', 'model', '_model'];
      for (let prop of props) {
        if (fileEditor[prop]) {
          const val = fileEditor[prop];
          if (typeof val === 'string' && val.length > 100) {
            console.log(`✅ Using file-editor.${prop}, length:`, val.length);
            return { success: true, text: val, method: 'file-editor-' + prop };
          }
          if (val && val.value && typeof val.value === 'string' && val.value.length > 100) {
            console.log(`✅ Using file-editor.${prop}.value, length:`, val.value.length);
            return { success: true, text: val.value, method: 'file-editor-' + prop + '-value' };
          }
        }
      }
    }
    
    // Method 3: Try looking at the .cm-editor's React/internal state
    const cmEditor = document.querySelector('.cm-editor');
    if (cmEditor) {
      console.log('🔍 Checking .cm-editor for React fiber...');
      
      // Check for React fiber (starts with __reactFiber or __reactInternalInstance)
      for (let key in cmEditor) {
        if (key.startsWith('__react')) {
          console.log('🔍 Found React key:', key);
          // Don't try to access it - just log that it exists
        }
      }
    }
    
    // Method 4: Use clipboard API to get all content
    const cmContent = document.querySelector('.cm-content');
    if (cmContent) {
      console.log('🔍 Trying clipboard method...');
      try {
        // Focus and select all
        cmContent.focus();
        document.execCommand('selectAll');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Copy to clipboard
        const copied = document.execCommand('copy');
        if (copied) {
          // Read from clipboard
          const text = await navigator.clipboard.readText();
          console.log('✅ Using clipboard method, length:', text.length, 'lines:', text.split('\n').length);
          
          // Deselect
          window.getSelection().removeAllRanges();
          
          return { success: true, text: text, method: 'clipboard' };
        }
      } catch (e) {
        console.log('⚠️  Clipboard method failed:', e.message);
      }
    }
    
    // Try CodeMirror - get text from .cm-content directly
    console.log('🔍 .cm-content:', cmContent);
    if (cmContent) {
      // Force render all lines first
      await forceRenderAllLines();
      
      // Get all text content
      const lines = Array.from(cmContent.querySelectorAll('.cm-line'));
      console.log('🔍 Found', lines.length, '.cm-line elements');
      
      if (lines.length > 0) {
        const text = lines.map(line => line.textContent).join('\n');
        console.log('⚠️  Using .cm-line text (may be incomplete), length:', text.length, 'lines:', lines.length);
        return { success: true, text: text, method: 'cm-lines' };
      }
      
      // Fallback: use textContent of entire .cm-content
      const text = cmContent.textContent;
      if (text) {
        console.log('⚠️  Using .cm-content textContent (may be incomplete), length:', text.length);
        return { success: true, text: text, method: 'cm-textcontent' };
      }
    }
    
    // Try CodeMirror editor wrapper
    cmEditor = document.querySelector('.cm-editor');
    console.log('🔍 .cm-editor:', cmEditor);
    if (cmEditor) {
      // Try hidden textarea
      const textarea = cmEditor.querySelector('textarea');
      console.log('🔍 cm textarea:', textarea);
      if (textarea && textarea.value) {
        console.log('✅ Using cm-textarea, length:', textarea.value.length);
        return { success: true, text: textarea.value, method: 'cm-textarea' };
      }
    }
    
    // Try regular textarea
    const textarea = document.querySelector('textarea.js-code-textarea');
    console.log('🔍 textarea.js-code-textarea:', textarea);
    if (textarea) {
      console.log('✅ Using textarea, length:', textarea.value.length);
      return { success: true, text: textarea.value, method: 'textarea' };
    }
    
    console.log('❌ No editor method worked');
    return { success: false, error: 'No editor found' };
  }
  
  function setEditorContent(text) {
    console.log('📝 Setting editor content, length:', text.length);
    
    // Try file-editor first
    const fileEditor = document.querySelector('file-editor');
    if (fileEditor) {
      if (fileEditor.value !== undefined) {
        fileEditor.value = text;
        fileEditor.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('✅ Set via file-editor.value');
        return { success: true, method: 'file-editor' };
      }
      
      if (fileEditor._model) {
        fileEditor._model.value = text;
        fileEditor.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('✅ Set via file-editor._model');
        return { success: true, method: 'file-editor-model' };
      }
    }
    
    // For CodeMirror, we'll replace line by line
    const cmContent = document.querySelector('.cm-content');
    if (cmContent && cmContent.isContentEditable) {
      // Use execCommand to replace all content
      cmContent.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(cmContent);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand('delete', false);
      document.execCommand('insertText', false, text);
      console.log('✅ Set via cm-content execCommand');
      return { success: true, method: 'cm-execCommand' };
    }
    
    // Try regular textarea
    const textarea = document.querySelector('textarea.js-code-textarea');
    if (textarea) {
      textarea.value = text;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      console.log('✅ Set via textarea');
      return { success: true, method: 'textarea' };
    }
    
    console.log('❌ No set method worked');
    return { success: false, error: 'No editor found' };
  }
  
  // Listen for requests from content script
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    
    if (event.data.type === 'CITEORDER_GET_TEXT') {
      const result = await getEditorContent();
      window.postMessage({
        type: 'CITEORDER_TEXT_RESPONSE',
        requestId: event.data.requestId,
        ...result
      }, '*');
    } else if (event.data.type === 'CITEORDER_SET_TEXT') {
      const result = setEditorContent(event.data.text);
      window.postMessage({
        type: 'CITEORDER_SET_RESPONSE',
        requestId: event.data.requestId,
        ...result
      }, '*');
    }
  });
  
  console.log('🌉 Citeorder page bridge loaded');
})();

{/*
const script = document.createElement("script");
script.type = "module";
script.src = chrome.runtime.getURL("wasm/citeorder.js");
document.head.appendChild(script);
*/}

if (!window._citeorderLoaderInjected) {
  window._citeorderLoaderInjected = true;

  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("wasm/citeorder.js");
  script.onload = () => console.log("citeorder.js loaded");
  document.documentElement.appendChild(script);
}

let modulePromise = null;

{/*
async function getModule() {
  if (!modulePromise) {
    modulePromise = CiteorderModule({
      locateFile: (path) => chrome.runtime.getURL("wasm/" + path)
    });
  }
  return modulePromise;
}
*/}

{/*
function getEditor() {
  const textarea = document.querySelector(".js-code-textarea");
  if (textarea) {
    return { type: "textarea", el: textarea };
  }

  const cm = document.querySelector(".cm-content");
  if (cm && cm.cmView?.view) {
    return { type: "codemirror", view: cm.cmView.view };
  }

  return null;
}
*/}

{/*
function getEditor() {
  // Old textarea editor (still used in some places)
  const textarea = document.querySelector("textarea.js-code-textarea");
  if (textarea) {
    return { type: "textarea", el: textarea };
  }

  // GitHub CodeMirror 6 editor
  const cmEditor = document.querySelector(".cm-editor");
  if (cmEditor && cmEditor.CodeMirror) {
    return {
      type: "codemirror",
      view: cmEditor.CodeMirror
    };
  }

  return null;
}
*/}

{/*
function getEditor() {
  // 1. Old GitHub textarea editor (still used sometimes)
  const textarea = document.querySelector("textarea.js-code-textarea");
  if (textarea) {
    return {
      type: "textarea",
      get: () => textarea.value,
      set: (v) => (textarea.value = v)
    };
  }

  // 2. Modern GitHub CodeMirror editor
  const cmContent = document.querySelector(".cm-content");
  if (cmContent && cmContent.isContentEditable) {
    return {
      type: "contenteditable",
      get: () => cmContent.innerText,
      set: (v) => replaceContentEditable(cmContent, v)
    };
  }

  return null;
}
*/}
function getEditor() {
  const textarea = document.querySelector("textarea.js-code-textarea");
  if (textarea) return { get: () => textarea.value, set: (v) => (textarea.value = v) };

  const cm = document.querySelector(".cm-content");
  if (cm && cm.isContentEditable) return { get: () => cm.innerText, set: (v) => replaceContentEditable(cm, v) };

  return null;
}

{/*
function replaceContentEditable(el, text) {
  el.focus();

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  selection.removeAllRanges();
  selection.addRange(range);

  // This integrates with GitHub undo history
  document.execCommand("insertText", false, text);
}
*/}
function replaceContentEditable(el, text) {
  el.focus();
  document.execCommand("selectAll", false, null);
  document.execCommand("insertText", false, text);
}


{/*
function getModule() {
  if (!modulePromise) {
    modulePromise = new Promise((resolve) => {
      const check = () => {
        if (typeof window.CiteorderModule === "function") {
          window.CiteorderModule({
            locateFile: (path) =>
              chrome.runtime.getURL("wasm/" + path)
          }).then(resolve);
        } else {
          setTimeout(check, 30);
        }
      };
      check();
    });
  }
  return modulePromise;
}
*/}

function getModule() {
  if (!modulePromise) {
    modulePromise = CiteorderModule({
      locateFile: (path) => chrome.runtime.getURL("wasm/" + path)
    });
    console.log("WASM module instantiating...");
  }
  return modulePromise;
}

function isMarkdownEditor() {
  return document.querySelector(".js-code-textarea, .cm-content");
}

{/*
function injectToolbar() {
  if (document.getElementById("citeorder-toolbar")) return;

  const editor = isMarkdownEditor();
  if (!editor) return;

  const toolbar = document.createElement("div");
  toolbar.id = "citeorder-toolbar";
  toolbar.innerHTML = `
    <button id="citeorder-run">Citeorder</button>
    <label><input type="checkbox" id="cite-q"> relaxed-quotes</label>
    <label><input type="checkbox" id="cite-d"> relaxed-duplicates</label>
  `;
  editor.parentElement.prepend(toolbar);

  document.getElementById("citeorder-run").onclick = runCiteorder;
  
  console.log("Toolbar injected");
}
*/}

{/*
function injectToolbar() {
  if (document.getElementById("citeorder-toolbar")) return;
  const editor = getEditor();
  if (!editor) return;

  const toolbar = document.createElement("div");
  toolbar.id = "citeorder-toolbar";
  toolbar.innerHTML = `
    <button id="citeorder-run">Citeorder</button>
    <label><input type="checkbox" id="cite-q"> relaxed-quotes</label>
    <label><input type="checkbox" id="cite-d"> relaxed-duplicates</label>
  `;
  editor.getParent?.()?.prepend(toolbar) || editor.setParent?.(toolbar);

  document.getElementById("citeorder-run").onclick = runCiteorder;
  console.log("Toolbar injected");
}
*/}

function injectToolbar() {
  const editor = getEditor();
  if (!editor) return; // editor not ready yet

  if (document.getElementById("citeorder-toolbar")) return; // already injected

  const toolbar = document.createElement("div");
  toolbar.id = "citeorder-toolbar";
  toolbar.innerHTML = `
    <button id="citeorder-run">Citeorder</button>
    <label><input type="checkbox" id="cite-q"> relaxed-quotes</label>
    <label><input type="checkbox" id="cite-d"> relaxed-duplicates</label>
  `;

  // prepend to a valid parent
  if (editor.type === "textarea") {
    editor.getParent?.()?.prepend(toolbar);
  } else if (editor.type === "contenteditable") {
    editor.getParent?.()?.prepend(toolbar);
  } else {
    console.warn("No valid parent for toolbar");
    return;
  }

  // make sure button exists before assigning
  const btn = document.getElementById("citeorder-run");
  if (btn) btn.onclick = runCiteorder;

  console.log("Toolbar injected");
}

{/*
function injectWasmLoader() {
  if (document.getElementById("citeorder-wasm-loader")) return;

  const s = document.createElement("script");
  s.id = "citeorder-wasm-loader";
  s.src = chrome.runtime.getURL("wasm/page-wasm.js");
  document.documentElement.appendChild(s);
}

injectWasmLoader();
*/}

{/*
async function runCiteorder() {
  const editor =
    document.querySelector(".js-code-textarea") ||
    document.querySelector(".cm-content");

  const text = editor.value || editor.innerText;

  const relaxedQuotes = document.getElementById("cite-q").checked;
  const relaxedDuplicates = document.getElementById("cite-d").checked;

  const Module = await getModule();

  let stdout = "";
  let stderr = "";

  Module.print = (t) => (stdout += t + "\n");
  Module.printErr = (t) => (stderr += t + "\n");

  Module.FS.writeFile("README.md", text);

  const args = ["citeorder"];
  if (relaxedQuotes) args.push("-q");
  if (relaxedDuplicates) args.push("-d");
  args.push("README.md");

  Module.callMain(args);

  try {
    const output = Module.FS.readFile("README-fixed.md", { encoding: "utf8" });
    if (editor.value !== undefined) {
      editor.value = output;
    } else {
      editor.innerText = output;
    }
  } catch {
    alert(stderr || stdout || "No changes required.");
  }
}
*/}

{/*
async function runCiteorder() {
  const editor = getEditor();
  if (!editor) {
    alert("GitHub editor not detected");
    return;
  }

  const text =
    editor.type === "textarea"
      ? editor.el.value
      : editor.view.state.doc.toString();

  const relaxedQuotes = document.getElementById("cite-q").checked;
  const relaxedDuplicates = document.getElementById("cite-d").checked;

  const Module = await getModule();

  let stdout = "";
  let stderr = "";

  Module.print = (t) => (stdout += t + "\n");
  Module.printErr = (t) => (stderr += t + "\n");

  Module.FS.writeFile("README.md", text);

  const args = ["citeorder"];
  if (relaxedQuotes) args.push("-q");
  if (relaxedDuplicates) args.push("-d");
  args.push("README.md");

  Module.callMain(args);

  let output;
  try {
    output = Module.FS.readFile("README-fixed.md", { encoding: "utf8" });
  } catch {
    alert(stderr || stdout || "No changes required.");
    return;
  }

  // Apply output correctly
  if (editor.type === "textarea") {
    editor.el.value = output;
    editor.el.dispatchEvent(new Event("input", { bubbles: true }));
  } else {
    editor.view.dispatch({
      changes: {
        from: 0,
        to: editor.view.state.doc.length,
        insert: output
      }
    });
  }
}
*/}

{/*
async function runCiteorder() {
  console.log("Citeorder button clicked");
  
  const editor = getEditor();
  if (!editor) {
    alert("GitHub editor not detected");
    return;
  }

  const text = editor.get();

  const relaxedQuotes = document.getElementById("cite-q").checked;
  const relaxedDuplicates = document.getElementById("cite-d").checked;

  const Module = await getModule();

  let stdout = "";
  let stderr = "";

  Module.print = (t) => (stdout += t + "\n");
  Module.printErr = (t) => (stderr += t + "\n");

  Module.FS.writeFile("README.md", text);

  const args = ["citeorder"];
  if (relaxedQuotes) args.push("-q");
  if (relaxedDuplicates) args.push("-d");
  args.push("README.md");

  Module.callMain(args);

  console.log("citeorder stdout:", stdout);
  console.log("citeorder stderr:", stderr);
  console.log("FS contents:", Module.FS.readdir("/"));

  try {
    const output = Module.FS.readFile("README-fixed.md", { encoding: "utf8" });
    editor.set(output);
  } catch {
    alert(stderr || stdout || "No changes required.");
  }
}
*/}

{/*
async function runCiteorder() {
  console.log("Citeorder button clicked");

  const Module = await getModule();
  console.log("WASM module resolved:", Module);
}
*/}

{/*
function runCiteorder() {
  const editor =
    document.querySelector(".cm-content") ||
    document.querySelector("textarea");

  if (!editor) {
    alert("GitHub editor not detected");
    return;
  }

  const text = editor.value ?? editor.innerText;

  const flags = [];
  if (document.getElementById("cite-q").checked) flags.push("-q");
  if (document.getElementById("cite-d").checked) flags.push("-d");

  window.postMessage(
    { type: "CITEORDER_RUN", text, flags },
    "*"
  );
}
*/}

{/*
async function runCiteorder() {
  const editor = getEditor();
  if (!editor) {
    alert("GitHub editor not detected");
    return;  // ✅ now valid, because inside a function
  }

  const editorText = editor.get(); // get current content

  const flags = [];
  if (document.getElementById("cite-q").checked) flags.push("-q");
  if (document.getElementById("cite-d").checked) flags.push("-d");

  // Send text to WASM
  window.postMessage({ type: "CITEORDER_RUN", text: editorText, flags: flags }, "*");

  // Listen for result
  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    if (e.data?.type === "CITEORDER_RESULT") {
      editor.set(e.data.output);
    }
  });
}
*/}
async function runCiteorder() {
  console.log("Citeorder button clicked");

  const editor = getEditor();
  if (!editor) return alert("GitHub editor not detected");

  const text = editor.get();
  const relaxedQuotes = document.getElementById("cite-q").checked;
  const relaxedDuplicates = document.getElementById("cite-d").checked;

  const Module = await getModule();
  console.log("WASM module ready");

  Module.print = (t) => console.log("stdout:", t);
  Module.printErr = (t) => console.error("stderr:", t);

  Module.FS.writeFile("README.md", text);

  const args = ["citeorder"];
  if (relaxedQuotes) args.push("-q");
  if (relaxedDuplicates) args.push("-d");
  args.push("README.md");

  Module.callMain(args);

  try {
    const output = Module.FS.readFile("README-fixed.md", { encoding: "utf8" });
    editor.set(output);
  } catch {
    alert("No changes made or error occurred.");
  }
}




const observer = new MutationObserver(injectToolbar);
observer.observe(document.body, { childList: true, subtree: true });


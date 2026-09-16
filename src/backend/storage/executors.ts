/**
 * Vault Execution Engine.
 * Turns stored payloads into live processes inside the browser sandbox:
 *   - HTML/CSS/JS apps & games  → bundled and run in an isolated iframe
 *   - JavaScript                → Web Worker with a piped console
 *   - Python                    → Pyodide runtime (loaded on demand)
 *   - PDF                       → embedded native viewer
 *   - ZIP archives              → real listing, extraction and app launch
 * Everything runs client-side; nothing is ever uploaded anywhere.
 */

import type { VaultFile } from '../types';
import { getPayload } from './indexedDB';
import { isVaultFileAuthorized, isVaultFileLocked } from './crypto';
import { readZipEntries, extractZipEntry, unzipAll } from './zip';

export type RunnerKind = 'web-app' | 'javascript' | 'python' | 'pdf' | 'archive';

export function detectRunner(file: VaultFile): RunnerKind | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf' || file.mime === 'application/pdf') return 'pdf';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || file.kind === 'archive') return 'archive';
  if (ext === 'html' || ext === 'htm' || file.mime === 'text/html') return 'web-app';
  if (ext === 'js' || ext === 'mjs' || file.mime === 'text/javascript' || file.mime === 'application/javascript') return 'javascript';
  if (ext === 'py' || file.mime === 'text/x-python') return 'python';
  return null;
}

export function canExecute(file: VaultFile): boolean {
  return detectRunner(file) !== null;
}

/** Materializes the real bytes behind a vault file (OPFS/IndexedDB payload, inline content or data URL). */
export async function resolveBlob(file: VaultFile): Promise<Blob | null> {
  if (file.payloadMissing) return null;
  if (isVaultFileLocked(file) && !isVaultFileAuthorized(file.id)) return null;
  if (file.payloadRef) {
    try {
      return await getPayload(file.payloadRef);
    } catch {
      return null;
    }
  }
  if (file.content) {
    if (file.content.startsWith('data:')) {
      try {
        const res = await fetch(file.content);
        return await res.blob();
      } catch { return null; }
    }
    return new Blob([file.content], { type: file.mime || 'text/plain' });
  }
  return null;
}

/* ------------------------- web app bundler ------------------------- */

const VAULT_APP_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' blob:",
  "script-src-attr 'none'",
  "style-src 'unsafe-inline' blob:",
  'img-src data: blob:',
  'media-src data: blob:',
  'font-src data: blob:',
  "connect-src 'none'",
  'worker-src blob:',
  "child-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function normPath(p: string): string {
  const parts: string[] = [];
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

function resolveRef(ref: string, baseDir: string): string {
  const clean = ref.split('?')[0].split('#')[0];
  if (/^[a-z]+:/i.test(clean) || clean.startsWith('//')) return '';
  return baseDir ? normPath(`${baseDir}/${clean}`) : normPath(clean);
}

/**
 * Builds a self-contained blob URL for an HTML app: every relative src/href
 * that matches a sibling vault payload is rewritten to a live blob URL, and
 * an import map lets ES modules find their sibling scripts.
 */
export async function bundleWebApp(entry: Blob, siblings: Map<string, Blob>): Promise<string> {
  let html: string;
  try {
    html = await entry.text();
  } catch {
    throw new Error('could not read web app payload');
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const urlMap = new Map<string, string>();
  const objUrl = (key: string, blob: Blob) => {
    if (!urlMap.has(key)) urlMap.set(key, URL.createObjectURL(blob));
    return urlMap.get(key)!;
  };

  const rewrite = (el: Element, attr: string, baseDir: string) => {
    const ref = el.getAttribute(attr);
    if (!ref) return;
    const resolved = resolveRef(ref, baseDir);
    if (!resolved) {
      el.removeAttribute(attr);
      return;
    }
    const blob = siblings.get(resolved) ?? siblings.get(normPath(resolved).split('/').pop() ?? '');
    if (blob) el.setAttribute(attr, objUrl(resolved, blob));
    else el.removeAttribute(attr);
  };

  const baseEl = doc.querySelector('base[href]');
  const baseDir = baseEl ? resolveRef(baseEl.getAttribute('href')!, '') : '';
  if (baseEl && !baseDir) baseEl.remove();

  const csp = doc.createElement('meta');
  csp.httpEquiv = 'Content-Security-Policy';
  csp.content = VAULT_APP_CSP;
  doc.head.prepend(csp);

  doc.querySelectorAll('[src]').forEach((el) => rewrite(el, 'src', baseDir));
  doc.querySelectorAll('link[href], a[href], embed[href]').forEach((el) => rewrite(el, 'href', baseDir));

  /* import map so ES-module apps can `import x from './lib.js'` */
  const scriptTags = Array.from(doc.querySelectorAll('script[type="module"][src]'));
  const modules = new Map<string, string>();
  siblings.forEach((blob, path) => {
    if (/\.(m?js|cjs)$/i.test(path)) modules.set(path, objUrl(path, blob));
  });
  if (modules.size && scriptTags.length) {
    const im = doc.createElement('script');
    im.type = 'importmap';
    const imports: Record<string, string> = {};
    modules.forEach((url, path) => {
      imports[`./${path.split('/').pop()}`] = url;
      imports[path] = url;
    });
    im.textContent = JSON.stringify({ imports });
    doc.head.prepend(im);
  }

  return URL.createObjectURL(new Blob([`<!DOCTYPE html>\n${doc.documentElement.outerHTML}`], { type: 'text/html' }));
}

/** Finds the best entry HTML inside an extracted archive ('index.html' preferred, shallowest wins). */
export function pickAppEntry(paths: string[]): string | null {
  const files = paths.filter((p) => /\.html?$/i.test(p));
  if (!files.length) return null;
  const index = files.filter((p) => /(^|\/)index\.html?$/i.test(p));
  const pool = index.length ? index : files;
  return pool.sort((a, b) => a.split('/').length - b.split('/').length)[0];
}

/* ------------------------- javascript worker ------------------------- */

export interface JsRunHandle {
  worker: Worker;
  stop: () => void;
}

export type LogSink = (line: string, level: 'info' | 'warn' | 'error') => void;

const WORKER_SHIM = `
const __send = (lvl, args) => self.postMessage({ __vault: true, level: lvl, text: args.map(a => {
  try { return typeof a === 'string' ? a : JSON.stringify(a); } catch { return String(a); }
}).join(' ') });
self.console = {
  log:   (...a) => __send('info', a),  info:  (...a) => __send('info', a),
  debug: (...a) => __send('info', a),  warn:  (...a) => __send('warn', a),
  error: (...a) => __send('error', a), table: (...a) => __send('info', a),
};
self.onerror = (m) => { self.postMessage({ __vault: true, level: 'error', text: 'uncaught: ' + m }); return false; };
self.onunhandledrejection = (e) => self.postMessage({ __vault: true, level: 'error', text: 'unhandled rejection: ' + e.reason });
`;

/** Runs a JS payload in a dedicated Web Worker; returns a handle to terminate it. */
export function runJavaScript(code: string, onLog: LogSink): JsRunHandle {
  const blob = new Blob([WORKER_SHIM, '\n', code], { type: 'text/javascript' });
  const workerUrl = URL.createObjectURL(blob);
  const worker = new Worker(workerUrl);
  URL.revokeObjectURL(workerUrl);
  worker.onmessage = (e: MessageEvent) => {
    if (e.data && e.data.__vault) onLog(e.data.text, e.data.level);
    else onLog(typeof e.data === 'string' ? e.data : JSON.stringify(e.data), 'info');
  };
  worker.onerror = (e) => onLog(`worker fault: ${e.message}`, 'error');
  return { worker, stop: () => worker.terminate() };
}

/* ------------------------- python (pyodide) ------------------------- */

const PYODIDE_VERSION = 'v0.26.4';
const PYODIDE_WORKER_SOURCE = `
let __pyodidePromise = null;
let __pyodide = null;
self.onmessage = async (event) => {
  if (!event.data || event.data.type !== 'run') return;
  const base = event.data.base;
  try {
    if (!__pyodidePromise) {
      self.postMessage({ type: 'status', text: 'fetching python runtime (pyodide) · first boot downloads ~10 MB…' });
      importScripts(base + 'pyodide.js');
      if (typeof self.loadPyodide !== 'function') throw new Error('pyodide loader unavailable');
      __pyodidePromise = self.loadPyodide({ indexURL: base });
      __pyodide = await __pyodidePromise;
      __pyodide.setStdout({ batched: (s) => self.postMessage({ type: 'log', level: 'info', text: s }) });
      __pyodide.setStderr({ batched: (s) => self.postMessage({ type: 'log', level: 'warn', text: s }) });
      self.postMessage({ type: 'status', text: 'python runtime online · CPython 3.12 (terminable worker)' });
    } else {
      await __pyodidePromise;
      self.postMessage({ type: 'status', text: 'python runtime warm · reusing the active terminable session' });
    }
    await __pyodide.runPythonAsync(event.data.code);
    self.postMessage({ type: 'done' });
  } catch (error) {
    self.postMessage({ type: 'log', level: 'error', text: String(error) });
    self.postMessage({ type: 'done' });
  }
};
`;

export interface PythonRunHandle {
  promise: Promise<void>;
  stop: () => void;
}

let pythonSessionWorker: Worker | null = null;
let pythonSessionBusy = false;

/** Runs Python in a reusable, explicitly terminable worker session. */
export function runPython(code: string, onLog: LogSink): PythonRunHandle {
  if (pythonSessionBusy) {
    onLog('python session is already running; wait for it to finish or terminate it', 'warn');
    return { promise: Promise.resolve(), stop: () => undefined };
  }

  const workerUrl = pythonSessionWorker
    ? null
    : URL.createObjectURL(new Blob([PYODIDE_WORKER_SOURCE], { type: 'text/javascript' }));
  const worker = pythonSessionWorker ?? new Worker(workerUrl!);
  if (workerUrl) URL.revokeObjectURL(workerUrl);
  pythonSessionWorker = worker;
  pythonSessionBusy = true;

  const base = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`;
  let settled = false;
  let resolveRun!: () => void;
  const promise = new Promise<void>((resolve) => { resolveRun = resolve; });
  const finish = (terminate = false) => {
    if (settled) return;
    settled = true;
    pythonSessionBusy = false;
    if (terminate) {
      worker.terminate();
      if (pythonSessionWorker === worker) pythonSessionWorker = null;
    }
    resolveRun();
  };

  worker.onmessage = (event: MessageEvent) => {
    const data = event.data as { type?: string; text?: string; level?: 'info' | 'warn' | 'error' };
    if (data.type === 'done') finish();
    else if (data.text) onLog(data.text, data.level ?? 'info');
  };
  worker.onerror = (event) => {
    onLog(`python worker fault: ${event.message}`, 'error');
    finish(true);
  };
  worker.postMessage({ type: 'run', code, base });

  return {
    promise,
    stop: () => {
      if (settled) return;
      onLog('python worker terminated by operator', 'info');
      finish(true);
    },
  };
}

/* ------------------------- archive helpers ------------------------- */

export { readZipEntries, extractZipEntry, unzipAll };

export async function readArchiveListing(blob: Blob): Promise<import('./zip').ZipEntry[]> {
  const buf = await blob.arrayBuffer();
  return readZipEntries(buf);
}

/** Extracts one entry as a Blob (for download or import into the vault). */
export async function extractArchiveEntry(blob: Blob, entry: import('./zip').ZipEntry): Promise<Blob> {
  const buf = await blob.arrayBuffer();
  return extractZipEntry(buf, entry);
}

/* ------------------------- engine bridge ------------------------- */

/** Signals the 3D universe that the Vault was used — the black hole reacts. */
export function pulseVault(intensity = 1): void {
  try {
    window.dispatchEvent(new CustomEvent('eventide-vault-pulse', { detail: { intensity } }));
  } catch { /* engine not mounted — harmless */ }
}

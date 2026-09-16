/**
 * Dual Storage Engine: Desktop FS (Tauri) → OPFS → IndexedDB fallback.
 * Payload bytes are encrypted before they are written to any tier.
 * Legacy raw payloads are accepted for migration and re-sealed on authenticated read.
 */

import { desktopPayloads } from '../../desktop/adapter';

const DB_NAME = 'eventide-universe';
const STORE = 'payloads';
let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open database'));
  });
  return dbPromise;
}

/** Check if Origin Private File System (OPFS) is available in current browser */
export function hasOpfs(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.storage && typeof navigator.storage.getDirectory === 'function';
}

async function getOpfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (!hasOpfs()) return null;
  try {
    return await navigator.storage.getDirectory();
  } catch {
    return null;
  }
}

async function writeStoredPayload(id: string, stored: Blob): Promise<void> {
  /* Desktop tier first: real files in the OS app-data dir, no quota. */
  const desktopDone = await desktopPayloads.put(id, new Uint8Array(await stored.arrayBuffer()));
  if (desktopDone) return;

  const root = await getOpfsRoot();
  if (root) {
    try {
      const fileHandle = await root.getFileHandle(`payload-${id}.bin`, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(stored);
      await writable.close();
      return;
    } catch {
      // Fallback to IndexedDB if OPFS write fails.
    }
  }

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(stored, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB put payload failed'));
  });
}

async function readStoredPayload(id: string): Promise<Blob | null> {
  /* Desktop tier first. */
  const desktopBytes = await desktopPayloads.get(id);
  if (desktopBytes) return new Blob([desktopBytes.slice().buffer as ArrayBuffer]);

  const root = await getOpfsRoot();
  if (root) {
    try {
      const fileHandle = await root.getFileHandle(`payload-${id}.bin`);
      return await fileHandle.getFile();
    } catch {
      // Fallback to IndexedDB if OPFS read fails or file is not in OPFS.
    }
  }

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(tx.error ?? new Error('IndexedDB get payload failed'));
  });
}

/** Read the exact bytes stored under a payload ref, without decrypting them. */
export async function getStoredPayload(id: string): Promise<Blob | null> {
  return readStoredPayload(id);
}

/** Write an already-stored payload envelope without encrypting it again. */
export async function putStoredPayload(id: string, stored: Blob): Promise<void> {
  await writeStoredPayload(id, stored);
}

export async function putPayload(id: string, blob: Blob): Promise<void> {
  const { encryptPayload } = await import('./crypto');
  await putStoredPayload(id, await encryptPayload(blob));
}

export async function getPayload(id: string): Promise<Blob | null> {
  const stored = await readStoredPayload(id);
  if (!stored) return null;

  const { decryptPayload, encryptPayload, hasPayloadEnvelope, hasPayloadSession } = await import('./crypto');
  const raw = new Uint8Array(await stored.arrayBuffer());
  const payload = await decryptPayload(stored);
  if (hasPayloadSession() && !hasPayloadEnvelope(raw)) {
    try {
      await putStoredPayload(id, await encryptPayload(payload));
    } catch {
      // Keep the legacy bytes readable if migration cannot be completed.
    }
  }
  return payload;
}

/**
 * Local-first, non-vault payload helpers used for diary media.
 * Diary attachments are not vault secrets, so they use the same durable
 * OPFS/IndexedDB bytes path without the vault payload envelope. The ref is
 * stored in metadata and old inline data URLs remain valid fallbacks.
 */
export async function putLocalPayload(id: string, blob: Blob): Promise<void> {
  await writeStoredPayload(id, blob);
}

export async function getLocalPayload(id: string): Promise<Blob | null> {
  return readStoredPayload(id);
}

export async function delLocalPayload(id: string): Promise<void> {
  await delPayload(id);
}

export async function delPayload(id: string): Promise<void> {
  /* Desktop tier first (ignore absence). */
  await desktopPayloads.delete(id);

  const root = await getOpfsRoot();
  if (root) {
    try {
      await root.removeEntry(`payload-${id}.bin`);
    } catch {
      // Ignore missing entry error in OPFS
    }
  }

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete payload failed'));
  });
}

/** Returns true when the browser environment supports IndexedDB storage */
export function hasIdb(): boolean {
  return typeof indexedDB !== 'undefined';
}


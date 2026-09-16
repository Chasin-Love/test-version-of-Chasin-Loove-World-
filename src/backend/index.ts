/**
 * MY UNIVERSE — CORE BACKEND ARCHITECTURE
 *
 * The single facade over the sovereign backend. Everything outside `backend/`
 * imports from here — never from a deep path:
 *  1. Virtual Filesystem (EFS) — copy-on-write inodes, snapshots, SHA-256 scrubbing
 *  2. Triple-Tier Persistence — Desktop FS (Tauri) → OPFS → IndexedDB
 *  3. Cryptographic Armor — PBKDF2 key derivation & AES-GCM 256-bit encryption
 *  4. Universal Execution Engine — ISO 9660, Web Apps, Pyodide, Workers, ZIP
 *  5. Domain Contracts — types, runner kinds, backend status
 */

// Master types
export * from './types';

// Storage & Filesystem
export * from './storage/efs';
export * from './storage/indexedDB';
export * from './storage/crypto';
export * from './storage/zip';
export * from './storage/formatters';
export * from './storage/metrics';
export * from './storage/procedural';
export * from './storage/sanitizeHtml';
export * from './storage/seeds';

// Universal Execution Engine
export * from './executors';
export * from './executors/isoExecutor';

import { hasOpfs, hasIdb } from './storage/indexedDB';
import type { BackendStatus } from './types';

/**
 * Returns real-time health and capabilities of the backend engine
 */
export function getBackendStatus(): BackendStatus {
  return {
    version: '2.0.0-PRO',
    hasOpfs: hasOpfs(),
    hasIndexedDb: hasIdb(),
    activeExecutors: ['iso', 'web-app', 'javascript', 'python', 'pdf', 'archive'],
    filesystemMounted: true,
  };
}

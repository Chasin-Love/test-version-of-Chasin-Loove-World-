/**
 * BACKEND ARCHITECTURE & TYPE SYSTEM
 * Defines the core contracts for:
 *  - EFS (Eventide Virtual Filesystem & Inodes)
 *  - Dual-Tier Storage (OPFS & IndexedDB)
 *  - Cryptographic Armor (PBKDF2, AES-GCM)
 *  - Universal Execution Engine (Web, Worker, Python, PDF, Archive, ISO 9660)
 *  - Planetary Diary Linkage Engine
 */

import type { VaultFile } from '../types';

export * from '../types';

export type RunnerKind = 'web-app' | 'javascript' | 'python' | 'pdf' | 'archive' | 'iso';

export interface BackendStatus {
  version: string;
  hasOpfs: boolean;
  hasIndexedDb: boolean;
  activeExecutors: RunnerKind[];
  filesystemMounted: boolean;
}

/* -------------------- ISO 9660 Disc Image Types -------------------- */

export interface IsoDirectoryRecord {
  name: string;
  isDirectory: boolean;
  size: number;
  lba: number; // Logical Block Address
  date: Date;
  flags: number;
  children?: IsoDirectoryRecord[];
}

export interface IsoVolumeDescriptor {
  standardIdentifier: string; // Should be "CD001"
  volumeIdentifier: string;
  systemIdentifier: string;
  volumeSpaceSize: number;
  logicalBlockSize: number;
  rootDirectory: IsoDirectoryRecord;
}

export interface IsoParseResult {
  valid: boolean;
  error?: string;
  descriptor?: IsoVolumeDescriptor;
  files: IsoDirectoryRecord[];
}

/* -------------------- Execution Contracts -------------------- */

export interface ExecutionContext {
  file: VaultFile;
  blob: Blob;
  runnerKind: RunnerKind;
}

export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  pid?: number;
  timestamp: number;
}

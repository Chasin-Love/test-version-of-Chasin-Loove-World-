/**
 * ISO 9660 Universal Disc Image Execution & Mount Engine
 * 
 * Capable of parsing and executing ISO images (CD/DVD .iso disc files)
 * directly in-memory within the client-side sandbox.
 * 
 * Specifications:
 * - Sector size: 2048 bytes
 * - Primary Volume Descriptor (PVD) at Sector 16 (Offset 0x8000 / 32768)
 * - Traverses Directory Records (Root and nested subdirectories)
 * - Resolves LBA (Logical Block Addresses) to extract file slices
 */

import type { IsoDirectoryRecord, IsoParseResult, IsoVolumeDescriptor } from '../types';

const SECTOR_SIZE = 2048;
const PVD_SECTOR = 16;
const PVD_OFFSET = PVD_SECTOR * SECTOR_SIZE;

/** Helper to read a string from an ArrayBuffer slice */
function readAscii(view: DataView, offset: number, length: number): string {
  let str = '';
  for (let i = 0; i < length; i++) {
    const code = view.getUint8(offset + i);
    if (code === 0) break;
    str += String.fromCharCode(code);
  }
  return str.trim();
}

/** Helper to read 32-bit integer (little endian) */
function readUint32LE(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

/** Helper to read 16-bit integer (little endian) */
function readUint16LE(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

/** Parse an ISO 9660 Directory Record at a given byte offset */
function parseDirectoryRecord(view: DataView, offset: number): { record: IsoDirectoryRecord | null; nextOffset: number } {
  if (offset >= view.byteLength) {
    return { record: null, nextOffset: offset };
  }

  const length = view.getUint8(offset);
  if (length === 0) {
    // End of directory entries in this sector or padding
    return { record: null, nextOffset: offset + 1 };
  }

  const extendedAttrLen = view.getUint8(offset + 1);
  const lba = readUint32LE(view, offset + 2);
  const size = readUint32LE(view, offset + 10);

  // Date/time: 7 bytes (year since 1900, month 1-12, day 1-31, hour 0-23, min 0-59, sec 0-59, gmt offset)
  const year = 1900 + view.getUint8(offset + 18);
  const month = Math.max(0, view.getUint8(offset + 19) - 1);
  const day = view.getUint8(offset + 20);
  const hour = view.getUint8(offset + 21);
  const min = view.getUint8(offset + 22);
  const sec = view.getUint8(offset + 23);
  const date = new Date(Date.UTC(year, month, day, hour, min, sec));

  const flags = view.getUint8(offset + 25);
  const isDirectory = (flags & 0x02) !== 0;

  const nameLen = view.getUint8(offset + 32);
  let name = '';
  if (nameLen === 1 && view.getUint8(offset + 33) === 0) {
    name = '.';
  } else if (nameLen === 1 && view.getUint8(offset + 33) === 1) {
    name = '..';
  } else {
    name = readAscii(view, offset + 33, nameLen);
    // Strip ISO 9660 version suffix (e.g. "README.TXT;1" -> "README.TXT")
    const semiIdx = name.indexOf(';');
    if (semiIdx !== -1) {
      name = name.substring(0, semiIdx);
    }
  }

  const record: IsoDirectoryRecord = {
    name,
    isDirectory,
    size,
    lba,
    date,
    flags,
  };

  return { record, nextOffset: offset + length };
}

/** Recursively read directory entries from an ISO ArrayBuffer */
function readDirectoryEntries(
  buffer: ArrayBuffer,
  lba: number,
  totalBytes: number,
  maxDepth = 5
): IsoDirectoryRecord[] {
  if (maxDepth <= 0) return [];
  const entries: IsoDirectoryRecord[] = [];
  const startOffset = lba * SECTOR_SIZE;
  const endOffset = Math.min(buffer.byteLength, startOffset + totalBytes);
  const view = new DataView(buffer);

  let currentOffset = startOffset;
  while (currentOffset < endOffset) {
    // Directory records cannot cross sector boundaries
    const sectorEnd = (Math.floor(currentOffset / SECTOR_SIZE) + 1) * SECTOR_SIZE;
    if (currentOffset >= sectorEnd) {
      currentOffset = sectorEnd;
      continue;
    }

    const { record, nextOffset } = parseDirectoryRecord(view, currentOffset);
    if (!record) {
      // Advance to next sector boundary
      currentOffset = sectorEnd;
      continue;
    }

    currentOffset = nextOffset;

    // Skip self and parent references
    if (record.name === '.' || record.name === '..') {
      continue;
    }

    if (record.isDirectory) {
      // Recursively read sub-directory contents
      record.children = readDirectoryEntries(buffer, record.lba, record.size, maxDepth - 1);
    }

    entries.push(record);
  }

  return entries;
}

/** Flatten a directory tree into a list of all records with full paths */
export function flattenIsoRecords(
  records: IsoDirectoryRecord[],
  prefix = ''
): { record: IsoDirectoryRecord; path: string }[] {
  const result: { record: IsoDirectoryRecord; path: string }[] = [];
  for (const rec of records) {
    const fullPath = prefix ? `${prefix}/${rec.name}` : rec.name;
    result.push({ record: rec, path: fullPath });
    if (rec.children && rec.children.length > 0) {
      result.push(...flattenIsoRecords(rec.children, fullPath));
    }
  }
  return result;
}

/**
 * Main parser: Parses an ISO 9660 disc image file blob
 */
export async function parseIsoBlob(blob: Blob): Promise<IsoParseResult> {
  try {
    // Read at least up to sector 17 to get the Primary Volume Descriptor
    const pvdSlice = await blob.slice(PVD_OFFSET, PVD_OFFSET + SECTOR_SIZE).arrayBuffer();
    if (pvdSlice.byteLength < SECTOR_SIZE) {
      return { valid: false, error: 'ISO file too small to contain a Primary Volume Descriptor.', files: [] };
    }

    const view = new DataView(pvdSlice);
    const type = view.getUint8(0);
    const id = readAscii(view, 1, 5);

    if (id !== 'CD001') {
      return { valid: false, error: `Invalid disc image identifier: expected CD001, got "${id}".`, files: [] };
    }

    if (type !== 1) {
      return { valid: false, error: `Unsupported volume descriptor type: ${type}. Expected Primary Volume Descriptor (1).`, files: [] };
    }

    const systemIdentifier = readAscii(view, 8, 32);
    const volumeIdentifier = readAscii(view, 40, 32);
    const volumeSpaceSize = readUint32LE(view, 80);
    const logicalBlockSize = readUint16LE(view, 128) || SECTOR_SIZE;

    // Root directory record is located at byte offset 156 in the PVD
    const rootDirOffset = 156;
    const { record: rootRecord } = parseDirectoryRecord(view, rootDirOffset);

    if (!rootRecord) {
      return { valid: false, error: 'Failed to parse Root Directory Record from Primary Volume Descriptor.', files: [] };
    }

    const descriptor: IsoVolumeDescriptor = {
      standardIdentifier: id,
      volumeIdentifier: volumeIdentifier || 'UNTITLED_DISC',
      systemIdentifier: systemIdentifier || 'GENERIC_ISO',
      volumeSpaceSize,
      logicalBlockSize,
      rootDirectory: rootRecord,
    };

    // To read the full directory table, we load the directory sectors
    // Read entire buffer if under 80MB, or read directory sectors selectively
    const buffer = await blob.arrayBuffer();
    const files = readDirectoryEntries(buffer, rootRecord.lba, rootRecord.size);

    return {
      valid: true,
      descriptor,
      files,
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Unknown error during ISO parsing',
      files: [],
    };
  }
}

/**
 * Extracts raw file bytes from an ISO blob for a given directory record
 */
export async function extractIsoFile(blob: Blob, record: IsoDirectoryRecord): Promise<Blob> {
  const startByte = record.lba * SECTOR_SIZE;
  const endByte = startByte + record.size;
  const slice = blob.slice(startByte, endByte);

  // Guess MIME type from file extension
  const ext = record.name.split('.').pop()?.toLowerCase() ?? '';
  let mime = 'application/octet-stream';
  if (['txt', 'log', 'cfg', 'inf', 'ini', 'md'].includes(ext)) mime = 'text/plain';
  else if (['htm', 'html'].includes(ext)) mime = 'text/html';
  else if (['js', 'mjs'].includes(ext)) mime = 'text/javascript';
  else if (['json'].includes(ext)) mime = 'application/json';
  else if (['png'].includes(ext)) mime = 'image/png';
  else if (['jpg', 'jpeg'].includes(ext)) mime = 'image/jpeg';
  else if (['gif'].includes(ext)) mime = 'image/gif';
  else if (['mp3'].includes(ext)) mime = 'audio/mpeg';
  else if (['wav'].includes(ext)) mime = 'audio/wav';
  else if (['mp4'].includes(ext)) mime = 'video/mp4';
  else if (['pdf'].includes(ext)) mime = 'application/pdf';

  return new Blob([slice], { type: mime });
}

/**
 * Dependency-free ZIP archive reader.
 * Parses the central directory directly and inflates entries with the native
 * DecompressionStream API, so the Vault can inspect & extract real archives
 * without shipping any third-party library.
 */

export interface ZipEntry {
  path: string;          /* full path inside the archive, '/'-separated */
  name: string;          /* basename only */
  dir: boolean;
  size: number;          /* uncompressed size in bytes */
  compressedSize: number;
  method: number;        /* 0 = stored, 8 = deflate */
  localOffset: number;   /* offset of the local file header */
}

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;

function findEocd(view: DataView): number {
  /* EOCD is at most 22 bytes + 64KB of trailing comment */
  const min = Math.max(0, view.byteLength - 22 - 65535);
  for (let i = view.byteLength - 22; i >= min; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) return i;
  }
  return -1;
}

/** Lists every entry in a zip archive. Throws on malformed / unsupported archives. */
export function readZipEntries(buffer: ArrayBuffer): ZipEntry[] {
  const view = new DataView(buffer);
  const eocd = findEocd(view);
  if (eocd < 0) throw new Error('not a zip archive (no end-of-central-directory record)');
  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);

  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(ptr, true) !== CD_SIG) break;
    const method = view.getUint16(ptr + 10, true);
    const compressedSize = view.getUint32(ptr + 20, true);
    const size = view.getUint32(ptr + 24, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const bytes = new Uint8Array(buffer, ptr + 46, nameLen);
    const path = new TextDecoder().decode(bytes);
    if (method === 0 || method === 8) {
      const dir = path.endsWith('/');
      entries.push({
        path,
        name: path.split('/').filter(Boolean).pop() ?? path,
        dir,
        size,
        compressedSize,
        method,
        localOffset,
      });
    }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Inflates a single entry into a Blob. */
export async function extractZipEntry(buffer: ArrayBuffer, entry: ZipEntry): Promise<Blob> {
  const view = new DataView(buffer);
  if (view.getUint32(entry.localOffset, true) !== LFH_SIG) throw new Error(`corrupt local header for ${entry.path}`);
  const nameLen = view.getUint16(entry.localOffset + 26, true);
  const extraLen = view.getUint16(entry.localOffset + 28, true);
  const dataStart = entry.localOffset + 30 + nameLen + extraLen;
  const raw = new Uint8Array(buffer, dataStart, entry.compressedSize);

  if (entry.method === 0) {
    return new Blob([raw.slice().buffer]);
  }
  /* deflate — stream through the native DecompressionStream */
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([raw]).stream().pipeThrough(ds);
  return await new Response(stream).blob();
}

export interface ExtractedFile {
  path: string;
  blob: Blob;
}

/** Extracts every stored file (directories skipped) from an archive. */
export async function unzipAll(
  buffer: ArrayBuffer,
  onProgress?: (done: number, total: number, path: string) => void,
  totalBudgetBytes = 256 * 1024 * 1024,
): Promise<ExtractedFile[]> {
  const entries = readZipEntries(buffer).filter((e) => !e.dir);
  const budget = entries.reduce((a, e) => a + e.size, 0);
  if (budget > totalBudgetBytes) throw new Error(`archive inflates to ${(budget / 1048576).toFixed(0)} MB — over the ${(totalBudgetBytes / 1048576).toFixed(0)} MB safety budget`);
  const out: ExtractedFile[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    onProgress?.(i, entries.length, e.path);
    out.push({ path: e.path, blob: await extractZipEntry(buffer, e) });
  }
  return out;
}

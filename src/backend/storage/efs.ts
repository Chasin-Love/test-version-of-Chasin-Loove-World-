/**
 * EFS — the Eventide Filesystem.
 * A copy-on-write hierarchical filesystem built for the Universal Vault.
 *
 * Design (our own, btrfs-class capabilities, no borrowed code):
 *  • The tree is an inode-style table (`nodes`) with parent pointers —
 *    directories are first-class nodes with ids, not path strings.
 *  • File payloads never live in the tree. They are immutable,
 *    id-addressed bytes in OPFS/IndexedDB (`payloadRef`). Two tree entries
 *    pointing at the same payload id share extents for free — that makes
 *    snapshots true copy-on-write (metadata-only freeze) and directory
 *    forks zero-copy.
 *  • `Shadows` freeze the whole tree at a generation. Restoring swaps the
 *    live tree for the frozen one; a safety shadow is taken first, so
 *    rollback is always reversible.
 *  • `Fork` deep-clones a directory subtree instantly: new nodes, same
 *    payload ids (the VaultFile clone carries `dedupOf` → the source's
 *    payloadRef), so a 2 GB folder forks in 0 allocated bytes.
 *  • `Scrub` re-reads every payload, recomputes sha-256 and compares with
 *    the stored `checksum` — real bit-rot detection.
 *  • `Dedup` finds identical payloads by checksum and collapses them to
 *    one shared extent.
 */

import type {
  EfsScrubReport,
  UniverseState,
  VaultFile,
  VfsNode,
  VfsShadow,
  VfsState,
} from '../types';

export const EFS_ROOT = 'vfs-root';

let idCounter = 0;
export function efsId(prefix = 'n'): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function createVfs(): VfsState {
  const root: VfsNode = {
    id: EFS_ROOT,
    type: 'dir',
    name: 'vault',
    parentId: null,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  };
  return {
    rootId: EFS_ROOT,
    nodes: { [EFS_ROOT]: root },
    super: {
      uuid: efsId('efs'),
      label: 'eventide-efs',
      createdAt: Date.now(),
      generation: 1,
      dedupBytes: 0,
    },
    shadows: [],
  };
}

/* ------------------------------ tree reads ------------------------------ */

export function efsChildren(vfs: VfsState, dirId: string): { dirs: VfsNode[]; fileIds: string[] } {
  const dirs: VfsNode[] = [];
  const fileIds: string[] = [];
  for (const id of Object.keys(vfs.nodes)) {
    const n = vfs.nodes[id];
    if (n.parentId !== dirId) continue;
    if (n.type === 'dir') dirs.push(n);
    else fileIds.push(n.id);
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  return { dirs, fileIds };
}

/** Directory node holding a file (defaults to root). */
export function efsDirOf(vfs: VfsState, file: VaultFile): VfsNode {
  return vfs.nodes[file.dirId ?? EFS_ROOT] ?? vfs.nodes[EFS_ROOT];
}

export function efsNodeOf(vfs: VfsState, file: VaultFile): VfsNode | null {
  for (const id of Object.keys(vfs.nodes)) {
    const n = vfs.nodes[id];
    if (n.type === 'file' && n.fileId === file.id) return n;
  }
  return null;
}

/** Ancestors from root → dir, for breadcrumbs. */
export function efsPath(vfs: VfsState, dirId: string): VfsNode[] {
  const chain: VfsNode[] = [];
  let cur: VfsNode | undefined = vfs.nodes[dirId];
  let guard = 0;
  while (cur && guard++ < 64) {
    chain.unshift(cur);
    cur = cur.parentId ? vfs.nodes[cur.parentId] : undefined;
  }
  return chain;
}

export function efsPathString(vfs: VfsState, dirId: string): string {
  const chain = efsPath(vfs, dirId);
  return '/' + chain.slice(1).map((n) => n.name).join('/');
}

/** Is `candidate` inside `dir`'s subtree (or equal to it)? Cycle guard for moves. */
export function efsIsDescendant(vfs: VfsState, candidateId: string, dirId: string): boolean {
  if (candidateId === dirId) return true;
  let cur: VfsNode | undefined = vfs.nodes[candidateId];
  let guard = 0;
  while (cur?.parentId && guard++ < 64) {
    if (cur.parentId === dirId) return true;
    cur = vfs.nodes[cur.parentId];
  }
  return false;
}

export function efsUniqueName(vfs: VfsState, parentId: string, base: string): string {
  const siblings = new Set<string>();
  for (const id of Object.keys(vfs.nodes)) {
    if (vfs.nodes[id].parentId === parentId) siblings.add(vfs.nodes[id].name.toLowerCase());
  }
  if (!siblings.has(base.toLowerCase())) return base;
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '';
  for (let i = 2; i < 999; i++) {
    const candidate = `${stem} (${i})${ext}`;
    if (!siblings.has(candidate.toLowerCase())) return candidate;
  }
  return `${stem}-${Date.now().toString(36)}${ext}`;
}

export function efsSubtreeIds(vfs: VfsState, dirId: string): { dirIds: string[]; fileIds: string[] } {
  const dirIds: string[] = [];
  const fileIds: string[] = [];
  const walk = (id: string) => {
    const { dirs, fileIds: fids } = efsChildren(vfs, id);
    dirIds.push(id);
    dirs.forEach((d) => walk(d.id));
    fids.forEach((f) => fileIds.push(f));
  };
  if (vfs.nodes[dirId]) walk(dirId);
  return { dirIds, fileIds };
}

/** Registers a file's tree node under a parent directory. */
export function efsAddFileNode(vfs: VfsState, fileId: string, parentId: string, name: string): VfsNode {
  const node: VfsNode = {
    id: efsId('file'),
    type: 'file',
    name: efsUniqueName(vfs, parentId, name),
    parentId: vfs.nodes[parentId] ? parentId : EFS_ROOT,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    fileId,
  };
  vfs.nodes[node.id] = node;
  efsBump(vfs);
  return node;
}

/* ------------------------------ tree writes ----------------------------- */

export function efsBump(vfs: VfsState): void {
  vfs.super.generation += 1;
}

export function efsMkdir(vfs: VfsState, parentId: string, name: string, color?: string): VfsNode {
  const node: VfsNode = {
    id: efsId('dir'),
    type: 'dir',
    name: efsUniqueName(vfs, parentId, name.trim() || 'folder'),
    parentId,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    color,
  };
  vfs.nodes[node.id] = node;
  if (vfs.nodes[parentId]) vfs.nodes[parentId].modifiedAt = Date.now();
  efsBump(vfs);
  return node;
}

export function efsRename(vfs: VfsState, nodeId: string, name: string): boolean {
  const n = vfs.nodes[nodeId];
  const clean = name.trim();
  if (!n || !clean || clean.includes('/')) return false;
  const taken = Object.values(vfs.nodes).some(
    (o) => o.parentId === n.parentId && o.id !== nodeId && o.name.toLowerCase() === clean.toLowerCase()
  );
  if (taken) return false;
  n.name = clean;
  n.modifiedAt = Date.now();
  efsBump(vfs);
  return true;
}

export function efsMove(vfs: VfsState, nodeIds: string[], destDirId: string): number {
  if (!vfs.nodes[destDirId] || vfs.nodes[destDirId].type !== 'dir') return 0;
  let moved = 0;
  for (const id of nodeIds) {
    const n = vfs.nodes[id];
    if (!n || n.id === EFS_ROOT) continue;
    if (n.type === 'dir' && (id === destDirId || efsIsDescendant(vfs, destDirId, id))) continue;
    if (n.parentId === destDirId) continue;
    n.name = efsUniqueName(vfs, destDirId, n.name);
    n.parentId = destDirId;
    n.modifiedAt = Date.now();
    moved += 1;
  }
  if (moved) efsBump(vfs);
  return moved;
}

/** Builds a frozen metadata tree for shadows — payload ids preserved, inline content dropped. */
function freezeTree(nodes: Record<string, VfsNode>): Record<string, VfsNode> {
  const out: Record<string, VfsNode> = {};
  for (const id of Object.keys(nodes)) {
    const n = nodes[id];
    out[id] = { ...n, tags: n.tags ? [...n.tags] : undefined };
  }
  return out;
}

export function efsCreateShadow(vfs: VfsState, files: VaultFile[], name: string, description?: string): VfsShadow {
  const dirIds = Object.values(vfs.nodes).filter((n) => n.type === 'dir').length;
  const fileNodes = Object.values(vfs.nodes).filter((n) => n.type === 'file');
  const bytesByfileId = new Map(files.map((f) => [f.id, f.size]));
  const shadow: VfsShadow = {
    id: efsId('shadow'),
    name: name.trim() || `shadow-gen-${vfs.super.generation}`,
    description,
    createdAt: Date.now(),
    generation: vfs.super.generation,
    dirCount: dirIds,
    fileCount: fileNodes.length,
    bytes: fileNodes.reduce((a, n) => a + (bytesByfileId.get(n.fileId ?? '') ?? 0), 0),
    tree: freezeTree(vfs.nodes),
  };
  vfs.shadows = [shadow, ...vfs.shadows].slice(0, 24);
  efsBump(vfs);
  return shadow;
}

export function efsDeleteShadow(vfs: VfsState, shadowId: string): void {
  vfs.shadows = vfs.shadows.filter((s) => s.id !== shadowId);
  efsBump(vfs);
}

/* ------------------------- dedup (shared extents) ------------------------ */

export interface DedupReport { groups: number; collapsed: number; savedBytes: number; }

/** Groups files by checksum and marks duplicates to share the first file's payload. */
export function efsDedup(vault: VaultFile[]): DedupReport {
  const byHash = new Map<string, VaultFile>();
  let collapsed = 0;
  let saved = 0;
  for (const f of vault) {
    if (!f.checksum) continue;
    if (f.dedupOf) continue;
    const first = byHash.get(f.checksum);
    if (first && (first.payloadRef || first.id)) {
      /* share the source's extent for real: point the duplicate's payload at
         the source's bytes so only ONE copy lives in OPFS/IndexedDB */
      if (first.payloadRef && f.payloadRef && f.payloadRef !== first.payloadRef) {
        f.payloadRef = first.payloadRef;
      }
      f.dedupOf = first.dedupOf ?? first.id;
      collapsed += 1;
      saved += f.size;
    } else {
      byHash.set(f.checksum, f);
    }
  }
  return { groups: byHash.size, collapsed, savedBytes: saved };
}

/** True when any OTHER live vault record still references this payload. */
export function efsPayloadShared(vault: VaultFile[], file: VaultFile): boolean {
  if (!file.payloadRef) return false;
  return vault.some((o) => o.id !== file.id && (
    o.payloadRef === file.payloadRef ||
    o.dedupOf === file.id ||
    (file.dedupOf !== undefined && o.dedupOf === file.dedupOf)
  ));
}

/**
 * Re-attaches vault records whose tree node went missing (crashed migration,
 * imported snapshot, restore edge case). Guarantees every file in `vault` is
 * reachable in the tree — this is why the File Manager always shows
 * everything the Everything tab shows.
 */
export function efsHeal(vfs: VfsState, vault: VaultFile[]): number {
  const nodeByFileId = new Map<string, VfsNode>();
  Object.values(vfs.nodes).forEach((n) => {
    if (n.type === 'file' && n.fileId) nodeByFileId.set(n.fileId, n);
  });
  let healed = 0;
  for (const f of vault) {
    const existing = nodeByFileId.get(f.id);
    if (existing) {
      /* repair drifted metadata */
      if (existing.name !== f.name) existing.name = f.name;
      if (f.dirId && vfs.nodes[f.dirId]?.type === 'dir') {
        if (existing.parentId !== f.dirId) existing.parentId = f.dirId;
      } else if (!existing.parentId || !vfs.nodes[existing.parentId]) {
        existing.parentId = EFS_ROOT;
        f.dirId = EFS_ROOT;
      } else {
        f.dirId = existing.parentId;
      }
      continue;
    }
    let parent = f.dirId && vfs.nodes[f.dirId]?.type === 'dir' ? f.dirId : undefined;
    if (!parent && f.dirId) {
      // Resolve path-based dirId (e.g. '/documents/logs') to node ID
      const norm = ('/' + f.dirId.replace(/^\/+/, '')).toLowerCase();
      const match = Object.values(vfs.nodes).find(
        (n) => n.type === 'dir' && efsPathString(vfs, n.id).toLowerCase() === norm
      );
      if (match) parent = match.id;
    }
    if (!parent) parent = EFS_ROOT;
    f.dirId = parent;
    efsAddFileNode(vfs, f.id, parent, f.name);
    healed += 1;
  }
  if (healed) efsBump(vfs);
  return healed;
}

/* -------------------------------- scrub --------------------------------- */

const enc = new TextEncoder();

async function sha256HexBuf(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function efsChecksumOf(file: VaultFile, getPayload: (id: string) => Promise<Blob | null>): Promise<string | undefined> {
  try {
    if (file.payloadRef) {
      const blob = await getPayload(file.payloadRef);
      if (!blob) return undefined;
      return await sha256HexBuf(new Uint8Array(await blob.arrayBuffer()));
    }
    if (typeof file.content === 'string') return await sha256HexBuf(enc.encode(file.content));
  } catch { return undefined; }
  return undefined;
}

export interface ScrubProgress { done: number; total: number; current: string; }

/**
 * Verifies every file's payload against its stored checksum (computing it
 * when missing). Inline-content mismatches are repaired from the newest
 * version snapshot when one exists.
 */
export async function efsScrub(
  vault: VaultFile[],
  getPayload: (id: string) => Promise<Blob | null>,
  onProgress?: (p: ScrubProgress) => void,
): Promise<EfsScrubReport> {
  const report: EfsScrubReport = {
    startedAt: Date.now(),
    filesScanned: 0,
    bytesScanned: 0,
    errorsFound: 0,
    errorsCorrected: 0,
    status: 'running',
    log: [],
  };
  const targets = vault.filter((f) => f.payloadRef || typeof f.content === 'string');
  for (let i = 0; i < targets.length; i++) {
    const f = targets[i];
    onProgress?.({ done: i, total: targets.length, current: f.name });
    report.filesScanned += 1;
    report.bytesScanned += f.size;
    const actual = await efsChecksumOf(f, getPayload);
    if (actual === undefined) {
      report.errorsFound += 1;
      report.log?.push(`MISSING PAYLOAD · ${f.name}`);
      continue;
    }
    if (!f.checksum) {
      f.checksum = actual; /* first sealing of the checksum */
      continue;
    }
    if (f.checksum !== actual) {
      report.errorsFound += 1;
      /* try to repair inline payloads from the newest version snapshot */
      const v = (f.versions ?? []).filter((x) => typeof x.content === 'string').slice(-1)[0];
      if (typeof f.content === 'string' && v?.content) {
        const repaired: VaultFile = { ...f, content: v.content };
        const repairedSum = await efsChecksumOf(repaired, getPayload);
        if (repairedSum) {
          f.content = v.content;
          f.checksum = repairedSum;
          report.errorsCorrected += 1;
          report.log?.push(`REPAIRED from version snapshot · ${f.name}`);
          continue;
        }
      }
      report.log?.push(`CHECKSUM MISMATCH · ${f.name} (expected ${f.checksum.slice(0, 12)}…, got ${actual.slice(0, 12)}…)`);
    }
  }
  onProgress?.({ done: targets.length, total: targets.length, current: '' });
  report.finishedAt = Date.now();
  report.status = report.errorsFound === 0 ? 'clean' : report.errorsCorrected === report.errorsFound ? 'repaired' : 'corrupted';
  return report;
}

/* ------------------------- legacy path migration ------------------------ */

/** Old flat model (folder strings) → EFS tree. Idempotent. */
export function migrateLegacyVault(state: UniverseState): void {
  if (state.efs && Object.keys(state.efs.nodes).length) return;
  const vfs = createVfs();
  const dirByPath = new Map<string, string>([['/', EFS_ROOT]]);

  const ensureDir = (path: string): string => {
    const p = path.replace(/\/+/g, '/');
    if (dirByPath.has(p)) return dirByPath.get(p)!;
    const parts = p.split('/').filter(Boolean);
    let parentId = EFS_ROOT;
    let acc = '';
    for (const part of parts) {
      acc += `/${part}`;
      if (dirByPath.has(acc)) { parentId = dirByPath.get(acc)!; continue; }
      const node: VfsNode = {
        id: efsId('dir'),
        type: 'dir',
        name: part,
        parentId,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };
      vfs.nodes[node.id] = node;
      dirByPath.set(acc, node.id);
      parentId = node.id;
    }
    return parentId;
  };

  const legacyFolders: string[] = (state as unknown as { vaultFolders?: string[] }).vaultFolders ?? [];
  legacyFolders.forEach(ensureDir);
  state.vault.forEach((f) => {
    /* already attached (e.g. partially migrated) — keep it */
    if (f.dirId && vfs.nodes[f.dirId]) {
      delete (f as unknown as { folder?: string }).folder;
      return;
    }
    const legacy = (f as unknown as { folder?: string }).folder ?? '/';
    f.dirId = ensureDir(legacy || '/');
    delete (f as unknown as { folder?: string }).folder;
  });

  efsHeal(vfs, state.vault);
  state.efs = vfs;
  state.version = 3;
}

/** Builds a starter tree for fresh seeds: the home folders of the vault. */
export function seedVfs(vfs: VfsState, folders: string[]): Map<string, string> {
  const byPath = new Map<string, string>([['/', EFS_ROOT]]);
  for (const path of folders) {
    const parts = path.split('/').filter(Boolean);
    let parentId = EFS_ROOT;
    let acc = '';
    for (const part of parts) {
      acc += `/${part}`;
      if (byPath.has(acc)) { parentId = byPath.get(acc)!; continue; }
      const node = efsMkdir(vfs, parentId, part);
      byPath.set(acc, node.id);
      parentId = node.id;
    }
  }
  return byPath;
}

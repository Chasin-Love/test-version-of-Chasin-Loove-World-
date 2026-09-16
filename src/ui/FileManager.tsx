/**
 * EFS File Manager — the advanced explorer for the Eventide Filesystem.
 *
 * Features:
 *  • real directory tree (sidebar) with expand/collapse, colors, per-node menus
 *  • breadcrumb navigation + recursive vault-wide search
 *  • multi-select (click / ctrl / shift / marquee), grid + list views, sorting
 *  • drag & drop: internal moves (rows ↔ tree), external file import into any dir
 *  • clipboard cut/copy/paste — copy is a zero-copy CoW fork (shared extents)
 *  • inline rename, trash with restore, pins, tags, dir colors
 *  • inspector rail: checksums, payload mode, dedup source, versions
 *  • engine dock: shadows (CoW snapshots), scrub (bit-rot check), dedup scan,
 *    superblock generation readout
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { actions } from '../state';
import {
  fmtBytes, fmtDate,
  efsChildren, efsPath, efsPathString, efsSubtreeIds, EFS_ROOT,
} from '../backend';
import type { TrashedFile, VaultFile, VfsNode } from '../types';
import { IcClose, IcCopy, IcDownload, IcEdit, IcFolder, IcLock, IcPlus, IcScan, IcSearch, IcTrash, useUniverse } from './bits';
import { toast } from './toast';
import { KindGlyph, TilePreview } from './VaultBits';

type SortKey = 'name' | 'kind' | 'size' | 'date';
type CtxMenu = { x: number; y: number; nodeId: string } | null;

const DIR_COLORS = ['', '#6fc2b4', '#7fc4e8', '#b49ae8', '#f2c178', '#e0785a', '#9fd8a8'];

export function FileManager({ onOpen, onImport, onLock }: {
  onOpen: (f: VaultFile) => void;
  onImport: (files: FileList | null, destDirId: string) => void;
  onLock: (f: VaultFile) => void;
}) {
  const state = useUniverse();
  const vfs = state.efs;

  const [cwdId, setCwdId] = useState(EFS_ROOT);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([EFS_ROOT]));
  const [sel, setSel] = useState<Set<string>>(() => new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [clip, setClip] = useState<{ mode: 'copy' | 'cut'; nodeIds: string[] } | null>(null);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null);
  const [ctx, setCtx] = useState<CtxMenu>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [dock, setDock] = useState(false);
  const [shadowName, setShadowName] = useState('');
  const [scrub, setScrub] = useState<{ done: number; total: number; current: string } | null>(null);
  const [dedupInfo, setDedupInfo] = useState<string>('');
  const [showInspector, setShowInspector] = useState(true);
  const [flat, setFlat] = useState(false); /* include all subdirectory files */
  const [treeOpen, setTreeOpen] = useState(true); /* collapsible locations rail */
  const [dragArm, setDragArm] = useState<string | null>(null); /* only the pressed row is draggable */
  const uploadRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const marquee = useRef<{ x0: number; y0: number; on: boolean } | null>(null);
  const [mqRect, setMqRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  /* ------------------------------ data -------------------------------- */

  /* Ensure any files in vault are always registered as tree nodes */
  useEffect(() => {
    let missing = false;
    for (const f of state.vault) {
      if (!Object.values(vfs.nodes).some((n) => n.type === 'file' && n.fileId === f.id)) {
        missing = true;
        break;
      }
    }
    if (missing) {
      actions.efsHealVault();
    }
  }, [state.vault, vfs.nodes]);

  /* one pass over the tree per render tick — O(n) instead of O(n²) */
  const childrenMap = useMemo(() => {
    const m = new Map<string, { dirs: VfsNode[]; fileIds: string[] }>();
    for (const id of Object.keys(vfs.nodes)) {
      const n = vfs.nodes[id];
      if (!n.parentId) continue;
      let bucket = m.get(n.parentId);
      if (!bucket) { bucket = { dirs: [], fileIds: [] }; m.set(n.parentId, bucket); }
      if (n.type === 'dir') bucket.dirs.push(n);
      else bucket.fileIds.push(n.id);
    }
    m.forEach((b) => b.dirs.sort((a, z) => a.name.localeCompare(z.name)));
    return m;
  }, [vfs.nodes]);

  const kidsOf = (dirId: string) => {
    const bucket = childrenMap.get(dirId) ?? { dirs: [] as VfsNode[], fileIds: [] as string[] };
    const knownFileIds = new Set(bucket.fileIds.map((nid) => vfs.nodes[nid]?.fileId).filter(Boolean));
    let extraCount = 0;
    for (const f of state.vault) {
      const p = f.dirId ?? EFS_ROOT;
      if (p === dirId && !knownFileIds.has(f.id)) {
        extraCount++;
      }
    }
    return {
      dirs: bucket.dirs,
      fileIds: bucket.fileIds,
      totalCount: bucket.dirs.length + bucket.fileIds.length + extraCount,
    };
  };

  const fileById = useMemo(() => {
    const m = new Map<string, VaultFile>();
    state.vault.forEach((f) => m.set(f.id, f));
    return m;
  }, [state.vault]);

  const fileNodeById = useMemo(() => {
    const m = new Map<string, VfsNode>();
    Object.values(vfs.nodes).forEach((n) => { if (n.type === 'file' && n.fileId) m.set(n.fileId, n); });
    return m;
  }, [vfs.nodes]);

  const activeFiles = useMemo(() => state.vault, [state.vault]);

  const cwd = vfs.nodes[cwdId] ?? vfs.nodes[EFS_ROOT];
  const breadcrumb = useMemo(() => efsPath(vfs, cwdId), [vfs, cwdId]);

  const cwdDirs = useMemo(() => kidsOf(cwdId).dirs, [childrenMap, cwdId]);
  const cwdFiles = useMemo(() => {
    if (!flat) {
      const seen = new Set<string>();
      const list: VaultFile[] = [];
      kidsOf(cwdId).fileIds.forEach((nid) => {
        const f = fileById.get(vfs.nodes[nid]?.fileId ?? '');
        if (f && !seen.has(f.id)) {
          seen.add(f.id);
          list.push(f);
        }
      });
      state.vault.forEach((f) => {
        const parent = f.dirId ?? EFS_ROOT;
        if (parent === cwdId && !seen.has(f.id)) {
          seen.add(f.id);
          list.push(f);
        }
      });
      return list;
    }
    /* flat mode: every file under this directory, at any depth */
    const out: VaultFile[] = [];
    const seen = new Set<string>();
    const walk = (dirId: string, guard: number) => {
      if (guard > 32) return;
      const bucket = kidsOf(dirId);
      bucket.dirs.forEach((d) => walk(d.id, guard + 1));
      bucket.fileIds.forEach((fid) => {
        const f = fileById.get(vfs.nodes[fid]?.fileId ?? '');
        if (f && !seen.has(f.id)) {
          seen.add(f.id);
          out.push(f);
        }
      });
    };
    walk(cwdId, 0);
    if (cwdId === EFS_ROOT && out.length < state.vault.length) {
      state.vault.forEach((f) => {
        if (!seen.has(f.id)) {
          seen.add(f.id);
          out.push(f);
        }
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childrenMap, cwdId, flat, fileById, vfs.nodes, state.vault]);

  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const hits: { node: VfsNode; file: VaultFile | null }[] = [];
    Object.values(vfs.nodes).forEach((n) => {
      if (n.id === EFS_ROOT) return;
      if (n.type === 'dir') {
        if (n.name.toLowerCase().includes(q)) hits.push({ node: n, file: null });
        return;
      }
      const f = n.fileId ? state.vault.find((x) => x.id === n.fileId) : null;
      if (!f) return;
      if (f.name.toLowerCase().includes(q) || f.kind.includes(q) || (n.tags ?? []).some((t) => t.toLowerCase().includes(q))) {
        hits.push({ node: n, file: f });
      }
    });
    return hits.slice(0, 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, vfs.nodes, state.vault]);

  const sortedDirs = useMemo(() => {
    const arr = [...cwdDirs];
    if (sortKey === 'name' || sortKey === 'kind') arr.sort((a, b) => a.name.localeCompare(b.name) * sortDir);
    else arr.sort((a, b) => a.modifiedAt - b.modifiedAt * sortDir);
    return [...arr.filter((d) => d.pinned), ...arr.filter((d) => !d.pinned)];
  }, [cwdDirs, sortKey, sortDir]);

  const sortedFiles = useMemo(() => {
    const arr = [...cwdFiles];
    arr.sort((a, b) => {
      let r = 0;
      if (sortKey === 'name') r = a.name.localeCompare(b.name);
      else if (sortKey === 'kind') r = a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name);
      else if (sortKey === 'size') r = a.size - b.size;
      else r = a.addedAt - b.addedAt;
      return r * sortDir;
    });
    return arr;
  }, [cwdFiles, sortKey, sortDir]);

  const selNodes = useMemo(() => [...sel].map((id) => vfs.nodes[id]).filter(Boolean), [sel, vfs.nodes]);
  const singleNode = sel.size === 1 ? vfs.nodes[[...sel][0]] : null;
  const singleFile = singleNode?.fileId ? fileById.get(singleNode.fileId) ?? null : null;

  const dirBytes = useMemo(() => {
    if (!singleNode || singleNode.type !== 'dir') return 0;
    const { fileIds } = efsSubtreeIds(vfs, singleNode.id);
    let total = 0;
    fileIds.forEach((fid) => {
      const n = vfs.nodes[fid];
      const f = n?.fileId ? state.vault.find((x) => x.id === n.fileId) : null;
      if (f) total += f.size;
    });
    return total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleNode, vfs.nodes, state.vault]);

  /* ---------------------------- navigation ----------------------------- */

  const enter = (dirId: string) => {
    if (!vfs.nodes[dirId] || vfs.nodes[dirId].type !== 'dir') return;
    setCwdId(dirId);
    setSel(new Set());
    setAnchorId(null);
    setQuery('');
    setTrashOpen(false);
    setExpanded((prev) => {
      const n = new Set(prev);
      let cur: VfsNode | undefined = vfs.nodes[dirId];
      let guard = 0;
      while (cur && guard++ < 64) { n.add(cur.id); cur = cur.parentId ? vfs.nodes[cur.parentId] : undefined; }
      return n;
    });
  };

  const goUp = () => {
    if (cwd.parentId) enter(cwd.parentId);
  };

  /* ----------------------------- selection ------------------------------ */

  const visibleIds = useMemo(() => [
    ...sortedDirs.map((d) => d.id),
    ...sortedFiles.map((f) => fileNodeById.get(f.id)?.id ?? '').filter(Boolean),
  ], [sortedDirs, sortedFiles, fileNodeById]);

  const select = (nodeId: string, e: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) => {
    if (e.shiftKey && anchorId) {
      const ai = visibleIds.indexOf(anchorId);
      const ti = visibleIds.indexOf(nodeId);
      if (ai >= 0 && ti >= 0) {
        const [lo, hi] = ai < ti ? [ai, ti] : [ti, ai];
        setSel(new Set(visibleIds.slice(lo, hi + 1)));
        return;
      }
    }
    if (e.ctrlKey || e.metaKey) {
      setSel((prev) => {
        const n = new Set(prev);
        if (n.has(nodeId)) n.delete(nodeId); else n.add(nodeId);
        return n;
      });
    } else {
      setSel(new Set([nodeId]));
    }
    setAnchorId(nodeId);
  };

  /* ------------------------------ actions ------------------------------- */

  const commitRename = () => {
    if (!renaming) return;
    const { id, draft } = renaming;
    const node = vfs.nodes[id];
    if (draft.trim() && node && draft.trim() !== node.name) {
      if (!actions.efsRenameNode(id, draft)) toast('that name is taken here', 'warn');
    }
    setRenaming(null);
  };

  const trashSelection = () => {
    if (!sel.size) return;
    actions.efsTrash([...sel]);
    setSel(new Set());
    toast('matter moved to the void');
  };

  const paste = (destId?: string) => {
    if (!clip) return;
    const dest = destId ?? cwdId;
    if (clip.mode === 'cut') {
      const n = actions.efsMoveNodes(clip.nodeIds, dest);
      if (n) toast(`moved ${n} object${n === 1 ? '' : 's'}`);
      setClip(null);
    } else {
      const made = actions.efsCopyNodes(clip.nodeIds, dest);
      if (made.length) toast(`forked ${made.length} object${made.length === 1 ? '' : 's'} · shared extents, 0 bytes allocated`);
    }
  };

  const startScrub = async () => {
    setScrub({ done: 0, total: activeFiles.length, current: '' });
    const report = await actions.efsRunScrub((p) => setScrub({ done: p.done, total: p.total, current: p.current }));
    setScrub(null);
    toast(`scrub ${report.status} · ${report.filesScanned} files · ${report.errorsFound} errors`);
  };

  const runDedup = () => {
    const rep = actions.efsRunDedup();
    setDedupInfo(rep.collapsed ? `${rep.collapsed} duplicates share extents · ${fmtBytes(rep.savedBytes)} saved` : 'no duplicates — every extent is unique');
    setTimeout(() => setDedupInfo(''), 6000);
  };

  /* --------------------------- drag & drop ------------------------------ */

  /* Rows are only draggable while their press is armed — a plain click never
     starts a native drag gesture, which is what made clicks feel dead. */
  const armDrag = (nodeId: string) => setDragArm(nodeId);
  const disarmDrag = () => setDragArm(null);

  const onRowDragStart = (e: React.DragEvent, nodeId: string) => {
    const ids = sel.has(nodeId) ? [...sel] : [nodeId];
    if (!sel.has(nodeId)) setSel(new Set([nodeId]));
    e.dataTransfer.setData('text/efs', JSON.stringify({ nodeIds: ids }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const acceptDrop = (destDirId: string) => (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDropTarget(null);
    const raw = e.dataTransfer.getData('text/efs');
    if (raw) {
      try {
        const { nodeIds } = JSON.parse(raw) as { nodeIds: string[] };
        const moved = actions.efsMoveNodes(nodeIds, destDirId);
        if (moved) toast(`moved ${moved} into ${vfs.nodes[destDirId]?.name ?? 'vault'}`);
      } catch { /* ignore */ }
      return;
    }
    if (e.dataTransfer.files?.length) onImport(e.dataTransfer.files, destDirId);
  };

  /* ------------------------------ marquee ------------------------------- */

  const onListMouseDown = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.mq) return;
    if (e.button !== 0) return;
    marquee.current = { x0: e.clientX, y0: e.clientY, on: true };
    if (!e.ctrlKey && !e.shiftKey) { setSel(new Set()); setAnchorId(null); }
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const m = marquee.current;
      const host = listRef.current;
      if (!m?.on || !host) return;
      const rect = host.getBoundingClientRect();
      const x1 = e.clientX; const y1 = e.clientY;
      setMqRect({ x0: m.x0, y0: m.y0, x1, y1 });
      const lo = { x: Math.min(m.x0, x1) - rect.left + host.scrollLeft, y: Math.min(m.y0, y1) - rect.top + host.scrollTop };
      const hi = { x: Math.max(m.x0, x1) - rect.left + host.scrollLeft, y: Math.max(m.y0, y1) - rect.top + host.scrollTop };
      const next = new Set<string>();
      host.querySelectorAll<HTMLElement>('[data-node-id]').forEach((el) => {
        const r = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
        if (r.x < hi.x && r.x + r.w > lo.x && r.y < hi.y && r.y + r.h > lo.y) next.add(el.dataset.nodeId!);
      });
      setSel(next);
    };
    const up = () => { marquee.current = null; setMqRect(null); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  /* ----------------------------- keyboard ------------------------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Delete' && sel.size) { e.preventDefault(); trashSelection(); }
      else if (e.key === 'F2' && singleNode) { e.preventDefault(); setRenaming({ id: singleNode.id, draft: singleNode.name }); }
      else if (e.key === 'F5') { e.preventDefault(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault(); setSel(new Set(visibleIds));
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && sel.size) {
        setClip({ mode: 'copy', nodeIds: [...sel] }); toast('copied — paste forks with shared extents');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x' && sel.size) {
        setClip({ mode: 'cut', nodeIds: [...sel] }); toast('cut — paste to move');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && clip) {
        paste();
      } else if (e.key === 'Backspace' && cwdId !== EFS_ROOT && !query) {
        e.preventDefault(); goUp();
      } else if (e.key === 'Escape') { setSel(new Set()); setCtx(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, singleNode, visibleIds, clip, cwdId, query, renaming]);

  useEffect(() => {
    const close = () => setCtx(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  /* ------------------------------ render -------------------------------- */

  const NameOrInput = ({ node, className }: { node: VfsNode; className?: string }) =>
    renaming?.id === node.id ? (
      <input
        autoFocus value={renaming.draft}
        onChange={(e) => setRenaming({ id: node.id, draft: e.target.value })}
        onBlur={commitRename}
        onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null); }}
        className="bg-void border border-teal-ice/60 px-1 font-mono text-[11px] text-paper outline-none w-full"
        spellCheck={false}
      />
    ) : <span className={`${className ?? ''} truncate`}>{node.name}</span>;

  const openCtx = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault(); e.stopPropagation();
    if (!sel.has(nodeId)) setSel(new Set([nodeId]));
    setCtx({ x: e.clientX, y: e.clientY, nodeId });
  };

  const ctxNode = ctx ? vfs.nodes[ctx.nodeId] : null;
  const ctxFile = ctxNode?.fileId ? fileById.get(ctxNode.fileId) ?? null : null;

  /* --- tree row (recursive) --- */
  const TreeRow = ({ node, depth }: { node: VfsNode; depth: number }) => {
    const { dirs } = kidsOf(node.id);
    const isOpen = expanded.has(node.id);
    const isCwd = node.id === cwdId;
    return (
      <div>
        <div
          data-tree-id={node.id}
          onClick={() => enter(node.id)}
          onContextMenu={(e) => openCtx(e, node.id)}
          onDragOver={(e) => { e.preventDefault(); setDropTarget(node.id); }}
          onDragLeave={() => setDropTarget((t) => (t === node.id ? null : t))}
          onDrop={acceptDrop(node.id)}
          className={`fx-tree-row ${isCwd ? 'active' : ''} ${dropTarget === node.id ? 'drop' : ''}`}
          style={{ paddingLeft: 8 + depth * 13 }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded((p) => { const n = new Set(p); if (n.has(node.id)) n.delete(node.id); else n.add(node.id); return n; }); }}
            className={`fx-tree-caret ${dirs.length ? '' : 'ghost'} ${isOpen ? 'open' : ''}`}
          >▸</button>
          <span className="fx-tree-glyph shrink-0" style={{ color: node.color || undefined }}>
            <IcFolder size={12} />
          </span>
          <span className="truncate flex-1">{node.name}</span>
          {node.pinned && <span className="text-solar text-[8px]">◆</span>}
        </div>
        {isOpen && dirs.map((d) => <TreeRow key={d.id} node={d} depth={depth + 1} />)}
      </div>
    );
  };

  const rootDirs = kidsOf(EFS_ROOT).dirs;

  /* --- context menu --- */
  const MenuBtn = ({ label, onClick, danger, icon }: { label: string; onClick: () => void; danger?: boolean; icon?: React.ReactNode }) => (
    <button
      onClick={(e) => { e.stopPropagation(); setCtx(null); onClick(); }}
      className={`w-full text-left flex items-center gap-2 px-3 py-1.5 font-mono text-[9.5px] tracking-[0.14em] uppercase transition-colors
        ${danger ? 'text-red-300/80 hover:bg-red-400/10' : 'text-slate-soft hover:bg-teal-ice/10 hover:text-teal-ice'}`}
    >{icon}{label}</button>
  );

  /* --- list row / grid card --- */
  const rowProps = (node: VfsNode, file: VaultFile | null) => ({
    'data-node-id': node.id,
    draggable: renaming?.id !== node.id && dragArm === node.id,
    onPointerDown: () => armDrag(node.id),
    onPointerUp: disarmDrag,
    onDragEnd: disarmDrag,
    onDragStart: (e: React.DragEvent) => onRowDragStart(e, node.id),
    onDragOver: (e: React.DragEvent) => {
      if (node.type === 'dir') { e.preventDefault(); e.stopPropagation(); setDropTarget(node.id); }
    },
    onDragLeave: () => setDropTarget((t) => (t === node.id ? null : t)),
    onDrop: node.type === 'dir' ? acceptDrop(node.id) : undefined,
    onClick: (e: React.MouseEvent) => select(node.id, e),
    onDoubleClick: () => {
      if (node.type === 'dir') enter(node.id);
      else if (file) {
        if (file.lock) onLock(file); else onOpen(file);
      }
    },
    onContextMenu: (e: React.MouseEvent) => openCtx(e, node.id),
  });

  const engineBar = (
    <div className="border-t border-line/50 bg-[#04070f]/90">
      <button onClick={() => setDock((v) => !v)} className="w-full flex items-center gap-3 px-4 h-8 font-mono text-[8.5px] tracking-[0.22em] uppercase text-slate-dim hover:text-teal-ice transition-colors">
        <span className={`w-1.5 h-1.5 rounded-full ${scrub ? 'bg-amber-300 animate-pulse' : 'bg-teal-ice/70'}`} />
        efs engine · gen {vfs.super.generation} · {vfs.shadows.length} shadow{vfs.shadows.length === 1 ? '' : 's'}
        {vfs.super.dedupBytes > 0 && <span className="text-emerald-300/80">· {fmtBytes(vfs.super.dedupBytes)} shared</span>}
        <div className="flex-1" />
        <span>{dock ? '▾ hide' : '▸ open'}</span>
      </button>
      {dock && (
        <div className="px-4 pb-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* shadows */}
          <div className="border border-line/60 bg-void/50 p-2.5">
            <p className="font-mono text-[8px] tracking-[0.26em] uppercase text-teal-ice/80 mb-2">shadows · copy-on-write snapshots</p>
            <div className="flex gap-1.5 mb-2">
              <input value={shadowName} onChange={(e) => setShadowName(e.target.value)} placeholder="shadow name…"
                className="field flex-1 px-2 py-1 font-mono text-[9.5px] text-paper bg-void/70 outline-none placeholder:text-slate-dim/50" />
              <button onClick={() => {
                const s = actions.efsShadow(shadowName || `gen-${vfs.super.generation}`);
                setShadowName('');
                toast(`shadow '${s.name}' frozen · 0 payload bytes copied`);
              }} className="font-mono text-[8.5px] uppercase tracking-[0.16em] border border-teal-ice/40 text-teal-ice px-2 hover:bg-teal-ice/10 transition-colors">freeze</button>
            </div>
            <div className="max-h-27.5 overflow-y-auto thin-scroll space-y-1">
              {vfs.shadows.length === 0 && <p className="font-mono text-[9px] text-slate-dim">no shadows yet — freeze the tree to bookmark it</p>}
              {vfs.shadows.map((s) => (
                <div key={s.id} className="flex items-center gap-2 font-mono text-[9px] text-slate-soft bg-void/40 border border-line/40 px-2 py-1">
                  <span className="truncate flex-1" title={s.description ?? ''}>
                    {s.name}
                    {s.name.startsWith('pre-rollback-') && (
                      <span className="text-slate-dim text-[7.5px] ml-1.5 uppercase tracking-wider">(auto-safety backup)</span>
                    )}
                  </span>
                  <span className="text-slate-dim tabular-nums">g{s.generation}</span>
                  <button onClick={() => { actions.efsRestoreShadow(s.id); toast(`rolled back to '${s.name}' · safety shadow taken first`); }}
                    className="text-teal-ice/80 hover:text-teal-ice uppercase tracking-widest">restore</button>
                  <button onClick={() => actions.efsDeleteShadow(s.id)} className="text-red-300/70 hover:text-red-300" title="delete shadow">✕</button>
                </div>
              ))}
            </div>
          </div>
          {/* scrub */}
          <div className="border border-line/60 bg-void/50 p-2.5">
            <p className="font-mono text-[8px] tracking-[0.26em] uppercase text-teal-ice/80 mb-2">scrub · bit-rot checksum verify</p>
            {scrub ? (
              <div>
                <div className="h-1.5 bg-void border border-line/40 mb-1.5"><div className="h-full bg-teal-ice/70" style={{ width: `${scrub.total ? (scrub.done / scrub.total) * 100 : 0}%` }} /></div>
                <p className="font-mono text-[9px] text-slate-soft truncate">{scrub.current || '…'} · {scrub.done}/{scrub.total}</p>
              </div>
            ) : (
              <button onClick={() => void startScrub()} className="font-mono text-[8.5px] uppercase tracking-[0.16em] border border-line/60 text-slate-soft px-2.5 py-1 hover:text-teal-ice hover:border-teal-ice/40 transition-colors flex items-center gap-1.5">
                <IcScan size={10} /> scrub now
              </button>
            )}
            {vfs.scrub && !scrub && (
              <p className="font-mono text-[9px] text-slate-dim mt-2 leading-[1.7]">
                last: <span className={
                  vfs.scrub.status === 'clean' ? 'text-emerald-300/90'
                    : vfs.scrub.status === 'repaired' ? 'text-amber-300/90'
                      : vfs.scrub.status === 'corrupted' ? 'text-red-300/90' : 'text-slate-dim'
                }>{vfs.scrub.status}</span>
                {' · '}{vfs.scrub.filesScanned} files · {fmtBytes(vfs.scrub.bytesScanned)}
                {vfs.scrub.errorsFound > 0 && <> · {vfs.scrub.errorsFound} errors ({vfs.scrub.errorsCorrected} repaired)</>}
                {vfs.scrub.finishedAt && <> · {fmtDate(vfs.scrub.finishedAt)}</>}
              </p>
            )}
            <button onClick={runDedup} className="mt-2 font-mono text-[8.5px] uppercase tracking-[0.16em] border border-line/60 text-slate-soft px-2.5 py-1 hover:text-teal-ice hover:border-teal-ice/40 transition-colors">
              dedup scan
            </button>
            {dedupInfo && <p className="font-mono text-[9px] text-emerald-300/80 mt-1.5">{dedupInfo}</p>}
          </div>
          {/* superblock */}
          <div className="border border-line/60 bg-void/50 p-2.5">
            <p className="font-mono text-[8px] tracking-[0.26em] uppercase text-teal-ice/80 mb-2">superblock</p>
            <div className="font-mono text-[9px] text-slate-soft leading-[1.9]">
              <div>label <span className="text-paper">{vfs.super.label}</span></div>
              <div>uuid <span className="text-slate-dim">{vfs.super.uuid.slice(0, 18)}…</span></div>
              <div>generation <span className="text-teal-ice tabular-nums">{vfs.super.generation}</span></div>
              <div>nodes <span className="text-paper tabular-nums">{Object.keys(vfs.nodes).length}</span></div>
              <div>shared extents <span className="text-emerald-300/90">{fmtBytes(vfs.super.dedupBytes)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* --- trash view --- */
  const trashView = (
    <div className="flex-1 min-h-0 overflow-y-auto thin-scroll p-4" data-mq="1">
      <div className="flex items-center gap-3 mb-3">
        <p className="font-mono text-[9px] tracking-[0.28em] uppercase text-paper/75">the void · {state.vaultTrash.length} resting</p>
        <div className="flex-1" />
        {state.vaultTrash.length > 0 && (
          <button onClick={() => { if (confirm('purge every trashed object and its payload bytes? this cannot be undone.')) { actions.purgeTrash(); toast('the void is empty'); } }}
            className="font-mono text-[8.5px] tracking-[0.18em] uppercase text-red-300/80 hover:text-red-300 border border-red-300/30 px-2.5 py-1 transition-colors">purge all</button>
        )}
      </div>
      {state.vaultTrash.length === 0 && <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-slate-dim py-10 text-center">nothing lingers in the void</p>}
      <div className="space-y-1">
        {state.vaultTrash.map((t: TrashedFile) => (
          <div key={t.item.id} className="flex items-center gap-3 px-3 py-2 border border-line/50 bg-void/40">
            <span className="text-slate-soft"><KindGlyph kind={t.item.kind} size={14} /></span>
            <span className="text-[11.5px] text-paper truncate flex-1">{t.item.name}{t.dirName ? <span className="text-slate-dim"> · from '{t.dirName}'</span> : null}</span>
            <span className="font-mono text-[9px] text-slate-dim tabular-nums">{fmtBytes(t.item.size)}</span>
            <span className="font-mono text-[9px] text-slate-dim">{fmtDate(t.deletedAt)}</span>
            <button onClick={() => { actions.restoreTrashed(t.item.id); toast(`restored ${t.item.name}`); }}
              className="font-mono text-[8px] tracking-[0.16em] uppercase text-teal-ice border border-teal-ice/40 px-2 py-0.5 hover:bg-teal-ice/10 transition-colors">restore</button>
            <button onClick={() => { if (confirm(`purge ${t.item.name} forever?`)) { actions.purgeTrashed(t.item.id); toast('payload dissolved'); } }}
              className="font-mono text-[8px] tracking-[0.16em] uppercase text-red-300/70 hover:text-red-300 px-1">✕</button>
          </div>
        ))}
      </div>
    </div>
  );

  /* --- main listing --- */
  const listing = searchHits ? (
    <div className="flex-1 min-h-0 overflow-y-auto thin-scroll p-3" data-mq="1">
      <p className="font-mono text-[8.5px] tracking-[0.24em] uppercase text-slate-dim px-1 pb-2">{searchHits.length} hits across the vault</p>
      {searchHits.map(({ node, file }) => (
        <div key={node.id} data-node-id={node.id}
          onClick={(e) => select(node.id, e)}
          onDoubleClick={() => { if (node.type === 'dir') enter(node.id); else if (file) onOpen(file); }}
          className="flex items-center gap-3 px-3 py-2 border-b border-line/30 cursor-pointer hover:bg-teal-ice/5">
          <span className="text-slate-soft">{node.type === 'dir' ? <IcFolder size={13} /> : file ? <KindGlyph kind={file.kind} size={14} /> : null}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] text-paper truncate">{node.name}</p>
            <p className="font-mono text-[8.5px] text-slate-dim truncate">{efsPathString(vfs, node.parentId ?? EFS_ROOT)}</p>
          </div>
          {file && <span className="font-mono text-[9px] text-slate-dim tabular-nums">{fmtBytes(file.size)}</span>}
        </div>
      ))}
    </div>
  ) : (
    <div
      ref={listRef}
      onMouseDown={onListMouseDown}
      onDragOver={(e) => { e.preventDefault(); }}
      onDrop={(e) => { if (e.dataTransfer.files?.length) acceptDrop(cwdId)(e); }}
      className="relative flex-1 min-h-0 overflow-y-auto thin-scroll p-3 select-none"
    >
      {mqRect && (
        <div className="fixed border border-teal-ice/60 bg-teal-ice/10 pointer-events-none z-50"
          style={{ left: Math.min(mqRect.x0, mqRect.x1), top: Math.min(mqRect.y0, mqRect.y1), width: Math.abs(mqRect.x1 - mqRect.x0), height: Math.abs(mqRect.y1 - mqRect.y0) }} />
      )}
      {sortedDirs.length === 0 && sortedFiles.length === 0 && (
        <div className="h-full grid place-items-center">
          <p className="font-mono text-[10px] tracking-[0.24em] uppercase text-slate-dim text-center px-6">vacuum — drop files here, seal them in,<br />or flip ⧉ recursive to surface everything below</p>
        </div>
      )}

      {sortedDirs.length > 0 && (
        <>
          <p className="font-mono text-[8px] tracking-[0.3em] uppercase text-slate-dim px-1 pb-2 pt-1">directories</p>
          <div className="fm-tile-grid pb-2">
            {sortedDirs.map((d) => (
              <div key={d.id} {...rowProps(d, null)}
                className={`fm-card ${sel.has(d.id) ? 'sel' : ''} ${dropTarget === d.id ? 'drop' : ''}`}>
                <span className="fm-tile-icon" style={{ color: d.color || 'rgba(111,194,180,0.85)' }}><IcFolder size={30} /></span>
                <NameOrInput node={d} className="fm-name text-center w-full mt-2.5 text-[12.5px]" />
                <span className="fm-tile-sub mt-1">{kidsOf(d.id).totalCount} item{kidsOf(d.id).totalCount === 1 ? '' : 's'}</span>
                {d.pinned && <span className="absolute top-1.5 right-2 text-solar text-[9px]" title="pinned">◆</span>}
              </div>
            ))}
          </div>
        </>
      )}

      {sortedFiles.length > 0 && (
        <>
          <p className="font-mono text-[8px] tracking-[0.3em] uppercase text-slate-dim px-1 pb-2 pt-1">objects</p>
          <div className="fm-tile-grid">
            {sortedFiles.map((f) => {
              const node = fileNodeById.get(f.id) ?? {
                id: 'vnode-' + f.id,
                type: 'file' as const,
                name: f.name,
                parentId: f.dirId ?? EFS_ROOT,
                fileId: f.id,
                createdAt: f.addedAt,
                modifiedAt: f.addedAt,
              };
              return (
                <div key={node.id} {...rowProps(node, f)}
                  className={`fm-card text-left ${sel.has(node.id) ? 'sel' : ''}`}>
                  <div className="w-full flex items-start justify-between px-0.5">
                    <span className="text-slate-soft"><KindGlyph kind={f.kind} /></span>
                    <span className="flex items-center gap-1.5">
                      {f.dedupOf && <span className="fm-tag-shared">shared</span>}
                      {f.payloadMissing && <span className="fm-tag-sealed text-solar">missing</span>}
                      {f.sealed && !f.payloadMissing && <span className="fm-tag-sealed">sealed</span>}
                      {f.lock && <IcLock size={11} className="text-solar" />}
                    </span>
                  </div>
                  <div className="fm-tile-preview mt-2"><TilePreview f={f} /></div>
                  <NameOrInput node={node} className="fm-name text-center w-full mt-2 text-[11.5px]" />
                  <span className="fm-tile-sub mt-1">{fmtBytes(f.size)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* toolbar */}
      <div className="fx-scan flex items-center gap-2.5 px-4 h-12 border-b border-line/50 shrink-0 flex-wrap bg-[#070b1a]/45">
        <button onClick={() => setTreeOpen((v) => !v)}
          title={treeOpen ? 'hide locations' : 'show locations'}
          className={`shrink-0 p-1.5 border transition-colors ${treeOpen ? 'border-teal-ice/40 text-teal-ice bg-teal-ice/10' : 'border-line/60 text-slate-dim hover:text-teal-ice hover:border-teal-ice/40'}`}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9.5 4v16" />
          </svg>
        </button>
        <div className="flex items-center gap-1.5 min-w-0">
          {breadcrumb.map((b, i) => (
            <span key={b.id} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <span className="text-slate-dim">/</span>}
              <button onClick={() => enter(b.id)}
                className={`font-mono text-[10.5px] truncate transition-colors ${i === breadcrumb.length - 1 ? 'fx-title font-semibold' : 'text-slate-soft hover:text-paper'}`}>
                {b.id === EFS_ROOT ? 'vault' : b.name}
              </button>
            </span>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 border border-line/60 px-2 py-1">
          <IcSearch size={11} className="text-slate-dim" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search every object…"
            className="bg-transparent font-mono text-[10.5px] text-paper w-40 outline-none placeholder:text-slate-dim/60" />
          {query && <button onClick={() => setQuery('')} className="text-slate-dim hover:text-paper"><IcClose size={10} /></button>}
        </div>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="field px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-soft bg-void/60 cursor-pointer">
          <option value="name">name</option><option value="kind">kind</option><option value="size">size</option><option value="date">date</option>
        </select>
        <button onClick={() => setSortDir((d) => (d === 1 ? -1 : 1))} className="font-mono text-[10px] text-slate-dim hover:text-teal-ice px-1" title="reverse">{sortDir === 1 ? '↑' : '↓'}</button>        <button onClick={() => setFlat((v) => !v)}
          title="include every subdirectory"
          className={`font-mono text-[8.5px] tracking-[0.14em] uppercase border px-2 py-1 transition-colors ${flat ? 'border-teal-ice/50 text-teal-ice bg-teal-ice/10' : 'border-line/60 text-slate-dim hover:text-teal-ice'}`}>
          ⧉ recursive
        </button>
        <button onClick={() => actions.efsCreateFolder(cwdId, 'new folder') && toast('directory formed')}
          className="font-mono text-[9px] tracking-[0.18em] uppercase border border-line/60 text-slate-soft px-2.5 py-1.5 hover:text-teal-ice hover:border-teal-ice/40 transition-colors flex items-center gap-1.5">
          <IcPlus size={10} /> dir
        </button>
        <button onClick={() => uploadRef.current?.click()}
          className="font-mono text-[9px] tracking-[0.18em] uppercase border border-teal-ice/40 text-teal-ice px-2.5 py-1.5 hover:bg-teal-ice/10 transition-colors">
          seal in
        </button>
        <input ref={uploadRef} type="file" multiple className="hidden" onChange={(e) => { onImport(e.target.files, cwdId); e.currentTarget.value = ''; }} />
        <button onClick={() => setShowInspector((v) => !v)} className={`font-mono text-[9px] px-2 py-1.5 border transition-colors ${showInspector ? 'border-teal-ice/40 text-teal-ice' : 'border-line/60 text-slate-dim'}`}>inspector</button>
      </div>

      <div className="flex-1 min-h-0 flex relative">
        {/* locations rail — collapsible from the toolbar & its own caption */}
        <div className="relative shrink-0 overflow-hidden" style={{ width: treeOpen ? 216 : 0, transition: 'width 0.4s cubic-bezier(0.22,1,0.36,1)' }}>
          <div className="w-54 h-full flex flex-col border-r border-line/40 bg-[#0a0818]/35 backdrop-blur-md">
            <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
              <p className="font-mono text-[7.5px] tracking-[0.34em] uppercase text-slate-dim flex-1">locations</p>
              <button onClick={() => setTreeOpen(false)} title="hide locations"
                className="text-slate-dim hover:text-teal-ice transition-colors leading-none pb-0.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M14 6l-6 6 6 6" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto thin-scroll pb-2">
              <TreeRow node={vfs.nodes[EFS_ROOT]} depth={0} />
              {rootDirs.filter((d) => d.pinned && !expanded.has(EFS_ROOT)).map((d) => (
                <TreeRow key={d.id} node={d} depth={1} />
              ))}
            </div>
            <button onClick={() => setTrashOpen((v) => !v)}
              className={`flex items-center gap-2 px-4 h-9 border-t border-line/40 font-mono text-[9px] tracking-[0.2em] uppercase transition-colors ${trashOpen ? 'text-solar bg-solar/10' : 'text-slate-dim hover:text-paper'}`}>
              <IcTrash size={11} /> the void
              {state.vaultTrash.length > 0 && <span className="ml-auto text-solar tabular-nums">{state.vaultTrash.length}</span>}
            </button>
          </div>
        </div>

        {trashOpen ? trashView : listing}

        {/* inspector */}
        {showInspector && (
          <div className="fx-panel w-60 shrink-0 border-l border-line/50 bg-[#04070f]/60 overflow-y-auto thin-scroll p-3.5">
            {!singleNode && (
              <div>
                <p className="font-mono text-[8.5px] tracking-[0.26em] uppercase text-slate-dim mb-2">selection</p>
                <p className="font-mono text-[10px] text-slate-soft leading-loose">
                  {sel.size ? `${sel.size} objects selected` : 'nothing selected'}
                  {sel.size > 1 && <>
                    <br />{selNodes.filter((n) => n.type === 'dir').length} dirs · {selNodes.filter((n) => n.type === 'file').length} files
                  </>}
                </p>
                {sel.size > 1 && (
                  <div className="flex flex-col gap-1.5 mt-3">
                    {clip?.mode === 'cut' && sel.size === 0 && null}
                    <button onClick={() => { setClip({ mode: 'copy', nodeIds: [...sel] }); toast('copied'); }} className="font-mono text-[9px] uppercase tracking-[0.16em] border border-line/60 text-slate-soft px-2 py-1 hover:text-teal-ice transition-colors text-left">copy selection</button>
                    <button onClick={() => { setClip({ mode: 'cut', nodeIds: [...sel] }); toast('cut'); }} className="font-mono text-[9px] uppercase tracking-[0.16em] border border-line/60 text-slate-soft px-2 py-1 hover:text-teal-ice transition-colors text-left">cut selection</button>
                    <button onClick={trashSelection} className="font-mono text-[9px] uppercase tracking-[0.16em] border border-red-300/30 text-red-300/80 px-2 py-1 hover:bg-red-400/10 transition-colors text-left">move to void</button>
                  </div>
                )}
                <p className="font-mono text-[8.5px] text-slate-dim leading-[1.9] mt-4">
                  right-click anything for its menu.<br />drag onto the tree to rehome.<br />F2 renames · Del trashes · Ctrl+C/X/V clipboard.
                </p>
              </div>
            )}
            {singleNode && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-slate-soft">{singleNode.type === 'dir' ? <IcFolder size={16} /> : singleFile ? <KindGlyph kind={singleFile.kind} size={16} /> : null}</span>
                  <p className="text-[12px] text-paper font-medium truncate flex-1">{singleNode.name}</p>
                </div>
                <div className="font-mono text-[9px] text-slate-soft leading-loose">
                  <div>type <span className="text-paper">{singleNode.type}</span></div>
                  {singleFile && <>
                    <div>kind <span className="text-paper">{singleFile.kind} · {singleFile.mime}</span></div>
                    <div>size <span className="text-paper tabular-nums">{fmtBytes(singleFile.size)}</span></div>
                    <div>payload <span className={singleFile.payloadRef ? 'text-teal-ice' : singleFile.content ? 'text-paper' : 'text-solar'}>
                      {singleFile.payloadRef ? (singleFile.dedupOf ? 'shared extent' : 'opfs/idb') : singleFile.content ? 'inline' : 'sealed'}
                    </span></div>
                    {singleFile.dedupOf && <div className="text-emerald-300/80">dedup source {singleFile.dedupOf.slice(0, 13)}…</div>}
                    <div className="truncate" title={singleFile.checksum}>csum <span className="text-slate-dim">{singleFile.checksum ? `${singleFile.checksum.slice(0, 16)}…` : 'not sealed — run scrub'}</span></div>
                    {(singleFile.versions?.length ?? 0) > 0 && <div>versions <span className="text-paper">{singleFile.versions!.length}</span></div>}
                    <div>added <span className="text-paper">{fmtDate(singleFile.addedAt)}</span></div>
                  </>}
                  {singleNode.type === 'dir' && <>
                    <div>contains <span className="text-paper">{kidsOf(singleNode.id).dirs.length} dirs · {kidsOf(singleNode.id).fileIds.length} files</span></div>
                    <div>subtree <span className="text-paper tabular-nums">{fmtBytes(dirBytes)}</span></div>
                    <div>path <span className="text-slate-dim">{efsPathString(vfs, singleNode.id)}</span></div>
                  </>}
                </div>
                {/* tags */}
                <div>
                  <p className="font-mono text-[8px] tracking-[0.26em] uppercase text-slate-dim mb-1.5">tags</p>
                  <input placeholder="comma,separated,tags" defaultValue={(singleNode.tags ?? []).join(',')}
                    onKeyDown={(e) => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value; actions.efsSetTags(singleNode.id, v.split(',').map((t) => t.trim()).filter(Boolean)); toast('tags sealed'); } }}
                    className="field w-full px-2 py-1 font-mono text-[9.5px] text-paper bg-void/70 outline-none placeholder:text-slate-dim/50" />
                </div>
                {singleNode.type === 'dir' && (
                  <div>
                    <p className="font-mono text-[8px] tracking-[0.26em] uppercase text-slate-dim mb-1.5">color</p>
                    <div className="flex gap-1.5">
                      {DIR_COLORS.map((c) => (
                        <button key={c || 'none'} onClick={() => { actions.efsSetDirColor(singleNode.id, c || undefined); toast('directory recolored'); }}
                          className={`w-4 h-4 rounded-full border transition-transform hover:scale-110 ${singleNode.color === c || (!singleNode.color && !c) ? 'border-paper scale-110' : 'border-line/60'}`}
                          style={{ background: c || 'transparent' }} />
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-1.5 pt-1">
                  {singleNode.type === 'dir' && (
                    <button onClick={() => enter(singleNode.id)} className="font-mono text-[9px] uppercase tracking-[0.16em] border border-line/60 text-slate-soft px-2 py-1 hover:text-teal-ice transition-colors text-left flex items-center gap-2"><IcFolder size={10} /> enter</button>
                  )}
                  <button onClick={() => setRenaming({ id: singleNode.id, draft: singleNode.name })} className="font-mono text-[9px] uppercase tracking-[0.16em] border border-line/60 text-slate-soft px-2 py-1 hover:text-teal-ice transition-colors text-left flex items-center gap-2"><IcEdit size={10} /> rename</button>
                  <button onClick={() => pasteInto(singleNode)} className="font-mono text-[9px] uppercase tracking-[0.16em] border border-line/60 text-slate-soft px-2 py-1 hover:text-teal-ice transition-colors text-left flex items-center gap-2"><IcCopy size={10} /> paste here</button>
                  {singleNode.type === 'dir' && (
                    <button onClick={() => { const nid = actions.efsForkDir(singleNode.id); toast(nid ? 'directory forked · zero-copy CoW clone' : 'fork failed', nid ? undefined : 'warn'); }}
                      className="font-mono text-[9px] uppercase tracking-[0.16em] border border-emerald-300/30 text-emerald-300/80 px-2 py-1 hover:bg-emerald-400/10 transition-colors text-left">⧉ fork (CoW)</button>
                  )}
                  {singleFile && (
                    <>
                      <button onClick={() => (singleFile.lock ? onLock(singleFile) : onOpen(singleFile))} className="font-mono text-[9px] uppercase tracking-[0.16em] border border-teal-ice/40 text-teal-ice px-2 py-1 hover:bg-teal-ice/10 transition-colors text-left flex items-center gap-2"><IcDownload size={10} /> open</button>
                      <button onClick={() => onLock(singleFile)} className="font-mono text-[9px] uppercase tracking-[0.16em] border border-line/60 text-slate-soft px-2 py-1 hover:text-solar transition-colors text-left flex items-center gap-2"><IcLock size={10} /> key-lock</button>
                    </>
                  )}
                  {singleNode.id !== EFS_ROOT && (
                    <button onClick={trashSelection} className="font-mono text-[9px] uppercase tracking-[0.16em] border border-red-300/30 text-red-300/80 px-2 py-1 hover:bg-red-400/10 transition-colors text-left flex items-center gap-2"><IcTrash size={10} /> move to void</button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {engineBar}

      {/* context menu */}
      {ctx && ctxNode && (
        <div className="fixed z-200 min-w-47.5 border border-line/70 bg-[#060b17]/95 backdrop-blur shadow-2xl py-1 overlay-in"
          style={{ left: Math.min(ctx.x, window.innerWidth - 210), top: Math.min(ctx.y, window.innerHeight - 320) }}
          onClick={(e) => e.stopPropagation()}>
          <div className="px-3 py-1 font-mono text-[8px] tracking-[0.24em] uppercase text-slate-dim truncate">{ctxNode.name}</div>
          {ctxNode.type === 'dir' && <MenuBtn label="enter directory" icon={<IcFolder size={10} />} onClick={() => enter(ctxNode.id)} />}
          {ctxFile && <MenuBtn label={ctxFile.lock ? 'unlock & open' : 'open'} icon={<IcDownload size={10} />} onClick={() => (ctxFile.lock ? onLock(ctxFile) : onOpen(ctxFile))} />}
          <MenuBtn label="rename" icon={<IcEdit size={10} />} onClick={() => setRenaming({ id: ctxNode.id, draft: ctxNode.name })} />
          <MenuBtn label="copy (CoW fork)" icon={<IcCopy size={10} />} onClick={() => { setClip({ mode: 'copy', nodeIds: [...sel] }); toast('copied — paste forks with shared extents'); }} />
          <MenuBtn label="cut" onClick={() => { setClip({ mode: 'cut', nodeIds: [...sel] }); toast('cut — paste to move'); }} />
          {clip && ctxNode.type === 'dir' && <MenuBtn label="paste into" onClick={() => paste(ctxNode.id)} />}
          {ctxNode.type === 'dir' && <MenuBtn label="new folder inside" icon={<IcPlus size={10} />} onClick={() => { actions.efsCreateFolder(ctxNode.id, 'new folder'); toast('directory formed'); }} />}
          {ctxNode.type === 'dir' && <MenuBtn label="fork (zero-copy)" onClick={() => { const nid = actions.efsForkDir(ctxNode.id); if (nid) toast('directory forked · zero-copy CoW clone'); }} />}
          {ctxNode.type === 'dir' && (
            <div className="px-3 py-1.5 flex items-center gap-1.5 border-t border-line/40 mt-1 pt-1.5">
              <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-slate-dim mr-1">color</span>
              {DIR_COLORS.map((c) => (
                <button key={c || 'n'} onClick={() => { actions.efsSetDirColor(ctxNode.id, c || undefined); setCtx(null); }}
                  className="w-3.5 h-3.5 rounded-full border border-line/60 hover:scale-110 transition-transform"
                  style={{ background: c || 'transparent' }} />
              ))}
            </div>
          )}
          <MenuBtn label={ctxNode.pinned ? 'unpin' : 'pin'} onClick={() => { actions.efsTogglePin(ctxNode.id); setCtx(null); }} />
          {ctxNode.id !== EFS_ROOT && <MenuBtn label="move to void" danger icon={<IcTrash size={10} />} onClick={trashSelection} />}
        </div>
      )}
    </div>
  );

  function pasteInto(target: VfsNode) {
    if (!clip) { toast('clipboard is empty', 'warn'); return; }
    paste(target.type === 'dir' ? target.id : (target.parentId ?? EFS_ROOT));
  }
}

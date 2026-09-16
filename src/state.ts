/**
 * Core Universe State Management & Action Dispatcher
 * Provides unified reactive state subscription, local storage synchronization,
 * and dispatch actions across realities, bodies, diary entries, and the universal vault.
 */

import { useSyncExternalStore } from 'react';
import type {
  Attachment,
  BodyKind,
  CosmicBody,
  DiaryEntry,
  FileVersion,
  Meaning,
  UniverseState,
  VaultSecrets,
} from './types';
import {
  getReality,
  REALITIES,
  RAW_REALITIES,
  computeAllRealities,
  setRuntimeRealities,
  createGalaxyData,
  RealityConfig,
  RealityMetaOverride,
  GalaxyData,
} from './realities';
import {
  delLocalPayload, delPayload, getPayload, putLocalPayload,
  procPalette, procRadius,
  createInitialSeed, seedBodies,
  sanitizeDiaryHtml,
  createVfs, efsAddFileNode, efsBump, efsChildren, efsCreateShadow, efsDedup,
  efsDeleteShadow, efsMkdir, efsMove, efsNodeOf, efsPathString, efsRename,
  efsScrub, efsSubtreeIds, efsHeal, efsUniqueName, EFS_ROOT, migrateLegacyVault,
} from './backend';
import { recordPersistence } from './performance';
import { desktopStore, realityApi } from './desktop/adapter';
import type { EfsScrubReport, VaultFile, VfsNode, VfsShadow } from './types';



const STORAGE_KEY = 'my-universe:v4';
const DAY_MS = 86400000;
const DIARY_INLINE_LIMIT = 256 * 1024;
const DIARY_PAYLOAD_PREFIX = 'diary:';

export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return (
      'id-' +
      Math.random().toString(36).slice(2) +
      Date.now().toString(36)
    );
  }
}

/* ================================ store ================================== */

let state: UniverseState = loadState();
let snapshot: UniverseState = createSnapshot(state);
const listeners = new Set<() => void>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function createSnapshot(s: UniverseState): UniverseState {
  return {
    ...s,
    customRealityDescriptions: s.customRealityDescriptions
      ? { ...s.customRealityDescriptions }
      : {},
    customRealities: s.customRealities ? [...s.customRealities] : [],
    deletedRealityIds: s.deletedRealityIds ? [...s.deletedRealityIds] : [],
    binRealities: s.binRealities ? [...s.binRealities] : [],
    customGalaxies: s.customGalaxies
      ? Object.fromEntries(Object.entries(s.customGalaxies).map(([k, v]) => [k, [...v]]))
      : {},
    customRealityMeta: s.customRealityMeta
      ? Object.fromEntries(Object.entries(s.customRealityMeta).map(([k, v]) => [k, { ...v }]))
      : {},
    bodies: [...s.bodies],
    entries: [...s.entries],
    connections: [...s.connections],
    vault: [...s.vault],
    efs: s.efs
      ? { ...s.efs, nodes: { ...s.efs.nodes }, shadows: [...s.efs.shadows], super: { ...s.efs.super } }
      : createVfs(),
    vaultTrash: [...s.vaultTrash],
    vaultUsers: [...s.vaultUsers],
    audit: [...s.audit],
  };
}

/**
 * Boot-time state priming: synchronizes runtime realities with custom
 * realities & deletions. (Historically this also back-dated the newest diary
 * entry's `updatedAt` to keep streak indicators alive — removed: user content
 * timestamps must never be mutated, streaks should reflect real activity.)
 */
function primeState(p: UniverseState): UniverseState {
  // Synchronize runtime realities with custom realities & deletions
  setRuntimeRealities(
    computeAllRealities(p.customRealities, p.deletedRealityIds, p.customRealityDescriptions, p.customGalaxies, p.customRealityMeta as Record<string, RealityMetaOverride>)
  );
  return p;
}

function sanitizeDiaryEntries(value: unknown): DiaryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is DiaryEntry => Boolean(entry) && typeof entry === 'object')
    .map((entry) => ({
      ...entry,
      body: sanitizeDiaryHtml(entry.body),
    }));
}

function normalizeLegacyLock(file: VaultFile): VaultFile {
  const raw = file as VaultFile & { lock?: VaultFile['lock'] | string };
  if (typeof raw.lock !== 'string') return file;
  return { ...file, lock: undefined, legacyLock: raw.lock };
}

function normalizeVaultFiles(value: unknown): VaultFile[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((file): file is VaultFile => Boolean(file) && typeof file === 'object')
    .map(normalizeLegacyLock);
}

function loadState(): UniverseState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as UniverseState;
      if (parsed && Array.isArray(parsed.bodies) && parsed.bodies.length) {
        if (!parsed.activeRealityId) parsed.activeRealityId = 'sol-prime';
        if (!Array.isArray(parsed.customRealities)) parsed.customRealities = [];
        if (!Array.isArray(parsed.deletedRealityIds)) parsed.deletedRealityIds = [];
        if (!parsed.customGalaxies || typeof parsed.customGalaxies !== 'object') parsed.customGalaxies = {};
        if (!parsed.customRealityMeta || typeof parsed.customRealityMeta !== 'object') parsed.customRealityMeta = {};
        if (!Array.isArray(parsed.vault)) parsed.vault = [];
        if (!Array.isArray(parsed.vaultTrash)) parsed.vaultTrash = [];
        parsed.vault = normalizeVaultFiles(parsed.vault);
        parsed.vaultTrash = parsed.vaultTrash.map((trash) => ({
          ...trash,
          item: normalizeLegacyLock(trash.item),
        }));
        if (!Array.isArray(parsed.vaultUsers)) parsed.vaultUsers = [];
        if (!Array.isArray(parsed.audit)) parsed.audit = [];
        parsed.entries = sanitizeDiaryEntries(parsed.entries);

        /* v3: the old flat folder-string system + the btrfs simulation were
           replaced by EFS — build the tree from legacy paths once, then strip
           every legacy field so it never persists again */
        if (!parsed.efs || !Object.keys(parsed.efs.nodes ?? {}).length) {
          migrateLegacyVault(parsed);
        }
        /* guarantee reachability: every vault record must have a tree node,
           otherwise the File Manager would hide what Everything shows */
        let healedCount = efsHeal(parsed.efs, parsed.vault);

        /* if vault was wiped by an empty rollback, restore initial seed files safely */
        if (parsed.vault.length === 0 && parsed.vaultTrash.length === 0) {
          const freshSeed = createInitialSeed(newId);
          parsed.vault = freshSeed.vault;
          healedCount += efsHeal(parsed.efs, parsed.vault);
        }

        /* ensure genesis shadow contains file nodes if it was created on an older version */
        parsed.efs?.shadows?.forEach((shadow) => {
          if (shadow.name === 'genesis' && shadow.fileCount === 0) {
            const freshSeed = createInitialSeed(newId);
            shadow.tree = JSON.parse(JSON.stringify(freshSeed.efs.nodes));
            shadow.fileCount = Object.values(shadow.tree).filter((n) => n.type === 'file').length;
            shadow.dirCount = Object.values(shadow.tree).filter((n) => n.type === 'dir').length;
            healedCount++;
          }
        });

        const legacy = parsed as unknown as Record<string, unknown>;
        delete legacy.vaultFolders;
        delete legacy.btrfsSubvolumes;
        delete legacy.btrfsSnapshots;
        delete legacy.btrfsScrub;
        delete legacy.btrfsSuperblock;
        delete legacy.activeSubvolId;

        if (!parsed.version || parsed.version < 2) {
          parsed.entries.forEach((e) => {
            e.mood = undefined;
          });
        }
        parsed.version = 3;
        const primed = primeState(parsed);
        if (healedCount > 0) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(primed));
          } catch {
            /* quota or storage error */
          }
        }
        return primed;
      }
    }
  } catch {
    /* fallback to fresh seed on parse failure */
  }
  return primeState(createInitialSeed(newId));
}

function diaryPayloadId(id: string): string {
  return `${DIARY_PAYLOAD_PREFIX}${id}`;
}

async function externalizeLargeDiaryAttachments(): Promise<void> {
  const candidates = state.entries.flatMap((entry) => entry.attachments);
  let changed = false;

  await Promise.all(candidates.map(async (attachment) => {
    if (attachment.payloadRef || !attachment.dataUrl || attachment.dataUrl.length <= DIARY_INLINE_LIMIT || !attachment.dataUrl.startsWith('data:')) return;
    try {
      const blob = await fetch(attachment.dataUrl).then((response) => response.blob());
      const payloadRef = diaryPayloadId(attachment.id);
      await putLocalPayload(payloadRef, blob);
      attachment.payloadRef = payloadRef;
      attachment.dataUrl = '';
      changed = true;
    } catch {
      /* Keep the inline attachment if browser payload storage is unavailable. */
    }
  }));

  if (changed) {
    snapshot = createSnapshot(state);
    persistState();
    listeners.forEach((listener) => listener());
  }
}

function persistState() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      const slim = {
        ...state,
        vaultUsers: state.vaultUsers.map((u) => {
          const n = { ...u };
          if (n.avatar && n.avatar.length > 2_600_000) n.avatar = null;
          if (n.avatarFrames && n.avatarFrames.join('').length > 3_500_000)
            n.avatarFrames = null;
          return n;
        }),
      };
      const serialized = JSON.stringify(slim);
      /* Desktop tier: real file in the OS app-data dir (no 5MB quota). The
         localStorage write still runs as a fast cache + web fallback. */
      void desktopStore.writeState(serialized);
      localStorage.setItem(STORAGE_KEY, serialized);
      recordPersistence(serialized.length);
    } catch {
      /* quota exceeded — state continues seamlessly in memory */
    }
  }, 350);
}

function notify() {
  snapshot = createSnapshot(state);
  persistState();
  listeners.forEach((listener) => listener());
}

queueMicrotask(() => void externalizeLargeDiaryAttachments());

export function getState(): UniverseState {
  return snapshot;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useUniverse(): UniverseState {
  return useSyncExternalStore(subscribe, getState, getState);
}

/**
 * Desktop boot hydrate. The desktop shell stores the universe in a real file;
 * the webview localStorage acts as a synchronous boot cache. On boot:
 *   - file missing → push the current cache to disk (first desktop boot)
 *   - file differs from cache → adopt the file (authoritative) and reload once
 * Content-equality (not string equality) guards against reload loops.
 */
export async function hydrateDesktopSnapshot(): Promise<void> {
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown };
  if (!w.__TAURI_INTERNALS__) return;
  try {
    const fileJson = await desktopStore.readState();
    if (fileJson === null) {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) void desktopStore.writeState(local);
      return;
    }
    const local = localStorage.getItem(STORAGE_KEY);
    const canon = (s: string | null): string => {
      try { return JSON.stringify(JSON.parse(s ?? 'null')); } catch { return s ?? ''; }
    };
    if (canon(fileJson) !== canon(local)) {
      localStorage.setItem(STORAGE_KEY, fileJson);
      window.location.reload();
    }
  } catch (err) {
    console.warn('[desktop] hydrate failed:', err);
  }
}

function audit(msg: string) {
  state.audit = [...state.audit.slice(-199), { t: Date.now(), msg }];
}

type PayloadImportStatus = {
  available: Set<string>;
  missing: Set<string>;
};

function shadowReferencesFiles(fileIds: Set<string>): boolean {
  return state.efs.shadows.some((shadow) => Object.values(shadow.tree).some((node) =>
    node.type === 'file' && Boolean(node.fileId) && fileIds.has(node.fileId!),
  ));
}

/** Delete only payload refs no longer reachable from live, trash, or shadows. */
function deleteUnreferencedPayloads(records: VaultFile[]): void {
  const refs = new Set(records.map((file) => file.payloadRef).filter((ref): ref is string => Boolean(ref)));
  if (!refs.size) return;
  refs.forEach((ref) => {
    const removedIdsForRef = new Set(records.filter((file) => file.payloadRef === ref).map((file) => file.id));
    const referencesRemovedLive = (file: VaultFile) => file.dedupOf !== undefined && removedIdsForRef.has(file.dedupOf);
    const referencesRemovedTrash = (trash: { item: VaultFile }) => referencesRemovedLive(trash.item);
    const referencedByLive = state.vault.some((file) => file.payloadRef === ref || referencesRemovedLive(file));
    const referencedByTrash = state.vaultTrash.some((trash) => trash.item.payloadRef === ref || referencesRemovedTrash(trash));
    if (!referencedByLive && !referencedByTrash && !shadowReferencesFiles(removedIdsForRef)) {
      void delPayload(ref).catch(() => undefined);
    }
  });
}

/* =============================== actions ================================= */

/** Rebuilds the runtime reality list from every user override — the single
    source of truth the 3D multiverse scene renders from. */
function recomputeRealities() {
  setRuntimeRealities(
    computeAllRealities(
      state.customRealities,
      state.deletedRealityIds,
      state.customRealityDescriptions,
      state.customGalaxies,
      state.customRealityMeta as Record<string, RealityMetaOverride>
    )
  );
}

/** Materializes a reality's editable roster: the first galaxy edit copies the
    generated defaults into state so they become fully user-owned. */
function editableGalaxyRoster(realityId: string): GalaxyData[] {
  if (!state.customGalaxies) state.customGalaxies = {};
  if (!state.customGalaxies[realityId]) {
    const generated = getReality(realityId, state.customRealityDescriptions).galaxies ?? [];
    state.customGalaxies[realityId] = generated.map((g) => ({ ...g }));
  }
  return state.customGalaxies[realityId];
}

function commitGalaxyRoster(realityId: string, roster: GalaxyData[], note: string) {
  state.customGalaxies = { ...(state.customGalaxies ?? {}), [realityId]: roster };
  recomputeRealities();
  audit(note);
  notify();
}

export const actions = {
  /* -------------------------- Multiverse & Lore -------------------------- */
  switchReality(realityId: string) {
    const r = getReality(realityId, state.customRealityDescriptions);
    state.activeRealityId = r.id;
    state.bodies = [...r.bodies];
    state.entries = [...r.entries];
    // Filter connections to only link celestial bodies native to this reality
    const validBodyIds = new Set(r.bodies.map((b) => b.id));
    state.connections = (state.connections || []).filter(
      (c) => validBodyIds.has(c.a) && validBodyIds.has(c.b)
    );
    audit(`[Dimensional Barrier] Quantum resonance shifted to Reality: ${r.name}`);
    notify();
  },

  updateRealityDescription(realityId: string, description: string) {
    if (!state.customRealityDescriptions) state.customRealityDescriptions = {};
    state.customRealityDescriptions[realityId] = description.trim();
    const r = REALITIES.find((x) => x.id === realityId);
    if (r) r.description = description.trim();
    audit(`Updated lore for Reality: ${r ? r.name : realityId}`);
    notify();
  },

  resetRealityDescription(realityId: string) {
    if (state.customRealityDescriptions) {
      delete state.customRealityDescriptions[realityId];
    }
    const r = REALITIES.find((x) => x.id === realityId);
    const raw = RAW_REALITIES.find((x) => x.id === realityId);
    if (r && raw) r.description = raw.description;
    audit(`Reset description for Reality: ${r ? r.name : realityId}`);
    notify();
  },

  /** Rename / recolor / reclassify any reality (base or custom). */
  updateRealityMeta(realityId: string, patch: NonNullable<UniverseState['customRealityMeta']>[string]) {
    if (!state.customRealityMeta) state.customRealityMeta = {};
    const prev = state.customRealityMeta[realityId] ?? {};
    state.customRealityMeta = {
      ...state.customRealityMeta,
      [realityId]: { ...prev, ...patch },
    };
    recomputeRealities();
    const r = REALITIES.find((x) => x.id === realityId);
    audit(`[Multiverse Nexus] Reweaved reality identity: ${r?.name ?? realityId}`);
    notify();
  },

  renameReality(realityId: string, name: string) {
    if (!name.trim()) return;
    const cleanName = name.trim();
    actions.updateRealityMeta(realityId, { name: cleanName });

    // Synchronize folder renaming to backend disk
    void realityApi('/api/realities/rename-folder', { realityId, newName: cleanName });
  },

  createReality(newReality: RealityConfig) {
    if (!state.customRealities) state.customRealities = [];
    state.customRealities = [...state.customRealities.filter((x) => x.id !== newReality.id), newReality];
    // If it was previously in bin, remove from bin
    if (state.binRealities) {
      state.binRealities = state.binRealities.filter((b) => b.id !== newReality.id);
    }
    if (state.deletedRealityIds) {
      state.deletedRealityIds = state.deletedRealityIds.filter((id) => id !== newReality.id);
    }
    recomputeRealities();
    audit(`[Multiverse Nexus] Manifested new parallel reality: ${newReality.name}`);
    notify();

    // Synchronize to backend disk folder in real time
    void realityApi('/api/realities/create-folder', newReality);
  },

  deleteReality(realityId: string) {
    // Protect core default reality from deletion
    if (realityId === 'sol-prime') return;

    const doomedReality = REALITIES.find((r) => r.id === realityId) || RAW_REALITIES.find((r) => r.id === realityId);

    if (!state.deletedRealityIds) state.deletedRealityIds = [];
    if (!state.deletedRealityIds.includes(realityId)) {
      state.deletedRealityIds = [...state.deletedRealityIds, realityId];
    }

    // Preserve in Quantum Bin (Dustbin / Recycle Bin)
    if (doomedReality) {
      if (!state.binRealities) state.binRealities = [];
      const trashedItem: any = {
        id: doomedReality.id,
        name: doomedReality.name,
        codeName: doomedReality.codeName,
        spectral: doomedReality.spectral,
        colorA: doomedReality.colorA,
        colorB: doomedReality.colorB,
        description: doomedReality.description,
        deletedAt: Date.now(),
        originalConfig: doomedReality,
      };
      state.binRealities = [
        ...state.binRealities.filter((b) => b.id !== realityId),
        trashedItem,
      ];
    }

    if (state.customRealities) {
      state.customRealities = state.customRealities.filter((r) => r.id !== realityId);
    }
    if (state.customRealityDescriptions) {
      delete state.customRealityDescriptions[realityId];
    }
    /* the collapsed reality takes its galaxy roster & identity overrides with it */
    if (state.customGalaxies) {
      const next = { ...state.customGalaxies };
      delete next[realityId];
      state.customGalaxies = next;
    }
    if (state.customRealityMeta) {
      const next = { ...state.customRealityMeta };
      delete next[realityId];
      state.customRealityMeta = next;
    }
    recomputeRealities();
    // If the active reality was deleted, switch back to Sol-Prime
    if (state.activeRealityId === realityId) {
      const fallback = REALITIES[0] || RAW_REALITIES[0];
      state.activeRealityId = fallback.id;
      state.bodies = [...fallback.bodies];
      state.entries = [...(fallback.entries || [])];
    }
    audit(`[Multiverse Nexus] Transferred reality to Quantum Bin: ${doomedReality?.name ?? realityId}`);
    notify();

    // Synchronize disk transfer to src/realities/bin/
    void realityApi('/api/realities/bin/move-to-bin', { realityId, folderName: doomedReality?.name });
  },

  restoreReality(realityId: string) {
    if (!state.binRealities) return;
    const trashed = state.binRealities.find((b) => b.id === realityId);
    if (!trashed) return;

    // Remove from deleted and bin rosters
    state.binRealities = state.binRealities.filter((b) => b.id !== realityId);
    if (state.deletedRealityIds) {
      state.deletedRealityIds = state.deletedRealityIds.filter((id) => id !== realityId);
    }

    // If it was custom or original, restore config
    if (trashed.originalConfig) {
      if (!state.customRealities) state.customRealities = [];
      if (!RAW_REALITIES.some((r) => r.id === realityId)) {
        state.customRealities = [...state.customRealities.filter((r) => r.id !== realityId), trashed.originalConfig];
      }
    }

    recomputeRealities();
    audit(`[Multiverse Nexus] Restored reality from Quantum Bin: ${trashed.name}`);
    notify();

    // Synchronize restore on disk
    void realityApi('/api/realities/bin/restore', { realityId });
  },

  purgeRealityFromBin(realityId: string) {
    if (!state.binRealities) return;
    const item = state.binRealities.find((b) => b.id === realityId);
    state.binRealities = state.binRealities.filter((b) => b.id !== realityId);
    audit(`[Multiverse Nexus] Permanently purged reality: ${item?.name ?? realityId}`);
    notify();

    // Permanently wipe on disk
    void realityApi('/api/realities/bin/purge', { realityId });
  },

  emptyRealityBin() {
    if (!state.binRealities?.length) return;
    const count = state.binRealities.length;
    state.binRealities = [];
    audit(`[Multiverse Nexus] Emptied Quantum Bin (${count} realities purged)`);
    notify();

    // Empty bin on disk
    void realityApi('/api/realities/bin/empty', {});
  },

  /* -------------------- Major Galaxies of a Reality ---------------------- */
  /** Creates `count` new major galaxies around a reality — each becomes one
      live ellipse orbit on the reality's ring in the multiverse view. */
  addGalaxies(
    realityId: string,
    count = 1,
    opts?: { names?: string[]; type?: string; color?: string }
  ): GalaxyData[] {
    const r = getReality(realityId, state.customRealityDescriptions);
    const roster = editableGalaxyRoster(realityId);
    const created: GalaxyData[] = [];
    for (let i = 0; i < Math.max(1, Math.min(24, count)); i++) {
      const slot = roster.length;
      const g = createGalaxyData({
        realityId,
        realityName: r.name,
        clusters: r.clusters ?? [],
        anchorStarName: r.bodies[0]?.name ?? `${r.name} Anchor Star`,
        worldsCount: r.bodies.length,
        name: opts?.names?.[i],
        type: opts?.type,
        color: opts?.color,
        slotIndex: slot,
      });
      roster.push(g);
      created.push(g);
    }
    commitGalaxyRoster(realityId, [...roster], `[Genesis] ${created.length} major galax${created.length === 1 ? 'y' : 'ies'} condensed in ${r.name}`);
    return created;
  },

  /** Patches any field of a major galaxy (name, type, color, orbit, lore…). */
  updateGalaxy(realityId: string, galaxyId: string, patch: Partial<GalaxyData>) {
    const roster = editableGalaxyRoster(realityId);
    const g = roster.find((x) => x.id === galaxyId);
    if (!g) return;
    Object.assign(g, patch);
    if (patch.name !== undefined) {
      g.name = patch.name.trim() || g.name;
    }
    commitGalaxyRoster(realityId, [...roster], `[Genesis] Galaxy reweaved: ${g.name}`);
  },

  deleteGalaxy(realityId: string, galaxyId: string) {
    const roster = editableGalaxyRoster(realityId);
    const g = roster.find((x) => x.id === galaxyId);
    if (!g) return;
    if (g.isHomeGalaxy) return; /* the home galaxy anchors the whole hierarchy */
    const next = roster.filter((x) => x.id !== galaxyId);
    commitGalaxyRoster(realityId, next, `[Genesis] Galaxy dissolved: ${g.name}`);
  },

  /** Moves the "home" marker (the galaxy that hosts the anchor star system). */
  setHomeGalaxy(realityId: string, galaxyId: string) {
    const roster = editableGalaxyRoster(realityId);
    const target = roster.find((x) => x.id === galaxyId);
    if (!target) return;
    roster.forEach((g) => { g.isHomeGalaxy = g.id === galaxyId; });
    commitGalaxyRoster(realityId, [...roster], `[Genesis] Home galaxy set: ${target.name}`);
  },

  /* --------------------------- Celestial Bodies -------------------------- */
  setMeaning(id: string, meaning: CosmicBody['meaning']) {
    const b = state.bodies.find((x) => x.id === id);
    if (b) {
      b.meaning = meaning;
      notify();
    }
  },

  renameBody(id: string, name: string) {
    const b = state.bodies.find((x) => x.id === id);
    if (b && name.trim()) {
      b.name = name.trim();
      notify();
    }
  },

  setNote(id: string, note: string) {
    const b = state.bodies.find((x) => x.id === id);
    if (b) {
      b.note = note;
      notify();
    }
  },

  addBody(name: string, kind: BodyKind, meaning: Meaning): CosmicBody {
    const TAU = Math.PI * 2;
    const r = Math.random;
    const body: CosmicBody = {
      id: newId(),
      name,
      kind,
      meaning,
      note: '',
      createdAt: Date.now(),
      radius: procRadius(kind),
      clouds: kind === 'planet' && r() > 0.4,
      palette: procPalette(kind),
      orbit: {
        a: 170 + r() * 70,
        speed: TAU / (4000 + r() * 4000),
        phase: r() * TAU,
        incl: (r() - 0.5) * 0.4,
      },
    };
    state.bodies.push(body);
    notify();
    return body;
  },

  removeBody(id: string) {
    if (id === 'anchor' || id === 'eventide') return;
    state.bodies = state.bodies.filter((b) => b.id !== id);
    state.entries = state.entries.filter((e) => e.planetId !== id);
    state.connections = state.connections.filter((c) => c.a !== id && c.b !== id);
    notify();
  },

  deleteBody(id: string) {
    actions.removeBody(id);
  },

  connect(a: string, b: string) {
    if (a === b) return;
    if (
      state.connections.some(
        (c) => (c.a === a && c.b === b) || (c.a === b && c.b === a)
      )
    )
      return;
    state.connections.push({ id: newId(), a, b, createdAt: Date.now() });
    notify();
  },

  disconnect(id: string) {
    state.connections = state.connections.filter((c) => c.id !== id);
    notify();
  },

  /* ---------------------------- Diary & Journal -------------------------- */
  addEntry(planetId: string): DiaryEntry {
    const e: DiaryEntry = {
      id: newId(),
      planetId,
      title: 'Untitled page',
      body: '',
      tags: [],
      bookmarked: false,
      archived: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      attachments: [],
    };
    state.entries.push(e);
    notify();
    return e;
  },

  updateEntry(id: string, patch: Partial<DiaryEntry>) {
    const e = state.entries.find((x) => x.id === id);
    if (e) {
      const safePatch = typeof patch.body === 'string'
        ? { ...patch, body: sanitizeDiaryHtml(patch.body) }
        : patch;
      Object.assign(e, safePatch, { updatedAt: Date.now() });
      notify();
    }
  },

  deleteEntry(id: string) {
    const removed = state.entries.find((x) => x.id === id);
    state.entries = state.entries.filter((x) => x.id !== id);
    removed?.attachments.forEach((attachment) => {
      if (attachment.payloadRef) void delLocalPayload(attachment.payloadRef).catch(() => undefined);
    });
    notify();
  },

  toggleBookmark(id: string) {
    const e = state.entries.find((x) => x.id === id);
    if (e) {
      e.bookmarked = !e.bookmarked;
      notify();
    }
  },

  addAttachment(entryId: string, att: Omit<Attachment, 'id'>) {
    const e = state.entries.find((x) => x.id === entryId);
    if (e) {
      e.attachments.push({ ...att, id: newId() });
      e.updatedAt = Date.now();
      notify();
      queueMicrotask(() => void externalizeLargeDiaryAttachments());
    }
  },

  removeAttachment(entryId: string, attId: string) {
    const e = state.entries.find((x) => x.id === entryId);
    if (e) {
      const removed = e.attachments.find((a) => a.id === attId);
      e.attachments = e.attachments.filter((a) => a.id !== attId);
      if (removed?.payloadRef) void delLocalPayload(removed.payloadRef).catch(() => undefined);
      notify();
    }
  },

  deleteAttachment(entryId: string, attId: string) {
    actions.removeAttachment(entryId, attId);
  },

  updateAttachment(
    entryId: string,
    attId: string,
    patch: Partial<Attachment>
  ) {
    const e = state.entries.find((x) => x.id === entryId);
    const a = e?.attachments.find((x) => x.id === attId);
    if (e && a) {
      if (patch.dataUrl && a.payloadRef) {
        void delLocalPayload(a.payloadRef).catch(() => undefined);
        delete a.payloadRef;
        delete a.payloadMissing;
      }
      Object.assign(a, patch);
      e.updatedAt = Date.now();
      notify();
      queueMicrotask(() => void externalizeLargeDiaryAttachments());
    }
  },

  /* --------------------- EFS — the Eventide Filesystem ------------------- */
  addVaultFiles(files: VaultFile[]) {
    const activeRid = state.activeRealityId || 'sol-prime';
    const stamped = files.map((f) => ({ ...f, realityId: f.realityId ?? activeRid }));
    stamped.forEach((f) => {
      if (!efsNodeOf(state.efs, f)) {
        const parent = f.dirId && state.efs.nodes[f.dirId] ? f.dirId : EFS_ROOT;
        efsAddFileNode(state.efs, f.id, parent, f.name);
      }
    });
    state.vault.push(...stamped);
    notify();
  },

  updateVaultFile(id: string, patch: Partial<VaultFile>) {
    const f = state.vault.find((x) => x.id === id);
    if (f) {
      Object.assign(f, patch);
      notify();
    }
  },

  deleteVaultFile(id: string) {
    const removed = state.vault.find((x) => x.id === id);
    if (removed) {
      const node = efsNodeOf(state.efs, removed);
      if (node) delete state.efs.nodes[node.id];
      state.vault = state.vault.filter((x) => x.id !== id);
      deleteUnreferencedPayloads([removed]);
    }
    efsBump(state.efs);
    notify();
  },

  deleteVaultFiles(ids: string[]) {
    const set = new Set(ids);
    const removed = state.vault.filter((file) => set.has(file.id));
    removed.forEach((file) => {
      const node = efsNodeOf(state.efs, file);
      if (node) delete state.efs.nodes[node.id];
    });
    state.vault = state.vault.filter((file) => !set.has(file.id));
    deleteUnreferencedPayloads(removed);
    efsBump(state.efs);
    notify();
  },

  efsCreateFolder(parentId: string, name: string, color?: string): string | null {
    if (!state.efs.nodes[parentId]) return null;
    const node = efsMkdir(state.efs, parentId, name, color);
    audit(`[EFS] mkdir ${efsPathString(state.efs, node.id)} · gen ${state.efs.super.generation}`);
    notify();
    return node.id;
  },

  efsRenameNode(nodeId: string, name: string): boolean {
    const node = state.efs.nodes[nodeId];
    if (!efsRename(state.efs, nodeId, name)) return false;
    if (node?.type === 'file' && node.fileId) {
      const f = state.vault.find((x) => x.id === node.fileId);
      if (f) f.name = node.name;
    }
    audit(`[EFS] rename → ${name}`);
    notify();
    return true;
  },

  efsSetDirColor(nodeId: string, color?: string) {
    const n = state.efs.nodes[nodeId];
    if (!n) return;
    n.color = color;
    notify();
  },

  efsTogglePin(nodeId: string) {
    const n = state.efs.nodes[nodeId];
    if (!n) return;
    n.pinned = !n.pinned;
    notify();
  },

  efsSetTags(nodeId: string, tags: string[]) {
    const n = state.efs.nodes[nodeId];
    if (!n) return;
    n.tags = tags.length ? tags : undefined;
    notify();
  },

  efsMoveNodes(nodeIds: string[], destDirId: string): number {
    const moved = efsMove(state.efs, nodeIds, destDirId);
    if (moved) {
      const nodeMap = state.efs.nodes;
      state.vault.forEach((f) => {
        const node = Object.values(nodeMap).find((n) => n.type === 'file' && n.fileId === f.id);
        if (node && node.parentId && f.dirId !== node.parentId) {
          f.dirId = node.parentId;
        }
      });
      audit(`[EFS] moved ${moved} node(s) · gen ${state.efs.super.generation}`);
      notify();
    }
    return moved;
  },

  efsHealVault(): number {
    const healed = efsHeal(state.efs, state.vault);
    if (healed) {
      audit(`[EFS] healed ${healed} detached node(s)`);
      notify();
    }
    return healed;
  },

  /** Zero-copy CoW clone: new tree nodes + cloned records sharing payload ids.
   *  Returns the ids of the top-level nodes created in destDirId. */
  efsCopyNodes(nodeIds: string[], destDirId: string): string[] {
    if (!state.efs.nodes[destDirId] || state.efs.nodes[destDirId].type !== 'dir') return [];
    const created: string[] = [];
    const cloneFileInto = (srcNode: VfsNode, destParent: string): string | null => {
      const orig = srcNode.fileId ? state.vault.find((f) => f.id === srcNode.fileId) : null;
      if (!orig) return null;
      const sharesPayload = !!orig.payloadRef;
      const clone: VaultFile = {
        ...orig,
        id: newId(),
        dirId: destParent,
        addedAt: Date.now(),
        versions: orig.versions ? JSON.parse(JSON.stringify(orig.versions)) : undefined,
        dedupOf: sharesPayload ? (orig.dedupOf ?? orig.id) : undefined,
      };
      state.vault.push(clone);
      const node = efsAddFileNode(state.efs, clone.id, destParent, srcNode.name);
      node.tags = srcNode.tags ? [...srcNode.tags] : undefined;
      return node.id;
    };
    const copyDir = (srcDirId: string, destParent: string, nameOverride?: string): string => {
      const src = state.efs.nodes[srcDirId];
      if (!src) return '';
      const dirNode: VfsNode = {
        id: newId(),
        type: 'dir',
        name: efsUniqueName(state.efs, destParent, nameOverride ?? src.name),
        parentId: destParent,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        color: src.color,
      };
      state.efs.nodes[dirNode.id] = dirNode;
      const { dirs, fileIds } = efsChildren(state.efs, srcDirId);
      fileIds.forEach((fid) => cloneFileInto(state.efs.nodes[fid], dirNode.id));
      dirs.forEach((d) => copyDir(d.id, dirNode.id));
      return dirNode.id;
    };
    for (const id of nodeIds) {
      const n = state.efs.nodes[id];
      if (!n || n.id === EFS_ROOT) continue;
      if (n.type === 'file') {
        const made = cloneFileInto(n, destDirId);
        if (made) created.push(made);
      } else {
        const made = copyDir(id, destDirId);
        if (made) created.push(made);
      }
    }
    if (created.length) {
      efsBump(state.efs);
      audit(`[EFS] forked ${created.length} object(s) into ${efsPathString(state.efs, destDirId)} · 0 payload bytes allocated`);
      notify();
    }
    return created;
  },

  /** Forks a directory in place — the reflink equivalent. Returns the new dir id. */
  efsForkDir(dirId: string): string | null {
    const src = state.efs.nodes[dirId];
    if (!src || src.type !== 'dir' || dirId === EFS_ROOT) return null;
    const parent = src.parentId ?? EFS_ROOT;
    const made = this.efsCopyNodes([dirId], parent);
    if (made.length) {
      const node = state.efs.nodes[made[0]];
      if (node) node.name = efsUniqueName(state.efs, parent, `${src.name} fork`);
      audit(`[EFS] fork '${src.name}' → zero-copy CoW clone`);
      notify();
    }
    return made[0] ?? null;
  },

  /** Moves selection to trash (restorable): files + whole dir subtrees. */
  efsTrash(nodeIds: string[]) {
    const at = Date.now();
    const entries: UniverseState['vaultTrash'] = [];
    const doomedFiles = new Set<string>();
    const doomedNodes = new Set<string>();
    for (const id of nodeIds) {
      const n = state.efs.nodes[id];
      if (!n || id === EFS_ROOT) continue;
      if (n.type === 'file' && n.fileId) {
        const f = state.vault.find((x) => x.id === n.fileId);
        if (f) {
          entries.push({ item: f, deletedAt: at, fromDirId: n.parentId ?? EFS_ROOT, node: { ...n } });
          doomedFiles.add(f.id);
        }
        doomedNodes.add(id);
      } else if (n.type === 'dir') {
        const { dirIds, fileIds } = efsSubtreeIds(state.efs, id);
        const dirNodes = dirIds.map((d) => ({ ...state.efs.nodes[d] }));
        fileIds.forEach((fid) => {
          const node = state.efs.nodes[fid];
          const f = node?.fileId ? state.vault.find((x) => x.id === node.fileId) : null;
          if (f) {
            entries.push({
              item: f, deletedAt: at,
              fromDirId: node.parentId ?? EFS_ROOT,
              node: { ...node }, dirNodes, dirName: n.name,
            });
            doomedFiles.add(f.id);
          }
          doomedNodes.add(fid);
        });
        dirIds.forEach((d) => doomedNodes.add(d));
      }
    }
    if (!entries.length && !doomedNodes.size) return;
    state.vaultTrash = [...state.vaultTrash, ...entries];
    state.vault = state.vault.filter((x) => !doomedFiles.has(x.id));
    doomedNodes.forEach((id) => { delete state.efs.nodes[id]; });
    efsBump(state.efs);
    audit(`[EFS] trashed ${entries.length} object(s)`);
    notify();
  },

  /* ----------------------- The Void (Recycle Bin) ------------------------ */
  releaseVaultFile(id: string) {
    this.releaseVaultFiles([id]);
  },

  releaseVaultFiles(ids: string[]) {
    const set = new Set(ids);
    const at = Date.now();
    const released: UniverseState['vaultTrash'] = [];
    state.vault.forEach((f) => {
      if (!set.has(f.id)) return;
      const node = efsNodeOf(state.efs, f);
      released.push({
        item: f, deletedAt: at,
        fromDirId: node?.parentId ?? EFS_ROOT,
        node: node ? { ...node } : undefined,
      });
      if (node) delete state.efs.nodes[node.id];
    });
    if (!released.length) return;
    state.vaultTrash = [...state.vaultTrash, ...released];
    state.vault = state.vault.filter((x) => !set.has(x.id));
    efsBump(state.efs);
    notify();
  },

  restoreTrashed(id: string) {
    const t = state.vaultTrash.find((x) => x.item.id === id);
    if (!t) return;
    /* bring back any trashed directory chain first, then the file's node */
    (t.dirNodes ?? []).forEach((d) => {
      if (!state.efs.nodes[d.id]) state.efs.nodes[d.id] = { ...d };
    });
    if (t.node && !state.efs.nodes[t.node.id]) {
      state.efs.nodes[t.node.id] = { ...t.node, parentId: t.fromDirId ?? EFS_ROOT };
    }
    state.vaultTrash = state.vaultTrash.filter((x) => x.item.id !== id);
    if (!state.vault.some((x) => x.id === t.item.id)) state.vault = [...state.vault, t.item];
    efsBump(state.efs);
    audit(`[EFS] restored ${t.item.name}${t.dirName ? ` (from trashed dir '${t.dirName}')` : ''}`);
    notify();
  },

  purgeTrashed(id: string) {
    const removed = state.vaultTrash.find((trash) => trash.item.id === id)?.item;
    state.vaultTrash = state.vaultTrash.filter((trash) => trash.item.id !== id);
    if (removed) deleteUnreferencedPayloads([removed]);
    notify();
  },

  purgeTrash() {
    const removed = state.vaultTrash.map((trash) => trash.item);
    state.vaultTrash = [];
    deleteUnreferencedPayloads(removed);
    notify();
  },

  /* --------------------------- Version Control --------------------------- */
  saveVersion(id: string, label?: string) {
    const f = state.vault.find((x) => x.id === id);
    if (!f || f.content == null) return;
    const last = f.versions?.[f.versions.length - 1];
    if (last && last.content === f.content) return;
    const v: FileVersion = {
      id: newId(),
      savedAt: Date.now(),
      label: label ?? 'snapshot',
      size: f.content.length,
      content: f.content,
    };
    f.versions = [...(f.versions ?? []), v].slice(-10);
    notify();
  },

  restoreVersion(id: string, versionId: string) {
    const f = state.vault.find((x) => x.id === id);
    const v = f?.versions?.find((x) => x.id === versionId);
    if (!f || !v || v.content == null) return;
    if (f.content !== v.content) {
      this.saveVersion(id, 'before restore');
    }
    f.content = v.content;
    f.size = v.content.length;
    notify();
  },

  /* ------------------------ Universe Portability ------------------------- */
  resetUniverse() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    state = primeState(createInitialSeed(newId));
    notify();
  },

  importUniverse(next: UniverseState, payloadStatus?: PayloadImportStatus) {
    if (!next || !Array.isArray(next.bodies) || !Array.isArray(next.vault))
      return;
    const applyPayloadStatus = (file: VaultFile): VaultFile => {
      if (!file.payloadRef || !payloadStatus) return file;
      if (payloadStatus.missing.has(file.payloadRef)) {
        return { ...file, payloadMissing: true, sealed: true };
      }
      if (payloadStatus.available.has(file.payloadRef) && file.payloadMissing) {
        const restored = { ...file };
        delete restored.payloadMissing;
        if (restored.sealed) delete restored.sealed;
        return restored;
      }
      return file;
    };
    const applyAttachmentStatus = (attachment: Attachment): Attachment => {
      if (!attachment.payloadRef || !payloadStatus) return attachment;
      if (payloadStatus.missing.has(attachment.payloadRef)) {
        return { ...attachment, dataUrl: '', payloadMissing: true };
      }
      if (payloadStatus.available.has(attachment.payloadRef) && attachment.payloadMissing) {
        const restored = { ...attachment };
        delete restored.payloadMissing;
        return restored;
      }
      return attachment;
    };
    next.entries = sanitizeDiaryEntries(next.entries).map((entry) => ({
      ...entry,
      attachments: entry.attachments.map(applyAttachmentStatus),
    }));
    next.vault = normalizeVaultFiles(next.vault).map(applyPayloadStatus);
    next.vaultTrash = Array.isArray(next.vaultTrash)
      ? next.vaultTrash.map((trash) => ({ ...trash, item: applyPayloadStatus(normalizeLegacyLock(trash.item)) }))
      : [];
    if (!Array.isArray(next.connections)) next.connections = [];
    if (!Array.isArray(next.vaultTrash)) next.vaultTrash = [];
    if (!Array.isArray(next.vaultUsers)) next.vaultUsers = [];
    if (!Array.isArray(next.audit)) next.audit = [];
    if (!next.customGalaxies || typeof next.customGalaxies !== 'object') next.customGalaxies = {};
    if (!next.customRealityMeta || typeof next.customRealityMeta !== 'object') next.customRealityMeta = {};
    /* imported snapshots may predate EFS — migrate the flat folders across */
    if (!next.efs || !Object.keys(next.efs.nodes ?? {}).length) migrateLegacyVault(next);
    efsHeal(next.efs, next.vault);

    // Ensure anchor & eventide core system bodies exist
    const defaults = seedBodies(Date.now(), DAY_MS);
    const anchor = defaults.find((b) => b.id === 'anchor')!;
    const eventide = defaults.find((b) => b.id === 'eventide')!;
    if (!next.bodies.some((b) => b.id === 'anchor')) next.bodies.unshift(anchor);
    if (!next.bodies.some((b) => b.id === 'eventide')) next.bodies.push(eventide);

    state = next;
    recomputeRealities();
    notify();
    queueMicrotask(() => void externalizeLargeDiaryAttachments());
  },

  /* ----------------------------- Identities ------------------------------ */
  addUser(u: UniverseState['vaultUsers'][number]) {
    state.vaultUsers = [...state.vaultUsers, u];
    notify();
  },

  updateUser(
    id: string,
    patch: Partial<UniverseState['vaultUsers'][number]>
  ) {
    state.vaultUsers = state.vaultUsers.map((u) =>
      u.id === id ? { ...u, ...patch } : u
    );
    notify();
  },

  removeUser(id: string) {
    state.vaultUsers = state.vaultUsers.filter((u) => u.id !== id);
    notify();
  },

  touchUser(id: string) {
    this.updateUser(id, { lastSeen: Date.now() });
  },

  setSecrets(s: VaultSecrets | null) {
    state.secrets = s;
    audit(s ? 'key ring re-sealed' : 'key ring emptied');
    notify();
  },

  /* ------------------- EFS CoW: shadows, fork, integrity ----------------- */

  efsShadow(name: string, description?: string): VfsShadow {
    const s = efsCreateShadow(state.efs, state.vault, name, description);
    audit(`[EFS] shadow '${s.name}' frozen at gen ${s.generation} (${s.fileCount} files, ${s.dirCount} dirs)`);
    notify();
    return s;
  },

  efsDeleteShadow(shadowId: string) {
    efsDeleteShadow(state.efs, shadowId);
    audit('[EFS] shadow deleted');
    notify();
  },

  efsRestoreShadow(shadowId: string) {
    const shadow = state.efs.shadows.find((s) => s.id === shadowId);
    if (!shadow) return;
    /* automatic safety shadow, so rollback is always reversible */
    efsCreateShadow(state.efs, state.vault, `pre-rollback-${Date.now().toString(36)}`, 'Automatic safety shadow before rollback');
    state.efs.nodes = JSON.parse(JSON.stringify(shadow.tree));
    /* The restored tree defines the live vault. Reconcile metadata from both
       live and trash so a file brought back by the shadow is not lost. */
    const restoredNodes = new Map<string, VfsNode>();
    Object.values(state.efs.nodes).forEach((node) => {
      if (node.type === 'file' && node.fileId) restoredNodes.set(node.fileId, node);
    });
    const metadata = new Map<string, VaultFile>();
    state.vault.forEach((file) => metadata.set(file.id, file));
    state.vaultTrash.forEach((trash) => metadata.set(trash.item.id, trash.item));

    /* Safety guard: If restoring a directory-only or empty legacy shadow, preserve
       all existing files and heal them into the restored directory tree */
    if (restoredNodes.size === 0 && metadata.size > 0) {
      efsHeal(state.efs, state.vault);
      efsBump(state.efs);
      audit(`[EFS] rollback to '${shadow.name}' (gen ${shadow.generation}) · preserved ${state.vault.length} files`);
      notify();
      return;
    }

    /* Move any active files not present in the restored snapshot into Trash */
    const doomed = state.vault.filter((file) => !restoredNodes.has(file.id));
    if (doomed.length > 0) {
      const at = Date.now();
      doomed.forEach((file) => {
        state.vaultTrash.push({
          item: file,
          deletedAt: at,
          fromDirId: file.dirId ?? EFS_ROOT,
        });
      });
    }

    state.vault = [...metadata.values()]
      .filter((file) => restoredNodes.has(file.id))
      .map((file) => {
        const node = restoredNodes.get(file.id)!;
        const parent = node.parentId && state.efs.nodes[node.parentId]?.type === 'dir' ? node.parentId : EFS_ROOT;
        return { ...file, dirId: parent };
      });
    state.vaultTrash = state.vaultTrash.filter((trash) => !restoredNodes.has(trash.item.id));
    efsHeal(state.efs, state.vault);
    efsBump(state.efs);
    audit(`[EFS] rollback to '${shadow.name}' (gen ${shadow.generation})`);
    notify();
  },

  async efsRunScrub(onProgress?: (p: { done: number; total: number; current: string }) => void): Promise<EfsScrubReport> {
    const report = await efsScrub(state.vault, getPayload, onProgress);
    state.efs.scrub = report;
    state.efs.super.lastScrubAt = Date.now();
    audit(`[EFS scrub] ${report.filesScanned} files · ${report.errorsFound} errors · ${report.errorsCorrected} repaired — ${report.status.toUpperCase()}`);
    notify();
    return report;
  },

  efsRunDedup(): { collapsed: number; savedBytes: number } {
    const rep = efsDedup(state.vault);
    state.efs.super.dedupBytes += rep.savedBytes;
    audit(`[EFS dedup] collapsed ${rep.collapsed} duplicates · ${rep.savedBytes} bytes now shared extents`);
    notify();
    return rep;
  },

  logAudit(msg: string) {
    audit(msg);
    notify();
  },
};

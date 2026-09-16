/* ------------------------------- cosmos -------------------------------- */

import type { GalaxyData } from './realities/hierarchyTypes';

export type BodyKind = 'star' | 'planet' | 'dwarf' | 'nebula' | 'hole' | 'vault';
export type Meaning = 'memory' | 'dream' | 'person' | 'project' | 'moment' | 'idea' | 'chapter' | 'unresolved' | null;

export const MEANING_LABEL: Record<string, string> = {
  memory: 'memory', dream: 'dream', person: 'person', project: 'project',
  moment: 'moment', idea: 'idea', chapter: 'chapter', unresolved: 'unresolved',
};

export const MEANINGS: { id: Exclude<Meaning, null>; desc: string; color: string }[] = [
  { id: 'memory', desc: 'something that happened and stays', color: '#7fc4e8' },
  { id: 'dream', desc: 'a night-logic, unverified', color: '#b49ae8' },
  { id: 'person', desc: 'someone this world is about', color: '#f2a0b0' },
  { id: 'project', desc: 'work in motion', color: '#f2c178' },
  { id: 'moment', desc: 'brief, bright, gone', color: '#e0785a' },
  { id: 'idea', desc: 'a seed, not yet a planet', color: '#9fd8a8' },
  { id: 'chapter', desc: 'an era of the life', color: '#d8b48a' },
  { id: 'unresolved', desc: 'still falling inward', color: '#8b93a8' },
];

export interface Palette { deep: string; base: string; high: string; atmo: string; ice: string; }

export interface Orbit { a: number; speed: number; phase: number; incl: number; }

export interface CosmicBody {
  id: string;
  name: string;
  kind: BodyKind;
  meaning: Meaning;
  note: string;
  createdAt: number;
  radius: number;
  rings?: boolean;
  clouds?: boolean;
  nightside?: boolean;
  palette: Palette;
  orbit: Orbit;
}

export interface Connection { id: string; a: string; b: string; createdAt: number; }

/* ------------------------------- diary --------------------------------- */

export type Mood = 'calm' | 'warm' | 'bright' | 'heavy' | 'burning';
export type Weather = 'clear' | 'rain' | 'storm' | 'fog' | 'dust';

export interface Attachment {
  id: string;
  kind: 'image' | 'audio' | 'video' | 'file' | 'code';
  name: string;
  dataUrl: string;
  /** Large diary media may live in OPFS/IndexedDB instead of localStorage. */
  payloadRef?: string;
  payloadMissing?: boolean;
  isGif?: boolean;
  peaks?: number[];
  duration?: number;
  size?: number;
  fileExt?: string;
  codeSnippet?: string;
  lineCount?: number;
  mimeType?: string;
  /* freeform position on the page — glued exactly where you drag it.
     x is % of the page width, y is px down from the top of the page.
     w is % width; h (px) only applies to voice memos. */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  /* finishing touches */  tone?: string;   /* '' | 'noir' | 'warm' | 'fade' — photo grading */
  tilt?: boolean;  /* hand-placed slight rotation */
  /* sealed INTO the paper: occupies its area inline like a typed sentence.
     false/undefined = free-floating plate you drag anywhere. */
  glued?: boolean;
}

export interface DiaryEntry {
  id: string;
  planetId: string;
  title: string;
  body: string;
  tags: string[];
  bookmarked: boolean;
  archived: boolean;
  mood?: Mood;
  weather?: Weather;
  createdAt: number;
  updatedAt: number;
  attachments: Attachment[];
}

/* ------------------------------- vault --------------------------------- */

export type VaultKind = 'document' | 'image' | 'audio' | 'video' | 'dataset' | 'archive' | 'iso' | 'exe' | 'application' | 'game' | 'other';

/* --------------------- EFS — the Eventide Filesystem -------------------- */
/* A copy-on-write hierarchical filesystem. The tree lives in VfsState.nodes
   (an inode-style table with parent pointers); file payloads never live in
   the tree — they are immutable, id-addressed bytes in OPFS/IndexedDB, so
   snapshots share payloads for free (true CoW) and forks are zero-copy. */

export type VfsNodeType = 'dir' | 'file';

export interface VfsNode {
  id: string;
  type: VfsNodeType;
  name: string;
  parentId: string | null;   /* null only for the root */
  createdAt: number;
  modifiedAt: number;
  /* dirs */
  color?: string;            /* user color dot */
  /* files */
  fileId?: string;           /* → VaultFile.id (the payload record) */
  tags?: string[];
  pinned?: boolean;
}

export interface VfsShadow {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  generation: number;        /* superblock generation at freeze time */
  dirCount: number;
  fileCount: number;
  bytes: number;
  tree: Record<string, VfsNode>;  /* frozen metadata tree (payload ids kept,
                                     inline content stripped — extents shared) */
}

export interface EfsSuperblock {
  uuid: string;
  label: string;             /* 'eventide-efs' */
  createdAt: number;
  generation: number;        /* bumped on every tree mutation */
  dedupBytes: number;        /* payload bytes saved by dedup */
  lastScrubAt?: number;
}

export interface EfsScrubReport {
  startedAt: number;
  finishedAt?: number;
  filesScanned: number;
  bytesScanned: number;
  errorsFound: number;
  errorsCorrected: number;
  status: 'idle' | 'running' | 'clean' | 'repaired' | 'corrupted';
  log?: string[];
}

export interface VfsState {
  rootId: string;                          /* always 'vfs-root' */
  nodes: Record<string, VfsNode>;
  super: EfsSuperblock;
  shadows: VfsShadow[];
  scrub?: EfsScrubReport;
}

export interface VaultLock {
  version: 1;
  salt: string;
  verifier: string;
  rounds: number;
}

export interface VaultFile {
  id: string;
  name: string;
  kind: VaultKind;
  mime: string;
  size: number;
  addedAt: number;
  dirId?: string;            /* parent EFS directory node (root when absent) */
  checksum?: string;         /* sha-256 hex of the plaintext payload — integrity & dedup */
  dedupOf?: string;          /* payload id this file shares bytes with (zero-copy) */
  content?: string;          /* legacy inline payload; new imports use encrypted payloads */
  payloadRef?: string;       /* payload lives in OPFS/IndexedDB under this key */
  payloadEncrypted?: boolean;/* new payload was written through the encrypted store */
  payloadMissing?: boolean;  /* metadata was restored but original payload bytes were unavailable */
  thumb?: string;            /* tiny inline preview for images */
  sealed?: boolean;          /* payload lives in the execution layer only */
  lock?: VaultLock;          /* versioned verifier; the object password is never stored */
  legacyLock?: string;       /* one-time migration field for old plaintext locks */
  versions?: FileVersion[];  /* edit history for inline-payload objects */
  realityId?: string;        /* reality continuum id this vault file belongs to */
}

export interface FileVersion {
  id: string;
  savedAt: number;
  label: string;
  size: number;
  content?: string;
  generation?: number;
  csum?: string;
}

export interface TrashedFile {
  item: VaultFile;
  deletedAt: number;
  fromDirId?: string;        /* original parent so restore lands back in place */
  node?: VfsNode;            /* the file's own tree node, re-attached on restore */
  dirNodes?: VfsNode[];      /* when a whole directory was trashed: its frozen
                                subtree (dirs), restored alongside the files */
  dirName?: string;
}

export interface AvatarFit { zoom: number; px: number; py: number; }

export interface VaultUser {
  id: string;
  name: string;
  avatar: string | null;
  avatarFrames?: string[] | null;
  avatarFps?: number | null;
  avatarFit?: AvatarFit | null;
  avatarNote?: string | null;
  createdAt: number;
  lastSeen: number;
  salt: string;
  verifier: string;
  kdfRounds?: number;
}

export interface PasswordRecord {
  id: string;
  label: string;
  user: string;
  secret: string;
  category?: string;
  notes?: string;
  updatedAt: number;
}

export interface VaultSecrets { salt: string; iv: string; data: string; rounds?: number; }

export interface AuditEntry { t: number; msg: string; }

/* ------------------------------ universe ------------------------------- */

/* user-authored identity/appearance overrides for a reality (rename, recolor,
   reclassify) — keyed by reality id, applied when the runtime list is built */
export interface RealityMetaPatch {
  name?: string;
  codeName?: string;
  spectral?: string;
  colorA?: string;
  colorB?: string;
  starColor?: string; /* the anchor star's aura — core surface + corona light */
}

export interface UniverseState {
  activeRealityId?: string;
  customRealityDescriptions?: Record<string, string>;
  customRealities?: any[];
  deletedRealityIds?: string[];
  /* user-authored major-galaxy rosters — fully replaces the deterministic
     defaults for that reality (created/renamed/edited/deleted galaxies) */
  customGalaxies?: Record<string, GalaxyData[]>;
  customRealityMeta?: Record<string, RealityMetaPatch>;
  bodies: CosmicBody[];
  entries: DiaryEntry[];
  connections: Connection[];
  vault: VaultFile[];
  efs: VfsState;             /* the Eventide Filesystem — tree, shadows, superblock */
  vaultTrash: TrashedFile[]; /* released matter lingers here before the final purge */
  vaultUsers: VaultUser[];
  secrets: VaultSecrets | null;
  audit: AuditEntry[];
  visitedAt: number;
  version?: number;          /* migration marker — bumped when stored data needs a one-time fix */
}

export interface TimelineEvent { t: number; label: string; kind: 'body' | 'entry' | 'link' | 'vault'; refId: string; }

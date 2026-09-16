# MY UNIVERSE — System Analysis & Architecture Record

> **Document Type:** Deep sector-by-sector analysis of the live codebase (September 2026 audit).
> **Purpose:** Durable understanding to guide every future upgrade wave. Complements `README.md`
> (which is the reconstruction blueprint) by documenting *what actually is*, including the
> subsystems the README predates (reality daemon, Quantum Bin, native engine card, server CRUD).
> **Status:** Authoritative audit snapshot before the "Foundation & Health" upgrade wave.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Engine Sector (WebGL Cosmos)](#2-engine-sector-webgl-cosmos)
3. [Physics Sector](#3-physics-sector)
4. [State & Storage Sector](#4-state--storage-sector)
5. [Crypto Sector](#5-crypto-sector)
6. [Executors Sector (Sandboxed Runtimes)](#6-executors-sector-sandboxed-runtimes)
7. [Server Sector (Express + Reality Daemon)](#7-server-sector-express--reality-daemon)
8. [UI Sector](#8-ui-sector)
9. [Realities Sector (Multiverse Content)](#9-realities-sector-multiverse-content)
10. [Native C++ Sector](#10-native-c-sector)
11. [Known Debt Register](#11-known-debt-register)
12. [Upgrade Roadmap (Waves)](#12-upgrade-roadmap-waves)

---

## 1. System Overview

**MY UNIVERSE** is an offline-first, browser-local SPA (React 18 + TypeScript 5 + Vite 6 +
Tailwind v4 + Three.js r185) that turns a personal life into a living 3D cosmos:

- Celestial bodies are memories, people, projects, dreams (`CosmicBody.meaning`).
- Every body hosts a **Living Digital Diary** (rich text, voice memos, media plates).
- The **Eventide Black Hole** hosts the **Universal Vault**: an encrypted, inode-based
  copy-on-write filesystem (EFS) with snapshots, dedup, bit-rot scrubbing, and a sandboxed
  code-execution engine (HTML apps, JS, Python via Pyodide, ISO discs, ZIP archives).
- Navigation spans **11 hierarchy stages** (multiverse → cosmic web → superclusters →
  clusters → galaxies → stellar system → planet → diary → vault), bridged by four distinct
  **Kamui traversal** effects.
- **8 canonical realities** live in `src/realities/` as first-class modules (collected via `import.meta.glob`),
  plus user-created realities persisted in localStorage and mirrored to disk by a Node server.

**Entry chain:** `index.html` → `src/main.tsx` → `src/App.tsx` (mode coordinator) →
lazy `import('./engine/engine')`.

**Run modes:** `npm run dev` (tsx server/index.ts → Express + Vite middleware on :3000),
`npm run build` (vite build + esbuild server bundle), `npm run typecheck` (tsc --noEmit).

---

## 2. Engine Sector (WebGL Cosmos)

All rendering lives in one class: **`UniverseEngine`** in `src/engine/engine.ts`
(~5,714 lines / 261 KB). Lazily constructed by `App.tsx` with `(canvas, bodies, callbacks)`;
the engine→React contract is `EngineCallbacks` (`engine.ts:39-61`), wired at `App.tsx:130-264`.
Dev escape hatch: `window.__ENGINE__`.

### 2.1 Render pipeline
- `THREE.WebGLRenderer` + `EffectComposer`: `RenderPass → UnrealBloomPass → OutputPass`
  (`engine.ts:546-553`).
- Low-power device detection lowers pixel ratio/AA (`:493-496`).
- Eager `renderer.compile()` of the whole scene at boot to avoid mid-action shader stalls
  (`:583`); `webglcontextlost/restored` handlers; shader-compile failures broadcast a
  `eventide-shader-error` window event (`:561-574`).

### 2.2 Major subsystems inside engine.ts
| Subsystem | Location (approx.) | Notes |
| --- | --- | --- |
| Runtime models (`RuntimeBody`, `InnerPlanet`, `RuntimeGalaxyNode`…) | `:86-160` | |
| Stage builders: `buildBackdrop`, `buildAnchor`, `buildBody`, `buildBelt`, `buildMeteors` | `:647-1140` | planets = shader surface + clouds + atmosphere + rings + moons |
| `buildMultiverse` (reality bubbles, Astral/Demon Cores) | `:1146` | |
| `buildLevels` (6 hierarchy groups: neighborhood→multiverse) | `:1993` | groups at `:319-324` |
| `buildGalaxyStageContents` / `buildInnerStellarSystem` | `:2207/:2334` | every major galaxy gets a full stellar system from `generateStellarSystemForGalaxy` |
| `buildClusterStage`, `buildKamuiTunnel`, `buildGalaxyTear`, `buildIntroMarble`, `buildSurface` (planet landing) | `:2878-3253` | |
| Picking: `pick()` with string-id protocol `cluster:*`, `galaxy:*`, `reality:*`, `inner:*` | `:3372-3449` | ids split by `:` in App (fragile, see debt) |
| Orbital update: `updateBodies` | `:4950` | calls `calculatePhysics` + `calculateKeplerPosition` per body per frame |
| Scale/stage update: `updateLevels` (distance-windowed layer opacity, `uScale` compensation, label ladder) | `:5140-5516` | |
| Planet-landing crossfade: `updateSurface` | `:5531` | terrain takes over below ~2.7× planet radius |
| Core mode diary connections: `updateCore` | `:5585` | |
| Dispose | `:5689` | |

### 2.3 Render loop (`tick`, `engine.ts:4360-4830`)
1. Early-out when `rendering === false` (vault/core overlays drain the clock only).
2. `dt` clamped to 0.05 s; `simDays += dt * 6 * timeScale`; ISO sim date emitted every 0.25 s.
3. Portal phase machine advance → FOV kick.
4. Focus/stage state machine: `kamuiFlight` → `galaxyEntryFlight` → `galaxyWarp` → boot intro
   → free navigation where **dial-edge crossings fire warps** (web edge at zoomT ≥ 0.855 with
   `zoomVelocity > 0.05`, multiverse floor ≤ 0.802, galaxy band crossings at
   0.585/0.60/0.695/0.70 with a `bandLatch` replay).
5. `rig.update(dt)` → `updateBodies → updateMeteors → updateLevels → updatePortal* →
   updateSurface → updateCore → updateHover` → `composer.render()` (+ `recordFrame` when `?perf=1`).

### 2.4 The two scale mechanisms
- **Continuous dial:** `CameraRig` maps one zoom dial to `dist = 3.0 · 800000^zoomT`
  (6 decades; `cameraRig.ts:8-17`). Frame-rate-independent damping (`1 − e^(−λ·dt)`),
  orbit fling inertia, pinch zoom, portal squeeze, dynamic near plane.
- **Discrete stages:** `cosmicStage: 'web' | 'multiverse'` are never co-visible — the **only
  bridge is the Kamui warp**. ZoomToHierarchy (`engine.ts:3627`) maps the 11 stages to a
  calibrated dial array `[0, 0.88, 0.858, 0.842, 0.773, 0.722, 0.668, 0.589, 0.503, 0.411, 0.15]`.

### 2.5 The four Kamui systems (all inline in engine.ts)
1. **Stage-crossing Kamui** (web ↔ multiverse): 3.6 s scripted flight — TEAR (vortex uniforms
   on point clouds) → SUCK (+z drift, layer dissolve) → TUNNEL (`buildKamuiTunnel` riding the
   camera) → EJECT (stage swap at t=0.55). Return replays backwards. (`beginKamui :3662`,
   flight `:4494-4564`.)
2. **Galaxy warp** (2.6 s bend) on hierarchy band crossings (`beginGalaxyWarp :4223`).
3. **Galaxy entry tear** (click a galaxy disc; neighbor point-clouds pulled via `uVortexC`)
   (`:4124-4218`).
4. **Portal Kamui** (planet/vault dive): 9-phase FSM `idle → arming → disturbance →
   deformation → vortex → collapse → opening → hold → out` with reverse "white-hole ejection"
   replay and a real `BlackHoleVisual` singularity (`blackhole.ts`). (`:278-307, 3712-3851,
   4384-4468`.)

> ⚠️ `src/engine/kamui.ts` (733-line `KamuiEffect` class) is **dead code** — superseded by the
> in-engine systems, only re-exported from `engine/index.ts`, never instantiated.

### 2.6 Shader library (`src/engine/shaders.ts`, ~1,817 lines)
Flat file of exported GLSL template strings sharing a `NOISE` chunk (simplex 3D + fbm):
star, planet (terrain/biomes/city lights), clouds, atmosphere, rings, disc, nebula, asteroid,
corona, points (`uScale` attenuation + `uVortex*` suction uniforms — auto-collected by the
engine into `levelPointMats`), sky, terrain, multiverse marbles, demon core, exoplanet plates.
**Dead exports:** `blackHoleVert/Frag` (ray-marched BH, replaced by the composite in
`blackhole.ts` after ANGLE/D3D shader-compile blackouts) and six `kamui*` shaders.

### 2.7 Universe Surface subsystem (`src/engine/surface/`)
- `UniverseSurfaceManager.ts` (441 lines): inverted sky dome (r=460,000), 3 deep nebula
  clouds, far star shell, near neighborhood shell + 5 named star sprites. All materials flagged
  `userData.immuneToVortex = true` (portal suction never eats the sky).
- `surfacePresets.ts`: `Record<realityId, UniverseSurfaceConfig>` — **parallel registry**:
  adding a reality does not auto-register its surface; missing ids synthesize from
  `colorA/colorB` or fall back to `sol-prime`.
- `surfaceShaders.ts`: one 150-line fragment doing vortex, filaments, nodes, galaxy specs,
  dust, HII regions, star fields — parameterized by 8 reality uniforms.

### 2.8 Black hole (`src/engine/blackhole.ts`)
Infallible multi-layer composite (no raymarching): black horizon sphere, Shakura–Sunyaev
accretion disk with Keplerian shear + Doppler beaming, billboarded upper/lower lensed arcs,
170-arc Einstein ring, photon ring. Decision rationale documented in-file (cross-GPU reliability).

### 2.9 Audio & telemetry
- `src/audio.ts` (141 lines): lazy `AudioContext` on first gesture; procedural SFX; 3-oscillator
  drone stacks per mode (`space|diary|vault|core`); mic recording. ⚠️ `fakePeaks` synthesizes
  waveform from blob size, not real audio analysis.
- `src/performance.ts`: dormant unless `?perf=1`; ring buffer (1,200 frames), p95/worst/avg,
  storage quota estimate, `window.__MY_UNIVERSE_PERF__()`.

---

## 3. Physics Sector

`src/physics/physicsEngine.ts` (309 lines) — **pure, stateless telemetry + Kepler solver**
(no dynamics integration). All real formulas:

- Constants in SI (`CONSTANTS :8-21`); per-body profiles for the Solar analogues
  (`BODY_PROFILES :81-92`).
- `calculatePhysics` (`:97`): Kepler III period, Newton–Raphson solution of Kepler's equation
  (5 iters), vis-viva velocity, mass = radius×density, surface gravity, escape velocity,
  Newtonian force/potential, Stefan–Boltzmann flux + equilibrium temperature (hard-coded
  greenhouse bumps: `aurelia` +33 K, `veil` +450 K `:181-182`), habitability, Roche limit,
  GR values for holes (Schwarzschild radius, photon sphere, ISCO, time dilation), canned
  galactic-orbit telemetry.
- `calculateKeplerPosition` (`:278`): the actual **position integrator the renderer uses**.
- Units are display units: `a_AU = a/52`, `radiusKm = radius/2.05 · 6371` (calibrated to Earth
  analogue `aurelia`).

Integration: `engine.updateBodies` calls both functions **per body per frame** although mass,
gravity, escape velocity etc. are time-invariant (debt item #12).

---

## 4. State & Storage Sector

### 4.1 Global store (`src/state.ts`, ~1,313 lines)
Hand-rolled external store (not Redux/Zustand): module-level mutable `state`, derived immutable
`snapshot`, `Set<Listener>`, debounced persistence. React subscribes via
`useSyncExternalStore` (`useUniverse :294`). Every mutation → `notify()` → snapshot rebuild +
350 ms-debounced persist.

**State slices** (`UniverseState`, `src/types.ts:269-290`):

| Slice | Purpose |
| --- | --- |
| `activeRealityId` | rendered reality |
| `customRealities` / `customRealityDescriptions` / `customRealityMeta` | user-authored realities + lore/recolor overrides (`any[]` — debt) |
| `deletedRealityIds` / `binRealities` | Quantum Bin (reality recycle bin w/ `originalConfig`) |
| `customGalaxies` | per-reality galaxy rosters (first edit copies generated defaults to user ownership) |
| `bodies` / `entries` / `connections` | 3D system + diary |
| `vault` / `efs` / `vaultTrash` | VaultFile metadata / inode tree+superblock+shadows+scrub / trash |
| `vaultUsers` / `secrets` / `audit` | identities (salt+verifier) / AES-GCM password blob / 200-event ring |

### 4.2 Persistence — dual tier
1. **localStorage** key `my-universe:v4`: JSON of everything, slimmed (oversized avatars nulled).
   ⚠️ Quota errors are swallowed silently (`state.ts:269`).
2. **OPFS → IndexedDB fallback** for payloads: diary attachments >256 KB externalized to
   `diary:<attachmentId>` (`externalizeLargeDiaryAttachments :227`); vault payloads via
   `putPayload` (encrypted). GC (`deleteUnreferencedPayloads :314`) respects live files, trash,
   and shadow trees.

### 4.3 Boot path (`loadState :142-221`)
parse → default slices → sanitize diary HTML → normalize legacy locks → `migrateLegacyVault`
→ `efsHeal` → re-seed if empty → repair genesis shadows → strip v2 fields → `version = 3` →
`primeState` (⚠️ back-dates newest entry's `updatedAt` if idle >48 h — falsifies user data).

### 4.4 Domain model (`src/types.ts`; `src/backend/types.ts` re-exports + adds executor types)
- `CosmicBody` — `kind: star|planet|dwarf|nebula|hole|vault`, `meaning` (8 emotional
  categories), `palette`, `orbit`. Protected ids: `anchor`, `eventide`.
- `DiaryEntry` — `planetId`, sanitized HTML, mood/weather/tags, `attachments: Attachment[]`
  (drag-positioned plates; big media via `payloadRef`).
- `VfsNode` — inode: `id`, `type: dir|file`, `parentId`, `fileId → VaultFile.id`, color/tags/pinned.
- `VfsState` — `rootId 'vfs-root'`, flat `nodes: Record<id, VfsNode>` parent-pointer tree,
  superblock (uuid, generation, dedupBytes), `shadows: VfsShadow[]` (max 24), scrub report.
- `VaultFile` — metadata record: payload may be inline legacy `content`, `payloadRef` into
  OPFS/IDB (optionally `payloadEncrypted`), `checksum` (sha-256 of plaintext), `dedupOf`,
  `versions` (last 10, inline text), per-object `lock`, `realityId` stamp.

### 4.5 EFS (`src/backend/storage/efs.ts`, 487 lines) — btrfs-class CoW in the browser
- Reads: `efsChildren`, `efsNodeOf` (⚠️ O(n) scan), `efsPath`, `efsSubtreeIds`,
  cycle-guarded `efsIsDescendant`.
- Writes: mkdir/rename/move (cycle prevention)/add (auto " (2)" suffixing); every mutation
  bumps superblock generation.
- **Shadows:** `freezeTree` deep-copies node metadata only (payloads were never in the tree →
  true CoW). Restore takes an automatic `pre-rollback-*` safety shadow, swaps nodes, reconciles
  with trash, heals.
- **Fork/copy:** clones tree, clones VaultFile with `dedupOf` → zero payload bytes allocated.
- **Dedup:** group by checksum, point payloadRefs at first copy, guard `efsPayloadShared`.
- **Scrub:** re-hash every payload vs checksum; repair inline mismatches from newest version.
- **Heal:** re-attach orphaned vault records, resolve legacy path-based dirIds.
- **Trash:** state-layer (`actions.efsTrash` freezes nodes into `vaultTrash`; restore
  re-attaches chains; purge → payload GC).

### 4.6 End-to-end flows
- **Save diary entry:** `DiaryWindow` → `actions.updateEntry` (sanitized) → `notify()` →
  debounced localStorage JSON. Attachments: inline dataURL → microtask externalization >256 KB.
- **Add vault file:** `putPayload` (AES-GCM envelope → OPFS `payload-<id>.bin`, IndexedDB
  fallback) → checksum → `actions.addVaultFiles` (VfsNode + metadata) → `efsRunDedup` →
  `eventide-vault-pulse` CustomEvent (3D black hole reacts).

---

## 5. Crypto Sector

`src/backend/storage/crypto.ts` (217 lines) — WebCrypto only, zero deps.

- **KDF:** PBKDF2-SHA-256 → AES-GCM-256. Rounds: 310,000 (target), legacy 90,000 (verifiers) /
  120,000 (secrets) silently re-hardened on login.
- **Two credential systems:**
  1. Identity/master key: `VaultUser.salt` + compare-only `verifier` (password never stored).
     Login has exponential brute-force lockout (30 s→300 s after 3 fails, persisted).
  2. Password-manager records: whole `PasswordRecord[]` JSON as one AES-GCM blob in
     `state.secrets`.
- **Payload session key:** derived from identity password at vault login
  (`unlockPayloadSession`, called from `VaultUI.tsx:4321`); cleared on logout/unmount.
  Per-file authorization set for objects with their own `lock`.
- **Payload envelope:** magic `EVENTIDE-PAYLOAD-V1\n` + 4-byte LE header length + JSON header
  `{version, iv, mime}` + ciphertext. Legacy raw payloads transparently re-encrypted and
  rewritten on first authenticated read (`indexedDB.ts:104-119`).
- **Not encrypted:** diary attachments (sanitized instead — `sanitizeHtml.ts` DOMParser
  allowlist; strips script/iframe/img/svg/style; href protocol allowlist).
- Nit: verifier comparison is plain string compare (not constant-time) — negligible for a
  PBKDF2 verifier but noted.

---

## 6. Executors Sector (Sandboxed Runtimes)

Canonical implementation: `src/backend/executors/` (barrel-exported via `backend/index.ts`).
⚠️ `src/backend/storage/executors.ts` is a ~95% duplicate without ISO (debt item #2).

| Format | Mechanism |
| --- | --- |
| **HTML/WebApp** | `bundleWebApp`: DOM-parse, rewrite relative src/href to blob URLs of sibling vault payloads, inject strict CSP (`default-src 'none'` + `script-src 'unsafe-inline'`) and an **import map** for ES modules; run in sandboxed iframe |
| **JavaScript** | dedicated Web Worker from blob; `WORKER_SHIM` pipes console + errors; terminable |
| **Python** | Pyodide **v0.26.4 loaded from jsdelivr CDN at runtime** (hence absent from package.json) in a reusable single worker; one run at a time; terminate = cold restart; ~10 MB first-run download, **fails offline** |
| **PDF** | native sandboxed viewer |
| **ZIP** | dependency-free central-directory parser + native `DecompressionStream('deflate-raw')`; 256 MB inflation budget; RAR/7z/tar detected but not parseable |
| **ISO 9660** | `isoExecutor.ts` (247 lines): hand-written sector parser — PVD at sector 16, `CD001` validation, recursive directory walk (depth ≤ 5), LBA slicing + MIME guessing |

`detectRunner` routes by extension/mime; `resolveBlob` materializes bytes (payloadRef / data
URL / inline) gated by lock authorization.

---

## 7. Server Sector (Express + Reality Daemon)

**`server/index.ts`** (in `server/`, Express 5, port 3000, binds 0.0.0.0; the September
cleanup consolidated the root `server.ts` + `src/server/` into one `server/` module and
extracted the shared generators into `server/realityTemplates.ts`):
- Starts `realityDaemon.start(3000)`.
- GET: `/api/health`, `/api/realities/daemon-status`, `/api/realities/folders`,
  `/api/realities/bin`.
- POST: `bin/move-to-bin|restore|purge|empty`, `rename-folder`, **`create-folder`** (generates
  real TypeScript source — `surface.ts` + `index.ts` via template literals — into
  `src/realities/<folder>/`), `delete-folder`; plus `DELETE /api/realities/:id` (`fs.rmSync`).
- Dev: Vite middleware; prod: serves `dist/`.

**`src/server/realityDaemon.ts`** (~366 lines): singleton scanning `src/realities/` every 3 s;
**auto-repairs** (regenerates) missing `index.ts`/`surface.ts` for any folder; implements bin
move/restore/purge/empty + rename (naive regex `name:` rewriting).

**Frontend coupling:** fire-and-forget `fetch()` with `.catch(console.warn)` from state actions
(rename `:419`, create `:441`, bin ops `:508-569`); QuantumBinTab polls daemon status every 3 s.
**The server is optional** — everything works client-side; a static deploy silently loses the
disk mirror.

⚠️ **Security:** path components from request bodies reach `path.join` / `fs.rmSync` without
containment asserts (see debt #3) — fixed in Foundation wave.

---

## 8. UI Sector

### 8.1 App architecture (`src/App.tsx`, ~1,030 lines)
- **Modes:** `space` (WebGL canvas), `core` (CoreMode overlay; entered via anchor star or `C`),
  `vault` (VaultUI overlay; entered via portal into Eventide; engine stops rendering).
- **Floating diary windows:** `Win[]` (key/planetId/rect/minimized/maximized), cascading spawn,
  z-stacking `40 + (zTop % 50)`, minimized dock, auto-close when body dissolves. ⚠️ `% 50`
  mis-stacks beyond 50 windows.
- **Existence sync:** JSON-signature memoized effects call `engine.rebuildMultiverse()` — a
  workaround for store array identity churn (rebuilds whole multiverse on any roster/meta edit).
- **Z-layers:** intro 35 → diary 40+ → chrome → cards 50 → MultiverseBar 40 → dock 65 →
  Core overlays 100 → modals 105 → shortcuts 130 → toasts. Magic integers throughout.
- **Keyboard:** `H` home, `C` core, `V` vault, `Space` pause, `M` mute, `?` shortcuts, `Esc`.
- **Hover lattice:** four hover surfaces mutually excluded by a boolean chain in
  `App.tsx:810-880` (fragile; should be one discriminator).

### 8.2 Feature inventory
| Surface | Size | Highlights |
| --- | --- | --- |
| `ui/VaultUI.tsx` | 4,534 lines | Full encrypted personal OS: gate + identities + avatar system; sections (home/fs/all/void); polymorphic Viewer (RunView w/ WebApp/JS/Py/PDF/Archive/**ISO** runners, audio/video players, CSV/FITS, CodeDocStudio); PasswordVault (categories, generator, RotateKeyModal mass re-encryption); VaultTerminal; DeepScan; Telemetry; AtmosphereSynth & GravityGarden mini-apps; drag-drop encrypted import |
| `ui/FileManager.tsx` | 930 lines | EFS explorer: tree sidebar, breadcrumbs, search, multi-select incl. marquee, grid/list, DnD moves + external import, clipboard where copy = zero-copy CoW fork, rename, trash, pins/tags/colors, inspector rail, engine dock (shadows/scrub/dedup/superblock) |
| `ui/DiaryWindow.tsx` | 1,835 lines | Paged entries as a 3D flip-Book (12-strip wave page-turn + sfx), per-planet weather layer, mood climate, streak chip, glued drag-positionable attachment plates, mic voice memos, dark-side archive, cross-planet cosmos search, ConstellationBar, PDF/PNG/print export |
| `ui/MediaPlates.tsx` | 1,139 lines | AudioPlate (EQ presets, hover-scrub, synthesized peaks), VideoPlate (cinema modes, 80 MB guard), ImageOrGifPlate (canvas gif pause, zoom), FileOrCodePlate |
| `ui/CoreMode.tsx` | 879 lines | Temporal command deck: universe-wide time scrubbing w/ playback (25 fps throttle) driving `engine.setTemporal`, historical snapshots + stats, JSON backup export/import with embedded base64 payloads, WorldEditor/WorldFormer |
| `components/CoreConsole.tsx` | 1,185 lines | Multiverse core command deck: dashboard (radar, gauges, bento reality grid w/ search/filter), hierarchy explorer, QuantumBinTab, CppNativeEngineCard |
| `components/MultiverseBar.tsx` | 606 lines | HUD: CORE badge, active reality chip, galaxy dropdown, 11-stage ladder (click → `onZoomToHierarchy`), reality switcher/create/delete, Kamui triggers |
| `components/QuantumBinTab.tsx` | 256 lines | Reality recycle bin UI; polls daemon status + bin every 3 s; restore/purge/empty |
| `components/CppNativeEngineCard.tsx` | 145 lines | Runs JS RK4 N-body benchmark; displays Mops/sec; copy-paste CMake guides (so/dll/Tauri). **The C++ is not actually built or loaded** |
| `components/CosmicLineageModal.tsx` | 516 lines | Step explorer of a `CosmicLineage` (11 stages). ⚠️ "+ Create …" buttons are decorative (`createdItems` state not wired to actions) |
| `components/ThinkingCloudTooltip.tsx` | 140 lines | Presentational "Celestial Catalyst" hover affordance |
| Hover cards | — | Reality/Galaxy/Cluster telemetry cards + CosmicWebHUD (filament/redshift telemetry, `getLODInfo` string-matching duplicates stage labels) |
| `ui/exportDiary.ts` | — | Off-screen staging clone + html-to-image + jsPDF |
| `ui/bits.tsx`, `ui/VaultBits.tsx`, `ui/toast.ts` | — | Shared primitives, hex viewer/glyphs/tiles, toast dispatch |

---

## 9. Realities Sector (Multiverse Content)

### 9.1 Registry & assembly (`src/realities/index.ts`)
- `import.meta.glob('./*/index.ts', { eager: true })` auto-discovers every immediate
  subfolder; `bin/` skipped. Accepts single exports or arrays (`realities/parallels` exports
  `parallelRealities`).
- `buildRealityConfig` (`:46`): golden-spiral bubble position, normalizes first body to the
  `anchor` star, **guarantees exactly one `vault` black hole** (auto-creates), applies
  `customRealityMeta`, generates clusters + galaxies.
- `computeAllRealities` = built-ins + `customRealities` − `deletedRealityIds`.
  ⚠️ `REALITIES` is a module-level mutable singleton assembled at import time; actions mutate
  it in place (`r.description = ...`), patched over by `setRuntimeRealities`.
- `createNewRealityConfig` (`:207`): factory used by CreateRealityModal.

### 9.2 Reality definition schema
`RealityConfig` (`realities/types.ts:16-34`): `id, name, codeName, spectral, description,
bubblePos, bubbleSize, colorA, colorB, starColor, bodies: CosmicBody[], entries: DiaryEntry[],
clusters?, galaxies?, homeLineage?`. A `realities/<name>/index.ts` exports one themed config
(palette + 3-10 bodies + seed entries); `surface.ts` exports a `UniverseSurfaceConfig` — but
the surface is keyed by realityId string in `surfacePresets.ts` (**second, manual registration
point**; silent fallback when missed).

### 9.3 Hierarchy & generators
- `hierarchyTypes.ts`: `CosmicAddress` (11 optional fields) + `CosmicLineage` (11 narrative
  stages — README says "10 scales", the code has 11 counting stage 0 = multiverse).
- `clusterGenerator.ts`: hand-authored templates for sol-prime (`:22-120`), generic fallback
  (`:145`), full lineage expansion (`:231-338`).
- `galaxyGenerator.ts`: deterministic seeded rosters (FNV-1a + mulberry32), lineage builders,
  `generateStellarSystemForGalaxy` (`:323`) producing real `CosmicBody[]` when diving in.

### 9.4 Folder semantics
- `solPrime/` — home reality, protected from deletion.
- `bin/` — Quantum Bin (deleted realities preserved for restore); excluded from collection.
  (September cleanup: the 8 authored realities and `parallels/` were promoted OUT of
  `bin/` — the glob never collected them there, so only Sol Prime was live — and
  the incomplete `test/` folder was deleted. `bin/` is now a true empty recycle bin.)
- `test/` — committed dev junk (incomplete: missing `surface.ts`, breaks typecheck) that ships
  in the live multiverse. Deleted entirely in the cleanup wave (not restored to bin).

### 9.5 Scale navigation (3 duplicated definitions — drift risk)
1. `MultiverseBar.hierarchyStages` (`:60-72`),
2. `engine.zoomToHierarchy` dial array (`engine.ts:3645`),
3. `CosmicWebHUD.getLODInfo` label matching (`:30-48`).
Centralized in the Foundation wave.

---

## 10. Native C++ Sector

- `src/native/cosmos_engine.{hpp,cpp}`: `Cosmos::NBodySimulator` — O(n²) softened pairwise
  gravity + textbook RK4 (`stepRK4`); `ProceduralUniverseGenerator`; C-linkage FFI exports
  (`cosmos_create_simulator`, `cosmos_step_simulation`, …). `CMakeLists.txt`: shared lib +
  benchmark exe (`/O2 /arch:AVX2` MSVC or `-O3 -ffast-math -mavx2`).
- **`cpp_bridge.ts` is pure TypeScript.** No WASM/NAPI/dlopen anywhere; `runRK4Benchmark`
  runs the same O(n²) RK4 loop in JS with `Float64Array`s; `getEngineInfo()` returns
  hard-coded marketing metadata (`language: 'C++20'`, `desktopCompileStatus: 'READY_TO_BUILD'`)
  blended with JS benchmark numbers.
- Wired in only cosmetically via `CppNativeEngineCard`. Real orbital motion comes entirely
  from `physicsEngine.ts`. Honest upgrade path: Emscripten build of the C API → real WASM
  module driving an N-body layer (Wave 3).

---

## 11. Known Debt Register

Severity: 🔴 high · 🟠 medium · 🟡 low. (✓ = addressed in Foundation wave.)

| # | Sev | Item | Where |
| --- | --- | --- | --- |
| 1 | 🔴 | **engine.ts god class** (5,714 lines): stage builders + 4 Kamui systems + portal FSM + surface landing + picking in one class | `engine.ts` |
| 2 | 🔴 | **Duplicate executor implementation** (~95% identical, drift risk) | `backend/storage/executors.ts` vs `backend/executors/index.ts` |
| 3 | 🔴 | **Path traversal / uncontained fs writes**: request-body folder names reach `path.join`/`fs.rmSync` unfiltered | `server/index.ts`, `server/realityDaemon.ts` ✓ |
| 4 | 🟠 | **localStorage is the whole DB** (5 MB cap); quota errors swallowed silently; 24 full-tree shadows scale O(shadows × tree) into one key | `state.ts:252-273, 245` |
| 5 | 🟠 | **O(n) EFS tree ops**: `efsNodeOf` and `efsChildren` scan the whole node table per call | `efs.ts:67-105` |
| 6 | 🟠 | **`primeState` falsifies data** — back-dates newest diary entry `updatedAt` to fake streaks | `state.ts:99-110` ✓ |
| 7 | 🟠 | **Dead code**: `kamui.ts` (733 lines), ~450 lines unused GLSL, `test/` reality shipping live, 12 shim files + `db.ts`/`realities.ts` stubs | various ✓ |
| 8 | 🟠 | **Stage constants triplicated** (MultiverseBar / engine zoomToHierarchy / CosmicWebHUD) | ✓ |
| 9 | 🟠 | **VaultUI god component** (4,534 lines, ~40 components, dozens of useState in one tree) | `ui/VaultUI.tsx` |
| 10 | 🟠 | Pyodide from CDN, no offline fallback (contradicts offline-first ethos) | `backend/executors/index.ts:226-279` |
| 11 | 🟠 | Mutable module-level `REALITIES` singleton mutated in place by actions | `realities/index.ts:187` |
| 12 | 🟡 | `calculatePhysics` runs per body per frame though most outputs are time-invariant | `engine.ts:4956` |
| 13 | 🟡 | Fragile string pick-id protocol (`cluster:${id}:${realityId}` split by `:`) | `engine.ts:3372+`, `App.tsx:135-160` |
| 14 | 🟡 | Double `POST /api/realities/create-folder` (modal + state action both fire) | `CreateRealityModal.tsx:54`, `state.ts:441` ✓ |
| 15 | 🟡 | Magic dial thresholds (~12 constants spread across tick/zoomToHierarchy/updateLevels) | `engine.ts:4450-4735` ✓ |
| 16 | 🟡 | Duplicated utilities: `makeGlowTexture`, smoothstep/damp/clamp ×3, `synthBars`, `readAsDataURL`, `WaveStrip`, hex helpers | various ✓ |
| 17 | 🟡 | JSON-signature rebuild triggers rebuild the whole multiverse on any meta edit | `App.tsx:360-373` |
| 18 | 🟡 | Hover-card boolean-lattice mutual exclusion duplicated across four surfaces | `App.tsx:810-880` |
| 19 | 🟡 | Magic zIndex integers scattered; `% 50` window stacking breaks >50 windows | `App.tsx`, components |
| 20 | 🟡 | `customRealities` typed `any[]`; no tests, no CI, manual `version: 3` flag only | `types.ts:272` |
| 21 | 🟡 | CSP for user web apps includes `script-src 'unsafe-inline'` (needed for inline scripts, weakens sandbox story) | `backend/executors/index.ts:83` |
| 22 | 🟡 | Daemon auto-repair can clobber hand-edits within 3 s; generated templates import from `../types` (only resolves via stub re-export) | `realityDaemon.ts:86-103` ✓ |
| 23 | 🟡 | Fake data paths: `fakePeaks` audio waveform; hard-coded `NativeEngineMetrics` | `audio.ts:134`, `cpp_bridge.ts:87-99` |
| 24 | 🟡 | Surface preset registry disconnected from reality registry (silent fallback) | `surfacePresets.ts` |
| 25 | 🟡 | Verifier compare not constant-time; payload session key relies on UI calling `clearPayloadSession` | `crypto.ts:119` |

**Preserved strengths** (do not regress): payload-metadata split (true CoW), sha-256
scrub/heal self-repair discipline, transparent legacy re-encryption on read, dependency-free
ZIP reader via `DecompressionStream`, import-map web-app bundler, GPU-resilient composite
black hole, frame-rate-independent camera rig, `immuneToVortex` invariant system.

---

## 12. Upgrade Roadmap (Waves)

### Wave 1 — Foundation & Health *(complete — September 2026)*
1. ✓ Purge dead code (~1,600+ lines): `kamui.ts`, unused GLSL, duplicate executors, shim
   stubs, `test/` reality → bin.
2. ✓ Server security: sanitize + containment-assert every fs path operation.
3. ✓ Centralize `HIERARCHY_STAGES` (single source for labels, dials, LOD).
4. ✓ De-duplicate utilities (`makeGlowTexture`, math helpers, UI lib).
5. ✓ Behavioral fixes: remove double create-folder POST; stop `primeState` timestamp
   falsification; daemon surface template now matches the real `UniverseSurfaceConfig`.
6. ✓ Engine systems: `src/engine/systems/` — `stageThresholds.ts`, `portalPhases.ts`
   (phase contract + transition table), `levelSystem.ts`.

### Wave 2 — Desktop Application: Tauri 2 + C++ Core *(complete — September 2026)*

**Architecture decision:** Tauri 2 shell (Linux WebKitGTK + Windows WebView2, desktop-first,
web keeps working). The C++ core is compiled directly into the desktop binary via the
`cc` crate in `src-tauri/build.rs` — no DLL loading anywhere.

**What landed:**

1. **C++ core v2** (`src/native/cosmos_engine.{hpp,cpp}`): new flat C exports —
   `cosmos_orbit_position` / `cosmos_kepler_batch` (exact port of
   `calculateKeplerPosition`), `cosmos_physics_batch` (exact 41-field port of
   `calculatePhysics` incl. BODY_PROFILES + greenhouse bumps), `cosmos_terrain_fbm`
   (bit-exact `cpuFbm` port), `cosmos_benchmark_rk4`, `cosmos_version`.
2. **Bridge loader chain** (`src/native/cpp_bridge.ts` v2): native-cpp (Tauri invoke) →
   WASM (`src/native/wasm/`, built by `scripts/build-wasm.sh` when emsdk is present) →
   TypeScript reference. `verifyParity()` cross-checks the active tier against the TS
   reference and the engine card shows the receipt.
3. **Engine integration**: `updateBodies` batch-evaluates orbits through the C++ core
   every other frame (async cache, quarter-day staleness guard, inline TS fallback);
   `CppNativeEngineCard` rewritten to report the *actual* active backend, version and
   benchmark — no more hard-coded "C++20 READY_TO_BUILD" marketing.
4. **Desktop shell** (`src-tauri/`): Tauri 2 config, window, icons; Rust commands for
   cosmos (`cosmos_status/kepler_batch/physics_batch/benchmark/terrain_fbm`), storage
   (`store_state_read/write`, raw-IPC `store_payload_put` with `[u16 idLen][id][bytes]`
   framing, `payload_get/delete/list/stats`) and the reality daemon port
   (`reality_list/bin/move/restore/purge/empty/rename/create_folder`) with the same
   sanitize + containment rules as `paths.ts`.
5. **Frontend adapters** (`src/desktop/adapter.ts`): `desktopStore` (state JSON to real
   files in app-data), `desktopPayloads` (payload bytes; OPFS/IndexedDB remain the web
   tiers inside `indexedDB.ts`'s unchanged export surface), `realityApi()` (native
   commands on desktop, `fetch('/api/...')` on web). `state.ts` persists to both tiers;
   `hydrateDesktopSnapshot()` adopts the authoritative file at boot (single guarded
   reload; first boot pushes the webview cache to disk).
6. **Offline-first**: Pyodide v0.26.4 vendored into `public/pyodide/` (worker falls back
   to CDN only if the local copy is missing); Google Fonts vendored into
   `public/fonts/fonts.css` (index.html no longer references the CDN).
7. **Cinematic black hole tier** (`src/engine/blackholeRaymarch.ts` +
   `src/engine/capability.ts`): GPU probe (`WEBGL_debug_renderer_info`, WebGL2, software-
   rasterizer denylist) → Low/Medium/Cinematic tiers with a user selector in the engine
   card. CINEMATIC enables a raymarched null-geodesic overlay (volumetric disk, Doppler
   beaming, lensed starfield, photon ring) **additively above the composite** — any
   shader failure disarms the tier for the session and the infallible composite alone
   renders. Pixel ratio 2 on cinematic.
8. **CI** (`.github/workflows/desktop.yml`): windows-latest (NSIS) + ubuntu-latest
   (deb/AppImage) — typecheck → C++ core via cc → tauri build → artifacts. The VS Build
   Tools installer cannot run inside the agent sandbox (.NET TLS spawn restriction), so
   local Windows builds use `scripts/setup-windows-toolchain.ps1` run manually.

**Honest engineering note preserved for posterity:** the visuals are GLSL on the GPU and
run at the same speed from webview or native host. The C++ core's real wins are the
simulation CPU (N-body/Kepler/telemetry/noise batches), memory headroom, quota-free
native storage, and the driver headroom that made the raymarched tier possible as a
*gated* upgrade rather than a fragility risk. The full Qt/Vulkan C++ rewrite remains a
documented future path.

### Wave 3 — Performance & Fidelity
- Real N-body dynamics layer driving the render loop from `cosmos_step_simulation`
  (beyond the Kepler batch), symplectic integrator option.
- Build WASM artifact in CI (emsdk job) so web gets the native core without Tauri.
- Granular multiverse rebuild invalidation; single hover discriminator; structured pick
  payloads.

### Wave 4 — New Cosmic Features
- Wire CosmicLineageModal "+ Create …" actions to real reality/sector creation.
- Richer planetary surfaces (weather, seasons on landing surface), more authored realities.
- Auto-registration of surface presets from reality modules (kill the parallel registry).

---

*Generated by the September 2026 deep audit (three parallel exploration passes over the full
source tree). Line numbers are approximate anchors and will drift as waves land.*

# MY UNIVERSE

A browser-local React and Three.js application that turns personal worlds,
journal entries, files, credentials, and relationships into an interactive
3D cosmos.

> **Documentation note:** This README was reconstructed from the source code,
> `package.json`, Vite configuration, and static assets. The labels below
> distinguish facts stated directly in code from conclusions inferred from
> behavior.
>
> - **[Code]** — directly stated or implemented in the repository.
> - **[Inferred]** — a description inferred from the implementation.
> - **[Question]** — ambiguous or dependent on browser/runtime behavior; this
>   should not be treated as a guaranteed contract.

## What the project does

**[Inferred]** MY UNIVERSE is a single-user, browser-local personal workspace
with four connected ideas:

- A navigable WebGL universe containing stars, planets, nebulae, black holes,
  realities, galaxy clusters, galaxies, and generated inner stellar systems.
- A diary attached to cosmic bodies. Diary pages support rich text, tags,
  moods, weather effects, media attachments, linked pages, recording, and
  document export.
- A local Universal Vault for files, folders, credentials, executable payloads,
  archives, snapshots, trash, deduplication, and integrity checks.
- A Core Mode that edits cosmic objects and realities and provides a timeline,
  statistics, JSON backup/restore, and historical playback.

The application has no server-side account system or application backend.
State is stored in browser storage, and execution happens in browser workers,
iframes, Web APIs, or the browser's native PDF viewer.

## Requirements and setup

### Requirements

- Node.js and npm capable of installing the versions in `package.json`.
  **[Question]** The repository does not declare a required Node.js version.
- A modern browser with WebGL for the 3D scene.
- Browser support for WebCrypto is required for the vault's cryptography.
- IndexedDB is required for the normal large-payload path. OPFS is used when
  available and IndexedDB is used as a fallback.

### Install and run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. The checked-in Vite configuration uses:

- host: `0.0.0.0`
- port: `3000`
- strict port mode: enabled

Therefore the usual local URL is:

```text
http://localhost:3000/
```

The development server also exposes the app on the machine's network
interfaces because the configured host is `0.0.0.0`.

### Production build

```bash
npm run build
```

The production output is written to `dist/`. `dist/` is ignored by Git.

## Environment variables

No environment variables are referenced by the application source or Vite
configuration. There is no checked-in `.env` contract and no required API key.

The following external resources are hard-coded in the current source and are
not environment variables:

- Google Fonts are linked by `index.html`.
- The Python runner downloads Pyodide `v0.26.4` from
  `https://cdn.jsdelivr.net/pyodide/v0.26.4/full/` the first time Python is
  run.

User files and local universe state are not sent to a project backend. The
Python runtime download is an external dependency download, not a user-data
synchronization service.

## Available npm scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the Vite development server. |
| `npm run build` | Runs a production Vite build. |
| `npm run typecheck` | Runs `tsc --noEmit` with strict TypeScript checking. |
| `npm run lint` | Alias for `tsc --noEmit`; it is not a separate ESLint task. |

No test runner script is defined in `package.json`.

## Architecture

```text
src/main.tsx
  └─ App.tsx
      ├─ UniverseEngine (Three.js/WebGL scene and interaction)
      ├─ CoreMode (timeline, editors, backups)
      ├─ DiaryWindow (journal UI and media)
      ├─ VaultUI (identity gate, EFS, key ring, execution)
      └─ reality/hover/modal components

state.ts
  ├─ reactive external store
  ├─ localStorage persistence and migrations
  ├─ reality/body/diary/vault actions
  └─ EFS action coordination

storage/
  ├─ crypto.ts       WebCrypto key derivation and encryption
  ├─ indexedDB.ts    OPFS + IndexedDB payload storage
  ├─ efs.ts         Eventide Filesystem tree and CoW operations
  ├─ executors.ts   HTML, JavaScript, Python, PDF, and archive runners
  ├─ zip.ts         native ZIP listing/extraction
  ├─ seeds.ts       initial local universe data
  └─ other helpers  formatting, metrics, exports, procedural data
```

### Application entry point

- `src/main.tsx` mounts `<App />` into `#root`.
- `src/App.tsx` owns the top-level mode (`space`, `core`, or `vault`), creates
  the `UniverseEngine`, connects engine callbacks to React state, and renders
  the overlays and windows.
- `src/index.css` contains the global visual system and animation styles.
- `index.html` provides the root element, title, metadata, font links, and the
  `/src/main.tsx` module entry.

### `src/engine/`

- `engine.ts` builds and animates the Three.js scene, handles picking and
  camera-scale navigation, renders the cosmic web and multiverse, manages
  reality/galaxy rebuilds, and emits callbacks to `App`.
- `cameraRig.ts` implements orbit, pan, wheel zoom, pinch zoom, keyboard pan,
  focus framing, and drag inertia.
- `blackhole.ts` builds the composite Eventide Vault black-hole visual from
  Three.js primitives and generated canvas textures.
- `shaders.ts` contains the GLSL programs used by the scene.

The engine has two explicit major stages: the cosmic web and the multiverse.
A scripted Kamui transition moves between them. Clicking a staged galaxy uses a
separate local surface-tear flight: the selected galaxy swirls, pulls nearby
member-galaxy clouds inward, and lands in that galaxy's stellar system. Reality
and galaxy edits cause runtime scene content to be rebuilt from the current
state.

### `src/components/`

These components are the multiverse and hierarchy control surfaces:

- `CoreConsole.tsx` — multiverse console for realities, galaxies, core actions,
  and creation/deletion operations.
- `MultiverseBar.tsx` — scale, warp, galaxy, and Kamui controls.
- `RealityHoverCard.tsx`, `GalaxyHoverCard.tsx`, and `ClusterHoverCard.tsx` —
  hover details and actions.
- `RealityAdvancedModal.tsx` and `RealityAdvancedPanel.tsx` — reality and
  galaxy editing.
- `CreateRealityModal.tsx` and `EditRealityModal.tsx` — reality forms.
- `GalaxyRoster.tsx` — editing a reality's major-galaxy roster.
- `CosmicLineageModal.tsx` — hierarchy and lineage inspection.
- `CosmicWebHUD.tsx` — cosmic-web display settings.

### `src/ui/`

- `DiaryWindow.tsx` and `Book.tsx` — movable, resizable diary pages and book
  presentation.
- `CoreMode.tsx` — object list, timeline playback, statistics, JSON backup and
  restore, world editing, and world creation.
- `VaultUI.tsx` — identity gate, local key ring, file viewers/runners, trash,
  deep scan, and the Eventide shell.
- `FileManager.tsx` — the EFS tree, search, selection, drag/drop, clipboard,
  inspector, trash, snapshots, scrub, and dedup controls.
- `MediaPlates.tsx` and `VaultBits.tsx` — media previews and vault display
  helpers.
- `PhysicsHUD.tsx` — calculated orbital, gravitational, thermal, tidal, and
  relativistic telemetry.
- `bits.tsx` and `toast.ts` — shared UI primitives, error boundary, and toast
  notifications.
- `exportDiary.ts` — diary document export helpers.

### `src/realities/`

The reality system contains authored reality modules plus deterministic
procedural generators:

- Authored modules: `solPrime`, `hyperionLumina`, `ignisEmber`,
  `kardashevMatrix`, `vesperaTwilight`, `singularityRift`,
  `biolumePrimordial`, `chronosParadox`, and `parallels`.
- `index.ts` merges base realities, user-created realities, deletions, lore
  overrides, identity overrides, and galaxy-roster overrides.
- `clusterGenerator.ts` generates cosmic addresses and cluster/lineage data.
- `galaxyGenerator.ts` creates deterministic galaxy data and isolated inner
  stellar systems.
- `hierarchyTypes.ts` defines cosmic addresses, lineages, galaxies, and
  clusters.

The runtime reality list is generated by `computeAllRealities()`. User-authored
reality and galaxy data replaces generated defaults for the corresponding
reality.

### `src/physics/`

`physicsEngine.ts` calculates the telemetry shown by `PhysicsHUD`. It includes
Kepler-style orbital values, vis-viva velocity, estimated mass and gravity,
escape velocity, stellar flux, equilibrium temperature, habitability status,
Roche limits, black-hole radii/time dilation, axial rotation, and galactic
orbit values.

These are simulation calculations based on authored profiles and scale factors,
not a general-purpose astrophysics library.

## Main user-facing features

### Space mode

- Scroll or use the controls to travel between cosmic scales.
- Drag to orbit or pan; wheel and pinch gestures zoom.
- Click to select; double-click to enter a body, reality, or galaxy where
  applicable; right-click opens the context menu.
- Assign a meaning to a cosmic body: memory, dream, person, project, moment,
  idea, chapter, or unresolved.
- Rename bodies, edit notes, link bodies into constellation connections, focus
  the camera, and open physics telemetry.
- Switch realities, inspect clusters and lineages, edit galaxy rosters, create
  realities, and collapse user-created realities.
- The primordial `sol-prime` reality is protected from deletion.
- The app includes procedural ambient audio and interaction sounds. Audio is
  initialized after the first user gesture.

### Diary mode

A body can have multiple diary entries. Pages support:

- Rich text editing with sanitized saved HTML.
- Titles, tags, bookmarks, archive state, mood, and weather.
- Image, video, audio, file, and code attachments.
- Movable and resizable attachments, including attachments glued into the
  page.
- Templates for starting a page.
- Voice recording through `getUserMedia` and `MediaRecorder` when available.
- Export to supported document formats through `exportDiary.ts`.
- Linked diary pages and movable/minimizable/maximizable windows.

Diary video attachments are rejected when larger than 80 MB by the diary UI.
Other browser and storage limits still apply.

### Core Mode

Core Mode contains:

- Search and filtering for cosmic bodies by name, kind, or meaning.
- World creation and editing.
- A chronological timeline of formed bodies, diary entries, links, and vault
  objects.
- Timeline playback and historical snapshots.
- Statistics for bodies, entries, connections, vault bytes, and object kinds.
- Versioned JSON universe backup and restore. Version 2 backups include stored
  payloads as chunked base64 data where those payloads are available.
- Missing payload references are marked as unavailable during restore instead
  of pretending the original bytes were recovered.

### Universal Vault

The vault is a browser-local file and credential workspace protected by a local
identity gate.

Identity and key-ring features:

- Create multiple local identities with a master key and optional image, GIF,
  APNG, or video avatar.
- Master-key verifiers use PBKDF2 through WebCrypto. New records target
  310,000 rounds; legacy round counts are migrated when possible.
- The Key Ring stores credential records sealed as an AES-GCM payload.
- Search and categorize credentials, reveal/copy values, audit sensitive
  actions, rotate the master key, export/import a checksummed encrypted backup,
  and configure inactivity auto-lock.
- Failed unlock attempts are tracked in localStorage with an exponential local
  lockout.

File and EFS features:

- Import files by picker or drag-and-drop.
- Browse directories with tree navigation, breadcrumbs, recursive view, search,
  sorting, grid/list presentation, selection, marquee selection, and an
  inspector.
- Create, rename, move, copy, cut, paste, tag, color, pin, trash, restore, and
  permanently purge files/directories.
- Copy/fork operations share payload references rather than copying bytes.
- Freeze and restore copy-on-write EFS shadows.
- Run checksum scrubs and SHA-256-based deduplication.
- Inspect payload storage mode, checksum, dedup source, versions, and missing
  payload status.
- Use the Eventide shell commands listed below.

Supported real payload runners:

| Payload | Runtime behavior |
|---|---|
| HTML/HTM | Relative sibling assets are bundled into blob URLs and run in a CSP-restricted, opaque-origin iframe with scripts, forms, modals, and pointer lock allowed. Network access is blocked by the generated CSP. |
| JavaScript | Runs in a dedicated Web Worker with piped console output and an explicit terminate action. The UI states that browser capabilities are not fully isolated. |
| Python | Runs CPython through Pyodide in a terminable worker. Pyodide is downloaded from the configured CDN on demand. The worker is not a security boundary. |
| PDF | Opens the stored bytes in a sandboxed iframe/native browser viewer. |
| ZIP/archive | Lists entries, extracts individual entries, extracts all files into EFS, and can launch an archive containing an `index.html` through the web-app bundler. |
| Other formats | Can be stored and downloaded, but there is no general in-browser runtime. |

Legacy objects without materialized payload bytes may show the UI's
materialization/sandbox presentation rather than execute their original bytes.

### Eventide shell commands

The shell is opened from the vault UI. The implemented command set includes:

```text
help
ls [dir]
cd <dir>
pwd
mkdir <name>
cat <file>
info <file>
cp <file> [destination]
tree
fork <dir>
shadow ls
shadow freeze <name>
shadow restore <name>
shadow rm <name>
scrub
dedup
trash
scan
keyring
objects
weather
find <text>
clear
exit
```

## Persistence and storage

### Main state: localStorage

`src/state.ts` stores the serialized `UniverseState` under:

```text
my-universe:v4
```

Persistence is debounced by 350 ms. If serialization or localStorage writes
fail, the application continues with in-memory state for the current session.
The loader performs migrations and repairs, including diary sanitization, vault
lock normalization, legacy EFS migration, and EFS reachability healing.

Other localStorage keys used by the code include:

- `my-universe:muted` — procedural audio mute preference.
- `eventide:autolock` — Key Ring inactivity timeout setting.
- `eventide:guard:<userId>` — local failed-unlock counters and lockout expiry.

### Large payloads: OPFS and IndexedDB

`src/storage/indexedDB.ts` uses:

- OPFS file names `payload-<id>.bin` when OPFS is available.
- IndexedDB database `eventide-universe`, version `1`.
- IndexedDB object store `payloads`, keyed by payload id, as a fallback and
  compatibility path.

New Vault payloads are encrypted before storage when a vault payload session is
unlocked. The stored Vault payload envelope is decrypted only after the correct
master-key session is established. Legacy raw Vault payloads can be read and
re-sealed on authenticated access when migration succeeds.

Large diary attachments use the same OPFS/IndexedDB byte layer with `diary:`
payload references, but are not Vault secrets and therefore are stored as local
media blobs without the Vault encryption envelope. Existing inline `dataUrl`
attachments remain readable and are asynchronously migrated when they exceed
the 256 KiB inline threshold. Media plates resolve those references into
short-lived object URLs and revoke them on unmount. Universe backups include
diary payload references and their available bytes, while unavailable diary
payloads are marked rather than silently recreated.

## Security model and important caveat

The vault uses browser cryptography and local authorization checks:

- PBKDF2 derives verifier and encryption keys.
- AES-GCM seals Key Ring records and new large payloads.
- Per-file lock verifiers and in-memory authorization sets gate viewing,
  downloading, and execution.
- Diary HTML is sanitized before persistence and on relevant import/paste
  paths.
- Web-app payloads are rewritten to local blob URLs and receive a restrictive
  CSP; external references are removed by the bundler.
- JavaScript and Python runs can be terminated.

This is **not server authentication** and is not a trusted security boundary
against a user who can inspect or alter the browser profile, run same-origin
scripts, install extensions, use developer tools, or access the machine/profile
storage. Local lockout data in localStorage can also be modified by someone
with that level of access. Treat the vault as local-at-rest protection and a
contained browser workspace, not as a replacement for a server-managed secret
store.

## Data model summary

The primary TypeScript interfaces are in `src/types.ts`.

- `CosmicBody` — a star, planet, dwarf, nebula, black hole, or vault body with
  palette and orbit data.
- `DiaryEntry` — a journal page attached to a body, with HTML body, tags,
  bookmark/archive state, mood/weather, timestamps, and attachments.
- `Connection` — a link between two cosmic bodies.
- `VaultFile` — file metadata, payload reference/content, checksum, lock,
  versions, EFS directory, dedup information, and payload availability.
- `VfsNode` — an EFS directory or file node with parent pointer and optional
  tags, pin, and color.
- `VfsShadow` — frozen EFS metadata tree and generation information.
- `VaultUser`, `PasswordRecord`, and `VaultSecrets` — local identity and
  encrypted Key Ring data.
- `UniverseState` — the complete persisted application state, including active
  reality, custom realities/galaxies, bodies, entries, links, vault records,
  EFS state, trash, users, secrets, audit entries, and migration version.
- `RealityConfig`, `GalaxyData`, `GalaxyClusterData`, and `CosmicLineage` —
  generated and user-overridden multiverse hierarchy data.

## Database schema / API routes

### Server database

There is no server database, SQL schema, API service, or HTTP route registry in
this repository. The application is a client-side SPA.

### Browser persistence schema

The closest equivalent to a database schema is:

```text
localStorage
  my-universe:v4       serialized UniverseState
  my-universe:muted    audio preference
  eventide:autolock    Key Ring timeout
  eventide:guard:*     unlock backoff state

Large diary media references
  Attachment.payloadRef = diary:<attachment-id>

IndexedDB: eventide-universe (version 1)
  object store: payloads
  key: payload id
  value: encrypted or legacy payload Blob

OPFS (when available)
  payload-<id>.bin     encrypted Vault or local diary payload Blob
```

### HTTP/API endpoints

None. There are no frontend API calls to an application backend and no server
routes to document. `/` is the Vite SPA entry point, and `/bh-test.html` is a
static public diagnostic page rather than an API endpoint.

## Browser capabilities used

The implementation directly uses the following browser APIs:

- WebGL and Three.js.
- WebCrypto (`crypto.subtle`) for PBKDF2, AES-GCM, and SHA-256.
- localStorage.
- IndexedDB and optionally OPFS.
- Web Workers and blob URLs.
- `DOMParser` and `DecompressionStream` for web-app bundling and ZIP deflate.
- File System/FileReader APIs, object URLs, and downloads.
- Web Audio, `MediaRecorder`, and microphone permission for audio features.
- Canvas 2D for thumbnails, generated textures, export, and effects.
- `getUserMedia` for diary voice recording.

Exact browser version support is not stated in the repository. **[Question]**
A formal compatibility matrix should be added if the application needs to
support browsers without OPFS, `DecompressionStream`, Web Audio, WebGL, or
MediaRecorder.

## Static diagnostic page

`public/bh-test.html` is a standalone black-hole/WebGL verification fixture.
When served by Vite, it can render either a raw WebGL shader test or the actual
Three.js `createBlackHole` implementation:

```text
/bh-test.html
/bh-test.html?mode=three
/bh-test.html?debug=pipeline
/bh-test.html?debug=ray
/bh-test.html?debug=state
```

The page records shader/window errors and exposes diagnostic data on `window`
for browser inspection.

## Known limitations and incomplete areas

- **[Code] No automated tests are present.** `package.json` contains no test
  runner or test script. `npm run typecheck` and `npm run build` are the
  available automated validations.
- **[Code] No backend or cloud synchronization exists.** Data is tied to the
  browser profile unless the user exports JSON/key-ring backups.
- **[Code] Python depends on an external CDN.** The first Python run requires
  access to jsDelivr and downloads the Pyodide runtime.
- **[Code] Worker execution is not a complete security boundary.** The source
  explicitly documents that browser capabilities are not fully isolated for
  JavaScript and Python runners.
- **[Code] ZIP support is intentionally limited.** The native reader handles
  stored and deflate entries and refuses archives whose total uncompressed
  size exceeds 256 MB. Other compression/encryption features are not
  implemented by `src/storage/zip.ts`.
- **[Code] Unsupported file types are storage/download objects, not runnable
  applications.** The actual runner detection covers HTML, JavaScript,
  Python, PDF, and archive extensions/MIME types.
- **[Code] Storage fallback behavior varies by browser.** If OPFS and IndexedDB
  are unavailable, small text may be stored inline, media may fall back to a
  data URL, and other objects may be marked sealed without their original
  bytes.
- **[Code] Legacy diary and identity media can use inline data URLs or serialized
  frames.** New large diary attachments are moved to local OPFS/IndexedDB
  payloads, but avatar frames and older Vault/diary records can still pressure
  browser memory and quota; state persistence catches quota failures and
  continues in memory.
- **[Code] The manifest declares `@supabase/supabase-js`, but no source import
  or client initialization was found.** Supabase is not part of the current
  runtime storage path.
- **[Code] The manifest declares `react-router-dom`, but no router setup or
  route definitions were found.** Navigation is currently mode/state based,
  not URL-route based.
- **[Question] The package name is `sandbox-workspace`, while the visible app
  title is MY UNIVERSE.** The intended distribution/project name is not
  stated separately in the source.
- **[Question] A minimum supported Node.js/browser version is not documented.**
  Add one before publishing a compatibility promise.

## Development notes

- `BUILD` in `src/App.tsx` is a manually bumped visible build marker.
- The app uses Tailwind CSS 4 through `@tailwindcss/vite` plus substantial
  custom CSS in `src/index.css`.
- Vite manually chunks `three` and the React-related packages. The main
  application chunk may still produce a large-chunk warning during production
  builds.
- Do not treat comments describing cosmic or filesystem behavior as claims of
  a real server filesystem or physically isolated operating-system process;
  these are browser-side simulations and storage abstractions implemented by
  the source.

## Engineering assessment

This section is a short technical assessment of the implementation as it exists
now. It is intentionally separate from the feature reference above so that a
future maintainer or AI system can distinguish current strengths from follow-up
work.

### Overall quality

MY UNIVERSE is a substantial, coherent client-side application rather than a
small demo. Its strongest qualities are the depth of the domain model, the
amount of behavior connected end to end, and the care taken around local data
repair, payload authorization, cleanup, and browser capability fallbacks.

The main quality limitation is not missing core functionality; it is the lack
of automated regression coverage around a large amount of stateful UI and
browser-only behavior. The code compiles strictly and builds successfully, but
there is no unit, integration, end-to-end, accessibility, or visual-regression
test suite in the repository.

### Performance profile

#### Measured build profile

The latest local production build completed successfully after transforming
1,683 modules. The output is approximately:

| Artifact | Minified size | Gzip size |
|---|---:|---:|
| Initial application chunk | 202.00 kB | 58.33 kB |
| Engine-on-demand chunk | 183.84 kB | 53.90 kB |
| Three.js chunk | 537.45 kB | 134.98 kB |
| React/vendor chunk | 142.93 kB | 45.78 kB |
| Vault-on-demand chunk | 199.77 kB | 54.54 kB |
| Diary-on-demand chunk | 72.87 kB | 20.50 kB |
| Core-on-demand chunk | 27.30 kB | 8.09 kB |
| Export-on-demand chunk | 409.48 kB | 136.17 kB |
| CSS | 196.34 kB | 29.07 kB |
| Pyodide | not bundled; loaded in a reusable worker session | n/a |

The initial application chunk was reduced from the previous 1,156.84 kB
baseline to 202.00 kB by lazy-loading the engine/Three.js graph, Vault, Core
Mode, Diary, export tooling, and interaction-heavy modal trees. The build no
longer emits the configured 1,100 kB main-chunk advisory. Three.js and CSS remain intentionally substantial
because they power the visual scene and global design system; the new
`/perf-test.html` page provides repeatable browser measurements for runtime
costs.

#### Good performance decisions already present

- The WebGL engine owns scene resources and has explicit lifecycle/disposal
  paths rather than rebuilding unmanaged Three.js objects indefinitely.
- Renderer pixel ratio and antialiasing adapt to low-power devices using
  hardware concurrency and `deviceMemory` when available.
- Vault mode stops the expensive scene update/render work while its overlay is
  active and resumes instantly when the user returns to Space mode.
- React state is exposed through a small external store, avoiding a provider
  tree for the entire application.
- Main-state persistence is debounced by 350 ms instead of serializing on every
  keystroke synchronously.
- Large diary attachments are migrated asynchronously to OPFS/IndexedDB and
  retain only a `payloadRef` plus metadata in persisted universe state.
- Existing inline diary data URLs remain readable for backward compatibility;
  media plates resolve externalized attachments to revocable object URLs.
- EFS copy/fork and shadow operations share immutable payload references instead
  of copying bytes for every metadata operation.
- JavaScript and Python execution runs in workers and can be terminated.
- Python/Pyodide is loaded only when Python execution is requested and reused
  for sequential runs inside one explicitly terminable session.
- Vault crypto/executors, Core Mode, Diary, export tooling, and heavy modals are
  not part of the initial application chunk.
- Vite still separates the Three.js and React/vendor packages.

#### Main runtime cost centers

1. Three.js, generated geometry, shaders, procedural textures, and animated
   cosmic layers still dominate the 3D path.
2. CSS remains a large global artifact because Tailwind utilities and the custom
   visual system are emitted together; its compressed size is much smaller than
   its minified size, but feature-level CSS splitting is still possible.
3. `UniverseState` metadata is still serialized as a whole for compatibility,
   but large diary attachments are now externalized before persistence.
4. Avatar frames, thumbnails, and legacy inline vault content can still create
   memory pressure because they are part of older identity/metadata formats.
5. Export tooling is now deferred, but its on-demand chunk is intentionally
   large because it includes document/image generation dependencies.
6. Pyodide still has a large first-run network and memory cost; subsequent runs
   in the same active session reuse the loaded runtime.

#### Highest-value performance improvements

Remaining performance work should be prioritized in this order:

1. Use `/perf-test.html` on a low-end laptop to establish frame time, storage,
   boot, and reality/galaxy rebuild baselines.
2. Split or reduce feature-level CSS after generated-CSS coverage is measured;
   do not delete custom selectors by guesswork.
3. Profile Three.js draw calls, geometry count, texture memory, post-processing,
   and stage rebuild time before changing visual quality.
4. Move remaining large avatar frames and legacy inline vault content to the
   payload store with an explicit migration and encryption policy.
5. Consider further export/archive chunk splitting only if users commonly avoid
   those features; they are already absent from initial load.
6. Only then tune particle counts, shader resolution, post-processing, and
   procedural texture sizes.

Completed optimizations in this pass are lazy mode loading, lazy diary export,
crypto/storage graph separation, external diary payloads, low-power rendering,
Vault idle rendering, reusable Pyodide sessions, and opt-in performance
telemetry.

Do not remove lifecycle disposal, encryption, restore validation, or payload
availability markers merely to reduce a warning or make the code shorter.

### Reliability and maintainability

Positive reliability mechanisms already implemented include:

- strict TypeScript checking through `tsconfig.json`;
- state migrations and normalization for legacy locks, diary HTML, EFS data,
  and missing optional fields;
- diary HTML sanitization before persistence and on import/paste paths;
- a React error boundary for panel-level crashes;
- versioned universe backup/restore with unavailable-payload markers;
- EFS reachability healing, copy-on-write shadows, scrubbing, and deduplication;
- explicit worker termination and Three.js resource cleanup;
- project-scoped Zed configuration for Tailwind v4's valid `@theme` directive.

Maintainability risks are:

- `src/state.ts` is a powerful central coordinator and therefore a high-change,
  high-regression surface;
- browser APIs have different availability and quota behavior, especially
  OPFS, `DecompressionStream`, Web Audio, MediaRecorder, and WebGL;
- many complex interactions are encoded in UI components without automated
  behavior tests;
- `@supabase/supabase-js` and `react-router-dom` are declared dependencies but
  are not part of the current runtime architecture;
- custom CSS, Tailwind utilities, Three.js materials, and generated visual
  systems must be changed together carefully to preserve the visual language.

### Security and trust assessment

The vault has meaningful local-at-rest protections: PBKDF2-derived keys,
AES-GCM encrypted records and new payloads, per-file lock verifiers, in-memory
authorization, sanitized diary HTML, restrictive web-app payload CSP, and
terminable runners. This is good defensive engineering for a browser-local
workspace.

It is not equivalent to server authentication or a hardened sandbox. A person
who controls the browser profile, developer tools, extensions, same-origin
scripts, or the machine can inspect or modify local data and localStorage
lockout state. JavaScript and Python workers are execution controls, not trusted
security boundaries. Any future documentation or AI-generated implementation
must preserve this caveat.

### UX and accessibility assessment

The product has a strong interaction identity: spatial navigation, animated
transitions, draggable windows, hover cards, cosmic hierarchy, visual telemetry,
rich media plates, and a terminal-like Eventide shell all reinforce the concept.
The tradeoff is interaction density. A future quality pass should formally
check keyboard navigation, focus visibility, reduced-motion behavior, screen
reader labels, pointer/touch parity, color contrast, and recovery from blocked
browser permissions. The repository does not currently claim a completed
accessibility audit.

## Canonical reconstruction specification for an AI

This is the implementation brief to use if another AI must recreate this
project. It describes the current product contract, not a simplified clone.
When a choice is ambiguous, prefer the source files named below over generic
framework conventions.

### Product identity and non-negotiable constraints

Build a polished single-user browser application called **MY UNIVERSE**. It is a
private, local-first workspace that turns personal information into an
interactive cosmic metaphor:

- memories, ideas, people, projects, and moments become cosmic bodies;
- diary entries attach human context to those bodies;
- realities and galaxies provide a navigable hierarchy;
- the Universal Vault stores files, credentials, and locally runnable payloads;
- Core Mode provides editing, timeline history, statistics, and backup/restore.

Non-negotiable constraints:

1. This is a Vite + React + TypeScript SPA. Do not invent a backend, REST API,
   server database, login service, cloud sync layer, or server filesystem.
2. State must remain usable offline after the app and any optional runtime assets
   are available. Browser storage is the persistence boundary.
3. Use WebCrypto and browser storage APIs for the vault. Do not send vault,
   diary, or universe data to an external service.
4. Keep the 3D scene and the utility workspace integrated. Do not turn the
   project into a generic dashboard or replace the cosmic navigation with a
   table-only CRUD interface.
5. Preserve the distinction between metadata and payload bytes. EFS nodes hold
   file structure; OPFS/IndexedDB hold large payloads.
6. Preserve the security caveat: browser-local encryption and worker execution
   are not a server trust boundary.
7. Keep Tailwind CSS v4 syntax, including `@import "tailwindcss"` and `@theme`.
   The `.zed/settings.json` configuration suppresses only the editor's false
   `unknownAtRules` warning.

### Required technology and configuration

- React 18 with React DOM.
- TypeScript 5.x, strict mode, `jsx: react-jsx`, ES2020 target, bundler module
  resolution, no emitted JavaScript from `tsc`.
- Vite 6 with `@vitejs/plugin-react` and `@tailwindcss/vite`.
- Tailwind CSS 4 plus substantial custom CSS in `src/index.css`.
- Three.js for the WebGL scene, shaders, camera, generated textures, picking,
  and resource lifecycle.
- Lucide React for utility icons.
- Framer Motion, Recharts, date-fns, html-to-image, jsPDF, canvas-confetti,
  dnd-kit, and UUID are available dependencies used by the broader UI/tooling.
- Development server: `0.0.0.0:3000`, strict port mode.
- Vite manual chunks: `three` and React-related packages.
- No environment variables are required by the current source.

The canonical entry path is:

```text
index.html
  -> src/main.tsx
     -> src/index.css
     -> src/App.tsx
```

### Application shell and modes

`App.tsx` is the coordinator. It owns the `UniverseEngine`, connects engine
callbacks to the external state store, and switches between three top-level
surfaces:

#### Space mode

The default full-screen WebGL experience. It contains the cosmic scene, camera
controls, selection/context actions, hover cards, physics telemetry, multiverse
navigation, audio controls, and diary window overlays.

#### Core Mode

A high-level control and editing surface for the universe. It provides object
search/filtering, reality and galaxy editing, timeline playback, statistics,
world creation, JSON backup/restore, and historical inspection.

#### Universal Vault

A local identity-gated workspace. It combines the Key Ring, file manager,
Eventide shell, file viewers/runners, EFS inspector, trash, snapshots, scrub,
deduplication, and payload authorization.

The modes should feel like layers of the same world rather than unrelated
routes. Navigation is state/mode based; no router is required for the current
product.

### Visual design language

Recreate the visual system as dark, cinematic, technical, and tactile:

- near-black void and abyss backgrounds;
- muted blue slate borders and text;
- warm solar-gold accents;
- teal-ice status and interaction accents;
- glass panels using translucency, blur, thin borders, inset highlights, and
  restrained shadows;
- uppercase mono labels for telemetry and controls;
- display typography for major cosmic titles;
- subtle scanlines, glow, grain, gradients, starfields, and orbital motion;
- responsive layouts that keep the scene dominant while allowing dense utility
  panels and draggable windows.

The primary theme values are declared in `src/index.css` under `@theme`:
`--color-void`, `--color-abyss`, `--color-panel`, `--color-line`, slate text
colors, `--color-paper`, `--color-solar`, `--color-solar-hot`,
`--color-teal-ice`, and `--color-danger`. The font families are Unbounded,
Space Grotesk, and Space Mono.

### Domain model to implement

The minimum stable model is defined in `src/types.ts`:

```text
UniverseState
  activeRealityId
  customRealityDescriptions
  customRealities
  deletedRealityIds
  customGalaxies
  customRealityMeta
  bodies: CosmicBody[]
  entries: DiaryEntry[]
  connections: Connection[]
  vault: VaultFile[]
  efs: VfsState
  vaultTrash: TrashedFile[]
  vaultUsers: VaultUser[]
  secrets: VaultSecrets | null
  audit: AuditEntry[]
  visitedAt
  version
```

Important relationships:

- `CosmicBody` has an id, name, kind, meaning, note, creation time, palette,
  radius, and orbit values.
- `DiaryEntry.planetId` points to a cosmic body and contains sanitized HTML,
  tags, bookmark/archive flags, mood, weather, timestamps, and attachments.
- `Connection` links two body ids.
- `VaultFile` contains metadata and a payload reference; it may have checksum,
  dedup source, lock, versions, missing-payload state, thumbnail, and EFS
  identity.
- `VfsNode` forms the parent-pointer directory tree. File nodes point to a
  `VaultFile`; payload bytes do not live in the tree.
- `VfsShadow` freezes EFS metadata and retains shared payload ids for cheap
  copy-on-write restore.
- `VaultUser`, `PasswordRecord`, and `VaultSecrets` represent local identity,
  encrypted credentials, and audit-related vault data.
- Reality, galaxy, cluster, and lineage types are generated in
  `src/realities/` and overridden by user-authored state.

### State architecture and action rules

Implement a small external store in `src/state.ts`:

- keep the mutable internal state private;
- expose `getState`, `subscribe`, and a React `useSyncExternalStore` hook;
- expose domain actions through the `actions` object rather than scattering
  persistence logic across components;
- create immutable snapshots for React subscribers;
- debounce persistence by 350 ms;
- run migrations and repairs when loading;
- update runtime realities after custom reality, deletion, description, galaxy,
  or metadata changes;
- sanitize diary HTML at load and mutation boundaries;
- preserve missing payload markers during restore instead of fabricating bytes.

The authoritative metadata key is `my-universe:v4`. Other current keys are
`my-universe:muted`, `eventide:autolock`, and `eventide:guard:<userId>`.

### 3D engine contract

`src/engine/engine.ts` and `src/engine/cameraRig.ts` are responsible for:

- creating the renderer, scene, camera, lighting, materials, and cosmic groups;
- rendering cosmic-web and multiverse stages;
- camera orbit, pan, wheel/pinch zoom, keyboard movement, focus framing, and
  drag inertia;
- picking bodies and hierarchy objects;
- reality, cluster, galaxy, and inner-system navigation;
- rebuilding runtime scene content when reality or galaxy data changes;
- scripted Kamui transitions between major scales;
- callback events back to React/App rather than directly owning application data.

`blackhole.ts` and `shaders.ts` provide the Eventide black-hole visual and GLSL
programs. Every created geometry, material, texture, render target, listener,
and animation resource must have a disposal path when a scene or engine is
replaced.

### Diary contract

`DiaryWindow.tsx` is a movable/resizable window system, not just a textarea.
Recreate:

- rich text editing whose stored HTML is sanitized;
- title, body, tags, bookmark/archive, mood, weather, search, and templates;
- image, GIF, video, audio, file, and code attachment plates;
- floating attachment positions, sizing, tilt/tone treatments, and glued inline
  attachments;
- audio peaks/waveform presentation and microphone recording where permitted;
- linked pages, minimize/maximize, temporal inspection, and document export;
- an 80 MB UI rejection threshold for diary video attachments.

Never render persisted diary HTML directly without the existing sanitization
boundary.

### Vault and EFS contract

The vault must feel like a local operating shell while remaining browser-side:

1. Create/select a local identity.
2. Unlock using a WebCrypto-derived verifier.
3. Keep decrypted authorization/session material in memory only where possible.
4. Lock automatically after configured inactivity.
5. Gate sensitive view, download, and execution actions.
6. Store file metadata in state and large payloads in OPFS/IndexedDB.
7. Use checksums for integrity and deduplication.
8. Support EFS tree navigation, breadcrumbs, search, sort, grid/list modes,
   selection, drag/drop, clipboard, rename, move, copy/fork, tags, pins,
   colors, trash, restore, purge, shadows, scrub, and dedup.

Cryptography contract:

- PBKDF2 through WebCrypto derives verifier/encryption material.
- New KDF records target 310,000 rounds.
- AES-GCM encrypts Key Ring data and new large payloads.
- SHA-256 identifies plaintext payload integrity and deduplication.
- Passwords and object locks are represented by verifiers, not stored plaintext
  passwords.
- Legacy lock/payload formats may be normalized or re-sealed after authenticated
  access.

Execution contract:

- HTML archives are bundled to local blob URLs and executed in a CSP-restricted
  opaque-origin iframe.
- JavaScript executes in a dedicated terminable worker with console piping.
- Python executes through Pyodide in a dedicated terminable worker.
- PDFs use a sandboxed/native browser viewer.
- ZIP files support listing, extraction, and extraction into EFS; archive web
  apps may launch through the HTML bundler.
- Unknown formats remain stored/downloadable and are not falsely advertised as
  runnable.

### Persistence and browser fallback contract

Implement the storage layers in this order:

1. localStorage for small serialized metadata and preferences;
2. OPFS for large payload files when available;
3. IndexedDB database `eventide-universe`, version 1, object store `payloads`,
   as the compatibility/fallback payload store;
4. explicit unavailable/sealed markers when the browser cannot preserve bytes.

Do not assume all browsers support OPFS, `DecompressionStream`, WebGL, Web
Audio, MediaRecorder, Web Workers, or microphone permissions. Feature-detect
these APIs and keep the rest of the workspace usable when an optional feature
is unavailable.

### Recommended implementation order for a new build

1. Scaffold Vite, React, TypeScript strict mode, Tailwind v4, and the global
   theme.
2. Define `types.ts` and create deterministic seed data for bodies and authored
   realities.
3. Implement the external store, localStorage key, debounced persistence,
   migrations, and `actions`.
4. Build the Three.js engine and camera rig with disposal before adding complex
   overlays.
5. Add Space-mode selection, body editing, meanings, connections, and physics
   telemetry.
6. Add diary entries, sanitized rich text, media plates, windows, recording,
   and export.
7. Add realities, clusters, galaxies, lineage, Core Mode, timeline, and
   backup/restore.
8. Implement payload storage, WebCrypto, identities, locks, Key Ring, EFS,
   trash, shadows, scrub, and dedup.
9. Add HTML/JavaScript/Python/PDF/archive runners with explicit authorization,
   CSP, worker termination, and missing-payload handling.
10. Add error boundaries, diagnostics, responsive behavior, and performance
    profiling.
11. Run typecheck, production build, browser smoke tests, storage migration
    tests, and execution containment tests before calling the recreation done.

### Acceptance checklist for a faithful recreation

A generated implementation is not equivalent until it can demonstrate all of
the following:

- launches as a client-only Vite SPA without a backend or environment secret;
- renders an interactive Three.js cosmic scene with camera navigation and
  selection;
- creates and edits bodies, meanings, notes, links, realities, galaxies, and
  lineage views;
- opens diary pages attached to bodies with sanitized rich text, tags, mood,
  weather, media, movable windows, and export;
- persists and migrates state through `my-universe:v4`;
- stores large payloads through OPFS/IndexedDB with checksum and availability
  metadata;
- creates a local vault identity and encrypts Key Ring records with WebCrypto;
- supports EFS tree operations, copy-on-write shadows, scrub, dedup, trash, and
  restore;
- authorizes, runs, and terminates the supported browser payload runners;
- restores backups without pretending missing payload bytes exist;
- disposes Three.js and worker resources;
- passes strict typecheck and production build;
- documents limitations instead of claiming browser-local controls are a server
  security boundary.

### Do not invent these features

Unless explicitly requested as a separate project change, do not add:

- Supabase authentication or cloud synchronization merely because the package
  is declared;
- REST/GraphQL endpoints, server routes, SQL migrations, or server-side file
  storage;
- URL routing as a replacement for the current mode-based shell;
- a fake operating-system process sandbox for browser workers;
- claims that localStorage lockout or AES-GCM prevents a machine owner from
  inspecting the browser profile;
- a generic admin dashboard that removes the cosmic interaction model;
- an automated test status claim when tests have not actually been added and
  executed.

## Current verification snapshot

At the time this README was expanded:

```text
npm run typecheck  -> passes
npm run build      -> passes
project diagnostics -> 0 errors, 0 warnings
```

The initial application chunk is now approximately 202.00 kB minified /
58.33 kB gzip, below the configured 1,100 kB warning threshold. The engine and
Three.js are requested immediately for the Space experience but are now split
from the application shell; Vault, Core, Diary, and export remain on demand.
The remaining large artifacts are intentional vendor or feature chunks,
especially Three.js and document export. Open `/perf-test.html` through Vite and append `?perf=1`
(as already configured by that page) to collect browser-specific frame and
persistence measurements. There is no automated test runner in `package.json`;
manual browser verification remains necessary for WebGL, storage, microphone,
workers, archives, and payload execution.

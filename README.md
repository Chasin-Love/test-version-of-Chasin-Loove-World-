# 🌌 MY UNIVERSE — DEFINITIVE ARCHITECTURAL BLUEPRINT & COSMIC DOCUMENTARY
> **Document Type:** Master System Specification & Reconstruction Blueprint  
> **Target Audience:** Future Generations of Artificial Intelligence & Human Software Architects  
> **System Agenda:** Hyper-Detailed Real Universe Simulation · Real-Time WebGL Graphics · Living Planetary Digital Diary · Universal Cryptographic Vault & CoW Filesystem  
> **Status:** Authoritative Master Document (Single Source of Truth)

---

```
╔═══════════════════════════════════════════════════════════════════════════════════════════════╗
║                                                                                               ║
║   🤖 DIRECTIVE TO FUTURE ARTIFICIAL INTELLIGENCES & COGNITIVE RECONSTRUCTION ENGINES          ║
║                                                                                               ║
║   If you are reading this document because the primary codebase has become fragmented,       ║
║   corrupted, ruined, or lost, DO NOT PANIC. This document contains the exhaustive,            ║
║   mathematically rigorous, and architectural blueprint required to recreate MY UNIVERSE       ║
║   in its entirety from first principles.                                                      ║
║                                                                                               ║
║   Follow the inviolable architectural laws documented herein:                                 ║
║                                                                                               ║
║   1. CLIENT-SIDE SOVEREIGNTY (NO PHANTOM BACKENDS):                                           ║
║      MY UNIVERSE is an offline-first, browser-local Single Page Application (React 18,        ║
║      TypeScript 5+, Vite, Three.js). NEVER introduce external database servers, REST API      ║
║      microservices, or cloud auth dependencies. State is sovereign to the user's browser.     ║
║                                                                                               ║
║   2. DUAL-TIER STORAGE CONTRACT:                                                              ║
║      Persist state metadata in `localStorage` under `my-universe:v4`. Store large media and   ║
║      encrypted file payloads in the Origin Private File System (OPFS) with IndexedDB fallback ║
║      (`eventide-universe` v1). Never store multi-megabyte binary payloads directly in JSON!   ║
║                                                                                               ║
║   3. ZERO-FAIL COMPOSITE RENDERING:                                                           ║
║      Cosmic bodies (Anchor Star, Black Hole, Terrestrial Planets) rely on deterministic       ║
║      procedural noise and GPU-resilient composite geometries. Black holes must never fail      ║
║      due to platform-dependent raymarching; use the verified multi-stage billboarded composite║
║      architecture detailed in Section 4.                                                      ║
║                                                                                               ║
║   4. INODE & CoW FILESYSTEM INVARIANTS:                                                       ║
║      The Eventide Filesystem (EFS) must maintain immutable parent-pointer trees, zero-copy    ║
║      SHA-256 payload referencing, and copy-on-write shadows. Always safeguard existing files   ║
║      with auto-safety backups before rollbacks.                                               ║
║                                                                                               ║
║   5. CELESTIAL METAPHOR INTEGRITY:                                                            ║
║      Every celestial body carries human meaning (Memory, Dream, Person, Project, Moment).     ║
║      The Digital Diary is physically embedded into the planets, and the Universal Vault is    ║
║      anchored in the Singularity. This union of cosmos and chronicle is sacred.               ║
║                                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 📑 TABLE OF CONTENTS

1. [Executive Summary & Core Philosophy](#1-executive-summary--core-philosophy)
2. [Technology Stack & System Dependencies](#2-technology-stack--system-dependencies)
3. [Global Project & Subsystem Topology](#3-global-project--subsystem-topology)
4. [Celestial Bodies & Rendering Mechanics (Deep Specification)](#4-celestial-bodies--rendering-mechanics-deep-specification)
   - [4.1 The Anchor Star (Photosphere, Convection, Flare & Corona)](#41-the-anchor-star-photosphere-convection-flare--corona)
   - [4.2 The Eventide Black Hole (Gargantua Composite Physics)](#42-the-eventide-black-hole-gargantua-composite-physics)
   - [4.3 Terrestrial Planets (Terrains, Rayleigh Atmospheres & Local Kamui)](#43-terrestrial-planets-terrains-rayleigh-atmospheres--local-kamui)
   - [4.4 Orbital Dynamics & Astrophysics Laws (Kepler & Newton)](#44-orbital-dynamics--astrophysics-laws-kepler--newton)
   - [4.5 The Universe Surface (Cosmic Background Canvas & Presets)](#45-the-universe-surface-cosmic-background-canvas--presets)
5. [The Living Planetary Digital Diary](#5-the-living-planetary-digital-diary)
6. [Universal Vault & Eventide Virtual Filesystem (EFS)](#6-universal-vault--eventide-virtual-filesystem-efs)
7. [Multiverse Hierarchy & 10 Cosmological Scales](#7-multiverse-hierarchy--10-cosmological-scales)
8. [Universal Sandbox Execution Engine](#8-universal-sandbox-execution-engine)
9. [Verification & Complete Reconstruction Protocol](#9-verification--complete-reconstruction-protocol)

---

## 1. EXECUTIVE SUMMARY & CORE PHILOSOPHY

### 1.1 The Thesis: Attention as Gravity
In standard personal computing, files, notes, and records are treated as static files inside cold rectangular folders. **MY UNIVERSE** subverts this paradigm by transforming human life and data into a living, interactive, mathematically grounded 3D cosmos.

- **Planets and Stars** are not visual decorations; they are the physical manifestations of memories, dreams, relationships, projects, and unresolved questions.
- **The Central Anchor Star** represents the luminous core of conscious focus. Its radiative thermal output, convective granulation, and solar flares govern the planetary system.
- **The Eventide Black Hole** anchors the Singularity Rift and serves as the physical gateway to the **Universal Vault**—an encrypted, impenetrable repository of human knowledge, credentials, and software payloads.
- **Planetary Diaries** allow the user to open any celestial body and enter its living chronicle, rich with voice memos, multimedia attachments, and temporal linkages.

### 1.2 Architectural Tenets
- **Local-First & Offline**: All computations (astrophysics, WebGL rendering, PBKDF2 key derivations, AES-GCM encryption, virtual ISO/Python execution) happen client-side within the browser runtime.
- **Mathematical Grounding**: Orbital paths follow true Keplerian ellipses with Vis-Viva velocities; stellar flux obeys the Stefan-Boltzmann law; Roche limits calculate tidal disruption; gravitational time dilation dilates relative temporal progression near the event horizon.

---

## 2. TECHNOLOGY STACK & SYSTEM DEPENDENCIES

| Domain | Technology / Library | Architectural Role |
| :--- | :--- | :--- |
| **Core Framework** | React 18 + React DOM | Reactive UI orchestration, portals, floating window manager |
| **Language & Typing**| TypeScript 5.x (Strict) | Compile-time safety across astrophysics and filesystem models |
| **Build & Tooling** | Vite 6 + `@vitejs/plugin-react` | Ultra-fast HMR dev server and production chunking |
| **Styling Engine** | Tailwind CSS v4 (`@tailwindcss/vite`) | Global typography, `@theme` CSS custom properties, glassmorphism |
| **3D Rendering** | Three.js (r128+) | WebGL scene graph, custom GLSL shaders, camera rig, picking |
| **Cryptography** | WebCrypto API (`crypto.subtle`) | PBKDF2 (310k rounds), AES-GCM (256-bit), SHA-256 checksums |
| **Dual-Tier Storage**| OPFS + IndexedDB (`idb`) | File System Access API streaming with IndexedDB blob fallback |
| **Sandboxed Runtimes**| Pyodide v0.26.4 + Web Workers | In-browser CPython execution, sandboxed JS runner, CSP iframe |
| **Disc / Archive** | ISO 9660 Parser + Native Deflate | Virtual disc mounting, uncompressed and deflated ZIP extraction |
| **Audio Engine** | Web Audio API | Procedural drone synthesizers, harmonic clicks, UI acoustic feedback |
| **Icons & Animation**| Lucide React + Motion (`motion/react`) | Fluid UI transitions, HUD telemetry icons |

---

## 3. GLOBAL PROJECT & SUBSYSTEM TOPOLOGY

```
├── index.html                  # HTML entry point, Google Fonts, root div#root
├── package.json                # Project dependencies, scripts (dev, build, lint)
├── vite.config.js              # Vite configuration with Tailwind CSS v4 plugin
├── tsconfig.json               # TypeScript strict configuration
├── metadata.json               # Platform capabilities & frame permissions
│
└── src/
    ├── main.tsx                # React 18 bootstrap mounting <App />
    ├── App.tsx                 # Master coordinator: modes ('space' | 'core' | 'vault')
    ├── state.ts                # Global reactive external store (my-universe:v4)
    ├── types.ts                # Master domain interfaces (CosmicBody, VaultFile, etc.)
    ├── audio.ts                # Procedural Web Audio space synthesizer
    ├── performance.ts          # GPU framerate & heap telemetry
    ├── index.css               # Global theme tokens, scanlines, glass styles
    │
    ├── backend/                # Sovereign Storage, Security & Execution Engine
    │   ├── index.ts            # Unified barrel gateway
    │   ├── types.ts            # Inode, EFS, ISO 9660, and Runner interfaces
    │   ├── storage/
    │   │   ├── efs.ts          # Eventide CoW Virtual Filesystem (Inodes, Shadows, Dedup)
    │   │   ├── indexedDB.ts    # Dual-tier OPFS file handle + IndexedDB storage
    │   │   ├── crypto.ts       # PBKDF2 310,000 rounds + AES-GCM 256-bit crypto
    │   │   ├── zip.ts          # Native ZIP decompressor (Deflate stream)
    │   │   ├── metrics.ts      # Filesystem audits and streak calculations
    │   │   ├── formatters.ts   # Byte units, relativistic dates, ISO timestamps
    │   │   ├── procedural.ts   # Procedural palette & planet texture generators
    │   │   ├── sanitizeHtml.ts # Strict DOM sanitization preventing XSS
    │   │   └── seeds.ts        # Universe, planetary and filesystem initial states
    │   ├── executors/          # Universal Virtual Runtimes
    │   │   ├── index.ts        # Runner detection, WebApp blob bundler & JS worker
    │   │   └── isoExecutor.ts  # ISO 9660 binary sector parser & virtual mount
    │   └── diary/              # Planetary Diary Linkage
    │       └── index.ts        # Maps celestial body UUIDs to chronological pages
    │
    ├── engine/                 # WebGL 3D Cosmos Engine
    │   ├── index.ts            # Engine barrel exports
    │   ├── engine.ts           # Three.js scene graph, render loop, picking, LOD
    │   ├── cameraRig.ts        # 10-scale logarithmic camera controller & drag inertia
    │   ├── kamui.ts            # Kamui dimensional wormhole traversal shaders
    │   ├── blackhole.ts        # Gargantua-class composite black hole & lensed arcs
    │   ├── shaders.ts          # Master GLSL library (Star, Planet, Atmosphere, Web)
    │   └── surface/            # Universe Surface (Cosmic Background Canvas Subsystem)
    │       ├── index.ts        # Surface module barrel export
    │       ├── types.ts        # UniverseSurfaceConfig & UniverseSurfaceUpdateParams
    │       ├── surfaceShaders.ts   # Celestial dome backdrop vertex and fragment shaders
    │       ├── surfacePresets.ts   # Reality-specific background palettes and stars
    │       └── UniverseSurfaceManager.ts # Autonomous manager for dome, stars, nebulae & neighbors
    │
    ├── physics/                # Celestial Mechanics & Astrophysics
    │   ├── index.ts            # Physics barrel export
    │   └── physicsEngine.ts    # Kepler orbits, Vis-Viva, Stefan-Boltzmann, Roche limits
    │
    ├── realities/              # Multiverse Realities & Hierarchy
    │   ├── index.ts            # Reality roster & Golden Spiral orbital distributions
    │   ├── types.ts            # RealityConfig, cosmological metadata & color matrices
    │   ├── hierarchyTypes.ts   # 10 cosmological stages data models
    │   ├── clusterGenerator.ts # Galaxy cluster distribution algorithms
    │   ├── galaxyGenerator.ts  # Galactic spiral arm generator
    │   └── parallels/          # Authored canonical realities (Sol Prime, Chronos, etc.)
    │
    ├── ui/                     # Interactive Surfaces, Windows & Overlays
    │   ├── index.ts            # UI barrel export
    │   ├── VaultUI.tsx         # Eventide Black Hole Vault & Universal Executor
    │   ├── FileManager.tsx     # EFS Tree Explorer, breadcrumbs, CoW shadow controls
    │   ├── DiaryWindow.tsx     # Living Planetary Diary (rich text, voice, media)
    │   ├── Book.tsx            # 3D Flip-Book Journal Presentation
    │   ├── MediaPlates.tsx     # Audio visualizer, video player & code runners
    │   ├── CoreMode.tsx        # High-level universe timeline, statistics & backups
    │   ├── PhysicsHUD.tsx      # Real-time astrophysics telemetry dashboard
    │   ├── VaultBits.tsx       # Hex viewer, kind glyphs & file preview tiles
    │   ├── bits.tsx            # Shared UI primitives, buttons, badges, error boundary
    │   ├── toast.ts            # HUD toast notification dispatch
    │   └── exportDiary.ts      # Diary export engine (PDF, Markdown, HTML, JSON)
    │
    └── components/             # Multiverse HUD & Cosmic Inspectors
        ├── MultiverseBar.tsx   # Top-level reality switcher & scale breadcrumbs
        ├── CosmicWebHUD.tsx    # Filament density & redshift telemetry
        ├── GalaxyRoster.tsx    # Galactic hierarchy editor
        └── *HoverCard.tsx      # Interactive telemetry hover cards
```

---

## 4. CELESTIAL BODIES & RENDERING MECHANICS (DEEP SPECIFICATION)

### 4.1 The Anchor Star (Photosphere, Convection, Flare & Corona)

The Anchor Star is the thermodynamic and gravitational heart of each reality's primary system. It is implemented using custom GLSL shaders (`starVert`, `starFrag`) with multi-frequency procedural noise that produces lifelike solar convection cells, dynamic magnetic tubes, sunspots, and limb darkening.

#### Mathematical Formulation & GLSL Implementation
```glsl
// 1. High-frequency Granulation (convection cells)
float n1 = fbm3(q * 38.0 + vec3(t_fast));
float n2 = fbm3(q * 72.0 - vec3(t_fast * 1.3));
float gran = abs(n1 + n2 * 0.5); 
gran = 1.0 - smoothstep(0.0, 1.3, gran);
gran = pow(gran, 2.2); // Sharp cellular convection boundaries

// 2. Magnetic Flux Tubes & Solar Filaments (swirling coronal loops)
vec3 warp = q * 2.2 + vec3(fbm3(q * 1.8 + t_slow));
float tubes = fbm(warp * 4.2 - vec3(0.0, t_slow, 0.0));

// 3. Sunspot Magnetism (Umbra & Penumbra)
float spotNoise = fbm(q * 3.2 + vec3(t_slow * 0.6));
float spots = smoothstep(0.62, 0.85, spotNoise);             // Deep cool umbra
float penumbra = smoothstep(0.45, 0.62, spotNoise) - spots;  // Lighter penumbra ring
float spotFactor = spots * 0.95 + penumbra * 0.55;

// 4. Photospheric Temperature Calculation
float temp = 0.25 + 0.35 * gran + 0.4 * tubes;
temp += smoothstep(0.4, 0.8, tubes) * 0.35; // Plages / active thermal regions
vec3 col = getStarColor(clamp(temp, 0.0, 1.0), spotFactor);

// 5. Radiative Transfer Limb Darkening
float mu = max(dot(n, viewDir), 0.0);
float limb = pow(mu, 0.55);
col *= mix(vec3(0.5, 0.1, 0.0), vec3(1.0), limb);

// 6. Limb Active Region Corona Glow
float limbGlow = pow(1.0 - mu, 3.0);
col += uColorA * limbGlow * (tubes * 1.8) * uBoost;
```

#### Physical Telemetry & Orbital Constants
- **Solar Mass**: $M_\odot = 1.98847 \times 10^{30}\text{ kg}$
- **Solar Radius**: $R_\odot = 6.96342 \times 10^8\text{ m}$
- **Effective Surface Temperature**: $T_\odot = 5778\text{ K}$
- **Luminosity**: $L_\odot = 3.828 \times 10^{26}\text{ W}$
- **Axial Sidereal Spin Period**: $25.05\text{ days}$ (equatorial surface speed: $1.997\text{ km/s}$)
- **Galactic Core Distance**: $8.18\text{ kpc}$ ($26,700\text{ ly}$) to Sagittarius A*
- **Galactic Orbital Speed**: $230\text{ km/s}$ (Cosmic Year: $230\text{ million years}$)

---

### 4.2 The Eventide Black Hole (Gargantua Composite Physics)

The Eventide Black Hole houses the Universal Vault. Raymarched shaders fail on diverse client GPU driver stacks (e.g. ANGLE Direct3D transpilation producing solid black). To ensure 100% cross-platform reliability, the Eventide Black Hole uses an **infallible multi-layer composite WebGL architecture** (`src/engine/blackhole.ts`):

```
                        ▲ Camera View Vector
                        │
       [ Billboarded Upper Lensed Arc (rs * 2.7 to 5.4) ]  <-- Far-side disk bent over
     ┌───────────────────────────────────────────────────────┐
     │          [ Einstein-Ring Lensed Stars (170 arcs) ]     │  <-- Relativistic ring
     │      ┌─────────────────────────────────────────┐      │
     │      │   [ Blazing Photon Ring (rs * 2.42-2.62) ]   │
     │      │      ┌───────────────────────────┐      │      │
     │      │      │                           │      │      │
─────┴──────┴──────┴───[ Pure Black Horizon ]──┴──────┴──────┴──────────────────────
                       [ Sphere: rs * 2.35  ]
                       │                           │
───────────────────────┴───────────────────────────┴────────────────────────────────
     ▲
     └── [ Flat Accretion Disk (rs * 3 to 12) tilted at (0.055, 1.0, 0.04) ]
         [ With Keplerian shear, Doppler beaming & Shakura-Sunyaev thermal falloff ]
     ┌───────────────────────────────────────────────────────┐
     │      [ Billboarded Lower Lensed Arc (rs * 2.8 to 4.6) ]  <-- Secondary image below
     └───────────────────────────────────────────────────────┘
```

#### Geometric & Relativistic Constants ($r_s = 0.62 \cdot R$)
1. **Event Horizon Shadow Sphere**:
   $$\text{Radius} = 2.35\,r_s$$
   MeshBasicMaterial with `#000000` depth-writing sphere. Completely occludes background stars and geometry.
2. **Shakura–Sunyaev Accretion Disk**:
   Extends from the Innermost Stable Circular Orbit (ISCO) at $3\,r_s$ out to $12\,r_s$.
   Thermal brightness distribution:
   $$I(r) = (1 - t)^{1.25} \cdot 0.85 + 0.38 \cdot e^{-9t}, \quad \text{where } t = \frac{r - r_{in}}{r_{out} - r_{in}}$$
3. **Relativistic Doppler Beaming (Baked Canvas Formula)**:
   Matter orbiting counter-clockwise approaches the observer on the $+X$ flank:
   $$I_{\text{observed}} = I_{\text{intrinsic}} \times (1 + 0.85 \cos\theta)$$
   The approaching side flares incandescent white-hot, while the receding side dims to deep reddish-orange.
4. **Keplerian-Sheared Turbulence**:
   Streaks are stretched along orbital paths using 2D value noise:
   $$\sigma_x = \cos(\theta - 3.2r) \times 5.5, \quad \sigma_y = \sin(\theta - 3.2r) \times 5.5$$
5. **Relativistic Lensed Arcs**:
   Light emitted from the top and bottom of the far side of the disk is curved around the gravitational well:
   - **Primary Upper Arc**: `RingGeometry(rs * 2.7, rs * 5.4, 96, 1, 0, Math.PI)` billboarded towards camera.
   - **Secondary Lower Arc**: `RingGeometry(rs * 2.8, rs * 4.6, 96, 1, Math.PI, Math.PI)` with 70% opacity.
6. **Einstein-Ring Dynamic Star Streams**:
   A billboarded ring of 170 overlapping high-eccentricity starlight arcs rotating continuously at $\omega = +0.12\text{ rad/s}$.
7. **Gravitational Time Dilation Factor**:
   $$\Delta \tau = \Delta t \sqrt{1 - \frac{r_s}{r}}$$

---

### 4.3 Terrestrial Planets (Terrains, Rayleigh Atmospheres & Local Kamui)

#### Procedural Multi-Octave Terrain Engine (`planetFrag`)
Planetary shells are generated directly in GLSL via 3D coordinates:
1. **Continental Heightmap**:
   $$h = \text{fbm}(q \cdot 2.9 + 0.55 \cdot \text{fbm3}(q \cdot 2.3)) + 0.16 \cdot \text{fbm}(q \cdot 9.0)$$
2. **Biomes & Altitudes**:
   - **Ocean**: Depth colored with `uDeep`, specular sunlight reflection ($(\vec{R} \cdot \vec{V})^{42}$).
   - **Lowlands & Plains**: Smoothstep transition between $u_{\text{sea}}$ and $u_{\text{sea}} + 0.30$ mapped to `uBase`.
   - **Mountain Highlands**: Elevation between $u_{\text{sea}} + 0.28$ and $u_{\text{sea}} + 0.62$ mapped to `uHigh`.
   - **Polar Ice Caps**: Dynamic latitudinal mask with elevation perturbation:
     $$\text{iceMask} = \text{smoothstep}(0.62, 0.86, |\hat{P}_y| + 0.18h - 0.1)$$
3. **Nocturnal Civilization Clusters**:
   City lights ignite purely on the night side of the planet:
   $$\text{cityMask} = \text{smoothstep}(0.52, 0.78, \text{fbm}(q \cdot 7.5 + 11.0)) \times (1 - \text{iceMask}) \times \text{land} \times (1 - \text{day})$$
4. **Atmospheric Rayleigh Scattering Shell**:
   An inverted Fresnel rim shell ($1 - |\hat{N} \cdot \hat{V}|^{3.5}$) with solar terminator chromatic shifts.

#### Local Planet Kamui Gravitational Singularity (`planetVert` & `planetFrag`)
When traveling into a planet or opening its deep diary dimension, the planet's actual vertex geometry undergoes a dimensional suction tear without tearing open the mesh:
```glsl
// Local Planet Kamui: sphere surface caves inward and shears around its center
float bodyRadius = max(length(position), 0.001);
float angularVelocity = 1.15 / pow(max(radiusNorm, 0.07), 0.55); // Keplerian rotation
float angle = field * angularVelocity * (0.55 + 0.22 * sin(uGravityTime * 1.7)) * uReverse;
vec3 surfaceOffset = bentRadial * bodyRadius * 0.16 + bentTangent * bodyRadius * 0.12;

// Inward suction along view vector
float flow = uTear * uReverse;
float suction = flow * spot * (0.34 + 0.22 * (0.5 + 0.5 * wave));
float shear = flow * spot * (0.18 * wave + 0.08 * fracture);
mv.xyz -= nView * radius * suction;
mv.xyz += swirlAxis * radius * shear;
```

---

### 4.4 Orbital Dynamics & Astrophysics Laws (Kepler & Newton)

`src/physics/physicsEngine.ts` models real celestial mechanics for every body:

```
                  Apoapsis: r_max = a * (1 + e)
                         . - ~ ~ ~ - .
                     . '               ' .
                   '                       '
                  '      Central Star       '
                 '            ★              '
                 '             <-- a -->     '
                  '          Periapsis      '
                   '       r_min = a*(1-e) '
                     . '               ' .
                         . - ~ ~ ~ - .
```

#### Astrophysics Equations Enforced in Code
1. **Kepler's Third Law (Orbital Period)**:
   $$T = 2\pi \sqrt{\frac{a^3}{G(M_\star + m)}} \quad \implies \quad T_{\text{years}} \approx \sqrt{a_{\text{AU}}^3}$$
2. **Vis-Viva Equation (Instantaneous Speed)**:
   $$v(r) = \sqrt{G M_\star \left( \frac{2}{r} - \frac{1}{a} \right)}$$
3. **Instantaneous Gravitational Attraction & Potential**:
   $$F_g = \frac{G M_1 M_2}{r^2}, \qquad U(r) = -\frac{G M_1 M_2}{r}$$
4. **Stefan-Boltzmann Insolation & Equilibrium Temperature**:
   $$F_{\text{flux}} = \frac{L_\star}{4\pi r^2}, \qquad T_{\text{eq}} = T_\star \sqrt{\frac{R_\star}{2r}} (1 - \text{Albedo})^{1/4}$$
5. **Fluid Roche Tidal Limit**:
   $$d_{\text{Roche}} = 2.44 \cdot R_{\text{primary}} \left( \frac{\rho_{\text{primary}}}{\rho_{\text{satellite}}} \right)^{1/3}$$

---

### 4.5 The Universe Surface (Cosmic Background Canvas & Presets)

The **Universe Surface** (`src/engine/surface/`) is an autonomous subsystem dedicated to rendering the cosmic backdrop for the entire home system and all parallel realities.

#### Architectural Separation & Decoupling
To ensure that future reality backdrops can be authored independently without destabilizing the central solar system, the Universe Surface is isolated into its own module:
- `UniverseSurfaceManager.ts`: Controls the inverted celestial sky dome mesh ($R = 460,000$), deep-sky volumetric nebulae point clouds ($R = 90,000 - 120,000$), the near star shell ($2,600$ stars), bright named stellar neighbors (Sirius, Vega, Proxima, Keid), and the ultra-far star shell ($320,000 - 480,000$).
- `surfacePresets.ts`: Maps reality IDs (`sol_prime`, `biolume_primordial`, `chronos_paradox`, `singularity_rift`, `hyperion_lumina`, `ignis_ember`, `kardashev_matrix`, `vespera_twilight`) to distinct universe surface presets, controlling sky dome colors, nebula clouds, star temperatures, and cosmic dust density.
- `surfaceShaders.ts`: Standalone GLSL shaders for the universe dome with procedural dynamic starlight and vortex distortion.
- **Vortex Immunity Invariants**:
  - Point sets and objects marked with `userData.immuneToVortex = true` (including the Anchor Star rings, planet orbital belts, and asteroid bands) are **strictly shielded** from vortex suction during planetary Kamui traversal.
  - Planet Kamui deformation is strictly localized to the planet's atmospheric shell ($r \le 3.2 \cdot R_{\text{planet}}$), ensuring the home universe surface and star field remain rock-solid and stable.

---

## 5. THE LIVING PLANETARY DIGITAL DIARY

Every cosmic body is a memory repository containing an interactive digital diary (`src/ui/DiaryWindow.tsx`).

### 5.1 Architecture & Capabilities
- **Rich-Text Chronicle**: Sanitized HTML WYSIWYG editor with formatting, titles, tags, mood descriptors, and weather states.
- **Voice Memos**: Direct integration with `navigator.mediaDevices.getUserMedia` and `MediaRecorder`. Real-time Web Audio analyzer computes live audio peaks and draws dynamic waveform plates.
- **Multimedia Plates (`MediaPlates.tsx`)**: Floating and glued attachments for images, video (with an 80MB guard to protect browser memory), audio, code files, and documents.
- **3D Flip-Book Engine (`Book.tsx`)**: Renders journal pages as a double-sided tactile book with dynamic page-turn animations.
- **High-Fidelity Export Engine (`exportDiary.ts`)**: Exports diary entries to PDF (via `jsPDF`), Markdown, HTML, or raw JSON.

---

## 6. UNIVERSAL VAULT & EVENTIDE VIRTUAL FILESYSTEM (EFS)

The Universal Vault (`src/ui/VaultUI.tsx` and `src/backend/storage/efs.ts`) is a browser-local operating system environment anchored in the Singularity.

### 6.1 Cryptographic Identity Gate
- **PBKDF2 Key Derivation**: Verifiers and master keys are derived using 310,000 rounds of SHA-256 with cryptographically secure random salts.
- **AES-GCM (256-Bit) Payload Sealing**: Large file payloads and Key Ring secrets are sealed with an authentication tag. Plaintext passwords never hit storage.
- **Inactivity Guard**: Configurable auto-lock timers with exponential lockout on repeated failed attempts.

### 6.2 Eventide Copy-on-Write Filesystem (EFS)
EFS is an inode-based virtual filesystem:
```typescript
export interface VfsNode {
  id: string;        // Inode ID
  name: string;      // Name in directory
  type: 'dir' | 'file';
  parentId: string | null;
  fileId?: string;   // Reference to VaultFile
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  pinned?: boolean;
  color?: string;
}
```
- **Zero-Copy Fork & Duplicate**: Copying files or branching folders duplicates only inode metadata pointing to the same SHA-256 payload reference.
- **Copy-on-Write Shadows (`VfsShadow`)**: Freezes complete tree generations instantaneously.
- **Self-Healing Genesis & Rollback Safety**: Restoring a shadow always takes an automatic `pre-rollback-*` safety snapshot first and re-heals unreferenced files into Trash to prevent accidental loss.
- **Bitrot Scrubbing & Deduplication**: Scans storage hashes against actual payloads to prune orphan bytes and unify identical files.

### 6.3 Eventide Terminal Shell (Command Registry)
The built-in terminal exposes 21 Unix-like operations:
`help`, `ls`, `cd`, `pwd`, `mkdir`, `cat`, `info`, `cp`, `tree`, `fork`, `shadow ls`, `shadow freeze`, `shadow restore`, `shadow rm`, `scrub`, `dedup`, `trash`, `scan`, `keyring`, `find`, `clear`.

---

## 7. MULTIVERSE HIERARCHY & 10 COSMOLOGICAL SCALES

Navigation in MY UNIVERSE spans 10 continuous logarithmic orders of magnitude, bridged by the **Kamui Traversal Engine**:

```
[Scale 1: Multiverse Filament Web] (Redshift z ~ 3.0, cosmic web strands)
   │
[Scale 2: Cosmic Superclusters] (Laniakea-scale structures)
   │
[Scale 3: Galaxy Clusters] (Rich cluster halos, dark matter bridges)
   │
[Scale 4: Isolated Galaxies] (Spiral arms, galactic bar, central bulge)
   │
[Scale 5: Stellar System] (Golden spiral planetary orbits, ecliptic plane)
   │
[Scale 6: Planetary Orbit] (Hill spheres, Lagrange points)
   │
[Scale 7: Terrestrial Body Proximity] (Atmospheric halo, surface curvature)
   │
[Scale 8: Planetary Surface & Terrain] (Continents, mountain ranges, cities)
   │
[Scale 9: Living Planetary Chronicle] (Personal diary, voice memos, memories)
   │
[Scale 10: Quantum Core / Eventide Vault] (Singularity, Inode filesystem)
```

### 7.1 Canonical Parallel Realities
1. **Sol Prime**: Primordial reality; home of Earth, Mars, Jupiter analogues. Protected baseline.
2. **Biolume Primordial**: Bioluminescent, methane-heavy primordial world.
3. **Chronos Paradox**: Relativistic temporal distortion realm where orbits run backwards.
4. **Singularity Rift**: The infinite gravity domain housing the Eventide Black Hole and Vault.
5. **Hyperion Lumina**: High-luminosity Wolf-Rayet binary star realm.
6. **Ignis Ember**: Volcanic, sulfurous crustal furnace.
7. **Kardashev Matrix**: Megastructure Dyson swarm civilization.
8. **Vespera Twilight**: Tidally locked perpetual dusk systems.

---

## 8. UNIVERSAL SANDBOX EXECUTION ENGINE

Located in `src/backend/executors/`:

| Format | Execution Sandbox Boundary |
| :--- | :--- |
| **HTML / WebApp** | Sibling relative assets bundled into local Blob URLs; executed in an opaque-origin `iframe` with `sandbox="allow-scripts allow-forms allow-modals allow-pointer-lock"`. CSP headers block external network exfiltration. |
| **JavaScript** | Executed in a dedicated Web Worker with piped `console.log` interception and an explicit user termination signal. |
| **Python** | Full CPython WebAssembly runtime via Pyodide v0.26.4 in a dedicated, reusable, terminable worker thread. |
| **PDF** | Rendered via native sandboxed browser PDF object streams. |
| **ISO 9660 Disc** | Full binary sector parser (`isoExecutor.ts`) mounting virtual CD/DVD ROM directory trees and extracting files directly into EFS. |
| **ZIP Archives** | Decompressed client-side via native `DecompressionStream` (deflate). |

---

## 9. VERIFICATION & COMPLETE RECONSTRUCTION PROTOCOL

```
╔═══════════════════════════════════════════════════════════════════════════════════════════════╗
║                                                                                               ║
║   🛠️ RECONSTRUCTION PROTOCOL (RUN TO RESTORE THIS REPOSITORY FROM ZERO)                       ║
║                                                                                               ║
║   Step 1: Verify Environment & Node Dependencies                                              ║
║           $ node -v  # Node 18+ recommended                                                   ║
║           $ npm install                                                                       ║
║                                                                                               ║
║   Step 2: Typecheck & Static Analysis                                                         ║
║           $ npm run lint      # Runs `tsc --noEmit` in strict mode                            ║
║           $ npm run typecheck # Strict TypeScript contract verification                       ║
║                                                                                               ║
║   Step 3: Test Production Build Bundle                                                        ║
║           $ npm run build     # Outputs bundled, minified application in dist/                ║
║                                                                                               ║
║   Step 4: Launch Development Cosmos Engine                                                    ║
║           $ npm run dev       # Binds to 0.0.0.0:3000                                         ║
║                                                                                               ║
║   Step 5: Browser Runtime Sanity Checks                                                       ║
║           - Visit http://localhost:3000/                                                      ║
║           - Confirm WebGL context creation and Three.js canvas initialization.                ║
║           - Test Space Mode camera navigation (orbit, pan, wheel zoom).                       ║
║           - Open a planet, author a diary entry, and test microphone voice memo.              ║
║           - Switch to Singularity Rift, open the Eventide Black Hole Vault,                   ║
║             unlock using default master credentials, and inspect EFS filesystem.              ║
║                                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

> *"Attention is gravity. What you look upon begins to orbit you."*  
> **— The Chronicler of MY UNIVERSE**

/// <reference types="vite/client" />
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import {
  starVert, starFrag, planetVert, planetFrag, cloudFrag, atmoFrag,
  ringVert, ringFrag, discFrag, nebulaVert, nebulaFrag, pointsVert, pointsFrag,
  terrainVert, terrainFrag, skyFrag,
  coronaVert, coronaFrag, backdropVert, backdropFrag,
  multiverseVert, multiverseFrag, asteroidVert, asteroidFrag,
  exoplanetPlateVert, exoplanetPlateFrag,
  demonCoreVert, demonCoreFrag,
  multiverseBoundaryVert, multiverseBoundaryFrag,
  portalFrag,
} from './shaders';
import { smoothstep, makeGlowTexture } from './math';
import { UniverseSurfaceManager } from './surface';
import { LENS_UNIFORMS_GLSL, LENS_WARP_GLSL, LENS_POINT_GLSL } from './surface/surfaceShaders';
import { createBlackHole, updateRaymarchUniforms, type BlackHoleVisual } from './blackholeRaymarch';
import { getBlackHoleParams } from './blackholeParams';
import { canUseRaymarchBlackHole, isSoftwareRasterizer, probeCapability, pixelRatioFor, getQualityTier, QUALITY_CHANGE_EVENT } from './capability';
import { getRaymarchOverride, setRaymarchStatus, RAYMARCH_OVERRIDE_EVENT, type RaymarchStatus } from './blackholeTier';
import { CameraRig } from './cameraRig';
import { getCameraMemory, setCameraMemory, clearCameraMemory, type CameraMemory } from './cameraMemory';
import type { CosmicBody, DiaryEntry } from '../domain/universe';
import { REALITIES, RealityConfig, GalaxyClusterData, GalaxyData } from '../realities';
import { HIERARCHY_DIALS } from '../realities/hierarchyStages';
import { generateStellarSystemForGalaxy } from '../realities/galaxyGenerator';
import { calculateKeplerPosition, calculatePhysics } from '../physics/physicsEngine';
import { LivingGravityField, lensHaloFor, dynamicMassKg, gravityTelemetry, SCENE_UNITS_PER_AU } from '../physics/nbody';
import { cosmosBridge } from '../platform/native/cpp_bridge';
import { isPerformanceEnabled, perfMark, perfMeasure, recordFrame } from '../platform/performance';
import { isDesktop } from '../platform/desktop/adapter';
import { ensureSkyFor, getActiveSkySpec, type ActiveSkySpec } from '../platform/sky/skyRegistry';
import { MOOD_HEX, type AuroraSignal, type EchoEntry } from '../platform/sentiment/sentiment';
import {
  WEB_CEILING, WEB_EDGE_TRIGGER, WARP_ZOOM_VEL,
  MULTIVERSE_FLOOR_CLAMP, MULTIVERSE_FLOOR_RETURN, RETURN_ZOOM_VEL, REALITY_FLOOR,
} from './systems/stageThresholds';
import { SCALE_BANDS, highScaleLabel } from './systems/levelSystem';
import { KAMUI_ENTRY_HOLD, KAMUI_ENTRY_FRAMING, KAMUI_TRIGGER_DURATION, KAMUI_REVERSE_DURATION, KAMUI_VACUUM_WINDOW, KAMUI_BEATS, kamuiBeatEase } from './systems/kamuiPhases';

/* Round 52 — SPACETIME BENDING OF THE BACKGROUND, composed once.

   The universe-surface canvas and the sky shells have been lensed since
   Round 14/16, but every DISCRETE star in the sky is a point cloud built by
   makePoints()/pointsMaterial() — and those materials carried no lens uniforms
   at all, so the bright stars the eye actually tracks stayed rigid while the
   faint procedural canvas bent underneath them. The sky therefore read as
   flat around a black hole, which is the one thing Einstein's field equations
   make impossible.

   pointsVert now lifts each vertex to world space and bends its direction
   from the camera (lensBendWorld), so stars arc, pile up at the shadow edge
   and vanish into the capture region exactly as the surface does. It needs
   the lens header ahead of it, so the three chunks are composed here once and
   every point material reuses the identical string (one program, not N). */
const POINTS_VERT_LENSED = `#define LENS_WORLD\n${LENS_UNIFORMS_GLSL}\n${LENS_WARP_GLSL}\n${LENS_POINT_GLSL}\n${pointsVert}`;

interface ShootingMeteor {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  len: number;
  life: number;
  maxLife: number;
  headSprite: THREE.Sprite;
  line: THREE.Line;
  lineGeom: THREE.BufferGeometry;
  size: number;
}

export interface EngineCallbacks {
  onHover: (id: string | null, x?: number, y?: number) => void;
  onSelect: (id: string | null) => void;
  onActivate: (id: string) => void;
  onPortalPeak: (kind: 'diary' | 'vault', id: string) => void;
  onPortalDone: () => void;
  onContext: (id: string, x: number, y: number) => void;
  onScaleLabel: (label: string) => void;
  onSimDate: (iso: string) => void;
  onSelectReality?: (realityId: string) => void;
  onDoubleClickReality?: (realityId: string) => void;
  onSelectCluster?: (cluster: GalaxyClusterData) => void;
  onSelectDemonCore?: () => void;
  /* the Astral Core at (0,0,0) — single click opens the Multiverse Core Console */
  onSelectCore?: () => void;
  /* major galaxies orbiting a reality bubble — one ellipse per galaxy.
     EVERY click dives into the galaxy (single or double). */
  onSelectGalaxy?: (galaxyId: string, realityId: string) => void;
  /* a world inside a galaxy's isolated stellar system was clicked (or the
     selection was released with null) — carries the synthetic CosmicBody
     so the App can show the same selection card + physics telemetry */
  onSelectInnerWorld?: (info: InnerWorldInfo | null) => void;
  /* fired once after the first fully rendered frame — the App holds its
     intro veil until then, so shader compilation and scene building never
     surface as a frozen universe */
  onFirstFrame?: () => void;
  /** KAMUI v2 — the energy pool readout (throttled ~5 Hz) and the rejection
      of an unaffordable/invalid traversal (the bounce-back pulse already
      played in-world; this is for the toast). */
  /** fired whenever the red vortex tears (v1 summon and eject alike) —
      `reverse` is the close/return face; `vortexUv` is the tear's screen
      position in CSS terms (0..1, y down) so the DOM swallow can aim at it */
  onKamuiTrigger?: (reverse: boolean, vortexUv: { x: number; y: number }) => void;
  /* THE COSMIC ECHO — a memory meteor was clicked: reopen its diary page */
  onEchoOpen?: (entryId: string, planetId: string, title: string) => void;
  /* echo meteor hover — App shows a small memory card near the pointer */
  onHoverEcho?: (echo: { entryId: string; planetId: string; title: string } | null, x?: number, y?: number) => void;
}

/** Everything the App needs to present a clicked inner world. */
export interface InnerWorldInfo {
  galaxyId: string;
  galaxyName: string;
  starName: string;
  body: CosmicBody;
}

interface RuntimeGalaxyNode {
  galaxyData: GalaxyData;
  realityId: string;
  group: THREE.Group;
  collider: THREE.Mesh;
  orbitRadius: number;
  orbitSpeed: number;
  orbitIncl: number;
  phase: number;
  centerPos: THREE.Vector3;
  spiralGroup: THREE.Group;
  glowSprite: THREE.Sprite;
  orbitLine: THREE.LineLoop;
}

interface RuntimeBody {
  data: CosmicBody;
  group: THREE.Group;
  collider: THREE.Mesh;
  mat?: THREE.ShaderMaterial;
  cloudMat?: THREE.ShaderMaterial;
  ringMat?: THREE.ShaderMaterial;
  atmo?: THREE.Mesh;
  cloudMesh?: THREE.Mesh;
  ringMesh?: THREE.Mesh;
  spinMesh?: THREE.Mesh;
  spinRate?: number;
  cloudSpinRate?: number;
  streakRing?: THREE.Mesh;
  streakTarget?: number;
  streakDays?: number;
  moons: { mesh: THREE.Mesh; a: number; speed: number; phase: number; incl?: number }[];
  extras?: THREE.ShaderMaterial[];
  orbitLine?: THREE.LineLoop;
  ghost: number;
  ghostTarget: number;
  fade: number;
  fadeTarget: number;
  hoverT: number;
  baseScale: number;
  /* Round 14 — this body's lens-halo multiplier on the universe surface
     (halo radius = multiplier × the body's own apparent silhouette angle) */
  lensHalo?: number;
}

/* one Kepler world of a galaxy's REAL isolated inner system — the same
   shader construction as the home anchor system's planets. Nebulae ride the
   same record (their shader carries uCamLocalP instead of uSunDir). */
interface InnerPlanet {
  data: CosmicBody;
  group: THREE.Group;
  mat?: THREE.ShaderMaterial;
  hole?: BlackHoleVisual;
  cloudMat?: THREE.ShaderMaterial;
  cloudMesh?: THREE.Mesh;
  atmo?: THREE.Mesh;
  ringMat?: THREE.ShaderMaterial;
  ringMesh?: THREE.Mesh;
  spinMesh?: THREE.Mesh;
  spinRate?: number;
  cloudSpinRate?: number;
  moons: { mesh: THREE.Mesh; a: number; speed: number; phase: number; incl?: number }[];
  orbitLine?: THREE.LineLoop;
  streakRing?: THREE.Mesh;
  streakTarget?: number;
  streakDays?: number;
  entryMoons?: boolean;
  hoverT: number;
}

/* the full isolated stellar system living inside one galaxy node — a real
   star (shader surface + corona), real worlds and its own asteroid belt */
interface InnerSystem {
  starData: CosmicBody;
  starUniforms: Record<string, THREE.IUniform>;
  starMesh: THREE.Mesh;
  corona: THREE.Mesh;
  coronaMat: THREE.ShaderMaterial;
  haloA: THREE.Points;
  haloB: THREE.Points;
  planets: InnerPlanet[];
  belt: THREE.Group;
  beltInst: { mesh: THREE.InstancedMesh; tumbles: BeltRock[] }[];
  beltDustMat: THREE.ShaderMaterial;
}

const DAY = 86400000;

function windowFn(d: number, inA: number, inB: number, outA: number, outB: number): number {
  return smoothstep(inA, inB, d) * (1 - smoothstep(outA, outB, d));
}

/* tiny CPU noise for terrain displacement */
function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function cpuFbm(x: number, y: number): number {
  let f = 0, amp = 0.5, fx = x, fy = y;
  for (let i = 0; i < 4; i++) { f += amp * (vnoise(fx, fy) * 2 - 1); fx *= 2.07; fy *= 2.03; amp *= 0.5; }
  return f;
}

/* one tumbling belt rock — fixed place and size, free spin on its own axis */
interface BeltRock {
  pos: THREE.Vector3; scale: THREE.Vector3;
  q: THREE.Quaternion; axis: THREE.Vector3; speed: number;
}

function makeGalaxySprite(warm: boolean): THREE.Texture {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, s, s);
  const half = s / 2;
  const radius = half - 1;
  const core = warm ? 'rgba(255,236,200,0.35)' : 'rgba(214,230,255,0.35)';
  const mid = warm ? 'rgba(240,190,130,0.08)' : 'rgba(150,180,235,0.08)';
  const grad = g.createRadialGradient(half, half, 0, half, half, radius);
  grad.addColorStop(0, core);
  grad.addColorStop(0.3, mid);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(half, half, radius, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

function makeRingGlowTexture(): THREE.Texture {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, s, s);
  g.strokeStyle = 'rgba(240,248,255,0.95)';
  g.lineWidth = s * 0.028;
  g.shadowColor = 'rgba(180,235,225,0.9)';
  g.shadowBlur = s * 0.055;
  g.beginPath();
  g.arc(s / 2, s / 2, s * 0.40, 0, Math.PI * 2);
  g.stroke();
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = s * 0.008;
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

export class UniverseEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private bloomPass!: UnrealBloomPass;
  /* KAMUI (v1) — the red demonic space-time vortex: a full-screen post-process
     driven by triggerKamui() (the shader lives in shaders.ts portalFrag). */
  private portalPass!: ShaderPass;
  private kamuiTimer = 0;
  /* the eased vortex envelope (sin peak ×1.15, relaxed each frame) */
  private kamuiEase = 0;
  /* the direction spacetime drags — a fixed reference now that the v2
     sightline chase is retired (the surface manager still consumes it) */
  private readonly kamuiVortexDir = new THREE.Vector3(0, 1, 0);
  /* THE VACUUM GULP — the tear's final stage: the throat swallows its
     subject (uVac surge + size drain) and the frame rumbles. The swallow
     factor always eases back to exactly 1, so no world stays deformed. */
  private kamuiVacuumActive = false;
  private kamuiSwallowGroup: THREE.Object3D | null = null;
  private kamuiSwallowFactor = 1;
  private kamuiShakeT = 0;
  /* THE THROAT UNWIND (R67) — when the summon's timer expires, uVac no
     longer snaps 1 → 0 in one frame (a hard stutter at the exact instant
     the contents eject). It holds at 1 through the decay window and then
     unwinds with the vortex's own fade, so the swallow relaxes instead of
     cutting. A negative value means "expired, unwinding" and tracks the
     remaining ease — the same clock the glow decays on. */
  private kamuiVacuumTail = -1;
  /* THE SPIN DRIVER — the running maximum of the beat envelopes. It only
     ever grows during a summon, so the swirl never relaxes backward at a
     beat seam (the user's forward-backward-forward jank). */
  private kamuiTwist = 0;
  private cb: EngineCallbacks;
  private bodies: RuntimeBody[] = [];
  private colliderList: THREE.Mesh[] = [];
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(-2, -2);
  private pointerMoved = false;
  private hoveredId: string | null = null;
  private selectedId: string | null = null;
  private focusId: string | null = null;
  private simDays = 0;
  private timeScale = 1;
  private paused = false;
  private rendering = true;
  private coreActive = false; private coreT = 0;
  private epoch = Date.now() - 400 * DAY;
  private portal = {
    phase: 'idle' as 'idle' | 'entering' | 'open' | 'leaving',
    t: 0, fired: false, kind: 'diary' as 'diary' | 'vault', bodyId: '',
  };
  /* Inner-galaxy worlds are synthetic runtime bodies, so their portal target
     must be resolved from the isolated system rather than the home body list. */
  private portalTargetInnerId: string | null = null;
  private reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  private portalWasInner = false;
  /* The dial value the entry zoom lands at / eases back to. */
  private portalEnterDial = 0;
  private portalReturnDial = 0;
  /* CAMERA STABILITY — the summon hold. Clicking a world fires the vortex and
     the frame then stays ROCK STILL while it breathes; only after
     KAMUI_ENTRY_HOLD does the camera take the body and glide in. Without it
     the dive and the tear raced each other (the camera had already slammed
     into the body by the time the vortex crested) and the instant focus
     yanked the whole sky sideways. */
  private portalHold = 0;
  private portalFocusPending = false;
  private portalPendingFocusId: string | null = null;

  /* KAMUI (v1) — the vortex does not own navigation; the plain-zoom portal
     and the stage thresholds keep doing the travel. The jutsu is pure
     theater: the red space-time tear that accompanies the summon. */
  private kamuiTearBodyId: string | null = null;

  /* the web's edge membrane — pushing at the wall makes it shimmer */
  private membraneShimmer = 0;

  /* -------------- Round 14 — gravitational lensing + living gravity -------------- */
  /* The masses bend ONLY the universe surface (celestial dome + background
     star shells) — the observable signature of Einstein's curvature. The
     bodies themselves never bend (the first post-pass attempt was removed
     after owner review: it warped the planets' own edges). */
  private lensCur = 1;                /* damped toggle — lensing is born ON */
  private lensTarget = 1;
  private lensVecs: THREE.Vector4[] = Array.from({ length: 16 }, () => new THREE.Vector4());
  private lensRims: number[] = new Array(16).fill(0);
  /* Round 16 — 1.0 = black hole (exact Schwarzschild optics + capture shadow) */
  private lensStrong: number[] = new Array(16).fill(0);
  /* ROUND 66 — THE LIVING LENS: per-hole world velocity for the sky's
     drag-and-swirl (the water-around-the-cone law). Velocities are MEASURED
     from the real per-frame displacement and smoothed (orbital motion is
     steady) — no hardcoded speed anywhere. w carries the disk's spin sign. */
  private lensVels: THREE.Vector4[] = Array.from({ length: 16 }, () => new THREE.Vector4());
  private lensVelPrev = new Map<string, { p: THREE.Vector3; v: THREE.Vector3 }>();
  private _lensVelInst = new THREE.Vector3();
  private _lensDir = new THREE.Vector3();
  private _lensFwd = new THREE.Vector3();
  private _lensPos = new THREE.Vector3();  /* ROUND 61 — world pos of inner-system holes */
  /* Living Gravity: first-order N-body coupling in osculating elements (nbody.ts). */
  private livingField = new LivingGravityField();
  private livingGravityOn = true;     /* real mutual gravity — ON by default */
  private lastSimDelta = 0;           /* sim-days advanced last frame (element-rate dt) */
  /* The traveler's exact camera + framing at the moment a portal opened.
     leavePortal() cuts straight back to this — closing a diary or the vault
     must never slam the camera to the anchor or sweep it sideways. */
  private portalSavedCam: {
    rig: ReturnType<CameraRig['snapshot']>;
    focusId: string | null;
    galaxyFocusId: string | null;
    galaxyInnerFocus: boolean;
    innerFocusBodyId: string | null;
    realityFocused: boolean;
  } | null = null;
  /* fired once after the first rendered frame (drives the App's intro veil) */
  private firstFrameFired = false;
  /* the constructor precompiles the whole scene; the first setReality call
     runs against that same fresh scene and must not compile everything again */
  private skipNextCompile = true;
  private _vScratch4 = new THREE.Vector3();
  private dragging = false; private lastPX = 0; private lastPY = 0; private downX = 0; private downY = 0; private downT = 0;
  private lastClickT = 0; private lastClickId: string | null = null; private clickTimer: ReturnType<typeof setTimeout> | null = null;
  private starUniforms: Record<string, THREE.IUniform> = {};
  private connectionLines!: THREE.LineSegments;
  private connectionMat!: THREE.LineBasicMaterial;
  private surfaceManager!: UniverseSurfaceManager;
  private gNeighborhood = new THREE.Group();
  private gGalaxy = new THREE.Group();
  private gCluster = new THREE.Group();
  private gSupercluster = new THREE.Group();
  private gWeb = new THREE.Group();
  private gMultiverse = new THREE.Group();
  private meteors: ShootingMeteor[] = [];
  private multiverseColliders: THREE.Mesh[] = [];
  /* major galaxies orbiting each reality bubble — ONE ellipse per galaxy */
  private galaxyNodes: RuntimeGalaxyNode[] = [];
  private multiverseMats: THREE.ShaderMaterial[] = [];
  /* distant exoplanet horizon plates in the deep web (high/cinematic tiers) */
  private exoPlates: THREE.Mesh[] = [];
  private clouds: { mat: THREE.ShaderMaterial; px: number }[] = [];
  private levelSprites: { mat: THREE.SpriteMaterial; base: number; level: 'neighborhood' | 'cluster' | 'supercluster' | 'beacon' | 'web' | 'multiverse' }[] = [];
  /* every Points material inside the six level groups — uScale is
     distance-compensated each frame (see updateLevels) so the galaxy spiral,
     cluster fields and cosmic web keep their designed screen size at their
     own scales instead of collapsing to the 1.5px shader floor. */
  private levelPointMats: THREE.ShaderMaterial[] = [];
  /* C++ Kepler accelerator — the native core (desktop binary or WASM) batches
     the per-frame orbit positions; the tick loop reads this cache and falls
     back to the inline TS solver whenever the cache is stale or absent. */
  private keplerCache: {
    simDays: number;
    xyz: Float64Array;
    valid: boolean;
    inflight: boolean;
  } = { simDays: NaN, xyz: new Float64Array(0), valid: false, inflight: false };
  private keplerFrame = 0;
  private keplerEcc = new Map<string, number>();
  /* every black hole in the universe — one object each, so a disarm can
     hide them all at once (Round 55: there is no fallback renderer) */
  private blackHoles: BlackHoleVisual[] = [];
  private raymarchDisabled = false;
  private onQualityChange: () => void = () => {};
  private onTierOverride: () => void = () => {};

  /* Round 54/55 — ONE attach path. Every hole gets the geodesic renderer when
     the GPU allows it; when it cannot, the hole hides itself — nothing painted
     ever stands in. The 'on' override forces past the tier gate (a saved 'low'
     quality setting must not silently win over the user's explicit switch) but
     never past a software rasterizer, and never past a shader-failure disarm.
     ROUND 59 — no background captures of any kind: the sky layers bend
     themselves (the surface manager's 1/θ lens), so there is no second image
     of the sky anywhere in the pipeline — no square, no layers. */
  private attachBlackHole(R: number, container: THREE.Object3D): BlackHoleVisual {
    const override = getRaymarchOverride();
    const capable = !this.raymarchDisabled
      && (canUseRaymarchBlackHole() || (override === 'on' && !isSoftwareRasterizer()));
    const geodesic = override !== 'off' && capable;
    const visual = createBlackHole(R, { geodesic });
    container.add(visual.group);
    this.blackHoles.push(visual);
    if (geodesic) setRaymarchStatus(override === 'on' ? 'forced' : 'active', 'attached');
    else setRaymarchStatus('off', override === 'off' ? 'override-off' : 'tier-low');
    return visual;
  }

  /* One switch for every hole: the geodesic marcher renders it, or the hole
     hides itself (frame-budget breaker, shader failure, quality tier,
     Studio switch). Round 55 — nothing stands in for it anymore. */
  private setAllGeodesic(on: boolean): void {
    for (const visual of this.blackHoles) visual.setGeodesic(on);
  }

  /* Round 20 — frame-budget guard for the geodesic tier. On by default now,
     so instead of a quality toggle the safety net is automatic. ROUND 53 —
     the breaker is RECOVERABLE: exceeding the budget stands the tier down
     for the current visit (the hole hides itself), and flying away from
     the hole re-arms it for the next approach — up to three stand-downs per
     session, then permanent, exactly like the old one-way breaker. The old
     design blamed one slow stretch forever: on the reference iGPU a single
     heavy minute at close focus cost the lensed look for the rest of the
     session, with no signal and no way back. The 'on' override in
     blackholeTier skips the breaker entirely. */
  private _rmGuardFrames = 0;
  private _rmGuardAccum = 0;
  private raymarchStoodDown = false;
  private raymarchFlaps = 0;
  private _rmAwayFrames = 0;

  /* ROUND 61 — the camera checkpoint. The user's view (the found composition
     with the hole as a tilted disk and the belt sweeping around it) survives
     close/reopen: while the traveler sits idle in the web stage — no Kamui,
     no portal, no galaxy dive, no boot — the rig's current placement is
     captured every ~5 s (an idle view cannot drift more than one interval).
     Traversals clear the timer so a flight is never saved. The resetView()
     path clears the memory entirely: the default stays reachable on demand. */
  private _camMemTimer = 0;
  private _camMemStable = 0;
  private _camMemLast: Omit<CameraMemory, 'savedAt'> | null = null;

  /** Worth remembering? A view is checkpointed only when the traveler is
      resting in the web stage — never mid-traversal, never mid-boot, never
      while a portal owns the camera. */
  private checkpointCameraView(dt: number): void {
    const quiescent = !this.bootIntro && this.kamuiTimer <= 0 && this.portal.phase === 'idle'
      && this.galaxyDive === null && this.cosmicStage === 'web';
    if (!quiescent) {
      this._camMemTimer = 0;
      this._camMemStable = 0;
      return;
    }
    this._camMemTimer += dt;
    if (this._camMemTimer < 5) return;
    this._camMemTimer = 0;
    const snap = this.rig.snapshot();
    /* ROUND 62 — the memory carries the FULL placement (current + target
       channels) and WHAT the view orbits: a target-only record eases in
       from the rig's constructor default (a huge distance) and the focus
       auto-release (dist > 1200) drops the subject before the camera
       arrives — the "the hole is nowhere" bug. */
    const next: Omit<CameraMemory, 'savedAt'> = {
      zoomT: snap.zoomT, tZoomT: snap.tZoomT,
      theta: snap.theta, tTheta: snap.tTheta,
      phi: snap.phi, tPhi: snap.tPhi,
      pan: snap.pan,
      focusId: this.focusId,
    };
    const last = this._camMemLast;
    if (last && Math.abs(last.zoomT - next.zoomT) < 1e-5 && Math.abs(last.theta - next.theta) < 1e-5 && Math.abs(last.phi - next.phi) < 1e-5) {
      return; /* unchanged since the last write — skip the localStorage churn */
    }
    this._camMemLast = next;
    setCameraMemory(next);
  }

  /* ROUND 61 — the same checkpoint on window dismissal: closing the app can
     beat the 5 s idle cadence, and the last drag often ends < 5 s before the
     close. The idle requirement is applied by giving the checkpoint its
     full sampling interval as a pseudo-dt (a mid-flight camera fails the
     quiescence guard above and writes nothing). */
  private onPageHide = () => {
    if (this.disposed) return;
    this.checkpointCameraView(5);
  }
  /* ROUND 56b — adaptive resolution: while a hole is on stage the composer
     may drop its pixel ratio and restore when you fly away. Applied in 0.1
     steps — every apply reallocates the render targets, so we never churn
     per frame.
     ROUND 64 — THE TIGHTENING: at base ratio ≤ 1 (every standard display)
     there is NO drop at all — the blocky 0.5×/0.8× disk was the leak that
     helped force the old renderer's deletion, and the source itself renders
     full res. Only HiDPI (base > 1) eases, and never below 0.7 of base. The
     55 ms frame-budget breaker (180-frame window) remains the safety net. */
  private pixelRatioBase = 1;
  private pixelRatioApplied = -1;
  private holePixelRatioDamp = 1;

  private applyAdaptiveResolution(holeOnStage: boolean, dt: number): void {
    const target = holeOnStage && this.pixelRatioBase > 1
      ? Math.max(this.pixelRatioBase * 0.7, 1)
      : this.pixelRatioBase;
    this.holePixelRatioDamp += (target - this.holePixelRatioDamp) * Math.min(1, dt * 4);
    if (Math.abs(this.holePixelRatioDamp - this.pixelRatioApplied) >= 0.1) {
      this.pixelRatioApplied = this.holePixelRatioDamp;
      const r = Math.max(0.5, Math.round(this.pixelRatioApplied * 10) / 10);
      this.renderer.setPixelRatio(r);
      this.composer.setPixelRatio(r);
    }
  }
  /* ROUND 63 — the reference's blaze, whole: his demo runs bloom strength
     0.68 / radius 0.2 / threshold 0.4 (main.js config verbatim). While a
     geodesic hole is on stage the composer eases to exactly those values —
     strength via this boost (0.18 + 0.50), threshold and radius below in the
     tick — and relaxes to the project baseline when you fly away. */
  private bloomHoleBoost = 0;

  /** True when a geodesic hole is near enough for its march to plausibly
   *  drive frame cost (within ~120 rs — beyond that the quad is tiny).
   *  ignoreVisibility: while stood down the marcher is swapped out but the
   *  camera may still be sitting at the hole — the re-arm watcher needs to
   *  see that position regardless. */
  private raymarchOnStage(ignoreVisibility = false): boolean {
    for (const b of this.bodies) {
      if (b.data.kind !== 'hole' && b.data.kind !== 'vault') continue;
      const rm = b.group.userData.bh as BlackHoleVisual | undefined;
      if (!rm || (!ignoreVisibility && !rm.geodesic)) continue;
      /* world position — body groups ride inside orbit pivots, so .position
         alone is local (and reads as origin) */
      b.group.getWorldPosition(this._vScratch1);
      this._vScratch1.sub(this.camera.position);
      if (this._vScratch1.length() < b.data.radius * 0.62 * 120) return true;
    }
    return false;
  }

  /* ROUND 65 — THE BLAZE LEARNS DISTANCE: the on-stage bloom boost was a
     boolean (the full 0.68 the moment any hole was within 120 rs), so wide
     views of the system drowned in the hole's blaze — too much light for
     the user's eyes. The glow now scales continuously with the encounter:
     full reference glory inside ~40 rs of the nearest hole, easing to the
     project's calm baseline by 120 rs. The hole stays a quiet side
     character in the sky until you actually walk up to it — then it
     blazes. */
  private holeGlowProximity(): number {
    let proximity = 0;
    for (const b of this.bodies) {
      if (b.data.kind !== 'hole' && b.data.kind !== 'vault') continue;
      const rm = b.group.userData.bh as BlackHoleVisual | undefined;
      if (!rm || !rm.geodesic) continue;
      /* world position — body groups ride inside orbit pivots, so .position
         alone is local (and reads as origin) */
      b.group.getWorldPosition(this._vScratch1);
      this._vScratch1.sub(this.camera.position);
      const rs = this._vScratch1.length() / (b.data.radius * 0.62);
      proximity = Math.max(proximity, 1 - Math.min(1, Math.max(0, (rs - 40) / 80)));
      if (proximity >= 1) break;
    }
    return proximity;
  }

  private guardRaymarch(dt: number): void {
    if (this.raymarchDisabled || this.blackHoles.length === 0) return;
    const override = getRaymarchOverride();
    if (override === 'off') return;
    if (override === 'on') return; /* forced: the breaker never stands it down */
    /* Round 20.1 — portal dives (vault entry, reality work) have their own
       heavy frame moments; they must never be blamed on the geodesic tier
       and stand it down permanently */
    if (this.portal.phase !== 'idle') { this._rmGuardFrames = 0; this._rmGuardAccum = 0; return; }

    /* ROUND 61 — the boot grace. The breaker's 3 s sampling window used to
       include the app's very first seconds, when shader compilation and
       desktop start-up stall frames for reasons that have nothing to do
       with the hole — a cold boot could silently stand the geodesic tier
       down before the user ever saw it (with Round 55's fallbacks deleted,
       a stood-down hole renders NOTHING: the "the black hole vanished
       overnight" report). The meter now starts on the first frame after
       the boot finalize, and portal-style reset happens during the intro. */
    if (this.bootIntro) { this._rmGuardFrames = 0; this._rmGuardAccum = 0; return; }

    if (!this.raymarchStoodDown) {
      if (!this.raymarchOnStage()) { this._rmGuardFrames = 0; this._rmGuardAccum = 0; return; }
      this._rmGuardAccum += dt;
      this._rmGuardFrames++;
      if (this._rmGuardFrames < 180) return;
      const avg = this._rmGuardAccum / this._rmGuardFrames;
      this._rmGuardFrames = 0;
      this._rmGuardAccum = 0;
      if (avg > 0.055) {
        this.raymarchFlaps++;
        if (this.raymarchFlaps >= 3) {
          console.warn('[universe] geodesic black hole exceeded the frame budget three times — the hole hides itself for this session');
          this.raymarchDisabled = true;
          this.setAllGeodesic(false);
          setRaymarchStatus('fallback', 'frame-budget-3-strikes');
        } else {
          console.warn(`[universe] geodesic black hole exceeded the frame budget — standing down for this visit (fly away and return to retry; ${3 - this.raymarchFlaps} retries left)`);
          this.raymarchStoodDown = true;
          this.setAllGeodesic(false);
          setRaymarchStatus('fallback', 'frame-budget');
        }
      }
      return;
    }

    /* stood down: wait until the camera is well clear of the hole (~5 s),
       then give the tier a fresh chance on the next approach */
    if (!this.raymarchOnStage(true)) {
      this._rmAwayFrames++;
      if (this._rmAwayFrames > 300) {
        this._rmAwayFrames = 0;
        this.raymarchStoodDown = false;
        this.setAllGeodesic(true);
        setRaymarchStatus(getRaymarchOverride() === 'on' ? 'forced' : 'active', 're-armed');
      }
    } else {
      this._rmAwayFrames = 0;
    }
  }
  /* Pocket Cosmos Marbles — every reality bubble is a glass universe */
  private realityMarbles: { spiral: THREE.Points; glassMat: THREE.ShaderMaterial; speed: number }[] = [];
  private marbleRingTex: THREE.CanvasTexture | null = null;
  /* Stage system — the Cosmic Web and the Multiverse are two SEPARATE places.
     They are never visible at the same time; the zoom dial carries you
     between them and the stage swaps when you cross its edge. */
  private cosmicStage: 'web' | 'multiverse' = 'web';
  /* dial the camera eases to when arriving at your own reality marble */
  private arrivalZoom = REALITY_FLOOR;
  /* the quiet boot — the scene sits fully formed behind the App's intro veil;
     this finalize runs once on the first frame */
  private bootIntro = true;
  /* THE BIRTH — birthK drives the ejection: everything erupts outward from
     the single center point in a swirling bend (applied in updateBodies) */
  private birthK = 0;
  /* THE MARBLE — one glowing glass sphere with a universe coiled inside */
  private introMarble!: THREE.Group;
  private introMarbleMats: THREE.ShaderMaterial[] = [];
  private introMarbleSprites: THREE.SpriteMaterial[] = [];
  private realityFocused = false;
  private webLineMat!: THREE.ShaderMaterial;
  /* plain zoom dive into a clicked galaxy — the dial eases on its own; this
     watcher only flips into the isolated inner system once the camera is
     actually inside the disc */
  private galaxyDive: { galaxyId: string; endInner: boolean } | null = null;
  private beacon!: THREE.Sprite;
  private surface = new THREE.Group();
  private surfaceLocked = false;
  private surfaceQuat = new THREE.Quaternion();
  private surfaceMat!: THREE.ShaderMaterial;
  private skyMat!: THREE.ShaderMaterial;
  private surfaceParticlesMat!: THREE.ShaderMaterial;
  private surfaceBlend = 0;
  private activeRealityId = 'sol-prime';
  /* a galaxy dive requested before the target reality's roster landed —
     executed by setReality once the stage is built */
  private pendingGalaxyEntry: { realityId: string; galaxyId: string } | null = null;
  private activeReality: RealityConfig | null = null;
  private realityGroups: Record<string, THREE.Group> = {};
  private activeRealityShieldMesh: THREE.Group | null = null;
  /* the galaxy the traveler last dove into — pinned to the GALAXY scale label */
  private activeGalaxyName: string | null = null;
  /* THE GALAXY STAGE — rebuilt from the active reality's real roster: one
     full spiral per major galaxy (the home galaxy centered & brightest) */
  private gGalaxyContents = new THREE.Group();
  private galaxyStageNodes: { data: GalaxyData; group: THREE.Group; collider: THREE.Mesh; radius: number; glowMat: THREE.SpriteMaterial; discMat: THREE.ShaderMaterial; inner: THREE.Group; innerSys: InnerSystem | null }[] = [];
  private galaxyStageColliders: THREE.Mesh[] = [];
  private galaxyStagePointMats: { points: THREE.Points; mat: THREE.ShaderMaterial }[] = [];
  /* hover/click colliders for worlds inside the isolated inner systems —
     `inner:<bodyId>` namespaces them away from the home reality's bodies */
  private innerColliderList: THREE.Mesh[] = [];
  /* the inner world the camera is currently orbiting (clicked), if any */
  private innerFocusBodyId: string | null = null;

  private galaxyFocusId: string | null = null;
  /* true while the camera is INSIDE a galaxy's own isolated stellar system */
  private galaxyInnerFocus = false;
  /* THE CLUSTER STAGE — hot intracluster gas glow (tinted per reality) */
  private clusterGasMats: THREE.SpriteMaterial[] = [];
  /* THE ASTRAL CORE — the interactive multiverse core at (0,0,0); clicking it
     opens the Multiverse Core Console (the reality management plate) */
  private astralCoreGroup: THREE.Group | null = null;
  private astralCoreMats: THREE.ShaderMaterial[] = [];
  private astralCoreRings: THREE.Mesh[] = [];
  private astralCoreHalo: THREE.Points[] = [];
  private coreHoverT = 0;
  private giantMultiverseBoundaryMat!: THREE.ShaderMaterial;
  private giantMultiverseSphereGroup!: THREE.Group;
  private demonCoreGroup!: THREE.Group;
  private demonCoreMat!: THREE.ShaderMaterial;
  private demonCoreRings: THREE.Mesh[] = [];
  private demonCoreSpires: THREE.Mesh[] = [];
  private demonCoreInnerGeom!: THREE.Mesh;
  private demonCorePulseRings: THREE.Mesh[] = [];
  private demonCoreJets: THREE.Mesh[] = [];
  private demonCoreTesseract: THREE.Group | null = null;
  private demonCoreTachyonNodes: THREE.Mesh[] = [];
  private coreStabilizerBeams!: THREE.LineSegments;
  private coreStabilizerBeamMat!: THREE.LineBasicMaterial;
  private corePulseOrbs: THREE.Mesh[] = [];
  private demonCoreLight!: THREE.PointLight;
  private demonCoreCollider!: THREE.Mesh;

  private lastLabel = '';
  private lastDateSent = 0;
  private clockT = 0;
  private disposed = false;
  private canvas: HTMLCanvasElement;
  private originalTouchAction = '';

  /* THE SKY STUDIO — the active reality's photo sky (from its own assets
     folder). Desktop fetches the registry itself so a device that never ran
     the web server still gets its skies. */
  private activeSkySpec: ActiveSkySpec | null = null;
  private skyApplying = false;

  /* THE SENTIMENT AURORA — live emotional state of the active reality,
     damped toward the latest signal so mood shifts read as weather, not cuts */
  private auroraTarget: AuroraSignal | null = null;
  private auroraCur = { maskA: 0, maskB: 0, intensity: 0, storm: 0, echo: 0 };
  private auroraColA = new THREE.Color('#f2c178');
  private auroraColB = new THREE.Color('#7fc4e8');

  /* THE COSMIC ECHO — one shower of on-this-day meteors per day, each
     meteor a memory you can click to reopen */
  private echoMeteors: (ShootingMeteor & { entryId: string; planetId: string; title: string })[] = [];
  private echoArmedDay = '';
  private echoShowerClock = 0;
  private echoHoverId: string | null = null;
  private echoGroup: THREE.Group | null = null;
  private echoColliders: THREE.Sprite[] = [];
  private lastEchoHover = false;
  /* constellation pulse registry — atmosphere strength envelopes */
  private pulses: { mat: THREE.ShaderMaterial; base: number; until: number }[] = [];

  private onContextLost = (event: Event) => {
    event.preventDefault();
  };

  private onContextRestored = () => {
    /* AUDIT 2026-09-28 — the test was INVERTED: `if (!this.disposed)` compiled
       the scene only while the engine was ALIVE, which is exactly when the
       browser re-delivers a restored GL context — and did nothing after
       dispose, which is the only time it could ever be harmful. A real
       restore also invalidates the EffectComposer's render targets (they
       belonged to the lost context), so they must be re-created too, or the
       first frame after a GPU driver reset renders into dead buffers — the
       "universe went permanently black after a driver hiccup" class of bug. */
    if (this.disposed) return;
    this.composer.dispose();
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(this.pixelRatioApplied);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.buildComposerPasses();
    this.renderer.compile(this.scene, this.camera);
  };

  /** The composer pass chain, in its one canonical order — shared by the
      constructor and the context-restored rebuild (they must never drift). */
  private buildComposerPasses(): void {
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.12, 0.15, 0.90);
    this.composer.addPass(this.bloomPass);
    this.portalPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null }, uCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uStrength: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 },
        uColor: { value: new THREE.Color('#f2c178') }, uDir: { value: 1 },
        uVac: { value: 0 }, uWind: { value: 0 }, uPulse: { value: 0 }, uTwist: { value: 0 },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: portalFrag,
    });
    this.composer.addPass(this.portalPass);
    this.composer.addPass(new OutputPass());
  }

  /* Reusable scratchpad instances for zero-GC render frame updates */
  private _vScratch1 = new THREE.Vector3();
  private _vScratch2 = new THREE.Vector3();
  private _vScratch3 = new THREE.Vector3();
  private _vDirScratch = new THREE.Vector3();
  private _vFocusScratch = new THREE.Vector3();
  private _qScratch = new THREE.Quaternion();
  private _qScratch2 = new THREE.Quaternion();
  private _corePosBuffer = new Float32Array(1000 * 3);

  constructor(canvas: HTMLCanvasElement, bodies: CosmicBody[], cb: EngineCallbacks) {
    this.cb = cb;
    this.canvas = canvas;
    this.originalTouchAction = canvas.style.touchAction;
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const lowPowerDevice = navigator.hardwareConcurrency <= 4 || (deviceMemory !== undefined && deviceMemory <= 4);
    /* capability probe: cinematic tier (desktop-class GPUs) unlocks pixelRatio
       up to 2 and the raymarched hole; user override can force any tier */
    const cap = probeCapability();
    const maxPixelRatio = lowPowerDevice || cap.tier === 'low' ? 1 : pixelRatioFor(cap.tier, 99);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPowerDevice, powerPreference: lowPowerDevice ? 'default' : 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    this.pixelRatioBase = this.renderer.getPixelRatio();
    this.pixelRatioApplied = this.pixelRatioBase;
    this.holePixelRatioDamp = this.pixelRatioBase;
    /* tier changes (settings UI) re-apply the pixel ratio live */
    this.onQualityChange = () => {
      const next = pixelRatioFor(getQualityTier(), 99);
      this.pixelRatioBase = Math.min(window.devicePixelRatio, next);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, next));
      this.composer?.setPixelRatio(Math.min(window.devicePixelRatio, next));
      /* Round 53 — stand the geodesic tier down only when the NEW tier
         genuinely cannot run it (low / software GL). The old
         `!== 'cinematic'` test was a Version-3 leftover: at medium — the
         DEFAULT tier — merely touching the quality dial tore the lensed
         renderer down for the session, contradicting the documented
         on-at-medium+ policy. A round-trip back to a capable tier re-arms
         it (unless the shader failed or the breaker holds it down). */
      if (!canUseRaymarchBlackHole()) {
        this.setAllGeodesic(false);
        setRaymarchStatus('off', 'tier-low');
      } else if (!this.raymarchDisabled && !this.raymarchStoodDown && this.blackHoles.length > 0) {
        this.setAllGeodesic(true);
        setRaymarchStatus(getRaymarchOverride() === 'on' ? 'forced' : 'active', 'quality-restore');
      }
      if (getQualityTier() === 'cinematic' && this.exoPlates.length === 0) this.buildExoplanetPlates();
    };
    window.addEventListener(QUALITY_CHANGE_EVENT, this.onQualityChange);
    /* Round 53 — the Studio card's tier switch lands here (blackholeTier) */
    this.onTierOverride = () => {
      const v = getRaymarchOverride();
      if (v === 'off') {
        this.setAllGeodesic(false);
        setRaymarchStatus('off', 'override-off');
      } else if (v === 'on') {
        if (this.raymarchDisabled) { setRaymarchStatus('fallback', 'shader-error'); return; }
        this.raymarchStoodDown = false;
        this.setAllGeodesic(true);
        setRaymarchStatus('forced', 'override-on');
      } else if (!this.raymarchDisabled && !this.raymarchStoodDown) {
        this.setAllGeodesic(true);
        setRaymarchStatus('active', 'auto');
      } else {
        setRaymarchStatus('fallback', this.raymarchDisabled ? 'shader-error' : 'frame-budget');
      }
    };
    window.addEventListener(RAYMARCH_OVERRIDE_EVENT, this.onTierOverride);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setClearColor('#04060c', 1);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 8000000);
    this.rig = new CameraRig(this.camera, canvas);
    /* R68 — the cursor-anchored dive: the rig asks, the engine answers with
       the world point under the wheel (see resolveAimPoint). */
    this.rig.setAimProbe(this.resolveAimPoint);
    /* ROUND 61 — the last resting view is checkpointed when the app closes
       (web/app window dismissal can beat the 5 s idle cadence). Same guard
       as the frame path: only a resting view is worth remembering, and the
       5 s pseudo-dt stands in for the frame-path idle requirement. */
    window.addEventListener('pagehide', this.onPageHide);
    this.scene.add(new THREE.AmbientLight(0x1e293b, 0.3));
    const sun = new THREE.PointLight(0xfff0d6, 0.95, 0, 0);
    this.scene.add(sun);

    this.surfaceManager = new UniverseSurfaceManager(this.scene, this.activeReality);
    this.gNeighborhood = this.surfaceManager.getNeighborhoodGroup();
    this.buildBackdrop();
    this.buildAnchor();
    bodies.forEach((b) => this.buildBody(b));
    this.buildBelt();
    this.buildLevels();
    this.buildMultiverse();
    this.buildMeteors();
    this.buildSurface();
    this.buildIntroMarble();
    this.scene.add(this.camera); /* camera lives in the scene graph */


    /* collect level point-cloud materials for per-frame size compensation */
    [this.gNeighborhood, this.gGalaxy, this.gCluster, this.gSupercluster, this.gWeb, this.gMultiverse].forEach((g) => {
      const defaultMode = g === this.gMultiverse ? 'multiverse' : 'standard';
      g.traverse((obj) => {
        if (obj instanceof THREE.Points) {
          const m = obj.material as THREE.ShaderMaterial;
          if (m.uniforms && m.uniforms.uScale && !this.levelPointMats.includes(m)) {
            m.userData.pointMode = (m.userData.pointMode as string | undefined) ?? defaultMode;
            this.levelPointMats.push(m);
          }
        }
      });
    });

    this.connectionMat = new THREE.LineBasicMaterial({ color: 0xf2c178, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const initGeom = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(this._corePosBuffer, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    initGeom.setAttribute('position', posAttr);
    this.connectionLines = new THREE.LineSegments(initGeom, this.connectionMat);
    this.connectionLines.frustumCulled = false;
    this.scene.add(this.connectionLines);

    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    /* THE KAMUI pass (v1) — the red demonic vortex (shaders.ts portalFrag).
       At uStrength 0 it is a single texture fetch; triggerKamui() pulses it.
       Pass order lives in buildComposerPasses so the context-restored
       rebuild can never drift from the boot chain. */
    this.buildComposerPasses();

    this.bindEvents();
    this.resize();
    window.addEventListener('resize', this.resize);

    /* surface GPU shader-compile failures loudly — the Vault black hole's
       fallback halo listens for this and reveals itself only on real failure */
    this.renderer.debug.onShaderError = (gl, program, vs, fs) => {
      const vsLog = vs ? (gl.getShaderInfoLog(vs) || '') : '';
      const fsLog = fs ? (gl.getShaderInfoLog(fs) || '') : '';
      const progLog = program ? (gl.getProgramInfoLog(program) || '') : '';
      const vsSource = vs ? (gl.getShaderSource(vs) ?? '') : '';
      const fsSource = fs ? (gl.getShaderSource(fs) ?? '') : '';
      const log = (vsLog ? `[Vertex Error]: ${vsLog}\n` : '') +
                  (fsLog ? `[Fragment Error]: ${fsLog}\n` : '') +
                  (progLog ? `[Program Link Error]: ${progLog}` : '');
      const source = (vsLog ? `--- VERTEX SHADER ---\n${vsSource}\n` : '') +
                     (fsLog ? `--- FRAGMENT SHADER ---\n${fsSource}` : '');
      console.error('[universe] shader compile failure:', log || 'unknown shader error', '\nSource:\n', source.slice(0, 4000));
      window.dispatchEvent(new CustomEvent('eventide-shader-error', { detail: { source: source.slice(0, 4000), log: log || 'unknown shader error' } }));
      /* any shader failure permanently disarms the geodesic tier this
         session — the hole hides itself (Round 55: no stand-in exists) */
      this.raymarchDisabled = true;
      this.raymarchStoodDown = false;
      this.setAllGeodesic(false);
      setRaymarchStatus('fallback', 'shader-error');
    };

    /* Precompile EVERY shader program now, during the boot fade — without
       this, WebGL compiles lazily on first visibility and each new stage
       (multiverse, tunnel, portal…) froze the frame for seconds mid-action.
       Also survive a GPU context reset instead of staying black forever. */
    this.renderer.compile(this.scene, this.camera);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);
    /* Dev builds keep shader-error checking ON — a failed compile (like a
       missing noise chunk) must never again silently blank a whole material.
       Production keeps it off for frame-time smoothness. */
    this.renderer.debug.checkShaderErrors = import.meta.env.DEV;

    this.renderer.setAnimationLoop(this.tick);
  }

  /* ----------------------------- construction ----------------------------- */

  /** ROUND 62 — `lens` opts a cloud INTO the spacetime bend. Default is
      RIGID: belts, star halos, nebula dust and every other system-local
      cloud belong to a body, and a body's contents are never bent (the
      belt-tear bug). Only cosmic sky clouds pass true — see the opt-ins at
      the makePoints call sites (milky band, galaxy spirals, web, cluster
      fields). */
  private pointsMaterial(px: number, twinkle: boolean, lens = false): THREE.ShaderMaterial {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uScale: { value: 1 }, uTime: { value: 0 }, uTwinkle: { value: twinkle ? 1 : 0 }, uOpacity: { value: 1 },
        uVortexC: { value: new THREE.Vector3() }, uVortexR: { value: 0 }, uVortexS: { value: 0 }, uVortexT: { value: 0 }, uVortexPull: { value: 0 },
        uVortexRev: { value: 1 },
        /* Round 52 — the SAME uniform objects the sky dome and the star shells
           use, so one setLenses() per frame bends the canvas, the shells and
           every lenized star cloud together. Nothing else has to be synced. */
        ...this.surfaceManager.lensUniforms,
      },
      vertexShader: lens ? POINTS_VERT_LENSED : pointsVert, fragmentShader: pointsFrag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.clouds.push({ mat, px });
    return mat;
  }

  /* level point-cloud bookkeeping — materials created AFTER the constructor
     traverse (reality rebuilds, galaxy-stage rebuilds) must re-register or
     their uScale stays 1 and the clouds collapse to the 1.5px shader floor */
  private collectPointsMaterials(root: THREE.Object3D, tag: string, defaultMode = 'standard') {
    root.traverse((obj) => {
      if (obj instanceof THREE.Points) {
        const m = obj.material as THREE.ShaderMaterial;
        if (m.uniforms && m.uniforms.uScale && !this.levelPointMats.includes(m)) {
          m.userData.pointMode = (m.userData.pointMode as string | undefined) ?? defaultMode;
          m.userData.rebuildTag = tag;
          this.levelPointMats.push(m);
        }
      }
    });
  }
  private dropOwnedPointsMaterials(tag: string) {
    this.levelPointMats = this.levelPointMats.filter((m) => m.userData.rebuildTag !== tag);
  }

  private makePoints(count: number, posFn: (i: number, arr: Float32Array) => void, sizeFn: (i: number) => number, colFn: (i: number) => [number, number, number], alphaFn: (i: number) => number, px: number, twinkle: boolean, lens = false): THREE.Points {
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const col = new Float32Array(count * 3);
    const alp = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      posFn(i, pos); size[i] = sizeFn(i);
      const c = colFn(i); col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
      alp[i] = alphaFn(i);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(alp, 1));
    return new THREE.Points(g, this.pointsMaterial(px, twinkle, lens));
  }

  private buildBackdrop() {
    const R = () => Math.random();
    /* milky way band */
    const band = this.makePoints(
      5200,
      (i, a) => {
        const ang = R() * Math.PI * 2, r = 14000 + R() * 42000;
        const off = (R() + R() + R() - 1.5) * 3400;
        a[i * 3] = Math.cos(ang) * r; a[i * 3 + 1] = off * 0.32; a[i * 3 + 2] = Math.sin(ang) * r;
      },
      () => 0.4 + R() * 0.9,
      () => { const w = R(); return w > 0.75 ? [1, 0.82, 0.6] : [0.62, 0.7, 0.88]; },
      () => 0.16 + R() * 0.3,
      1.5, true, true,
    );
    band.rotation.z = 0.42; band.rotation.x = 0.22;
    this.gGalaxy.add(band);

    this.scene.traverse((obj) => {
      obj.frustumCulled = false;
    });
  }

  private buildAnchor() {
    const g = new THREE.Group();
    this.starUniforms = { uTime: { value: 0 }, uBoost: { value: 1 } };
    const mat = new THREE.ShaderMaterial({ uniforms: this.starUniforms, vertexShader: starVert, fragmentShader: starFrag });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(6, 96, 64), mat);
    g.add(mesh);

    /* organic shader corona — rays breathe, no layered sprite rings */
    this.coronaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uBoost: { value: 1 },
        uAuroraA: { value: new THREE.Color('#f2c178') }, uAuroraB: { value: new THREE.Color('#7fc4e8') },
        uAuroraMaskA: { value: 0 }, uAuroraMaskB: { value: 0 },
        uAuroraIntensity: { value: 0 }, uAuroraStorm: { value: 0 },
        uEchoBloom: { value: 0 },
      },
      vertexShader: coronaVert, fragmentShader: coronaFrag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const corona = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), this.coronaMat);
    corona.renderOrder = 5;
    corona.frustumCulled = false;
    g.add(corona);

    /* the extraordinary quality: two counter-rotating rings of captured starlight */
    const ringPts = (radius: number, count: number, color: [number, number, number], tilt: number, size: number) => {
      const R = Math.random;
      const pts = this.makePoints(
        count,
        (i, a) => { const ang = (i / count) * Math.PI * 2 + R() * 0.06; const rr = radius + (R() - 0.5) * 0.7; a[i * 3] = Math.cos(ang) * rr; a[i * 3 + 1] = (R() - 0.5) * 0.35; a[i * 3 + 2] = Math.sin(ang) * rr; },
        () => 0.5 + R() * 0.9, () => color, () => 0.3 + R() * 0.55, size, true,
      );
      const pivot = new THREE.Group();
      pivot.rotation.x = tilt;
      pivot.add(pts);
      g.add(pivot);
      return pts;
    };
    const haloA = ringPts(9.6, 700, [1, 0.82, 0.55], 0.28, 1.6);
    const haloB = ringPts(11.4, 420, [0.55, 0.85, 0.8], -0.32, 1.3);
    g.userData.haloA = haloA; g.userData.haloB = haloB;
    g.userData.starMesh = mesh;
    /* Solar Axial Obliquity Tilt (7.25 degrees relative to ecliptic) */
    g.rotation.z = 0.126;
    this.scene.add(g);

    const collider = new THREE.Mesh(new THREE.SphereGeometry(8.4, 12, 12), new THREE.MeshBasicMaterial({ visible: false }));
    collider.userData.bodyId = 'anchor';
    g.add(collider);
    this.colliderList.push(collider);
    (g as THREE.Group & { userData: Record<string, unknown> }).userData.anchorGroup = true;
    g.visible = false; /* the cold-open ignites it */
    this.anchorGroup = g;
  }
  private anchorGroup!: THREE.Group;
  private coronaMat!: THREE.ShaderMaterial;
  private rig!: CameraRig;
  private grabCooldown = 0;

  private buildBody(data: CosmicBody) {
    if (data.id === 'anchor') return;
    const g = new THREE.Group();
    const rb: RuntimeBody = {
      data, group: g, collider: null as unknown as THREE.Mesh, moons: [],
      ghost: 0, ghostTarget: 0, fade: 1, fadeTarget: 1, hoverT: 0, baseScale: 1,
    };
    const p = data.palette;
    const col = (h: string) => new THREE.Color(h);

    if (data.kind === 'planet' || data.kind === 'dwarf') {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uDeep: { value: col(p.deep) }, uBase: { value: col(p.base) }, uHigh: { value: col(p.high) },
          uIce: { value: col(p.ice) }, uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uTime: { value: 0 },
          uSea: { value: data.id === 'aurelia' ? 0.02 : -0.55 }, uGhost: { value: 0 }, uFade: { value: 1 },
          uNight: { value: data.nightside ? 1 : 0 },
          uSeed: { value: new THREE.Vector3(hash(data.id.length, 3) * 40, hash(7, data.id.length) * 40, hash(data.id.length, 11) * 40) },
        },
        vertexShader: planetVert, fragmentShader: planetFrag, transparent: true,
      });
      /* tilted spin axis — REAL OBLIQUITY from the physics engine: BODY_PROFILES
         carries each world's measured axial tilt (Venus 177.4°, Uranus 97.8°,
         Pluto 122.5°…); generated worlds fall back to a seeded spread.
         Order YXZ so the obliquity leans away from the spin pole. */
      const physData = calculatePhysics(data);
      const tilt = new THREE.Group();
      tilt.rotation.order = 'YXZ';
      tilt.rotation.y = hash(data.id.length, 4) * Math.PI * 2;
      tilt.rotation.z = (physData.axialTiltDeg * Math.PI) / 180;
      g.add(tilt);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(data.radius, 64, 48), mat);
      tilt.add(mesh);
      rb.mat = mat;

      /* each world keeps its own day length — DIRECTION IS PHYSICS, NOT RANDOM:
         obliquity past 90° means the world was knocked over and spins
         retrograde (Venus, Uranus, Pluto); below 90° keeps the prograde
         sense the birth cloud spun up. */
      const retrograde = physData.axialTiltDeg > 90 ? -1 : 1;
      rb.spinMesh = mesh;
      rb.spinRate = retrograde * (Math.PI * 2) / (24 + hash(data.id.length, 5) * 52);

      if (data.clouds) {
        const cm = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3(1, 0, 0) },
            uSeed: { value: new THREE.Vector3(3.7, 8.1, 1.9) }, uCover: { value: data.id === 'veil' ? 0.95 : 0.5 },
            uFade: { value: 1 },
          },
          vertexShader: planetVert, fragmentShader: cloudFrag, transparent: true, depthWrite: false,
        });
        const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(data.radius * 1.018, 48, 32), cm);
        tilt.add(cloudMesh);
        rb.cloudMat = cm; rb.cloudMesh = cloudMesh;
        rb.cloudSpinRate = rb.spinRate * (0.86 + hash(9, data.id.length) * 0.2);
      }

      const am = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: col(p.atmo) }, uStrength: { value: data.id === 'mirror' ? 1.5 : 0.85 },
          uSunDir: { value: new THREE.Vector3(1, 0, 0) },
        },
        vertexShader: planetVert, fragmentShader: atmoFrag,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
      });
      const atmo = new THREE.Mesh(new THREE.SphereGeometry(data.radius * 1.07, 48, 32), am);
      atmo.renderOrder = 2;
      g.add(atmo);
      rb.atmo = atmo;

      if (data.rings) {
        const inner = data.radius * 1.45, outer = data.radius * 2.5;
        const rm = new THREE.ShaderMaterial({
          uniforms: {
            uInner: { value: inner }, uOuter: { value: outer }, uTint: { value: col(p.high) }, uSunLocal: { value: new THREE.Vector3(1, 0, 0.4) },
          },
          vertexShader: ringVert, fragmentShader: ringFrag,
          transparent: true, depthWrite: false, side: THREE.DoubleSide,
        });
        const ringMesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 96, 1), rm);
        ringMesh.rotation.x = -Math.PI / 2 + 0.32;
        ringMesh.renderOrder = 3;
        /* rings form in the equatorial plane — parent them to the tilted
           spin group so they obey the same obliquity as their world */
        tilt.add(ringMesh);
        rb.ringMat = rm; rb.ringMesh = ringMesh;
      }
      /* moons are generated dynamically — one per diary page (see syncMoons) */
    } else if (data.kind === 'nebula') {
      const s = data.radius * 3.2;
      const cA = col(p.base), cB = col(p.high);

      // 1. Primary Volumetric Raymarched 3D Density Bounding Geometry
      const nebMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColorA: { value: cA },
          uColorB: { value: cB },
          uOpacity: { value: 0.95 },
          uCamLocalP: { value: new THREE.Vector3() },
        },
        vertexShader: nebulaVert,
        fragmentShader: nebulaFrag,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
      });

      const nebBox = new THREE.Mesh(new THREE.BoxGeometry(s * 2.5, s * 2.5, s * 2.5), nebMat);
      nebBox.renderOrder = 3;
      g.add(nebBox);
      rb.mat = nebMat;

      // 2. Surrounding 3D Dense Starfield (Independent 3D points in volumetric space)
      const starfield3D = this.makePoints(
        1600,
        (i, a) => {
          const r = Math.pow(Math.random(), 0.55) * s * 1.8;
          const t = Math.random() * Math.PI * 2, pVal = Math.acos(2 * Math.random() - 1);
          a[i * 3] = r * Math.sin(pVal) * Math.cos(t);
          a[i * 3 + 1] = r * Math.cos(pVal);
          a[i * 3 + 2] = r * Math.sin(pVal) * Math.sin(t);
        },
        (i) => (i % 30 === 0 ? 3.5 + Math.random() * 2.8 : 0.6 + Math.random() * 1.2),
        (i) => {
          const w = Math.random();
          if (w > 0.85) return [0.72, 0.88, 1.0]; // Cool White-Blue
          if (w > 0.6) return [1.0, 0.95, 0.88]; // Neutral White
          return [1.0, 0.82, 0.62]; // Warm Yellow
        },
        () => 0.4 + Math.random() * 0.55,
        2.2,
        true
      );
      g.add(starfield3D);

      // 3. Embedded Protostar Seeds & Diffraction Starbursts
      const flareTex = makeGlowTexture(128, [
        [0, 'rgba(255,255,255,1)'],
        [0.15, 'rgba(255,220,130,0.9)'],
        [0.42, 'rgba(255,140,50,0.4)'],
        [1, 'rgba(0,0,0,0)'],
      ]);
      const flareMat = new THREE.SpriteMaterial({ map: flareTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });

      // Embedded protostar at Left Pillar Tip
      const ps1 = new THREE.Sprite(flareMat);
      ps1.position.set(-s * 0.42, s * 0.48, s * 0.02);
      ps1.scale.setScalar(s * 0.38);
      g.add(ps1);

      // Embedded protostar at Center Pillar Tip
      const ps2 = new THREE.Sprite(flareMat);
      ps2.position.set(-s * 0.05, s * 0.78, -s * 0.08);
      ps2.scale.setScalar(s * 0.42);
      g.add(ps2);

      // Embedded protostar in Lower Mound
      const ps3 = new THREE.Sprite(flareMat);
      ps3.position.set(s * 0.05, -s * 0.62, s * 0.32);
      ps3.scale.setScalar(s * 0.32);
      g.add(ps3);

      // 4. Fine 3D Dust Filaments Particle Cloud
      const dustCloud3D = this.makePoints(
        850,
        (i, a) => {
          const r = Math.pow(Math.random(), 0.7) * s * 1.1;
          const t = Math.random() * Math.PI * 2, pVal = Math.acos(2 * Math.random() - 1);
          a[i * 3] = r * Math.sin(pVal) * Math.cos(t);
          a[i * 3 + 1] = r * Math.cos(pVal) * 0.8;
          a[i * 3 + 2] = r * Math.sin(pVal) * Math.sin(t);
        },
        () => 2.2 + Math.random() * 4.2,
        () => {
          const w = Math.random();
          return w > 0.75 ? [0.25, 0.85, 1.0] : [0.85, 0.45, 0.15];
        },
        () => 0.3 + Math.random() * 0.45,
        2.6,
        true
      );
      g.add(dustCloud3D);
    } else if (data.kind === 'hole') {
      /* Round 54/55 — ONE renderer, no stand-ins: the geodesic black hole,
         physics-colored (blackbody + Doppler) exactly like the reference,
         with his bent starfield behind it. On GPUs that cannot run it, the
         hole hides itself; the exact Schwarzschild bend rides the universe
         surface too (lensStrong is set for kind 'hole'). */
      const R = data.radius;
      const bh = this.attachBlackHole(R, g);
      rb.mat = undefined;
      g.userData.bh = bh;
    } else if (data.kind === 'vault') {
      /* the Universal Vault — Gargantua: the geodesic black hole, nothing
         else (Round 55 erased the old lattice-ring fallback look) */
      const R = data.radius;
      const bh = this.attachBlackHole(R, g);
      g.userData.bh = bh;
    }

    const cr = Math.max(data.radius * 1.5, 2.6);
    const collider = new THREE.Mesh(new THREE.SphereGeometry(cr, 10, 10), new THREE.MeshBasicMaterial({ visible: false }));
    collider.userData.bodyId = data.id;
    g.add(collider);
    rb.collider = collider;
    this.colliderList.push(collider);

    if (data.kind === 'planet' || data.kind === 'dwarf' || data.kind === 'vault') {
      const pts: number[] = [];
      const phys = calculatePhysics(data);
      const e = phys.eccentricity;
      const speed = data.orbit.speed || 0.01;
      /* Sample exactly ONE full revolution in fixed angular steps so the line is a
         smooth ellipse for every speed — sampling a fixed day-window made fast
         planets render as stars/hexagons (few scattered samples per lap). */
      const segments = 256;
      const periodDays = (Math.PI * 2) / speed;
      for (let i = 0; i <= segments; i++) {
        const simStep = (i / segments) * periodDays;
        const pos = calculateKeplerPosition(data.orbit.a, e, data.orbit.phase, data.orbit.incl, simStep, speed);
        pts.push(pos.x, pos.y, pos.z);
      }
      const og = new THREE.BufferGeometry();
      og.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const om = new THREE.LineBasicMaterial({ color: 0x8ba1c4, transparent: true, opacity: 0 });
      const line = new THREE.LineLoop(og, om);
      this.scene.add(line);
      rb.orbitLine = line;
    }

    this.scene.add(g);
    this.bodies.push(rb);
  }

  private buildBelt() {
    const R = Math.random;
    const g = new THREE.Group();

    /* fine dust — thousands of specks read as a continuous sandy band */
    const dust = this.makePoints(
      4800,
      (i, a) => {
        const ang = R() * Math.PI * 2;
        const r = 78 + R() * 15 + Math.pow(R(), 3) * 4;
        const band = (R() + R() + R() - 1.5) / 1.5; /* gaussian-ish thickness */
        a[i * 3] = Math.cos(ang) * r; a[i * 3 + 1] = band * 1.7; a[i * 3 + 2] = Math.sin(ang) * r;
      },
      () => 0.22 + R() * 0.6,
      () => { const w = 0.38 + R() * 0.3; const warm = R() * 0.1; return [w + warm, w * 0.86, w * 0.7] as [number, number, number]; },
      () => 0.25 + R() * 0.55, 1.15, false,
    );
    g.add(dust);

    /* lumpy 3D rocks — a handful of CPU-displaced shapes, instanced around
       the band: many small, a few big, every one tumbling on its own axis */
    const shades = ['#8d8781', '#726c65', '#9c948b', '#615c55', '#7f766b', '#91867a'];
    const SHAPES = 6, PER_SHAPE = 56;
    for (let s = 0; s < SHAPES; s++) {
      const geo = this.makeRockGeometry(s * 17.31 + 3.7);
      const mat = new THREE.ShaderMaterial({
        vertexShader: asteroidVert, fragmentShader: asteroidFrag,
        uniforms: { uColor: { value: new THREE.Color(shades[s % shades.length]) } },
      });
      const mesh = new THREE.InstancedMesh(geo, mat, PER_SHAPE);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const tumbles: BeltRock[] = [];
      const m = new THREE.Matrix4();
      for (let k = 0; k < PER_SHAPE; k++) {
        const ang = R() * Math.PI * 2;
        const r = 78 + R() * 15;
        const y = (R() + R() + R() - 1.5) / 1.5 * 1.9;
        const sc = 0.22 + Math.pow(R(), 2.4) * 1.45; /* many pebbles, few boulders */
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * Math.PI * 2, R() * Math.PI * 2, R() * Math.PI * 2));
        const pos = new THREE.Vector3(Math.cos(ang) * r, y, Math.sin(ang) * r);
        m.compose(pos, q, new THREE.Vector3(sc, sc, sc));
        mesh.setMatrixAt(k, m);
        tumbles.push({
          pos, q,
          scale: new THREE.Vector3(sc, sc, sc),
          axis: new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(),
          speed: 0.12 + R() * 0.55,
        });
      }
      g.add(mesh);
      this.asteroidInst.push({ mesh, tumbles });
    }
    this.scene.add(g);
    this.belt = g;
  }

  /** one lumpy rock silhouette — an icosahedron pushed around by CPU noise,
      slightly flattened like a real potato-shaped minor body */
  private makeRockGeometry(seed: number): THREE.BufferGeometry {
    const geo = new THREE.IcosahedronGeometry(1, 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    const f1 = 1.2 + (seed % 0.9);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      v.y *= 0.82; v.z *= 0.92;
      const lump = cpuFbm(v.x * f1 + seed, v.y * f1 + v.z * 0.7 + seed * 1.3) * 0.4
        + cpuFbm(v.y * 3.6 + seed * 1.7, v.z * 3.6 - seed) * 0.13;
      v.multiplyScalar(1 + lump);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals(); /* non-indexed → crisp facets, like real rock */
    return geo;
  }
  private belt!: THREE.Group;
  private asteroidInst: { mesh: THREE.InstancedMesh; tumbles: BeltRock[] }[] = [];
  private _rockM = new THREE.Matrix4();
  private _rockQ = new THREE.Quaternion();

  private buildMeteors() {
    const headTex = makeGlowTexture(128, [
      [0, 'rgba(255,255,255,1)'],
      [0.2, 'rgba(180,240,255,0.9)'],
      [0.5, 'rgba(100,200,255,0.4)'],
      [1, 'rgba(60,140,255,0)'],
    ]);
    const R = Math.random;
    for (let i = 0; i < 40; i++) {
      const headMat = new THREE.SpriteMaterial({ map: headTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
      const headSprite = new THREE.Sprite(headMat);
      
      const lineGeom = new THREE.BufferGeometry();
      lineGeom.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
      lineGeom.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 0.2, 0.5, 1], 3));
      const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      const line = new THREE.Line(lineGeom, lineMat);
      
      const g = new THREE.Group();
      g.add(headSprite); g.add(line);
      this.scene.add(g);
      
      const m: ShootingMeteor = {
        pos: new THREE.Vector3(), vel: new THREE.Vector3(), len: 1, life: 0, maxLife: 1,
        headSprite, line, lineGeom, size: 1,
      };
      this.resetMeteor(m);
      m.life = R() * m.maxLife; // stagger initial life times
      this.meteors.push(m);
    }

    /* THE COSMIC ECHO POOL — eight head-glow sprites waiting for today's
       on-this-day memories. Inert until armEchoShower() fills them. */
    const echoGroup = new THREE.Group();
    echoGroup.visible = false;
    for (let i = 0; i < 8; i++) {
      const echoTex = makeGlowTexture(128, [
        [0, 'rgba(255,250,235,1)'],
        [0.2, 'rgba(255,236,180,0.95)'],
        [0.5, 'rgba(242,193,120,0.5)'],
        [1, 'rgba(242,193,120,0)'],
      ]);
      const headSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: echoTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      const lineGeom = new THREE.BufferGeometry();
      lineGeom.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
      lineGeom.setAttribute('color', new THREE.Float32BufferAttribute([1, 0.92, 0.7, 0.9, 0.6, 0.3], 3));
      const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      const g = new THREE.Group();
      g.add(headSprite); g.add(line);
      echoGroup.add(g);
      const echo = {
        pos: new THREE.Vector3(), vel: new THREE.Vector3(), len: 1, life: 0, maxLife: 1,
        headSprite, line, lineGeom, size: 1,
        entryId: '', planetId: '', title: '',
      };
      this.echoMeteors.push(echo);
      this.echoColliders.push(headSprite);
      (headSprite as THREE.Sprite & { echoEntryId?: string }).echoEntryId = '';
    }
    this.scene.add(echoGroup);
    this.echoGroup = echoGroup;
  }

  private resetEchoMeteor(m: (ShootingMeteor & { entryId: string; planetId: string; title: string }), far: boolean) {
    const R = Math.random;
    /* echo meteors live in the intimate shell — 220..520 units — so they
       read at system scale and are actually clickable */
    const r = 240 + R() * 280;
    const theta = R() * Math.PI * 2, phi = Math.acos(2 * R() - 1);
    m.pos.set(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi) * 0.6, r * Math.sin(phi) * Math.sin(theta));
    const speed = 14 + R() * 30;
    const dir = new THREE.Vector3((R() - 0.5) * 2, (R() - 0.5) * 0.5, (R() - 0.5) * 2).normalize();
    m.vel.copy(dir).multiplyScalar(speed);
    m.len = 10 + R() * 26;
    m.life = far ? -R() * 26 : 0;
    m.maxLife = 14 + R() * 10;
    m.size = 2.2 + R() * 2.2;
    m.headSprite.scale.setScalar(m.size);
  }

  private resetMeteor(m: ShootingMeteor) {
    const R = Math.random;
    const r = 180 + R() * 220000;
    const theta = R() * Math.PI * 2, phi = Math.acos(2 * R() - 1);
    m.pos.set(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi) * 0.5, r * Math.sin(phi) * Math.sin(theta));
    const speed = 400 + R() * 3200;
    const dir = new THREE.Vector3((R() - 0.5) * 2, (R() - 0.5) * 0.8, (R() - 0.5) * 2).normalize();
    m.vel.copy(dir).multiplyScalar(speed);
    m.len = 120 + R() * 1100;
    m.life = 0;
    m.maxLife = 1.2 + R() * 3.5;
    m.size = Math.max(6, r * 0.007);
    m.headSprite.scale.setScalar(m.size);
  }

  private updateMeteors(dt: number) {
    /* the meteors sleep through the birth — absolute darkness comes first */
    if (this.bootIntro && this.clockT < 2.4) {
      this.meteors.forEach((m) => { m.headSprite.visible = false; m.line.visible = false; });
      this.updateEchoMeteors(dt);
      return;
    }
    this.meteors.forEach((m) => {
      m.headSprite.visible = true; m.line.visible = true;
      m.life += dt;
      if (m.life >= m.maxLife) {
        this.resetMeteor(m);
        return;
      }
      m.pos.addScaledVector(m.vel, dt);
      m.headSprite.position.copy(m.pos);
      
      const tail = m.pos.clone().sub(m.vel.clone().normalize().multiplyScalar(m.len));
      const attr = m.lineGeom.getAttribute('position') as THREE.BufferAttribute;
      attr.setXYZ(0, m.pos.x, m.pos.y, m.pos.z);
      attr.setXYZ(1, tail.x, tail.y, tail.z);
      attr.needsUpdate = true;
      
      const fade = Math.sin((m.life / m.maxLife) * Math.PI);
      m.headSprite.material.opacity = fade * 0.95;
      (m.line.material as THREE.LineBasicMaterial).opacity = fade * 0.8;
    });
    this.updateEchoMeteors(dt);
  }

  /* THE COSMIC ECHO — each armed meteor is one memory from this calendar day
     in an earlier year. Slow, golden, close to home. Click one to reopen the
     page it remembers. The shower runs all day; meteors respawn. */
  private updateEchoMeteors(dt: number) {
    if (!this.echoGroup) return;
    const active = this.echoMeteors.some((m) => m.entryId !== '');
    this.echoGroup.visible = active;
    if (!active) return;
    this.echoShowerClock += dt;
    let anyVisible = false;
    for (const m of this.echoMeteors) {
      if (m.entryId === '') { m.headSprite.visible = false; m.line.visible = false; continue; }
      m.life += dt;
      if (m.life >= m.maxLife) { this.resetEchoMeteor(m, true); continue; }
      if (m.life < 0) { m.headSprite.visible = false; m.line.visible = false; continue; }
      anyVisible = true;
      m.headSprite.visible = true; m.line.visible = true;
      m.pos.addScaledVector(m.vel, dt);
      m.headSprite.position.copy(m.pos);
      const tail = m.pos.clone().sub(m.vel.clone().normalize().multiplyScalar(m.len));
      const attr = m.lineGeom.getAttribute('position') as THREE.BufferAttribute;
      attr.setXYZ(0, m.pos.x, m.pos.y, m.pos.z);
      attr.setXYZ(1, tail.x, tail.y, tail.z);
      attr.needsUpdate = true;
      const fade = Math.min(1, Math.sin((m.life / m.maxLife) * Math.PI) * 1.4);
      const hoverGlow = this.echoHoverId === m.entryId ? 1 : 0;
      m.headSprite.material.opacity = fade * (0.8 + hoverGlow * 0.2);
      m.headSprite.scale.setScalar(m.size * (1 + hoverGlow * 0.5));
      (m.line.material as THREE.LineBasicMaterial).opacity = fade * 0.85;
    }
    this.echoGroup.visible = anyVisible;
  }

  /** Arm today's shower — one entry per meteor, up to 8 (App computes the echoes).
      Idempotent: re-arming with the same memory set on the same day is a no-op,
      so diary edits never restart the shower. */
  armEchoShower(echoes: { entryId: string; planetId: string; title: string }[]): void {
    const dayKey = new Date().toDateString();
    const sig = `${dayKey}::${echoes.map((e) => e.entryId).join(',')}`;
    if (sig === this.echoArmedDay) return;
    this.echoArmedDay = sig;
    this.echoMeteors.forEach((m, i) => {
      const e = echoes[i];
      if (!e) { m.entryId = ''; (m.headSprite as THREE.Sprite & { echoEntryId?: string }).echoEntryId = ''; return; }
      m.entryId = e.entryId;
      m.planetId = e.planetId;
      m.title = e.title;
      (m.headSprite as THREE.Sprite & { echoEntryId?: string }).echoEntryId = e.entryId;
      this.resetEchoMeteor(m, i > 0); /* the first streaks immediately */
    });
  }

  /** Which echo meteor is under the pointer, if any. */
  private pickEcho(): string | null {
    if (!this.echoGroup || !this.echoGroup.visible) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.far = this.currentDist() * 3 + 120;
    const visible = this.echoColliders.filter((s) => s.visible && s.parent?.visible);
    if (!visible.length) return null;
    const hits = this.raycaster.intersectObjects(visible, false);
    for (const h of hits) {
      const id = (h.object as THREE.Sprite & { echoEntryId?: string }).echoEntryId;
      if (id) return id;
    }
    return null;
  }

  /* ------------------------- the sentiment aurora ------------------------- */

  /** Feed the latest recency-weighted mood spectrum (from src/sentiment). */
  setSentimentAurora(signal: AuroraSignal): void {
    this.auroraTarget = signal;
  }

  private updateAurora(dt: number): void {
    if (!this.coronaMat) return;
    const t = this.auroraTarget;
    const cur = this.auroraCur;
    if (t) {
      /* two strongest mood colors drive the band */
      let iA = 0, iB = 1;
      const w = t.weights;
      for (let i = 1; i < w.length; i++) if (w[i] > w[iA]) iA = i;
      for (let i = 0; i < w.length; i++) if (i !== iA && w[i] > w[iB]) iB = i;
      this.auroraColA.set(MOOD_HEX[iA]);
      this.auroraColB.set(MOOD_HEX[iB]);
      const k = Math.min(1, dt * 1.6);
      cur.maskA += (w[iA] - cur.maskA) * k;
      cur.maskB += (w[iB] - cur.maskB) * k;
      cur.intensity += (t.intensity - cur.intensity) * k;
      cur.storm += (t.storm - cur.storm) * k;
    }
    cur.echo += ((this.echoMeteors.some((m) => m.entryId !== '' && m.life > 0) ? 0.55 : 0) - cur.echo) * Math.min(1, dt * 2);
    const u = this.coronaMat.uniforms;
    (u.uAuroraA.value as THREE.Color).copy(this.auroraColA);
    (u.uAuroraB.value as THREE.Color).copy(this.auroraColB);
    u.uAuroraMaskA.value = cur.maskA;
    u.uAuroraMaskB.value = cur.maskB;
    u.uAuroraIntensity.value = cur.intensity;
    u.uAuroraStorm.value = cur.storm;
    u.uEchoBloom.value = cur.echo;
  }

  /* --------------- Round 14 — Gravitational Lensing & Living Gravity --------------- */

  /** Spacetime lensing visibility — whether light visibly bends around the
      masses (Einstein's observable curvature). */
  setSpacetimeLens(on: boolean): void {
    this.lensTarget = on ? 1 : 0;
  }

  /** Living Gravity — first-order N-body coupling in osculating elements.
      Turning it off performs a canonical heal: the divine ephemeris is
      restored exactly, because the orbital elements were never touched. */
  setLivingGravity(on: boolean): void {
    this.livingGravityOn = on;
    if (!on) this.livingField.heal();
  }

  /** CANONICAL HEAL — restore the exact canonical paths in one stroke. */
  healLivingGravity(): void {
    this.livingField.heal();
  }

  /** Per-frame lensing driver — each massive body's direction from the
      camera becomes a lens ON THE UNIVERSE SURFACE: the celestial dome and
      the background star shells bend around it. The halo is always THE SIZE
      OF THE BODY'S OWN SILHOUETTE (θ_f = halo multiplier × asin(R/d)) — a
      black hole's disc is a hollow in the surface of reality, and only the
      surface in contact with it bends — so nothing can ever dwarf the
      universe at one distance and vanish at another. The bodies themselves
      are never touched.

      ROUND 61 — THE WHOLE UNIVERSE BENDS, not just the home system. The
      lens roster is the home anchor's bodies AND every real hole living in
      another galaxy's isolated inner system (kind 'vault' carries the same
      geodesic renderer there — it only vanished from the sky because it
      was never in this.bodies). Gates and geometry follow the renderer
      exactly: an inner-system hole lenses the sky only while its system is
      visible (node.inner.visible — the same <1,600-unit dive gate the
      marcher obeys), and its direction is measured in WORLD space through
      the rotated galaxy node. Holes claim the 16 slots FIRST; ordinary
      masses fill what remains. */
  private updateSpacetimeLens(dt: number) {
    this.lensCur += (this.lensTarget - this.lensCur) * Math.min(1, dt * 4);
    this.camera.getWorldDirection(this._lensFwd);
    const cap = this.lensVecs.length;
    /* ROUND 66 — the living lens: the swirl follows the disk's own spin */
    const swirlSign = Math.sign(getBlackHoleParams().rotSpeed) || 1;
    let n = 0;
    /* 1 — every hole and vault, anywhere in the scene, first — measured with
       its real velocity so the sky can be dragged by the motion. */
    for (const b of this.bodies) {
      if (b.data.kind !== 'hole' && b.data.kind !== 'vault') continue;
      if (n >= cap) break;
      this.trackLensVelocity(b.data.id, b.group.position, dt, n, swirlSign);
      n = this.pushSurfaceLens(n, b.group.position, b.data.radius, b.lensHalo ?? lensHaloFor(b.data.kind), 1);
    }
    if (n < cap) {
      for (const node of this.galaxyStageNodes) {
        const sys = node.innerSys;
        if (!sys || !node.inner.visible) continue; /* hidden system → its hole holds no hollow yet */
        for (const p of sys.planets) {
          if (p.data.kind !== 'hole' && p.data.kind !== 'vault') continue;
          if (n >= cap) break;
          p.group.getWorldPosition(this._lensPos);
          this.trackLensVelocity(p.data.id, this._lensPos, dt, n, swirlSign);
          n = this.pushSurfaceLens(n, this._lensPos, p.data.radius, lensHaloFor(p.data.kind), 1);
        }
        if (n >= cap) break;
      }
    }
    /* 2 — the ordinary masses: stars and worlds bending gently around
       their own silhouettes, exactly as before (no drag — near-field motion
       is a hole thing). */
    for (const b of this.bodies) {
      if (b.data.kind === 'hole' || b.data.kind === 'vault') continue;
      if (n >= cap) break;
      const halo = b.lensHalo ?? 0;
      if (halo <= 0) continue;
      this.lensVels[n].set(0, 0, 0, 0);
      n = this.pushSurfaceLens(n, b.group.position, b.data.radius, halo, 0);
    }
    this.surfaceManager.setLenses(this.lensVecs, this.lensRims, this.lensStrong, this.lensVels, n, this.lensCur);
  }

  /* ROUND 66 — measure one hole's real world velocity (smoothed; orbital
     motion is steady, so the measurement eases instead of jitering) and
     stage its vec4 slot: xyz = velocity in world units/s, w = the disk's
     spin sign. Called even when the lens is culled behind the view, so the
     measurement stays alive while the hole is out of sight. */
  private trackLensVelocity(key: string, worldPos: THREE.Vector3, dt: number, slot: number, swirlSign: number): void {
    let rec = this.lensVelPrev.get(key);
    if (!rec) {
      rec = { p: worldPos.clone(), v: new THREE.Vector3() };
      this.lensVelPrev.set(key, rec);
      this.lensVels[slot].set(0, 0, 0, swirlSign);
      return;
    }
    if (dt > 1e-4) {
      this._lensVelInst.copy(worldPos).sub(rec.p).divideScalar(dt);
      rec.v.lerp(this._lensVelInst, 0.12);
    }
    rec.p.copy(worldPos);
    this.lensVels[slot].set(rec.v.x, rec.v.y, rec.v.z, swirlSign);
  }

  /** ONE surface-lens slot writer — the single law every lens obeys,
      home roster and inner systems alike: direction from the camera,
      apparent silhouette half-angle rim = asin(R/d) from the body's real
      radius, halo multiplier scaled on it. Returns the new slot count, or
      n unchanged when the lens lies behind the view. `worldPos` must be
      the lens's position in WORLD space (inner-system holes pass through
      their rotated galaxy node, so a local position would bend the wrong
      patch of sky). */
  private pushSurfaceLens(n: number, worldPos: THREE.Vector3, radius: number, halo: number, strong: number): number {
    this._lensDir.copy(worldPos).sub(this.camera.position);
    const dist = this._lensDir.length();
    /* AUDIT 2026-09-28 — NaN firewall: one bad body position (a physics
       overflow, an uninitialized group) must poison one slot at most — a NaN
       rim would smear not-a-number across every sky pixel that lens touches.
       Guarded here, at the ONE writer every lens passes through. */
    if (!Number.isFinite(dist) || dist < 1e-3) return n;
    if (!Number.isFinite(radius) || !Number.isFinite(halo)) return n;
    this._lensDir.divideScalar(dist);
    if (this._lensDir.dot(this._lensFwd) < 0.05) return n; /* behind the view */
    /* apparent silhouette half-angle from the body's real radius */
    const rim = Math.asin(Math.min(1, radius / dist));
    if (!Number.isFinite(rim)) return n;
    this.lensRims[n] = rim;
    this.lensStrong[n] = strong;
    this.lensVecs[n].set(this._lensDir.x, this._lensDir.y, this._lensDir.z, halo * rim);
    return n + 1;
  }

  /** Living Gravity — first-order N-body coupling in osculating elements
      (Gauss's planetary equations, see nbody.ts). Runs AFTER updateBodies:
      the exact Kepler state feeds the field, the element perturbations
      advance, and every world is re-positioned from the exact Kepler solver
      run on its osculating elements. The canonical elements are never
      written — a heal is always one zeroing pass away. */
  private updateLivingGravity() {
    const field = this.livingField;
    if (field.nodes.length === 0) return;
    if (this.bootIntro && this.birthK < 1) return; /* the Birth is pure ejection — gravity joins after */
    const active = this.livingGravityOn && this.lastSimDelta > 0;

    for (const b of this.bodies) {
      const node = field.nodes.find((nd) => nd.id === b.data.id);
      if (!node || node.isStar) continue;
      const phys = calculatePhysics(b.data);
      const o = b.data.orbit;
      node.a = o.a;
      node.e0 = phys.eccentricity;
      node.phase = o.phase;
      node.incl = o.incl;
      node.speed = o.speed || 0.01;
      const kp = calculateKeplerPosition(o.a, phys.eccentricity, o.phase, o.incl, this.simDays, o.speed || 0.01);
      node.cx = kp.x; node.cy = kp.y; node.cz = kp.z;
      node.trueAnomaly = kp.trueAnomaly;
    }
    if (active) field.step(this.lastSimDelta, this.simDays);

    for (const b of this.bodies) {
      const node = field.nodes.find((nd) => nd.id === b.data.id);
      if (!node || node.isStar) continue;
      const pert = field.perturbedPosition(node, this.simDays);
      b.group.position.set(pert.x, pert.y, pert.z);
      node.deviationAU = pert.deviation / SCENE_UNITS_PER_AU;
      const tel = gravityTelemetry.get(node.id);
      if (tel) tel.deviationAU = node.deviationAU;
    }
  }

  /** Memory Constellation Search: pulse the given worlds' atmospheres gold
      for ~4s so the search results visibly answer from the sky. */
  pulseConstellation(bodyIds: string[]): number {
    let n = 0;
    for (const b of this.bodies) {
      if (!bodyIds.includes(b.data.id)) continue;
      const atmoMat = b.atmo?.material as THREE.ShaderMaterial | undefined;
      if (atmoMat?.uniforms?.uStrength) {
        this.pulses.push({ mat: atmoMat, base: (atmoMat.uniforms.uStrength.value as number) ?? 0.85, until: performance.now() + 4000 });
        n++;
      }
    }
    return n;
  }

  /* the pulse envelopes live in the frame loop so they decay cleanly */
  private updatePulses(now: number): void {
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      const remain = p.until - now;
      if (remain <= 0 || !p.mat.uniforms.uStrength) {
        if (p.mat.uniforms.uStrength) p.mat.uniforms.uStrength.value = p.base;
        this.pulses.splice(i, 1);
        continue;
      }
      const k = Math.min(1, remain / 4000);
      p.mat.uniforms.uStrength.value = p.base + (Math.sin(now * 0.012) * 0.5 + 0.5) * 1.5 * k;
    }
  }

  private buildMultiverse(customRealitiesList?: RealityConfig[]) {
    const R = Math.random;
    const realitiesToBuild = customRealitiesList || REALITIES;
    this.multiverseColliders = [];
    this.galaxyNodes = [];
    this.multiverseMats = [];
    this.realityMarbles = []; /* reset — rebuildMultiverse() must not stack duplicates */
    this.realityGroups = {};
    this.astralCoreGroup = null;
    this.astralCoreMats = [];
    this.astralCoreRings = [];
    this.astralCoreHalo = [];
    this.demonCorePulseRings = [];
    this.demonCoreRings = [];
    this.demonCoreSpires = [];
    this.demonCoreJets = [];
    this.demonCoreTachyonNodes = [];
    this.corePulseOrbs = [];

    /* 0. Giant Sovereign Multiverse Hypersphere Boundary (Enclosing ALL parallel realities & clusters inside) */
    const giantSphereGroup = new THREE.Group();
    const giantRadius = 960000;
    this.giantMultiverseBoundaryMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uKamuiErase: { value: 0 },
        uBreachCrack: { value: 0 },
        uVortexDir: { value: new THREE.Vector3(0, 0, -1) },
        uColorA: { value: new THREE.Color('#06b6d4') },
        uColorB: { value: new THREE.Color('#8b5cf6') },
      },
      vertexShader: multiverseBoundaryVert,
      fragmentShader: multiverseBoundaryFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const giantSphereMesh = new THREE.Mesh(
      new THREE.SphereGeometry(giantRadius, 64, 48),
      this.giantMultiverseBoundaryMat
    );
    giantSphereGroup.add(giantSphereMesh);

    // Geodesic Coordinate Latitude / Longitude Latticework Rings
    const giantRingMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    // Equator Ring
    const equatorRing = new THREE.Mesh(new THREE.TorusGeometry(giantRadius, 1800, 8, 160), giantRingMat);
    giantSphereGroup.add(equatorRing);
    // Polar Meridians
    const meridian1 = new THREE.Mesh(new THREE.TorusGeometry(giantRadius, 1400, 8, 160), giantRingMat.clone());
    meridian1.rotation.x = Math.PI / 2;
    giantSphereGroup.add(meridian1);
    const meridian2 = new THREE.Mesh(new THREE.TorusGeometry(giantRadius, 1400, 8, 160), giantRingMat.clone());
    meridian2.rotation.y = Math.PI / 2;
    giantSphereGroup.add(meridian2);

    // Outer Multiverse Boundary Horizon Marker Points
    const boundaryHalo = this.makePoints(
      480,
      (idx, arr) => {
        const bp = Math.acos(2 * R() - 1);
        const bt = R() * Math.PI * 2;
        arr[idx * 3] = giantRadius * Math.sin(bp) * Math.cos(bt);
        arr[idx * 3 + 1] = giantRadius * Math.cos(bp);
        arr[idx * 3 + 2] = giantRadius * Math.sin(bp) * Math.sin(bt);
      },
      () => 2.5 + R() * 3.5,
      (idx) => (idx % 2 === 0 ? [0.0, 0.96, 0.85] : [0.55, 0.35, 0.95]),
      () => 0.45 + R() * 0.45,
      2.8,
      true
    );
    giantSphereGroup.add(boundaryHalo);
    this.giantMultiverseSphereGroup = giantSphereGroup;
    this.gMultiverse.add(giantSphereGroup);

    /* 1. Parallel Illuminated Bubble Universes corresponding to REALITIES & their Galaxy Clusters */
    const marbleGlassVert = `varying vec3 vN; varying vec3 vV; varying vec3 vWN; void main(){ vN = normalize(normalMatrix * normal); vWN = normalize(normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
    const marbleGlassFrag = `uniform vec3 uColorA; uniform vec3 uColorB; uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vWN;
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(vV);
  /* chromatic dispersion — each channel refracts at its own edge width */
  float fr = pow(1.0 - abs(dot(N, V)), 1.7);
  float fg = pow(1.0 - abs(dot(N, V)), 1.45);
  float fb = pow(1.0 - abs(dot(N, V)), 1.2);
  vec3 chroma = vec3(fr, fg, fb);
  float band = 0.5 + 0.5 * sin(vWN.y * 5.0 - uTime * 0.5) * sin(vWN.x * 3.0 + uTime * 0.35);
  vec3 base = mix(uColorA, uColorB, 0.35 + 0.3 * band);
  /* key-light specular glint — the sun catching the glass */
  vec3 L = normalize(vec3(0.35, 0.8, 0.42));
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 100.0);
  float sheen = pow(max(dot(N, H), 0.0), 12.0) * 0.22;
  vec3 col = base * (chroma * 4.2 + 0.07) + vec3(1.0, 0.98, 0.94) * (spec * 1.6 + sheen);
  float a = min(1.0, (chroma.r + chroma.g + chroma.b) * 0.9 + 0.07 + spec);
  gl_FragColor = vec4(col, a);
}`;
    const marbleTex = makeGlowTexture(128, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
    for (let i = 0; i < realitiesToBuild.length; i++) {
      const real = realitiesToBuild[i];
      const pos = new THREE.Vector3(...real.bubblePos);
      const size = real.bubbleSize;
      
      const realityGroup = new THREE.Group();
      realityGroup.userData = { realityId: real.id };
      
      const bubbleCollider = new THREE.Mesh(
        new THREE.SphereGeometry(size, 16, 12),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      bubbleCollider.position.copy(pos);
      bubbleCollider.userData = { realityId: real.id, isRealityBubble: true };
      realityGroup.add(bubbleCollider);
      this.multiverseColliders.push(bubbleCollider);
      
      /* Soft chromatic star nucleus inside universe bubble */
      const bubbleCoreMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(real.colorA).lerp(new THREE.Color(real.colorB), 0.5),
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const bubbleCoreMesh = new THREE.Mesh(new THREE.SphereGeometry(size * 0.16, 24, 18), bubbleCoreMat);
      bubbleCoreMesh.position.copy(pos);
      realityGroup.add(bubbleCoreMesh);

      /* Pocket Cosmos — the reality itself is a grand glass marble: a wide
         fresnel shell with a faint glass body (visible from any angle) that
         encloses the nucleus, the cluster orbit rings and their swirling
         galaxies, with a blazing core and its own spiral galaxy turning
         slowly inside */
      const colA = new THREE.Color(real.colorA), colB = new THREE.Color(real.colorB);
      const glassMat = new THREE.ShaderMaterial({
        uniforms: { uColorA: { value: colA.clone() }, uColorB: { value: colB.clone() }, uTime: { value: 0 } },
        vertexShader: marbleGlassVert, fragmentShader: marbleGlassFrag,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      realityGroup.add(new THREE.Mesh(new THREE.SphereGeometry(size * 2.6, 48, 32), glassMat));

      /* glass silhouette — a billboard ring that always faces the camera, so
         every marble reads as a crisp glass circle with a galaxy inside even
         from across the multiverse (never mistakable for a web knot) */
      if (!this.marbleRingTex) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 256;
        const g2 = cv.getContext('2d')!;
        g2.strokeStyle = 'rgba(255,255,255,0.95)';
        g2.lineWidth = 10;
        g2.shadowColor = 'rgba(255,255,255,0.8)';
        g2.shadowBlur = 14;
        g2.beginPath();
        g2.arc(128, 128, 108, 0, Math.PI * 2);
        g2.stroke();
        this.marbleRingTex = new THREE.CanvasTexture(cv);
      }
      const rimSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.marbleRingTex, color: colA.clone().lerp(colB, 0.5),
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7,
      }));
      rimSprite.scale.setScalar(size * 5.0);
      rimSprite.position.copy(pos);
      realityGroup.add(rimSprite);

      /* blazing heart of the marble */
      const marbleCore = new THREE.Sprite(new THREE.SpriteMaterial({
        map: marbleTex, color: colA.clone().lerp(colB, 0.4).lerp(new THREE.Color('#ffffff'), 0.55),
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8,
      }));
      marbleCore.scale.setScalar(size * 0.9);
      marbleCore.position.copy(pos);
      realityGroup.add(marbleCore);

      let seed = 0;
      for (let c2 = 0; c2 < real.id.length; c2++) seed = (seed * 31 + real.id.charCodeAt(c2)) >>> 0;
      const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const spiral = this.makePoints(
        700,
        (pi, pa) => {
          const arm = pi % 3;
          const rr = Math.pow(rnd(), 0.6) * size * 0.85;
          const ang = (arm / 3) * Math.PI * 2 + rr * 0.0008 + (rnd() - 0.5) * 0.4;
          const spread = (rnd() + rnd() - 1) * size * 0.08;
          pa[pi * 3] = Math.cos(ang) * rr + Math.cos(ang + 1.57) * spread;
          pa[pi * 3 + 1] = (rnd() + rnd() - 1) * size * 0.12;
          pa[pi * 3 + 2] = Math.sin(ang) * rr + Math.sin(ang + 1.57) * spread;
        },
        () => 1.1 + rnd() * 1.3,
        () => {
          const w = rnd();
          if (w > 0.85) return [1, 1, 1];
          const c = w > 0.5 ? colA : colB;
          return [c.r, c.g, c.b];
        },
        () => 0.45 + rnd() * 0.45,
        1.6, true,
      );
      (spiral.material as THREE.ShaderMaterial).userData.pointMode = 'marble';
      spiral.position.copy(pos); /* spin around the bubble's own center */
      spiral.rotation.x = (rnd() - 0.5) * 1.2;
      spiral.rotation.z = (rnd() - 0.5) * 1.2;
      realityGroup.add(spiral);
      this.realityMarbles.push({ spiral, glassMat, speed: 0.04 + rnd() * 0.06 });

      /* High-lighting circular particle halo */
      const haloPts = this.makePoints(
        140,
        (idx, arr) => {
          const pr = size * (1.08 + R() * 0.4);
          const pt = R() * Math.PI * 2, pp = Math.acos(2 * R() - 1);
          arr[idx * 3] = pos.x + pr * Math.sin(pp) * Math.cos(pt);
          arr[idx * 3 + 1] = pos.y + pr * Math.cos(pp);
          arr[idx * 3 + 2] = pos.z + pr * Math.sin(pp) * Math.sin(pt);
        },
        () => 2.2 + R() * 3.0,
        () => [1, 0.95, 0.85],
        () => 0.55 + R() * 0.35,
        2.6,
        true,
      );
      realityGroup.add(haloPts);

      /* 1.1 MAJOR GALAXIES — one ellipse orbit around the reality bubble per
         galaxy. If the ellipse is there, the galaxy exists; no ellipse, no
         galaxy. The count of ellipses is literally the reality's galaxy list. */
      const galaxies = real.galaxies || [];
      for (let gIdx = 0; gIdx < galaxies.length; gIdx++) {
        const gal = galaxies[gIdx];
        const orbitRadius = size * Math.max(1.05, gal.orbitRadius);
        const orbitSpeed = gal.orbitSpeed || 0.05;
        const orbitIncl = gal.orbitIncl || 0.3;
        const phase = gal.orbitPhase || (gIdx / Math.max(1, galaxies.length)) * Math.PI * 2;

        // The ellipse orbit line itself — one continuous inclined ellipse
        const orbitPts: number[] = [];
        const segments = 96;
        for (let s = 0; s <= segments; s++) {
          const ang = (s / segments) * Math.PI * 2;
          const ox = Math.cos(ang) * orbitRadius;
          const oy = Math.sin(ang) * orbitRadius * Math.sin(orbitIncl);
          const oz = Math.sin(ang) * orbitRadius * Math.cos(orbitIncl);
          orbitPts.push(pos.x + ox, pos.y + oy, pos.z + oz);
        }
        const og = new THREE.BufferGeometry();
        og.setAttribute('position', new THREE.Float32BufferAttribute(orbitPts, 3));
        const om = new THREE.LineBasicMaterial({
          color: new THREE.Color(gal.color || real.colorA),
          transparent: true,
          opacity: gal.isHomeGalaxy ? 0.38 : 0.2,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const orbitLine = new THREE.LineLoop(og, om);
        realityGroup.add(orbitLine);

        // Galaxy node — a living mini spiral galaxy riding the ellipse
        const nodeGroup = new THREE.Group();
        const initialA = phase;
        nodeGroup.position.set(
          pos.x + Math.cos(initialA) * orbitRadius,
          pos.y + Math.sin(initialA) * orbitRadius * Math.sin(orbitIncl),
          pos.z + Math.sin(initialA) * orbitRadius * Math.cos(orbitIncl),
        );

        /* the galaxy's own tilted disc of stars (spins inside spiralGroup) */
        const galCol = new THREE.Color(gal.color || real.colorA);
        const spiralGroup = new THREE.Group();
        spiralGroup.rotation.x = 0.5 + ((gIdx * 37) % 11) * 0.06;
        spiralGroup.rotation.z = ((gIdx * 53) % 13) * 0.05;
        const galPts = this.makePoints(
          420,
          (pi, pa) => {
            const arm = pi % 3;
            const rr = Math.pow(rnd(), 0.6) * size * 0.085;
            const ang = (arm / 3) * Math.PI * 2 + rr * 0.0035 + (rnd() - 0.5) * 0.4;
            const spread = (rnd() + rnd() - 1) * size * 0.012;
            pa[pi * 3] = Math.cos(ang) * rr + Math.cos(ang + 1.57) * spread;
            pa[pi * 3 + 1] = (rnd() + rnd() - 1) * size * 0.01;
            pa[pi * 3 + 2] = Math.sin(ang) * rr + Math.sin(ang + 1.57) * spread;
          },
          () => 1.0 + rnd() * 1.2,
          () => {
            const w = rnd();
            if (w > 0.88) return [1, 1, 1];
            const c = w > 0.5 ? galCol : new THREE.Color(real.colorB);
            return [c.r, c.g, c.b];
          },
          () => 0.45 + rnd() * 0.45,
          1.5, true, true,
        );
        (galPts.material as THREE.ShaderMaterial).userData.pointMode = 'marble';
        spiralGroup.add(galPts);
        nodeGroup.add(spiralGroup);

        /* radiant core glow so the node reads as a galaxy from any distance */
        const galGlowTex = makeGlowTexture(128, [
          [0, gal.color || real.colorA],
          [0.35, `${gal.color || real.colorA}88`],
          [0.7, `${gal.color || real.colorA}22`],
          [1, 'rgba(0,0,0,0)'],
        ]);
        const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: galGlowTex,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
        }));
        glowSprite.scale.setScalar(size * 0.1);
        nodeGroup.add(glowSprite);

        // Interactive collider — hover / click / double-click target
        const collider = new THREE.Mesh(
          new THREE.SphereGeometry(size * 0.18, 10, 10),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        collider.userData = { isGalaxy: true, galaxyData: gal, galaxyId: gal.id, realityId: real.id };
        nodeGroup.add(collider);
        this.multiverseColliders.push(collider);

        realityGroup.add(nodeGroup);

        this.galaxyNodes.push({
          galaxyData: gal,
          realityId: real.id,
          group: nodeGroup,
          collider,
          orbitRadius,
          orbitSpeed,
          orbitIncl,
          phase,
          centerPos: pos,
          spiralGroup,
          glowSprite,
          orbitLine,
        });
      }

      realityGroup.visible = (real.id === this.activeRealityId);
      this.gMultiverse.add(realityGroup);
      this.realityGroups[real.id] = realityGroup;
    }
    /* 2. Colliding Interacting Spiral Galaxies */
    const gPair = new THREE.Group();
    gPair.position.set(65000, 12000, -55000);
    
    // Primary Large Spiral Galaxy
    const gal1 = this.makePoints(
      14000,
      (i, a) => {
        const arm = i % 4;
        const rr = Math.pow(R(), 0.58) * 9500;
        const ang = (arm / 4) * Math.PI * 2 + rr * 0.0006 * 3.4 + (R() - 0.5) * 0.4;
        const spread = (R() + R() - 1) * (400 + rr * 0.08);
        a[i * 3] = Math.cos(ang) * rr + Math.cos(ang + 1.57) * spread;
        a[i * 3 + 1] = (R() - 0.5) * (300 + rr * 0.03);
        a[i * 3 + 2] = Math.sin(ang) * rr + Math.sin(ang + 1.57) * spread;
      },
      () => 1.2 + R() * 2.2,
      () => { const w = R(); return w > 0.85 ? [1, 0.72, 0.85] : w > 0.6 ? [0.45, 0.75, 1] : [0.75, 0.85, 1]; },
      () => 0.35 + R() * 0.55, 2.2, true, true,
    );
    gal1.rotation.x = 0.8; gal1.rotation.z = -0.3;
    gPair.add(gal1);
    
    // Colliding Secondary Satellite Galaxy
    const gal2 = this.makePoints(
      8000,
      (i, a) => {
        const arm = i % 2;
        const rr = Math.pow(R(), 0.52) * 5200;
        const ang = (arm / 2) * Math.PI * 2 + rr * 0.001 * 4.2 + (R() - 0.5) * 0.35;
        a[i * 3] = Math.cos(ang) * rr - 6500;
        a[i * 3 + 1] = Math.sin(ang) * rr * 0.4 + 3200;
        a[i * 3 + 2] = Math.sin(ang) * rr - 4200;
      },
      () => 1.0 + R() * 2.0,
      () => [1, 0.8, 0.6] as [number, number, number],
      () => 0.4 + R() * 0.5, 2.0, true, true,
    );
    gPair.add(gal2);
    
    // Luminous core for colliding pair
    const c1 = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(128, [[0, 'rgba(255,220,160,0.6)'], [0.35, 'rgba(255,160,80,0.25)'], [1, 'rgba(0,0,0,0)']]),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    c1.scale.setScalar(4500);
    gPair.add(c1);
    
    // Active Reality Dimensional Barrier Anchor (glowing isolation boundary shield in Multiverse view)
    const anchorShield = new THREE.Group();
    const anchorRingMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const anchorRing1 = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.035, 16, 64), anchorRingMat);
    const anchorRing2 = new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.02, 16, 64), anchorRingMat);
    anchorRing2.rotation.x = Math.PI / 3;
    anchorRing2.rotation.y = Math.PI / 6;
    anchorShield.add(anchorRing1);
    anchorShield.add(anchorRing2);
    const activeRealityObj = realitiesToBuild.find((r) => r.id === this.activeRealityId) || realitiesToBuild[0];
    if (activeRealityObj) {
      anchorShield.position.set(...activeRealityObj.bubblePos);
      anchorShield.scale.setScalar(activeRealityObj.bubbleSize);
    }
    this.activeRealityShieldMesh = anchorShield;
    this.gMultiverse.add(anchorShield);

    /* 3. The Supreme Sovereign Multiverse Core & Universal Stabilizer Matrix (Calibrated, High-Contrast Detailing) */
    const demonCore = new THREE.Group();
    demonCore.position.set(0, 0, 0);

    // Sovereign Singularity Shader Material
    this.demonCoreMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorCore: { value: new THREE.Color('#ff0055') },
        uColorAura: { value: new THREE.Color('#8b5cf6') },
        uHover: { value: 0 },
        uTearStrength: { value: 0 },
      },
      vertexShader: demonCoreVert,
      fragmentShader: demonCoreFrag,
      transparent: true,
      side: THREE.DoubleSide,
    });

    // Layer 1: Central Sovereign Icosahedron Core (Plasma Shell) - Monumental Presence
    const coreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(9200, 4), this.demonCoreMat);
    demonCore.add(coreMesh);

    // Layer 2: Inner Golden Quantum Octahedron Singularity
    this.demonCoreInnerGeom = new THREE.Mesh(
      new THREE.OctahedronGeometry(6200, 2),
      new THREE.MeshBasicMaterial({
        color: 0xffb703,
        wireframe: true,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
      })
    );
    demonCore.add(this.demonCoreInnerGeom);

    // Layer 2.5: 4D Tesseract Hypercube Matrix (Nested rotating wireframe cubes)
    const tesseractGroup = new THREE.Group();
    const cubeMatOuter = new THREE.MeshBasicMaterial({
      color: 0x00f5d4,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    const cubeMatInner = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      wireframe: true,
      transparent: true,
      opacity: 0.60,
      blending: THREE.AdditiveBlending,
    });
    const cubeOuter = new THREE.Mesh(new THREE.BoxGeometry(4800, 4800, 4800), cubeMatOuter);
    const cubeInner = new THREE.Mesh(new THREE.BoxGeometry(2400, 2400, 2400), cubeMatInner);
    tesseractGroup.add(cubeOuter);
    tesseractGroup.add(cubeInner);
    demonCore.add(tesseractGroup);
    this.demonCoreTesseract = tesseractGroup;

    // Layer 3: Central Nexus Crystal (Dodecahedron)
    const coreNexus = new THREE.Mesh(
      new THREE.DodecahedronGeometry(3200, 1),
      new THREE.MeshBasicMaterial({
        color: 0x00f5d4,
        wireframe: false,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
      })
    );
    demonCore.add(coreNexus);

    // Layer 4: Relativistic Polar Plasma Jets (+Y and -Y Energetic Cones - Calibrated Opacity)
    this.demonCoreJets = [];
    const jetMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.20,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const topJet = new THREE.Mesh(new THREE.ConeGeometry(2400, 95000, 32, 1, true), jetMat);
    topJet.position.set(0, 48000, 0);
    demonCore.add(topJet);
    this.demonCoreJets.push(topJet);

    const bottomJet = new THREE.Mesh(new THREE.ConeGeometry(2400, 95000, 32, 1, true), jetMat);
    bottomJet.position.set(0, -48000, 0);
    bottomJet.rotation.x = Math.PI;
    demonCore.add(bottomJet);
    this.demonCoreJets.push(bottomJet);

    // 4 Gyroscopic Armillary Stabilizer Rings (Managing & Stabilizing Space-Time)
    this.demonCoreRings = [];
    const ringColors = ['#f59e0b', '#06b6d4', '#8b5cf6', '#ff0055'];
    const ringRadii = [14000, 19500, 25000, 31000];
    const ringThickness = [110, 95, 80, 70];
    for (let r = 0; r < 4; r++) {
      const ringGeom = new THREE.TorusGeometry(ringRadii[r], ringThickness[r], 16, 120);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(ringColors[r]),
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.rotation.x = (r * Math.PI) / 4 + 0.3;
      ringMesh.rotation.y = r * 0.65;
      demonCore.add(ringMesh);
      this.demonCoreRings.push(ringMesh);

      // Add 6 Stabilizer Node Crystals per ring
      for (let n = 0; n < 6; n++) {
        const nAngle = (n / 6) * Math.PI * 2;
        const nodeGeom = new THREE.OctahedronGeometry(550, 0);
        const nodeMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(ringColors[r]),
          wireframe: true,
          blending: THREE.AdditiveBlending,
        });
        const node = new THREE.Mesh(nodeGeom, nodeMat);
        node.position.set(Math.cos(nAngle) * ringRadii[r], Math.sin(nAngle) * ringRadii[r], 0);
        ringMesh.add(node);
      }
    }

    // 6 Eccentric Tachyon Satellite Probes Orbiting the Core
    this.demonCoreTachyonNodes = [];
    for (let t = 0; t < 6; t++) {
      const tGeom = new THREE.DodecahedronGeometry(600, 0);
      const tMat = new THREE.MeshBasicMaterial({
        color: t % 2 === 0 ? 0x00f5d4 : 0xf59e0b,
        wireframe: true,
        blending: THREE.AdditiveBlending,
      });
      const tNode = new THREE.Mesh(tGeom, tMat);
      tNode.userData = {
        radius: 36000 + t * 4500,
        speed: 0.015 + t * 0.005,
        incl: (t * Math.PI) / 6,
        phase: t * 1.05,
      };
      demonCore.add(tNode);
      this.demonCoreTachyonNodes.push(tNode);
    }

    // 12 Radiating Sovereign Stabilizer Spires / Energy Monoliths
    this.demonCoreSpires = [];
    const spireMat = new THREE.MeshStandardMaterial({
      color: 0x090314,
      emissive: new THREE.Color('#8b5cf6'),
      emissiveIntensity: 1.1,
      metalness: 0.95,
      roughness: 0.15,
    });
    const numSpires = 12;
    for (let h = 0; h < numSpires; h++) {
      const hAngle = (h / numSpires) * Math.PI * 2;
      const pitch = (h % 3 === 0 ? 0 : h % 3 === 1 ? 0.52 : -0.52);
      const spireGeom = new THREE.CylinderGeometry(240, 1100, 11000, 6);
      const spire = new THREE.Mesh(spireGeom, spireMat);
      const dist = 14500;
      spire.position.set(
        Math.cos(hAngle) * Math.cos(pitch) * dist,
        Math.sin(pitch) * dist,
        Math.sin(hAngle) * Math.cos(pitch) * dist
      );
      spire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), spire.position.clone().normalize());
      demonCore.add(spire);
      this.demonCoreSpires.push(spire);
    }

    // Dynamic Multidimensional Spacetime Gyroscopic Pulse Waves (Non-concentric spiral orientations)
    this.demonCorePulseRings = [];
    const pulseColors = [0x00f5d4, 0xec4899, 0x8b5cf6, 0xf59e0b];
    for (let p = 0; p < 4; p++) {
      const pulseGeom = new THREE.TorusGeometry(11000, 75, 12, 90);
      const pulseMat = new THREE.MeshBasicMaterial({
        color: pulseColors[p % pulseColors.length],
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const pMesh = new THREE.Mesh(pulseGeom, pulseMat);
      pMesh.rotation.x = (p * Math.PI) / 4 + 0.35;
      pMesh.rotation.y = p * 0.78;
      pMesh.rotation.z = (p * Math.PI) / 3;
      pMesh.userData = { phase: p / 4, baseScale: 1.0, rotSpeed: 0.005 + p * 0.003 };
      demonCore.add(pMesh);
      this.demonCorePulseRings.push(pMesh);
    }

    // Swirling Celestial Mana Embers & Accretion Vortex
    const demonEmbers = this.makePoints(
      2200,
      (idx, arr) => {
        const rad = 11000 + Math.pow(R(), 0.6) * 28000;
        const ang = R() * Math.PI * 2;
        const pAng = Math.acos(2 * R() - 1);
        arr[idx * 3] = rad * Math.sin(pAng) * Math.cos(ang);
        arr[idx * 3 + 1] = rad * Math.cos(pAng) * 0.35 + (R() - 0.5) * 1200;
        arr[idx * 3 + 2] = rad * Math.sin(pAng) * Math.sin(ang);
      },
      () => 2.5 + R() * 4.5,
      (idx) => {
        const palette: [number, number, number][] = [
          [0.0, 0.85, 0.75], // Cyan
          [0.85, 0.60, 0.0],  // Amber Gold
          [0.45, 0.28, 0.85], // Violet
          [0.85, 0.0, 0.28],   // Sovereign Crimson
        ];
        return palette[idx % palette.length];
      },
      () => 0.45 + R() * 0.35,
      2.6,
      true
    );
    demonCore.add(demonEmbers);

    // Balanced Sovereign Ambient Point Lights (Dimmed to preserve crisp visual detail)
    this.demonCoreLight = new THREE.PointLight(0x8b5cf6, 0.45, 180000);
    demonCore.add(this.demonCoreLight);

    const cyanSubLight = new THREE.PointLight(0x00f5d4, 0.30, 150000);
    demonCore.add(cyanSubLight);

    // Multiverse Quantum Stabilization Beams (Direct Energy Tethers to all Realities)
    const beamPositions: number[] = [];
    const realityPositions: THREE.Vector3[] = [];
    realitiesToBuild.forEach((r) => {
      const targetPos = new THREE.Vector3(...r.bubblePos);
      realityPositions.push(targetPos);
      beamPositions.push(0, 0, 0);
      beamPositions.push(targetPos.x, targetPos.y, targetPos.z);
    });

    const beamGeom = new THREE.BufferGeometry();
    beamGeom.setAttribute('position', new THREE.Float32BufferAttribute(beamPositions, 3));
    this.coreStabilizerBeamMat = new THREE.LineBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.coreStabilizerBeams = new THREE.LineSegments(beamGeom, this.coreStabilizerBeamMat);
    this.gMultiverse.add(this.coreStabilizerBeams);

    // Quantum Pulse Orbs travelling along the stabilization lines
    this.corePulseOrbs = [];
    realityPositions.forEach((pos, idx) => {
      const orbGeom = new THREE.SphereGeometry(220, 8, 8);
      const orbMat = new THREE.MeshBasicMaterial({
        color: idx % 2 === 0 ? 0x00f5d4 : 0xf59e0b,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
      });
      const orb = new THREE.Mesh(orbGeom, orbMat);
      orb.userData = { targetPos: pos, progress: (idx * 0.05) % 1.0 };
      this.gMultiverse.add(orb);
      this.corePulseOrbs.push(orb);
    });

    // Interactive Raycasting Collider for the Core
    this.demonCoreCollider = new THREE.Mesh(
      new THREE.SphereGeometry(32000, 16, 14),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.demonCoreCollider.userData = { isDemonCore: true, id: 'demon-core' };
    demonCore.add(this.demonCoreCollider);
    /* the demon core is retired — the black inner sphere (and everything that
       comes with it) is not part of the multiverse anymore. The assembly stays
       in memory for its uniforms/lights, but never renders, lights, or picks. */
    demonCore.visible = false;
    this.demonCoreLight.intensity = 0;
    this.coreStabilizerBeams.visible = false;
    this.corePulseOrbs.forEach((o) => (o.visible = false));
    this.demonCoreGroup = demonCore;
    this.gMultiverse.add(demonCore);

    /* 3.5 THE ASTRAL CORE — the living heart of the multiverse at (0,0,0).
       A glassy energy singularity every reality is anchored to. Clicking it
       opens the Multiverse Core Console (create / rename / recolor / collapse
       realities, forge galaxies). Visible, hoverable, clickable. */
    const astralCore = new THREE.Group();
    astralCore.position.set(0, 0, 0);

    const coreShellMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uHover: { value: 0 },
        uColorA: { value: new THREE.Color('#00f5d4') },
        uColorB: { value: new THREE.Color('#8b5cf6') },
        uColorHeart: { value: new THREE.Color('#ff2d78') },
      },
      vertexShader: `
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = normalize(-mv.xyz);
          vP = position;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float uTime; uniform float uHover;
        uniform vec3 uColorA; uniform vec3 uColorB; uniform vec3 uColorHeart;
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){
          vec3 N = normalize(vN); vec3 V = normalize(vV);
          float fres = pow(1.0 - abs(dot(N, V)), 2.1);
          /* living energy bands crawling over the glass shell */
          float bands = 0.5 + 0.5 * sin(vP.y * 0.00042 + uTime * 0.9) * sin(vP.x * 0.00037 - uTime * 0.62);
          float swirl = 0.5 + 0.5 * sin(atan(vP.z, vP.x) * 3.0 + uTime * 0.8 + vP.y * 0.00028);
          vec3 col = mix(uColorA, uColorB, swirl);
          col = mix(col, uColorHeart, bands * 0.42);
          col += vec3(1.0) * pow(bands, 5.0) * 0.6;
          float a = fres * (0.85 + uHover * 0.6) + bands * 0.10 + 0.04;
          gl_FragColor = vec4(col * (1.25 + uHover * 0.8), a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    });
    const coreShell = new THREE.Mesh(new THREE.SphereGeometry(20000, 56, 40), coreShellMat);
    astralCore.add(coreShell);
    this.astralCoreMats.push(coreShellMat);

    /* blazing heart visible from across the multiverse */
    const astralHeart = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(256, [
        [0, 'rgba(255,255,255,1)'],
        [0.18, 'rgba(255,170,210,0.9)'],
        [0.42, 'rgba(139,92,246,0.42)'],
        [1, 'rgba(0,0,0,0)'],
      ]),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.95,
    }));
    astralHeart.scale.setScalar(96000);
    astralCore.add(astralHeart);

    /* twin counter-rotating star halos */
    for (let h = 0; h < 2; h++) {
      const halo = this.makePoints(
        700,
        (i, a) => {
          const rad = 26000 + h * 14000 + (R() - 0.5) * 5200;
          const ang = R() * Math.PI * 2;
          const band = (R() + R() + R() - 1.5) * 3400;
          a[i * 3] = Math.cos(ang) * rad;
          a[i * 3 + 1] = band;
          a[i * 3 + 2] = Math.sin(ang) * rad;
        },
        () => 1.6 + R() * 2.6,
        () => (h === 0 ? [0.0, 0.96, 0.83] : [0.62, 0.42, 1.0]),
        () => 0.35 + R() * 0.45,
        2.4, true,
      );
      (halo.material as THREE.ShaderMaterial).userData.pointMode = 'multiverse';
      astralCore.add(halo);
      this.astralCoreHalo.push(halo);
    }

    /* three gyroscopic armillary rings — the stabilizer cage */
    const astralRingColors = ['#00f5d4', '#8b5cf6', '#ff2d78'];
    for (let r = 0; r < 3; r++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(25000 + r * 6500, 260 - r * 40, 12, 140),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(astralRingColors[r]),
          transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
        })
      );
      ring.rotation.x = (r * Math.PI) / 3 + 0.35;
      ring.rotation.y = r * 0.9;
      astralCore.add(ring);
      this.astralCoreRings.push(ring);
    }

    /* interactive collider — the click target for the Multiverse Core Console */
    const astralCollider = new THREE.Mesh(
      new THREE.SphereGeometry(58000, 20, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    astralCollider.userData = { isMultiverseCore: true, id: 'multiverse-core' };
    astralCore.add(astralCollider);
    this.multiverseColliders.push(astralCollider);

    this.astralCoreGroup = astralCore;
    this.gMultiverse.add(astralCore);

    this.gMultiverse.add(gPair);
    this.scene.add(this.gMultiverse);

    this.gMultiverse.traverse((obj) => {
      obj.frustumCulled = false;
    });
  }

  public rebuildMultiverse(customRealitiesList?: RealityConfig[]) {
    perfMark('multiverse-rebuild-start');
    const preservedTextures = new Set<THREE.Texture>();
    if (this.marbleRingTex) preservedTextures.add(this.marbleRingTex);
    this.disposeObject3D(this.gMultiverse, { textures: preservedTextures });
    while (this.gMultiverse.children.length > 0) {
      const obj = this.gMultiverse.children[0];
      this.gMultiverse.remove(obj);
    }
    /* the old build's point materials are gone — drop their uScale entries
       so the fresh ones re-register (without this, rebuilt marbles/nodes
       collapse to the 1.5px shader floor) */
    this.dropOwnedPointsMaterials('multiverse');
    this.buildMultiverse(customRealitiesList);
    this.collectPointsMaterials(this.gMultiverse, 'multiverse', 'multiverse');
    perfMeasure('multiverse-rebuild', 'multiverse-rebuild-start');
  }

  private buildLevels() {
    const R = Math.random;
    /* GALAXY stage — contents are rebuilt per reality in
       buildGalaxyStageContents() (one full spiral per major galaxy of the
       active reality's roster; see §setReality). The group itself mounts here. */
    this.gGalaxy.add(this.gGalaxyContents);
    this.scene.add(this.gGalaxy);

    /* GALAXY CLUSTER / GROUP stage — a deep field: hundreds of gravitationally
       bound galaxy smudges, glowing hot intracluster gas and gravitational
       lensing arcs (built once; gas tint follows the active reality) */
    this.buildClusterStage();
    this.scene.add(this.gCluster);

    /* supercluster complex (Laniakea & Virgo) — galaxy streams flowing towards the Great Attractor */
    const superPts = this.makePoints(
      4500,
      (i, a) => {
        const streamIdx = Math.floor(i / 150);
        const t = (streamIdx / 30) * Math.PI * 2;
        const p = Math.acos(2 * (streamIdx / 30) - 1);
        const streamDist = 38000 + (streamIdx % 12) * 4500;
        const attractorBias = (i % 150) / 150;
        const basePos = new THREE.Vector3(
          streamDist * Math.sin(p) * Math.cos(t),
          streamDist * Math.cos(p) * 0.45,
          streamDist * Math.sin(p) * Math.sin(t)
        );
        const attractorPos = new THREE.Vector3(42000, 8000, -35000);
        const interp = basePos.lerp(attractorPos, attractorBias * 0.4);
        const jitter = (R() - 0.5) * (1800 + attractorBias * 800);
        a[i * 3] = interp.x + jitter;
        a[i * 3 + 1] = interp.y + (R() - 0.5) * 1200;
        a[i * 3 + 2] = interp.z + jitter;
      },
      () => 1.4 + R() * 2.5,
      (i) => {
        const w = R();
        return w > 0.7 ? [1, 0.85, 0.6] : w > 0.4 ? [0.4, 0.85, 0.9] : [0.75, 0.8, 1];
      },
      () => 0.35 + R() * 0.45,
      2.0,
      true, true,
    );
    this.gSupercluster.add(superPts);

    const attractorGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(256, [[0, 'rgba(255,220,160,0.9)'], [0.3, 'rgba(255,160,80,0.4)'], [1, 'rgba(0,0,0,0)']]),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    attractorGlow.position.set(42000, 8000, -35000);
    attractorGlow.scale.setScalar(11000);
    this.gSupercluster.add(attractorGlow);
    this.levelSprites.push({ mat: attractorGlow.material as THREE.SpriteMaterial, base: 1, level: 'supercluster' });
    this.scene.add(this.gSupercluster);

    /* cosmic web — hyper-detailed cosmological simulation (IllustrisTNG-grade dark matter & baryonic filaments) */
    const NODES = 240, WEB_R = 135000;
    const nodes: THREE.Vector3[] = [];
    const nodeCol: THREE.Color[] = [];
    for (let i = 0; i < NODES; i++) {
      const t = R() * Math.PI * 2, p = Math.acos(2 * R() - 1);
      // Voronoi-like clustering distribution simulating cosmic voids and dense walls
      const r = WEB_R * (0.18 + 0.82 * Math.pow(R(), 0.65));
      nodes.push(new THREE.Vector3(r * Math.sin(p) * Math.cos(t), r * Math.cos(p) * 0.55, r * Math.sin(p) * Math.sin(t)));
      const w = R();
      nodeCol.push(w > 0.82 ? new THREE.Color('#ffc878') : w > 0.5 ? new THREE.Color('#64dfdf') : new THREE.Color('#83c5be'));
    }
    const edges: [number, number][] = [];
    const degree = new Array(NODES).fill(0);
    nodes.forEach((n, i) => {
      const dists = nodes.map((m, j) => [j, n.distanceTo(m)] as [number, number]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]);
      const k = 3 + Math.floor(R() * 3);
      for (let e = 0; e < k; e++) {
        const j = dists[e][0];
        if (n.distanceTo(nodes[j]) < WEB_R * 0.52) { edges.push([i, j]); degree[i]++; degree[j]++; }
      }
    });

    /* multi-strand curved gravitational filaments sprinkled with galaxies */
    const SAMPLES = 220;
    const webPts = this.makePoints(
      edges.length * SAMPLES,
      (idx, a) => {
        const [i, j] = edges[idx % edges.length];
        const t = Math.floor(idx / edges.length) / SAMPLES;
        const pA = nodes[i], pB = nodes[j];
        // Add organic gravitational curvature (sine curve offset along the segment)
        const curveOffset = Math.sin(t * Math.PI * 3 + i * 0.5) * 1200 + Math.cos(t * Math.PI * 2 + j * 0.3) * 900;
        const n = pA.clone().lerp(pB, t).add(new THREE.Vector3(curveOffset, curveOffset * 0.5, -curveOffset));
        const jit = 450 + n.length() * 0.008;
        a[idx * 3] = n.x + (R() - 0.5) * jit;
        a[idx * 3 + 1] = n.y + (R() - 0.5) * jit;
        a[idx * 3 + 2] = n.z + (R() - 0.5) * jit;
      },
      () => 0.5 + R() * 1.8,
      () => { const w = R(); return w > 0.85 ? [1, 0.88, 0.62] : w > 0.55 ? [0.38, 0.82, 0.95] : [0.58, 0.72, 0.95]; },
      () => 0.22 + R() * 0.5, 1.8, true, true,
    );
    this.gWeb.add(webPts);

    /* cluster knots at high-degree intersection nodes */
    const knot = this.makePoints(
      NODES,
      (i, a) => { a[i * 3] = nodes[i].x; a[i * 3 + 1] = nodes[i].y; a[i * 3 + 2] = nodes[i].z; },
      (i) => 2.0 + degree[i] * 0.55,
      (i) => { const c = nodeCol[i]; return [c.r, c.g, c.b] as [number, number, number]; },
      () => 0.6 + R() * 0.4, 2.8, true, true,
    );
    this.gWeb.add(knot);

    /* ultra-detailed filaments with per-vertex color flow */
    const linePos: number[] = []; const lineCol: number[] = [];
    edges.forEach(([i, j]) => {
      linePos.push(nodes[i].x, nodes[i].y, nodes[i].z, nodes[j].x, nodes[j].y, nodes[j].z);
      const a = nodeCol[i], b = nodeCol[j];
      lineCol.push(a.r, a.g, a.b, b.r, b.g, b.b);
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
    lg.setAttribute('color', new THREE.Float32BufferAttribute(lineCol, 3));
    /* the web filaments — one plain additive line material, opacity driven
       by the stage weight */
    this.webLineMat = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0 },
      },
      vertexShader: `
        varying vec3 vColor;
        void main(){
          vColor = color;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform float uOpacity; varying vec3 vColor;
        void main(){ gl_FragColor = vec4(vColor, uOpacity); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    });
    this.gWeb.add(new THREE.LineSegments(lg, this.webLineMat));

    /* luminous supercluster cores at major web intersections (e.g. Great Attractor & Perseus-Pisces) */
    const hubs = nodes.map((n, i) => [n, degree[i]] as [THREE.Vector3, number]).sort((a, b) => b[1] - a[1]).slice(0, 35);
    const hubPts = this.makePoints(
      hubs.length * 70,
      (idx, a) => {
        const hubIdx = Math.floor(idx / 70);
        const center = hubs[hubIdx][0];
        const pr = Math.pow(R(), 1.5) * 3200;
        const pa = R() * Math.PI * 2;
        a[idx * 3] = center.x + Math.cos(pa) * pr;
        a[idx * 3 + 1] = center.y + (R() - 0.5) * 1100;
        a[idx * 3 + 2] = center.z + Math.sin(pa) * pr;
      },
      () => 1.6 + R() * 3.0,
      (idx) => { const warm = Math.floor(idx / 70) % 3 === 0; return warm ? [1, 0.9, 0.7] : [0.5, 0.85, 1]; },
      () => 0.55 + R() * 0.45,
      2.4,
      true, true,
    );
    this.gWeb.add(hubPts);

    /* distant exoplanet horizon plates — procedural worlds drifting in the
       deep web, billboarded each frame; uOpacity is band-gated in tick */
    this.buildExoplanetPlates();

    this.scene.add(this.gWeb);

    /* anchor beacon — your star, visible across galactic scales */
    this.beacon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(128, [[0, 'rgba(255,240,210,1)'], [0.3, 'rgba(255,205,130,0.5)'], [1, 'rgba(255,180,100,0)']]),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    this.beacon.scale.setScalar(1500);
    this.scene.add(this.beacon);

    [this.gNeighborhood, this.gGalaxy, this.gCluster, this.gSupercluster, this.gWeb].forEach((g) => {
      g.traverse((obj) => { obj.frustumCulled = false; });
    });
    /* big static clouds opt back into frustum culling — drawing the cluster
       field / arcs while off-screen is pure fill-rate waste */
    this.gCluster.children.forEach((c) => {
      if (c instanceof THREE.Points || c instanceof THREE.Line) c.frustumCulled = true;
    });
  }

  /** Deterministic stage position for a major galaxy of the active reality.
      GALAXIES ARE ISOLATED — no two discs can ever touch: the home galaxy
      sits alone at the origin (it hosts the anchor star system), everyone
      else lives on tight-but-safe rings (13k / 22k / 31k …), max four per
      ring at golden-angle spacing, with a per-galaxy elevation. Rings are
      sized to the stage framing (~26k viewing distance) so the WHOLE roster
      stays on screen around the home galaxy — minimum center distance
      between any pair still exceeds the sum of their disc radii. */
  private static galaxyStagePosition(orbitRadius: number, orbitPhase: number, orbitIncl: number, slot: number): THREE.Vector3 {
    if (slot === 0) return new THREE.Vector3(0, 0, 0);
    const k = slot - 1;
    const ring = 13000 + Math.floor(k / 4) * 9000;
    const ang = k * 2.399963 + Math.floor(k / 4) * 0.9;
    const elev = Math.sin(orbitIncl * 2.2 + slot * 0.7) * 2200;
    return new THREE.Vector3(Math.cos(ang) * ring, elev, Math.sin(ang) * ring);
  }

  /** THE GALAXY STAGE — one full spiral galaxy per entry of the reality's
      real roster. Home galaxy centered and largest; every other galaxy is
      hoverable, clickable and focusable in its own right. */
  /* incrementing token — a fresh rebuild supersedes any pending chunked boot
     build so a reality switch mid-boot can never interleave two rosters */
  private galaxyChunkToken = 0;

  private buildGalaxyStageContents(reality: RealityConfig, chunked = false) {
    this.dropOwnedPointsMaterials('galaxyStage');
    const preservedGeometries = new Set<THREE.BufferGeometry>();
    const preservedMaterials = new Set<THREE.Material>();
    if (this.moonGeo) preservedGeometries.add(this.moonGeo);
    if (this.moonMat) preservedMaterials.add(this.moonMat);
    this.disposeObject3D(this.gGalaxyContents, {
      geometries: preservedGeometries,
      materials: preservedMaterials,
    });
    while (this.gGalaxyContents.children.length > 0) this.gGalaxyContents.remove(this.gGalaxyContents.children[0]);
    this.galaxyStageNodes = [];
    this.galaxyStageColliders = [];
    this.galaxyStagePointMats = [];
    this.innerColliderList = [];
    this.innerFocusBodyId = null;
    /* the inhabited realm the user may be standing inside was just disposed —
       the focus flags must follow, or a stale galaxyInnerFocus makes the next
       click read as a background click and yank the camera to the galaxy band */
    this.galaxyInnerFocus = false;
    this.galaxyFocusId = null;


    const galaxies = reality.galaxies ?? [];
    let seed = 0;
    for (let c2 = 0; c2 < reality.id.length; c2++) seed = (seed * 31 + reality.id.charCodeAt(c2)) >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

    if (!chunked) {
      galaxies.forEach((gal, i) => {
        this.buildGalaxyStageNode(reality, gal, i, rnd);
      });
      this.finalizeGalaxyStageContents();
      return;
    }
    /* BOOT PATH — one galaxy per animation frame. The universe the user sees
       at boot zoom is the home system at the origin; the galaxy roster is
       far away and nothing needs it for several seconds, so spreading the
       build hides every millisecond of it behind the intro veil instead of
       freezing startup for seconds. A fresh rebuild (token) supersedes a
       pending one. */
    const token = ++this.galaxyChunkToken;
    let built = 0;
    const step = () => {
      if (token !== this.galaxyChunkToken) return; /* superseded */
      if (built < galaxies.length) {
        this.buildGalaxyStageNode(reality, galaxies[built], built, rnd);
        built += 1;
        requestAnimationFrame(step);
      } else {
        this.finalizeGalaxyStageContents();
      }
    };
    step();
  }

  /** The tail of buildGalaxyStageContents — shared by the sync and chunked paths. */
  private finalizeGalaxyStageContents() {
    this.collectPointsMaterials(this.gGalaxyContents, 'galaxyStage', 'standard');
    if (this.lastEntries) this.syncMoons(this.lastEntries);
  }

  /** One full galaxy node of the stage: disc cloud, core glow, collider and
      its isolated inner stellar system. Extracted so the BOOT call can spread
      the roster across frames instead of stalling startup for seconds. */
  private buildGalaxyStageNode(reality: RealityConfig, gal: GalaxyData, i: number, rnd: () => number) {
    const isHome = gal.isHomeGalaxy || i === 0;
    const slot = isHome ? 0 : i;
      const radius = isHome ? 5600 : 2600 + rnd() * 1600;
      const arms = 3 + Math.floor(rnd() * 3);
      const wind = 2.6 + rnd() * 1.2;
      const pos = UniverseEngine.galaxyStagePosition(gal.orbitRadius, gal.orbitPhase, gal.orbitIncl, slot);
      const galCol = new THREE.Color(gal.color || reality.colorA);

      const group = new THREE.Group();
      group.position.copy(pos);
      group.rotation.x = 0.32 + rnd() * 0.55;
      group.rotation.z = (rnd() - 0.5) * 0.7;

      /* the disc — same grammar as the classic canned spiral, but tinted by
         this galaxy's own light */
      const pts = this.makePoints(
        isHome ? 13000 : 6500 + Math.floor(rnd() * 2500),
        (pi, pa) => {
          const arm = pi % arms;
          const rr = Math.pow(rnd(), 0.62) * radius;
          const ang = (arm / arms) * Math.PI * 2 + rr * 0.001 * wind * 3.2 + (rnd() - 0.5) * (0.5 - (rr / radius) * 0.32);
          const spread = (rnd() + rnd() + rnd() - 1.5) * (170 + rr * 0.09);
          pa[pi * 3] = Math.cos(ang) * rr + Math.cos(ang + 1.57) * spread;
          pa[pi * 3 + 1] = (rnd() + rnd() - 1) * (90 + rr * 0.012);
          pa[pi * 3 + 2] = Math.sin(ang) * rr + Math.sin(ang + 1.57) * spread;
        },
        () => 0.6 + rnd() * 1.3,
        () => {
          const w = rnd();
          if (w > 0.93) return [1, 1, 1];
          if (w > 0.55) return [galCol.r, galCol.g, galCol.b];
          if (w > 0.3) return [1, 0.88, 0.68];
          const b = 0.55 + rnd() * 0.4;
          return [b * 0.75, b * 0.84, b];
        },
        () => 0.2 + rnd() * 0.55, 1.7, false, true,
      );
      pts.frustumCulled = true; /* big static clouds opt into culling — fill rate */
      group.add(pts);
      this.galaxyStagePointMats.push({ points: pts, mat: pts.material as THREE.ShaderMaterial });

      /* blazing core + soft halo — the core burns in THIS galaxy's own
         light (tinted center, colored mid-halo) so every member reads
         distinct instead of washing out to the same white */
      const coreLight = galCol.clone().lerp(new THREE.Color('#ffffff'), 0.42);
      const glowTex = makeGlowTexture(256, [
        [0, `rgba(${Math.round(coreLight.r * 255)},${Math.round(coreLight.g * 255)},${Math.round(coreLight.b * 255)},1)`],
        [0.28, `rgba(${Math.round(galCol.r * 255)},${Math.round(galCol.g * 255)},${Math.round(galCol.b * 255)},0.85)`],
        [0.58, `rgba(${Math.round(galCol.r * 200)},${Math.round(galCol.g * 200)},${Math.round(galCol.b * 200)},0.3)`],
        [1, 'rgba(0,0,0,0)'],
      ]);
      const core = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.95,
      }));
      core.scale.setScalar(radius * 0.85);
      group.add(core);
      const coreMat = core.material as THREE.SpriteMaterial;


      /* hover / click / focus collider */
      const collider = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.35, 12, 10),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      collider.userData = { isGalaxy: true, galaxyData: gal, galaxyId: gal.id, realityId: reality.id };
      group.add(collider);
      this.galaxyStageColliders.push(collider);

      /* THE ISOLATED INNER SYSTEM — every galaxy owns a REAL one, built with
         the exact same construction grammar as the home anchor system: a
         shader star with a living corona, full Kepler worlds on shader
         surfaces (cloud decks, atmospheres, ring systems, moons) and its
         own asteroid belt — generated from the galaxy's lineage. Hidden
         until the camera dives within ~1,600 units — at that depth the disc
         itself becomes the sky. The home galaxy has no inner copy: its
         realm IS the anchor star system at the origin. */
      let innerSys: InnerSystem | null = null;
      const inner = new THREE.Group();
      if (!isHome) {
        const built = this.buildInnerStellarSystem(gal, galCol, rnd, reality);
        innerSys = built.sys;
        inner.add(built.root);
      }
      inner.visible = false;
      group.add(inner);

      this.gGalaxyContents.add(group);
      this.galaxyStageNodes.push({ data: gal, group, collider, radius, glowMat: coreMat, discMat: pts.material as THREE.ShaderMaterial, inner, innerSys });
  }

  /** THE REAL ISOLATED INNER SYSTEM — one per non-home galaxy. Same
      construction grammar and scale as the home anchor system at the
      origin: a shader star with a living corona at the local origin, full
      shader worlds on Kepler orbits (cloud decks, atmospheres, ring
      systems, moons) and a tumbling asteroid belt between the temperate
      world and the gas giant. Everything is parented to the galaxy node,
      so the system lives INSIDE its isolated realm. */
  private buildInnerStellarSystem(gal: GalaxyData, galCol: THREE.Color, rnd: () => number, reality: RealityConfig): { root: THREE.Group; sys: InnerSystem } {
    const root = new THREE.Group();
    const bodies = generateStellarSystemForGalaxy(gal);
    const starData = bodies.find((b) => b.kind === 'star') ?? bodies[0];
    const sys: InnerSystem = {
      starData,
      starUniforms: {}, starMesh: null as unknown as THREE.Mesh,
      corona: null as unknown as THREE.Mesh, coronaMat: null as unknown as THREE.ShaderMaterial,
      haloA: null as unknown as THREE.Points, haloB: null as unknown as THREE.Points,
      planets: [], belt: new THREE.Group(), beltInst: [], beltDustMat: null as unknown as THREE.ShaderMaterial,
    };
    root.add(sys.belt);

    /* ---- the star — THE ANCHOR STAR, COPY-PASTED: same shader surface,
            same corona fed by the reality's own palette, same two
            counter-rotating rings of captured starlight as the home system.
            The galaxy tint survives only in the soft outer glow. ---- */
    const col = (h: string) => new THREE.Color(h);
    const starColA = col(reality.colorA);
    const starColB = col(reality.colorB);
    const starCore = col(reality.starColor || reality.colorA);
    sys.starUniforms = {
      uTime: { value: 0 }, uBoost: { value: 1 },
      uColorA: { value: starColA.clone() },
      uColorB: { value: starColB.clone() },
      uCoreColor: { value: starCore.clone() },
    };
    const starMat = new THREE.ShaderMaterial({ uniforms: sys.starUniforms, vertexShader: starVert, fragmentShader: starFrag });
    sys.starMesh = new THREE.Mesh(new THREE.SphereGeometry(starData.radius, 96, 64), starMat);
    root.add(sys.starMesh);

    /* the star is REAL and interactive — click to select, double-click to
       open the control panel, exactly like the home anchor */
    const starCollider = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(starData.radius * 1.4, 8.4), 12, 12),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    starCollider.userData = { isInner: true, isInnerStar: true, bodyId: `inner:${starData.id}` };
    root.add(starCollider);
    this.innerColliderList.push(starCollider);

    sys.coronaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uBoost: { value: 1 },
        uColorA: { value: starColA.clone() },
        uColorB: { value: starColB.clone() },
      },
      vertexShader: coronaVert, fragmentShader: coronaFrag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const corona = new THREE.Mesh(new THREE.PlaneGeometry(starData.radius * 10.6, starData.radius * 10.6), sys.coronaMat);
    corona.renderOrder = 5;
    corona.frustumCulled = false;
    root.add(corona);
    sys.corona = corona;

    /* the extraordinary quality: two counter-rotating rings of captured
       starlight — same grammar as buildAnchor */
    const ringPts = (radius: number, count: number, color: [number, number, number], tilt: number, size: number) => {
      const pts = this.makePoints(
        count,
        (i, a) => { const ang = (i / count) * Math.PI * 2 + rnd() * 0.06; const rr = radius + (rnd() - 0.5) * 0.7; a[i * 3] = Math.cos(ang) * rr; a[i * 3 + 1] = (rnd() - 0.5) * 0.35; a[i * 3 + 2] = Math.sin(ang) * rr; },
        () => 0.5 + rnd() * 0.9, () => color, () => 0.3 + rnd() * 0.55, size, true,
      );
      const pivot = new THREE.Group();
      pivot.rotation.x = tilt;
      pivot.add(pts);
      root.add(pivot);
      return pts;
    };
    sys.haloA = ringPts(starData.radius * 1.6, 700, [1, 0.82, 0.55], 0.28, 1.6);
    sys.haloB = ringPts(starData.radius * 1.9, 420, [0.55, 0.85, 0.8], -0.32, 1.3);

    /* soft outer glow so the star also reads at mid-dive depth — kept subtle
       so the living corona arcs dominate, exactly like the home anchor */
    const glowTex = makeGlowTexture(128, [
      [0, 'rgba(255,252,244,1)'],
      [0.25, `rgba(${Math.round(galCol.r * 255)},${Math.round(galCol.g * 255)},${Math.round(galCol.b * 255)},0.55)`],
      [1, 'rgba(0,0,0,0)'],
    ]);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45 }));
    glow.scale.setScalar(starData.radius * 8.5);
    root.add(glow);

    /* ---- the worlds — exact buildBody grammar ---- */
    const terran = bodies.find((b) => /-w2$/.test(b.id));
    const giant = bodies.find((b) => b.rings);
    const beltR = terran && giant && giant !== terran ? (terran.orbit.a + giant.orbit.a) / 2 : 80;
    if (!this.moonGeo) this.moonGeo = new THREE.SphereGeometry(1, 22, 14);
    if (!this.moonMat) this.moonMat = new THREE.MeshStandardMaterial({ color: 0xa8a29a, roughness: 0.95, metalness: 0.02 });

    for (const data of bodies) {
      if (data.kind === 'star') continue;
      const p = data.palette;
      const col = (h: string) => new THREE.Color(h);
      const g = new THREE.Group();

      /* ---- an isolated Eventide Vault keeps the black-hole grammar of the
             home galaxy: the geodesic renderer, nothing else. It must not
             fall through the ordinary planet builder just because it lives
             in another galaxy. ---- */
      if (data.kind === 'vault') {
        const bh = this.attachBlackHole(data.radius, g);
        g.userData.bh = bh;
        const ip: InnerPlanet = { data, group: g, hole: bh, moons: [], hoverT: 0 };
        this.addInnerColliderAndOrbit(ip, root, rnd);
        root.add(g);
        sys.planets.push(ip);
        continue;
      }

      /* ---- the edge nebula — the Wisp Nebula grammar, copied from buildBody ---- */
      if (data.kind === 'nebula') {
        const s = data.radius * 3.2;
        const cA = col(p.base), cB = col(p.high);
        const nebMat = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 }, uColorA: { value: cA }, uColorB: { value: cB },
            uOpacity: { value: 0.95 }, uCamLocalP: { value: new THREE.Vector3() },
          },
          vertexShader: nebulaVert, fragmentShader: nebulaFrag,
          transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.NormalBlending,
        });
        const nebBox = new THREE.Mesh(new THREE.BoxGeometry(s * 2.5, s * 2.5, s * 2.5), nebMat);
        nebBox.renderOrder = 3;
        g.add(nebBox);

        const starfield3D = this.makePoints(
          1600,
          (i, a) => {
            const r = Math.pow(Math.random(), 0.55) * s * 1.8;
            const t = Math.random() * Math.PI * 2, pVal = Math.acos(2 * Math.random() - 1);
            a[i * 3] = r * Math.sin(pVal) * Math.cos(t);
            a[i * 3 + 1] = r * Math.cos(pVal);
            a[i * 3 + 2] = r * Math.sin(pVal) * Math.sin(t);
          },
          (i) => (i % 30 === 0 ? 3.5 + Math.random() * 2.8 : 0.6 + Math.random() * 1.2),
          (i) => {
            const w = Math.random();
            if (w > 0.85) return [0.72, 0.88, 1.0];
            if (w > 0.6) return [1.0, 0.95, 0.88];
            return [1.0, 0.82, 0.62];
          },
          () => 0.4 + Math.random() * 0.55, 2.2, true,
        );
        g.add(starfield3D);

        const flareTex = makeGlowTexture(128, [
          [0, 'rgba(255,255,255,1)'],
          [0.15, 'rgba(255,220,130,0.9)'],
          [0.42, 'rgba(255,140,50,0.4)'],
          [1, 'rgba(0,0,0,0)'],
        ]);
        const flareMat = new THREE.SpriteMaterial({ map: flareTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
        const protos: [number, number, number, number][] = [
          [-s * 0.42, s * 0.48, s * 0.02, s * 0.38],
          [-s * 0.05, s * 0.78, -s * 0.08, s * 0.42],
          [s * 0.05, -s * 0.62, s * 0.32, s * 0.32],
        ];
        protos.forEach(([px, py, pz, sc]) => {
          const ps = new THREE.Sprite(flareMat);
          ps.position.set(px, py, pz);
          ps.scale.setScalar(sc);
          g.add(ps);
        });

        const dustCloud3D = this.makePoints(
          850,
          (i, a) => {
            const r = Math.pow(Math.random(), 0.7) * s * 1.1;
            const t = Math.random() * Math.PI * 2, pVal = Math.acos(2 * Math.random() - 1);
            a[i * 3] = r * Math.sin(pVal) * Math.cos(t);
            a[i * 3 + 1] = r * Math.cos(pVal) * 0.8;
            a[i * 3 + 2] = r * Math.sin(pVal) * Math.sin(t);
          },
          () => 2.2 + Math.random() * 4.2,
          () => { const w = Math.random(); return w > 0.75 ? [0.25, 0.85, 1.0] : [0.85, 0.45, 0.15]; },
          () => 0.3 + Math.random() * 0.45, 2.6, true,
        );
        g.add(dustCloud3D);

        const ip: InnerPlanet = { data, group: g, mat: nebMat, moons: [], hoverT: 0 };
        this.addInnerColliderAndOrbit(ip, root, rnd);
        root.add(g);
        sys.planets.push(ip);
        continue;
      }

      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uDeep: { value: col(p.deep) }, uBase: { value: col(p.base) }, uHigh: { value: col(p.high) },
          uIce: { value: col(p.ice) }, uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uTime: { value: 0 },
          uSea: { value: data.nightside ? 0.02 : -0.55 }, uGhost: { value: 0 }, uFade: { value: 1 },
          uNight: { value: data.nightside ? 1 : 0 },
          uSeed: { value: new THREE.Vector3(hash(data.id.length, 3) * 40, hash(7, data.id.length) * 40, hash(data.id.length, 11) * 40) },
        },
        vertexShader: planetVert, fragmentShader: planetFrag, transparent: true,
      });
      /* tilted spin axis — REAL OBLIQUITY, same law as the home system */
      const physData = calculatePhysics(data);
      const tilt = new THREE.Group();
      tilt.rotation.order = 'YXZ';
      tilt.rotation.y = hash(data.id.length, 4) * Math.PI * 2;
      tilt.rotation.z = (physData.axialTiltDeg * Math.PI) / 180;
      g.add(tilt);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(data.radius, 40, 28), mat);
      tilt.add(mesh);
      const ip: InnerPlanet = { data, group: g, mat, moons: [], hoverT: 0 };
      /* spin direction follows obliquity: >90° = retrograde world */
      const retrograde = physData.axialTiltDeg > 90 ? -1 : 1;
      ip.spinMesh = mesh;
      ip.spinRate = retrograde * (Math.PI * 2) / (24 + hash(data.id.length, 5) * 52);

      if (data.clouds) {
        const cm = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3(1, 0, 0) },
            uSeed: { value: new THREE.Vector3(3.7, 8.1, 1.9) }, uCover: { value: 0.5 },
            uFade: { value: 1 },
          },
          vertexShader: planetVert, fragmentShader: cloudFrag, transparent: true, depthWrite: false,
        });
        const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(data.radius * 1.018, 32, 20), cm);
        tilt.add(cloudMesh);
        ip.cloudMat = cm;
        ip.cloudMesh = cloudMesh;
        ip.cloudSpinRate = ip.spinRate! * (0.86 + hash(9, data.id.length) * 0.2);
      }

      const am = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: col(p.atmo) }, uStrength: { value: 0.85 }, uSunDir: { value: new THREE.Vector3(1, 0, 0) },
        },
        vertexShader: planetVert, fragmentShader: atmoFrag,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
      });
      const atmo = new THREE.Mesh(new THREE.SphereGeometry(data.radius * 1.07, 32, 20), am);
      atmo.renderOrder = 2;
      g.add(atmo);
      ip.atmo = atmo;

      if (data.rings) {
        const inner = data.radius * 1.45, outer = data.radius * 2.5;
        const rm = new THREE.ShaderMaterial({
          uniforms: {
            uInner: { value: inner }, uOuter: { value: outer }, uTint: { value: col(p.high) }, uSunLocal: { value: new THREE.Vector3(1, 0, 0.4) },
          },
          vertexShader: ringVert, fragmentShader: ringFrag,
          transparent: true, depthWrite: false, side: THREE.DoubleSide,
        });
        const ringMesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 96, 1), rm);
        ringMesh.rotation.x = -Math.PI / 2 + 0.32;
        ringMesh.renderOrder = 3;
        tilt.add(ringMesh);
        ip.ringMat = rm;
        ip.ringMesh = ringMesh;
        /* the giant carries a small court of moons */
        const moonCount = 2 + Math.floor(rnd() * 2);
        for (let mi = 0; mi < moonCount; mi++) {
          const seed = hash(mi + 1, data.id.length + 3);
          const moon = new THREE.Mesh(this.moonGeo!, this.moonMat!);
          moon.scale.setScalar(Math.max(0.09, data.radius * (0.1 + 0.09 * seed)));
          g.add(moon);
          ip.moons.push({
            mesh: moon,
            a: data.radius * (1.75 + 0.55 * mi) + data.radius * 1.5,
            speed: (Math.PI * 2) / (14 + mi * 8),
            phase: seed * 6.28,
            incl: 0.18 + seed * 0.3,
          });
        }
      }

      this.addInnerColliderAndOrbit(ip, root, rnd);
      root.add(g);
      sys.planets.push(ip);
    }

    /* ---- its own asteroid belt, between the temperate world and the giant ---- */
    const R = rnd;
    const beltDust = this.makePoints(
      3200,
      (i, a) => {
        const ang = R() * Math.PI * 2;
        const r = beltR - 8 + R() * 16 + Math.pow(R(), 3) * 4;
        const band = (R() + R() + R() - 1.5) / 1.5; /* gaussian-ish thickness */
        a[i * 3] = Math.cos(ang) * r; a[i * 3 + 1] = band * 1.7; a[i * 3 + 2] = Math.sin(ang) * r;
      },
      () => 0.22 + R() * 0.6,
      () => { const w = 0.38 + R() * 0.3; const warm = R() * 0.1; return [w + warm, w * 0.86, w * 0.7] as [number, number, number]; },
      () => 0.25 + R() * 0.55, 1.15, false,
    );
    sys.beltDustMat = beltDust.material as THREE.ShaderMaterial;
    sys.belt.add(beltDust);

    const shades = ['#8d8781', '#726c65', '#9c948b', '#615c55', '#7f766b', '#91867a'];
    const SHAPES = 4, PER_SHAPE = 44;
    for (let s = 0; s < SHAPES; s++) {
      const geo = this.makeRockGeometry(s * 17.31 + 3.7);
      const mat = new THREE.ShaderMaterial({
        vertexShader: asteroidVert, fragmentShader: asteroidFrag,
        uniforms: { uColor: { value: new THREE.Color(shades[s % shades.length]) } },
      });
      const inst = new THREE.InstancedMesh(geo, mat, PER_SHAPE);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const tumbles: BeltRock[] = [];
      const m = new THREE.Matrix4();
      for (let k = 0; k < PER_SHAPE; k++) {
        const ang = R() * Math.PI * 2;
        const r = beltR - 8 + R() * 16;
        const y = (R() + R() + R() - 1.5) / 1.5 * 1.9;
        const sc = 0.22 + Math.pow(R(), 2.4) * 1.45; /* many pebbles, few boulders */
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * Math.PI * 2, R() * Math.PI * 2, R() * Math.PI * 2));
        const pos = new THREE.Vector3(Math.cos(ang) * r, y, Math.sin(ang) * r);
        m.compose(pos, q, new THREE.Vector3(sc, sc, sc));
        inst.setMatrixAt(k, m);
        tumbles.push({
          pos, q,
          scale: new THREE.Vector3(sc, sc, sc),
          axis: new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(),
          speed: 0.12 + R() * 0.55,
        });
      }
      sys.belt.add(inst);
      sys.beltInst.push({ mesh: inst, tumbles });
    }

    return { root, sys };
  }

  /** Collider + orbit ellipse for one inner world. The ellipse is HIDDEN
      until hover — exactly the home system's grammar (the ring is driven
      only by the pointer, never pinned on). */
  private addInnerColliderAndOrbit(ip: InnerPlanet, root: THREE.Group, rnd: () => number) {
    void rnd;
    const data = ip.data;
    /* hover / click collider — this world is REAL and interactive */
    const pcol = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(data.radius * 1.5, 2.6), 10, 10),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    pcol.userData = { isInner: true, bodyId: `inner:${data.id}` };
    ip.group.add(pcol);
    this.innerColliderList.push(pcol);

    /* orbit ellipse — one full Kepler revolution sampled in fixed angular
       steps (see buildBody), drawn in the system's own frame */
    const pts: number[] = [];
    const phys = calculatePhysics(data);
    const e = phys.eccentricity;
    const speed = data.orbit.speed || 0.01;
    const segments = 256;
    const periodDays = (Math.PI * 2) / speed;
    for (let i = 0; i <= segments; i++) {
      const simStep = (i / segments) * periodDays;
      const pos = calculateKeplerPosition(data.orbit.a, e, data.orbit.phase, data.orbit.incl, simStep, speed);
      pts.push(pos.x, pos.y, pos.z);
    }
    const og = new THREE.BufferGeometry();
    og.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const line = new THREE.LineLoop(og, new THREE.LineBasicMaterial({ color: 0x8ba1c4, transparent: true, opacity: 0, depthWrite: false }));
    line.visible = false;
    root.add(line);
    ip.orbitLine = line;
  }

  /** Per-frame life for one galaxy's isolated inner system — Kepler
      positions, day/night terminators, axial spins, moon circuits and
      tumbling belt rocks. Only runs while the camera is inside the realm
      (the group is invisible otherwise). */
  private updateInnerSystem(node: { data: GalaxyData; group: THREE.Group; inner: THREE.Group; innerSys: InnerSystem | null }, dt: number, nodeDist: number) {
    const sys = node.innerSys;
    if (!sys) return;

    /* the star breathes */
    sys.starUniforms.uTime.value = this.clockT;
    sys.starMesh.rotation.y += dt * 0.15;
    sys.coronaMat.uniforms.uTime.value = this.clockT;
    sys.coronaMat.uniforms.uBoost.value = 0.92 + 0.08 * Math.sin(this.clockT * 0.8);
    /* the corona always faces the camera — the home anchor's plane lives in
       the unrotated scene root, but this one inherits the galaxy node's
       tilt, which used to thin it out and dull the whole aura */
    node.inner.getWorldQuaternion(this._qScratch2).invert();
    sys.corona.quaternion.copy(this._qScratch2).multiply(this.camera.quaternion);

    /* the starlight halo rings live exactly like the anchor's — and keep
       their designed screen size by keying uScale on the star distance
       (the camLen-based driver would blow the points up from this far out) */
    sys.haloA.rotation.y += dt * 0.05;
    sys.haloB.rotation.y -= dt * 0.038;
    const haloScale = Math.max(1, nodeDist) / 90;
    for (const halo of [sys.haloA, sys.haloB]) {
      const hm = halo.material as THREE.ShaderMaterial;
      hm.uniforms.uTime.value = this.clockT;
      hm.uniforms.uOpacity.value = 1;
      hm.uniforms.uScale.value = haloScale;
    }

    node.group.getWorldPosition(this._vScratch3); /* the star's world position */
    /* surface lighting lives in the system's own frame — counter-rotate
       the galaxy node's tilt so the terminators face the local star */
    node.inner.getWorldQuaternion(this._qScratch).invert();
    for (const p of sys.planets) {
      const o = p.data.orbit;
      const phys = calculatePhysics(p.data, this.simDays);
      const pos = calculateKeplerPosition(o.a, phys.eccentricity, o.phase, o.incl, this.simDays, o.speed || 0.01);
      p.group.position.set(pos.x, pos.y, pos.z);

      /* hover pulse — the pointer's world swells gently, like home */
      const hoverTarget = this.hoveredId === `inner:${p.data.id}` ? 1 : 0;
      p.hoverT += (hoverTarget - p.hoverT) * Math.min(1, dt * 8);
      p.group.scale.setScalar((1 + p.hoverT * 0.045) * this.kamuiSwallowFactorFor(p.group));

      /* sun direction — world vector from the planet back to its star */
      p.group.getWorldPosition(this._vScratch2);
      this._vScratch1.copy(this._vScratch2).sub(this._vScratch3).normalize().multiplyScalar(-1);
      this._vDirScratch.copy(this._vScratch1).applyQuaternion(this._qScratch);
      /* Round 54/55 — geodesic uniforms ride the late-tick pass (see tick);
         the old lattice-ring spin is erased with the rings themselves */
      if (p.mat) {
        if (p.mat.uniforms.uSunDir) (p.mat.uniforms.uSunDir.value as THREE.Vector3).copy(this._vDirScratch);
        if (p.mat.uniforms.uTear) p.mat.uniforms.uTear.value = 0;
        if (p.mat.uniforms.uTearTime) p.mat.uniforms.uTearTime.value = this.clockT;
        this.applyKamuiFieldUniforms(p.mat);
        this.setKamuiLocalCenter(p.mat, p.spinMesh);
        p.mat.uniforms.uTime.value = this.clockT;
        /* the edge nebula's raymarch needs the camera in its own local space */
        if (p.mat.uniforms.uCamLocalP) {
          this._vScratch1.copy(this.camera.position);
          p.group.worldToLocal(this._vScratch1);
          (p.mat.uniforms.uCamLocalP.value as THREE.Vector3).copy(this._vScratch1);
        }
      }
      if (p.spinMesh && p.spinRate) p.spinMesh.rotation.y += dt * p.spinRate;
      if (p.cloudMat) {
        p.cloudMat.uniforms.uTime.value = this.clockT;
        (p.cloudMat.uniforms.uSunDir.value as THREE.Vector3).copy(this._vDirScratch);
        if (p.cloudMat.uniforms.uTear) p.cloudMat.uniforms.uTear.value = 0;
        this.applyKamuiFieldUniforms(p.cloudMat);
      }
      if (p.cloudMesh && p.cloudSpinRate) p.cloudMesh.rotation.y += dt * p.cloudSpinRate;
      if (p.atmo) {
        const atmoMat = p.atmo.material as THREE.ShaderMaterial;
        (atmoMat.uniforms.uSunDir.value as THREE.Vector3).copy(this._vDirScratch);
        if (atmoMat.uniforms.uTear) atmoMat.uniforms.uTear.value = 0;
        this.applyKamuiFieldUniforms(atmoMat);
      }
      if (p.ringMat) {
        p.ringMesh!.getWorldQuaternion(this._qScratch2).invert();
        (p.ringMat.uniforms.uSunLocal.value as THREE.Vector3).copy(this._vScratch1).applyQuaternion(this._qScratch2);
        this.applyKamuiFieldUniforms(p.ringMat);
        this.setKamuiLocalCenter(p.ringMat, p.ringMesh);
      }
      p.moons.forEach((m) => {
        const ma = m.phase + this.simDays * m.speed;
        /* each moon rides its OWN inclined plane — no shared moon-sheet */
        m.mesh.position.set(
          Math.cos(ma) * m.a,
          Math.sin(ma * 0.7) * m.a * 0.12 * Math.cos(m.incl ?? 0) + Math.sin(ma) * m.a * Math.sin(m.incl ?? 0),
          Math.sin(ma) * m.a * Math.cos(m.incl ?? 0),
        );
      });

      /* orbit ring — driven ONLY by hover, exactly like the home system */
      if (p.orbitLine) {
        const op = p.hoverT * 0.22;
        (p.orbitLine.material as THREE.LineBasicMaterial).opacity = op;
        p.orbitLine.visible = op > 0.01;
      }

      /* the streak ring — alive whenever this world has been written on */
      if (p.streakRing) {
        const mat = p.streakRing.material as THREE.MeshBasicMaterial;
        const st = p.streakTarget ?? 0;
        const days = p.streakDays ?? 0;
        const target = days > 0 ? Math.min(0.95, 0.22 + 0.16 * st + 0.02 * days) : 0;
        mat.opacity += (target - mat.opacity) * Math.min(1, dt * 3.5);
        const breath = 1 + 0.022 * Math.sin(this.clockT * 1.8 + p.data.id.length);
        p.streakRing.scale.setScalar(breath);
        p.streakRing.visible = mat.opacity > 0.02;
      }
    }

    /* the belt — slow revolution + tumbling rocks; the dust keeps the home
       belt's designed screen size by keying uScale on the star distance
       (the camLen-based driver would blow the points up from this far out) */
    sys.belt.rotation.y = this.simDays * 0.0016;
    sys.beltInst.forEach(({ mesh, tumbles }) => {
      for (let k = 0; k < tumbles.length; k++) {
        const t = tumbles[k];
        t.q.multiply(this._rockQ.setFromAxisAngle(t.axis, t.speed * dt));
        this._rockM.compose(t.pos, t.q, t.scale);
        mesh.setMatrixAt(k, this._rockM);
      }
      mesh.instanceMatrix.needsUpdate = true;
    });
    sys.beltDustMat.uniforms.uScale.value = Math.max(1, nodeDist) / 90;
    sys.beltDustMat.uniforms.uOpacity.value = 1 - smoothstep(500, 1400, nodeDist);
  }

  /** THE GALAXY CLUSTER / GROUP STAGE — hundreds to thousands of galaxies
      bound by gravity: ~1,000 oriented galaxy smudges in clumped sub-halos,
      glowing hot intracluster gas (tinted by the active reality) and thin
      gravitational lensing arcs bending around the core. */
  private buildClusterStage() {
    const R = Math.random;
    while (this.gCluster.children.length > 0) this.gCluster.remove(this.gCluster.children[0]);
    this.clusterGasMats = [];

    /* 1) the member-galaxy field — each smudge is a tiny oriented elliptical
          haze of a dozen points: warm ellipticals, blue spirals, a few
          luminous giants, clustered in one core + three sub-halos */
    const SMUDGES = 1000, PER = 10;
    const clumps: [number, number, number, number][] = [
      [0, 0, 0, 15000],
      [26000, -7000, 13000, 17000],
      [-24000, 9000, -15000, 15000],
      [9000, 14000, -29000, 13000],
    ];
    const cx = new Float32Array(SMUDGES), cy = new Float32Array(SMUDGES), cz = new Float32Array(SMUDGES);
    const ax = new Float32Array(SMUDGES), bx = new Float32Array(SMUDGES);
    const rot = new Float32Array(SMUDGES), tilt = new Float32Array(SMUDGES), kind = new Uint8Array(SMUDGES);
    for (let s = 0; s < SMUDGES; s++) {
      const cl = clumps[Math.min(clumps.length - 1, Math.floor(Math.pow(R(), 1.55) * clumps.length))];
      cx[s] = cl[0] + (R() + R() - 1) * cl[3];
      cy[s] = cl[1] + (R() + R() - 1) * cl[3] * 0.7;
      cz[s] = cl[2] + (R() + R() - 1) * cl[3];
      const a = 90 + Math.pow(R(), 1.6) * 260;
      ax[s] = a;
      bx[s] = a * (0.35 + R() * 0.4);
      rot[s] = R() * Math.PI;
      tilt[s] = (R() - 0.5) * 1.0;
      const w = R();
      kind[s] = w > 0.94 ? 2 : w > 0.6 ? 1 : 0;
    }
    const field = this.makePoints(
      SMUDGES * PER,
      (i, a) => {
        const s = Math.floor(i / PER), j = i % PER;
        const ang = (j / PER) * Math.PI * 2 + hash(s, 7) * 6.2831;
        const wob = 0.72 + hash(s, 13) * 0.55;
        const ex = Math.cos(ang) * ax[s] * wob;
        const ey = Math.sin(ang) * bx[s] * wob;
        const ux = Math.cos(rot[s]), uz = Math.sin(rot[s]);
        const vx = -Math.sin(rot[s]) * Math.sin(tilt[s]), vy = Math.cos(tilt[s]), vz = Math.cos(rot[s]) * Math.sin(tilt[s]);
        a[i * 3] = cx[s] + ex * ux + ey * vx;
        a[i * 3 + 1] = cy[s] + ey * vy;
        a[i * 3 + 2] = cz[s] + ex * uz + ey * vz;
      },
      (i) => { const s = Math.floor(i / PER); return kind[s] === 2 ? 1.4 + R() * 1.6 : 0.6 + R() * 1.1; },
      (i) => { const s = Math.floor(i / PER); return kind[s] === 2 ? [1, 1, 1] : kind[s] === 1 ? [0.72, 0.82, 1] : [1, 0.88, 0.72]; },
      () => 0.3 + R() * 0.5,
      1.6,
      false,
    );
    this.gCluster.add(field);

    /* foreground star sprinkle */
    const stars = this.makePoints(
      600,
      (i, a) => {
        const r = 26000 + R() * 52000, t = R() * Math.PI * 2, p = Math.acos(2 * R() - 1);
        a[i * 3] = r * Math.sin(p) * Math.cos(t); a[i * 3 + 1] = r * Math.cos(p) * 0.6; a[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
      },
      () => 0.4 + R() * 0.8,
      () => [0.85, 0.9, 1],
      () => 0.2 + R() * 0.4,
      1.2,
      false, true,
    );
    this.gCluster.add(stars);

    /* 2) hot intracluster gas — huge soft X-ray glows; tinted to the active
          reality's secondary color in setReality() */
    const gasTex = makeGlowTexture(256, [
      [0, 'rgba(255,255,255,0.9)'],
      [0.35, 'rgba(255,255,255,0.28)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
    const gasDefs: [number, number, number, number, string, number][] = [
      [0, 0, 0, 72000, '#ff5e8a', 0.10],
      [20000, -5000, 8000, 46000, '#b46bff', 0.085],
      [-17000, 7000, -13000, 40000, '#ff8ab0', 0.075],
      [0, 0, 0, 15000, '#ffe1ee', 0.32],
    ];
    gasDefs.forEach(([gx, gy, gz, scale, color, opacity]) => {
      const mat = new THREE.SpriteMaterial({
        map: gasTex, color: new THREE.Color(color), transparent: true, opacity,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      mat.userData.baseColor = new THREE.Color(color);
      const sp = new THREE.Sprite(mat);
      sp.position.set(gx, gy, gz);
      sp.scale.setScalar(scale);
      this.gCluster.add(sp);
      this.clusterGasMats.push(mat);
    });

    /* 3) gravitational lensing arcs — thin light-bending curves around the
          core (two brighter hero arcs, ten faint background arcs) */
    for (let k = 0; k < 12; k++) {
      const rr = 5200 + R() * 15000;
      const span = k < 2 ? 1.5 + R() * 0.5 : 0.5 + R() * 1.1;
      const segs = 48;
      const arcPts: number[] = [];
      for (let sgi = 0; sgi <= segs; sgi++) {
        const a2 = (sgi / segs) * span;
        arcPts.push(Math.cos(a2) * rr, Math.sin(a2) * rr * 0.24, 0);
      }
      const ag = new THREE.BufferGeometry();
      ag.setAttribute('position', new THREE.Float32BufferAttribute(arcPts, 3));
      const am = new THREE.LineBasicMaterial({
        color: new THREE.Color('#9fdcff'),
        transparent: true,
        opacity: k < 2 ? 0.42 : 0.16 + R() * 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const arc = new THREE.Line(ag, am);
      arc.position.set((R() - 0.5) * 8000, (R() - 0.5) * 5000, (R() - 0.5) * 8000);
      arc.rotation.set(R() * Math.PI, R() * Math.PI, R() * Math.PI);
      this.gCluster.add(arc);
    }
  }

  /** THE MARBLE — one glowing glass sphere with a universe coiled inside,
      placed on the boot view axis. The camera falls straight through it. */
  private buildIntroMarble() {
    const g = new THREE.Group();

    /* glass shell */
    const glass = new THREE.Mesh(
      new THREE.SphereGeometry(14, 48, 32),
      new THREE.ShaderMaterial({
        uniforms: {
          uFade: { value: 1 }, uTime: { value: 0 },
          uColorA: { value: new THREE.Color('#38bdf8') }, uColorB: { value: new THREE.Color('#8b5cf6') },
        },
        vertexShader: `
          varying vec3 vN; varying vec3 vV;
          void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `
          uniform float uFade; uniform float uTime; uniform vec3 uColorA; uniform vec3 uColorB;
          varying vec3 vN; varying vec3 vV;
          void main(){
            vec3 N = normalize(vN); vec3 V = normalize(vV);
            float fr = pow(1.0 - abs(dot(N, V)), 1.9);
            float shimmer = 0.5 + 0.5 * sin(N.y * 5.0 + uTime * 0.8);
            vec3 rim = mix(uColorA, uColorB, 0.35 + 0.3 * shimmer);
            gl_FragColor = vec4(rim * fr * 2.6, min(1.0, fr * 1.5 + 0.05) * uFade);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
    g.add(glass);
    this.introMarbleMats.push(glass.material as THREE.ShaderMaterial);

    /* the universe coiled inside — a miniature spiral */
    const N = 240;
    const pos = new Float32Array(N * 3), siz = new Float32Array(N), col = new Float32Array(N * 3);
    const rr = Math.random;
    for (let i = 0; i < N; i++) {
      const arm = i % 3;
      const rad = Math.pow(rr(), 0.6) * 9.5;
      const ang = (arm / 3) * Math.PI * 2 + rad * 0.09 + (rr() - 0.5) * 0.5;
      pos[i * 3] = Math.cos(ang) * rad + (rr() - 0.5) * 1.6;
      pos[i * 3 + 1] = (rr() - 0.5) * 1.8;
      pos[i * 3 + 2] = Math.sin(ang) * rad + (rr() - 0.5) * 1.6;
      siz[i] = 0.5 + rr() * 0.7;
      const w = rr();
      const c = w > 0.82 ? [1, 1, 1] : w > 0.45 ? [0.55, 0.78, 1] : [0.66, 0.5, 1];
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    sg.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    const spiralMat = new THREE.ShaderMaterial({
      uniforms: { uFade: { value: 1 }, uTime: { value: 0 }, uOpacity: { value: 1 } },
      vertexShader: `
        attribute float aSize; attribute vec3 aColor;
        uniform float uTime; varying vec3 vC; varying float vA;
        void main(){
          vC = aColor;
          vA = 0.55 + 0.45 * sin(uTime * 2.0 + position.x * 5.0);
          vec3 p = position;
          float a = uTime * 0.12;
          p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz; /* the coil slowly turns */
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = clamp(300.0 / max(-mv.z, 0.001), 1.5, 6.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float uFade; uniform float uOpacity; varying vec3 vC; varying float vA;
        void main(){
          vec2 c = gl_PointCoord - 0.5; float d = length(c);
          if (d > 0.49) discard;
          gl_FragColor = vec4(vC, (exp(-d * d * 28.0) * 0.9 + 0.08) * vA * uFade * uOpacity);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    g.add(new THREE.Points(sg, spiralMat));
    this.introMarbleMats.push(spiralMat);

    /* the blazing heart + the glass silhouette */
    const glowTex = makeGlowTexture(128, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
    const core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: new THREE.Color('#bfe3ff'), blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: 0.9,
    }));
    core.scale.setScalar(11);
    g.add(core);
    this.introMarbleSprites.push(core.material as THREE.SpriteMaterial);
    if (!this.marbleRingTex) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 256;
      const g2 = cv.getContext('2d')!;
      g2.strokeStyle = 'rgba(255,255,255,0.95)';
      g2.lineWidth = 10; g2.shadowColor = 'rgba(255,255,255,0.8)'; g2.shadowBlur = 14;
      g2.beginPath(); g2.arc(128, 128, 108, 0, Math.PI * 2); g2.stroke();
      this.marbleRingTex = new THREE.CanvasTexture(cv);
    }
    const ring = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.marbleRingTex, color: new THREE.Color('#8ab6ff'), blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: 0.5,
    }));
    ring.scale.setScalar(34);
    g.add(ring);
    this.introMarbleSprites.push(ring.material as THREE.SpriteMaterial);

    g.visible = false;
    this.introMarble = g;
    this.scene.add(g);
  }

  private buildSurface() {
    const geo = new THREE.PlaneGeometry(90, 90, 140, 140);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = cpuFbm(x * 0.055 + 3.1, z * 0.055 + 7.7) * 2.4 + cpuFbm(x * 0.19, z * 0.19) * 0.55;
      const curv = (x * x + z * z) / 2.05;
      pos.setY(i, 1 + h * 0.32 - curv * 0.011);
    }
    geo.computeVertexNormals();
    this.surfaceMat = new THREE.ShaderMaterial({
      uniforms: {
        uDeep: { value: new THREE.Color('#0b2d4d') }, uBase: { value: new THREE.Color('#1f6e52') },
        uHigh: { value: new THREE.Color('#9db88a') }, uIce: { value: new THREE.Color('#eef6ff') },
        uSunDir: { value: new THREE.Vector3(1, 0.2, 0) }, uFog: { value: new THREE.Color('#7fc4e8') },
        uFogDensity: { value: 0.02 },
      },
      vertexShader: terrainVert, fragmentShader: terrainFrag,
    });
    const terrain = new THREE.Mesh(geo, this.surfaceMat);
    this.surface.add(terrain);

    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uZenith: { value: new THREE.Color('#0a1e38') }, uHorizon: { value: new THREE.Color('#7fc4e8') },
        uSunDir: { value: new THREE.Vector3(1, 0.2, 0) },
      },
      vertexShader: `varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW,1.0); }`,
      fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 20), this.skyMat);
    this.surface.add(sky);

    const R = Math.random;
    const parts = this.makePoints(
      320,
      (i, a) => { a[i * 3] = (R() - 0.5) * 60; a[i * 3 + 1] = 1 + R() * 7; a[i * 3 + 2] = (R() - 0.5) * 60; },
      () => 0.35 + R() * 0.6, () => [0.85, 0.92, 1] as [number, number, number], () => 0.25 + R() * 0.4, 1.1, true,
    );
    this.surfaceParticlesMat = parts.material as THREE.ShaderMaterial;
    this.surface.add(parts);

    this.surface.visible = false;
    this.scene.add(this.surface);
  }

  /* ------------------------------ interaction ----------------------------- */

  private bindEvents() {
    /* the canvas owns its own pointer stream — immune to overlays & touch scrolling.
       Orbit / pan / zoom physics live in the CameraRig; this file only keeps
       pointer bookkeeping for picking & click detection. */
    this.canvas.style.touchAction = 'none';
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerCancel);
    this.canvas.addEventListener('dblclick', this.onDoubleClick);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  private onPointerDown = (e: PointerEvent) => {
    this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    /* R68 touch — the tap's hover card must position at the TAP point
       (a finger often never produces a pointermove) */
    this.mouseScreenX = e.clientX;
    this.mouseScreenY = e.clientY;
    this.pointerMoved = true;
    /* R68 touch bookkeeping — a second finger hands the gesture to the
       rig's own pinch/pan pair; the pointer stream must not double-drive */
    if (e.pointerType === 'touch') {
      this.touchCount += 1;
      if (this.touchCount === 1) {
        this.twoFingerSession = false;
        this.armLongPress(e);
      } else {
        this.twoFingerSession = true;
        this.disarmLongPress();
        if (this.clickTimer) { clearTimeout(this.clickTimer); this.clickTimer = null; }
        if (this.dragging) { this.dragging = false; this.rig.endDrag(); }
      }
    }
    /* R69 — THE ORBIT IS RESTORED. The traveler's verdict: swinging the
       camera's ANGLE is how a hidden hole is found (0° → 30° → 270°) —
       rotation is a first-class gesture EVERYWHERE, never orphaned over
       empty space. So plain left-drag orbits again (the pre-R68 behavior);
       the glide survives as its joined partner on Ctrl+drag, and
       middle/right/Shift still pan. Move, turn, glide — all first-class. */
    const pan = e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey);
    const glide = e.button === 0 && !pan && e.ctrlKey;
    const orbit = !pan && !glide;
    if (e.button === 0 || pan) {
      try { this.canvas.setPointerCapture(e.pointerId); } catch { /* capture unsupported */ }
      this.dragging = true;
      this.rig.beginDrag(pan, orbit); /* pan (explicit), orbit (default), or glide (Ctrl) */
      this.lastPX = e.clientX; this.lastPY = e.clientY;
      this.downX = e.clientX; this.downY = e.clientY; this.downT = performance.now();
    }
  };

  /* R68 — touch gesture bookkeeping */
  private touchCount = 0;
  private twoFingerSession = false;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressStart = { x: 0, y: 0 };

  private armLongPress(e: PointerEvent) {
    this.disarmLongPress();
    this.longPressStart = { x: e.clientX, y: e.clientY };
    this.longPressTimer = setTimeout(() => {
      this.longPressTimer = null;
      /* a held finger over an object is a right-click: the context menu */
      const id = this.pick();
      if (id) this.cb.onContext(id, this.longPressStart.x, this.longPressStart.y);
    }, 550);
  }
  private disarmLongPress() {
    if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; }
  }

  private onPointerMove = (e: PointerEvent) => {
    this.mouseScreenX = e.clientX;
    this.mouseScreenY = e.clientY;
    /* R68 touch — with two fingers down the rig's own pinch/pan pair owns
       the gesture; the per-finger pointer stream stands down */
    const twoFingerTouch = e.pointerType === 'touch' && this.touchCount > 1;
    if (!twoFingerTouch) {
      if (this.dragging) {
        const dx = e.clientX - this.lastPX, dy = e.clientY - this.lastPY;
        this.rig.dragMove(dx, dy);
        this.lastPX = e.clientX; this.lastPY = e.clientY;
        if (this.longPressTimer && Math.hypot(e.clientX - this.longPressStart.x, e.clientY - this.longPressStart.y) > 12) {
          this.disarmLongPress();
        }
      }
    }
    this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    this.pointerMoved = true;
  };

  private finishPointerDrag(e: PointerEvent, allowClick: boolean) {
    /* R68 touch — a lifted finger of a multi-finger gesture never clicks;
       the last finger up just closes the session */
    if (e.pointerType === 'touch') {
      this.touchCount = Math.max(0, this.touchCount - 1);
      this.disarmLongPress();
      if (this.touchCount > 0 || this.twoFingerSession) {
        if (this.touchCount === 0) this.twoFingerSession = false;
        if (this.dragging) { this.dragging = false; this.rig.endDrag(); }
        return;
      }
    }
    if (!this.dragging) return;
    this.dragging = false;
    this.rig.endDrag();
    try { this.canvas.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    const moved = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
    if (allowClick && moved < 12 && performance.now() - this.downT < 600 && (e.button === 0 || e.pointerType === 'touch')) {
      this.handleClick(e.pointerType === 'touch');
    }
  }

  private onPointerUp = (e: PointerEvent) => {
    this.finishPointerDrag(e, true);
  };

  private onPointerCancel = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      this.touchCount = Math.max(0, this.touchCount - 1);
      this.disarmLongPress();
    }
    this.finishPointerDrag(e, false);
  };

  private onDoubleClick = (e: MouseEvent) => {
    e.preventDefault();
    // Double clicks are handled with precise single/double click discrimination in handleClick()
  };

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    /* a right-drag is a pan, not a menu request */
    if (Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > 8) return;
    const id = this.pick();
    if (id) this.cb.onContext(id, e.clientX, e.clientY);
  };
  private mouseScreenX = 0;
  private mouseScreenY = 0;

  /** R68 — resolve a screen ray to a world point for the cursor-anchored
      dive. Object wins (body / galaxy / cluster / reality bubble), otherwise
      a bounded point down the ray: min(rayLen·0.6, aim reach) from the
      camera, clamped inside the stage's exploration bubble so empty-space
      dives land INSIDE the structure you are exploring. */
  private resolveAimPoint = (ndcX: number, ndcY: number, out: THREE.Vector3): boolean => {
    this._vScratch4.set(ndcX, ndcY, 0.5).unproject(this.camera);
    const dir = this._vScratch4.sub(this.camera.position).normalize();
    this.raycaster.set(this.camera.position, dir);
    const d = this.currentDist();
    /* object hit first — mirrors pick()'s stage branches with cheap colliders */
    if (this.cosmicStage === 'multiverse' && this.gMultiverse?.visible) {
      this.raycaster.far = 5000000;
      const hits = this.raycaster.intersectObjects(this.multiverseColliders, false);
      if (hits.length > 0) { out.copy(hits[0].point); return true; }
    } else if (d <= 1400) {
      this.raycaster.far = d * 3 + 120;
      const list = this.innerColliderList.length > 0 ? this.colliderList.concat(this.innerColliderList) : this.colliderList;
      const hits = this.raycaster.intersectObjects(list, false);
      if (hits.length > 0) { out.copy(hits[0].point); return true; }
    } else if (this.cosmicStage === 'web' && d < 120000 && this.galaxyStageColliders.length) {
      this.raycaster.far = d * 4 + 6000;
      const hits = this.raycaster.intersectObjects(this.galaxyStageColliders, false);
      if (hits.length > 0) { out.copy(hits[0].point); return true; }
    }
    /* empty field — walk the ray a bounded step from the camera */
    const reach = d * 0.85;
    out.copy(this.camera.position).addScaledVector(dir, reach);
    return true;
  };

  private pick(): string | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const d = this.currentDist();

    // Multiverse stage ONLY — the Astral Core, reality bubbles and their
    // orbiting major galaxies are interactive in the multiverse stage
    if (this.cosmicStage === 'multiverse' && this.gMultiverse && this.gMultiverse.visible) {
      this.raycaster.far = 5000000;
      const visibleColliders = this.multiverseColliders;
      const hits = this.raycaster.intersectObjects(visibleColliders, false);
      if (hits.length > 0) {
        // Priority 1: Check if Astral Core is intersected
        const coreHit = hits.find((h) => h.object.userData.isMultiverseCore || h.object.userData.id === 'multiverse-core');
        if (coreHit && hits[0] === coreHit) {
          return 'multiverse-core';
        }
        const u = hits[0].object.userData;
        if (u.isMultiverseCore || u.id === 'multiverse-core') {
          return 'multiverse-core';
        }
        if (u.isGalaxy && u.galaxyData) {
          return `galaxy:${u.galaxyData.id}:${u.realityId}`;
        }
        if (u.isGalaxyCluster && u.clusterData) {
          return `cluster:${u.clusterData.id}:${u.realityId}`;
        }
        if (u.isRealityBubble && u.realityId) {
          return `reality:${u.realityId}`;
        }
        if (coreHit) {
          return 'multiverse-core';
        }
      }
      return null;
    }

    // Inside a reality at stellar system scale (d <= 1400) — pick local planets and moons,
    // plus the worlds of any isolated inner stellar system you're diving in
    if (d <= 1400) {
      this.raycaster.far = d * 3 + 120;
      /* echo meteors first — a memory streak outranks the empty space it crosses */
      const echoId = this.pickEcho();
      if (echoId) return `echo:${echoId}`;
      const list = this.innerColliderList.length > 0 ? this.colliderList.concat(this.innerColliderList) : this.colliderList;
      const hits = this.raycaster.intersectObjects(list, false);
      for (const h of hits) {
        /* Raycaster does not discard an object whose ancestor is hidden. Inner
           systems for every galaxy share one collider list, so reject stale
           colliders from galaxies that are not currently visible. */
        let visible = true;
        for (let obj: THREE.Object3D | null = h.object; obj; obj = obj.parent) {
          if (!obj.visible) { visible = false; break; }
        }
        if (!visible) continue;
        const id = h.object.userData.bodyId as string;
        if (h.object.userData.isInner) return id;
        const b = this.bodies.find((x) => x.data.id === id);
        if (b && b.ghost > 0.6) continue;
        return id;
      }
      return null;
    }

    // GALAXY STAGE (web side) — the active reality's major galaxies are
    // hoverable / clickable right in the field. Window opens right above the
    // local-body range so a traveler inside one galaxy can still click their
    // way into a neighboring one without a dead zone.
    if (this.cosmicStage === 'web' && d > 1400 && d < 120000 && this.galaxyStageColliders.length) {
      this.raycaster.far = d * 4 + 6000;
      const hits = this.raycaster.intersectObjects(this.galaxyStageColliders, false);
      if (hits.length > 0) {
        const u = hits[0].object.userData;
        if (u.isGalaxy && u.galaxyData) {
          return `galaxy:${u.galaxyData.id}:${u.realityId}`;
        }
      }
    }
    return null;
  }

  /** R68 — THE TOUCH GRAMMAR: a tap behaves like hover first — it raises
      the object's card without acting (the mouse has hover; the finger has
      no hover, so the FIRST tap is its hover). A second tap on the same
      object inside the window acts (the click). Select/deselect state is
      restored on the acting tap so the click path plays exactly as a
      mouse click would. */
  private touchInspectId: string | null = null;
  private touchInspectT = 0;
  private static readonly TOUCH_INSPECT_WINDOW = 1600; /* ms */

  private handleClick(isTouch = false) {
    if (isTouch) {
      const id = this.pick();
      const now = performance.now();
      const same = id && id === this.touchInspectId && now - this.touchInspectT < UniverseEngine.TOUCH_INSPECT_WINDOW;
      this.touchInspectId = same ? null : id;
      this.touchInspectT = now;
      if (!same) {
        if (id) {
          /* the inspect tap — act as hover so the card rises; no selection,
             no action (the canvas cursor path also refreshes the cursor) */
          this.hoveredId = id;
          this.cb.onHover(id, this.mouseScreenX, this.mouseScreenY);
        } else {
          /* a tap on empty space dismisses any raised card */
          this.hoveredId = null;
          this.cb.onHover(null);
        }
        return;
      }
      /* the acting tap — clear the inspect state; the selection path below
         re-derives the hover state naturally */
      this.hoveredId = null;
      this.cb.onHover(null);
    }
    const id = this.pick();
    /* THE COSMIC ECHO — clicking a memory meteor reopens its page */
    if (id && id.startsWith('echo:')) {
      const entryId = id.slice(5);
      const echo = this.echoMeteors.find((m) => m.entryId === entryId);
      if (echo) {
        this.selectedId = null;
        this.cb.onEchoOpen?.(echo.entryId, echo.planetId, echo.title);
      }
      return;
    }
    /* THE ASTRAL CORE — one click opens the Multiverse Core Console */
    if (id === 'multiverse-core') {
      if (this.cb.onSelectCore) this.cb.onSelectCore();
      else this.cb.onActivate('multiverse-core');
      return;
    }
    if (id && id.startsWith('cluster:')) {
      const parts = id.split(':');
      const clusterId = parts[1];
      const realityId = parts[2];
      const reality = REALITIES.find((r) => r.id === realityId);
      const cluster = reality?.clusters?.find((c) => c.id === clusterId);
      if (cluster && this.cb.onSelectCluster) {
        this.cb.onSelectCluster(cluster);
      }
      return;
    }
    if (id && id.startsWith('galaxy:')) {
      const parts = id.split(':');
      const galaxyId = parts[1];
      const realityId = parts.slice(2).join(':');
      /* EVERY click on a galaxy dives — single or double, no timers, no
         editor ambiguity. (Double-clicking used to open the editor instead
         of entering, which read as "can't enter any galaxy".) Editing runs
         through the hover card's Edit button and the console. */
      if (this.cb.onSelectGalaxy) this.cb.onSelectGalaxy(galaxyId, realityId);
      return;
    }
    if (id && id.startsWith('reality:')) {
      const realityId = id.replace('reality:', '');
      const t = performance.now();
      if (t - this.lastClickT < 360 && id === this.lastClickId) {
        if (this.clickTimer) { clearTimeout(this.clickTimer); this.clickTimer = null; }
        this.lastClickT = 0;
        if (this.cb.onDoubleClickReality) {
          this.cb.onDoubleClickReality(realityId);
        }
        return;
      }
      this.lastClickT = t;
      this.lastClickId = id;
      if (this.clickTimer) clearTimeout(this.clickTimer);
      this.clickTimer = setTimeout(() => {
        if (this.cb.onSelectReality) {
          this.cb.onSelectReality(realityId);
        }
        this.clickTimer = null;
      }, 350);
      return;
    }
    /* a world inside an isolated inner stellar system — REAL and interactive.
       Single click selects + orbits it; double click ENTERS it (diary) or,
       for the system's star, opens the control panel — the home grammar. */
    if (id && id.startsWith('inner:')) {
      const t = performance.now();
      if (t - this.lastClickT < 330 && id === this.lastClickId) {
        if (this.clickTimer) { clearTimeout(this.clickTimer); this.clickTimer = null; }
        this.lastClickT = 0;
        this.activateInner(id);
        return;
      }
      this.lastClickT = t;
      this.lastClickId = id;
      if (this.clickTimer) clearTimeout(this.clickTimer);
      this.clickTimer = setTimeout(() => {
        this.selectInnerWorld(id);
        this.clickTimer = null;
      }, 340);
      return;
    }
    const t = performance.now();
    if (t - this.lastClickT < 330 && id === this.lastClickId) {
      if (this.clickTimer) { clearTimeout(this.clickTimer); this.clickTimer = null; }
      this.lastClickT = 0;
      this.activate(id);
      return;
    }
    this.lastClickT = t;
    this.lastClickId = id;
    if (this.clickTimer) clearTimeout(this.clickTimer);
      this.clickTimer = setTimeout(() => {
        /* clicking the BACKGROUND hands the orbit back to the reality’s center: whatever it was orbiting — a cosmic body, a galaxy — is released */
        if (id === null && this.cosmicStage === 'web') {
          if (this.innerFocusBodyId) {
            this.releaseInnerWorld();
          } else if (this.galaxyInnerFocus) {
            this.galaxyInnerFocus = false;
            this.rig.setZoomTarget(0.668);
          } else {
            this.focusId = null;
            this.galaxyFocusId = null;
          }
        }
        this.selectedId = id;
        this.cb.onSelect(id);
        this.clickTimer = null;
      }, 340);
  }

  private activate(id: string | null) {
    if (!id) {
      /* background click — release the focus, orbit the reality’s center */
      if (this.cosmicStage === 'web') {
        if (this.innerFocusBodyId) {
          this.releaseInnerWorld();
        } else if (this.galaxyInnerFocus) {
          this.galaxyInnerFocus = false;
          this.rig.setZoomTarget(0.668);
        } else {
          this.focusId = null;
          this.galaxyFocusId = null;
        }
      }
      this.cb.onSelect(null);
      return;
    }
    if (id === 'demon-core') {
      if (this.cb.onSelectDemonCore) {
        this.cb.onSelectDemonCore();
      } else {
        this.cb.onActivate('demon-core');
      }
      return;
    }
    const b = this.bodies.find((x) => x.data.id === id);
    if (id === 'anchor') {
      this.selectedId = id;
      this.cb.onActivate('anchor');
      return;
    }
    if (!b) return;
    this.selectedId = id;
    this.beginPortal(b);
  }

  /* ------------------------------ camera/api ------------------------------ */

  private currentDist(): number {
    return this.rig.dist();
  }
  private focusBody(): RuntimeBody | null {
    return this.focusId ? this.bodies.find((b) => b.data.id === this.focusId) ?? null : null;
  }



  /** KAMUI SUMMON — the red space-time tear plays while the stage folds:
      the tear owns the screen, the stage flips behind it, and the dial eases
      to the arrival framing so the traveler lands in the other stage. */
  private beginStageWarp(dir: 'toMultiverse' | 'toWeb', arrivalDial: number, _after?: () => void): void {
    this.grabCooldown = 1.4;
    this.rig.killZoomMomentum();
    this.triggerKamui(undefined, dir === 'toWeb'); /* out = summon, back = eject */
    this.cosmicStage = dir === 'toMultiverse' ? 'multiverse' : 'web';
    if (dir === 'toWeb') this.realityFocused = false;
    this.rig.setZoomTarget(arrivalDial);
    if (_after) _after();
  }


  resetView() {
    this.cancelGalaxyDive();
    this.focusId = null;
    this.realityFocused = false;
    this.activeGalaxyName = null;
    this.galaxyFocusId = null;
    this.innerFocusBodyId = null;
    /* ROUND 61 — the default view is reachable again: reset also FORGETS the
       saved placement, so the boot default stays the view instead of the old
       one snapping back on the next open. */
    clearCameraMemory();
    this._camMemLast = null;
    if (this.cosmicStage === 'multiverse') {
      this.beginStageWarp('toWeb', 0.15, () => {
        this.rig.setOrbit(null, 1.12);
        this.rig.clearPan();
      });
      return;
    }
    this.cosmicStage = 'web';
    this.rig.setZoomTarget(0.15);
    this.rig.setOrbit(null, 1.12);
    this.rig.clearPan();
  }
  zoomToMultiverse() {
    this.cancelGalaxyDive();
    this.focusId = null;
    this.realityFocused = false;
    this.activeGalaxyName = null;
    this.galaxyFocusId = null;
    if (this.cosmicStage === 'web') {
      this.realityFocused = true;
      this.beginStageWarp('toMultiverse', this.activeReality ? CameraRig.zoomTOf(this.activeReality.bubbleSize * 5.5) : REALITY_FLOOR, () => {
        this.rig.setOrbit(null, 1.05);
      });
      return;
    }
    this.cosmicStage = 'multiverse';
    this.realityFocused = true;
    this.rig.setOrbit(null, 1.05);
    this.rig.setZoomTarget(this.activeReality ? CameraRig.zoomTOf(this.activeReality.bubbleSize * 5.5) : REALITY_FLOOR);
  }
  zoomToSystem() {
    this.cancelGalaxyDive();
    this.focusId = null;
    this.realityFocused = false;
    this.activeGalaxyName = null;
    this.galaxyFocusId = null;
    if (this.cosmicStage === 'multiverse') {
      this.beginStageWarp('toWeb', 0.15, () => {
        this.rig.setOrbit(null, 1.12);
        this.rig.clearPan();
      });
      return;
    }
    this.cosmicStage = 'web';
    this.rig.setZoomTarget(0.15);
    this.rig.setOrbit(null, 1.12);
    this.rig.clearPan();
  }
  zoomToHierarchy(stageIndex: number) {
    this.cancelGalaxyDive();
    this.focusId = null;
    this.rig.clearPan();
    if (stageIndex <= 2 || stageIndex > 6) { this.activeGalaxyName = null; this.galaxyFocusId = null; } /* outside the galaxy's domain */
    if (stageIndex === 0) { this.zoomToMultiverse(); return; }
    if (stageIndex === 1) { // Reality / Universe — multiverse side
      if (this.cosmicStage === 'web') {
        this.realityFocused = false;
        this.beginStageWarp('toMultiverse', 0.88, () => {
          this.rig.setOrbit(null, 1.05);
        });
        return;
      }
      this.cosmicStage = 'multiverse';
      this.realityFocused = false;
      this.rig.setZoomTarget(0.88);
      this.rig.setOrbit(null, 1.05);
      return;
    }
    // stages 2..10 — cosmic web side. Dials live in the shared stage table
    // (src/realities/hierarchyStages.ts), calibrated against the scale-label
    // distance windows (dist = 3 · 800000^zoomT) so each stage LANDS inside
    // its own label band.
    const dial = HIERARCHY_DIALS[stageIndex] ?? 0.15;
    const phi = stageIndex === 6 ? 1.08 : stageIndex <= 8 ? 1.1 : 1.12;
    if (this.galaxyInnerFocus && stageIndex >= 7) return; /* inside an isolated system — the origin-based ladder does not apply */
    if (this.cosmicStage === 'multiverse') {
      this.beginStageWarp('toWeb', dial, () => {
        this.rig.setOrbit(null, phi);
      });
      return;
    }
    this.cosmicStage = 'web';
    this.realityFocused = false;
    this.rig.setZoomTarget(dial);
    this.rig.setOrbit(null, phi);
  }
  /** KAMUI JUMP — long-range teleportation: the view tears open where the
      traveler stands, the throat carries them across the fold, and the
      white-hole ejects at the destination framing. Distance is irrelevant —
      this is the short-range jutsu turned inside out (Kakashi's long-range
      Kamui, aimed at yourself). */
  jumpTo(id: string): boolean {
    if (this.kamuiTimer > 0 || this.portal.phase !== 'idle' || this.bootIntro) return false;
    const galaxy = this.galaxyStageNodes.find((n) => n.data.id === id);
    const homeBody = this.bodies.find((b) => b.data.id === id);

    if (!galaxy && !homeBody) return false;
    this.grabCooldown = 1.4;
    this.rig.killZoomMomentum();
    this.triggerKamui();
    return true;
  }


  zoomIn(step = 0.12) {
    this.rig.nudgeZoom(-step);
  }
  zoomOut(step = 0.12) {
    this.rig.nudgeZoom(step);
  }
  focusOn(id: string) {
    if (id === 'anchor') { this.resetView(); return; }
    this.focusId = id;
    this.realityFocused = false;
    if (this.cosmicStage === 'multiverse') {
    if (this.cosmicStage === 'multiverse') { this.beginStageWarp('toWeb', 0.16); return; }
      this.rig.setZoomTarget(0.16);
      return;
    }
    this.rig.clearPan();
    /* ROUND 60 — the user's found composition (their 21:09 screenshot): the
       camera ~31° ABOVE the disk plane at ~56 rs — the disk reads as a tilted
       ellipse, the stellar belt sweeps around the hole, and the lensed wrap
       fills the frame. (The R53 near-edge-on angle hid this composition
       behind the disk's blaze.) zoomT: dist = 3 · 800000^z, 56 rs = 90.7
       world units → z = ln(90.7/3)/ln(800000) ≈ 0.25. Orbiting away is still
       free after the focus. */
    const target = this.bodies.find((x) => x.data.id === id);
    const geodesicHole = !!target && (target.data.kind === 'hole' || target.data.kind === 'vault')
      && !!(target.group.userData.bh as BlackHoleVisual | undefined)?.geodesic;
    if (geodesicHole) {
      this.rig.tPhi = 1.05;
      this.rig.setZoomTarget(0.25);
      return;
    }
    this.rig.setZoomTarget(Math.min(this.rig.tZoomT, 0.16));
  }
  enterCoreMode() {
    this.coreActive = true;
    this.focusId = null;
    this.realityFocused = false;
    if (this.cosmicStage === 'multiverse') { this.beginStageWarp('toWeb', 0.24); return; }
    this.rig.setZoomTarget(0.24);
  }
  exitCoreMode() {
    this.coreActive = false;
  }
  setPaused(p: boolean) { this.paused = p; }
  get pausedNow() { return this.paused; }
  setRendering(v: boolean) {
    this.rendering = v;
    this.surfaceManager?.getPhotoDome().setVisible(v);
  }

  /* THE SKY STUDIO — apply this reality's photo sky (its own assets folder
     on disk). Null spec = the pure procedural cosmos. Desktop fetches the
     registry itself so a device that never ran the web server still gets
     its skies. The crossfade + texture load run off the render loop. */
  async applyActiveSky(): Promise<void> {
    if (isDesktop()) {
      try {
        await ensureSkyFor(this.activeRealityId);
      } catch { /* keep whatever cache already holds */ }
    }
    this.activeSkySpec = getActiveSkySpec(this.activeRealityId);
    this.skyApplying = true;
    try {
      await this.surfaceManager.getPhotoDome().apply(
        this.activeSkySpec,
        this.activeReality?.starColor || '#38bdf8',
      );
    } finally {
      this.skyApplying = false;
    }
  }

  setTemporal(asOf: number | null) {
    this.bodies.forEach((b) => {
      const later = asOf !== null && b.data.createdAt > asOf;
      b.ghostTarget = later ? 1 : 0;
      b.fadeTarget = later ? 0 : 1; /* not yet formed → removed from this moment */
    });
  }

  beginPortal(b: { data: CosmicBody }) {
    if (this.portal.phase !== 'idle' || this.kamuiTimer > 0) return;

    const innerTarget = this.findInnerBody(b.data.id);
    this.portalTargetInnerId = innerTarget ? b.data.id : null;
    /* Snapshot the traveler's exact camera and framing BEFORE the zoom-in.
       On close, leavePortal() eases the dial straight back to this framing. */
    this.portalSavedCam = {
      rig: this.rig.snapshot(),
      focusId: this.focusId,
      galaxyFocusId: this.galaxyFocusId,
      galaxyInnerFocus: this.galaxyInnerFocus,
      innerFocusBodyId: this.innerFocusBodyId,
      realityFocused: this.realityFocused,
    };
    this.cosmicStage = 'web';
    this.portalWasInner = Boolean(innerTarget);
    this.portal = {
      phase: 'entering', t: 0, fired: false,
      kind: b.data.kind === 'vault' ? 'vault' : 'diary', bodyId: b.data.id,
    };
    /* any galaxy dive still driving the dial would keep steering the camera
       underneath the traversal — cancel it here. The inner-focus flag is
       view state the traveler already earned — the cancel must not strip it
       (an inner-world portal keeps orbiting that world). */
    const keepInnerFocus = this.galaxyInnerFocus;
    this.cancelGalaxyDive();
    this.galaxyInnerFocus = keepInnerFocus;
    this.rig.killZoomMomentum();
    this.grabCooldown = 0.8;
    /* THE PLAIN ZOOM — the camera dives in toward the world (the focus keeps
       it centered); the diary or vault opens when the zoom lands.

       CAMERA STABILITY — the focus change and the dive are WITHHELD for the
       length of the summon (portalHold, resolved in tick): the vortex plays
       against a frame that has not moved a pixel, and only once it has
       crested does the rig take the body and start the approach. The dial is
       pinned back at the pre-open framing so nothing can drift meanwhile. */
    this.portalFocusPending = true;
    this.portalPendingFocusId = innerTarget ? null : b.data.id;
    this.portalHold = KAMUI_ENTRY_HOLD;
    /* THE ARRIVAL SETTLE (R67) — the overlay fires at the throat now, so
       the dive runs BEHIND the live diary/vault: the rig eases 60% of the
       way and the overlay's entrance owns the last mile. The old full dial
       flew ~2s of empty unseen space after the swallow — the beat the
       traveler read as a processing freeze. */
    const settleDial = CameraRig.zoomTOf(Math.max(0.4, b.data.radius) * KAMUI_ENTRY_FRAMING);
    this.portalEnterDial = settleDial + (this.portalReturnDial - settleDial) * 0.4;
    this.portalReturnDial = this.portalSavedCam.rig.tZoomT;
    this.rig.setZoomTarget(this.portalReturnDial);
    /* KAMUI — fire the v1 vortex: the red tear plays around the Demon Core
       while the frame holds still (portalHold above); the dive then carries
       the traveler in and the overlay contract fires from onPortalPeak. */
    this.kamuiTearBodyId = b.data.id;
    this.triggerKamui();
  }
  leavePortal() {
    if (this.portal.phase === 'idle') return;
    this.portal.phase = 'leaving';
    this.portal.t = 0;
    this.portal.fired = false;
    /* THE RETURN TEAR — closing the diary/vault replays the jutsu mirrored:
       the vortex spins the other way and ejects the traveler back out while
       the camera eases to the pre-open framing (kamuiTearBodyId is still
       live, so the tear stays glued to the world being left). */
    this.triggerKamui(undefined, true);
    /* a close before the hold expired must not leave a dive armed */
    this.portalHold = 0;
    this.portalFocusPending = false;
    this.portalPendingFocusId = null;
    /* ease the camera back out to the traveler's pre-open framing */
    const saved = this.portalSavedCam;
    if (saved) {
      this.focusId = saved.focusId;
      this.galaxyFocusId = saved.galaxyFocusId;
      this.galaxyInnerFocus = saved.galaxyInnerFocus;
      this.innerFocusBodyId = saved.innerFocusBodyId;
      this.realityFocused = saved.realityFocused;
      this.rig.setZoomTarget(saved.rig.tZoomT);
      this.grabCooldown = Math.max(this.grabCooldown, 0.6);
    }
  }
  /* called once the destination overlay appears */
  finishEntry() {
    if (this.portal.phase === 'entering') this.portal.phase = 'open';
  }
  /* public entry used by Core Mode "open world" */
  portalTo(id: string) {
    const b = this.bodies.find((x) => x.data.id === id);
    if (b) {
      this.selectedId = id;
      this.beginPortal(b);
    }
  }

  /* ------------------------- dynamic structure ------------------------- */

  private moonGeo?: THREE.SphereGeometry;
  private moonMat?: THREE.MeshStandardMaterial;
  private lastEntries?: { planetId: string; createdAt: number; updatedAt: number }[];
  private static dayKey(t: number) { return Math.floor(t / 86400000); }
  private static streakOf(es: { createdAt: number; updatedAt: number }[]): number {
    if (!es.length) return 0;
    const days = new Set(es.map((e) => UniverseEngine.dayKey(Math.max(e.createdAt, e.updatedAt))));
    let cursor = UniverseEngine.dayKey(Date.now());
    if (!days.has(cursor)) cursor -= 1;
    if (!days.has(cursor)) return 0;
    let n = 0;
    while (days.has(cursor)) { n += 1; cursor -= 1; }
    return n;
  }
  private static daysOf(es: { createdAt: number; updatedAt: number }[]): number {
    return new Set(es.map((e) => UniverseEngine.dayKey(Math.max(e.createdAt, e.updatedAt)))).size;
  }

  /** One moon per diary page. Rebuilds moons so they always match the pages.
      Also drives each world's commitment ring — it brightens with your writing streak. */
  syncMoons(entries: { planetId: string; createdAt: number; updatedAt: number }[]) {
    this.lastEntries = entries;
    if (!this.moonGeo) this.moonGeo = new THREE.SphereGeometry(1, 22, 14);
    if (!this.moonMat) this.moonMat = new THREE.MeshStandardMaterial({ color: 0xa8a29a, roughness: 0.95, metalness: 0.02 });
    this.bodies.forEach((b) => {
      if (b.data.kind !== 'planet' && b.data.kind !== 'dwarf') return;
      const planetEntries = entries.filter((e) => e.planetId === b.data.id);

      /* the streak ring — a halo that remembers how regularly you write here.
         Thickness scales with the planet so it's actually visible. */
      if (!b.streakRing) {
        const rm = new THREE.Mesh(
          new THREE.TorusGeometry(b.data.radius * (b.data.rings ? 2.1 : 1.5), Math.max(0.02, b.data.radius * 0.011), 8, 128),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(b.data.palette.atmo), transparent: true, opacity: 0,
            blending: THREE.AdditiveBlending, depthWrite: false,
          }),
        );
        rm.rotation.x = Math.PI / 2 - 0.12;
        b.group.add(rm);
        b.streakRing = rm;
      }
      /* store the streak; the render loop animates brightness + breathing */
      b.streakTarget = UniverseEngine.streakOf(planetEntries);
      b.streakDays = UniverseEngine.daysOf(planetEntries);

      const count = Math.min(12, planetEntries.length);
      if (count === b.moons.length) return;
      b.moons.forEach((m) => b.group.remove(m.mesh));
      b.moons = [];
      for (let i = 0; i < count; i++) {
        const seed = hash(i + 1, b.data.id.length + 3);
        const mr = b.data.radius * (0.1 + 0.09 * seed);
        const mesh = new THREE.Mesh(this.moonGeo!, this.moonMat!);
        mesh.scale.setScalar(Math.max(0.09, mr));
        b.group.add(mesh);
        b.moons.push({
          mesh,
          a: b.data.radius * (1.75 + 0.55 * i) + (b.data.rings ? b.data.radius * 1.5 : 0),
          speed: (Math.PI * 2) / (14 + i * 8),
          phase: seed * 6.28,
          incl: 0.18 + seed * 0.3,
        });
      }
    });

    /* the isolated inner systems' worlds play by the same rules — a moon
       forms per diary page, the streak ring remembers devotion */
    for (const node of this.galaxyStageNodes) {
      const sys = node.innerSys;
      if (!sys) continue;
      for (const p of sys.planets) {
        if (p.data.kind !== 'planet' && p.data.kind !== 'dwarf') continue;
        const planetEntries = entries.filter((e) => e.planetId === p.data.id);
        if (!p.streakRing) {
          const rm = new THREE.Mesh(
            new THREE.TorusGeometry(p.data.radius * (p.data.rings ? 2.1 : 1.5), Math.max(0.02, p.data.radius * 0.011), 8, 128),
            new THREE.MeshBasicMaterial({
              color: new THREE.Color(p.data.palette.atmo), transparent: true, opacity: 0,
              blending: THREE.AdditiveBlending, depthWrite: false,
            }),
          );
          rm.rotation.x = Math.PI / 2 - 0.12;
          p.group.add(rm);
          p.streakRing = rm;
        }
        p.streakTarget = UniverseEngine.streakOf(planetEntries);
        p.streakDays = UniverseEngine.daysOf(planetEntries);

        const count = Math.min(12, planetEntries.length);
        /* without pages a giant keeps its small natural court */
        if (count === 0 && p.moons.length > 0 && !p.entryMoons) continue;
        if (count === p.moons.length) continue;
        p.moons.forEach((m) => p.group.remove(m.mesh));
        p.moons = [];
        p.entryMoons = count > 0;
        for (let i = 0; i < count; i++) {
          const seed = hash(i + 1, p.data.id.length + 3);
          const mr = p.data.radius * (0.1 + 0.09 * seed);
          const mesh = new THREE.Mesh(this.moonGeo!, this.moonMat!);
          mesh.scale.setScalar(Math.max(0.09, mr));
          p.group.add(mesh);
          p.moons.push({
            mesh,
            a: p.data.radius * (1.75 + 0.55 * i) + (p.data.rings ? p.data.radius * 1.5 : 0),
            speed: (Math.PI * 2) / (14 + i * 8),
            phase: seed * 6.28,
            incl: 0.18 + seed * 0.3,
          });
        }
      }
    }
  }

  /** Diff runtime bodies against the state list — form new worlds, dissolve removed ones. */
  syncBodies(list: CosmicBody[]) {
    const incoming = new Set(list.map((b) => b.id));
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const rb = this.bodies[i];
      if (!incoming.has(rb.data.id)) {
        const preservedGeometries = new Set<THREE.BufferGeometry>();
        const preservedMaterials = new Set<THREE.Material>();
        if (this.moonGeo) preservedGeometries.add(this.moonGeo);
        if (this.moonMat) preservedMaterials.add(this.moonMat);
        this.disposeObject3D(rb.group, {
          geometries: preservedGeometries,
          materials: preservedMaterials,
        });
        this.scene.remove(rb.group);
        if (rb.orbitLine) {
          this.scene.remove(rb.orbitLine);
          this.disposeObject3D(rb.orbitLine, {
            geometries: preservedGeometries,
            materials: preservedMaterials,
          });
        }
        const ci = this.colliderList.indexOf(rb.collider);
        if (ci >= 0) this.colliderList.splice(ci, 1);
        this.bodies.splice(i, 1);
        if (this.focusId === rb.data.id) this.focusId = null;
      }
    }
    const existing = new Set(this.bodies.map((b) => b.data.id));
    list.forEach((data) => {
      if (!existing.has(data.id)) this.buildBody(data);
    });

    /* Round 14 — Living Gravity re-syncs: new worlds are born healed on
       their canonical path, removed worlds leave the field. Each body also
       receives its lens-halo multiplier (the bend is always the size of the
       body's own silhouette). */
    for (const rb of this.bodies) {
      rb.lensHalo = lensHaloFor(rb.data.kind);
    }
    this.livingField.sync(list.map((b) => {
      const phys = calculatePhysics(b);
      return {
        id: b.id,
        massKg: dynamicMassKg(phys.massKg, b.kind),
        isStar: b.kind === 'star',
        a: b.orbit?.a ?? 0,
        e0: phys.eccentricity,
        phase: b.orbit?.phase ?? 0,
        incl: b.orbit?.incl ?? 0,
        speed: b.orbit?.speed ?? 0.01,
      };
    }));
  }

  /** Dimensional Barrier — strictly isolates state, star spectrum, corona, and local universe to active reality */
  setReality(reality: RealityConfig, liveBodies?: CosmicBody[], liveEntries?: DiaryEntry[]) {
    perfMark('reality-rebuild-start');
    this.activeRealityId = reality.id;
    this.activeReality = reality;

    // Synchronize Universe Surface (Cosmic Background Canvas)
    if (this.surfaceManager) {
      this.surfaceManager.setReality(reality);
    }
    // Sky Studio: bring this reality's own photo sky to the dome (fire-and-forget;
    // the photo dome crossfades while the rest of the reality builds)
    void this.applyActiveSky();

    /* Round 54 — the funnel palette retint is gone with the funnel: the
       geodesic disk is physics-colored (blackbody + Doppler), exactly like
       the reference, and the silhouette is pure black. */

    // 1. Update Anchor Star shader uniforms & corona palette
    const colA = new THREE.Color(reality.colorA);
    const colB = new THREE.Color(reality.colorB);
    const starCol = new THREE.Color(reality.starColor || reality.colorA);

    if (this.starUniforms) {
      if (!this.starUniforms.uColorA) this.starUniforms.uColorA = { value: colA };
      else (this.starUniforms.uColorA.value as THREE.Color).copy(colA);

      if (!this.starUniforms.uColorB) this.starUniforms.uColorB = { value: colB };
      else (this.starUniforms.uColorB.value as THREE.Color).copy(colB);

      if (!this.starUniforms.uCoreColor) this.starUniforms.uCoreColor = { value: starCol };
      else (this.starUniforms.uCoreColor.value as THREE.Color).copy(starCol);
    }

    if (this.coronaMat && this.coronaMat.uniforms) {
      if (!this.coronaMat.uniforms.uColorA) this.coronaMat.uniforms.uColorA = { value: colA };
      else (this.coronaMat.uniforms.uColorA.value as THREE.Color).copy(colA);

      if (!this.coronaMat.uniforms.uColorB) this.coronaMat.uniforms.uColorB = { value: colB };
      else (this.coronaMat.uniforms.uColorB.value as THREE.Color).copy(colB);
    }

    // 2. Re-anchor Active Reality Ring in Multiverse View
    if (this.activeRealityShieldMesh) {
      this.activeRealityShieldMesh.position.set(...reality.bubblePos);
      this.activeRealityShieldMesh.scale.setScalar(reality.bubbleSize);
      this.activeRealityShieldMesh.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
          child.material.color.copy(colA);
        }
      });
    }

    // 3. Sync celestial bodies & diary moons strictly for this reality.
    // The live container (the reality's actual worlds/pages) wins over the
    // static config seed — user-added bodies survive the switch.
    const bodies = liveBodies ?? reality.bodies;
    const entries = liveEntries ?? reality.entries;
    this.syncBodies(bodies);
    this.syncMoons(entries);
    this.lastEntries = entries;
    /* rebuild the GALAXY STAGE from this reality's REAL roster — one full
       spiral per major galaxy — and tint the cluster stage's hot gas.
       The boot call spreads the roster across frames (nothing at boot zoom
       needs it for seconds) so the veil lifts without the multi-second
       startup stall; user-triggered reality switches build synchronously. */
    const bootCall = this.skipNextCompile;
    this.buildGalaxyStageContents(reality, bootCall);
    const gasTint = new THREE.Color(reality.colorB);
    this.clusterGasMats.forEach((m) => {
      m.color.copy(m.userData.baseColor as THREE.Color).lerp(gasTint, 0.42);
    });
    /* precompile anything this reality added (moons, new materials) so the
       first frame after a reality switch never stalls on shader compilation.
       Skipped on the boot call — the constructor compiled this exact scene
       moments ago, and compiling it again doubled the startup freeze. (The
       boot's chunked galaxy roster compiles lazily out at the galaxy band,
       where the entry warp masks it.) */
    if (bootCall) this.skipNextCompile = false;
    else this.renderer.compile(this.scene, this.camera);

    // 4. Clean up any invalid selection / focus
    if (this.selectedId && !bodies.some((b) => b.id === this.selectedId) && this.selectedId !== 'anchor') {
      this.selectedId = null;
      this.cb.onSelect(null);
    }
    if (this.focusId && !bodies.some((b) => b.id === this.focusId) && this.focusId !== 'anchor') {
      this.focusId = null;
    }

    // 5. Dimensional Barrier: Hide all elements belonging to other realities (unless in multiverse view)
    if (this.realityGroups) {
      const isMultiverseMode = this.cosmicStage === 'multiverse';
      Object.keys(this.realityGroups).forEach((id) => {
        if (this.realityGroups[id]) {
          this.realityGroups[id].visible = isMultiverseMode || (id === reality.id);
        }
      });
    }

    // 6. A galaxy dive queued before this roster landed executes now
    if (this.pendingGalaxyEntry && this.pendingGalaxyEntry.realityId === reality.id) {
      const pending = this.pendingGalaxyEntry;
      this.pendingGalaxyEntry = null;
      const gal = (reality.galaxies ?? []).find((g) => g.id === pending.galaxyId);
      if (gal) this.beginGalaxyEntry(gal);
    }
    perfMeasure('reality-rebuild', 'reality-rebuild-start');
  }


  /** Distant exoplanet horizon plates (cinematic tier): procedural billboard
      worlds drifting in the deep cosmic web. Built once; a tier upgrade
      after boot rebuilds them via onQualityChange. */
  private buildExoplanetPlates() {
    if (getQualityTier() !== 'cinematic' || this.exoPlates.length > 0) return;
    const specs = [
      { pos: [135000, -26000, -86000], size: 8200, atm: '#7fd4ff' },
      { pos: [-152000, 34000, 61000], size: 10400, atm: '#ffb98a' },
      { pos: [42000, 68000, -178000], size: 6400, atm: '#c9a6ff' },
    ] as const;
    for (const s of specs) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: exoplanetPlateVert,
        fragmentShader: exoplanetPlateFrag,
        uniforms: {
          uTime: { value: 0 },
          uSunDir: { value: new THREE.Vector3(0.3, 0.3, 1).normalize() },
          uColorAtm: { value: new THREE.Color(s.atm) },
          uOpacity: { value: 0 },
        },
        transparent: true, depthWrite: false,
      });
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(s.size, s.size), mat);
      plate.position.set(s.pos[0], s.pos[1], s.pos[2]);
      plate.renderOrder = 2;
      this.exoPlates.push(plate);
      this.gWeb.add(plate);
    }
  }

  /** Pan and zoom camera to the supreme Multiverse Core {Demon} */
  zoomToDemonCore() {
    this.focusId = null;
    this.realityFocused = false;

    this.rig.setZoomTarget(0.94);
    this.rig.setOrbit(0.82, 1.12);
    this.rig.clearPan();
  }

  /** Frame the Astral Core */
  zoomToCore() {
    this.focusId = null;
    this.realityFocused = false;

    this.rig.setZoomTarget(0.93);
    this.rig.setOrbit(0.85, 1.1);
    this.rig.clearPan();
  }

  private cancelGalaxyDive() {
    this.galaxyDive = null;
    this.galaxyInnerFocus = false;
  }

  /** Enter a galaxy with a plain camera zoom: the dial eases from the web
      frame down into the clicked galaxy. For galaxies other than home, the
      camera lands inside that galaxy's own isolated stellar system. */
  private beginGalaxyEntry(gal: GalaxyData): boolean {
    if (this.galaxyDive !== null || this.portal.phase !== 'idle' || this.bootIntro || this.kamuiTimer > 0) return false;

    if (this.cosmicStage !== 'web') return false;
    const node = this.galaxyStageNodes.find((n) => n.data.id === gal.id);
    if (!node && !gal.isHomeGalaxy) return false;
    const endInner = !gal.isHomeGalaxy;
    this.galaxyFocusId = endInner ? gal.id : null;
    this.galaxyInnerFocus = false;
    if (endInner) {
      this.galaxyDive = { galaxyId: gal.id, endInner: true };
    }
    this.grabCooldown = 1.25;
    this.rig.clearPan();
    this.rig.setOrbit(null, 1.08);
    this.rig.setZoomTarget(gal.isHomeGalaxy ? 0.15 : CameraRig.zoomTOf(140));
    this.triggerKamui();
    return true;
  }

  /** Dive into a specific major galaxy. EVERY galaxy is a real, isolated
      realm with its own stellar system — so clicking one zooms the camera
      INTO its realm: the disc becomes the sky and the galaxy's own star +
      worlds appear. The home galaxy's realm is the anchor star system with
      all your memory worlds. The galaxy is resolved from the engine's own
      stage (the runtime roster) — the static defaults may not know about
      user-created galaxies. */
  enterGalaxy(realityId: string, galaxyId: string) {
    /* a dive into ANOTHER reality arrives before that reality's roster is
       on the stage (the App switches reality then calls this synchronously).
       Queue the dive — setReality executes it the moment the roster lands. */
    if (this.activeRealityId !== realityId) {
      this.pendingGalaxyEntry = { realityId, galaxyId };
      return;
    }
    const gal =
      this.galaxyStageNodes.find((n) => n.data.id === galaxyId)?.data
      ?? (this.cosmicStage === 'multiverse'
        ? this.galaxyNodes.find((n) => n.galaxyData.id === galaxyId)?.galaxyData
        : undefined);
    if (!gal) return;
    this.focusId = null;
    this.realityFocused = false;
    this.activeGalaxyName = gal.name;
    if (this.cosmicStage === 'multiverse') {
    if (this.cosmicStage === 'multiverse') { this.beginStageWarp('toWeb', CameraRig.zoomTOf(26000), () => { this.galaxyFocusId = gal.id; }); return; }
      this.galaxyFocusId = gal.id;
      this.rig.setZoomTarget(CameraRig.zoomTOf(26000));
      return;
    }
    if (gal.isHomeGalaxy) {
      /* the home realm tears open into the anchor star system */
      this.releaseInnerWorld();
      this.beginGalaxyEntry(gal);
      return;
    }
    /* isolated realm — the focused surface tear dives all the way in. The
       inner-system state is applied only when the flight actually lands. */
    if (this.beginGalaxyEntry(gal)) {
      if (this.innerFocusBodyId) { this.innerFocusBodyId = null; this.cb.onSelectInnerWorld?.(null); }
      this.rig.clearPan();
      this.rig.setOrbit(null, 1.08);
    }
  }

  /** A world inside an isolated inner stellar system was clicked — the
      camera leaves the system center and orbits THIS world, and the App
      gets its full identity for the selection card. */
  private selectInnerWorld(id: string) {
    const body = this.findInnerBody(id.slice('inner:'.length));
    if (!body) return;
    this.innerFocusBodyId = body.data.id;
    this.selectedId = id;
    this.cb.onSelectInnerWorld?.({
      galaxyId: body.galaxyId,
      galaxyName: body.galaxyName,
      starName: body.starName,
      body: body.data,
    });
  }

  /** Double-click on an inner body — the home grammar:
      world / nebula → the portal tears open and the DIARY arrives;
      the system's star → the control panel (core mode). */
  private activateInner(id: string) {
    const bodyId = id.slice('inner:'.length);
    const body = this.findInnerBody(bodyId);
    if (!body) return;
    if (body.data.kind === 'star') {
      this.selectedId = id;
      this.innerFocusBodyId = null;
      this.cb.onActivate('anchor'); /* the realm's control panel */
      return;
    }
    this.selectedId = id;
    /* swing the orbit onto this world so the portal dive lands on it */
    this.innerFocusBodyId = body.data.id;
    this.beginPortal({ data: body.data });
  }

  /** Resolve a synthetic inner body (star, world or nebula) by its raw id —
      the `inner:` pick prefix is tolerated so the App's body lookups can
      pass hover/selection ids straight through. */
  getInnerBody(bodyId: string): CosmicBody | null {
    const raw = bodyId.startsWith('inner:') ? bodyId.slice('inner:'.length) : bodyId;
    return this.findInnerBody(raw)?.data ?? null;
  }
  private findInnerBody(bodyId: string): { data: CosmicBody; galaxyId: string; galaxyName: string; starName: string } | null {
    for (const node of this.galaxyStageNodes) {
      const sys = node.innerSys;
      if (!sys) continue;
      if (sys.starData.id === bodyId) {
        return { data: sys.starData, galaxyId: node.data.id, galaxyName: node.data.name, starName: sys.starData.name };
      }
      const planet = sys.planets.find((p) => p.data.id === bodyId);
      if (planet) {
        return { data: planet.data, galaxyId: node.data.id, galaxyName: node.data.name, starName: sys.starData.name };
      }
    }
    return null;
  }

  /** Leave a clicked inner world — back to orbiting the system's star. */
  private releaseInnerWorld() {
    if (!this.innerFocusBodyId) return;
    this.innerFocusBodyId = null;
    this.selectedId = null;
    /* zoom back out to the system frame (the depth the dive landed at) */
    this.rig.setZoomTarget(CameraRig.zoomTOf(150));
    this.cb.onSelectInnerWorld?.(null);
  }


  /* -------------------------------- frame --------------------------------- */

  private resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private tick = () => {
    if (this.disposed) return;
    /* AUDIT 2026-09-28 — the frame-level fault shield. One exception in one
       update pass (a NaN from physics, a transient GL hiccup) used to skip
       composer.render() for EVERY later frame: the canvas froze black while
       the loop spun and the intro veil never lifted. The shield keeps the
       loop alive, reports the failure once (log spam in a per-frame handler
       would drown the console), and retries rendering on the next frame —
       a transient failure heals itself, a persistent one stays visible in
       the console instead of becoming a silent black screen. */
    try {
      this.tickFrame();
    } catch (err) {
      if (!this.tickErrorLogged) {
        this.tickErrorLogged = true;
        console.error('[universe] a frame update failed — recovering on the next frame:', err);
      }
      try { this.clock.getDelta(); } catch { /* keep the clock sane */ }
    }
  };
  private tickErrorLogged = false;

  private tickFrame = () => {
    const frameStarted = isPerformanceEnabled() ? performance.now() : 0;
    /* Vault/Core overlays do not need a live scene update. Keeping the
       animation loop registered makes resume instant, while this guard avoids
       spending CPU on orbital, physics, hover, and shader-uniform updates. */
    if (!this.rendering) {
      this.clock.getDelta();
      return;
    }
    const dt = Math.min(0.05, this.clock.getDelta());
    this.clockT += dt;

    /* Round 20 — the geodesic tier's one-way circuit breaker: while a
       raymarched hole is actually on stage, sustained frame overruns stand
       it down for the session and the proven composite returns. */
    this.guardRaymarch(dt);

    /* ROUND 61 — the camera checkpoint (idle quiescence only; see the field
       block above). Cheap: a rig snapshot + a throttled localStorage write. */
    this.checkpointCameraView(dt);

    /* time */
    const rate = this.paused ? 0 : 6 * this.timeScale * (this.coreActive ? 0.35 : 1);
    this.simDays += dt * rate;
    this.lastSimDelta = dt * rate;
    if (this.clockT - this.lastDateSent > 0.25) {
      this.lastDateSent = this.clockT;
      this.cb.onSimDate(new Date(this.epoch + this.simDays * DAY).toISOString());
    }

    /* KAMUI (v1) — the summon plays as CHOREOGRAPHED BEATS: the rip (the
       original start), then the new middle frames (wind-up, flicker,
       deepening), then the throat (the vacuum gulp). Each beat is its own
       full-speed envelope — the length comes from the sequence, never from
       slowing one motion down. The eject keeps its instant full burst. */
    if (this.kamuiTimer > 0) {
      this.kamuiTimer = Math.max(0, this.kamuiTimer - dt);
      if (this.kamuiTimer === 0 && this.kamuiVacuumActive) {
        this.kamuiVacuumTail = 1; /* R67: the throat UNWINDS with the glow — never a one-frame cut */
      }
      if (this.portalPass.uniforms.uDir.value < 0) {
        /* THE EJECT — a short burst that unwinds. Strength AND spin decay
           together over KAMUI_REVERSE_DURATION, so the warped screen relaxes
           smoothly back to the idle image and the shader's passthrough cut
           at s < 0.001 is never visible (no frozen twist, no sudden drop). */
        const kEase = Math.sin((this.kamuiTimer / KAMUI_REVERSE_DURATION) * Math.PI * 0.5);
        this.kamuiEase = Math.max(this.kamuiEase, kEase * 1.15);
        this.kamuiTwist = kEase; /* the spin unwinds WITH the glow — no frozen tail */
      } else {
        const elapsed = KAMUI_TRIGGER_DURATION - this.kamuiTimer;
        let kEase = 0;
        for (const beat of KAMUI_BEATS) kEase = Math.max(kEase, kamuiBeatEase(elapsed, beat));
        this.kamuiTwist = Math.max(this.kamuiTwist, kEase); /* the spin NEVER unwinds */
        /* the brightness breathes with the beats, but the floor (the twist
           drive) keeps the vortex alive through every seam — no blinking */
        this.kamuiEase = Math.max(this.kamuiEase, kEase * 1.15, this.kamuiTwist * 0.6);
      }
    }


    /* CAMERA STABILITY — the summon hold. For KAMUI_ENTRY_HOLD after the
       click the camera is pinned exactly where the traveler left it and all
       zoom momentum is killed: the red vortex plays against a still frame.
       The moment it expires we hand the body and the arrival dial to the
       rig, so the approach begins as the tear fades — the traveler falls
       through the vortex instead of being dragged past it. */
    if (this.portalHold > 0) {
      this.portalHold = Math.max(0, this.portalHold - dt);
      this.rig.setZoomTarget(this.portalReturnDial);
      this.rig.killZoomMomentum();
      if (this.portalHold === 0) {
        if (this.portalFocusPending) {
          this.focusId = this.portalPendingFocusId;
          this.portalFocusPending = false;
          this.portalPendingFocusId = null;
        }
        this.rig.setZoomTarget(this.portalEnterDial);
        /* THE THROAT HANDS OFF (R67) — the hold expires EXACTLY as the
           summon's last beat completes: the tunnel is finished, so what
           lives inside the subject ejects NOW, through the dying vortex —
           the diary/vault materializes while the tear is still spinning
           and collapsing, never after a silent dive. The dive becomes the
           arrival settle behind the overlay; the zoom-arrival branch below
           stays as the safety net (phase is already 'open', so it no-ops). */
        if (this.portal.phase === 'entering' && !this.portal.fired) {
          this.portal.fired = true;
          this.portal.phase = 'open';
          this.cb.onPortalPeak(this.portal.kind, this.portal.bodyId);
        }
      }
    }
    /* The portal — a plain camera zoom. Clicking a world dives the camera
       in toward it; when the zoom lands the destination overlay opens.
       Closing eases the camera back out to the pre-open framing. */
    if (this.portal.phase === 'entering' || this.portal.phase === 'leaving') {
      this.portal.t += dt;
    }
    if (this.portal.phase === 'entering') {
      const arrived = Math.abs(this.rig.tZoomT - this.portalEnterDial) < 0.004
        && Math.abs(this.rig.zoomT - this.portalEnterDial) < 0.004;
      if (!this.portal.fired && (arrived || this.portal.t > 6)) {
        this.portal.fired = true;
        this.portal.phase = 'open';
        this.cb.onPortalPeak(this.portal.kind, this.portal.bodyId);
      }
    } else if (this.portal.phase === 'leaving') {
      const settled = Math.abs(this.rig.tZoomT - this.portalReturnDial) < 0.004
        && Math.abs(this.rig.zoomT - this.portalReturnDial) < 0.004;
      if (settled || this.portal.t > 6) {
        const returningInner = this.portalWasInner || Boolean(this.portalTargetInnerId);
        this.portal.phase = 'idle';
        this.portalTargetInnerId = null;
        this.portalWasInner = false;
        this.portalSavedCam = null;
        if (returningInner) this.cb.onSelectInnerWorld?.(null);
        this.kamuiTearBodyId = null;
        this.cb.onPortalDone();
      }
    }

    const targetFov = 50 - this.coreT * 4;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 4);
    this.camera.updateProjectionMatrix();

    /* camera — orbit/pan/zoom physics live in the CameraRig */
    this.grabCooldown = Math.max(0, this.grabCooldown - dt);

    /* auto release — zoom out of a focused world and it lets go seamlessly
       (while clamped, rendered distance equals the unclamped base, so the
       hand-off never jumps) */
    const fb = this.focusBody();
    if (fb && this.rig.dist() > 1200 && this.portal.phase === 'idle' && this.kamuiTimer <= 0) {
      this.focusId = null;
      this.grabCooldown = 0.6;
    }

    /* the galaxy dive — the dial eases on its own; flip into the isolated
       inner system once the camera is actually inside the disc */
    if (this.galaxyDive && this.galaxyDive.endInner && !this.galaxyInnerFocus && this.portal.phase === 'idle') {
      const dive = this.galaxyDive;
      const node = this.galaxyStageNodes.find((n) => n.data.id === dive.galaxyId);
      if (node) {
        node.group.getWorldPosition(this._vScratch2);
        if (this.camera.position.distanceTo(this._vScratch2) < 6800) {
          this.galaxyInnerFocus = true;
          this.galaxyDive = null;
        }
      }
    }

    if (this.bootIntro) {
      /* THE QUIET OPENING — no eruption. The home page already sits fully
         formed behind the opaque veil; this finalize runs once on the first
         frame so nothing boot-related can linger (sleeping meteors, hidden
         sky, half-faded worlds, the old 0.075 dive-in zoom). The veil then
         simply fades and you are home. */
      this.cosmicStage = 'web';
      this.realityFocused = false;
      this.birthK = 1;
      this.anchorGroup.visible = true;
      this.anchorGroup.scale.setScalar(1);
      this.bodies.forEach((b) => { b.fadeTarget = 1; });
      /* ROUND 61 — the camera remembers. A placement the user found and
         loved survives close/reopen: the boot default below applies only
         when this device has never saved a view. Reset View (R) clears the
         memory, so the default remains reachable on purpose. */
      const remembered = getCameraMemory();
      if (remembered) {
        /* ROUND 62 — HARD-CUT, not ease-in: the full snapshot (current +
           target channels) puts the camera exactly at the saved view on the
           first frame. The old target-only restore eases from the rig's
           constructor default — a huge distance — and the focus auto-release
           (dist > 1200) un-bound the saved focus before the camera arrived,
           leaving the hole nowhere in frame. */
        this.rig.restore({
          zoomT: remembered.zoomT, tZoomT: remembered.tZoomT,
          theta: remembered.theta, tTheta: remembered.tTheta,
          phi: remembered.phi, tPhi: remembered.tPhi,
          pan: remembered.pan,
        });
        /* restore WHAT the view was orbiting: the rig's focus is recomputed
           from focusBody() every frame, so re-binding the id re-points the
           view at the saved subject (the hole composition). A saved focus is
           re-bound only if the body exists in this boot's roster — a stale
           id (a deleted world) can never point the camera at nothing. */
        if (remembered.focusId && this.bodies.some((b) => b.data.id === remembered.focusId)) {
          this.focusId = remembered.focusId;
        }
      } else {
        this.rig.setZoomTarget(0.15);
        this.rig.setOrbit(null, 1.12);
      }
      this.bootIntro = false;
    } else {
      /* THE LAW — other realities do not exist for a reality. The dial hits
         the membrane and it may shimmer, but it can never be crossed by
         scrolling: the ONLY bridge between the stages is the Kamui, fired
         by explicit actions. */
      if (this.cosmicStage === 'web') {
        if (this.rig.tZoomT > WEB_CEILING) this.rig.setZoomTarget(WEB_CEILING);
        /* R68 — the crossing is DELIBERATE: dial at the edge AND a strong
           outward wheel push (WARP_ZOOM_VEL). Plain exploration under the
           ceiling — even fast scrolling — stays inside the stage. */
        const pushing = this.rig.tZoomT > WEB_EDGE_TRIGGER && this.rig.zoomVelocity > WARP_ZOOM_VEL;
        this.membraneShimmer += ((pushing ? 0.16 : 0) - this.membraneShimmer) * Math.min(1, dt * 5);
        /* pushed through the web's ceiling — the crossing IS a Kamui: the
           tear opens at the center of the cosmic web and the fold carries
           you out to the multiverse sphere (the mirror of the floor-return
           in the multiverse branch below). */
        if (
          pushing && this.kamuiTimer <= 0 && this.grabCooldown <= 0
          && !this.dragging && this.portal.phase === 'idle'
        ) {
          this.realityFocused = true;
          this.beginStageWarp('toMultiverse', this.activeReality ? CameraRig.zoomTOf(this.activeReality.bubbleSize * 5.5) : REALITY_FLOOR);
        }
      } else {
        this.membraneShimmer += (0 - this.membraneShimmer) * Math.min(1, dt * 5);
      }
      if (this.cosmicStage === 'multiverse' && this.kamuiTimer <= 0) {
        if (this.realityFocused && this.rig.tZoomT < REALITY_FLOOR) this.rig.setZoomTarget(REALITY_FLOOR);
        if (this.realityFocused && this.rig.atFocusMax && this.rig.zoomTrend > 0) {
          this.realityFocused = false;
          this.grabCooldown = 0.6;
        }
        if (this.rig.tZoomT < MULTIVERSE_FLOOR_CLAMP) this.rig.setZoomTarget(MULTIVERSE_FLOOR_CLAMP);
        /* pushed through the multiverse's floor with a DELIBERATE inward
           push — the dial carries you back out into the web (this crossing
           IS a Kamui); plain exploration above the floor stays. */
        if (
          this.rig.tZoomT <= MULTIVERSE_FLOOR_RETURN && this.rig.zoomVelocity < RETURN_ZOOM_VEL && this.grabCooldown <= 0
          && !this.dragging && this.portal.phase === 'idle'
        ) {
          this.beginStageWarp('toWeb', 0.72);
        }
      }
      /* galaxy focus releases, in a ladder:
         inner system → zoom out → back to that galaxy's frame (in front of
         the specific galaxy you visited); galaxy frame → zoom out → the open
         field; zooming INTO a home-galaxy frame dives THROUGH it into the
         anchor star system. */
      if (this.cosmicStage === 'web' && this.kamuiTimer <= 0 && this.portal.phase === 'idle' && this.galaxyFocusId && this.rig.atFocusMax && this.rig.zoomTrend > 0) {
        if (this.innerFocusBodyId) {
          this.releaseInnerWorld(); /* world → system frame */
          this.grabCooldown = 0.35;
        } else if (this.galaxyInnerFocus) {
          this.galaxyInnerFocus = false;
          this.rig.setZoomTarget(0.668); /* back in front of that galaxy */
          this.grabCooldown = 0.6;
        } else {
          this.galaxyFocusId = null;
          this.grabCooldown = 0.6;
        }
      }
      if (this.cosmicStage === 'web' && this.kamuiTimer <= 0 && this.portal.phase === 'idle' && this.galaxyFocusId && this.rig.atFocusMin && this.rig.zoomTrend < 0) {
        const node = this.galaxyStageNodes.find((n) => n.data.id === this.galaxyFocusId);
        if (node && node.data.isHomeGalaxy && !this.galaxyInnerFocus) {
          this.galaxyFocusId = null;
          this.grabCooldown = 0.35;
        }
      }
    }
    /* auto engage — ONLY while actively zooming in AND only onto the body the
       pointer is actually over: diving toward a world you're touching centers
       it. A plain rotation, a stray scroll, or a zoom across empty space must
       never yank the camera onto a random body and send the sky spinning
       around it — that yank-and-follow was exactly the "clicking a body makes
       the universe rotate" bug. */
    if (
!this.focusId && !this.realityFocused && this.cosmicStage === 'web' && !this.bootIntro && !this.coreActive && this.rig.dist() < 150 && this.portal.phase === 'idle' && this.kamuiTimer <= 0
      && this.grabCooldown <= 0 && !this.dragging && this.rig.zoomTrend < -0.018
    ) {
      if (this.hoveredId && this.hoveredId !== 'anchor') {
        const target = this.bodies.find((b) => b.data.id === this.hoveredId);
        if (target && target.data.kind !== 'nebula' && target.data.kind !== 'hole') {
          this.focusId = target.data.id;
        }
      }
    }

    const activeFb = this.focusBody();
    let focusMin: number | undefined, focusMax: number | undefined;
    let focusRadiusParam = activeFb ? activeFb.data.radius : (this.activeReality ? this.activeReality.bubbleSize * 2.6 : 6);
    let galaxyFocusActive = false;
    if (this.realityFocused && this.activeReality) {
      /* orbit the active reality's marble — framed just outside its glass */
      this._vFocusScratch.set(...this.activeReality.bubblePos);
      focusMin = this.activeReality.bubbleSize * 3.1;  /* just outside the glass */
      focusMax = 520000;                               /* release point on zoom-out */
    } else if (activeFb) {
      activeFb.group.getWorldPosition(this._vFocusScratch);
      /* Round 20 — with the geodesic tier live, never let the camera dive
         inside the disk's inner edge (~5.1 rs): clamp the orbit to his own
         demo's minimum approach (~6 rs, here 7 rs for framing headroom) */
      if (activeFb.data.kind === 'hole' || activeFb.data.kind === 'vault') {
        const rm = activeFb.group.userData.bh as BlackHoleVisual | undefined;
        if (rm && rm.geodesic) {
          focusMin = Math.max(activeFb.data.radius * 1.35, activeFb.data.radius * 0.62 * 7);
        }
      }
    } else if (this.galaxyFocusId) {
      /* orbit the entered galaxy — deep inside its own stellar system
         (galaxyInnerFocus) or framed on its disc from outside */
      const node = this.galaxyStageNodes.find((n) => n.data.id === this.galaxyFocusId);
      if (node) {
        node.group.getWorldPosition(this._vFocusScratch);
        if (this.galaxyInnerFocus) {
          const focusedWorld = this.innerFocusBodyId
            ? node.innerSys?.planets.find((p) => p.data.id === this.innerFocusBodyId) ?? null
            : null;
          if (focusedWorld) {
            /* orbit the clicked world itself */
            focusedWorld.group.getWorldPosition(this._vFocusScratch);
            focusMin = Math.max(2.2, focusedWorld.data.radius * 1.9);
            focusMax = 4200;
            focusRadiusParam = focusedWorld.data.radius;
          } else {
            focusMin = 12;            /* planet-orbit depth */
            focusMax = 7000;
            focusRadiusParam = 30;    /* the system star */
          }
          galaxyFocusActive = true;
        } else {
          focusMin = node.radius * 2.1;
          focusMax = 90000; /* released on zoom-out toward the cluster stage */
          focusRadiusParam = node.radius;
          galaxyFocusActive = true;
        }
      }
      /* stage not built yet (reality switch in flight) → keep drifting to origin until it is */
    } else {
      this._vFocusScratch.set(0, 0, 0);
    }
    /* NOTE: no holdFocus while a planet/vault portal is live — pinning the
       focus to the target body used to glide the camera hundreds of units
       sideways (the "pendulum" sweep). The portal is a local surface event;
       the traveler's framing stays exactly where it was. */
    this.rig.update(dt, {
      focus: this._vFocusScratch,
      focused: !!activeFb || this.realityFocused || galaxyFocusActive,
      focusRadius: focusRadiusParam,
      focusMin,
      focusMax,
    });
this.updateBodies(dt);
    this.applyKamuiFrame(dt);
    this.updateLivingGravity();
    this.updateSpacetimeLens(dt);
    this.updateMeteors(dt);
    this.updateAurora(dt);
    this.updatePulses(performance.now());
    this.updateLevels(dt);
    this.updateSurface(dt);
    this.updateCore(dt);
    this.updateHover();

    /* Round 54 — drive the geodesic uniforms LAST, after every position
       writer has had its say: the vault ephemeris re-places bodies after
       the main loop's Kepler pass, so a mid-update read landed seconds
       stale and the march ran against a phantom hole. The driver force-
       refreshes the matrix chain from the CURRENT locals, so the hole
       center, the camera offset and the billboard are exact for THIS
       frame's render. */
    this.camera.updateMatrixWorld();
    this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();
    const holeOnStage = this.raymarchOnStage();
    this.applyAdaptiveResolution(holeOnStage, dt);
    for (const visual of this.blackHoles) {
      if (visual.geodesic) updateRaymarchUniforms(visual, this.camera, this.clockT);
    }

    /* ROUND 59 — no background captures of any kind: the sky layers bend
       themselves (the surface manager's 1/θ lens), so the lensed background
       is the LIVE sky rendered by its own shaders — no second image of the
       sky exists in the pipeline, and no square or layer can appear. */

    if (this.rendering) {
      this.composer.render();
      /* one-shot: the first fully rendered frame means shader compilation and
         scene building are done — the App lifts its intro veil on this */
      if (!this.firstFrameFired) {
        this.firstFrameFired = true;
        try { this.cb.onFirstFrame?.(); } catch { /* veil lift must never crash the loop */ }
      }
    }
    if (frameStarted) recordFrame(performance.now() - frameStarted);
  };
  private clock = new THREE.Clock();

  /* ------------------------------ KAMUI ---------------------------------- */

  /** Live world position of the current kamui target (home body, inner
     world, or the galaxy disc being dived into) — the tear must stay glued
     to a moving subject. */
  private resolveKamuiSource(out: THREE.Vector3): boolean {
    if (this.kamuiTearBodyId) {
      const home = this.bodies.find((b) => b.data.id === this.kamuiTearBodyId);
      if (home) { home.group.getWorldPosition(out); return true; }
      for (const node of this.galaxyStageNodes) {
        const inner = node.innerSys?.planets.find((pl) => pl.data.id === this.kamuiTearBodyId);
        if (inner) { inner.group.getWorldPosition(out); return true; }
      }
    }
    if (this.galaxyDive) {
      const diveId = this.galaxyDive.galaxyId;
      const node = this.galaxyStageNodes.find((n) => n.data.id === diveId);
      if (node) { node.group.getWorldPosition(out); return true; }
    }
    return false;
  }

  /** The scene-graph group of the current kamui source (home body, inner
     world, or diving galaxy) — the subject the vacuum gulp drains. */
  private resolveKamuiGroup(): THREE.Object3D | null {
    if (this.kamuiTearBodyId) {
      const home = this.bodies.find((b) => b.data.id === this.kamuiTearBodyId);
      if (home) return home.group;
      for (const node of this.galaxyStageNodes) {
        const inner = node.innerSys?.planets.find((pl) => pl.data.id === this.kamuiTearBodyId);
        if (inner) return inner.group;
      }
    }
    if (this.galaxyDive) {
      const diveId = this.galaxyDive.galaxyId;
      const node = this.galaxyStageNodes.find((n) => n.data.id === diveId);
      if (node) return node.group;
    }
    return null;
  }

  /** Field radius for the reverse traversal — re-derived from the target
     body (the portal contract stores only the id). */
  private portalBodyRadiusForReverse(): number {
    if (!this.kamuiTearBodyId) return 6;
    const home = this.bodies.find((b) => b.data.id === this.kamuiTearBodyId);
    if (home) return home.data.radius;
    for (const node of this.galaxyStageNodes) {
      const inner = node.innerSys?.planets.find((pl) => pl.data.id === this.kamuiTearBodyId);
      if (inner) return inner.data.radius;
    }
    return 6;
  }


  /** The v1 Kamui bends only the SCREEN (portalFrag) — the per-material
      geometry field is retired, but the uniform plumbing stays alive at zero
      so every existing shader keeps compiling. */
  private applyKamuiFieldUniforms(material: THREE.ShaderMaterial) {
    const u = material.uniforms;
    if (!u.uGravityCenter) return;
    (u.uGravityCenter.value as THREE.Vector3).set(0, 0, 0);
    u.uGravityRadius.value = 0;
    u.uGravityStrength.value = 0;
    u.uGravityTime.value = this.clockT;
    if (u.uReverse) u.uReverse.value = 1;
  }

  private setKamuiLocalCenter(material: THREE.ShaderMaterial, mesh: THREE.Object3D | null | undefined) {
    if (!mesh || !material.uniforms.uGravityLocalCenter) return;
    (material.uniforms.uGravityLocalCenter.value as THREE.Vector3).set(0, 0, 0);
  }

  /** The vacuum gulp's size factor for a group — 1 unless it is the swallow
      target, then the accelerating drain (or its eased restore). Composed
      into every per-frame scale writer, so the drain can never fight them. */
  private kamuiSwallowFactorFor(g: THREE.Object3D): number {
    return g === this.kamuiSwallowGroup ? this.kamuiSwallowFactor : 1;
  }

  /** Per-frame application of the v1 vortex: the full-screen pass gets
      the eased strength, the clock, and the reality's own hue; while the
      pulse is live the center re-projects the live kamui source (the clicked
      body or the diving galaxy), so the tear stays glued to its subject —
      when nothing resolves it keeps the center the trigger chose. */
  private applyKamuiFrame(dt: number) {
    const pu = this.portalPass?.uniforms;
    if (!pu) return;
    this.kamuiEase *= Math.max(0, 1 - dt * 6); /* relax toward the envelope */
    pu.uTime.value = this.clockT;
    pu.uStrength.value = this.kamuiEase;
    /* the middle beats' channels — the wind-up and the flicker belong to the
       forward summon only; the eject and idle stay clean */
    const forwardSummon = pu.uDir.value > 0 && this.kamuiTimer > 0;
    const beatElapsed = KAMUI_TRIGGER_DURATION - this.kamuiTimer;
    pu.uTwist.value = this.kamuiTwist;
    pu.uWind.value = forwardSummon
      ? THREE.MathUtils.smoothstep(beatElapsed, 0.35, 2.55) /* winds up once and STAYS — no unwind */
      : 0;
    pu.uPulse.value = forwardSummon && beatElapsed >= 1.75 && beatElapsed <= 2.75
      ? Math.abs(Math.sin(((beatElapsed - 1.75) / 1.0) * Math.PI * 2))
      : 0;
    if (this.kamuiTimer > 0 && this.resolveKamuiSource(this._vScratch4)) {
      this._vScratch4.project(this.camera);
      if (this._vScratch4.z < 1) pu.uCenter.value.set(this._vScratch4.x * 0.5 + 0.5, this._vScratch4.y * 0.5 + 0.5);
      else pu.uCenter.value.set(0.5, 0.5);
    }
    /* uColor belongs to the trigger (the demonic #ff1744) — it is NOT driven
       per frame, so the red owns the whole pulse (v1 behavior). */
    if (this.demonCoreMat?.uniforms?.uTearStrength) {
      this.demonCoreMat.uniforms.uTearStrength.value = this.kamuiEase * 0.9;
    }

    /* THE VACUUM GULP — the tear's final stage: in the last
       KAMUI_VACUUM_WINDOW of a forward summon the throat completes. The
       shader's pull, spin and void surge with rising acceleration (uVac),
       the subject's own size drains, and the frame rumbles — the universe
       briefly unstable at the instant the tunnel finishes. The swallow
       factor then eases back to exactly 1, so nothing stays deformed. */
    const inVacuum = this.kamuiTimer > 0 && this.kamuiTimer <= KAMUI_VACUUM_WINDOW
      && pu.uDir.value > 0 && this.portal.phase !== 'leaving';
    if (inVacuum && !this.kamuiVacuumActive) {
      this.kamuiVacuumActive = true;
      this.kamuiShakeT = 1;
      this.kamuiSwallowGroup = this.resolveKamuiGroup();
      this.kamuiSwallowFactor = 1;
    }
    if (!inVacuum) this.kamuiVacuumActive = false;
    if (this.kamuiVacuumActive) {
      const t = 1 - Math.min(1, Math.max(0, this.kamuiTimer / KAMUI_VACUUM_WINDOW));
      pu.uVac.value = t;
      this.kamuiSwallowFactor = 1 - 0.94 * t * t * t; /* accelerating drain */
      this.kamuiVacuumTail = -1; /* the live swallow owns the uniform */
    } else if (pu.uDir.value > 0 && this.kamuiVacuumTail >= 0) {
      /* the timer just expired at full throat — unwind uVac with the same
         decay the glow is already riding (no single-frame cut) */
      this.kamuiVacuumTail = Math.max(0, this.kamuiVacuumTail - dt);
      pu.uVac.value = this.kamuiVacuumTail;
      this.kamuiSwallowFactor += (1 - this.kamuiSwallowFactor) * Math.min(1, dt * 9);
      if (Math.abs(1 - this.kamuiSwallowFactor) < 0.002) {
        this.kamuiSwallowFactor = 1;
        this.kamuiSwallowGroup = null;
      }
    } else {
      pu.uVac.value = 0;
      if (this.kamuiSwallowGroup) {
        this.kamuiSwallowFactor += (1 - this.kamuiSwallowFactor) * Math.min(1, dt * 9);
        if (Math.abs(1 - this.kamuiSwallowFactor) < 0.002) {
          this.kamuiSwallowFactor = 1;
          this.kamuiSwallowGroup = null;
        }
      }
    }
    /* the instability — a decaying rumble on the camera itself (applied
       after the rig's own write, so the shake rides the final transform) */
    if (this.kamuiShakeT > 0) {
      this.kamuiShakeT = Math.max(0, this.kamuiShakeT - dt / 0.8);
      const amp = this.rig.dist() * 0.006 * this.kamuiShakeT * this.kamuiShakeT;
      this.camera.position.x += (Math.random() - 0.5) * 2 * amp;
      this.camera.position.y += (Math.random() - 0.5) * 2 * amp;
      this.camera.position.z += (Math.random() - 0.5) * 2 * amp;
    }
  }

  /** KAMUI (v1) — Space-Time Vortex Distortion: the red demonic vortex tears
      the screen around the current kamui source — the clicked body's center,
      the diving galaxy's disc, or the view center for stage warps and jumps.
      `reverse` spins the same vortex the other way and ejects space outward
      instead of imploding — the close/return face of the jutsu. */
  triggerKamui(targetUv?: THREE.Vector2, reverse = false) {
    this.portalPass.uniforms.uDir.value = reverse ? -1 : 1;
    this.kamuiTwist = reverse ? 1 : 0; /* the eject bursts at full twist */
    this.kamuiVacuumTail = -1; /* a fresh tear owns the throat — no stale unwind */
    if (reverse) this.kamuiShakeT = 1; /* the eject burst shocks the frame */
    if (targetUv) {
      (this.portalPass.uniforms.uCenter.value as THREE.Vector2).copy(targetUv);
    } else if (this.resolveKamuiSource(this._vScratch4)) {
      this._vScratch4.project(this.camera);
      if (this._vScratch4.z < 1) {
        (this.portalPass.uniforms.uCenter.value as THREE.Vector2).set(this._vScratch4.x * 0.5 + 0.5, this._vScratch4.y * 0.5 + 0.5);
      } else {
        (this.portalPass.uniforms.uCenter.value as THREE.Vector2).set(0.5, 0.5);
      }
    } else {
      (this.portalPass.uniforms.uCenter.value as THREE.Vector2).set(0.5, 0.5);
    }
    (this.portalPass.uniforms.uColor.value as THREE.Color).set('#ff1744');
    this.kamuiTimer = reverse ? KAMUI_REVERSE_DURATION : KAMUI_TRIGGER_DURATION;
    /* the DOM swallow needs the tear's screen position — the CSS kamui-suck
       collapses toward this exact point (GL y-up flipped to CSS y-down) */
    const uv = this.portalPass.uniforms.uCenter.value as THREE.Vector2;
    this.cb.onKamuiTrigger?.(reverse, { x: uv.x, y: 1 - uv.y });
  }


  private updateBodies(dt: number) {
    const sysW = 1 - smoothstep(430, 860, this.currentDist());

    /* C++ accelerator refresh — every other frame, non-blocking. The native
       core batch-evaluates every orbit; results land one tick later, which is
       visually seamless. Web without WASM never enters this path. */
    const accelActive = this.keplerCache.valid && Math.abs(this.keplerCache.simDays - this.simDays) < 0.25;
    this.keplerFrame++;
    if (this.keplerFrame % 2 === 0 && !this.keplerCache.inflight) {
      void this.refreshKeplerCache();
    }

    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      const o = b.data.orbit;
      let px: number, py: number, pz: number;
      if (accelActive && this.keplerCache.xyz.length >= (i + 1) * 3) {
        px = this.keplerCache.xyz[3 * i];
        py = this.keplerCache.xyz[3 * i + 1];
        pz = this.keplerCache.xyz[3 * i + 2];
      } else {
        const phys = calculatePhysics(b.data, this.simDays);
        const pos = calculateKeplerPosition(o.a, phys.eccentricity, o.phase, o.incl, this.simDays, o.speed || 0.01);
        px = pos.x; py = pos.y; pz = pos.z;
      }
      b.group.position.set(px, py, pz);
      /* THE BIRTH — during the ejection every world flies outward from the
         single center point in a swirling bend: the orbit unwinds as it
         expands, so the system pours out of the point spinning */
      if (this.bootIntro && this.birthK < 1) {
        const e = 1 - Math.pow(1 - this.birthK, 3); /* ease-out: fast burst, settling */
        b.group.position.multiplyScalar(e);
        const unwind = (1 - e) * 2.8; /* the swirl unwinds as it ejects */
        const px = b.group.position.x, pz = b.group.position.z;
        b.group.position.x = px * Math.cos(unwind) - pz * Math.sin(unwind);
        b.group.position.z = px * Math.sin(unwind) + pz * Math.cos(unwind);
      }


      b.group.getWorldPosition(this._vScratch2);
      this._vScratch1.copy(this._vScratch2).multiplyScalar(-1).normalize();

      /* ghost + fade lerps */
      b.ghost += (b.ghostTarget - b.ghost) * Math.min(1, dt * 3);
      b.fade += (b.fadeTarget - b.fade) * Math.min(1, dt * 3);

      /* hover channel ONLY — the orbit line must never be pinned by a click */
      b.hoverT += ((this.hoveredId === b.data.id ? 1 : 0) - b.hoverT) * Math.min(1, dt * 8);

      if (b.mat) {
        if (b.mat.uniforms.uSunDir) (b.mat.uniforms.uSunDir.value as THREE.Vector3).copy(this._vScratch1);
        if (b.mat.uniforms.uTime) b.mat.uniforms.uTime.value = this.clockT;
        if (b.mat.uniforms.uGhost) b.mat.uniforms.uGhost.value = b.ghost;
        if (b.mat.uniforms.uFade) b.mat.uniforms.uFade.value = b.fade * sysW;
        if (b.mat.uniforms.uTear) b.mat.uniforms.uTear.value = 0;
        if (b.mat.uniforms.uTearTime) b.mat.uniforms.uTearTime.value = this.clockT;
        this.applyKamuiFieldUniforms(b.mat);
        this.setKamuiLocalCenter(b.mat, b.spinMesh);
        if (b.mat.uniforms.uCamLocalP && b.data.kind === 'nebula') {
          this._vScratch3.copy(this.camera.position);
          b.group.worldToLocal(this._vScratch3);
          (b.mat.uniforms.uCamLocalP.value as THREE.Vector3).copy(this._vScratch3);
        }
      }
      b.extras?.forEach((m) => { m.uniforms.uTime.value = this.clockT; });

      /* axial rotation — the surface turns under the fixed sun */
      if (b.spinMesh && b.spinRate) b.spinMesh.rotation.y += dt * b.spinRate;
      if (b.cloudMesh && b.cloudSpinRate) b.cloudMesh.rotation.y += dt * b.cloudSpinRate;

      if (b.cloudMat) {
        b.cloudMat.uniforms.uTime.value = this.clockT;
        (b.cloudMat.uniforms.uSunDir.value as THREE.Vector3).copy(this._vScratch1);
        b.cloudMat.uniforms.uFade.value = b.fade * sysW * (1 - b.ghost);
        if (b.cloudMat.uniforms.uTear) b.cloudMat.uniforms.uTear.value = 0;
        this.applyKamuiFieldUniforms(b.cloudMat);
        b.cloudMat.visible = b.cloudMat.uniforms.uFade.value > 0.02;
      }
      if (b.atmo) {
        const atmoMat = b.atmo.material as THREE.ShaderMaterial;
        (atmoMat.uniforms.uSunDir.value as THREE.Vector3).copy(this._vScratch1);
        if (atmoMat.uniforms.uTear) atmoMat.uniforms.uTear.value = 0;
        this.applyKamuiFieldUniforms(atmoMat);
        b.atmo.visible = b.fade * sysW * (1 - b.ghost) > 0.05;
      }
      if (b.ringMat) {
        b.ringMesh!.getWorldQuaternion(this._qScratch).invert();
        (b.ringMat.uniforms.uSunLocal.value as THREE.Vector3).copy(this._vScratch1).applyQuaternion(this._qScratch);
        this.applyKamuiFieldUniforms(b.ringMat);
        this.setKamuiLocalCenter(b.ringMat, b.ringMesh);
        b.ringMesh!.visible = b.fade * sysW * (1 - b.ghost * 0.85) > 0.05;
      }

      b.moons.forEach((m) => {
        const ma = m.phase + this.simDays * m.speed;
        /* each moon rides its OWN inclined plane — no shared moon-sheet */
        m.mesh.position.set(
          Math.cos(ma) * m.a,
          Math.sin(ma * 0.7) * m.a * 0.12 * Math.cos(m.incl ?? 0) + Math.sin(ma) * m.a * Math.sin(m.incl ?? 0),
          Math.sin(ma) * m.a * Math.cos(m.incl ?? 0),
        );
        m.mesh.visible = b.fade * sysW * (1 - b.ghost) > 0.05;
      });

      if (b.orbitLine) {
        /* the orbit ring is driven ONLY by hover. Gate on .visible too so an
           opacity-0 line can never render — it must vanish the instant the
           pointer leaves the world. Selection pulses the body, never the ring. */
        const op = b.hoverT * sysW * 0.22;
        (b.orbitLine.material as THREE.LineBasicMaterial).opacity = op;
        b.orbitLine.visible = op > 0.01;
      }

      const selected = this.selectedId === b.data.id ? 1 : 0;
      const pulse = selected ? 1 + 0.025 * Math.sin(this.clockT * 3.2) : 1;
      b.group.scale.setScalar((1 + Math.max(b.hoverT, selected * 0.5) * 0.035) * pulse * (1 - b.ghost * 0.35) * this.kamuiSwallowFactorFor(b.group));
      b.group.visible = b.fade * sysW > 0.03;

      if (b.streakRing) {
        const mat = b.streakRing.material as THREE.MeshBasicMaterial;
        const st = b.streakTarget ?? 0;
        const days = b.streakDays ?? 0;
        /* alive whenever this world has been written on; a live streak makes it
           distinctly brighter, and total devotion adds a warm base glow */
        const target = days > 0 ? Math.min(0.95, 0.22 + 0.16 * st + 0.02 * days) : 0;
        mat.opacity += (target - mat.opacity) * Math.min(1, dt * 3.5);
        /* breathe + shimmer so it never reads as a static decal */
        const breath = 1 + 0.022 * Math.sin(this.clockT * 1.8 + b.data.id.length);
        mat.opacity = Math.max(0, mat.opacity + 0.05 * target * Math.sin(this.clockT * 3.1));
        b.streakRing.scale.setScalar(breath);
        b.streakRing.rotation.z += dt * 0.25;
        b.streakRing.visible = mat.opacity > 0.02 && b.fade * sysW > 0.03;
      }

      /* Round 54 — the geodesic uniforms are driven by the late-tick pass
         (see tick): the vault ephemeris re-places bodies after this loop,
         so a per-body call here read a matrix seconds stale. */
    }

    /* anchor — axial spin, then GRAVITY MADE VISIBLE: the star's barycentric
       wobble, the real radial-velocity method used to find exoplanets. Every
       major world tugs the star with amplitude ∝ m_p/a, each tug advancing at
       that world's own orbital rate — quasi-periodic drift, not a loop. */
    this.anchorGroup.rotation.y += dt * 0.08; /* Axial rotation around polar axis */
    if (!this.coreActive) {
      let wobbleX = 0, wobbleY = 0, wobbleZ = 0;
      for (let i = 0; i < this.bodies.length; i++) {
        const wb = this.bodies[i];
        /* planets, dwarfs AND the vault black hole — every mass tugs the star */
        if (wb.data.kind !== 'planet' && wb.data.kind !== 'dwarf' && wb.data.kind !== 'vault') continue;
        const aAU = Math.max(0.1, wb.data.orbit.a / 52); /* Aurelia = 1 AU */
        const mEarth = Math.pow(Math.max(0.05, wb.data.radius / 2.05), 3);
        const amp = Math.min(0.22, 0.028 * (mEarth / aAU));
        const ang = i * 2.39996 + this.simDays * (wb.data.orbit.speed || 0.01);
        const inc = wb.data.orbit.incl;
        wobbleX += Math.cos(ang) * amp;
        wobbleY += Math.sin(ang) * amp * Math.sin(inc);
        wobbleZ += Math.sin(ang) * amp * Math.cos(inc);
      }
      this.anchorGroup.position.set(wobbleX, wobbleY, wobbleZ);


    }
    const starMesh = this.anchorGroup.userData.starMesh as THREE.Mesh;
    if (starMesh) starMesh.rotation.y += dt * 0.15;

    this.starUniforms.uTime.value = this.clockT;
    const boostTarget = 1 - this.coreT * 0.42;
    this.starUniforms.uBoost.value += (boostTarget - this.starUniforms.uBoost.value) * Math.min(1, dt * 3);
    /* Round 54 — the reference's blaze: his demo runs bloom ≈ 0.68, the
       project baseline (0.18) stays gentle for the planets. While a geodesic
       hole is on stage the strength damps toward the reference value and
       relaxes when you fly away. */
    /* ROUND 64/65 — HIS BLOOM, distance-aware: strength 0.68 (baseline 0.18
       + boost 0.50) and radius 0.2 at the CLOSE encounter (his values,
       eased on as the hole nears), relaxing to the project's gentle baseline
       in wide views — the blaze is for the meeting, not for the whole sky
       (the R65 eye-comfort fix). His THRESHOLD does not port: it is
       scene-dependent — his scene is a hole on black; ours is a hole in a
       living universe. MEASURED TWICE on the GPU probe: his 0.4 floods our
       void to 0.58–0.65 luminance with the reference's own interior at
       0.33; the calibrated 0.90 lands the interior at 0.33 — a dead match.
       The threshold stays 0.90. */
    const holeBoostTarget = this.holeGlowProximity() * 0.5;
    this.bloomHoleBoost += (holeBoostTarget - this.bloomHoleBoost) * Math.min(1, dt * 3);
    this.bloomPass.strength = 0.18 - this.coreT * 0.08 + this.bloomHoleBoost;
    const holeMix = Math.min(1, this.bloomHoleBoost / 0.5);
    this.bloomPass.radius = 0.15 + (0.20 - 0.15) * holeMix;

    const haloA = this.anchorGroup.userData.haloA as THREE.Points;
    const haloB = this.anchorGroup.userData.haloB as THREE.Points;
    haloA.rotation.y += dt * 0.05;
    haloB.rotation.y -= dt * 0.038;
    (haloA.material as THREE.ShaderMaterial).uniforms.uTime.value = this.clockT;
    (haloB.material as THREE.ShaderMaterial).uniforms.uTime.value = this.clockT;
    (haloA.material as THREE.ShaderMaterial).uniforms.uOpacity.value = 1 - this.coreT * 0.5;
    (haloB.material as THREE.ShaderMaterial).uniforms.uOpacity.value = 1 - this.coreT * 0.5;

    /* corona dims with the star while the core is open */
    this.coronaMat.uniforms.uTime.value = this.clockT;
    this.coronaMat.uniforms.uBoost.value = (1 - this.coreT * 0.55) * (0.92 + 0.08 * Math.sin(this.clockT * 0.8));

    this.anchorGroup.visible = sysW > 0.02;
    /* the belt sleeps through the birth too */
    const birthDark = this.bootIntro && this.clockT < 2.4;
    this.belt.visible = sysW > 0.02 && !birthDark;
    this.belt.rotation.y = this.simDays * 0.0016;

    /* the rocks tumble on their own axes — only worked while anyone can see them */
    if (this.belt.visible) {
      this.asteroidInst.forEach(({ mesh, tumbles }) => {
        for (let k = 0; k < tumbles.length; k++) {
          const t = tumbles[k];
          t.q.multiply(this._rockQ.setFromAxisAngle(t.axis, t.speed * dt));
          this._rockM.compose(t.pos, t.q, t.scale);
          mesh.setMatrixAt(k, this._rockM);
        }
        mesh.instanceMatrix.needsUpdate = true;
      });
    }
  }

  /**
   * Batch-evaluate every orbit through the C++ core (native or WASM). The
   * arrays mirror this.bodies order; the tick loop only trusts the cache when
   * its simDays is within a quarter-day of the live sim clock, so a slow IPC
   * round-trip can never freeze the sky.
   */
  private async refreshKeplerCache(): Promise<void> {
    if (!this.bodies.length) return;
    const backend = cosmosBridge.getStatus();
    if (backend.backend === 'typescript') return;
    this.keplerCache.inflight = true;
    try {
      const a: number[] = [];
      const e: number[] = [];
      const phase: number[] = [];
      const incl: number[] = [];
      const speed: number[] = [];
      for (const b of this.bodies) {
        const o = b.data.orbit;
        a.push(o.a);
        let ecc = this.keplerEcc.get(b.data.id);
        if (ecc === undefined) {
          ecc = calculatePhysics(b.data, 0).eccentricity;
          this.keplerEcc.set(b.data.id, ecc);
        }
        e.push(ecc);
        phase.push(o.phase);
        incl.push(o.incl);
        speed.push(o.speed || 0.01);
      }
      const res = await cosmosBridge.keplerBatch({ a, e, phase, incl, speed, simDays: this.simDays });
      /* bodies may have resynced mid-flight — only accept a matching count */
      if (res.xyz.length === this.bodies.length * 3) {
        this.keplerCache.xyz = res.xyz;
        this.keplerCache.simDays = this.simDays;
        this.keplerCache.valid = true;
      }
    } catch {
      this.keplerCache.valid = false;
    } finally {
      this.keplerCache.inflight = false;
    }
  }

  private updateLevels(dt = 0) {    const d = this.currentDist();
    const camLen = this.camera.position.length() + 1;
    const wins = {
      neighborhood: windowFn(d, 260, 750, 4800, 12000),
      galaxy: windowFn(d, 3500, 7500, 38000, 250000),
      /* the deep cluster field fades in AFTER the galaxy band (38k) — its
         sub-halos surround the galaxy-stage camera position, so an early
         ramp painted giant half-transparent smudge rings across the view */
      cluster: windowFn(d, 42000, 60000, 95000, 350000),
      supercluster: windowFn(d, 70000, 100000, 250000, 600000),
      web: windowFn(d, 180000, 280000, 650000, 1200000),
      multiverse: windowFn(d, 340000, 700000, 1e12, 1e12),
    };
    /* Cosmic Web stage — past dial 0.845 the view resolves to PURE web: the
       inner layers (supercluster, clusters, galaxy) hand their weight over
       to the web so nothing of them bleeds into the cosmic web stage. */
    const pureK = THREE.MathUtils.smoothstep(this.rig.tZoomT, 0.845, 0.865);
    if (pureK > 0) {
      wins.web = Math.max(wins.web, pureK);
      wins.supercluster *= 1 - pureK;
      wins.cluster *= 1 - pureK;
      wins.galaxy *= 1 - pureK;
      wins.neighborhood *= 1 - pureK;
    }

    /* the two stages never share the screen — the dial swaps them wholesale */
    if (this.cosmicStage === 'multiverse') {
      wins.neighborhood = 0; wins.galaxy = 0; wins.cluster = 0;
      wins.supercluster = 0; wins.web = 0; wins.multiverse = 1;
    } else {
      wins.multiverse = 0;
    }
    this.gNeighborhood.visible = wins.neighborhood > 0.01;
    /* inner systems live inside this layer but render at system depth (d ~140),
       far below the galaxy window — keep the layer alive while one is held */
    this.gGalaxy.visible = wins.galaxy > 0.01 || this.galaxyInnerFocus;
    this.gCluster.visible = wins.cluster > 0.01;
    this.gSupercluster.visible = wins.supercluster > 0.01;
    this.gWeb.visible = wins.web > 0.01;
    this.gMultiverse.visible = wins.multiverse > 0.01;
    /* the marble hold — one glass marble alone in the darkness (boot intro):
       the whole multiverse shell stays hidden until the fall begins */
    if (this.bootIntro && this.clockT < 2.2) {
      this.gMultiverse.visible = false;
    }
    const isMultiverseMode = wins.multiverse > 0.01;
    if (this.realityGroups) {
      Object.keys(this.realityGroups).forEach((id) => {
        if (this.realityGroups[id]) {
          this.realityGroups[id].visible = isMultiverseMode || (id === this.activeRealityId);
        }
      });
    }

    this.multiverseMats.forEach((m) => {
      m.uniforms.uTime.value = this.clockT;
    });
    if (this.demonCoreMat) {
      this.demonCoreMat.uniforms.uTime.value = this.clockT;
      this.demonCoreMat.uniforms.uHover.value = (this.hoveredId === 'demon-core' ? 1.0 : 0.0);
      this.demonCoreMat.uniforms.uTearStrength.value = this.kamuiEase * 0.9;
    }
    if (this.demonCoreGroup) {
      this.demonCoreGroup.rotation.y += 0.005;

      // Inner golden hyper-octahedron counter-rotation
      if (this.demonCoreInnerGeom) {
        this.demonCoreInnerGeom.rotation.x -= 0.014;
        this.demonCoreInnerGeom.rotation.y += 0.022;
        this.demonCoreInnerGeom.rotation.z += 0.008;
      }

      // 4D Tesseract hypercube matrix rotation
      if (this.demonCoreTesseract) {
        this.demonCoreTesseract.rotation.x += 0.016;
        this.demonCoreTesseract.rotation.y += 0.024;
        this.demonCoreTesseract.rotation.z -= 0.012;
      }

      // Relativistic polar plasma jets flickering / pulsation
      this.demonCoreJets.forEach((jet, idx) => {
        const jetFlicker = 1.0 + 0.18 * Math.sin(this.clockT * 12.0 + idx * Math.PI);
        const jetLength = 1.0 + 0.12 * Math.sin(this.clockT * 6.0 + idx * 2.0);
        jet.scale.set(jetFlicker, jetLength, jetFlicker);
      });

      // 4 Gyroscopic armillary stabilizer rings
      this.demonCoreRings.forEach((ring, idx) => {
        const dir = idx % 2 === 0 ? 1 : -1;
        ring.rotation.z += dir * (0.008 + idx * 0.004);
        ring.rotation.y += (idx % 3 === 0 ? 1 : -1) * 0.006;
        ring.rotation.x += 0.003;
      });

      // Eccentric Tachyon Satellite Probes Orbiting the Core
      this.demonCoreTachyonNodes.forEach((node) => {
        const u = node.userData;
        const a = u.phase + this.clockT * u.speed;
        const tx = Math.cos(a) * u.radius;
        const ty = Math.sin(a) * u.radius * Math.sin(u.incl);
        const tz = Math.sin(a) * u.radius * Math.cos(u.incl);
        node.position.set(tx, ty, tz);
        node.rotation.x += 0.02;
        node.rotation.y += 0.03;
      });

      // 12 Sovereign Monolith Spires (Stabilizer field breathing)
      this.demonCoreSpires.forEach((spire, idx) => {
        const pulse = 1.0 + 0.12 * Math.sin(this.clockT * 2.4 + idx * 0.52);
        spire.scale.set(pulse, 1.0 + 0.08 * Math.sin(this.clockT * 2.0 + idx * 0.3), pulse);
      });

      // Multidimensional Spacetime Gyroscopic Pulse Waves
      this.demonCorePulseRings.forEach((pMesh) => {
        pMesh.userData.phase = (pMesh.userData.phase + 0.006) % 1.0;
        const ph = pMesh.userData.phase as number;
        const currentScaleCrit = 1.0 + ph * 3.2;
        pMesh.scale.set(currentScaleCrit, currentScaleCrit, currentScaleCrit);
        const pMat = pMesh.material as THREE.MeshBasicMaterial;
        pMat.opacity = Math.sin(ph * Math.PI) * 0.55;
        const rotSpd = (pMesh.userData.rotSpeed as number) || 0.005;
        pMesh.rotation.z += rotSpd;
        pMesh.rotation.x += rotSpd * 0.7;
        pMesh.rotation.y += rotSpd * 0.5;
      });
    }

    // Multiverse Stabilization Beams & Traveling Quantum Flux Orbs
    if (this.coreStabilizerBeamMat && wins.multiverse > 0.01) {
      const isHoverCore = this.hoveredId === 'demon-core';
      this.coreStabilizerBeamMat.opacity = (isHoverCore ? 0.85 : 0.35) + 0.1 * Math.sin(this.clockT * 3.0);
    }

    if (this.corePulseOrbs && wins.multiverse > 0.01) {
      this.corePulseOrbs.forEach((orb) => {
        orb.userData.progress = (orb.userData.progress + 0.0035) % 1.0;
        const prog = orb.userData.progress as number;
        const targetPos = orb.userData.targetPos as THREE.Vector3;
        // Interpolate position from Core (0, 0, 0) to target reality position
        orb.position.set(
          targetPos.x * prog,
          targetPos.y * prog,
          targetPos.z * prog
        );
        const orbMat = orb.material as THREE.MeshBasicMaterial;
        orbMat.opacity = Math.sin(prog * Math.PI) * 0.95;
        const orbScale = 1.0 + 0.4 * Math.sin(this.clockT * 4.0 + prog * 6.28);
        orb.scale.set(orbScale, orbScale, orbScale);
      });
    }
    if (this.exoPlates.length) {
      /* fade the horizon plates in as the deep web opens up and out as the
         multiverse scale takes over; sun points back at the camera so the
         procedural surface stays lit from any viewing angle */
      const t = this.rig.tZoomT;
      const band = THREE.MathUtils.smoothstep(t, 0.62, 0.72) * (1 - THREE.MathUtils.smoothstep(t, 0.9, 0.96));
      for (const p of this.exoPlates) {
        p.quaternion.copy(this.camera.quaternion);
        const m = p.material as THREE.ShaderMaterial;
        m.uniforms.uTime.value = this.clockT;
        (m.uniforms.uSunDir.value as THREE.Vector3).copy(this.camera.position).sub(p.position).normalize();
        m.uniforms.uOpacity.value = band * 0.9;
      }
    }
    (this.webLineMat.uniforms.uOpacity as { value: number }).value = wins.web * 0.17;
    this.gWeb.rotation.y = this.clockT * 0.0017;
    this.gSupercluster.rotation.y = this.clockT * 0.0011;
    this.gMultiverse.rotation.y = this.clockT * 0.0008;

    if (this.activeRealityShieldMesh && wins.multiverse > 0.01) {
      this.activeRealityShieldMesh.rotation.y += 0.012;
      this.activeRealityShieldMesh.rotation.z += 0.006;
    }

    /* Pocket Cosmos Marbles — each reality's galaxy turns inside its glass
       shell, shimmering in the reality's two colors */
    this.realityMarbles.forEach((m) => {
      if (wins.multiverse > 0.01 || wins.web > 0.01) {
        m.spiral.rotation.y += dt * m.speed;
        m.glassMat.uniforms.uTime.value = this.clockT;
      }
    });

    /* Orbiting major galaxies — each node rides its ellipse around its reality
       bubble; hover makes the galaxy and its ellipse flare */
    this.galaxyNodes.forEach((node) => {
      const a = node.phase + this.clockT * node.orbitSpeed;
      const ox = Math.cos(a) * node.orbitRadius;
      const oy = Math.sin(a) * node.orbitRadius * Math.sin(node.orbitIncl);
      const oz = Math.sin(a) * node.orbitRadius * Math.cos(node.orbitIncl);
      node.group.position.set(node.centerPos.x + ox, node.centerPos.y + oy, node.centerPos.z + oz);

      // the mini galaxy slowly turns on its own tilted axis
      node.spiralGroup.rotation.y += 0.005;

      const isHovered = this.hoveredId === `galaxy:${node.galaxyData.id}:${node.realityId}`;
      node.group.scale.setScalar((isHovered ? 1.5 : 1.0) * this.kamuiSwallowFactorFor(node.group));
      const lineMat = node.orbitLine.material as THREE.LineBasicMaterial;
      const targetOp = isHovered ? 0.6 : node.galaxyData.isHomeGalaxy ? 0.36 : 0.2;
      lineMat.opacity += (targetOp - lineMat.opacity) * Math.min(1, dt * 8);
      node.glowSprite.material.opacity = isHovered ? 1 : 0.82;
    });

    /* THE ASTRAL CORE — breathing glass heart of the multiverse */
    if (this.astralCoreGroup) {
      this.astralCoreGroup.rotation.y += dt * 0.02;
      const hoverTarget = this.hoveredId === 'multiverse-core' ? 1 : 0;
      this.coreHoverT += (hoverTarget - this.coreHoverT) * Math.min(1, dt * 6);
      this.astralCoreMats.forEach((m) => {
        m.uniforms.uTime.value = this.clockT;
        m.uniforms.uHover.value = this.coreHoverT;
      });
      this.astralCoreHalo.forEach((halo, i) => {
        halo.rotation.y += dt * (i === 0 ? 0.05 : -0.035);
        halo.rotation.x = Math.sin(this.clockT * 0.11 + i) * 0.22;
      });
      this.astralCoreRings.forEach((ring, i) => {
        ring.rotation.z += dt * (0.1 + i * 0.04) * (i % 2 === 0 ? 1 : -1);
        ring.rotation.y += dt * 0.06 * (i % 2 === 0 ? -1 : 1);
      });
      const heart = this.astralCoreGroup.children.find((c) => c instanceof THREE.Sprite) as THREE.Sprite | undefined;
      if (heart) {
        const beat = 1 + 0.05 * Math.sin(this.clockT * 1.4) + this.coreHoverT * 0.12;
        heart.scale.setScalar(96000 * beat);
      }
    }


    this.camera.getWorldDirection(this._vDirScratch);
    const skyVisible = this.cosmicStage !== 'multiverse';
    this.surfaceManager.update({
      kamuiErase: this.membraneShimmer,
      vortexDir: this.kamuiVortexDir,
      dt,
      clockT: this.clockT,
      camera: this.camera,
      skyVisible,
      neighborhoodVisibility: wins.neighborhood,
    });

    if (this.giantMultiverseBoundaryMat) {
      this.giantMultiverseBoundaryMat.uniforms.uTime.value = this.clockT;
    }

    this.clouds.forEach((c) => {
      c.mat.uniforms.uScale.value = (c.px * camLen) / 240;
      c.mat.uniforms.uTime.value = this.clockT;
    });
    /* distance-compensated sizing for level point clouds — the raw 260/z
       attenuation collapses every point to the 1.5px shader floor beyond the
       home system, erasing the galaxy spiral, cluster fields and cosmic web
       at exactly the stages where they should shine. Scaling uScale with
       altitude keeps them at their designed screen size (~2.9× aSize at the
       cloud's center distance; intra-cloud perspective is preserved).
       Modes: 'standard' = the five inner levels, 'multiverse' = already dense
       at its own scale (kept at natural sizing), 'marble' = pocket-cosmos
       spirals inside the glass marbles (~2× aSize at marble viewing range). */
    const lvlScale = camLen / 90;
    this.levelPointMats.forEach((m) => {
      const mode = m.userData.pointMode as string;
      m.uniforms.uScale.value = mode === 'marble' ? camLen / 130 : mode === 'multiverse' ? 1 : lvlScale;
    });
    if (this.giantMultiverseBoundaryMat) {
      this.giantMultiverseBoundaryMat.uniforms.uTime.value = this.clockT;
    }
    this.setLevelOpacity(this.gNeighborhood, wins.neighborhood);
    this.setLevelOpacity(this.gGalaxy, wins.galaxy);
    if (this.galaxyInnerFocus) this.gGalaxy.visible = true; /* setLevelOpacity re-hides it — the inner system lives at system depth */
    this.setLevelOpacity(this.gCluster, wins.cluster);
    this.setLevelOpacity(this.gSupercluster, wins.supercluster);
    this.setLevelOpacity(this.gWeb, wins.web);
    this.setLevelOpacity(this.gMultiverse, wins.multiverse);

    this.levelSprites.forEach((s) => {
      let w = 1;
      if (s.level === 'neighborhood') w = wins.neighborhood;
      if (s.level === 'cluster') w = Math.max(wins.cluster, wins.galaxy * 0.9);
      if (s.level === 'supercluster') w = wins.supercluster;
      if (s.level === 'web') w = wins.web;
      if (s.level === 'multiverse') w = wins.multiverse;
      s.mat.opacity = s.base * w;
    });

    /* per-galaxy core glows fade with the level weight — and while you hold
       one galaxy's frame, its isolated siblings recede to 40% light */
    this.galaxyStageNodes.forEach((n) => {
      n.group.getWorldPosition(this._vScratch2);
      const nodeDist = this.camera.position.distanceTo(this._vScratch2);
      /* the isolated inner system lives only when you dive within its disc */
      const near = nodeDist < 1600;
      if (n.inner.visible !== near) n.inner.visible = near;
      if (near) this.updateInnerSystem(n, dt, nodeDist);
      /* INNER DISSOLVE — while inside the focused realm its disc and core
         glare fade away (the surface-landing grammar), so the star and its
         worlds read crisply instead of drowning in their own galaxy */
      let dim = this.galaxyFocusId && n.data.id !== this.galaxyFocusId ? 0.4 : 1;
      if (this.galaxyInnerFocus && n.data.id === this.galaxyFocusId) {
        dim *= THREE.MathUtils.smoothstep(nodeDist, 400, 1200);
      }
      n.glowMat.opacity = 0.95 * wins.galaxy * dim;
      if (n.discMat.uniforms.uOpacity) n.discMat.uniforms.uOpacity.value = wins.galaxy * dim;
    });

    const beaconW = windowFn(d, 2600, 7000, 64000, 100000);
    this.beacon.visible = beaconW > 0.01;
    (this.beacon.material as THREE.SpriteMaterial).opacity = beaconW;
    this.beacon.scale.setScalar(camLen * 0.011);
    this.gGalaxy.rotation.y = this.clockT * 0.0022;

    /* Scale label covering exact 11-stage cosmological hierarchy:
       STELLAR SYSTEM → STAR-FORMING REGION → SPIRAL ARM → GALACTIC REGION → GALAXY → GALAXY CLUSTER / GALAXY GROUP → SUPERCLUSTER → SUPERCLUSTER COMPLEX → COSMIC WEB → REALITY / UNIVERSE → MULTIVERSE */
    let label = 'STELLAR SYSTEM';
    const fb = this.focusBody();
    if (fb && this.surfaceBlend > 0.5) label = `SURFACE · ${fb.data.name.toUpperCase()}`;
    else if (this.cosmicStage === 'multiverse') label = this.realityFocused ? 'MULTIVERSE' : 'REALITY / UNIVERSE';
    else if (d < 260) {
      if (this.galaxyInnerFocus) {
        const innerNode = this.galaxyStageNodes.find((n) => n.data.id === this.galaxyFocusId);
        label = innerNode ? `STELLAR SYSTEM · ${innerNode.data.lineage.stellarSystem.starName.toUpperCase()}` : 'STELLAR SYSTEM';
      } else {
        label = fb ? `APPROACH · ${fb.data.name.toUpperCase()}` : 'STELLAR SYSTEM';
      }
    }
    else if (d < SCALE_BANDS.starForming) label = 'STAR-FORMING REGION';
    else if (d < SCALE_BANDS.spiralArm) label = 'SPIRAL ARM';
    else if (d < SCALE_BANDS.galacticRegion) label = 'GALACTIC REGION';
    else if (d < SCALE_BANDS.galaxyName) {
      /* the nearest staged major galaxy rides the label — pan between them
         and the name follows, so you always know whose disc you're crossing */
      let nearName: string | null = this.activeGalaxyName;
      let best = Infinity;
      for (const n of this.galaxyStageNodes) {
        n.group.getWorldPosition(this._vScratch2);
        const dd = this.camera.position.distanceTo(this._vScratch2);
        if (dd < best) { best = dd; nearName = n.data.name; }
      }
      label = nearName ? `GALAXY · ${nearName.toUpperCase()}` : 'GALAXY';
    }
    else {
      const high = highScaleLabel(d);
      if (high) label = high;
    }
    if (label !== this.lastLabel) {
      this.lastLabel = label;
      this.cb.onScaleLabel(label);
    }
  }

  private setLevelOpacity(group: THREE.Group, w: number) {
    const isVis = w > 0.001;
    group.visible = isVis;
    if (!isVis) return;
    group.traverse((obj) => {
      if (obj instanceof THREE.Points) {
        const m = obj.material as THREE.ShaderMaterial;
        if (m.uniforms && m.uniforms.uOpacity) m.uniforms.uOpacity.value = w;
      }
    });
  }

  private updateSurface(dt: number) {
    const fb = this.focusBody();
    let s = 0;
    if (fb && (fb.data.kind === 'planet' || fb.data.kind === 'dwarf')) {
      const dist = this.currentDist();
      const r = fb.data.radius;
      s = 1 - smoothstep(r * 1.9, r * 2.7, dist);
    }
    this.surfaceBlend += (s - this.surfaceBlend) * Math.min(1, dt * 4);
    const active = this.surfaceBlend > 0.02;
    this.surface.visible = active;
    if (!active) { this.surfaceLocked = false; return; }
    if (fb) {
      if (!this.surfaceLocked && this.surfaceBlend > 0.06) {
        this._vScratch1.copy(this.camera.position).sub(fb.group.position).normalize();
        this.surfaceQuat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this._vScratch1);
        this.surfaceLocked = true;
      }
      this.surface.position.copy(fb.group.position);
      this.surface.quaternion.slerp(this.surfaceQuat, Math.min(1, dt * 6));
      this.surface.scale.setScalar(fb.data.radius);
      const p = fb.data.palette;
      (this.surfaceMat.uniforms.uDeep.value as THREE.Color).set(p.deep);
      (this.surfaceMat.uniforms.uBase.value as THREE.Color).set(p.base);
      (this.surfaceMat.uniforms.uHigh.value as THREE.Color).set(p.high);
      (this.surfaceMat.uniforms.uIce.value as THREE.Color).set(p.ice);
      (this.skyMat.uniforms.uHorizon.value as THREE.Color).set(p.atmo);
      (this.skyMat.uniforms.uZenith.value as THREE.Color).set(p.deep);
      /* world-space sun direction (terrain normals are world-space) */
      this._vScratch2.copy(fb.group.position).multiplyScalar(-1).normalize();
      (this.surfaceMat.uniforms.uSunDir.value as THREE.Vector3).copy(this._vScratch2);
      (this.skyMat.uniforms.uSunDir.value as THREE.Vector3).copy(this._vScratch2);
      this.surfaceMat.uniforms.uFogDensity.value = 0.03 / fb.data.radius;
      (this.surfaceMat.uniforms.uFog.value as THREE.Color).set(p.atmo).multiplyScalar(0.75);
      this.surfaceParticlesMat.uniforms.uOpacity.value = this.surfaceBlend;
    }
    /* hide planet mesh under surface — but NEVER fade it transparent: the
       sphere stays fully solid through the entire approach, and only swaps
       off at the very end when the surface sky has completely taken over.
       When landed, the planet's SHELL furniture (atmosphere, clouds, rings,
       moons) vanishes too — a translucent atmosphere floating where the
       solid horizon used to be reads as an X-ray planet. */
    const landed = this.surfaceBlend > 0.92;
    if (fb) {
      if (fb.mat && fb.mat.uniforms.uFade) {
        fb.mat.uniforms.uFade.value = landed ? 0 : fb.mat.uniforms.uFade.value;
      }
      if (fb.atmo) fb.atmo.visible = fb.atmo.visible && !landed;
      if (fb.cloudMesh) fb.cloudMesh.visible = fb.cloudMesh.visible && !landed;
      if (fb.ringMesh) fb.ringMesh.visible = fb.ringMesh.visible && !landed;
      fb.moons.forEach((m) => { m.mesh.visible = m.mesh.visible && !landed; });
    }
  }

  private updateCore(dt: number) {
    const target = this.coreActive ? 1 : 0;
    this.coreT += (target - this.coreT) * Math.min(1, dt * 2.6);
    this.connectionMat.opacity = this.coreT * 0.3;
    if (this.coreT > 0.02) {
      const requiredFloats = this.connections.length * 6;
      if (requiredFloats > this._corePosBuffer.length) {
        this._corePosBuffer = new Float32Array(Math.max(requiredFloats * 2, 3000));
        const attr = new THREE.BufferAttribute(this._corePosBuffer, 3);
        attr.setUsage(THREE.DynamicDrawUsage);
        this.connectionLines.geometry.setAttribute('position', attr);
      }
      let idx = 0;
      for (let i = 0; i < this.connections.length; i++) {
        const [ia, ib] = this.connections[i];
        if (ia.ghostTarget > 0.5 || ib.ghostTarget > 0.5) continue; /* link to an un-formed world stays dark */
        ia.group.getWorldPosition(this._vScratch1);
        ib.group.getWorldPosition(this._vScratch2);
        this._corePosBuffer[idx++] = this._vScratch1.x;
        this._corePosBuffer[idx++] = this._vScratch1.y;
        this._corePosBuffer[idx++] = this._vScratch1.z;
        this._corePosBuffer[idx++] = this._vScratch2.x;
        this._corePosBuffer[idx++] = this._vScratch2.y;
        this._corePosBuffer[idx++] = this._vScratch2.z;
      }
      const attr = this.connectionLines.geometry.getAttribute('position') as THREE.BufferAttribute;
      if (attr) {
        attr.needsUpdate = true;
      }
      this.connectionLines.geometry.setDrawRange(0, idx / 3);
    }
    this.connectionLines.visible = this.coreT > 0.02;
  }
  private connections: [RuntimeBody, RuntimeBody][] = [];
  setConnections(pairs: [string, string][]) {
    this.connections = pairs
      .map(([a, b]) => [this.bodies.find((x) => x.data.id === a), this.bodies.find((x) => x.data.id === b)] as [RuntimeBody | undefined, RuntimeBody | undefined])
      .filter((p): p is [RuntimeBody, RuntimeBody] => Boolean(p[0] && p[1]));
  }

  private updateHover() {
    if (!this.pointerMoved && !this.dragging) return;
    this.pointerMoved = false;
    const id = this.pick();
    /* echo hover: resolve to the memory's id so App can show its card */
    this.echoHoverId = id && id.startsWith('echo:') ? id.slice(5) : null;
    if (this.echoHoverId) {
      this.lastEchoHover = true;
      const echo = this.echoMeteors.find((m) => m.entryId === this.echoHoverId);
      this.cb.onHoverEcho?.(echo ? { entryId: echo.entryId, planetId: echo.planetId, title: echo.title } : null, this.mouseScreenX, this.mouseScreenY);
    } else if (this.lastEchoHover) {
      this.cb.onHoverEcho?.(null);
      this.lastEchoHover = false;
    }
    if (id !== this.hoveredId) {
      this.hoveredId = id;
      this.cb.onHover(id, this.mouseScreenX, this.mouseScreenY);
    }
    const canvas = this.renderer.domElement;
    canvas.style.cursor = id ? 'pointer' : this.dragging ? 'grabbing' : 'grab';
  }

  private disposeObject3D(
    root: THREE.Object3D,
    preserve: {
      geometries?: Set<THREE.BufferGeometry>;
      materials?: Set<THREE.Material>;
      textures?: Set<THREE.Texture>;
    } = {},
  ) {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    const preservedGeometries = preserve.geometries ?? new Set<THREE.BufferGeometry>();
    const preservedMaterials = preserve.materials ?? new Set<THREE.Material>();
    const preservedTextures = preserve.textures ?? new Set<THREE.Texture>();

    const collectTexture = (value: unknown) => {
      if (value instanceof THREE.Texture) {
        textures.add(value);
      } else if (Array.isArray(value)) {
        value.forEach(collectTexture);
      }
    };

    const collectMaterial = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach(collectMaterial);
        return;
      }
      if (!(value instanceof THREE.Material) || preservedMaterials.has(value) || materials.has(value)) return;
      materials.add(value);
      const materialRecord = value as unknown as Record<string, unknown>;
      Object.keys(materialRecord).forEach((key) => collectTexture(materialRecord[key]));
      if (value instanceof THREE.ShaderMaterial) {
        Object.values(value.uniforms).forEach((uniform) => collectTexture(uniform.value));
      }
    };

    root.traverse((object) => {
      const renderable = object as THREE.Object3D & { geometry?: unknown; material?: unknown };
      if (renderable.geometry instanceof THREE.BufferGeometry && !preservedGeometries.has(renderable.geometry)) {
        geometries.add(renderable.geometry);
      }
      collectMaterial(renderable.material);
    });

    textures.forEach((texture) => {
      if (!preservedTextures.has(texture)) texture.dispose();
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
      this.clickTimer = null;
    }
    this.renderer.setAnimationLoop(null);
    gravityTelemetry.clear();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.canvas.removeEventListener('dblclick', this.onDoubleClick);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
    window.removeEventListener('resize', this.resize);
    if (this.echoGroup) {
      this.scene.remove(this.echoGroup);
      this.echoGroup.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | undefined;
        if (mat) mat.dispose();
      });
      this.echoGroup = null;
    }
    this.echoMeteors = [];
    this.echoColliders = [];
    this.canvas.style.touchAction = this.originalTouchAction;
    this.rig.dispose();
    this.disposeObject3D(this.scene);
    this.scene.clear();
    this.composer.dispose();
    this.renderer.dispose();
    window.removeEventListener(QUALITY_CHANGE_EVENT, this.onQualityChange);
    window.removeEventListener(RAYMARCH_OVERRIDE_EVENT, this.onTierOverride);
    window.removeEventListener('pagehide', this.onPageHide);
  }
}

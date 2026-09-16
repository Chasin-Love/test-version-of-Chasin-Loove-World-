/// <reference types="vite/client" />
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  starVert, starFrag, planetVert, planetFrag, cloudFrag, atmoFrag,
  ringVert, ringFrag, discFrag, nebulaVert, nebulaFrag, pointsVert, pointsFrag,
  terrainVert, terrainFrag, skyFrag,
  coronaVert, coronaFrag, backdropVert, backdropFrag,
  multiverseVert, multiverseFrag, asteroidVert, asteroidFrag,
  exoplanetPlateVert, exoplanetPlateFrag,
  demonCoreVert, demonCoreFrag,
  multiverseBoundaryVert, multiverseBoundaryFrag,
} from './shaders';
import { UniverseSurfaceManager } from './surface';
import { createBlackHole, type BlackHoleVisual } from './blackhole';
import { CameraRig } from './cameraRig';
import type { CosmicBody } from '../types';
import { REALITIES, RealityConfig, GalaxyClusterData, GalaxyData } from '../realities';
import { generateStellarSystemForGalaxy } from '../realities/galaxyGenerator';
import { calculateKeplerPosition, calculatePhysics } from '../physics/physicsEngine';
import { isPerformanceEnabled, perfMark, perfMeasure, recordFrame } from '../performance';

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
  moons: { mesh: THREE.Mesh; a: number; speed: number; phase: number }[];
  extras?: THREE.ShaderMaterial[];
  orbitLine?: THREE.LineLoop;
  ghost: number;
  ghostTarget: number;
  fade: number;
  fadeTarget: number;
  hoverT: number;
  baseScale: number;
}

/* one Kepler world of a galaxy's REAL isolated inner system — the same
   shader construction as the home anchor system's planets. Nebulae ride the
   same record (their shader carries uCamLocalP instead of uSunDir). */
interface InnerPlanet {
  data: CosmicBody;
  group: THREE.Group;
  mat?: THREE.ShaderMaterial;
  blackHole?: BlackHoleVisual;
  cloudMat?: THREE.ShaderMaterial;
  cloudMesh?: THREE.Mesh;
  atmo?: THREE.Mesh;
  ringMat?: THREE.ShaderMaterial;
  ringMesh?: THREE.Mesh;
  spinMesh?: THREE.Mesh;
  spinRate?: number;
  cloudSpinRate?: number;
  moons: { mesh: THREE.Mesh; a: number; speed: number; phase: number }[];
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

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
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

function makeGlowTexture(size: number, stops: [number, string][]): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, size, size);
  const half = size / 2;
  const radius = half - 1;
  const grad = g.createRadialGradient(half, half, 0, half, half, radius);
  stops.forEach(([p, col]) => grad.addColorStop(p, col));
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
  private bloomPass: UnrealBloomPass;
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
    phase: 'idle' as 'idle' | 'arming' | 'disturbance' | 'deformation' | 'vortex' | 'collapse' | 'opening' | 'hold' | 'out',
    t: 0, fired: false, kind: 'diary' as 'diary' | 'vault', bodyId: '',
  };
  /* Inner-galaxy worlds are synthetic runtime bodies, so their portal target
     must be resolved from the isolated system rather than the home body list. */
  private portalTargetInnerId: string | null = null;
  /* 0..1 visual intensity fed into the actual target body's materials. */
  private portalVisualT = 0;
  private portalProfile: 'normal' | 'vault' = 'normal';
  private portalReturn = false;
  private reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  private portalWasInner = false;
  /* Planet Kamui is a local surface event. It must not take ownership of the
     camera or move the anchor star / hierarchy groups. */
  private portalLocalCenter = new THREE.Vector3();
  private portalGravityUniforms: { center: THREE.Vector3; radius: number; strength: number; time: number } = {
    center: new THREE.Vector3(), radius: 0, strength: 0, time: 0,
  };
  private portalBodyRadius = 0;
  private portalSingularity: { parent: THREE.Group; visual: BlackHoleVisual } | null = null;
  /* +1 = forward traversal (suction), −1 = reverse traversal (the swirl
     unwinds backwards and the field expels matter instead of swallowing). */
  private portalReverse = 1;
  /* Field intensity at the instant the return traversal begins — the reverse
     envelope continues from this level instead of popping. */
  private portalCloseLevel = 0;
  /* 0..1 white-hole ejection pulse during the reverse traversal — pushes the
     captured point clouds back out of the closing aperture. */
  private portalEject = 0;
  /* Point clouds captured when the portal arms; the field pulls their points
     toward the core (visual-only suction, transforms untouched). */
  private portalPointSets: { points: THREE.Points; mat: THREE.ShaderMaterial }[] = [];
  private _vScratch4 = new THREE.Vector3();
  private dragging = false; private lastPX = 0; private lastPY = 0; private downX = 0; private downY = 0; private downT = 0;
  private vaultPulse = 0; /* spikes when the Vault stores/runs something — the black hole reacts */
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
  private exoplanetPlateMat!: THREE.ShaderMaterial;
  private clouds: { mat: THREE.ShaderMaterial; px: number }[] = [];
  private levelSprites: { mat: THREE.SpriteMaterial; base: number; level: 'neighborhood' | 'cluster' | 'supercluster' | 'beacon' | 'web' | 'multiverse' }[] = [];
  /* every Points material inside the six level groups — uScale is
     distance-compensated each frame (see updateLevels) so the galaxy spiral,
     cluster fields and cosmic web keep their designed screen size at their
     own scales instead of collapsing to the 1.5px shader floor. */
  private levelPointMats: THREE.ShaderMaterial[] = [];
  /* Pocket Cosmos Marbles — every reality bubble is a glass universe */
  private realityMarbles: { spiral: THREE.Points; glassMat: THREE.ShaderMaterial; speed: number }[] = [];
  private marbleRingTex: THREE.CanvasTexture | null = null;
  /* Stage system — the Cosmic Web and the Multiverse are two SEPARATE places.
     They are never visible at the same time and the zoom dial never carries
     you between them: the ONLY bridge is the Kamui warp. */
  private cosmicStage: 'web' | 'multiverse' = 'web';
  /* Kamui — the teleportation jutsu. kamuiFlight: 0..1 scripted progress.
     kamuiWarpFx: the tunnel envelope (fov kick + screen swirl). The suck
     drifts the focus along +z into the vortex; the eject throws it along -z. */
  private kamuiFlight: number | null = null;
  private kamuiFromZoom = 0;
  private arrivalZoom = 0.787;
  private warpDir: 'toMultiverse' | 'toWeb' = 'toMultiverse';
  private postWarpZoom: number | null = null;
  private kamuiWarpFx = 0;
  private kamuiEjectK = 0;
  private kamuiSuckDrift = 0;
  private kamuiTunnel!: THREE.Group;
  private kamuiTunnelMats: THREE.ShaderMaterial[] = [];
  /* the cold-open — the first 5.2 seconds are a Kamui arrival: the tunnel
     slows, the walls part, your star ignites, the system builds one world
     at a time, the sky arrives last */
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
  /* the gWeb materials that carry the Kamui tear vortex */
  private webVortexMats: THREE.ShaderMaterial[] = [];
  private beacon!: THREE.Sprite;
  /* focused galaxy-entry tear — deliberately separate from the Cosmic Web /
     Multiverse Kamui so a galaxy click reads as a local surface rupture */
  private galaxyTearGroup = new THREE.Group();
  private galaxyTearMat!: THREE.ShaderMaterial;
  private galaxyEntryFlight: {
    t: number;
    fromDial: number;
    toDial: number;
    center: THREE.Vector3;
    galaxyId: string | null;
    radius: number;
    endInner: boolean;
  } | null = null;
  private surface = new THREE.Group();
  private surfaceLocked = false;
  private surfaceQuat = new THREE.Quaternion();
  private surfaceMat!: THREE.ShaderMaterial;
  private skyMat!: THREE.ShaderMaterial;
  private surfaceParticlesMat!: THREE.ShaderMaterial;
  private surfaceBlend = 0;
  private activeRealityId = 'sol-prime';
  private activeReality: RealityConfig | null = null;
  private realityGroups: Record<string, THREE.Group> = {};
  private activeRealityShieldMesh: THREE.Group | null = null;
  /* the galaxy the traveler last dove into — pinned to the GALAXY scale label */
  private activeGalaxyName: string | null = null;
  /* THE GALAXY WARP — the Kamui-class reality bend around the galaxy band.
     Crossing into the field folds space in a swirling +z bend; diving
     through it counter-folds along −z and the stellar system appears. */
  private galaxyWarp: {
    dir: 'arrive' | 'descend' | 'ascend';
    t: number;
    fromDial: number;
    toDial: number;
    center: THREE.Vector3;
    endInner: boolean;
  } | null = null;
  private galaxyWarpDrift = 0;
  /* previous zoom-dial target — the warp triggers live on its crossings */
  private prevDialTarget = 0.15;
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
  /* a band crossing that was blocked by grab-cooldown — fires when the
     cooldown expires so leaving a system always replays the return bend */
  private bandLatch: { dir: 'arrive' | 'up' | 'down'; at: number } | null = null;
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
  private kamuiErase = 0;
  private demonCoreLight!: THREE.PointLight;
  private demonCoreCollider!: THREE.Mesh;

  private lastLabel = '';
  private lastDateSent = 0;
  private clockT = 0;
  private disposed = false;
  private canvas: HTMLCanvasElement;
  private originalTouchAction = '';

  private onVaultPulse = (event: Event) => {
    const detail = (event as CustomEvent<{ intensity?: number }>).detail;
    this.vaultPulse = Math.min(1.5, this.vaultPulse + (detail?.intensity ?? 1));
  };

  private onContextLost = (event: Event) => {
    event.preventDefault();
  };

  private onContextRestored = () => {
    if (!this.disposed) this.renderer.compile(this.scene, this.camera);
  };

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
    const maxPixelRatio = lowPowerDevice ? 1 : 1.35;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPowerDevice, powerPreference: lowPowerDevice ? 'default' : 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setClearColor('#04060c', 1);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 8000000);
    this.rig = new CameraRig(this.camera, canvas);
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
    this.buildKamuiTunnel();
    this.buildGalaxyTear();
    this.buildIntroMarble();
    this.scene.add(this.camera); /* the tunnel rides the camera — it must live in the scene graph */

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
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.12, 0.15, 0.90);
    this.composer.addPass(this.bloomPass);
    /* No full-screen Kamui pass: local Planet/Vault Kamui is rendered by the
       target body, its singularity, and the world-space gravity field. */
    this.composer.addPass(new OutputPass());

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
    };

    /* the Vault black hole feeds on activity — store/extract/run events pulse it */
    window.addEventListener('eventide-vault-pulse', this.onVaultPulse);

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

  private pointsMaterial(px: number, twinkle: boolean): THREE.ShaderMaterial {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uScale: { value: 1 }, uTime: { value: 0 }, uTwinkle: { value: twinkle ? 1 : 0 }, uOpacity: { value: 1 },
        uVortexC: { value: new THREE.Vector3() }, uVortexR: { value: 0 }, uVortexS: { value: 0 }, uVortexT: { value: 0 }, uVortexPull: { value: 0 },
        uVortexRev: { value: 1 },
      },
      vertexShader: pointsVert, fragmentShader: pointsFrag,
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

  private makePoints(count: number, posFn: (i: number, arr: Float32Array) => void, sizeFn: (i: number) => number, colFn: (i: number) => [number, number, number], alphaFn: (i: number) => number, px: number, twinkle: boolean): THREE.Points {
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
    return new THREE.Points(g, this.pointsMaterial(px, twinkle));
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
      1.5, true,
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
      uniforms: { uTime: { value: 0 }, uBoost: { value: 1 } },
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
      (pts.material as THREE.ShaderMaterial).userData.immuneToVortex = true;
      pts.userData.immuneToVortex = true;
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
          uTear: { value: 0 }, uTearTime: { value: 0 },
          uGravityCenter: { value: new THREE.Vector3() }, uGravityLocalCenter: { value: new THREE.Vector3() },
          uGravityRadius: { value: 0 },
          uGravityStrength: { value: 0 }, uGravityTime: { value: 0 },
          uReverse: { value: 1 },
          uNight: { value: data.nightside ? 1 : 0 },
          uSeed: { value: new THREE.Vector3(hash(data.id.length, 3) * 40, hash(7, data.id.length) * 40, hash(data.id.length, 11) * 40) },
        },
        vertexShader: planetVert, fragmentShader: planetFrag, transparent: true,
      });
      /* tilted spin axis — the world turns under a fixed sun */
      const tilt = new THREE.Group();
      tilt.rotation.z = 0.35 + hash(data.id.length, 2) * 0.5;
      g.add(tilt);
      /* Extra tessellation is intentional: Kamui displaces the actual sphere
         in object space, so the surface needs vertices to bend. */
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(data.radius, 64, 48), mat);
      tilt.add(mesh);
      rb.mat = mat;

      /* each world keeps its own day length */
      const retrograde = hash(3, data.id.length) > 0.82 ? -1 : 1;
      rb.spinMesh = mesh;
      rb.spinRate = retrograde * (Math.PI * 2) / (24 + hash(data.id.length, 5) * 52);

      if (data.clouds) {
        const cm = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3(1, 0, 0) },
            uSeed: { value: new THREE.Vector3(3.7, 8.1, 1.9) }, uCover: { value: data.id === 'veil' ? 0.95 : 0.5 },
            uFade: { value: 1 }, uTear: { value: 0 }, uTearTime: { value: 0 },
            uGravityCenter: { value: new THREE.Vector3() }, uGravityLocalCenter: { value: new THREE.Vector3() },
            uGravityRadius: { value: 0 }, uGravityStrength: { value: 0 }, uGravityTime: { value: 0 },
            uReverse: { value: 1 },
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
          uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uTear: { value: 0 }, uTearTime: { value: 0 },
          uGravityCenter: { value: new THREE.Vector3() }, uGravityLocalCenter: { value: new THREE.Vector3() },
          uGravityRadius: { value: 0 },
          uGravityStrength: { value: 0 }, uGravityTime: { value: 0 },
          uReverse: { value: 1 },
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
            uGravityLocalCenter: { value: new THREE.Vector3() }, uGravityStrength: { value: 0 },
            uGravityTime: { value: 0 }, uReverse: { value: 1 },
          },
          vertexShader: ringVert, fragmentShader: ringFrag,
          transparent: true, depthWrite: false, side: THREE.DoubleSide,
        });
        const ringMesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 96, 1), rm);
        ringMesh.rotation.x = -Math.PI / 2 + 0.32;
        ringMesh.renderOrder = 3;
        g.add(ringMesh);
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
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.15, 48, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      g.add(sphere);
      const discM = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 }, uInner: { value: 1.5 }, uOuter: { value: 6.2 },
          uColor: { value: new THREE.Color('#fa8c2e') }, uColor2: { value: new THREE.Color('#ffe6b8') },
        },
        vertexShader: ringVert, fragmentShader: discFrag,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const disc = new THREE.Mesh(new THREE.RingGeometry(1.5, 6.2, 96, 1), discM);
      disc.rotation.x = -Math.PI / 2 + 0.5;
      disc.renderOrder = 4;
      g.add(disc);
      rb.mat = discM;
      const photon = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTexture(128, [[0, 'rgba(0,0,0,0)'], [0.3, 'rgba(255,190,110,0.7)'], [0.42, 'rgba(255,170,90,0.18)'], [1, 'rgba(255,150,70,0)']]),
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
      }));
      photon.scale.setScalar(6.5);
      g.add(photon);
    } else if (data.kind === 'vault') {
      /* the Universal Vault — Gargantua: composite black hole (baked
         blackbody disk, photon ring, lensed arcs) built from driver-proof
         primitives; the ray-march shader variant is retired */
      const R = data.radius;
      const bh = createBlackHole(R);
      g.add(bh.group);

      /* slim lattice torii kept as the Vault activity pulse feedback */
      const latticeMat = new THREE.MeshStandardMaterial({ color: 0x0c1418, emissive: new THREE.Color('#6fc2b4'), emissiveIntensity: 1.8, metalness: 0.7, roughness: 0.35 });
      const r1 = new THREE.Mesh(new THREE.TorusGeometry(R * 1.9, 0.04, 8, 110), latticeMat);
      const r2 = new THREE.Mesh(new THREE.TorusGeometry(R * 2.4, 0.026, 8, 110), latticeMat.clone());
      r1.rotation.x = 1.1; r2.rotation.x = -0.7; r2.rotation.y = 0.6;
      g.add(r1, r2);

      g.userData.spin = { r1, r2 };
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
    (dust.material as THREE.ShaderMaterial).userData.immuneToVortex = true;
    dust.userData.immuneToVortex = true;
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
        uColorA: { value: new THREE.Color('#06b6d4') },
        uColorB: { value: new THREE.Color('#8b5cf6') },
        uKamuiErase: { value: 0 },
        uVortexDir: { value: new THREE.Vector3(0, 0, -1) },
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
          1.5, true,
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
      () => 0.35 + R() * 0.55, 2.2, true,
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
      () => 0.4 + R() * 0.5, 2.0, true,
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

    /* collect the gWeb materials that carry the Kamui tear vortex — the
       filaments and the node clouds all spiral into the tear together */
    this.gWeb.traverse((obj) => {
      const m = (obj as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
      if (m && m.uniforms && m.uniforms.uVortexS && !this.webVortexMats.includes(m)) this.webVortexMats.push(m);
    });

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
      true,
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
      () => 0.22 + R() * 0.5, 1.8, true,
    );
    this.gWeb.add(webPts);

    /* cluster knots at high-degree intersection nodes */
    const knot = this.makePoints(
      NODES,
      (i, a) => { a[i * 3] = nodes[i].x; a[i * 3 + 1] = nodes[i].y; a[i * 3 + 2] = nodes[i].z; },
      (i) => 2.0 + degree[i] * 0.55,
      (i) => { const c = nodeCol[i]; return [c.r, c.g, c.b] as [number, number, number]; },
      () => 0.6 + R() * 0.4, 2.8, true,
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
    /* the web filaments share the Kamui tear vortex — during the jutsu they
       bend, swirl and spiral into the tear point with the same wave */
    this.webLineMat = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0 },
        uVortexC: { value: new THREE.Vector3() }, uVortexR: { value: 0 }, uVortexS: { value: 0 }, uVortexT: { value: 0 },
      },
      vertexShader: `
        uniform vec3 uVortexC; uniform float uVortexR; uniform float uVortexS; uniform float uVortexT;
        varying vec3 vColor; varying float vFade;
        void main(){
          vColor = color;
          vec3 vp = position;
          float d = distance(vp, uVortexC);
          float infl = uVortexS * smoothstep(uVortexR, uVortexR * 0.1, d);
          if (infl > 0.001) {
            vec3 axis = normalize(vec3(0.18, 1.0, 0.12));
            vec3 dir = vp - uVortexC;
            float a = infl * (5.0 + uVortexT * 3.5);
            vec3 spun = dir * cos(a) + cross(axis, dir) * sin(a) * 1.15;
            vp = uVortexC + spun * (1.0 - infl * 0.5);
            vFade = 1.0 - infl * 0.6;
          } else { vFade = 1.0; }
          gl_Position = projectionMatrix * modelViewMatrix * vec4(vp, 1.0);
        }`,
      fragmentShader: `
        uniform float uOpacity; varying vec3 vColor; varying float vFade;
        void main(){ gl_FragColor = vec4(vColor, uOpacity * vFade); }`,
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
      true,
    );
    this.gWeb.add(hubPts);

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
  private buildGalaxyStageContents(reality: RealityConfig) {
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


    const galaxies = reality.galaxies ?? [];
    let seed = 0;
    for (let c2 = 0; c2 < reality.id.length; c2++) seed = (seed * 31 + reality.id.charCodeAt(c2)) >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

    galaxies.forEach((gal, i) => {
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
        () => 0.2 + rnd() * 0.55, 1.7, false,
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
    });

    /* new materials need the distance-compensated uScale driver */
    this.collectPointsMaterials(this.gGalaxyContents, 'galaxyStage', 'standard');
    /* the fresh inner systems need their diary moons / streak rings */
    if (this.lastEntries) this.syncMoons(this.lastEntries);
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
      (pts.material as THREE.ShaderMaterial).userData.immuneToVortex = true;
      pts.userData.immuneToVortex = true;
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

      /* ---- an isolated Eventide Vault keeps the same composite black-hole
             grammar as the home galaxy: horizon, accretion disk, photon ring,
             lensed arcs and the activity lattice. It must not fall through the
             ordinary planet builder just because it lives in another galaxy. */
      if (data.kind === 'vault') {
        const bh = createBlackHole(data.radius);
        g.add(bh.group);
        const latticeMat = new THREE.MeshStandardMaterial({
          color: 0x0c1418,
          emissive: new THREE.Color('#6fc2b4'),
          emissiveIntensity: 1.8,
          metalness: 0.7,
          roughness: 0.35,
        });
        const r1 = new THREE.Mesh(new THREE.TorusGeometry(data.radius * 1.9, 0.04, 8, 110), latticeMat);
        const r2 = new THREE.Mesh(new THREE.TorusGeometry(data.radius * 2.4, 0.026, 8, 110), latticeMat.clone());
        r1.rotation.x = 1.1;
        r2.rotation.x = -0.7;
        r2.rotation.y = 0.6;
        g.add(r1, r2);
        g.userData.spin = { r1, r2 };
        const ip: InnerPlanet = { data, group: g, blackHole: bh, moons: [], hoverT: 0 };
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
          uTear: { value: 0 }, uTearTime: { value: 0 },
          uGravityCenter: { value: new THREE.Vector3() }, uGravityLocalCenter: { value: new THREE.Vector3() },
          uGravityRadius: { value: 0 },
          uGravityStrength: { value: 0 }, uGravityTime: { value: 0 },
          uReverse: { value: 1 },
          uNight: { value: data.nightside ? 1 : 0 },
          uSeed: { value: new THREE.Vector3(hash(data.id.length, 3) * 40, hash(7, data.id.length) * 40, hash(data.id.length, 11) * 40) },
        },
        vertexShader: planetVert, fragmentShader: planetFrag, transparent: true,
      });
      /* tilted spin axis — the world turns under a fixed sun */
      const tilt = new THREE.Group();
      tilt.rotation.z = 0.35 + hash(data.id.length, 2) * 0.5;
      g.add(tilt);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(data.radius, 40, 28), mat);
      tilt.add(mesh);
      const ip: InnerPlanet = { data, group: g, mat, moons: [], hoverT: 0 };
      const retrograde = hash(3, data.id.length) > 0.82 ? -1 : 1;
      ip.spinMesh = mesh;
      ip.spinRate = retrograde * (Math.PI * 2) / (24 + hash(data.id.length, 5) * 52);

      if (data.clouds) {
        const cm = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3(1, 0, 0) },
            uSeed: { value: new THREE.Vector3(3.7, 8.1, 1.9) }, uCover: { value: 0.5 },
            uFade: { value: 1 }, uTear: { value: 0 }, uTearTime: { value: 0 },
            uGravityCenter: { value: new THREE.Vector3() }, uGravityLocalCenter: { value: new THREE.Vector3() },
            uGravityRadius: { value: 0 }, uGravityStrength: { value: 0 }, uGravityTime: { value: 0 },
            uReverse: { value: 1 },
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
          uTear: { value: 0 }, uTearTime: { value: 0 },
          uGravityCenter: { value: new THREE.Vector3() }, uGravityLocalCenter: { value: new THREE.Vector3() },
          uGravityRadius: { value: 0 }, uGravityStrength: { value: 0 }, uGravityTime: { value: 0 },
          uReverse: { value: 1 },
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
            uGravityLocalCenter: { value: new THREE.Vector3() }, uGravityStrength: { value: 0 },
            uGravityTime: { value: 0 }, uReverse: { value: 1 },
          },
          vertexShader: ringVert, fragmentShader: ringFrag,
          transparent: true, depthWrite: false, side: THREE.DoubleSide,
        });
        const ringMesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 96, 1), rm);
        ringMesh.rotation.x = -Math.PI / 2 + 0.32;
        ringMesh.renderOrder = 3;
        g.add(ringMesh);
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
    (beltDust.material as THREE.ShaderMaterial).userData.immuneToVortex = true;
    beltDust.userData.immuneToVortex = true;
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
      p.group.scale.setScalar(1 + p.hoverT * 0.045);

      /* sun direction — world vector from the planet back to its star */
      p.group.getWorldPosition(this._vScratch2);
      this._vScratch1.copy(this._vScratch2).sub(this._vScratch3).normalize().multiplyScalar(-1);
      this._vDirScratch.copy(this._vScratch1).applyQuaternion(this._qScratch);
      const portalTear = this.portalTargetInnerId === p.data.id ? this.portalVisualT : 0;
      if (p.blackHole) {
        /* The isolated system inherits its galaxy's tilt. Convert the camera
           quaternion into this vault's local frame so the lensed arcs remain
           true billboards instead of inheriting that tilt. */
        p.group.getWorldQuaternion(this._qScratch2).invert().multiply(this.camera.quaternion);
        p.blackHole.update(this.clockT, this._qScratch2, portalTear);
        const spin = p.group.userData.spin as { r1: THREE.Mesh; r2: THREE.Mesh } | undefined;
        if (spin) {
          spin.r1.rotation.z += dt * 0.3;
          spin.r2.rotation.x += dt * 0.22;
          const pulse = 1 + Math.sin(this.clockT * 2.2) * 0.018;
          spin.r1.scale.setScalar(pulse);
          spin.r2.scale.setScalar(pulse);
        }
      }
      if (p.mat) {
        if (p.mat.uniforms.uSunDir) (p.mat.uniforms.uSunDir.value as THREE.Vector3).copy(this._vDirScratch);
        p.mat.uniforms.uTime.value = this.clockT;
        if (p.mat.uniforms.uTear) p.mat.uniforms.uTear.value = portalTear;
        if (p.mat.uniforms.uTearTime) p.mat.uniforms.uTearTime.value = this.clockT;
        this.applyPortalGravityUniforms(p.mat);
        this.setPortalLocalCenter(p.mat, p.spinMesh);
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
        if (p.cloudMat.uniforms.uTear) p.cloudMat.uniforms.uTear.value = portalTear;
        if (p.cloudMat.uniforms.uTearTime) p.cloudMat.uniforms.uTearTime.value = this.clockT;
        (p.cloudMat.uniforms.uSunDir.value as THREE.Vector3).copy(this._vDirScratch);
        this.applyPortalGravityUniforms(p.cloudMat);
        this.setPortalLocalCenter(p.cloudMat, p.cloudMesh);
      }
      if (p.cloudMesh && p.cloudSpinRate) p.cloudMesh.rotation.y += dt * p.cloudSpinRate;
      if (p.atmo) {
        const atmoMat = p.atmo.material as THREE.ShaderMaterial;
        (atmoMat.uniforms.uSunDir.value as THREE.Vector3).copy(this._vDirScratch);
        if (atmoMat.uniforms.uTear) atmoMat.uniforms.uTear.value = portalTear;
        if (atmoMat.uniforms.uTearTime) atmoMat.uniforms.uTearTime.value = this.clockT;
        this.applyPortalGravityUniforms(atmoMat);
        this.setPortalLocalCenter(atmoMat, p.atmo);
      }
      if (p.ringMat) {
        p.ringMesh!.getWorldQuaternion(this._qScratch2).invert();
        (p.ringMat.uniforms.uSunLocal.value as THREE.Vector3).copy(this._vScratch1).applyQuaternion(this._qScratch2);
        this.applyPortalGravityUniforms(p.ringMat);
        this.setPortalLocalCenter(p.ringMat, p.ringMesh);
      }
      p.moons.forEach((m) => {
        const ma = m.phase + this.simDays * m.speed;
        m.mesh.position.set(Math.cos(ma) * m.a, Math.sin(ma * 0.7) * m.a * 0.12, Math.sin(ma) * m.a);
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
      false,
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

  /** The Kamui tunnel — a round, unstable, high-torque fold in spacetime.
      Built as a child of the CAMERA so it always surrounds the view; the
      warp script sweeps it past the camera while two counter-rotating
      wobble layers spin with great torque. */
  private buildKamuiTunnel() {
    const mkLayer = (radius: number, len: number, phase: number): THREE.Mesh => {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 }, uSpin: { value: 0 }, uOpacity: { value: 0 }, uPhase: { value: phase },
          uColorA: { value: new THREE.Color('#38bdf8') }, uColorB: { value: new THREE.Color('#8b5cf6') },
        },
        vertexShader: `
          varying vec2 vUv; varying float vW;
          uniform float uTime;
          void main(){
            vUv = uv;
            vec3 p = position;
            /* unstable — the wall radius breathes and shakes */
            float w = sin(uv.x * 18.849 + uTime * 7.0) * 0.5 + sin(uv.y * 40.0 - uTime * 11.0) * 0.5;
            p.xy *= 1.0 + w * 0.09;
            vW = w;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }`,
        fragmentShader: `
          varying vec2 vUv; varying float vW;
          uniform float uTime; uniform float uSpin; uniform float uOpacity; uniform float uPhase;
          uniform vec3 uColorA; uniform vec3 uColorB;
          void main(){
            /* high-torque swirling bands streaming down the tunnel */
            float bands = 0.5 + 0.5 * sin((vUv.x * 16.0 + uSpin * 1.4 + uPhase + vW * 1.6) * 6.2831);
            float flow  = 0.5 + 0.5 * sin((vUv.y * 36.0 - uTime * 16.0 + vUv.x * 10.0) * 6.2831);
            vec3 col = mix(uColorA, uColorB, 0.35 + 0.4 * bands);
            col += vec3(1.0, 0.97, 0.9) * pow(bands, 3.0) * 0.9;
            float ends = smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.78, vUv.y);
            float a = (0.30 + bands * 0.38 + flow * 0.16) * uOpacity * ends;
            gl_FragColor = vec4(col * (0.75 + flow * 0.7), a);
          }`,
        transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 64, 20, true), mat);
      mesh.rotation.x = Math.PI / 2; /* length runs along the view axis */
      return mesh;
    };

    this.kamuiTunnel = new THREE.Group();
    const outer = mkLayer(300000, 3200000, 0);
    const inner = mkLayer(252000, 3200000, 0.5);
    this.kamuiTunnelMats.push(outer.material as THREE.ShaderMaterial, inner.material as THREE.ShaderMaterial);
    this.kamuiTunnel.add(outer, inner);
    this.kamuiTunnel.visible = false;
    this.camera.add(this.kamuiTunnel);
  }

  /** A local Kamui tear for galaxy entry. Unlike the dimensional Kamui,
      this rupture is anchored to the clicked galaxy and stays visible while
      the camera is pulled directly into that galaxy's stellar system. */
  private buildGalaxyTear() {
    this.galaxyTearMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uIntensity: { value: 0 },
        uColorA: { value: new THREE.Color('#38bdf8') },
        uColorB: { value: new THREE.Color('#8b5cf6') },
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime; uniform float uProgress; uniform float uIntensity;
        uniform vec3 uColorA; uniform vec3 uColorB;
        void main(){
          vec2 q = vUv * 2.0 - 1.0;
          float r = length(q);
          float a = atan(q.y, q.x);
          float p = clamp(uProgress, 0.0, 1.0);
          float spin = uTime * (4.5 + 13.0 * p);
          /* The source tears open first; the destination white hole takes over
             after the camera has crossed the darkest part of the fold. */
          float whiteHole = smoothstep(0.57, 0.78, p);
          float source = 1.0 - whiteHole;
          float turbulence = sin(a * 8.0 - spin * 1.7 + r * 26.0)
            + 0.55 * sin(a * 15.0 + spin * 0.9 - r * 43.0)
            + 0.22 * sin(a * 23.0 + spin * 2.7 + r * 71.0);

          /* A ragged event horizon and a flattened, frame-dragged accretion
             disc make this a gravitational surface rupture rather than a flat
             circular portal. */
          float horizonR = mix(0.12, 0.65, p) + turbulence * 0.022 * (0.35 + p * 0.65);
          float horizonRim = exp(-abs(r - horizonR) * (78.0 + p * 48.0));
          float diskR = 0.13 + p * 0.24 + sin(a * 3.0 - spin * 0.45) * 0.018;
          float disk = exp(-abs(r - diskR) * 52.0) * (0.45 + 0.55 * sin(a * 5.0 - spin + r * 15.0));
          disk = max(disk, 0.0);
          float lensRingA = exp(-abs(r - (0.17 + p * 0.23)) * 48.0);
          float lensRingB = exp(-abs(r - (0.30 + p * 0.27)) * 82.0);

          /* Tidal streams stretch along the rotating gravitational field. */
          float stream = pow(max(0.0, sin(a * 7.0 - spin * 1.8 + r * 21.0)), 8.0);
          stream *= smoothstep(0.06, 0.72, r) * (1.0 - smoothstep(0.48, 0.98, r));
          float tearStrands = pow(max(0.0, sin(a * 13.0 + r * 31.0 - spin * 2.4)), 12.0);
          tearStrands *= smoothstep(0.10, 0.66, r) * (1.0 - smoothstep(0.52, 0.96, r));

          vec3 sourceCol = mix(uColorA, uColorB, 0.5 + 0.5 * sin(a * 2.0 + spin * 0.2));
          sourceCol += vec3(0.76, 0.93, 1.0) * (horizonRim * 1.45 + lensRingA * 0.62);
          sourceCol += vec3(1.0, 0.68, 0.28) * (disk * 1.25 + tearStrands * 0.9);
          sourceCol += vec3(0.5, 0.8, 1.0) * (stream * 0.72 + lensRingB * 0.38);

          /* The exit is a white-hole burst: a hot photon ring, radial jets,
             and matter being expelled instead of consumed. */
          float exitR = mix(0.06, 0.48, whiteHole) + turbulence * 0.014;
          float exitRim = exp(-abs(r - exitR) * 92.0);
          float exitCore = exp(-r * (10.0 + whiteHole * 16.0)) * whiteHole;
          float jet = pow(max(0.0, cos(a * 2.0 + spin * 0.65)), 18.0);
          jet *= smoothstep(0.04, 0.62, r) * (1.0 - smoothstep(0.48, 0.92, r));
          vec3 exitCol = vec3(1.0, 0.96, 0.82) * (exitCore * 2.3 + exitRim * 1.55);
          exitCol += mix(vec3(0.28, 0.82, 1.0), vec3(1.0, 0.55, 0.18), 0.5 + 0.5 * sin(a + spin * 0.35)) * jet * 1.4;
          exitCol += vec3(0.75, 0.9, 1.0) * (lensRingA * 0.5 + lensRingB * 0.35) * whiteHole;

          vec3 col = sourceCol * source + exitCol * whiteHole;
          float alpha = (horizonRim * 1.55 + disk * 0.8 + stream * 0.78 + tearStrands * 0.7
            + lensRingA * 0.5 + lensRingB * 0.32) * source;
          alpha += (exitRim * 1.65 + exitCore * 1.5 + jet * 0.9) * whiteHole;
          alpha *= uIntensity * smoothstep(0.0, 0.10, p) * (1.0 - smoothstep(0.50, 1.02, r));
          if (alpha < 0.002) discard;
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
        }`,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.galaxyTearMat);
    mesh.renderOrder = 30;
    this.galaxyTearGroup.add(mesh);
    this.galaxyTearGroup.visible = false;
    this.galaxyTearGroup.frustumCulled = false;
    this.scene.add(this.galaxyTearGroup);
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
    this.pointerMoved = true;
    const pan = e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey);
    if (e.button === 0 || pan) {
      try { this.canvas.setPointerCapture(e.pointerId); } catch { /* capture unsupported */ }
      this.dragging = true;
      this.rig.beginDrag(pan);
      this.lastPX = e.clientX; this.lastPY = e.clientY;
      this.downX = e.clientX; this.downY = e.clientY; this.downT = performance.now();
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    this.mouseScreenX = e.clientX;
    this.mouseScreenY = e.clientY;
    if (this.dragging) {
      const dx = e.clientX - this.lastPX, dy = e.clientY - this.lastPY;
      this.rig.dragMove(dx, dy);
      this.lastPX = e.clientX; this.lastPY = e.clientY;
    }
    this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    this.pointerMoved = true;
  };

  private finishPointerDrag(e: PointerEvent, allowClick: boolean) {
    if (!this.dragging) return;
    this.dragging = false;
    this.rig.endDrag();
    try { this.canvas.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    const moved = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
    if (allowClick && moved < 7 && performance.now() - this.downT < 600 && e.button === 0) this.handleClick();
  }

  private onPointerUp = (e: PointerEvent) => {
    this.finishPointerDrag(e, true);
  };

  private onPointerCancel = (e: PointerEvent) => {
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

  private handleClick() {
    const id = this.pick();
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
            this.prevDialTarget = 0.668;
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
          this.prevDialTarget = 0.668;
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

  resetView() {
    this.cancelGalaxyEntryFlight();
    this.focusId = null;
    this.realityFocused = false;
    this.activeGalaxyName = null;
    this.galaxyFocusId = null;
    this.innerFocusBodyId = null;
    if (this.cosmicStage === 'multiverse') this.beginKamui('toWeb', 0.15);
    else { this.rig.setZoomTarget(0.15); this.rig.setOrbit(null, 1.12); this.rig.clearPan(); }
    this.prevDialTarget = 0.15;
  }
  zoomToMultiverse() {
    this.cancelGalaxyEntryFlight();
    this.focusId = null;
    this.realityFocused = false;
    this.activeGalaxyName = null;
    this.galaxyFocusId = null;
    if (this.cosmicStage === 'web') this.beginKamui('toMultiverse');
    else { this.realityFocused = true; this.rig.setOrbit(null, 1.05); this.rig.setZoomTarget(this.activeReality ? CameraRig.zoomTOf(this.activeReality.bubbleSize * 5.5) : 0.787); }
  }
  zoomToSystem() {
    this.cancelGalaxyEntryFlight();
    this.focusId = null;
    this.realityFocused = false;
    this.activeGalaxyName = null;
    this.galaxyFocusId = null;
    if (this.cosmicStage === 'multiverse') this.beginKamui('toWeb', 0.15);
    else { this.rig.setZoomTarget(0.15); this.rig.setOrbit(null, 1.12); this.rig.clearPan(); }
    this.prevDialTarget = 0.15;
  }
  zoomToHierarchy(stageIndex: number) {
    this.cancelGalaxyEntryFlight();
    this.focusId = null;
    this.rig.clearPan();
    if (stageIndex <= 2 || stageIndex > 6) { this.activeGalaxyName = null; this.galaxyFocusId = null; } /* outside the galaxy's domain */
    if (stageIndex === 0) { this.zoomToMultiverse(); return; }
    if (stageIndex === 1) { // Reality / Universe — multiverse side
      if (this.cosmicStage === 'multiverse') { this.realityFocused = false; this.rig.setZoomTarget(0.88); this.rig.setOrbit(null, 1.05); }
      else this.beginKamui('toMultiverse', 0.88);
      return;
    }
    // stages 2..10 — cosmic web side. Dials calibrated against the scale-label
    // distance windows (dist = 3 · 800000^zoomT) so each stage LANDS inside its
    // own label band: web .858 · complex .842 · supercluster .773 · cluster .722
    // · galaxy .668 · region .589 · arm .503 · nursery .411 · system .15
    const dial = [0, 0.88, 0.858, 0.842, 0.773, 0.722, 0.668, 0.589, 0.503, 0.411, 0.15][stageIndex] ?? 0.15;
    const phi = stageIndex === 6 ? 1.08 : stageIndex <= 8 ? 1.1 : 1.12;
    /* toolbar rides across the galaxy band's edges take the reality bend too */
    const canWarp = this.cosmicStage === 'web' && this.galaxyWarp === null && this.kamuiFlight === null
      && this.portal.phase === 'idle' && !this.bootIntro;
    if (this.galaxyInnerFocus && stageIndex >= 7) return; /* inside an isolated system — the origin-based ladder does not apply */
    if (canWarp && stageIndex === 6) {
      if (this.rig.tZoomT >= 0.70) { this.beginGalaxyWarp('arrive', dial, null); this.prevDialTarget = dial; return; }
      if (this.rig.tZoomT <= 0.585) { this.beginGalaxyWarp('ascend', dial, this.galaxyFocusId, false); this.prevDialTarget = dial; return; }
    }
    if (canWarp && stageIndex >= 7 && this.rig.tZoomT >= 0.60 && this.rig.tZoomT <= 0.70) {
      this.beginGalaxyWarp('descend', dial, null);
      this.prevDialTarget = dial;
      return;
    }
    if (this.cosmicStage === 'multiverse') this.beginKamui('toWeb', dial);
    else { this.realityFocused = false; this.rig.setZoomTarget(dial); this.rig.setOrbit(null, phi); }
    this.prevDialTarget = dial;
  }
  /** fire the Kamui jutsu — the only bridge between the two stages */
  private beginKamui(dir: 'toMultiverse' | 'toWeb', postWarpZoom: number | null = null) {
    if (this.kamuiFlight !== null || this.galaxyEntryFlight !== null) return;
    this.warpDir = dir;
    this.postWarpZoom = postWarpZoom;
    this.kamuiFlight = 0;
    this.kamuiFromZoom = this.rig.zoomT;
    this.grabCooldown = 1.2;
    if (dir === 'toMultiverse') {
      this.realityFocused = false; /* the suck owns the camera until the ejection */
      this.arrivalZoom = this.activeReality ? CameraRig.zoomTOf(this.activeReality.bubbleSize * 5.5) : 0.787;
    }
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
    if (this.cosmicStage === 'multiverse') { this.beginKamui('toWeb', 0.16); return; }
    this.rig.clearPan();
    this.rig.setZoomTarget(Math.min(this.rig.tZoomT, 0.16));
    this.prevDialTarget = this.rig.tZoomT;
  }
  enterCoreMode() {
    this.coreActive = true;
    this.focusId = null;
    this.realityFocused = false;
    if (this.cosmicStage === 'multiverse') this.beginKamui('toWeb', 0.24);
    else this.rig.setZoomTarget(0.24);
    this.prevDialTarget = 0.24;
  }
  exitCoreMode() {
    this.coreActive = false;
  }
  setPaused(p: boolean) { this.paused = p; }
  get pausedNow() { return this.paused; }
  setRendering(v: boolean) { this.rendering = v; }

  setTemporal(asOf: number | null) {
    this.bodies.forEach((b) => {
      const later = asOf !== null && b.data.createdAt > asOf;
      b.ghostTarget = later ? 1 : 0;
      b.fadeTarget = later ? 0 : 1; /* not yet formed → removed from this moment */
    });
  }

  private clearPortalSingularity() {
    if (!this.portalSingularity) return;
    const { parent, visual } = this.portalSingularity;
    parent.remove(visual.group);
    visual.dispose();
    this.portalSingularity = null;
  }

  private preparePortalSingularity(data: CosmicBody) {
    this.clearPortalSingularity();
    /* Vaults already contain their physical black hole. A planet, dwarf,
       nebula, or ordinary hole receives a temporary singularity at its own
       local center, which becomes visible through the torn surface. */
    if (data.kind === 'vault') return;
    let parent: THREE.Group | null = null;
    const home = this.bodies.find((b) => b.data.id === data.id);
    if (home) parent = home.group;
    if (!parent) {
      for (const node of this.galaxyStageNodes) {
        const inner = node.innerSys?.planets.find((p) => p.data.id === data.id);
        if (inner) { parent = inner.group; break; }
      }
    }
    if (!parent) return;
    const visual = createBlackHole(Math.max(0.2, data.radius * 0.14));
    parent.add(visual.group);
    this.portalSingularity = { parent, visual };
  }

  private updatePortalSingularity() {
    if (!this.portalSingularity) return;
    if (this.portal.phase === 'idle') {
      this.clearPortalSingularity();
      return;
    }
    const { parent, visual } = this.portalSingularity;
    parent.getWorldQuaternion(this._qScratch2).invert().multiply(this.camera.quaternion);
    visual.update(this.clockT, this._qScratch2, this.portalVisualT);
  }

  beginPortal(b: { data: CosmicBody }) {
    if (this.portal.phase !== 'idle') return;
    const innerTarget = this.findInnerBody(b.data.id);
    this.portalTargetInnerId = innerTarget ? b.data.id : null;
    if (innerTarget) {
      /* A portal can also be opened by a non-canvas caller. Reassert the
         isolated galaxy frame so the camera cannot fall back to the origin. */
      this.galaxyFocusId = innerTarget.galaxyId;
      this.galaxyInnerFocus = true;
      this.innerFocusBodyId = innerTarget.data.id;
    }
    this.focusId = this.portalTargetInnerId ? null : b.data.id;
    this.realityFocused = false;
    this.cosmicStage = 'web';
    /* Do not zoom, orbit, or hold the camera for a local Planet Kamui. The
       surrounding reality stays spatially fixed while its surface tears. */
    this.portalReturn = false;
    this.portalWasInner = Boolean(innerTarget);
    /* Keep the camera and orbital frame fixed. The gravity field below uses
       this center only to distort the rendered surface locally. */
    if (innerTarget) {
      const innerPlanet = this.galaxyStageNodes
        .flatMap((node) => node.innerSys?.planets ?? [])
        .find((planet) => planet.data.id === b.data.id);
      innerPlanet?.group.getWorldPosition(this.portalLocalCenter);
    } else {
      this.bodies.find((body) => body.data.id === b.data.id)?.group.getWorldPosition(this.portalLocalCenter);
    }
    this.portalProfile = b.data.kind === 'vault' ? 'vault' : 'normal';
    this.portalBodyRadius = Math.max(0.1, b.data.radius);
    this.portal = {
      phase: 'arming', t: 0, fired: false,
      kind: b.data.kind === 'vault' ? 'vault' : 'diary', bodyId: b.data.id,
    };
    this.portalReverse = 1;
    this.portalEject = 0;
    this.portalCloseLevel = 0;
    /* Capture every vortex-capable point cloud once, at arm time: while the
       portal is live the field will bend, spin and draw these points toward
       the core — "everything near it is attracted" — without moving any
       object's transform. Recaptured fresh on each opening. */
    this.portalPointSets.length = 0;
    this.scene.traverse((obj) => {
      if ((obj as THREE.Points).isPoints) {
        const m = (obj as THREE.Points).material as THREE.ShaderMaterial;
        if (m?.uniforms?.uVortexC && m.uniforms.uVortexS && !m.userData?.immuneToVortex && !obj.userData?.immuneToVortex && !this.portalPointSets.some((s) => s.mat === m)) {
          this.portalPointSets.push({ points: obj as THREE.Points, mat: m });
        }
      }
    });
    /* Normal bodies contain an invisible field, not a visible floating hole.
       Vaults retain their authored black-hole geometry as the destination. */
    if (b.data.kind === 'vault') this.preparePortalSingularity(b.data);
  }
  leavePortal() {
    /* The return traversal: the vortex re-forms with its swirl unwinding the
       opposite way, then ejects (white-hole release) and settles to idle. */
    this.portalCloseLevel = this.portal.phase === 'idle' ? 0 : this.portalVisualT;
    this.portalReverse = -1;
    this.portalEject = 0;
    this.portalReturn = true;
    this.portal.phase = 'out';
    this.portal.t = 1;
    this.portal.fired = false;
    /* While the destination was open the forward traversal may have fully
       settled to idle (finishEntry), which clears the inner target and the
       embedded singularity — re-arm both so the reverse has its subject. */
    const inner = this.findInnerBody(this.portal.bodyId);
    if (inner) this.portalTargetInnerId = this.portal.bodyId;
    if (!this.portalSingularity) {
      const target = inner ?? this.bodies.find((b) => b.data.id === this.portal.bodyId);
      if (target) this.preparePortalSingularity(target.data);
    }
  }
  /* called once the destination overlay appears — the distortion settles away */
  finishEntry() {
    this.portalReturn = false;
    this.portal.phase = 'out';
    this.portal.t = Math.max(this.portal.t, 0.62);
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
  }

  /** Dimensional Barrier — strictly isolates state, star spectrum, corona, and local universe to active reality */
  setReality(reality: RealityConfig) {
    perfMark('reality-rebuild-start');
    this.activeRealityId = reality.id;
    this.activeReality = reality;

    // Synchronize Universe Surface (Cosmic Background Canvas)
    if (this.surfaceManager) {
      this.surfaceManager.setReality(reality);
    }

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

    // 3. Sync celestial bodies & diary moons strictly for this reality
    this.syncBodies(reality.bodies);
    this.syncMoons(reality.entries);
    /* rebuild the GALAXY STAGE from this reality's REAL roster — one full
       spiral per major galaxy — and tint the cluster stage's hot gas */
    this.buildGalaxyStageContents(reality);
    const gasTint = new THREE.Color(reality.colorB);
    this.clusterGasMats.forEach((m) => {
      m.color.copy(m.userData.baseColor as THREE.Color).lerp(gasTint, 0.42);
    });
    /* precompile anything this reality added (moons, new materials) so the
       first frame after a reality switch never stalls on shader compilation */
    this.renderer.compile(this.scene, this.camera);

    // 4. Clean up any invalid selection / focus
    if (this.selectedId && !reality.bodies.some((b) => b.id === this.selectedId) && this.selectedId !== 'anchor') {
      this.selectedId = null;
      this.cb.onSelect(null);
    }
    if (this.focusId && !reality.bodies.some((b) => b.id === this.focusId) && this.focusId !== 'anchor') {
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
    perfMeasure('reality-rebuild', 'reality-rebuild-start');
  }


  /**
   * Retained for the Core UI API, but intentionally does not create a
   * screen-space effect. Macro Kamui transitions own their geometry directly.
   */
  triggerKamui(_targetUv?: THREE.Vector2) {
    /* The removed portal compositor used to be driven from here. */
  }

  /** Pan and zoom camera to the supreme Multiverse Core {Demon} */
  zoomToDemonCore() {
    this.focusId = null;
    this.realityFocused = false;
    if (this.cosmicStage === 'web') this.beginKamui('toMultiverse', 0.94);
    else { this.rig.setZoomTarget(0.94); this.prevDialTarget = 0.94; }
    this.rig.setOrbit(0.82, 1.12);
    this.rig.clearPan();
  }

  /** Frame the Astral Core (without the kamui flash) */
  zoomToCore() {
    this.focusId = null;
    this.realityFocused = false;
    if (this.cosmicStage === 'web') this.beginKamui('toMultiverse', 0.93);
    else { this.rig.setZoomTarget(0.93); this.prevDialTarget = 0.93; }
    this.rig.setOrbit(0.85, 1.1);
    this.rig.clearPan();
  }

  /** Pin the galaxy whose name should ride the GALAXY scale label */
  setActiveGalaxy(name: string | null) {
    this.activeGalaxyName = name;
  }

  private cancelGalaxyEntryFlight() {
    const f = this.galaxyEntryFlight;
    if (!f) return;
    this.galaxyEntryFlight = null;
    this.kamuiWarpFx = 0;
    this.galaxyTearGroup.visible = false;
    this.galaxyStagePointMats.forEach(({ mat }) => {
      mat.uniforms.uVortexS.value = 0;
      mat.uniforms.uVortexR.value = 0;
      mat.uniforms.uVortexPull.value = 0;
    });
    if (f.galaxyId) {
      this.galaxyStageNodes.find((n) => n.data.id === f.galaxyId)?.group.scale.setScalar(1);
    }
    this.galaxyInnerFocus = false;
  }

  /** Start the local galaxy-entry Kamui. This is intentionally not the
      Cosmic Web ↔ Multiverse flight: the tear belongs to the clicked galaxy,
      consumes its surrounding galaxy field, and lands at its stellar system. */
  private beginGalaxyEntry(gal: GalaxyData): boolean {
    if (this.galaxyEntryFlight !== null || this.galaxyWarp !== null || this.kamuiFlight !== null || this.portal.phase !== 'idle' || this.bootIntro) return false;
    if (this.cosmicStage !== 'web') return false;
    const node = this.galaxyStageNodes.find((n) => n.data.id === gal.id);
    const center = new THREE.Vector3();
    if (node) node.group.getWorldPosition(center);
    else if (!gal.isHomeGalaxy) return false;
    const radius = node?.radius ?? 5600;
    const endInner = !gal.isHomeGalaxy;
    this.galaxyFocusId = endInner ? gal.id : null;
    this.galaxyInnerFocus = false;
    this.galaxyEntryFlight = {
      t: 0,
      fromDial: this.rig.tZoomT,
      toDial: gal.isHomeGalaxy ? 0.15 : CameraRig.zoomTOf(140),
      center,
      galaxyId: endInner ? gal.id : null,
      radius,
      endInner,
    };
    this.grabCooldown = 1.25;
    this.rig.clearPan();
    this.rig.setOrbit(null, 1.08);
    this.galaxyTearMat.uniforms.uProgress.value = 0;
    this.galaxyTearMat.uniforms.uIntensity.value = 0.25;
    (this.galaxyTearMat.uniforms.uColorA.value as THREE.Color).set(gal.color || this.activeReality?.colorA || '#38bdf8');
    (this.galaxyTearMat.uniforms.uColorB.value as THREE.Color).set(this.activeReality?.colorB || '#8b5cf6');
    this.galaxyTearGroup.visible = true;
    return true;
  }

  /** Animate the clicked galaxy's local surface rupture and suction field. */
  private updateGalaxyEntryFlight(dt: number) {
    const f = this.galaxyEntryFlight;
    if (!f) return;
    f.t = Math.min(1, f.t + dt / 4.6);
    const p = f.t;
    const ease = 1 - Math.pow(1 - p, 3);
    const pulse = Math.sin(Math.min(p, 0.96) / 0.96 * Math.PI);
    const suction = THREE.MathUtils.smoothstep(p, 0.08, 0.52) * (1 - THREE.MathUtils.smoothstep(p, 0.82, 1) * 0.65);
    const ejection = THREE.MathUtils.smoothstep(p, 0.68, 0.88);
    const node = f.galaxyId ? this.galaxyStageNodes.find((n) => n.data.id === f.galaxyId) : null;
    if (node) node.group.getWorldPosition(this._vScratch2);
    else this._vScratch2.copy(f.center);
    f.center.copy(this._vScratch2);

    this.galaxyTearGroup.position.copy(f.center);
    this.galaxyTearGroup.quaternion.copy(this.camera.quaternion);
    this.galaxyTearGroup.rotateZ(dt * (2.0 + p * 9.0));
    const tearSize = f.radius * (0.045 + ease * 1.55 + pulse * 0.18);
    this.galaxyTearGroup.scale.set(tearSize * this.camera.aspect, tearSize, 1);
    this.galaxyTearMat.uniforms.uTime.value = this.clockT;
    this.galaxyTearMat.uniforms.uProgress.value = p;
    this.galaxyTearMat.uniforms.uIntensity.value = 0.55 + pulse * 1.35 + ejection * 0.28;

    /* Every staged galaxy cloud has its own local coordinate system. Reframe
       the vortex center per cloud so neighboring galaxies are visibly pulled
       toward the clicked one instead of merely disappearing behind a screen FX. */
    const vortexRadius = f.radius * (1.8 + p * 18.0);
    this.galaxyStagePointMats.forEach(({ points, mat }) => {
      this._vScratch3.copy(f.center);
      points.worldToLocal(this._vScratch3);
      (mat.uniforms.uVortexC.value as THREE.Vector3).copy(this._vScratch3);
      mat.uniforms.uVortexR.value = vortexRadius;
      mat.uniforms.uVortexS.value = 0.05 + suction * 1.25;
      mat.uniforms.uVortexT.value = this.clockT * 1.8;
      mat.uniforms.uVortexPull.value = 1;
    });
    if (node) {
      node.group.rotation.y += dt * (1.2 + p * 7.0);
      node.group.rotation.z += dt * (0.7 + p * 4.0);
      node.group.scale.setScalar(1 + pulse * 0.42 + suction * 0.14);
    }
    /* The destination system starts to resolve behind the white-hole burst,
       while the final frames still carry the camera through the exit. */
    if (f.endInner && p > 0.82) this.galaxyInnerFocus = true;

    this.rig.killZoomMomentum();
    this.rig.setZoomTarget(THREE.MathUtils.lerp(f.fromDial, f.toDial, ease));
    this.kamuiWarpFx = pulse * 1.18 + ejection * 0.18;
    if (f.t >= 1) {
      this.galaxyEntryFlight = null;
      this.kamuiWarpFx = 0;
      this.galaxyTearGroup.visible = false;
      this.galaxyStagePointMats.forEach(({ mat }) => {
        mat.uniforms.uVortexS.value = 0;
        mat.uniforms.uVortexR.value = 0;
        mat.uniforms.uVortexPull.value = 0;
      });
      if (node) node.group.scale.setScalar(1);
      this.galaxyInnerFocus = f.endInner;
      this.rig.setZoomTarget(f.toDial);
      this.prevDialTarget = this.rig.tZoomT;
    }
  }

  /** THE GALAXY WARP — a scripted 2.6s bend used only when the hierarchy
      navigator crosses the galaxy band. Direct galaxy clicks use the focused
      surface tear above; Cosmic Web ↔ Multiverse keeps its own Kamui flight. */
  private beginGalaxyWarp(dir: 'arrive' | 'descend' | 'ascend', toDial: number, focusGalaxyId: string | null, endInner = false): boolean {
    if (this.galaxyEntryFlight !== null || this.galaxyWarp !== null || this.kamuiFlight !== null || this.portal.phase !== 'idle' || this.bootIntro) return false;
    if (this.cosmicStage !== 'web') return false;
    const center = new THREE.Vector3(0, 0, 0);
    if (focusGalaxyId) {
      const node = this.galaxyStageNodes.find((n) => n.data.id === focusGalaxyId);
      if (node) node.group.getWorldPosition(center);
    }
    this.galaxyFocusId = focusGalaxyId;
    if (!endInner) this.galaxyInnerFocus = false;
    this.galaxyWarp = { dir, t: 0, fromDial: this.rig.tZoomT, toDial, center, endInner };
    this.grabCooldown = 1.0;
    return true;
  }

  /** The return bend — climbing out of a system re-folds the field and lands
      in front of the specific galaxy you visited (or the home galaxy). */
  private fireAscend() {
    this.beginGalaxyWarp('ascend', 0.668, this.galaxyFocusId, this.galaxyInnerFocus);
  }

  /** Dive into a specific major galaxy. EVERY galaxy is a real, isolated
      realm with its own stellar system — so clicking one triggers the bend
      and carries the camera INTO its realm: the disc becomes the sky and the
      galaxy's own star + worlds appear. The home galaxy's realm is the
      anchor star system with all your memory worlds. The galaxy is resolved
      from the engine's own stage (the runtime roster) — the static defaults
      may not know about user-created galaxies. */
  enterGalaxy(realityId: string, galaxyId: string) {
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
      this.galaxyFocusId = gal.id;
      this.beginKamui('toWeb', CameraRig.zoomTOf(26000));
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
    this.prevDialTarget = CameraRig.zoomTOf(150);
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

    /* time */
    const rate = this.paused ? 0 : 6 * this.timeScale * (this.coreActive ? 0.35 : 1);
    this.simDays += dt * rate;
    if (this.clockT - this.lastDateSent > 0.25) {
      this.lastDateSent = this.clockT;
      this.cb.onSimDate(new Date(this.epoch + this.simDays * DAY).toISOString());
    }

    /* Planet/Vault Kamui is a staged field, not an instant overlay. Each
       state has its own timing so disturbance, deformation, vortex, collapse,
       opening, and traversal remain causally connected. */
    const advancePortal = (duration: number, next: typeof this.portal.phase) => {
      this.portal.t = Math.min(1, this.portal.t + dt / duration);
      if (this.portal.t >= 1) { this.portal.t = 0; this.portal.phase = next; }
    };
    if (this.portal.phase === 'arming') advancePortal(this.reducedMotion ? 0.08 : 0.18, 'disturbance');
    else if (this.portal.phase === 'disturbance') advancePortal(this.reducedMotion ? 0.12 : 0.42, 'deformation');
    else if (this.portal.phase === 'deformation') advancePortal(this.reducedMotion ? 0.18 : 0.72, 'vortex');
    else if (this.portal.phase === 'vortex') advancePortal(this.reducedMotion ? 0.22 : 1.0, 'collapse');
    else if (this.portal.phase === 'collapse') advancePortal(this.reducedMotion ? 0.18 : 0.72, 'opening');
    else if (this.portal.phase === 'opening') {
      advancePortal(this.reducedMotion ? 0.15 : (this.portalProfile === 'vault' ? 0.72 : 0.9), 'hold');
      if (!this.portal.fired && this.portal.t > 0.72) {
        this.portal.fired = true;
        this.cb.onPortalPeak(this.portal.kind, this.portal.bodyId);
      }
    } else if (this.portal.phase === 'hold') {
      this.portal.t = Math.min(1, this.portal.t + dt / 1.6);
    } else if (this.portal.phase === 'out') {
      /* Return traversal runs longer — it carries a full re-form → eject →
         settle sequence instead of a plain decay. */
      this.portal.t = Math.max(0, this.portal.t - dt / (this.portalReturn ? 1.5 : 1.15));
      if (this.portal.t <= 0) {
        const returningInner = this.portalWasInner || Boolean(this.portalTargetInnerId);
        this.portal.phase = 'idle';
        this.portalTargetInnerId = null;
        this.portalReverse = 1;
        this.portalEject = 0;
        this.portalCloseLevel = 0;
        this.kamuiWarpFx = 0;
        this.portalPointSets.length = 0;
        if (this.portalReturn) {
          this.portalReturn = false;
          this.portalWasInner = false;
          this.focusId = null;
          this.selectedId = null;
          if (returningInner) {
            /* Inner-world return: land back at that galaxy's star system. */
            this.innerFocusBodyId = null;
            this.rig.setZoomTarget(CameraRig.zoomTOf(150));
            this.prevDialTarget = CameraRig.zoomTOf(150);
            this.cb.onSelectInnerWorld?.(null);
          } else {
            /* Home-system return: release the body and restore the system frame. */
            this.galaxyFocusId = null;
            this.galaxyInnerFocus = false;
            this.innerFocusBodyId = null;
            this.rig.setZoomTarget(0.15);
            this.rig.setOrbit(null, 1.12);
            this.rig.clearPan();
            this.prevDialTarget = 0.15;
          }
        }
        this.cb.onPortalDone();
      }
    }
    const phaseProgress = this.portal.t * this.portal.t * (3 - 2 * this.portal.t);
    const phaseWeight: Record<typeof this.portal.phase, number> = {
      idle: 0, arming: 0.02, disturbance: 0.10, deformation: 0.30,
      vortex: 0.62, collapse: 0.82, opening: 1, hold: 1, out: 1,
    };
    let ease = this.portal.phase === 'out'
      ? phaseProgress
      : Math.min(1, (phaseWeight[this.portal.phase] ?? 0) + phaseProgress * 0.22);
    /* REVERSE KAMUI — the close of a diary/vault replays the jutsu backward:
       RE-FORM (the vortex snaps back to strength, swirl unwinding the opposite
       way) → EJECT (white-hole release: matter is pushed back out, FOV pulse)
       → SETTLE (the field breathes out to idle). */
    this.portalEject = 0;
    if (this.portal.phase === 'out' && this.portalReturn) {
      const rt = 1 - this.portal.t;
      const smooth = (k: number) => k * k * (3 - 2 * k);
      if (rt < 0.24) {
        ease = THREE.MathUtils.lerp(this.portalCloseLevel, 0.92, smooth(rt / 0.24));
      } else if (rt < 0.52) {
        const k = (rt - 0.24) / 0.28;
        ease = THREE.MathUtils.lerp(0.92, 0.18, k) + 0.10 * Math.sin(k * Math.PI);
        this.portalEject = Math.sin(k * Math.PI);
      } else {
        ease = 0.18 * (1 - smooth((rt - 0.52) / 0.48));
      }
      this.kamuiWarpFx = this.portalEject * 0.85;
    }
    /* This value feeds only the embedded body field. Macro Kamui systems keep
       their own geometry and remain completely independent. */
    this.portalVisualT = this.portal.phase === 'idle' ? 0 : ease;

    /* cinematic fov kick — during the Kamui tunnel the fov blows wide open
       (the hyperspace stretch), then snaps back at the ejection */
    const targetFov = 50 + ease * 14 - this.coreT * 4 + this.kamuiWarpFx * 28;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 4);
    this.camera.updateProjectionMatrix();

    /* camera — orbit/pan/zoom physics live in the CameraRig */
    this.grabCooldown = Math.max(0, this.grabCooldown - dt);

    /* auto release — zoom out of a focused world and it lets go seamlessly
       (while clamped, rendered distance equals the unclamped base, so the
       hand-off never jumps) */
    const fb = this.focusBody();
    if (fb && this.rig.dist() > 1200 && this.portal.phase === 'idle') {
      this.focusId = null;
      this.grabCooldown = 0.6;
    }

    /* KAMUI — the teleportation jutsu. At the end of the Cosmic Web the
       reality itself tears: the surface bends and swirls with black-hole
       gravity, everything spirals into the vortex, the scene teleports, and
       a second portal opens at your reality's marble that ejects you into
       the multiverse. Fully automatic — the script owns the dial. The same
       jutsu carries you back the other way. */
    if (this.kamuiFlight !== null) {
      /* KAMUI — the jutsu script. One continuous flight, four beats:
         TEAR (reality rips at one point) → SUCK (+z, nearest-first wave)
         → TUNNEL (through the fold) → EJECT (−z, out of the marble). */
      this.kamuiFlight = Math.min(1, this.kamuiFlight + dt / 3.6);
      const t = this.kamuiFlight;
      this.rig.killZoomMomentum();
      this.kamuiWarpFx = Math.sin(Math.min(t, 0.92) / 0.92 * Math.PI);
      /* THE TUNNEL — a round unstable fold with great torque, sweeping past
         the camera through the deepest part of the jutsu */
      const tw0 = 0.3, tw1 = 0.68;
      if (t > tw0 && t < tw1) {
        const k = (t - tw0) / (tw1 - tw0);
        this.kamuiTunnel.visible = true;
        this.kamuiTunnel.position.z = THREE.MathUtils.lerp(-1600000, 1600000, k);
        this.kamuiTunnel.rotation.z += dt * (3.5 + k * 6); /* great high torque */
        this.kamuiTunnelMats.forEach((m) => {
          m.uniforms.uTime.value = this.clockT;
          m.uniforms.uSpin.value = this.kamuiTunnel.rotation.z;
          m.uniforms.uOpacity.value = Math.sin(k * Math.PI) * 0.9;
        });
      } else if (this.kamuiTunnel.visible) this.kamuiTunnel.visible = false;
      if (this.warpDir === 'toMultiverse') {
        if (t < 0.55) {
          /* web side — THE TEAR, THE SUCK, into THE TUNNEL */
          const suck = Math.min(1, t / 0.45);
          const R = 45000 + suck * 480000;
          this.webVortexMats.forEach((m) => {
            (m.uniforms.uVortexC.value as THREE.Vector3).set(0, 0, 0);
            m.uniforms.uVortexR.value = R;
            m.uniforms.uVortexS.value = 1;
            m.uniforms.uVortexT.value = this.clockT;
          });
          this.kamuiSuckDrift = suck * 60000; /* dragged along +z into the vortex */
          if (t < 0.45) this.rig.setZoomTarget(THREE.MathUtils.lerp(0.86, 0.855, Math.min(1, t / 0.45)));
          else this.rig.setZoomTarget(THREE.MathUtils.lerp(0.855, 0.72, Math.min(1, (t - 0.45) / 0.1)));
        } else {
          /* through the fold — THE EJECT, spat out of the marble's glass along -z */
          if (this.cosmicStage !== 'multiverse') {
            this.cosmicStage = 'multiverse';
            this.realityFocused = true;
            this.kamuiSuckDrift = 0;
            this.kamuiEjectK = 0;
            this.webVortexMats.forEach((m) => { m.uniforms.uVortexS.value = 0; });
          }
          const k = Math.min(1, (t - 0.55) / 0.35);
          this.kamuiEjectK = k;
          const ease = 1 - Math.pow(1 - k, 3);
          this.rig.setZoomTarget(THREE.MathUtils.lerp(0.72, this.arrivalZoom, ease) + 0.05 * Math.sin(k * Math.PI));
        }
      } else {
        /* the return jutsu — the multiverse swirls you back into the web */
        if (t < 0.55) {
          if (this.cosmicStage !== 'multiverse') this.cosmicStage = 'multiverse';
          if (t < 0.45) this.rig.setZoomTarget(THREE.MathUtils.lerp(this.kamuiFromZoom, 0.8, Math.min(1, t / 0.45)));
          else this.rig.setZoomTarget(THREE.MathUtils.lerp(0.8, 0.72, Math.min(1, (t - 0.45) / 0.1)));
        } else {
          if (this.cosmicStage !== 'web') { this.cosmicStage = 'web'; this.realityFocused = false; }
          const k = Math.min(1, (t - 0.55) / 0.35);
          const end = this.postWarpZoom ?? 0.82;
          const ease = 1 - Math.pow(1 - k, 3);
          this.rig.setZoomTarget(THREE.MathUtils.lerp(0.72, end, ease) + 0.05 * Math.sin(k * Math.PI));
        }
      }
      if (t >= 1) {
        this.kamuiFlight = null;
        this.kamuiEjectK = 0;
        this.kamuiSuckDrift = 0;
        if (this.postWarpZoom !== null) { this.rig.setZoomTarget(this.postWarpZoom); this.postWarpZoom = null; }
        this.prevDialTarget = this.rig.tZoomT; /* the scripted ride must not re-trigger the band bends */
      }
    } else if (this.galaxyEntryFlight !== null) {
      /* Local galaxy-entry Kamui: the clicked disc tears open and the
         surrounding galaxy field is pulled into that rupture. */
      this.updateGalaxyEntryFlight(dt);
    } else if (this.galaxyWarp !== null) {
      /* THE GALAXY WARP — reality folds in a swirling gravitational bend:
         the web's structures whirl around the destination (+z pull), the
         tunnel passes, then the −z counter-fold settles the destination into
         view. The script owns the dial until it lands. */
      const w = this.galaxyWarp;
      w.t = Math.min(1, w.t + dt / 2.6);
      const t = w.t;
      this.rig.killZoomMomentum();
      this.kamuiWarpFx = Math.sin(Math.min(t, 0.92) / 0.92 * Math.PI) * 0.8;
      this.galaxyWarpDrift = Math.sin(t * Math.PI) * (w.dir === 'descend' ? 9000 : 7000);
      const tw0 = 0.3, tw1 = 0.68;
      if (t > tw0 && t < tw1) {
        const k = (t - tw0) / (tw1 - tw0);
        this.kamuiTunnel.visible = true;
        this.kamuiTunnel.position.z = THREE.MathUtils.lerp(-1600000, 1600000, k);
        this.kamuiTunnel.rotation.z += dt * (3.5 + k * 6);
        this.kamuiTunnelMats.forEach((m) => {
          m.uniforms.uTime.value = this.clockT;
          m.uniforms.uSpin.value = this.kamuiTunnel.rotation.z;
          m.uniforms.uOpacity.value = Math.sin(k * Math.PI) * 0.85;
        });
      } else if (this.kamuiTunnel.visible) this.kamuiTunnel.visible = false;
      /* the bend itself — the web whirls around the destination */
      const R = 22000 + t * 70000;
      this.webVortexMats.forEach((m) => {
        (m.uniforms.uVortexC.value as THREE.Vector3).copy(w.center);
        m.uniforms.uVortexR.value = R;
        m.uniforms.uVortexS.value = 1;
        m.uniforms.uVortexT.value = this.clockT;
      });
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this.rig.setZoomTarget(THREE.MathUtils.lerp(w.fromDial, w.toDial, ease));
      if (t >= 1) {
        this.galaxyWarp = null;
        this.kamuiWarpFx = 0;
        this.galaxyWarpDrift = 0;
        this.webVortexMats.forEach((m) => { m.uniforms.uVortexS.value = 0; });
        if (this.kamuiTunnel.visible) this.kamuiTunnel.visible = false;
        this.galaxyInnerFocus = w.endInner;
        if (!w.endInner && w.toDial <= 0.3) this.galaxyFocusId = null; /* arrived inside the home system */
        this.prevDialTarget = this.rig.tZoomT;
      }
    } else if (this.bootIntro) {
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
      this.rig.setZoomTarget(0.15);
      this.rig.setOrbit(null, 1.12);
      this.bootIntro = false;
    } else {
      /* stage edges — the dial can never cross between the stages */
      if (this.cosmicStage === 'web' && this.rig.tZoomT > 0.865) this.rig.setZoomTarget(0.865);
      /* the web's edge — pulling beyond it is what tears reality open */
      if (
        this.cosmicStage === 'web' && this.rig.tZoomT >= 0.855 && this.rig.zoomVelocity > 0.05
        && this.grabCooldown <= 0 && !this.dragging && this.portal.phase === 'idle'
        && !this.focusId && !this.coreActive && this.activeReality
      ) {
        /* the tear begins */
        this.realityFocused = false;
        this.warpDir = 'toMultiverse';
        this.kamuiFlight = 0;
        this.kamuiFromZoom = this.rig.zoomT;
        this.arrivalZoom = this.activeReality ? CameraRig.zoomTOf(this.activeReality.bubbleSize * 5.5) : 0.787;
        this.grabCooldown = 1.2;
      }
      if (this.cosmicStage === 'multiverse') {
        if (this.realityFocused && this.rig.tZoomT < 0.787) this.rig.setZoomTarget(0.787);
        if (this.realityFocused && this.rig.atFocusMax && this.rig.zoomTrend > 0) {
          this.realityFocused = false;
          this.grabCooldown = 0.6;
        }
        if (this.rig.tZoomT < 0.8) this.rig.setZoomTarget(0.8);
        /* the return tear — pushed through the multiverse's floor */
        if (
          this.rig.tZoomT <= 0.802 && this.rig.zoomVelocity < -0.05 && this.grabCooldown <= 0
          && !this.dragging && this.portal.phase === 'idle'
        ) {
          this.realityFocused = false;
          this.warpDir = 'toWeb';
          this.kamuiFlight = 0;
          this.kamuiFromZoom = this.rig.zoomT;
          this.grabCooldown = 1.2;
        }
      }
      /* galaxy focus releases, in a ladder:
         inner system → zoom out → back to that galaxy’s frame (in front of
         the specific galaxy you visited); galaxy frame → zoom out → the open
         field; zooming INTO a home-galaxy frame dives THROUGH it into the
         anchor star system. */
      if (this.cosmicStage === 'web' && this.galaxyFocusId && this.rig.atFocusMax && this.rig.zoomTrend > 0) {
        if (this.innerFocusBodyId) {
          this.releaseInnerWorld(); /* world → system frame */
          this.grabCooldown = 0.35;
        } else if (this.galaxyInnerFocus) {
          this.galaxyInnerFocus = false;
          this.rig.setZoomTarget(0.668); /* back in front of that galaxy */
          this.prevDialTarget = 0.668;
          this.grabCooldown = 0.6;
        } else {
          this.galaxyFocusId = null;
          this.grabCooldown = 0.6;
        }
      }
      if (this.cosmicStage === 'web' && this.galaxyFocusId && this.rig.atFocusMin && this.rig.zoomTrend < 0) {
        const node = this.galaxyStageNodes.find((n) => n.data.id === this.galaxyFocusId);
        if (node && node.data.isHomeGalaxy && !this.galaxyInnerFocus) {
          this.galaxyFocusId = null;
          this.grabCooldown = 0.35;
        }
      }
      /* GALAXY WARP TRIGGERS — the band’s edges are folds in space. A
         crossing blocked by grab-cooldown (e.g. a body-focus release) is
         latched and fires the moment you’re free — the return bend must
         never be silently skipped. */
      const dialNow = this.rig.tZoomT;
      const dialPrev = this.prevDialTarget;
      const warpFree = this.galaxyWarp === null && this.kamuiFlight === null
        && this.portal.phase === 'idle' && !this.dragging && !this.bootIntro;
      const arriveCross = dialPrev >= 0.70 && dialNow < 0.695 && dialNow >= 0.58;
      const downCross = dialPrev >= 0.60 && dialPrev <= 0.70 && dialNow < 0.585;
      const upCross = dialPrev <= 0.585 && dialNow > 0.605;
      const canFire = warpFree && this.grabCooldown <= 0 && this.cosmicStage === 'web';
      if (canFire) {
        if (arriveCross) {
          this.beginGalaxyWarp('arrive', 0.668, null);
        } else if (downCross) {
          /* a dive through the band WITHOUT clicking a specific galaxy
             always folds down into the HOME galaxy's anchor system */
          this.beginGalaxyWarp('descend', Math.max(0.15, dialNow), null, false);
        } else if (upCross) {
          this.fireAscend();
        }
      } else if (warpFree && this.grabCooldown > 0) {
        /* latch the crossing — replay the bend as soon as the cooldown ends */
        if (arriveCross) this.bandLatch = { dir: 'arrive', at: this.clockT };
        else if (downCross) this.bandLatch = { dir: 'down', at: this.clockT };
        else if (upCross) this.bandLatch = { dir: 'up', at: this.clockT };
      }
      /* resolve a latched crossing */
      if (this.bandLatch) {
        if (this.clockT - this.bandLatch.at > 3) {
          this.bandLatch = null; /* stale */
        } else if (warpFree && this.grabCooldown <= 0 && this.cosmicStage === 'web') {
          if (this.bandLatch.dir === 'arrive' && dialNow < 0.695 && dialNow >= 0.58) {
            this.beginGalaxyWarp('arrive', 0.668, null);
            this.bandLatch = null;
          } else if (this.bandLatch.dir === 'up' && dialNow > 0.60 && dialNow < 0.695) {
            this.fireAscend();
            this.bandLatch = null;
          } else if (this.bandLatch.dir === 'down' && dialNow < 0.585) {
            /* no specific galaxy clicked — the dive opens the HOME galaxy */
            this.beginGalaxyWarp('descend', Math.max(0.15, dialNow), null, false);
            this.bandLatch = null;
          }
        }
      }
      this.prevDialTarget = dialNow;
    }

    /* auto engage — ONLY while actively zooming in AND only onto the body the
       pointer is actually over: diving toward a world you're touching centers
       it. A plain rotation, a stray scroll, or a zoom across empty space must
       never yank the camera onto a random body and send the sky spinning
       around it — that yank-and-follow was exactly the "clicking a body makes
       the universe rotate" bug. */
    if (
      !this.focusId && !this.realityFocused && this.cosmicStage === 'web' && !this.bootIntro && !this.coreActive && this.rig.dist() < 150 && this.portal.phase === 'idle'
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
      /* orbit the active reality's marble — framed just outside its glass.
         During the eject the focus sweeps along -z, dragging the camera out
         of the marble with it (the throw of the jutsu). */
      this._vFocusScratch.set(...this.activeReality.bubblePos);
      if (this.kamuiEjectK > 0.001 && this.kamuiEjectK < 1) {
        this._vFocusScratch.z -= this.activeReality.bubbleSize * 2.0 * (1 - this.kamuiEjectK);
      }
      focusMin = this.activeReality.bubbleSize * 3.1;  /* just outside the glass */
      focusMax = 520000;                               /* release point on zoom-out */
    } else if (activeFb) {
      activeFb.group.getWorldPosition(this._vFocusScratch);
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
            focusMax = this.galaxyWarp ? 90000 : 4200;
            focusRadiusParam = focusedWorld.data.radius;
          } else {
            focusMin = 12;            /* planet-orbit depth */
            /* while a warp owns the dial its ride must glide unclamped */
            focusMax = this.galaxyWarp ? 90000 : 7000;
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
      /* during the suck the focus drifts along +z into the vortex */
      this._vFocusScratch.set(0, 0, this.kamuiSuckDrift);
    }
    /* the galaxy warp's fold — the focus is pulled along +z mid-bend and the
       −z counter-fold brings the destination back into view */
    if (this.galaxyWarp) this._vFocusScratch.z += this.galaxyWarpDrift;
    if (this.portal.phase !== 'idle') this.rig.holdFocus(this._vFocusScratch);
    this.rig.update(dt, {
      focus: this._vFocusScratch,
      focused: !!activeFb || this.realityFocused || galaxyFocusActive,
      focusRadius: focusRadiusParam,
      portalEase: ease,
      focusMin,
      focusMax,
    });
    this.updateBodies(dt);
    this.updateMeteors(dt);
    this.updateLevels(dt);
    this.updatePortalGravity();
    this.updatePortalSingularity();
    this.updatePortalPointsVortex();
    this.updateSurface(dt);
    this.updateCore(dt);
    this.updateHover();

    if (this.rendering) this.composer.render();
    if (frameStarted) recordFrame(performance.now() - frameStarted);
  };
  private clock = new THREE.Clock();

  /**
   * World-space gravitational vortex for Planet/Vault Kamui.
   * Unlike the compositor pass, this operates on the actual neighboring
   * bodies after their normal orbital positions are rebuilt each frame.
   */
  private applyPortalGravityUniforms(material: THREE.ShaderMaterial) {
    const u = material.uniforms;
    if (!u.uGravityCenter) return;
    (u.uGravityCenter.value as THREE.Vector3).copy(this.portalGravityUniforms.center);
    u.uGravityRadius.value = this.portalGravityUniforms.radius;
    u.uGravityStrength.value = this.portalGravityUniforms.strength;
    u.uGravityTime.value = this.portalGravityUniforms.time;
    if (u.uReverse) u.uReverse.value = this.portalReverse;
  }

  /** Portal gravity center expressed in a specific mesh's local space — the
      vertex shaders displace real geometry, so they need the core position
      in the coordinates of the exact mesh being bent. */
  private setPortalLocalCenter(material: THREE.ShaderMaterial, mesh: THREE.Object3D | null | undefined) {
    if (!mesh || !material.uniforms.uGravityLocalCenter) return;
    this._vScratch4.copy(this.portalGravityUniforms.center);
    mesh.worldToLocal(this._vScratch4);
    (material.uniforms.uGravityLocalCenter.value as THREE.Vector3).copy(this._vScratch4);
  }

  /** Nearest-first suction for every point cloud in the scene (star shells,
      dust, halos): while a Planet/Vault Kamui is active, the field bends,
      spins and draws nearby points into the core — visual only, no transform
      of any object is ever modified. */
  private updatePortalPointsVortex() {
    if (this.kamuiFlight !== null || this.galaxyEntryFlight !== null) return;
    const active = this.portal.phase !== 'idle' && this.portalVisualT > 0.001;
    for (const { points, mat } of this.portalPointSets) {
      if (!active) {
        if (mat.uniforms.uVortexS.value !== 0) {
          mat.uniforms.uVortexS.value = 0;
          mat.uniforms.uVortexR.value = 0;
          mat.uniforms.uVortexPull.value = 0;
        }
        continue;
      }
      /* each cloud lives in its own local frame — reframe the core per cloud
         so the suction converges on the same world-space point everywhere */
      this._vScratch4.copy(this.portalGravityUniforms.center);
      points.worldToLocal(this._vScratch4);
      (mat.uniforms.uVortexC.value as THREE.Vector3).copy(this._vScratch4);
      mat.uniforms.uVortexR.value = this.portalGravityUniforms.radius;
      mat.uniforms.uVortexS.value = this.portalVisualT * 0.85;
      mat.uniforms.uVortexT.value = this.clockT * 1.6;
      if (mat.uniforms.uVortexRev) mat.uniforms.uVortexRev.value = this.portalReverse;
      if (mat.uniforms.uVortexPull) {
        /* ejection pushes matter back out of the closing aperture */
        mat.uniforms.uVortexPull.value = this.portalEject > 0.001
          ? -this.portalEject * 1.1
          : 0.25 + this.portalVisualT * 0.6;
      }
    }
  }

  private updatePortalGravity() {
    if (this.portal.phase === 'idle' || this.portalVisualT <= 0.001) {
      this.portalGravityUniforms.strength = 0;
      this.portalGravityUniforms.radius = 0;
      this.portalBodyRadius = 0;
      return;
    }

    const center = this.portalLocalCenter;
    let targetRadius = 2;
    let targetHomeId: string | null = null;
    let targetNode: (typeof this.galaxyStageNodes)[number] | null = null;
    let targetInner: InnerPlanet | null = null;

    if (this.portalTargetInnerId) {
      for (const node of this.galaxyStageNodes) {
        const inner = node.innerSys?.planets.find((p) => p.data.id === this.portalTargetInnerId);
        if (!inner) continue;
        targetNode = node;
        targetInner = inner;
        inner.group.getWorldPosition(center);
        targetRadius = inner.data.radius;
        break;
      }
    } else {
      const target = this.bodies.find((b) => b.data.id === this.portal.bodyId);
      if (target) {
        targetHomeId = target.data.id;
        target.group.getWorldPosition(center);
        targetRadius = target.data.radius;
      }
    }
    if (!targetInner && !targetHomeId) return;

    /* Localized field radius: strictly bounded to the target planet's immediate atmosphere */
    const fieldRadius = Math.max(6, targetRadius * 3.2);
    /* Keep the body's own deformation bounded separately from the broad field
       uniforms. The surrounding field can be large, but the planet surface
       must never collapse out of view. */
    const strength = THREE.MathUtils.clamp(this.portalVisualT, 0, 1.0);
    /* This is consumed by world-space surface/particle shaders. It changes
       the appearance of the reality surface around the core without changing
       any object's transform, orbit, star position, or camera orientation. */
    this.portalGravityUniforms.center.copy(center);
    this.portalGravityUniforms.radius = fieldRadius;
    this.portalGravityUniforms.strength = strength;
    this.portalGravityUniforms.time = this.clockT;

    /* No scene graph objects are moved here. The selected planet's own
       material receives the strong local tear; the existing reality/cosmic
       shaders receive only the field parameters and distort their rendered
       surface in place. The anchor star and all orbital coordinates remain
       untouched. */
    void targetNode;
    void targetHomeId;
  }

  private updateBodies(dt: number) {
    const sysW = 1 - smoothstep(430, 860, this.currentDist());

    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      const o = b.data.orbit;
      const phys = calculatePhysics(b.data, this.simDays);
      const pos = calculateKeplerPosition(o.a, phys.eccentricity, o.phase, o.incl, this.simDays, o.speed || 0.01);
      b.group.position.set(pos.x, pos.y, pos.z);
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
      const portalTear = !this.portalTargetInnerId && this.portal.bodyId === b.data.id ? this.portalVisualT : 0;

      if (b.mat) {
        if (b.mat.uniforms.uSunDir) (b.mat.uniforms.uSunDir.value as THREE.Vector3).copy(this._vScratch1);
        if (b.mat.uniforms.uTime) b.mat.uniforms.uTime.value = this.clockT;
        if (b.mat.uniforms.uGhost) b.mat.uniforms.uGhost.value = b.ghost;
        if (b.mat.uniforms.uFade) b.mat.uniforms.uFade.value = b.fade * sysW;
        if (b.mat.uniforms.uTear) b.mat.uniforms.uTear.value = portalTear;
        if (b.mat.uniforms.uTearTime) b.mat.uniforms.uTearTime.value = this.clockT;
        this.applyPortalGravityUniforms(b.mat);
        this.setPortalLocalCenter(b.mat, b.spinMesh);
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
        if (b.cloudMat.uniforms.uTear) b.cloudMat.uniforms.uTear.value = portalTear;
        if (b.cloudMat.uniforms.uTearTime) b.cloudMat.uniforms.uTearTime.value = this.clockT;
        this.applyPortalGravityUniforms(b.cloudMat);
        this.setPortalLocalCenter(b.cloudMat, b.cloudMesh);
        (b.cloudMat.uniforms.uSunDir.value as THREE.Vector3).copy(this._vScratch1);
        b.cloudMat.uniforms.uFade.value = b.fade * sysW * (1 - b.ghost);
        b.cloudMat.visible = b.cloudMat.uniforms.uFade.value > 0.02;
      }
      if (b.atmo) {
        const atmoMat = b.atmo.material as THREE.ShaderMaterial;
        (atmoMat.uniforms.uSunDir.value as THREE.Vector3).copy(this._vScratch1);
        if (atmoMat.uniforms.uTear) atmoMat.uniforms.uTear.value = portalTear;
        if (atmoMat.uniforms.uTearTime) atmoMat.uniforms.uTearTime.value = this.clockT;
        this.applyPortalGravityUniforms(atmoMat);
        this.setPortalLocalCenter(atmoMat, b.atmo);
        b.atmo.visible = b.fade * sysW * (1 - b.ghost) > 0.05;
      }
      if (b.ringMat) {
        b.ringMesh!.getWorldQuaternion(this._qScratch).invert();
        (b.ringMat.uniforms.uSunLocal.value as THREE.Vector3).copy(this._vScratch1).applyQuaternion(this._qScratch);
        this.applyPortalGravityUniforms(b.ringMat);
        this.setPortalLocalCenter(b.ringMat, b.ringMesh);
        b.ringMesh!.visible = b.fade * sysW * (1 - b.ghost * 0.85) > 0.05;
      }

      b.moons.forEach((m) => {
        const ma = m.phase + this.simDays * m.speed;
        m.mesh.position.set(Math.cos(ma) * m.a, Math.sin(ma * 0.7) * m.a * 0.12, Math.sin(ma) * m.a);
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
      b.group.scale.setScalar((1 + Math.max(b.hoverT, selected * 0.5) * 0.035) * pulse * (1 - b.ghost * 0.35));
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

      if (b.data.kind === 'vault' && b.group.userData.spin) {
        const s = b.group.userData.spin as { r1: THREE.Mesh; r2: THREE.Mesh };
        s.r1.rotation.z += dt * 0.3; s.r2.rotation.x += dt * 0.22;

        /* the black hole: feed time + the camera orientation (the
           billboarded rings/arcs always face the viewer). The composite
           group is parented to the body group and inherits its transform. */
        const bh = b.group.userData.bh as {
          update(t: number, camQuat?: THREE.Quaternion, portal?: number): void;
        } | undefined;
        if (bh) {
          bh.update(this.clockT, this.camera.quaternion, portalTear);
        }

        /* feed the void — recent Vault activity (store/extract/run) brightens
           and shudders the lattice rings, then relaxes back to baseline */
        const m1 = s.r1.material as THREE.MeshStandardMaterial;
        const m2 = s.r2.material as THREE.MeshStandardMaterial;
        if (this.vaultPulse > 0) {
          this.vaultPulse = Math.max(0, this.vaultPulse - dt * 0.5);
          const shudder = 1 + Math.sin(this.clockT * 12) * 0.015 * this.vaultPulse;
          s.r1.scale.setScalar(shudder); s.r2.scale.setScalar(shudder);
          if (m1?.emissiveIntensity !== undefined) m1.emissiveIntensity = 1.8 + this.vaultPulse * 2.2;
          if (m2?.emissiveIntensity !== undefined) m2.emissiveIntensity = 1.8 + this.vaultPulse * 2.2;
        } else {
          s.r1.scale.setScalar(1); s.r2.scale.setScalar(1);
          if (m1) m1.emissiveIntensity += (1.8 - m1.emissiveIntensity) * Math.min(1, dt * 2);
          if (m2) m2.emissiveIntensity += (1.8 - m2.emissiveIntensity) * Math.min(1, dt * 2);
        }
      }
    }

    /* anchor — axial spin & core interface ember lerp */
    this.anchorGroup.rotation.y += dt * 0.08; /* Axial rotation around polar axis */
    const starMesh = this.anchorGroup.userData.starMesh as THREE.Mesh;
    if (starMesh) starMesh.rotation.y += dt * 0.15;

    this.starUniforms.uTime.value = this.clockT;
    const boostTarget = 1 - this.coreT * 0.42;
    this.starUniforms.uBoost.value += (boostTarget - this.starUniforms.uBoost.value) * Math.min(1, dt * 3);
    this.bloomPass.strength = 0.18 - this.coreT * 0.08;

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

  private updateLevels(dt = 0) {
    const d = this.currentDist();
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
    /* the jutsu owns the view during the suck — the web stays pure while the
       vortex consumes the rest (the scripted dial must never let the inner
       layers pop back in mid-jutsu) */
    if (this.kamuiFlight !== null && this.warpDir === 'toMultiverse' && this.kamuiFlight < 0.4) {
      wins.web = Math.max(wins.web, 1);
      const dissolve = 1 - this.kamuiErase;
      wins.supercluster *= dissolve;
      wins.cluster *= dissolve;
      wins.galaxy *= dissolve;
      wins.neighborhood *= dissolve;
    }

    /* the two stages never share the screen — the warp swaps them wholesale */
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
    if (this.bootIntro && this.kamuiFlight === null && this.clockT < 2.2) {
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
    const kamuiTear = Math.sin(this.kamuiErase * Math.PI) * 1.35;
    const portalTear = this.portal.phase !== 'idle' ? Math.sin(this.portal.t * Math.PI) * 1.5 : 0;
    const baseTear = Math.max(kamuiTear, portalTear);

    this.multiverseMats.forEach((m) => {
      m.uniforms.uTime.value = this.clockT;
      const isHover = this.hoveredId && this.hoveredId.startsWith('reality:');
      const tVal = Math.max(baseTear, isHover ? 0.35 + 0.15 * Math.sin(this.clockT * 3.5) : 0);
      if (m.uniforms.uTearStrength) m.uniforms.uTearStrength.value = tVal;
    });
    if (this.demonCoreMat) {
      this.demonCoreMat.uniforms.uTime.value = this.clockT;
      this.demonCoreMat.uniforms.uHover.value = (this.hoveredId === 'demon-core' ? 1.0 : 0.0);
      const isCoreHover = this.hoveredId === 'demon-core';
      const cTVal = Math.max(baseTear, isCoreHover ? 0.65 + 0.25 * Math.sin(this.clockT * 4.0) : 0);
      if (this.demonCoreMat.uniforms.uTearStrength) this.demonCoreMat.uniforms.uTearStrength.value = cTVal;
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
    if (this.exoplanetPlateMat) this.exoplanetPlateMat.uniforms.uTime.value = this.clockT;
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
      node.group.scale.setScalar(isHovered ? 1.5 : 1.0);
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

    // Kamui Spacetime Singularity Vortex — the jutsu's signature. It engulfs
    // the camera while the reality bends and swirls (black-hole pull), holds
    // through the teleport, then releases at the ejection. Roaming either
    // stage never replays it — only the flight drives it.
    let targetKamui = 0;
    if (this.kamuiFlight !== null) {
      const t = this.kamuiFlight;
      targetKamui = t < 0.35 ? t / 0.35 : t < 0.72 ? 1 : Math.max(0, 1 - (t - 0.72) / 0.28);
    } else if (this.galaxyEntryFlight !== null) {
      /* a galaxy entry is a local, high-energy tear rather than the broad
         stage-crossing bend */
      targetKamui = Math.sin(Math.min(this.galaxyEntryFlight.t, 1) * Math.PI) * 1.15;
    } else if (this.galaxyWarp !== null) {
      /* the band bend — a slightly softer engulfment, same grammar */
      targetKamui = Math.sin(Math.min(this.galaxyWarp.t, 1) * Math.PI) * 0.85;
    }
    this.kamuiErase = THREE.MathUtils.damp(this.kamuiErase, targetKamui, 6, Math.max(dt, 0.001));

    this.camera.getWorldDirection(this._vDirScratch);
    const skyVisible = this.cosmicStage !== 'multiverse';
    this.surfaceManager.update({
      dt,
      clockT: this.clockT,
      camera: this.camera,
      kamuiErase: this.kamuiErase,
      vortexDir: this._vDirScratch,
      skyVisible,
      neighborhoodVisibility: wins.neighborhood,
    });

    if (this.giantMultiverseBoundaryMat) {
      this.giantMultiverseBoundaryMat.uniforms.uTime.value = this.clockT;
      /* the reality surface itself bends and swirls with the warp — the
         flight's engulfment drives the boundary vortex at full strength */
      const boundaryKamui = Math.max(this.kamuiErase, wins.multiverse > 0.01 ? (1.0 - wins.multiverse) * 0.5 : 0);
      this.giantMultiverseBoundaryMat.uniforms.uKamuiErase.value = boundaryKamui;
      (this.giantMultiverseBoundaryMat.uniforms.uVortexDir.value as THREE.Vector3).copy(this._vDirScratch);
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
    else if (d < 1200) label = 'STAR-FORMING REGION';
    else if (d < 4500) label = 'SPIRAL ARM';
    else if (d < 14000) label = 'GALACTIC REGION';
    else if (d < 38000) {
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
    else if (d < 85000) label = 'GALAXY CLUSTER / GALAXY GROUP';
    else if (d < 160000) label = 'SUPERCLUSTER';
    else if (d < 320000) label = 'SUPERCLUSTER COMPLEX';
    else if (d < 650000) label = 'COSMIC WEB';
    else if (d < 1200000) label = 'REALITY / UNIVERSE';
    else label = 'MULTIVERSE';
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
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.canvas.removeEventListener('dblclick', this.onDoubleClick);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('eventide-vault-pulse', this.onVaultPulse);
    this.canvas.style.touchAction = this.originalTouchAction;
    this.rig.dispose();
    this.disposeObject3D(this.scene);
    this.scene.clear();
    this.composer.dispose();
    this.renderer.dispose();
  }
}

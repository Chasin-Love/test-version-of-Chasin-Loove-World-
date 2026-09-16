/**
 * KAMUI — Dimensional Traversal Engine v2.0
 * 
 * A wormhole-based teleportation technique that bends reality itself to travel
 * from Dimension A to Dimension B regardless of their nature (isolated dimensions,
 * vast distances, or completely separate realities).
 * 
 * PHYSICS MODEL:
 * - Gravitational singularity creates extreme spacetime curvature
 * - Surrounding matter AND space itself gets attracted in swirling motion
 * - Background reality surface bends and compresses toward the singularity
 * - Differential rotation creates Keplerian shear (inner regions spin faster)
 * - Contact deformation: matter temporarily compresses at the event horizon
 * - Stable suction: no teleportation of objects, only continuous inward flow
 * 
 * VISUAL PHASES:
 * 1. ARMING: Gravity field activates, subtle attraction begins
 * 2. DISTURBANCE: Nearby space starts bending, stars stretch radially
 * 3. DEFORMATION: Reality surface caves inward, swirling accretion forms
 * 4. VORTEX: Full spiraling motion with differential rotation
 * 5. COLLAPSE: Aperture opens, dimensional throat becomes visible
 * 6. HOLD: Stable wormhole maintained for traversal
 * 7. OUT/RETURN: Reverse traversal (expulsion instead of suction)
 */

import * as THREE from 'three';
import { 
  kamuiSpacetimeVert, 
  kamuiSpacetimeFrag, 
  kamuiSingularityVert, 
  kamuiSingularityFrag, 
  kamuiTunnelVert, 
  kamuiTunnelFrag, 
  kamuiTearVert, 
  kamuiTearFrag 
} from './shaders';
/* =========================== NOISE FUNCTIONS =========================== */

const KAMUI_NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314*r;}

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0,0.5,1.0,2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0,i1.z,i2.z,1.0))
        + i.y + vec4(0.0,i1.y,i2.y,1.0)) + i.x + vec4(0.0,i1.x,i2.x,1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0*floor(p*ns.z*ns.z);
  vec4 x_ = floor(j*ns.z);
  vec4 y_ = floor(j - 7.0*x_);
  vec4 x = x_*ns.x + ns.yyyy;
  vec4 y = y_*ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
  m = m*m;
  return 42.0*dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

// Domain-warped noise for turbulent gravitational flow
float fbm(vec3 p){
  float f = 0.0; float a = 0.5;
  for(int i=0;i<5;i++){ f += a*snoise(p); p *= 2.03; a *= 0.5; }
  return f;
}

// Faster 3-octave noise for real-time deformation
float fbm3(vec3 p){
  float f = 0.0; float a = 0.5;
  for(int i=0;i<3;i++){ f += a*snoise(p); p *= 2.11; a *= 0.5; }
  return f;
}

// Voronoi-like cellular noise for magnetic flux structures
float cellular(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float md = 8.0;
  for(int k=-1; k<=1; k++) {
    for(int j=-1; j<=1; j++) {
      for(int l=-1; l<=1; l++) {
        vec3 o = vec3(l, j, k);
        vec3 r = o - f;
        float d = dot(r, r);
        if(d < md) md = d;
      }
    }
  }
  return sqrt(md);
}
`;

/* ======================== SPACETIME DISTORTION SHADER ======================== */

/**
 * Vertex shader for reality bending - applied to background space, stars,
 * and nearby cosmic bodies to simulate gravitational lensing and attraction.
 */
export const kamuiSpacetimeVert = /* glsl */ `
uniform vec3 uKamuiCenter;        // World-space position of the singularity
uniform float uKamuiRadius;       // Effective radius of gravitational influence
uniform float uKamuiStrength;     // 0..1 intensity of the field
uniform float uKamuiTime;         // Time for animated swirling
uniform float uReverse;           // +1 for suction, -1 for expulsion
varying vec3 vWorldPos;
varying float vGravityField;
varying float vSwirlAngle;
${KAMUI_NOISE}

void main() {
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  
  // Calculate distance from singularity
  vec3 delta = vWorldPos - uKamuiCenter;
  float dist = length(delta);
  vec3 dir = normalize(delta + vec3(0.0001));
  
  // Gravitational field falloff (inverse square with smooth cutoff)
  float fieldNorm = 1.0 - smoothstep(0.0, uKamuiRadius, dist);
  vGravityField = fieldNorm * uKamuiStrength;
  
  // Differential rotation: inner regions spin much faster (Keplerian style)
  float distNorm = clamp(dist / max(uKamuiRadius, 0.001), 0.001, 1.0);
  float angularVel = 2.5 / pow(max(distNorm, 0.08), 0.65);
  float swirl = fieldNorm * angularVel * (0.8 + 0.4 * sin(uKamuiTime * 2.1 + dist * 0.05));
  vSwirlAngle = swirl * uReverse;
  
  // Radial compression: space itself compresses toward singularity
  // Like a ball hitting a wall - temporary deformation at contact area
  float compression = fieldNorm * (0.45 + 0.35 * sin(uKamuiTime * 3.2 + dist * 0.08));
  
  // Turbulent flow noise for realistic matter behavior
  float turbulence = fbm(dir * 4.0 + vec3(uKamuiTime * 0.15));
  compression *= 0.7 + 0.3 * turbulence;
  
  // Apply radial compression to vertex position
  vec3 compressedPos = position - dir * compression * length(position) * 0.18;
  
  // Add tangential swirl displacement
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 tangent = normalize(cross(up, dir));
  float swirlDisplace = sin(vSwirlAngle) * fieldNorm * length(position) * 0.12;
  compressedPos += tangent * swirlDisplace;
  
  // Vertical vortex funnel shape (matter spirals down into singularity)
  float funnelDrop = fieldNorm * (0.25 + 0.15 * cellular(dir * 3.5 + uKamuiTime * 0.2)) * length(position) * 0.08;
  compressedPos.y -= funnelDrop * uReverse;
  
  vec4 mvPosition = modelViewMatrix * vec4(compressedPos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}`;

/**
 * Fragment shader for distorted space - adds gravitational redshift,
 * accretion glow, and event horizon darkening.
 */
export const kamuiSpacetimeFrag = /* glsl */ `
uniform vec3 uKamuiCenter;
uniform float uKamuiRadius;
uniform float uKamuiStrength;
uniform float uKamuiTime;
uniform vec3 uBaseColor;          // Original color of the distorted object
uniform float uEmissionMult;      // Glow multiplier
varying vec3 vWorldPos;
varying float vGravityField;
varying float vSwirlAngle;
${KAMUI_NOISE}

void main() {
  // Gravitational redshift: light loses energy escaping gravity well
  float redshift = vGravityField * 0.35;
  vec3 shiftedColor = mix(uBaseColor, vec3(1.0, 0.3, 0.1), redshift);
  
  // Accretion heating: matter glows brighter as it compresses
  float heating = vGravityField * (1.2 + 0.8 * sin(vSwirlAngle * 2.0 + uKamuiTime * 2.5));
  vec3 heatedColor = shiftedColor * (1.0 + heating * uEmissionMult);
  
  // Event horizon darkening at center
  vec3 toCenter = uKamuiCenter - vWorldPos;
  float distToCenter = length(toCenter);
  float horizonMask = smoothstep(uKamuiRadius * 0.15, uKamuiRadius * 0.4, distToCenter);
  heatedColor *= horizonMask;
  
  // Spiral arm density variations
  float angle = atan(vWorldPos.z - uKamuiCenter.z, vWorldPos.x - uKamuiCenter.x);
  float spiralArm = pow(max(0.0, 0.5 + 0.5 * sin(angle * 3.5 + pow(1.0 - vGravityField, 0.5) * 18.0)), 2.0);
  heatedColor *= 0.7 + 0.3 * spiralArm;
  
  // Magnetic filament streaks (high-energy plasma jets)
  float filaments = fbm3(normalize(vWorldPos - uKamuiCenter) * 8.0 + uKamuiTime * 0.3);
  heatedColor *= 0.85 + 0.15 * filaments;
  
  gl_FragColor = vec4(heatedColor, 1.0);
}`;

/* ======================== SINGULARITY CORE SHADER ======================== */

/**
 * The actual black hole / white hole at the center of Kamui.
 * This creates the visual singularity with accretion disk and photon ring.
 */
export const kamuiSingularityVert = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
varying vec3 vP;
uniform float uTime;
uniform float uPortal;
uniform float uReverse;

void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vW = (modelMatrix * vec4(position, 1.0)).xyz;
  vP = position;
  
  // Photon ring pulses during portal activation
  float pulse = 1.0 + 0.15 * sin(uTime * 8.0) * uPortal;
  vec3 pos = position * pulse;
  
  gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
}`;

export const kamuiSingularityFrag = /* glsl */ `
uniform float uTime;
uniform float uPortal;
uniform float uReverse;
uniform vec3 uCoreColor;
varying vec3 vN;
varying vec3 vW;
varying vec3 vP;
${KAMUI_NOISE}

void main() {
  vec3 viewDir = normalize(cameraPosition - vW);
  float mu = max(dot(vN, viewDir), 0.0);
  
  // Pure black event horizon (light cannot escape)
  float horizon = smoothstep(0.98, 1.0, mu);
  
  // Photon ring - light orbiting at the edge of the event horizon
  float ringDist = length(vP.xy);
  float ringMask = exp(-pow((ringDist - 0.95) / 0.08, 2.0));
  ringMask *= exp(-pow((ringDist - 1.05) / 0.12, 2.0));
  
  // Doppler beaming: approaching side is brighter
  float angle = atan(vP.y, vP.x);
  float doppler = 1.0 + 0.7 * cos(angle - uTime * 2.5 * uReverse);
  
  // Gravitational lensing arcs (Einstein ring effect)
  float lensArc = pow(max(0.0, sin(angle * 2.0 + uTime * 1.8)), 3.0);
  lensArc *= smoothstep(0.8, 1.2, ringDist);
  
  // Core color with thermal gradient
  vec3 coreCol = uCoreColor;
  vec3 hotInner = vec3(1.0, 0.95, 0.85);
  vec3 coolOuter = vec3(1.0, 0.4, 0.15);
  vec3 ringColor = mix(coolOuter, hotInner, ringMask);
  
  // Intensify during portal activation
  float intensity = 2.5 + uPortal * 3.5;
  ringColor *= doppler * intensity;
  
  // Add lensing arc highlights
  ringColor += vec3(0.8, 0.6, 1.0) * lensArc * uPortal * 2.0;
  
  // Mix with black horizon
  vec3 finalColor = mix(ringColor, vec3(0.0), horizon);
  
  gl_FragColor = vec4(finalColor, 1.0);
}`;

/* ======================== ACCRETION TUNNEL SHADER ======================== */

/**
 * The swirling tunnel effect during Kamui transit.
 * Represents the dimensional bridge between two points in spacetime.
 */
export const kamuiTunnelVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
varying float vTunnelDepth;
uniform float uTime;
uniform float uProgress;
uniform float uReverse;

void main() {
  vUv = uv;
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  
  // Tunnel depth based on radial distance
  vTunnelDepth = length(vWorldPos.xz) / 2.0;
  
  // Spiraling motion along tunnel axis
  float spiralAngle = atan(vWorldPos.z, vWorldPos.x);
  float spiralSpeed = 3.0 * (1.0 - vTunnelDepth) * uReverse;
  float twist = uTime * spiralSpeed + uProgress * 12.0;
  
  // Radial pulsing during transit
  float pulse = 1.0 + 0.2 * sin(uTime * 6.0 + vTunnelDepth * 8.0) * uProgress;
  
  vec3 pos = position;
  pos.xz *= pulse;
  pos.y *= 1.0 + uProgress * 0.3;
  
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
}`;

export const kamuiTunnelFrag = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform float uReverse;
uniform vec3 uTunnelColor;
varying vec2 vUv;
varying vec3 vWorldPos;
varying float vTunnelDepth;
${KAMUI_NOISE}

void main() {
  float angle = atan(vWorldPos.z, vWorldPos.x);
  float radius = length(vWorldPos.xz);
  
  // Spiral arms flowing through tunnel
  float spiralPhase = angle * 4.0 + vTunnelDepth * 15.0 - uTime * 2.5 * uReverse;
  float spiralArms = pow(max(0.0, 0.5 + 0.5 * sin(spiralPhase)), 2.5);
  
  // Turbulent energy streams
  vec3 flowDir = normalize(vWorldPos);
  float turbulence = fbm(flowDir * 6.0 + vec3(0.0, uTime * 0.4, 0.0));
  turbulence = 0.5 + 0.5 * turbulence;
  
  // Depth-based fading (tunnel entrance vs exit)
  float depthFade = smoothstep(0.0, 0.3, uProgress) * smoothstep(1.0, 0.7, uProgress);
  
  // Inner core brightness
  float coreGlow = exp(-radius * 3.0);
  
  // Combine all elements
  vec3 baseColor = uTunnelColor * (0.4 + 0.6 * spiralArms);
  baseColor *= turbulence;
  baseColor += vec3(1.0, 0.9, 0.7) * coreGlow * 0.5;
  baseColor *= depthFade;
  
  // Edge vignette
  float vignette = 1.0 - smoothstep(0.6, 1.0, radius);
  baseColor *= vignette;
  
  float alpha = 0.7 + 0.3 * uProgress;
  gl_FragColor = vec4(baseColor, alpha);
}`;

/* ======================== DIMENSIONAL TEAR SHADER ======================== */

/**
 * The actual tear/rupture in reality that appears when Kamui activates.
 * Shows the dimensional boundary being breached.
 */
export const kamuiTearVert = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
varying float vTearIntensity;
uniform vec3 uTearCenter;
uniform float uTearRadius;
uniform float uTearProgress;
uniform float uReverse;

void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vW = (modelMatrix * vec4(position, 1.0)).xyz;
  
  // Tear expands from center
  vec3 delta = vW - uTearCenter;
  float dist = length(delta);
  float tearMask = 1.0 - smoothstep(uTearRadius * 0.5, uTearRadius, dist);
  vTearIntensity = tearMask * uTearProgress;
  
  // Edges fray and distort more than center
  float edgeDist = 1.0 - dist / max(uTearRadius, 0.001);
  float edgeFray = pow(edgeDist, 3.0) * uTearProgress;
  
  // Vertices near edge get displaced radially
  vec3 dir = normalize(delta + vec3(0.0001));
  float displacement = edgeFray * 0.3 * uReverse;
  vec3 newPos = position + dir * displacement;
  
  gl_Position = projectionMatrix * viewMatrix * vec4(newPos, 1.0);
}`;

export const kamuiTearFrag = /* glsl */ `
uniform float uTearProgress;
uniform float uTime;
uniform vec3 uVoidColor;
uniform vec3 uEdgeColor;
varying vec3 vN;
varying vec3 vW;
varying float vTearIntensity;
${KAMUI_NOISE}

void main() {
  vec3 viewDir = normalize(cameraPosition - vW);
  float frontness = max(dot(vN, viewDir), 0.0);
  
  // Void center (dimensional nothingness)
  float voidMask = smoothstep(0.2, 0.8, vTearIntensity);
  vec3 voidCol = uVoidColor * (1.0 - frontness * 0.5);
  
  // Energetic edge rim (reality being torn apart)
  float edgeRim = exp(-pow((frontness - 0.5) / 0.15, 2.0));
  edgeRim *= vTearIntensity;
  vec3 edgeCol = uEdgeColor * edgeRim * (1.5 + 0.5 * sin(uTime * 8.0));
  
  // Fracture lines spreading from center
  float angle = atan(vW.z, vW.x);
  float fractures = pow(max(0.0, sin(angle * 12.0 + uTime * 3.0)), 4.0);
  fractures *= vTearIntensity * 0.6;
  vec3 fractureCol = vec3(1.0, 0.8, 0.6) * fractures;
  
  // Combine layers
  vec3 finalColor = voidCol + edgeCol + fractureCol;
  float alpha = vTearIntensity * (0.8 + 0.2 * frontness);
  
  gl_FragColor = vec4(finalColor, alpha);
}`;

/* ======================== KAMUI CONTROLLER CLASS ======================== */

export interface KamuiConfig {
  center: THREE.Vector3;
  radius: number;
  strength: number;
  time: number;
  reverse: number; // +1 suction, -1 expulsion
  phase: 'idle' | 'arming' | 'disturbance' | 'deformation' | 'vortex' | 'collapse' | 'hold' | 'out';
}

export class KamuiEffect {
  private scene: THREE.Scene;
  private uniforms: Record<string, THREE.IUniform>;
  private spacetimeMesh?: THREE.Mesh;
  private singularityGroup?: THREE.Group;
  private tunnelMesh?: THREE.Mesh;
  private tearMesh?: THREE.Mesh;
  private active = false;
  private config: KamuiConfig;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.config = {
      center: new THREE.Vector3(),
      radius: 100,
      strength: 0,
      time: 0,
      reverse: 1,
      phase: 'idle',
    };

    this.uniforms = {
      uKamuiCenter: { value: new THREE.Vector3() },
      uKamuiRadius: { value: 100 },
      uKamuiStrength: { value: 0 },
      uKamuiTime: { value: 0 },
      uReverse: { value: 1 },
      uBaseColor: { value: new THREE.Vector3(1, 1, 1) },
      uEmissionMult: { value: 1.5 },
      uTime: { value: 0 },
      uPortal: { value: 0 },
      uCoreColor: { value: new THREE.Vector3(1, 0.85, 0.6) },
      uProgress: { value: 0 },
      uTunnelColor: { value: new THREE.Vector3(0.6, 0.8, 1.0) },
      uTearCenter: { value: new THREE.Vector3() },
      uTearRadius: { value: 50 },
      uTearProgress: { value: 0 },
      uVoidColor: { value: new THREE.Vector3(0.05, 0.02, 0.1) },
      uEdgeColor: { value: new THREE.Vector3(1.0, 0.6, 0.3) },
    };

    this.createSpacetimeDistortion();
    this.createSingularity();
    this.createTunnel();
    this.createTear();
  }

  private createSpacetimeDistortion() {
    // Large sphere surrounding the scene for background distortion
    const geometry = new THREE.SphereGeometry(500, 64, 64);
    const material = new THREE.ShaderMaterial({
      vertexShader: kamuiSpacetimeVert,
      fragmentShader: kamuiSpacetimeFrag,
      uniforms: this.uniforms,
      transparent: true,
      side: THREE.BackSide,
    });
    this.spacetimeMesh = new THREE.Mesh(geometry, material);
    this.spacetimeMesh.visible = false;
    this.scene.add(this.spacetimeMesh);
  }

  private createSingularity() {
    this.singularityGroup = new THREE.Group();

    // Event horizon sphere
    const horizonGeo = new THREE.SphereGeometry(1, 32, 32);
    const horizonMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const horizon = new THREE.Mesh(horizonGeo, horizonMat);
    this.singularityGroup.add(horizon);

    // Photon ring
    const ringGeo = new THREE.RingGeometry(0.9, 1.1, 64, 1);
    const ringMat = new THREE.ShaderMaterial({
      vertexShader: kamuiSingularityVert,
      fragmentShader: kamuiSingularityFrag,
      uniforms: this.uniforms,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    this.singularityGroup.add(ring);

    // Accretion disk
    const diskGeo = new THREE.RingGeometry(2, 8, 64, 1);
    const diskMat = new THREE.ShaderMaterial({
      vertexShader: kamuiSingularityVert,
      fragmentShader: kamuiSingularityFrag,
      uniforms: this.uniforms,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const disk = new THREE.Mesh(diskGeo, diskMat);
    disk.rotation.x = Math.PI / 2;
    this.singularityGroup.add(disk);

    this.singularityGroup.visible = false;
    this.scene.add(this.singularityGroup);
  }

  private createTunnel() {
    const geometry = new THREE.CylinderGeometry(2, 8, 20, 32, 1, true);
    const material = new THREE.ShaderMaterial({
      vertexShader: kamuiTunnelVert,
      fragmentShader: kamuiTunnelFrag,
      uniforms: this.uniforms,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.tunnelMesh = new THREE.Mesh(geometry, material);
    this.tunnelMesh.visible = false;
    this.scene.add(this.tunnelMesh);
  }

  private createTear() {
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const material = new THREE.ShaderMaterial({
      vertexShader: kamuiTearVert,
      fragmentShader: kamuiTearFrag,
      uniforms: this.uniforms,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.tearMesh = new THREE.Mesh(geometry, material);
    this.tearMesh.visible = false;
    this.scene.add(this.tearMesh);
  }

  activate(center: THREE.Vector3, radius: number, reverse = 1) {
    this.config.center.copy(center);
    this.config.radius = radius;
    this.config.reverse = reverse;
    this.config.phase = 'arming';
    this.config.strength = 0;
    this.active = true;

    this.uniforms.uKamuiCenter.value.copy(center);
    this.uniforms.uKamuiRadius.value = radius;
    this.uniforms.uReverse.value = reverse;
    this.uniforms.uTearCenter.value.copy(center);
    this.uniforms.uTearRadius.value = radius * 1.5;

    if (this.spacetimeMesh) {
      this.spacetimeMesh.position.copy(center);
      this.spacetimeMesh.visible = true;
    }
    if (this.singularityGroup) {
      this.singularityGroup.position.copy(center);
      this.singularityGroup.visible = true;
    }
    if (this.tearMesh) {
      this.tearMesh.position.copy(center);
      this.tearMesh.scale.setScalar(radius * 1.5);
      this.tearMesh.visible = true;
    }
  }

  deactivate() {
    this.active = false;
    this.config.phase = 'idle';
    this.config.strength = 0;

    if (this.spacetimeMesh) this.spacetimeMesh.visible = false;
    if (this.singularityGroup) this.singularityGroup.visible = false;
    if (this.tunnelMesh) this.tunnelMesh.visible = false;
    if (this.tearMesh) this.tearMesh.visible = false;
  }

  update(dt: number) {
    if (!this.active) return;

    this.config.time += dt;
    this.uniforms.uKamuiTime.value = this.config.time;
    this.uniforms.uTime.value = this.config.time;

    // Phase progression
    const t = this.config.time;
    const reverse = this.config.reverse;

    switch (this.config.phase) {
      case 'arming':
        // Initial gravity field activation (0-0.5s)
        this.config.strength = Math.min(t / 0.5, 1);
        if (t > 0.5) this.config.phase = 'disturbance';
        break;

      case 'disturbance':
        // Space starts bending, subtle attraction (0.5-1.5s)
        this.config.strength = 0.3 + Math.min((t - 0.5) / 1.0, 0.7) * 0.7;
        this.uniforms.uKamuiStrength.value = this.config.strength;
        if (t > 1.5) this.config.phase = 'deformation';
        break;

      case 'deformation':
        // Reality caves inward, swirling begins (1.5-3s)
        this.config.strength = 0.7 + Math.min((t - 1.5) / 1.5, 1) * 0.3;
        this.uniforms.uKamuiStrength.value = this.config.strength;
        this.uniforms.uPortal.value = Math.min((t - 1.5) / 1.5, 1);
        if (t > 3.0) this.config.phase = 'vortex';
        break;

      case 'vortex':
        // Full spiraling with differential rotation (3-5s)
        this.config.strength = 1.0;
        this.uniforms.uKamuiStrength.value = 1.0;
        this.uniforms.uPortal.value = 0.5 + Math.sin((t - 3.0) * 2.0) * 0.5;
        if (t > 5.0) this.config.phase = 'collapse';
        break;

      case 'collapse':
        // Aperture opens, throat visible (5-6s)
        this.uniforms.uPortal.value = 1.0;
        if (this.tunnelMesh) {
          this.tunnelMesh.visible = true;
          this.uniforms.uProgress.value = Math.min((t - 5.0), 1);
        }
        if (t > 6.0) this.config.phase = 'hold';
        break;

      case 'hold':
        // Stable wormhole for traversal
        this.uniforms.uPortal.value = 1.0;
        this.uniforms.uProgress.value = 1.0;
        // Stay in hold until triggered to exit
        break;

      case 'out':
        // Reverse traversal (expulsion)
        this.uniforms.uReverse.value = -1;
        this.uniforms.uPortal.value = 1.0 - Math.min((t - 5.0) / 2.0, 1);
        if (t > 7.0) {
          this.deactivate();
        }
        break;
    }

    // Update all mesh positions to follow center
    const center = this.config.center;
    if (this.spacetimeMesh) this.spacetimeMesh.position.copy(center);
    if (this.singularityGroup) this.singularityGroup.position.copy(center);
    if (this.tearMesh) this.tearMesh.position.copy(center);
    if (this.tunnelMesh) {
      this.tunnelMesh.position.copy(center);
      this.tunnelMesh.lookAt(center.clone().add(new THREE.Vector3(0, reverse ? 1 : -1, 0)));
    }
  }

  setPhase(phase: KamuiConfig['phase']) {
    this.config.phase = phase;
    if (phase === 'out') {
      this.config.time = 5.0; // Start exit sequence
    }
  }

  dispose() {
    if (this.spacetimeMesh) {
      this.spacetimeMesh.geometry.dispose();
      (this.spacetimeMesh.material as THREE.Material).dispose();
      this.scene.remove(this.spacetimeMesh);
    }
    if (this.singularityGroup) {
      this.singularityGroup.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
      this.scene.remove(this.singularityGroup);
    }
    if (this.tunnelMesh) {
      this.tunnelMesh.geometry.dispose();
      (this.tunnelMesh.material as THREE.Material).dispose();
      this.scene.remove(this.tunnelMesh);
    }
    if (this.tearMesh) {
      this.tearMesh.geometry.dispose();
      (this.tearMesh.material as THREE.Material).dispose();
      this.scene.remove(this.tearMesh);
    }
  }
}

import * as THREE from 'three';
import type { BlackHoleVisual } from './blackhole';

/**
 * Raymarched black hole overlay — the cinematic tier.
 *
 * A camera-facing quad placed over the composite black hole. The fragment
 * shader integrates null geodesics through the Schwarzschild metric:
 *
 *     d²x/dλ² = −(3/2) · h² · x / r⁵        (rs = 1 units, h = |x × v|)
 *
 * producing genuine gravitational lensing of the procedural starfield, a
 * volumetric accretion disk with Shakura–Sunyaev falloff and relativistic
 * Doppler beaming, and the photon-ring shimmer.
 *
 * SAFETY CONTRACT (preserved from blackhole.ts): this is an ADDITIVE overlay
 * on top of the infallible composite. If its shader fails to compile the
 * eventide-shader-error hook fires, the engine hides it, and the composite
 * alone renders — the hole can never go black. Nothing here writes depth and
 * nothing here occludes.
 */

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec4 vWorld;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;
varying vec4 vWorld;

uniform vec3 uCamPos;
uniform vec3 uCenter;      /* hole center in world space */
uniform float uRs;         /* Schwarzschild radius (world units) */
uniform float uTime;
uniform float uIntensity;
uniform int uSteps;
uniform vec3 uDiskHot;
uniform vec3 uDiskCool;

#define PI 3.141592653589793

/* --- procedural starfield (hash grid on the ray's escape direction) --- */
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec3 starfield(vec3 dir) {
  vec3 col = vec3(0.0);
  /* spherical grid → two hash scales of stars */
  for (int k = 0; k < 2; k++) {
    float scale = (k == 0) ? 22.0 : 46.0;
    vec2 uv = vec2(atan(dir.z, dir.x) / (2.0 * PI) + 0.5, asin(clamp(dir.y, -1.0, 1.0)) / PI + 0.5) * scale;
    vec2 cell = floor(uv);
    vec2 f = fract(uv);
    float h = hash21(cell + float(k) * 17.0);
    if (h > 0.972) {
      vec2 starPos = vec2(hash21(cell + 3.1), hash21(cell + 7.7));
      float d = length(f - starPos);
      float mag = (h - 0.972) / 0.028;
      float star = exp(-d * d * 240.0) * (0.55 + 0.45 * sin(uTime * (1.2 + mag * 2.0) + mag * 40.0));
      col += mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.86, 0.66), hash21(cell + 11.3)) * star * mag;
    }
  }
  return col;
}

/* --- accretion disk emission at a crossing point (rs units) --- */
vec3 diskEmission(vec3 p, float doppler) {
  float r = length(p.xz);
  float t = clamp((r - 3.0) / 9.0, 0.0, 1.0);
  float radial = pow(1.0 - t, 1.25) * 0.85 + 0.38 * exp(-9.0 * t);
  /* Keplerian-sheared turbulent streaks */
  float ang = atan(p.z, p.x);
  float shear = ang * 3.2 - r * 2.6 + uTime * 0.55;
  float streak = 0.62 + 0.38 * sin(shear * 5.5 + sin(shear * 2.3 + r) * 1.7);
  streak *= 0.75 + 0.25 * sin(r * 23.0 - uTime * 1.9);
  vec3 c = mix(uDiskHot, uDiskCool, smoothstep(0.0, 0.85, t));
  return c * radial * streak * doppler;
}

void main() {
  /* ray from camera through this fragment, in rs units */
  vec3 ro = (uCamPos - uCenter) / uRs;
  vec3 rd = normalize(vWorld.xyz - uCamPos);
  rd /= max(uRs, 1e-4);

  /* conserved angular momentum of the photon */
  vec3 hVec = cross(ro, rd);
  float h2 = dot(hVec, hVec);
  h2 *= 1.5;

  float stepLen = 0.16;
  vec3 p = ro;
  vec3 v = rd;

  vec3 emission = vec3(0.0);
  bool captured = false;
  float prevY = p.y;

  for (int i = 0; i < 96; i++) {
    if (i >= uSteps) break;
    float r2 = dot(p, p);
    float r = sqrt(r2);
    if (r < 1.0) { captured = true; break; }        /* event horizon */
    if (r > 42.0 && dot(p, v) > 0.0) break;          /* escaped */

    /* null-geodesic bending */
    vec3 acc = -h2 * p / (r2 * r2 * r);
    vec3 vNext = v + acc * stepLen;
    vec3 pNext = p + vNext * stepLen;

    /* disk plane crossing (disk normal = +y, between 3 and 12 rs) */
    if (prevY * pNext.y < 0.0) {
      float f = prevY / (prevY - pNext.y);
      vec3 hit = mix(p, pNext, clamp(f, 0.0, 1.0));
      float hr = length(hit.xz);
      if (hr > 2.6 && hr < 13.0) {
        /* Doppler beaming: disk orbits counter-clockwise around +y */
        vec3 tangent = normalize(vec3(-hit.z, 0.0, hit.x));
        float beta = clamp(0.55 / sqrt(max(hr, 1.0)), 0.0, 0.6);
        float cosA = dot(tangent, -vNext);
        float doppler = pow(clamp(1.0 + beta * cosA, 0.05, 2.0), 3.0);
        float thin = 0.55 + 0.45 * sin(uTime * 0.8 + hr * 2.0);
        emission += diskEmission(hit, doppler) * 0.11 * thin * uIntensity;
      }
    }

    prevY = p.y;
    p = pNext;
    v = vNext;
  }

  /* lensed starfield behind the hole (final photon direction) */
  vec3 stars = vec3(0.0);
  if (!captured) {
    stars = starfield(normalize(v)) * uIntensity;
  }

  /* photon ring shimmer: intensity spikes for rays that skim r ≈ 1.5 rs */
  float minR = 1e9;
  /* recompute cheaply: approximate with closest approach of the straight leg */
  minR = length(cross(ro, normalize(v)));
  float ring = exp(-pow((minR - 1.5) * 6.0, 2.0)) * 0.9 * uIntensity;
  emission += uDiskHot * ring * (0.75 + 0.25 * sin(uTime * 2.2));

  vec3 col = emission + stars * (captured ? 0.0 : 1.0);
  float alpha = clamp(max(max(col.r, col.g), col.b) * 1.35, 0.0, 1.0);
  if (captured) { col = vec3(0.0); alpha = 0.0; } /* the composite's black sphere owns the shadow */

  gl_FragColor = vec4(col, alpha);
}
`;

export interface RaymarchBlackHoleOptions {
  /** disk tint, hot inner edge */
  colorHot?: string;
  /** disk tint, cooled outer edge */
  colorCool?: string;
  /** global emission multiplier */
  intensity?: number;
  /** ray steps (quality) */
  steps?: number;
}

/**
 * Builds the raymarched overlay. Returns null when the caller should use the
 * composite alone (non-cinematic tier). The returned BlackHoleVisual has the
 * same contract as the composite: parent the group to the body, never move it.
 */
export function createRaymarchBlackHole(R: number, opts: RaymarchBlackHoleOptions = {}): BlackHoleVisual {
  const rs = R * 0.62;
  const group = new THREE.Group();

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uCamPos: { value: new THREE.Vector3() },
      uCenter: { value: new THREE.Vector3() },
      uRs: { value: rs },
      uTime: { value: 0 },
      uIntensity: { value: opts.intensity ?? 1.0 },
      uSteps: { value: Math.max(24, Math.min(96, opts.steps ?? 56)) },
      uDiskHot: { value: new THREE.Color(opts.colorHot ?? '#fff3d6') },
      uDiskCool: { value: new THREE.Color(opts.colorCool ?? '#ff8a3c') },
    },
  });

  /* quad wide enough to frame the disk (12 rs) plus the lensed halo (~2.2×) */
  const quadSize = rs * 30;
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(quadSize, quadSize), material);
  quad.renderOrder = 12; /* after the composite's transparent layers */
  group.add(quad);

  return {
    group,
    update(time, camQuat, portal) {
      material.uniforms.uTime.value = time;
      /* billboard: copy the camera's world orientation so the quad faces it */
      if (camQuat) quad.quaternion.copy(camQuat);
      const fade = portal === undefined ? 1 : 1 - Math.min(1, Math.abs(portal) * 1.2);
      material.uniforms.uIntensity.value = (opts.intensity ?? 1.0) * Math.max(0.0, fade);
    },
    dispose() {
      quad.geometry.dispose();
      material.dispose();
    },
  };
}

/**
 * Convenience wrapper the engine calls per frame with the live camera, since
 * the shader needs the true camera position (billboarding alone is not enough
 * for correct geodesic integration).
 */
export function updateRaymarchUniforms(
  visual: BlackHoleVisual,
  camera: THREE.Camera,
  time: number,
  portal?: number,
): void {
  const mat = ((visual.group.children[0] as THREE.Mesh | undefined)?.material) as THREE.ShaderMaterial | undefined;
  if (!mat || !mat.uniforms) return;
  visual.group.updateWorldMatrix(true, false);
  mat.uniforms.uCenter.value.setFromMatrixPosition(visual.group.matrixWorld);
  mat.uniforms.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
  mat.uniforms.uTime.value = time;
  const fade = portal === undefined ? 1 : 1 - Math.min(1, Math.abs(portal) * 1.2);
  mat.uniforms.uIntensity.value = Math.max(0, fade);
}

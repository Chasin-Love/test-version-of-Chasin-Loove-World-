/**
 * Gargantua-class black hole for the Eventide Vault — composite edition.
 *
 * Built entirely from primitives that render identically on every GPU and
 * driver stack (plain meshes + baked canvas textures + MeshBasicMaterial):
 *   • pure-black horizon sphere (the shadow, ~2.4 rs)
 *   • flat accretion disk (3–12 rs) with a baked blackbody + turbulence +
 *     Doppler-asymmetry texture, rotating with Keplerian flavor
 *   • thin blazing photon ring hugging the shadow (billboarded)
 *   • the iconic LENSED ARCS — the far side of the disk appears as an arc
 *     OVER the shadow, its secondary image below (billboarded)
 *   • a soft warm halo for distance reading
 *
 * No custom GLSL anywhere: every earlier ray-marched attempt depended on
 * driver-specific shader compilation (ANGLE/D3D silently produced black on
 * some Windows GPUs). This composition cannot fail that way — worst case a
 * texture tint is off, but the hole always exists and always reads.
 */

import * as THREE from 'three';

/* ------------------------- tiny value-noise (CPU) ------------------------ */

function makeNoise2(seed: number): (x: number, y: number) => number {
  const hash = (x: number, y: number) => {
    let h = seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/* ------------------------------ textures -------------------------------- */

/** Full-square top view of the disk for RingGeometry's planar UVs:
 *  blackbody radial ramp, Keplerian-sheared streaks, Doppler asymmetry. */
function makeDiskTexture(rs: number): THREE.CanvasTexture {
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  const data = img.data;
  const noise = makeNoise2(1337);
  const cx = size / 2;
  const rOuterPx = size / 2 - 2;
  const rIn = 3 / 12; /* inner radius as fraction of outer (3rs of 12rs) */

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - cx) / rOuterPx;
      const dy = (y - cx) / rOuterPx;
      const r = Math.sqrt(dx * dx + dy * dy);
      const i = (y * size + x) * 4;
      if (r < rIn || r > 1) continue; /* transparent — hole & beyond */

      const t = (r - rIn) / (1 - rIn);          /* 0 at ISCO → 1 at edge */
      const th = Math.atan2(dy, dx);

      /* Shakura–Sunyaev temperature + hot inner rim */
      let bright = Math.pow(1 - t, 1.25) * 0.85 + 0.38 * Math.exp(-t * 9);

      /* Keplerian-sheared turbulence: long streaks stretched ALONG the
         orbit (low radial frequency, higher angular frequency) */
      const sx = Math.cos(th - r * 3.2) * 5.5;
      const sy = Math.sin(th - r * 3.2) * 5.5;
      const n =
        noise(sx + r * 9, sy + r * 5.5) * 0.55 +
        noise(sx * 2.1 + r * 16, sy * 2.1 + r * 9) * 0.45;
      const streak = 0.35 + 0.85 * clamp01((n - 0.2) / 0.62);
      bright *= streak;

      /* Doppler beaming, baked: material orbiting counter-clockwise seen
         from +Y — the +x side approaches and flares white-hot */
      const doppler = 1 + 0.85 * Math.cos(th);
      bright *= 0.42 + 0.58 * doppler;

      /* edge fades — the outer melt is long and soft so the disk dissolves
         into the background instead of ending like a plate */
      bright *= (1 - smoothstepJs(0.74, 1.0, r)) * smoothstepJs(rIn, rIn + 0.05, r);
      bright = Math.min(bright, 3.6);

      /* color: blackbody ramp — white-hot inner, gold mid, deep orange outer;
         the approaching side shifts whiter */
      let cr: number, cg: number, cb: number;
      if (t < 0.35) { cr = 1; cg = mix(0.88, 0.62, t / 0.35); cb = mix(0.6, 0.28, t / 0.35); }
      else if (t < 0.75) { const u = (t - 0.35) / 0.4; cr = 1; cg = mix(0.62, 0.4, u); cb = mix(0.28, 0.1, u); }
      else { const u = (t - 0.75) / 0.25; cr = 0.95; cg = mix(0.4, 0.24, u); cb = mix(0.1, 0.04, u); }
      const white = clamp01((doppler - 1.15) * 0.6) * (1 - t) * 0.55;
      cr = mix(cr, 0.95, white); cg = mix(cg, 0.96, white); cb = mix(cb, 1.0, white);

      const b8 = Math.min(255, bright * 205);
      data[i] = Math.min(255, cr * b8 * 1.4);
      data[i + 1] = Math.min(255, cg * b8 * 1.4);
      data[i + 2] = Math.min(255, cb * b8 * 1.4);
      data[i + 3] = Math.min(255, clamp01(bright * 0.75) * 255);
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function smoothstepJs(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/** Thin blazing photon ring. */
function makeRingTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.sqrt((x - 128) ** 2 + (y - 128) ** 2) / 128;
      const band = smoothstepJs(0.78, 0.9, r) * smoothstepJs(1.0, 0.94, r);
      const i = (y * size + x) * 4;
      const b = band * 255;
      data255(img.data, i, 255 * band, 235 * band, 190 * band, b);
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Lensed-arc band: white-hot at the inner edge, streaky falloff outward. */
function makeArcTexture(seed: number): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  const noise = makeNoise2(seed);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - 256) / 256, dy = (y - 256) / 256;
      const r = Math.sqrt(dx * dx + dy * dy);
      const th = Math.atan2(dy, dx);
      /* band occupies r ∈ [0.52, 1.0] — RingGeometry crops to the arc;
         alpha reaches exactly 0 at r=1 so the outer edge is invisible */
      const inner = smoothstepJs(0.5, 0.56, r);
      const fall = 1 - smoothstepJs(0.56, 1.0, r);
      /* fade the arc's cut ENDS (the horizontal diameter) so it dissolves
         into the flat disk instead of stopping like a plate */
      const endFade = smoothstepJs(0.015, 0.16, Math.abs(dy));
      const streak = 0.7 + 0.3 * noise(Math.cos(th) * 5 + 9, Math.sin(th) * 5 + r * 22);
      let a = inner * fall * streak * 0.95 * endFade;
      /* white-hot line at the very inner edge */
      const hot = smoothstepJs(0.5, 0.53, r) * (1 - smoothstepJs(0.53, 0.62, r)) * endFade;
      const i = (y * size + x) * 4;
      const cr = mix(255, 255, hot), cg = mix(190 * fall + 40, 245, hot), cb = mix(120 * fall + 20, 255, hot);
      a = clamp01(a + hot * 0.8);
      data255(img.data, i, cr * a, cg * a, cb * a, a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Einstein-ring star streams — dozens of overlapping thin smeared arcs
 *  forming one continuous band around the shadow. Billed as the background
 *  starlight dragged around the hole; the mesh slowly rotates so the
 *  streams visibly orbit instead of sitting still. */
function makeLensingTexture(): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  let seed = 20260909;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  /* soft base band so the stream never shows gaps */
  const base = g.createRadialGradient(256, 256, 256 * 0.54, 256, 256, 256);
  base.addColorStop(0, 'rgba(0,0,0,0)');
  base.addColorStop(0.18, 'rgba(215, 225, 255, 0.10)');
  base.addColorStop(0.55, 'rgba(230, 215, 190, 0.13)');
  base.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  /* the smeared star arcs */
  const count = 170;
  for (let k = 0; k < count; k++) {
    const rr = 0.55 + Math.pow(rand(), 1.35) * 0.43;            /* ring radius, uv */
    const a0 = rand() * Math.PI * 2;
    const len = (0.35 + rand() * 1.6) * (0.6 + rr);              /* arc length, rad */
    const width = 0.6 + rand() * 1.9;
    const warm = rand() > 0.42;
    const b = 0.10 + rand() * 0.42;
    g.strokeStyle = warm
      ? `rgba(255, ${205 + Math.floor(rand() * 35)}, ${150 + Math.floor(rand() * 60)}, ${b})`
      : `rgba(${185 + Math.floor(rand() * 40)}, ${215 + Math.floor(rand() * 30)}, 255, ${b})`;
    g.lineWidth = width;
    g.beginPath();
    g.arc(256, 256, rr * 256, a0, a0 + len);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft filled warm halo (distant glow reading). */
function makeHaloTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255, 205, 140, 0.55)');
  grad.addColorStop(0.3, 'rgba(255, 165, 85, 0.26)');
  grad.addColorStop(0.65, 'rgba(160, 90, 40, 0.08)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Outer haze — an ultra-soft warm skirt that melts the disk edge into the
 *  background so the hole grows out of space instead of floating on it. */
function makeHazeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const r = Math.sqrt((x - 128) ** 2 + (y - 128) ** 2) / 128;
      /* RingGeometry maps inner 10rs → 0.606; glow peaks just outside the
         disk edge and fades to nothing at the outer rim */
      const a = smoothstepJs(0.6, 0.72, r) * (1 - smoothstepJs(0.74, 0.99, r)) * 0.5;
      const i = (y * 256 + x) * 4;
      data255(img.data, i, 255 * a, 175 * a, 95 * a, a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function data255(d: Uint8ClampedArray, i: number, r: number, g: number, b: number, a: number): void {
  d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
}

/* ------------------------------ assembly -------------------------------- */

export interface BlackHoleVisual {
  group: THREE.Group;
  update(time: number, camQuat?: THREE.Quaternion, portal?: number): void;
  dispose(): void;
}

/**
 * Builds the composite black hole. `R` is the body's nominal radius;
 * everything derives from rs = 0.62·R: shadow 2.35 rs, photon ring 2.5 rs,
 * disk 3–12 rs (ISCO outward), lensed arcs above and below.
 *
 * `bh.group` is parented to the body's group and must NEVER set its own
 * position — it inherits the body's transform. (Copying a world position
 * into a local one double-transforms the hole to 2× its orbit position.)
 */
export function createBlackHole(R: number): BlackHoleVisual {
  const rs = R * 0.62;

  const group = new THREE.Group();

  /* 1. the horizon — pure black, occludes properly in the opaque pass */
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(rs * 2.35, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x000000 }),
  );
  group.add(core);

  /* 2. the accretion disk — world-oriented, slowly shearing */
  const normal = new THREE.Vector3(0.055, 1.0, 0.04).normalize();
  const diskTex = makeDiskTexture(rs);
  const diskMat = new THREE.MeshBasicMaterial({
    map: diskTex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const disk = new THREE.Mesh(new THREE.RingGeometry(rs * 3, rs * 12, 160, 1), diskMat);
  const diskTilt = new THREE.Group();
  diskTilt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  diskTilt.add(disk);

  /* outer haze skirt — melts the disk edge into the background */
  const hazeMat = new THREE.MeshBasicMaterial({
    map: makeHazeTexture(),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    opacity: 0.55,
  });
  const haze = new THREE.Mesh(new THREE.RingGeometry(rs * 10, rs * 16.5, 96, 1), hazeMat);
  diskTilt.add(haze);
  group.add(diskTilt);

  /* 3–5. billboarded: photon ring + the lensed arcs over/under the shadow */
  const billboard = new THREE.Group();

  const ringMat = new THREE.MeshBasicMaterial({
    map: makeRingTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const photonRing = new THREE.Mesh(new THREE.RingGeometry(rs * 2.42, rs * 2.62, 96, 1), ringMat);
  billboard.add(photonRing);

  const arcTexTop = makeArcTexture(4242);
  const arcTexBottom = makeArcTexture(909);
  const topArc = new THREE.Mesh(
    new THREE.RingGeometry(rs * 2.7, rs * 5.4, 96, 1, 0, Math.PI),
    new THREE.MeshBasicMaterial({ map: arcTexTop, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  );
  const bottomArc = new THREE.Mesh(
    new THREE.RingGeometry(rs * 2.8, rs * 4.6, 96, 1, Math.PI, Math.PI),
    new THREE.MeshBasicMaterial({ map: arcTexBottom, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.7 }),
  );
  billboard.add(topArc, bottomArc);

  /* Einstein-ring star streams — the continuous smeared band just outside
     the shadow; it slowly rotates so the lensed starlight visibly orbits */
  const lensTex = makeLensingTexture();
  const lensMat = new THREE.MeshBasicMaterial({
    map: lensTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const lensRing = new THREE.Mesh(new THREE.RingGeometry(rs * 2.55, rs * 4.7, 128, 1), lensMat);
  lensRing.renderOrder = 2;
  billboard.add(lensRing);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeHaloTexture(),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.5,
  }));
  halo.scale.setScalar(rs * 9);
  billboard.add(halo);

  billboard.renderOrder = 6;
  disk.renderOrder = 5;
  group.add(billboard);

  return {
    group,
    update(time, camQuat, portal = 0) {
      if (camQuat) billboard.quaternion.copy(camQuat);
      const warp = clamp01(portal);
      /* majestic Keplerian-flavored shear; portal energy accelerates and
         stretches the actual disk instead of placing a screen ring over it */
      disk.rotation.z = -time * 0.055 - warp * (0.55 + 0.12 * Math.sin(time * 6.0));
      disk.scale.setScalar(1 + warp * 0.16);
      diskTilt.scale.setScalar(1 + warp * 0.10);
      /* the lensed starlight continuously orbits the shadow */
      lensRing.rotation.z = time * 0.12 + warp * (0.85 + 0.18 * Math.sin(time * 5.0));
      billboard.scale.setScalar(1 + warp * (0.14 + 0.035 * Math.sin(time * 7.0)));
    },
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.MeshBasicMaterial | undefined;
        if (mat) {
          if (mat.map) mat.map.dispose();
          mat.dispose();
        }
      });
      (halo.material as THREE.SpriteMaterial).map?.dispose();
      (halo.material as THREE.Material).dispose();
    },
  };
}

import * as THREE from 'three';

/**
 * Shared math helpers for the cosmos engine.
 * Previously re-implemented in engine.ts, cameraRig.ts and blackhole.ts.
 */

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Frame-rate-independent exponential damping: `1 − e^(−λ·dt)`. */
export const damp = (cur: number, target: number, lambda: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-lambda * dt));

export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Circular soft radial gradient canvas texture for star/glow sprites.
 * Canonical variant: transparent outside the circle, no mipmaps, linear filtering.
 */
export function makeGlowTexture(size: number, stops: [number, string][]): THREE.CanvasTexture {
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

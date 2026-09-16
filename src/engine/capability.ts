/**
 * GPU capability probe + render quality tiers.
 *
 * Tiers:
 *   low       — low-power devices: pixelRatio 1, reduced particles (existing behavior)
 *   medium    — current defaults
 *   cinematic — desktop headroom: pixelRatio up to 2, richer particles,
 *               raymarched black hole overlay enabled
 *
 * The probe reads the GPU renderer string via WEBGL_debug_renderer_info and
 * never throws — any failure simply degrades the tier.
 */

export type QualityTier = 'low' | 'medium' | 'cinematic';

export interface GpuCapability {
  tier: QualityTier;
  renderer: string;
  webgl2: boolean;
  maxTextureSize: number;
  maxPixelRatio: number;
}

const STORAGE_KEY = 'my-universe:quality';
export const QUALITY_CHANGE_EVENT = 'eventide-quality-change';

let cached: GpuCapability | null = null;

/** Rough allow/deny lists for the raymarched tier. Software rasterizers never qualify. */
const SW_RASTERIZERS = ['swiftshader', 'llvmpipe', 'mesa offscreen', 'basic render', 'software'];

export function probeCapability(): GpuCapability {
  if (cached) return cached;
  let tier: QualityTier = 'medium';
  let renderer = 'unknown';
  let webgl2 = false;
  let maxTextureSize = 2048;
  let maxPixelRatio = 1.35;

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { powerPreference: 'high-performance' })
      ?? canvas.getContext('webgl', { powerPreference: 'high-performance' });
    if (gl) {
      webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
      maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? 'unknown');
      }
      const low = renderer.toLowerCase();
      const isSoftware = SW_RASTERIZERS.some((s) => low.includes(s));
      const isApple = low.includes('apple');
      const isMesa = low.includes('mesa') && !isSoftware;

      if (isSoftware) {
        tier = 'low';
      } else if (isApple || isMesa) {
        /* Apple GPUs and modern Mesa drivers are strong, but Mesa's ANGLE-on-GL
           path has historically flaked on heavy fragment loops — keep cinematic
           behind an explicit opt-in there. */
        tier = 'medium';
      } else {
        /* Desktop-class Direct3D/Vulkan-backed GPUs (NVIDIA/AMD/Intel Arc) */
        tier = 'cinematic';
      }
    } else {
      tier = 'low';
    }
  } catch {
    tier = 'low';
  }

  /* user override always wins */
  const stored = localStorage.getItem(STORAGE_KEY) as QualityTier | null;
  if (stored === 'low' || stored === 'medium' || stored === 'cinematic') {
    tier = stored;
  }

  if (tier === 'cinematic') maxPixelRatio = 2.0;
  else if (tier === 'low') maxPixelRatio = 1.0;

  cached = { tier, renderer, webgl2, maxTextureSize, maxPixelRatio };
  return cached;
}

export function getQualityTier(): QualityTier {
  return probeCapability().tier;
}

export function setQualityTier(tier: QualityTier): void {
  localStorage.setItem(STORAGE_KEY, tier);
  cached = null;
  window.dispatchEvent(new CustomEvent(QUALITY_CHANGE_EVENT, { detail: tier }));
}

/** True when the raymarched black hole overlay may be created at all. */
export function canUseRaymarchBlackHole(): boolean {
  const cap = probeCapability();
  if (cap.tier !== 'cinematic') return false;
  if (!cap.webgl2 && cap.maxTextureSize < 4096) return false;
  return !SW_RASTERIZERS.some((s) => cap.renderer.toLowerCase().includes(s));
}

/** Converts a Three renderer's pixel ratio policy to the tier's policy. */
export function pixelRatioFor(tier: QualityTier, deviceRatio: number): number {
  const cap = probeCapability();
  const ceiling = tier === 'cinematic' ? Math.min(cap.maxPixelRatio, 2) : tier === 'low' ? 1 : 1.35;
  return Math.min(deviceRatio, ceiling);
}

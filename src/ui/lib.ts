/**
 * Shared UI helpers. Previously duplicated across DiaryWindow / MediaPlates / VaultUI.
 */

/** Deterministic FNV-1a-seeded waveform bars for audio/attachment plates. */
export function synthBars(seedStr: string, n: number, floor = 0.08): number[] {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const v = ((h >>> 0) % 1000) / 1000;
    const env = Math.sin((i / n) * Math.PI) * 0.7 + 0.3;
    out.push(Math.max(floor, v * env));
  }
  return out;
}

/** Read a Blob as a data URL (inline attachment payloads). */
export function readAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error('readAsDataURL failed'));
    r.readAsDataURL(blob);
  });
}

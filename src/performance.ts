/**
 * Opt-in browser performance telemetry.
 *
 * It is intentionally dormant unless the app is opened with ?perf=1, so normal
 * users pay no sampling or global-object overhead beyond this tiny module.
 */

export interface UniversePerformanceSnapshot {
  enabled: boolean;
  elapsedMs: number;
  frames: number;
  averageFrameMs: number;
  p95FrameMs: number;
  worstFrameMs: number;
  measuredFps: number;
  persistenceWrites: number;
  lastPersistedBytes: number;
  bootMarks: Record<string, number>;
  measures: Record<string, number>;
  storageUsageBytes: number | null;
  storageQuotaBytes: number | null;
}

declare global {
  interface Window {
    __MY_UNIVERSE_PERF__?: () => UniversePerformanceSnapshot;
  }
}

const enabled = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('perf');
const startedAt = typeof performance !== 'undefined' ? performance.now() : 0;
const frameSamples: number[] = [];
const bootMarks: Record<string, number> = {};
const measures: Record<string, number> = {};
let storageUsageBytes: number | null = null;
let storageQuotaBytes: number | null = null;
let frameTotal = 0;
let worstFrame = 0;
let persistenceWrites = 0;
let lastPersistedBytes = 0;

if (enabled && typeof navigator !== 'undefined' && navigator.storage?.estimate) {
  void navigator.storage.estimate().then((estimate) => {
    storageUsageBytes = estimate.usage ?? null;
    storageQuotaBytes = estimate.quota ?? null;
  }).catch(() => undefined);
}

function snapshot(): UniversePerformanceSnapshot {
  const sorted = [...frameSamples].sort((a, b) => a - b);
  const p95Index = sorted.length ? Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95)) : 0;
  const elapsedMs = Math.max(1, performance.now() - startedAt);
  const averageFrameMs = frameSamples.length ? frameTotal / frameSamples.length : 0;
  return {
    enabled,
    elapsedMs,
    frames: frameSamples.length,
    averageFrameMs,
    p95FrameMs: sorted[p95Index] ?? 0,
    worstFrameMs: worstFrame,
    measuredFps: frameTotal ? Math.min(240, 1000 / averageFrameMs) : 0,
    persistenceWrites,
    lastPersistedBytes,
    bootMarks: { ...bootMarks },
    measures: { ...measures },
    storageUsageBytes,
    storageQuotaBytes,
  };
}

if (enabled && typeof window !== 'undefined') {
  window.__MY_UNIVERSE_PERF__ = snapshot;
}

export function isPerformanceEnabled(): boolean {
  return enabled;
}

export function perfMark(name: string): void {
  if (!enabled) return;
  const now = performance.now();
  bootMarks[name] = now - startedAt;
  performance.mark(`my-universe:${name}`);
}

export function perfMeasure(name: string, startMark: string): void {
  if (!enabled) return;
  const start = bootMarks[startMark];
  if (start === undefined) return;
  measures[name] = Math.max(0, performance.now() - startedAt - start);
}

export function recordFrame(frameMs: number): void {
  if (!enabled) return;
  const sample = Math.max(0, Math.min(1000, frameMs));
  frameSamples.push(sample);
  if (frameSamples.length > 1200) frameSamples.shift();
  frameTotal += sample;
  worstFrame = Math.max(worstFrame, sample);
}

export function recordPersistence(bytes: number): void {
  if (!enabled) return;
  persistenceWrites += 1;
  lastPersistedBytes = bytes;
  if (navigator.storage?.estimate) {
    void navigator.storage.estimate().then((estimate) => {
      storageUsageBytes = estimate.usage ?? null;
      storageQuotaBytes = estimate.quota ?? null;
    }).catch(() => undefined);
  }
}

export function getPerformanceSnapshot(): UniversePerformanceSnapshot {
  return snapshot();
}

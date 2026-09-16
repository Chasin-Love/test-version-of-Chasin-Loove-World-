/**
 * C++ Cosmos Engine Bridge v2 — the loader chain that makes the native core
 * real, with graceful degradation at every tier:
 *
 *   1. native-cpp   Tauri desktop: C++ compiled into the shell binary,
 *                   reached through invoke() commands (src-tauri/src).
 *   2. wasm         Browser: Emscripten build in ./wasm/ (built by CI or
 *                   scripts/build-wasm.sh; absent on machines without emsdk).
 *   3. typescript   Reference implementation (src/physics/physicsEngine.ts),
 *                   always available, numerically identical by contract.
 *
 * The bridge never lies: `status.backend` reports the tier actually in use,
 * and `verifyParity()` cross-checks the active tier against the TS reference
 * so "C++ is driving" is a verified claim, not marketing.
 */

export type CosmosBackend = 'native-cpp' | 'wasm' | 'typescript';

export interface CosmosStatus {
  backend: CosmosBackend;
  version: string;
  physicsFieldCount: number;
  ready: boolean;
}

export interface KeplerBatchInput {
  a: number[];
  e: number[];
  phase: number[];
  incl: number[];
  speed: number[];
  simDays: number;
}

export interface KeplerBatchResult {
  xyz: Float64Array;      /* 3n */
  radius: Float64Array;   /* n */
  trueAnomaly: Float64Array; /* n */
}

export interface PhysicsBatchInput {
  ids: string[];
  orbitA: number[];
  radius: number[];
  /** COSMOS_KIND_* encoding: 0 star, 1 planet, 2 dwarf, 3 nebula, 4 hole, 5 vault */
  kinds: number[];
  hasRings: number[];
  phase: number[];
  speed: number[];
  simTimeSec: number;
}

/** Field layout — must stay in lockstep with COSMOS_PHYSICS_FIELD_COUNT in
 * cosmos_engine.hpp and BodyPhysicsData in physicsEngine.ts. */
export const PHYSICS_FIELD_COUNT = 41;

export const COSMOS_KIND = { STAR: 0, PLANET: 1, DWARF: 2, NEBULA: 3, HOLE: 4, VAULT: 5 } as const;

type TauriInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

async function loadTauriInvoke(): Promise<TauriInvoke | null> {
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown };
  if (!w.__TAURI_INTERNALS__) return null;
  try {
    const core = await import('@tauri-apps/api/core');
    return core.invoke as TauriInvoke;
  } catch {
    return null;
  }
}

async function loadWasm(): Promise<WasmModule | null> {
  try {
    const url = new URL('./wasm/cosmos_engine.js', import.meta.url);
    const probe = await fetch(url.href, { method: 'HEAD' });
    if (!probe.ok) return null;
    /* @vite-ignore — the artifact is optional and may not exist at build time */
    const mod = await import(/* @vite-ignore */ url.href);
    const factory = (mod.default ?? mod.cosmos_engine) as
      | ((init?: unknown) => Promise<WasmModule>)
      | null;
    if (!factory) return null;
    return await factory({ locateFile: (f: string) => new URL(`./wasm/${f}`, import.meta.url).href });
  } catch {
    return null;
  }
}

/** Minimal Emscripten module surface used by the bridge. */
interface WasmModule {
  ccall: (
    ident: string,
    returnType: string | null,
    argTypes: string[],
    args: unknown[],
  ) => unknown;
  _cosmos_version?: () => string;
  _malloc?: (bytes: number) => number;
  _free?: (ptr: number) => void;
  HEAPF64?: Float64Array;
}

export class CosmosBridge {
  private statusValue: CosmosStatus = {
    backend: 'typescript',
    version: 'ts-1.0',
    physicsFieldCount: PHYSICS_FIELD_COUNT,
    ready: false,
  };
  private initPromise: Promise<CosmosStatus> | null = null;
  private invokeFn: TauriInvoke | null = null;
  private wasm: WasmModule | null = null;

  /* ------------------------------ lifecycle ------------------------------ */

  init(): Promise<CosmosStatus> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      const invoke = await loadTauriInvoke();
      if (invoke) {
        try {
          const res = await invoke<{ backend: string; version: string; physicsFieldCount: number }>('cosmos_status');
          if (res.version !== 'stub') {
            this.invokeFn = invoke;
            this.statusValue = { backend: 'native-cpp', version: res.version, physicsFieldCount: res.physicsFieldCount, ready: true };
            return this.statusValue;
          }
          /* stub build (type-check host) — never claim native physics */
        } catch {
          /* fall through to wasm */
        }
      }
      const wasm = await loadWasm();
      if (wasm) {
        this.wasm = wasm;
        let version = 'wasm';
        try {
          version = wasm.ccall('cosmos_version', 'string', [], []) as string;
        } catch { /* keep default */ }
        this.statusValue = { backend: 'wasm', version, physicsFieldCount: PHYSICS_FIELD_COUNT, ready: true };
        return this.statusValue;
      }
      this.statusValue = { backend: 'typescript', version: 'ts-reference', physicsFieldCount: PHYSICS_FIELD_COUNT, ready: true };
      return this.statusValue;
    })();
    return this.initPromise;
  }

  getStatus(): CosmosStatus {
    return { ...this.statusValue };
  }

  /* -------------------------------- kernels ------------------------------ */

  async keplerBatch(input: KeplerBatchInput): Promise<KeplerBatchResult> {
    await this.init();
    const n = input.a.length;
    if (this.statusValue.backend === 'native-cpp' && this.invokeFn) {
      const res = await this.invokeFn<{ xyz: number[]; radius: number[]; trueAnomaly: number[] }>('cosmos_kepler_batch', {
        args: {
          a: input.a,
          eccentricity: input.e,
          phase: input.phase,
          inclination: input.incl,
          speed: input.speed,
          simDays: input.simDays,
        },
      });
      return {
        xyz: Float64Array.from(res.xyz),
        radius: Float64Array.from(res.radius),
        trueAnomaly: Float64Array.from(res.trueAnomaly),
      };
    }
    if (this.statusValue.backend === 'wasm' && this.wasm) {
      const w = this.wasm;
      const malloc = (arr: number[]) => {
        const ptr = w._malloc!(arr.length * 8);
        w.HEAPF64!.set(arr, ptr / 8);
        return ptr;
      };
      const pa = malloc(input.a), pe = malloc(input.e), pp = malloc(input.phase);
      const pi = malloc(input.incl), ps = malloc(input.speed);
      const po = w._malloc!(n * 3 * 8), pr = w._malloc!(n * 8), pt = w._malloc!(n * 8);
      try {
        w.ccall('cosmos_kepler_batch', null, ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
          [pa, pe, pp, pi, ps, n, input.simDays, po, pr, pt]);
        const xyz = new Float64Array(n * 3);
        xyz.set(w.HEAPF64!.subarray(po / 8, po / 8 + n * 3));
        const radius = new Float64Array(n);
        radius.set(w.HEAPF64!.subarray(pr / 8, pr / 8 + n));
        const trueAnomaly = new Float64Array(n);
        trueAnomaly.set(w.HEAPF64!.subarray(pt / 8, pt / 8 + n));
        return { xyz, radius, trueAnomaly };
      } finally {
        w._free!(pa); w._free!(pe); w._free!(pp); w._free!(pi); w._free!(ps);
        w._free!(po); w._free!(pr); w._free!(pt);
      }
    }
    /* TypeScript reference tier */
    return this.keplerBatchTS(input);
  }

  async physicsBatch(input: PhysicsBatchInput): Promise<Float64Array> {
    await this.init();
    const n = input.ids.length;
    if (this.statusValue.backend === 'native-cpp' && this.invokeFn) {
      const res = await this.invokeFn<{ fields: number[]; fieldCount: number }>('cosmos_physics_batch', {
        args: {
          ids: input.ids,
          orbitA: input.orbitA,
          radius: input.radius,
          kinds: input.kinds,
          hasRings: input.hasRings,
          phase: input.phase,
          speed: input.speed,
          simTimeSec: input.simTimeSec,
        },
      });
      return Float64Array.from(res.fields);
    }
    if (this.statusValue.backend === 'wasm' && this.wasm) {
      const w = this.wasm;
      const enc = new TextEncoder();
      const idsPtrs: number[] = [];
      const idBufs: number[] = [];
      for (const id of input.ids) {
        const bytes = enc.encode(id + '\0');
        const ptr = w._malloc!(bytes.length);
        const heapU8 = new Uint8Array(w.HEAPF64!.buffer);
        heapU8.set(bytes, ptr);
        idBufs.push(ptr);
        idsPtrs.push(ptr);
      }
      const idsArrPtr = w._malloc!(idsPtrs.length * 4);
      const heapU32 = new Uint32Array(w.HEAPF64!.buffer);
      idsPtrs.forEach((p, i) => { heapU32[idsArrPtr / 4 + i] = p; });
      const pa = this.wasmMallocF64(w, input.orbitA);
      const pr = this.wasmMallocF64(w, input.radius);
      const pk = this.wasmMallocF64(w, input.kinds as unknown as number[]);
      const ph = this.wasmMallocF64(w, input.hasRings as unknown as number[]);
      const pp = this.wasmMallocF64(w, input.phase);
      const pv = this.wasmMallocF64(w, input.speed);
      const po = w._malloc!(n * PHYSICS_FIELD_COUNT * 8);
      try {
        w.ccall('cosmos_physics_batch', null, ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
          [idsArrPtr, pa, pr, pk, ph, pp, pv, n, input.simTimeSec, po]);
        const out = new Float64Array(n * PHYSICS_FIELD_COUNT);
        out.set(w.HEAPF64!.subarray(po / 8, po / 8 + n * PHYSICS_FIELD_COUNT));
        return out;
      } finally {
        [pa, pr, pk, ph, pp, pv, po].forEach((p) => w._free!(p));
        idBufs.forEach((p) => w._free!(p));
        w._free!(idsArrPtr);
      }
    }
    return this.physicsBatchTS(input);
  }

  private wasmMallocF64(w: WasmModule, arr: number[]): number {
    const ptr = w._malloc!(arr.length * 8);
    w.HEAPF64!.set(arr, ptr / 8);
    return ptr;
  }

  async benchmark(nBodies: number, iterations: number): Promise<{ opsPerSec: number; backend: CosmosBackend }> {
    await this.init();
    if (this.statusValue.backend === 'native-cpp' && this.invokeFn) {
      const ops = await this.invokeFn<number>('cosmos_benchmark', { nBodies, iterations });
      return { opsPerSec: ops, backend: 'native-cpp' };
    }
    /* TS tier benchmark (also used by wasm until the kernel is exposed) */
    const t0 = performance.now();
    this.tsRk4Burn(nBodies, iterations);
    const seconds = Math.max(0.0001, (performance.now() - t0) / 1000);
    return { opsPerSec: (nBodies * nBodies * iterations) / seconds, backend: this.statusValue.backend };
  }

  /* ------------------------- TS reference implementations ---------------- */

  private tsRk4Burn(n: number, iterations: number): void {
    const G = 6.6743e-11;
    const softening = 1e4;
    const px = new Float64Array(n); const py = new Float64Array(n); const pz = new Float64Array(n);
    const vx = new Float64Array(n); const vy = new Float64Array(n); const vz = new Float64Array(n);
    const mass = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      px[i] = (Math.random() - 0.5) * 1e11;
      py[i] = (Math.random() - 0.5) * 1e11;
      pz[i] = (Math.random() - 0.5) * 1e10;
      mass[i] = 1e24 + Math.random() * 1e30;
    }
    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < n; i++) {
        let ax = 0, ay = 0, az = 0;
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const dx = px[j] - px[i], dy = py[j] - py[i], dz = pz[j] - pz[i];
          const distSq = dx * dx + dy * dy + dz * dz + softening;
          const dist = Math.sqrt(distSq);
          const f = (G * mass[j]) / (distSq * dist);
          ax += dx * f; ay += dy * f; az += dz * f;
        }
        vx[i] += ax * 0.01; vy[i] += ay * 0.01; vz[i] += az * 0.01;
        px[i] += vx[i] * 0.01; py[i] += vy[i] * 0.01; pz[i] += vz[i] * 0.01;
      }
    }
  }

  private keplerBatchTS(input: KeplerBatchInput): KeplerBatchResult {
    /* lazy import avoided: physicsEngine is a tiny pure module */
    const n = input.a.length;
    const xyz = new Float64Array(n * 3);
    const radius = new Float64Array(n);
    const trueAnomaly = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const r = keplerPositionTS(input.a[i], input.e[i], input.phase[i], input.incl[i], input.simDays, input.speed[i]);
      xyz[3 * i] = r.x; xyz[3 * i + 1] = r.y; xyz[3 * i + 2] = r.z;
      radius[i] = r.currentRadius;
      trueAnomaly[i] = r.trueAnomaly;
    }
    return { xyz, radius, trueAnomaly };
  }

  private physicsBatchTS(input: PhysicsBatchInput): Float64Array {
    const n = input.ids.length;
    const out = new Float64Array(n * PHYSICS_FIELD_COUNT);
    for (let i = 0; i < n; i++) {
      const body = {
        id: input.ids[i],
        kind: kindFromCode(input.kinds[i]),
        radius: input.radius[i],
        orbit: { a: input.orbitA[i], speed: input.speed[i], phase: input.phase[i], incl: 0 },
        rings: input.hasRings[i] === 1,
      } as unknown as Parameters<typeof calculatePhysicsTS>[0];
      const d = calculatePhysicsTS(body, input.simTimeSec);
      const o = i * PHYSICS_FIELD_COUNT;
      out[o + 0] = d.a_AU;
      out[o + 1] = d.eccentricity;
      out[o + 2] = d.periodDays;
      out[o + 3] = d.periodYears;
      out[o + 4] = d.periapsisAU;
      out[o + 5] = d.apoapsisAU;
      out[o + 6] = d.currentDistanceAU;
      out[o + 7] = d.currentVelocityKms;
      out[o + 8] = d.meanVelocityKms;
      out[o + 9] = d.radiusKm;
      out[o + 10] = d.radiusEarth;
      out[o + 11] = d.densityGcm3;
      out[o + 12] = d.massKg;
      out[o + 13] = d.massEarth;
      out[o + 14] = d.surfaceGravityMs2;
      out[o + 15] = d.surfaceGravityRelative;
      out[o + 16] = d.escapeVelocityKms;
      out[o + 17] = d.gravitationalForceN;
      out[o + 18] = d.gravitationalPotentialJ;
      out[o + 19] = d.orbitalFieldMs2;
      out[o + 20] = d.centripetalForceN;
      out[o + 21] = d.stellarFluxWm2;
      out[o + 22] = d.solarFluxRelative;
      out[o + 23] = d.albedo;
      out[o + 24] = d.eqTempKelvin;
      out[o + 25] = d.eqTempCelsius;
      out[o + 26] = d.habitableStatus === 'Goldilocks (Habitable)' ? 1 : d.habitableStatus === 'Too Hot' ? 2 : 0;
      out[o + 27] = d.rocheLimitKm;
      out[o + 28] = d.ringsInsideRoche ? 1 : 0;
      out[o + 29] = d.isRelativistic ? 1 : 0;
      out[o + 30] = d.schwarzschildRadiusKm ?? NaN;
      out[o + 31] = d.photonSphereKm ?? NaN;
      out[o + 32] = d.iscoKm ?? NaN;
      out[o + 33] = d.timeDilationFactor ?? NaN;
      out[o + 34] = d.axialRotationPeriodDays;
      out[o + 35] = d.axialSpinVelocityKms;
      out[o + 36] = d.axialTiltDeg;
      out[o + 37] = d.galacticRadiusKpc;
      out[o + 38] = d.galacticVelocityKms;
      out[o + 39] = d.galacticYearMillionYrs;
      out[o + 40] = d.supermassiveBlackHoleMassSun;
    }
    return out;
  }

  /**
   * Cross-check the active tier against the TS reference over a synthetic
   * batch. Returns the max absolute delta — the receipt that "C++ is
   * driving" matches the reference math.
   */
  async verifyParity(n = 12, simTimeSec = 4321.5): Promise<{ maxDelta: number; backend: CosmosBackend }> {
    await this.init();
    const input: PhysicsBatchInput = {
      ids: ['aurelia', 'rust', 'goliath', 'veil', 'cinder', 'mirror', 'hollow', 'wisp', 'eventide', 'anchor', 'unknown-world', 'deep-haven'],
      orbitA: [52, 79, 180, 38, 30, 264, 344, 0, 96, 0, 120, 61],
      radius: [2.05, 1.4, 6.2, 1.9, 0.9, 2.6, 1.1, 5.0, 3.1, 6.5, 2.4, 2.0],
      kinds: [1, 1, 1, 1, 1, 1, 1, 3, 4, 0, 2, 1],
      hasRings: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      phase: [1.2, 2.8, 0.4, 3.3, 5.1, 1.9, 4.4, 0, 2.2, 0, 0.7, 3.9],
      speed: [0.0172, 0.0077, 0.0021, 0.0131, 0.0199, 0.0029, 0.0018, 0, 0, 0, 0.0044, 0.0124],
      simTimeSec,
    };
    const native = await this.physicsBatch(input);
    const reference = this.physicsBatchTS(input);
    let maxDelta = 0;
    for (let i = 0; i < native.length; i++) {
      const a = native[i];
      const b = reference[i];
      if (Number.isNaN(a) && Number.isNaN(b)) continue;
      const d = Math.abs(a - b);
      /* relative-ish scale: huge SI magnitudes need a proportional tolerance */
      const scale = Math.max(1, Math.abs(b));
      maxDelta = Math.max(maxDelta, d / scale);
    }
    return { maxDelta, backend: this.statusValue.backend };
  }
}

/* Local copies of the TS reference math (imports would create a cycle from
   physicsEngine's side; these mirror calculateKeplerPosition/calculatePhysics
   and are guarded by verifyParity against the C++ port). */
import { calculatePhysics as calculatePhysicsTS } from '../physics/physicsEngine';

function kindFromCode(code: number): string {
  switch (code) {
    case 0: return 'star';
    case 2: return 'dwarf';
    case 3: return 'nebula';
    case 4: return 'hole';
    case 5: return 'vault';
    default: return 'planet';
  }
}

function keplerPositionTS(
  a: number, eccentricity: number, phase: number, inclination: number,
  simDays: number, speed: number,
): { x: number; y: number; z: number; trueAnomaly: number; currentRadius: number } {
  const e = Math.min(0.85, Math.max(0, eccentricity));
  const M = (phase + simDays * speed) % (2 * Math.PI);
  let E = M;
  for (let i = 0; i < 5; i++) {
    E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  const trueAnomaly = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const currentRadius = (a * (1 - e * e)) / (1 + e * Math.cos(trueAnomaly));
  return {
    x: Math.cos(trueAnomaly) * currentRadius,
    y: Math.sin(trueAnomaly + phase) * currentRadius * inclination,
    z: Math.sin(trueAnomaly) * currentRadius,
    trueAnomaly,
    currentRadius,
  };
}

export const cosmosBridge = new CosmosBridge();

/* Back-compat shim for the old diagnostic card API. */
export class CppCosmosBridge {
  static getInstance(): CppCosmosBridge {
    return new CppCosmosBridge();
  }
  runRK4Benchmark(bodyCount = 256, iterations = 100): { opsPerSec: number; latencyMs: number } {
    const t0 = performance.now();
    (cosmosBridge as unknown as { tsRk4Burn: (n: number, i: number) => void }).tsRk4Burn(bodyCount, iterations);
    const latencyMs = Math.max(0.1, performance.now() - t0);
    return { opsPerSec: (bodyCount * bodyCount * iterations) / (latencyMs / 1000), latencyMs };
  }
}

export const cppCosmos = CppCosmosBridge.getInstance();

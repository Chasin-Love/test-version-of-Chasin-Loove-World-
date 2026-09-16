import React, { useEffect, useState } from 'react';
import { Cpu, Terminal, Play, Zap, Copy, Check, BadgeCheck, BadgeX, FlaskConical, Gauge } from 'lucide-react';
import { cosmosBridge, type CosmosStatus } from '../native/cpp_bridge';
import { getQualityTier, setQualityTier, probeCapability, type QualityTier } from '../engine/capability';
import { toast } from '../ui/toast';

const BACKEND_LABEL: Record<string, { text: string; cls: string }> = {
  'native-cpp': { text: 'NATIVE C++ CORE', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' },
  wasm: { text: 'WASM KERNEL', cls: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30' },
  typescript: { text: 'TS REFERENCE FALLBACK', cls: 'bg-amber-500/20 text-amber-300 border-amber-400/30' },
};

export const CppNativeEngineCard: React.FC = () => {
  const [status, setStatus] = useState<CosmosStatus>(() => cosmosBridge.getStatus());
  const [opsPerSec, setOpsPerSec] = useState<number | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [parity, setParity] = useState<number | null>(null);
  const [busy, setBusy] = useState<'bench' | 'parity' | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [tier, setTier] = useState<QualityTier>(() => getQualityTier());
  const [gpu, setGpu] = useState<string>('');

  useEffect(() => {
    let alive = true;
    cosmosBridge.init().then((s) => {
      if (alive) setStatus({ ...s });
    });
    setGpu(probeCapability().renderer);
    return () => { alive = false; };
  }, []);

  const applyTier = (next: QualityTier) => {
    setTier(next);
    setQualityTier(next);
    toast(`✦ Render quality: ${next.toUpperCase()} — applied live`);
  };

  const runBenchmark = async () => {
    setBusy('bench');
    try {
      const res = await cosmosBridge.benchmark(128, 100);
      /* measure wall latency from a second short run */
      const t0 = performance.now();
      await cosmosBridge.benchmark(128, 10);
      const latency = performance.now() - t0;
      setOpsPerSec(res.opsPerSec);
      setLatencyMs(latency);
      setStatus(cosmosBridge.getStatus());
      toast(`✦ ${res.backend} RK4 benchmark: ${(res.opsPerSec / 1_000_000).toFixed(2)} Mops/sec`);
    } finally {
      setBusy(null);
    }
  };

  const runParity = async () => {
    setBusy('parity');
    try {
      const res = await cosmosBridge.verifyParity();
      setParity(res.maxDelta);
      const ok = res.maxDelta < 1e-9 || res.backend === 'typescript';
      toast(ok
        ? `✦ Parity verified — max relative Δ ${res.maxDelta.toExponential(1)}`
        : `⚠ Parity drift ${res.maxDelta.toExponential(1)} vs TS reference`);
    } finally {
      setBusy(null);
    }
  };

  const copyCommand = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    toast('Command copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const backend = BACKEND_LABEL[status.backend] ?? BACKEND_LABEL.typescript;
  const commands = {
    desktop: 'npm run desktop:build',
    linux: 'cmake -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j$(nproc)',
    windows: 'cmake -B build -G "Visual Studio 17 2022" -A x64 && cmake --build build --config Release',
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-cyan-500/25 backdrop-blur-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-white tracking-wide">
                ASTROPHYSICS SIMULATION CORE
              </h3>
              <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${backend.cls}`}>
                {backend.text}
              </span>
            </div>
            <p className="font-mono text-[10px] text-slate-400">
              core v{status.version} · {status.physicsFieldCount}-field telemetry · RK4 integrator
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={runParity}
            disabled={busy !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/40 text-violet-200 text-xs font-mono tracking-wider transition-all cursor-pointer"
          >
            <FlaskConical className={`w-3 h-3 ${busy === 'parity' ? 'animate-pulse' : ''}`} />
            <span>{busy === 'parity' ? 'Verifying...' : 'Verify Parity'}</span>
          </button>
          <button
            onClick={runBenchmark}
            disabled={busy !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-mono tracking-wider transition-all cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.25)]"
          >
            <Play className={`w-3 h-3 ${busy === 'bench' ? 'animate-spin' : ''}`} />
            <span>{busy === 'bench' ? 'Calculating...' : 'Run RK4 Benchmark'}</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
          <span className="text-[10px] text-slate-400 block">Active Backend</span>
          <span className="text-sm font-bold text-white">{status.backend}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
          <span className="text-[10px] text-slate-400 block">Core Version</span>
          <span className="text-sm font-bold text-cyan-300">{status.version}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
          <span className="text-[10px] text-slate-400 block">N-Body Throughput</span>
          <span className="text-sm font-bold text-emerald-300">
            {opsPerSec === null ? '—' : `${(opsPerSec / 1_000_000).toFixed(2)} Mops/s`}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
          <span className="text-[10px] text-slate-400 block">Step Latency</span>
          <span className="text-sm font-bold text-amber-300">
            {latencyMs === null ? '—' : `${latencyMs.toFixed(1)} ms`}
          </span>
        </div>
      </div>

      {/* Parity receipt */}
      {parity !== null && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-white/10 font-mono text-[11px]">
          {parity < 1e-9
            ? <BadgeCheck className="w-4 h-4 text-emerald-400" />
            : <BadgeX className="w-4 h-4 text-amber-400" />}
          <span className={parity < 1e-9 ? 'text-emerald-300' : 'text-amber-300'}>
            {parity < 1e-9 ? 'Numerical parity verified' : 'Parity drift detected'} — max relative Δ {parity.toExponential(1)} vs TS reference
          </span>
        </div>
      )}

      {/* Render quality tiers */}
      <div className="space-y-2 font-mono text-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-[10.5px] uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span>Render Quality Tier</span>
          </div>
          <span className="text-[10px] text-slate-500 truncate max-w-[220px]" title={gpu}>{gpu}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(['low', 'medium', 'cinematic'] as const).map((t) => (
            <button
              key={t}
              onClick={() => applyTier(t)}
              className={`px-2 py-1.5 rounded-xl border text-[11px] font-mono tracking-wider transition-all cursor-pointer ${
                tier === t
                  ? 'bg-cyan-500/25 border-cyan-400/50 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-500">
          CINEMATIC unlocks the raymarched black hole (true gravitational lensing)
          and 2× pixel ratio — desktop-class GPUs only; the composite hole always remains as fallback.
        </p>
      </div>

      {/* Build commands */}
      <div className="space-y-2 font-mono text-xs">
        <div className="text-[10.5px] uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span>Build Pipelines</span>
        </div>
        <div className="space-y-1.5 text-[11px]">
          {([
            ['desktop', 'Desktop App (Linux + Windows)', commands.desktop, 'text-emerald-400'],
            ['linux', 'Standalone C++ Core (Linux .so)', commands.linux, 'text-cyan-400'],
            ['win', 'Standalone C++ Core (Windows .dll)', commands.windows, 'text-amber-400'],
          ] as const).map(([key, label, cmd, color]) => (
            <div key={key} className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-white/5 gap-2">
              <div className="truncate">
                <span className={`${color} font-bold mr-2`}>[{label}]:</span>
                <code className="text-slate-300">{cmd}</code>
              </div>
              <button
                onClick={() => copyCommand(key, cmd)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white shrink-0"
                title="Copy command"
              >
                {copiedKey === key ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 flex items-center gap-1.5 pt-1">
          <Zap className="w-3 h-3" />
          The C++ core is compiled into the desktop binary (no DLL loading) and drives
          Kepler orbits + telemetry batches; web falls back to WASM, then this TS reference.
        </p>
      </div>
    </div>
  );
};

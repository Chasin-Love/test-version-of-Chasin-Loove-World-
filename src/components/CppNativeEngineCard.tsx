import React, { useState } from 'react';
import { Cpu, Terminal, Play, CheckCircle2, ShieldCheck, Zap, HardDrive, Layers, Code, Copy, Check } from 'lucide-react';
import { cppCosmos, NativeEngineMetrics } from '../native/cpp_bridge';
import { toast } from '../ui/toast';

export const CppNativeEngineCard: React.FC = () => {
  const [metrics, setMetrics] = useState<NativeEngineMetrics>(() => cppCosmos.getEngineInfo());
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const guide = cppCosmos.getDesktopCompilationGuide();

  const runBenchmark = () => {
    setIsBenchmarking(true);
    setTimeout(() => {
      const bench = cppCosmos.runRK4Benchmark(128, 100);
      setMetrics((prev) => ({
        ...prev,
        benchmarkCalculationsPerSec: Math.round(bench.opsPerSec),
        lastBenchmarkLatencyMs: Number(bench.latencyMs.toFixed(2)),
      }));
      setIsBenchmarking(false);
      toast(`✦ C++ RK4 Benchmark complete: ${(bench.opsPerSec / 1_000_000).toFixed(2)} Mops/sec (${bench.latencyMs.toFixed(1)}ms)`);
    }, 50);
  };

  const copyCommand = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    toast(`Command copied to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
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
                C++20 NATIVE ASTROPHYSICS CORE
              </h3>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                DESKTOP READY
              </span>
            </div>
            <p className="font-mono text-[10px] text-slate-400">
              Native source compiled in <code className="text-cyan-300">src/native/</code> with CMake for Linux (.so) and Windows (.dll).
            </p>
          </div>
        </div>

        <button
          onClick={runBenchmark}
          disabled={isBenchmarking}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-mono tracking-wider transition-all cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.25)]"
        >
          <Play className={`w-3 h-3 ${isBenchmarking ? 'animate-spin' : ''}`} />
          <span>{isBenchmarking ? 'Calculating...' : 'Run RK4 Benchmark'}</span>
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
          <span className="text-[10px] text-slate-400 block">Language Standard</span>
          <span className="text-sm font-bold text-white">ISO C++20 / SIMD</span>
        </div>
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
          <span className="text-[10px] text-slate-400 block">Integrator Algorithm</span>
          <span className="text-sm font-bold text-cyan-300">RK4 (4th Order)</span>
        </div>
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
          <span className="text-[10px] text-slate-400 block">N-Body Throughput</span>
          <span className="text-sm font-bold text-emerald-300">
            {(metrics.benchmarkCalculationsPerSec / 1_000_000).toFixed(2)} Mops/s
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
          <span className="text-[10px] text-slate-400 block">Step Latency</span>
          <span className="text-sm font-bold text-amber-300">{metrics.lastBenchmarkLatencyMs} ms</span>
        </div>
      </div>

      {/* Desktop Build Commands */}
      <div className="space-y-2 font-mono text-xs">
        <div className="text-[10.5px] uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span>Desktop Native Compilation Pipelines (Linux & Windows)</span>
        </div>

        <div className="space-y-1.5 text-[11px]">
          {/* Linux */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-white/5 gap-2">
            <div className="truncate">
              <span className="text-cyan-400 font-bold mr-2">[Linux GCC/Clang]:</span>
              <code className="text-slate-300">{guide.linux}</code>
            </div>
            <button
              onClick={() => copyCommand('linux', guide.linux)}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white shrink-0"
              title="Copy command"
            >
              {copiedKey === 'linux' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>

          {/* Windows */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-white/5 gap-2">
            <div className="truncate">
              <span className="text-amber-400 font-bold mr-2">[Windows MSVC]:</span>
              <code className="text-slate-300">{guide.windows}</code>
            </div>
            <button
              onClick={() => copyCommand('win', guide.windows)}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white shrink-0"
              title="Copy command"
            >
              {copiedKey === 'win' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>

          {/* Tauri Desktop */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-white/5 gap-2">
            <div className="truncate">
              <span className="text-purple-400 font-bold mr-2">[Standalone Desktop .exe / .deb]:</span>
              <code className="text-slate-300">{guide.tauri}</code>
            </div>
            <button
              onClick={() => copyCommand('tauri', guide.tauri)}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white shrink-0"
              title="Copy command"
            >
              {copiedKey === 'tauri' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

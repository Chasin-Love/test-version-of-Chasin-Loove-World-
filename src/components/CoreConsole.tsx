import React, { useEffect, useRef, useState } from 'react';
import {
  X, Zap, Globe, Sparkles, Orbit, Trash2, ChevronDown, ChevronRight,
  Activity, Plus, ShieldCheck, Crosshair, Wind, Compass,
} from 'lucide-react';
import { REALITIES, getReality, createNewRealityConfig, RealityConfig } from '../realities';
import { actions, useUniverse } from '../state';
import { toast } from '../ui/toast';
import { CreateRealityModal } from './CreateRealityModal';
import { RealityAdvancedPanel } from './RealityAdvancedPanel';

interface Props {
  onClose: () => void;
  onWarpReality: (realityId: string) => void;
  onZoomToCore: () => void;
  onTriggerKamui: () => void;
  onEnterGalaxy: (realityId: string, galaxyId: string) => void;
  onShowToolbar?: () => void;
}

type Tab = 'overview' | 'realities';

/* ------------------------------------------------------------------ */
/* Live animated backdrop — drifting nebulae, parallax starfield and
   the occasional shooting star, painted on one cheap 2D canvas.       */
/* ------------------------------------------------------------------ */
function CoreBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const onResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    window.addEventListener('resize', onResize);

    interface Star { x: number; y: number; z: number; r: number; tw: number; }
    interface Shooter { x: number; y: number; vx: number; vy: number; life: number; max: number; }
    const stars: Star[] = Array.from({ length: 190 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      z: 0.25 + Math.random() * 0.75, r: 0.4 + Math.random() * 1.4, tw: Math.random() * Math.PI * 2,
    }));
    const shooters: Shooter[] = [];
    let t = 0;
    let last = performance.now();

    const nebulae = [
      { hue: 'rgba(6,182,212,', x: 0.22, y: 0.3, r: 0.5, dx: 0.011, dy: 0.007 },
      { hue: 'rgba(139,92,246,', x: 0.78, y: 0.62, r: 0.55, dx: -0.008, dy: 0.009 },
      { hue: 'rgba(255,45,120,', x: 0.55, y: 0.15, r: 0.38, dx: 0.006, dy: -0.01 },
    ];

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      ctx.clearRect(0, 0, w, h);

      /* nebula drift */
      nebulae.forEach((n, i) => {
        const cx = (n.x + Math.sin(t * n.dx * 8 + i) * 0.05) * w;
        const cy = (n.y + Math.cos(t * n.dy * 8 + i * 2) * 0.05) * h;
        const rad = n.r * Math.min(w, h);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, `${n.hue}${0.16 + 0.05 * Math.sin(t * 0.7 + i)})`);
        g.addColorStop(1, `${n.hue}0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });

      /* starfield with slow parallax drift + twinkle */
      stars.forEach((s) => {
        s.x += s.z * 5 * dt;
        if (s.x > w + 4) s.x = -4;
        const a = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.6 + s.tw));
        ctx.fillStyle = `rgba(220,235,255,${a * s.z})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });

      /* shooting stars */
      if (Math.random() < dt * 0.5 && shooters.length < 3) {
        const fromLeft = Math.random() > 0.5;
        shooters.push({
          x: fromLeft ? -40 : w + 40,
          y: Math.random() * h * 0.5,
          vx: (fromLeft ? 1 : -1) * (420 + Math.random() * 380),
          vy: 140 + Math.random() * 160,
          life: 0, max: 1.4,
        });
      }
      for (let i = shooters.length - 1; i >= 0; i--) {
        const sh = shooters[i];
        sh.life += dt;
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        const k = 1 - sh.life / sh.max;
        if (k <= 0) { shooters.splice(i, 1); continue; }
        const grad = ctx.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * 0.16, sh.y - sh.vy * 0.16);
        grad.addColorStop(0, `rgba(255,255,255,${0.8 * k})`);
        grad.addColorStop(1, 'rgba(140,200,255,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(sh.x - sh.vx * 0.16, sh.y - sh.vy * 0.16);
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

/* animated vitals bar in the overview tab */
function VitalsBar({ label, value, color }: { label: string; value: number; color: string }) {
  const [k, setK] = useState(0.2);
  useEffect(() => {
    const id = setInterval(() => setK((v) => {
      const next = v + (Math.random() - 0.5) * 0.24;
      return Math.max(0.35, Math.min(0.97, next));
    }), 1400);
    return () => clearInterval(id);
  }, []);
  const v = Math.round((value * 0.72 + k * 0.28) * 100);
  return (
    <div>
      <div className="flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.2em] text-slate-300 mb-1">
        <span>{label}</span>
        <span className="tabular-nums" style={{ color }}>{v}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${v}%`, background: `linear-gradient(90deg, ${color}66, ${color})`, boxShadow: `0 0 8px ${color}88` }}
        />
      </div>
    </div>
  );
}

/* one reality row in the console */
function RealityRow({
  reality, active, expanded, onToggle, onWarp, onDelete, onEnterGalaxy,
}: {
  reality: RealityConfig;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  onWarp: () => void;
  onDelete: () => void;
  onEnterGalaxy: (rid: string, gid: string) => void;
}) {
  const protectedReality = reality.id === 'sol-prime';
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <div
      className={`rounded-2xl border transition-all backdrop-blur-md overflow-hidden ${
        expanded
          ? 'bg-cyan-500/8 border-cyan-400/45'
          : active
            ? 'bg-cyan-500/6 border-cyan-400/35 hover:border-cyan-400/55'
            : 'bg-white/3 border-white/10 hover:border-white/25'
      }`}
    >
      <div className="flex items-center gap-3 px-3.5 py-2.5">
        <button onClick={onToggle} className="flex items-center gap-3 min-w-0 flex-1 text-left group">
          {expanded ? <ChevronDown className="w-4 h-4 text-cyan-300 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
          <span
            className="w-9 h-9 rounded-xl shrink-0 ring-1 ring-white/20 shadow-inner flex items-center justify-center"
            style={{ background: `radial-gradient(circle at 30% 30%, ${reality.colorA}, ${reality.colorB})` }}
          >
            <Sparkles className="w-3.5 h-3.5 text-white/90 drop-shadow" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 flex-wrap">
              <span className="text-[13.5px] font-semibold text-white group-hover:text-cyan-200 transition-colors truncate">{reality.name}</span>
              {active && (
                <span className="text-[8.5px] font-mono px-1.5 py-px rounded-full bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 uppercase tracking-wider">
                  Anchor
                </span>
              )}
            </span>
            <span className="block font-mono text-[9.5px] text-slate-400 truncate mt-0.5">
              {reality.codeName} · {reality.spectral}
            </span>
          </span>
        </button>

        <div className="hidden md:flex items-center gap-2 font-mono text-[9.5px] text-slate-300 shrink-0">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10" title="Major galaxies — one ellipse each on the reality's ring">
            <Orbit className="w-3 h-3 text-cyan-300" /> {reality.galaxies?.length ?? 0}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10" title="Celestial bodies">
            {reality.bodies.length} ⭐
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onWarp}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider border transition-all ${
              active
                ? 'bg-cyan-500/25 text-cyan-100 border-cyan-400/50'
                : 'bg-white/6 hover:bg-cyan-500/20 text-slate-200 border-white/10 hover:border-cyan-400/40'
            }`}
            title={active ? 'Currently anchored here' : 'Warp to this reality'}
          >
            {active ? 'Anchored' : 'Warp'}
          </button>
          {!protectedReality && (
            confirmDel ? (
              <button
                onClick={() => { onDelete(); setConfirmDel(false); }}
                className="px-2 py-1.5 rounded-lg bg-rose-500/30 hover:bg-rose-500/50 border border-rose-400/60 text-rose-100 text-[9.5px] font-mono uppercase tracking-wider transition-all"
              >
                Erase?
              </button>
            ) : (
              <button
                onClick={() => { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 2600); }}
                className="p-1.5 rounded-lg text-rose-300 hover:text-rose-100 hover:bg-rose-500/20 border border-transparent hover:border-rose-400/40 transition-all"
                title="Collapse this reality — it will cease to exist"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-3 border-t border-white/10">
          <RealityAdvancedPanel realityId={reality.id} onEnterGalaxy={onEnterGalaxy} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* THE MULTIVERSE CORE CONSOLE                                         */
/* ------------------------------------------------------------------ */
export const CoreConsole: React.FC<Props> = ({ onClose, onWarpReality, onZoomToCore, onTriggerKamui, onEnterGalaxy, onShowToolbar }) => {
  const state = useUniverse();
  const [tab, setTab] = useState<Tab>('overview');
  const [expandedReality, setExpandedReality] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const activeRealityId = state.activeRealityId || 'sol-prime';
  const realities: RealityConfig[] = REALITIES;
  const activeReality = getReality(activeRealityId, state.customRealityDescriptions);
  const totalGalaxies = realities.reduce((n, r) => n + (r.galaxies?.length ?? 0), 0);
  const totalWorlds = realities.reduce((n, r) => n + r.bodies.length, 0);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-100 overlay-in bg-slate-950/55 backdrop-blur-md flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      {/* live sci-fi backdrop */}
      <CoreBackdrop />
      {/* aurora wash */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(90% 70% at 50% 40%, rgba(6,182,212,0.10), transparent 60%), radial-gradient(70% 60% at 75% 80%, rgba(139,92,246,0.12), transparent 65%)' }} />

      {/* THE GLASS PLATE */}
      <div
        className="core-plate relative w-full max-w-5xl h-[88vh] max-h-215 rounded-[26px] border border-cyan-400/25 bg-slate-950/40 backdrop-blur-3xl shadow-[0_30px_90px_rgba(0,0,0,0.75),0_0_50px_rgba(6,182,212,0.14),inset_0_1px_1px_rgba(255,255,255,0.18)] text-slate-100 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-300/70 to-transparent pointer-events-none" />

        {/* header */}
        <div className="shrink-0 flex items-center gap-3.5 px-5 sm:px-7 py-4 border-b border-white/10 bg-white/2">
          {/* pulsing core sigil */}
          <div className="relative w-11 h-11 shrink-0">
            <div className="absolute inset-0 rounded-full bg-linear-to-br from-cyan-400/70 via-violet-500/60 to-pink-500/60 blur-[6px] opacity-80 animate-pulse" />
            <div className="absolute inset-0.75 rounded-full bg-slate-950/70 border border-white/25 backdrop-blur-md flex items-center justify-center">
              <span className="core-sigil block w-3.5 h-3.5 rounded-full bg-linear-to-br from-cyan-300 to-pink-400 shadow-[0_0_14px_rgba(6,182,212,0.9)]" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base sm:text-lg tracking-[0.14em] font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              MULTIVERSE CORE CONSOLE
            </h2>
            <p className="font-mono text-[9.5px] tracking-[0.2em] uppercase text-cyan-300/90 truncate">
              Sovereign singularity · origin (0,0,0) · {realities.length} realities · {totalGalaxies} galaxies
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/6 hover:bg-white/15 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-all backdrop-blur-md shrink-0"
            title="Close console (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* tab bar */}
        <div className="shrink-0 flex items-center gap-2 px-5 sm:px-7 py-3 border-b border-white/10">
          {([
            { id: 'overview' as Tab, label: 'Core Overview', icon: <Activity className="w-3.5 h-3.5" /> },
            { id: 'realities' as Tab, label: `Realities (${realities.length})`, icon: <Globe className="w-3.5 h-3.5" /> },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[11px] font-mono uppercase tracking-wider border transition-all backdrop-blur-md ${
                tab === t.id
                  ? 'bg-cyan-500/20 text-white border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                  : 'bg-white/4 text-slate-300 border-white/10 hover:border-cyan-400/30 hover:text-white'
              }`}
            >
              {t.icon} <span>{t.label}</span>
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => { setShowCreate(true); }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-linear-to-r from-cyan-500/80 to-blue-600/80 hover:from-cyan-400 hover:to-blue-500 text-white text-[11px] font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)] border border-cyan-300/40 backdrop-blur-md transition-all font-mono uppercase tracking-wider"
            >
              <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Forge Reality</span><span className="sm:hidden">New</span>
            </button>
          </div>
        </div>

        {/* body */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scroll px-5 sm:px-7 py-5">
          {tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* vitals */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                <div className="p-4 rounded-2xl bg-white/3 border border-white/10 backdrop-blur-md">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-4 h-4 text-cyan-300" />
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-cyan-200">Core Vitals — Live</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5">
                    <VitalsBar label="Quantum Flux Resonance" value={0.82} color="#06b6d4" />
                    <VitalsBar label="Spacetime Harmonic Containment" value={0.9} color="#8b5cf6" />
                    <VitalsBar label="Reality Bubble Integrity" value={0.88} color="#00f5d4" />
                    <VitalsBar label="Dimensional Barrier Strength" value={0.94} color="#ff2d78" />
                  </div>
                </div>

                {/* anchored reality card */}
                <div className="p-4 rounded-2xl bg-white/3 border border-white/10 backdrop-blur-md">
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="w-4 h-4 text-cyan-300" />
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-cyan-200">Anchored Reality</span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className="w-10 h-10 rounded-xl ring-1 ring-white/20 shadow-inner"
                      style={{ background: `radial-gradient(circle at 30% 30%, ${activeReality.colorA}, ${activeReality.colorB})` }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{activeReality.name}</p>
                      <p className="font-mono text-[10px] text-slate-400">{activeReality.codeName} · {activeReality.galaxies?.length ?? 0} galaxies · {activeReality.bodies.length} worlds</p>
                    </div>
                    <button
                      onClick={() => setTab('realities')}
                      className="ml-auto px-3 py-1.5 rounded-lg bg-white/6 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400/40 text-[10.5px] font-mono uppercase tracking-wider text-slate-200 transition-all"
                    >
                      Manage
                    </button>
                  </div>
                </div>

                {/* core chronicle */}
                <div className="p-4 rounded-2xl bg-white/3 border border-white/10 backdrop-blur-md flex-1 min-h-35">
                  <div className="flex items-center gap-2 mb-3">
                    <Wind className="w-4 h-4 text-cyan-300" />
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-cyan-200">Core Chronicle</span>
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-45 overflow-y-auto custom-scroll">
                    {[...state.audit].reverse().slice(0, 14).map((a, i) => (
                      <div key={`${a.t}-${i}`} className="flex items-baseline gap-2 font-mono text-[10px]">
                        <span className="text-slate-500 tabular-nums shrink-0">{new Date(a.t).toLocaleTimeString(undefined, { hour12: false })}</span>
                        <span className="text-slate-300 leading-snug">{a.msg}</span>
                      </div>
                    ))}
                    {state.audit.length === 0 && <p className="text-[11px] text-slate-500">No multiverse events recorded yet.</p>}
                  </div>
                </div>
              </div>

              {/* quick actions + stats */}
              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-2xl bg-white/3 border border-white/10 backdrop-blur-md">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { n: realities.length, l: 'Realities' },
                      { n: totalGalaxies, l: 'Galaxies' },
                      { n: totalWorlds, l: 'Worlds' },
                    ].map((s) => (
                      <div key={s.l} className="py-2 rounded-xl bg-white/4 border border-white/10">
                        <p className="font-display text-xl font-bold text-white tabular-nums">{s.n}</p>
                        <p className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-slate-400 mt-0.5">{s.l}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/3 border border-white/10 backdrop-blur-md flex flex-col gap-2">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-cyan-200 mb-1">Core Instruments</span>
                  <button
                    onClick={onZoomToCore}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-100 text-[11px] font-mono uppercase tracking-wider transition-all"
                  >
                    <Crosshair className="w-3.5 h-3.5" /> Frame the Astral Core
                  </button>
                  <button
                    onClick={onTriggerKamui}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-400/40 text-rose-200 text-[11px] font-mono uppercase tracking-wider transition-all"
                  >
                    <Zap className="w-3.5 h-3.5" /> Kamui Space-Time Warp
                  </button>
                  {onShowToolbar && (
                    <button
                      onClick={onShowToolbar}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-violet-500/10 hover:bg-violet-500/25 border border-violet-400/40 text-violet-200 text-[11px] font-mono uppercase tracking-wider transition-all"
                    >
                      <Compass className="w-3.5 h-3.5" /> Hierarchy Toolbar
                    </button>
                  )}
                  <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/12 border border-white/15 text-slate-200 text-[11px] font-mono uppercase tracking-wider transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Forge a New Reality
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-400/20 backdrop-blur-md">
                  <p className="text-[11px] leading-relaxed text-slate-300">
                    <span className="text-cyan-300 font-semibold">This is the core of everything.</span> Every ellipse orbiting a reality
                    bubble is one living galaxy — forge, name, and dissolve them in the
                    <button onClick={() => setTab('realities')} className="text-cyan-300 hover:text-white underline underline-offset-2 mx-1">Realities tab</button>
                    or by double-clicking any reality ring out in the multiverse.
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === 'realities' && (
            <div className="flex flex-col gap-2.5">
              <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                Existence is total: a bubble on the ring means the reality exists — erase it and every world, galaxy and ellipse inside it ceases.
              </p>
              {realities.map((r) => (
                <RealityRow
                  key={r.id}
                  reality={r}
                  active={r.id === activeRealityId}
                  expanded={expandedReality === r.id}
                  onToggle={() => setExpandedReality((cur) => (cur === r.id ? null : r.id))}
                  onWarp={() => onWarpReality(r.id)}
                  onDelete={() => {
                    if (r.id === 'sol-prime') { toast('Sol Prime is the primordial anchor — it cannot be erased', 'warn'); return; }
                    actions.deleteReality(r.id);
                    toast(`${r.name} collapsed out of existence`);
                  }}
                  onEnterGalaxy={onEnterGalaxy}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateRealityModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={(params) => {
          const config = createNewRealityConfig(params);
          actions.createReality(config);
          toast(`✦ Reality ${config.name} manifested — its bubble ignites on the ring`);
        }}
      />
    </div>
  );
};

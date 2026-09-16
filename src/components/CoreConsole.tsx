import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Zap, Globe, Sparkles, Orbit, Trash2, ChevronDown, ChevronRight,
  Activity, Plus, ShieldCheck, Crosshair, Wind, Compass, Search,
  Edit2, Palette, Check, Layers, Disc, Sun, Radio, Sliders, ExternalLink,
  Cpu, Maximize2, RefreshCw, BarChart2, Eye
} from 'lucide-react';
import { REALITIES, getReality, createNewRealityConfig, RealityConfig, GalaxyData } from '../realities';
import { actions, useUniverse } from '../state';
import { toast } from '../ui/toast';
import { CreateRealityModal } from './CreateRealityModal';
import { RealityAdvancedPanel } from './RealityAdvancedPanel';
import { ThinkingCloudTooltip } from './ThinkingCloudTooltip';
import { QuantumBinTab } from './QuantumBinTab';
import { CppNativeEngineCard } from './CppNativeEngineCard';

interface Props {
  onClose: () => void;
  onWarpReality: (realityId: string) => void;
  onZoomToCore: () => void;
  onTriggerKamui: () => void;
  onEnterGalaxy: (realityId: string, galaxyId: string) => void;
  onShowToolbar?: () => void;
}

type Tab = 'dashboard' | 'realities' | 'hierarchy' | 'bin';

/* ------------------------------------------------------------------ */
/* 1. Live 3D Holographic Backdrop                                    */
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
    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    interface Star {
      x: number;
      y: number;
      z: number;
      r: number;
      tw: number;
      color: string;
    }
    interface Shooter {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      max: number;
      color: string;
    }

    const starColors = ['#00f5d4', '#38bdf8', '#8b5cf6', '#ec4899', '#ffffff', '#fbbf24'];
    const stars: Star[] = Array.from({ length: 220 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: 0.2 + Math.random() * 0.8,
      r: 0.5 + Math.random() * 1.5,
      tw: Math.random() * Math.PI * 2,
      color: starColors[Math.floor(Math.random() * starColors.length)],
    }));

    const shooters: Shooter[] = [];
    let t = 0;
    let last = performance.now();

    const nebulae = [
      { hue: 'rgba(6,182,212,', x: 0.18, y: 0.25, r: 0.55, dx: 0.012, dy: 0.006 },
      { hue: 'rgba(139,92,246,', x: 0.82, y: 0.65, r: 0.6, dx: -0.009, dy: 0.008 },
      { hue: 'rgba(255,45,120,', x: 0.5, y: 0.15, r: 0.45, dx: 0.007, dy: -0.01 },
      { hue: 'rgba(16,185,129,', x: 0.75, y: 0.3, r: 0.4, dx: -0.006, dy: 0.007 },
    ];

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      ctx.clearRect(0, 0, w, h);

      /* Chromatic Nebulae Drift */
      nebulae.forEach((n, i) => {
        const cx = (n.x + Math.sin(t * n.dx * 8 + i) * 0.06) * w;
        const cy = (n.y + Math.cos(t * n.dy * 8 + i * 2) * 0.06) * h;
        const rad = n.r * Math.min(w, h);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, `${n.hue}${0.16 + 0.05 * Math.sin(t * 0.8 + i)})`);
        g.addColorStop(1, `${n.hue}0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });

      /* Holographic Grid Scanlines */
      ctx.save();
      ctx.strokeStyle = 'rgba(6,182,212,0.035)';
      ctx.lineWidth = 1;
      const gridSize = 60;
      const shiftX = (t * 6) % gridSize;
      const shiftY = (t * 3) % gridSize;
      for (let x = shiftX; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = shiftY; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.restore();

      /* 3D Parallax Starfield */
      stars.forEach((s) => {
        s.x += s.z * 6 * dt;
        if (s.x > w + 6) s.x = -6;
        const a = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.8 + s.tw));
        ctx.fillStyle = s.color;
        ctx.globalAlpha = a * s.z;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      /* Tachyon Particle Beams */
      if (Math.random() < dt * 0.75 && shooters.length < 3) {
        const fromLeft = Math.random() > 0.5;
        const colors = ['#00f5d4', '#38bdf8', '#c084fc', '#f472b6'];
        shooters.push({
          x: fromLeft ? -40 : w + 40,
          y: Math.random() * h * 0.5,
          vx: (fromLeft ? 1 : -1) * (420 + Math.random() * 380),
          vy: 100 + Math.random() * 160,
          life: 0,
          max: 1.2,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }

      for (let i = shooters.length - 1; i >= 0; i--) {
        const sh = shooters[i];
        sh.life += dt;
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        const k = 1 - sh.life / sh.max;
        if (k <= 0) {
          shooters.splice(i, 1);
          continue;
        }
        const grad = ctx.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * 0.16, sh.y - sh.vy * 0.16);
        grad.addColorStop(0, `${sh.color}`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(sh.x - sh.vx * 0.16, sh.y - sh.vy * 0.16);
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

/* ------------------------------------------------------------------ */
/* 2. Interactive Holographic Radar Mini-Map (Live 3D Multiverse Core) */
/* ------------------------------------------------------------------ */
function HolographicMultiverseRadar({
  realities,
  activeId,
  onSelect,
}: {
  realities: RealityConfig[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let angle = 0;
    const size = 260;
    canvas.width = size * 2;
    canvas.height = size * 2;

    const render = () => {
      angle += 0.008;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Radar Concentric Rings & Range Finders
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
      ctx.lineWidth = 1.5;
      [40, 80, 130, 180, 220].forEach((r) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Radar Crosshairs
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(cx - 230, cy);
      ctx.lineTo(cx + 230, cy);
      ctx.moveTo(cx, cy - 230);
      ctx.lineTo(cx, cy + 230);
      ctx.stroke();
      ctx.setLineDash([]);

      // Radar Sweeper Beam
      const sweepAngle = angle * 2;
      const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 220);
      sweepGrad.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
      sweepGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.fillStyle = sweepGrad;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 220, sweepAngle, sweepAngle + 0.35);
      ctx.closePath();
      ctx.fill();

      // Central Astral Singularity Core
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 24);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.4, '#00f5d4');
      coreGrad.addColorStop(0.8, '#8b5cf6');
      coreGrad.addColorStop(1, 'rgba(139, 92, 246, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 24, 0, Math.PI * 2);
      ctx.fill();

      // Plot Orbiting Reality Spheres
      const numR = realities.length;
      realities.forEach((r, idx) => {
        const radius = 110 + (idx % 3) * 45;
        const currentA = angle * (0.6 / (idx + 1)) + (idx * (Math.PI * 2)) / Math.max(1, numR);
        const rx = cx + Math.cos(currentA) * radius;
        const ry = cy + Math.sin(currentA) * (radius * 0.7); // 3D tilt perspective

        const isActive = r.id === activeId;

        // Orbit Line
        ctx.strokeStyle = isActive ? 'rgba(0, 245, 212, 0.4)' : 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius, radius * 0.7, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Node Glow
        const orbG = ctx.createRadialGradient(rx, ry, 0, rx, ry, isActive ? 16 : 10);
        orbG.addColorStop(0, r.colorA);
        orbG.addColorStop(0.7, r.colorB);
        orbG.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = orbG;
        ctx.beginPath();
        ctx.arc(rx, ry, isActive ? 16 : 10, 0, Math.PI * 2);
        ctx.fill();

        // Node Core Dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(rx, ry, isActive ? 4.5 : 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = isActive ? '#00f5d4' : '#cbd5e1';
        ctx.font = 'bold 16px monospace';
        ctx.fillText(r.name.slice(0, 10), rx + 12, ry + 4);
      });

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [realities, activeId]);

  return (
    <div className="relative w-full aspect-square max-w-[260px] mx-auto flex items-center justify-center p-2 rounded-2xl bg-slate-950/60 border border-cyan-500/25 shadow-[inset_0_0_20px_rgba(6,182,212,0.15)]">
      <canvas ref={canvasRef} className="w-full h-full object-contain" />
      <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-400/30 text-[9px] font-mono text-cyan-300">
        <Radio className="w-2.5 h-2.5 animate-pulse text-cyan-400" />
        <span>RADAR 3D LIVE</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Circular Circular Telemetry Gauge                               */
/* ------------------------------------------------------------------ */
function CircularTelemetryGauge({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const [val, setVal] = useState(value);
  useEffect(() => {
    const id = setInterval(() => {
      setVal((v) => {
        const next = v + (Math.random() - 0.5) * 0.08;
        return Math.max(0.65, Math.min(0.99, next));
      });
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const percentage = Math.round(val * 100);
  const radius = 24;
  const circ = 2 * Math.PI * radius;
  const strokeDashoffset = circ - (percentage / 100) * circ;

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/50 border border-white/10 backdrop-blur-md">
      <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
        <svg className="w-12 h-12 -rotate-90">
          <circle
            cx="24"
            cy="24"
            r={radius}
            stroke="currentColor"
            strokeWidth="3.5"
            fill="transparent"
            className="text-white/10"
          />
          <circle
            cx="24"
            cy="24"
            r={radius}
            stroke={color}
            strokeWidth="3.5"
            strokeDasharray={circ}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
          />
        </svg>
        <span className="absolute font-mono text-[10px] font-bold text-white tabular-nums">
          {percentage}%
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-400 truncate">
          {label}
        </span>
        <span className="inline-block text-[11px] font-semibold font-mono" style={{ color }}>
          NOMINAL
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Bento Reality Card (Wide Multi-Column Aesthetic)                */
/* ------------------------------------------------------------------ */
function BentoRealityCard({
  reality,
  active,
  onWarp,
  onDelete,
  onEnterGalaxy,
}: {
  reality: RealityConfig;
  active: boolean;
  onWarp: () => void;
  onDelete: () => void;
  onEnterGalaxy: (rid: string, gid: string) => void;
}) {
  const protectedReality = reality.id === 'sol-prime';
  const [confirmDel, setConfirmDel] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(reality.name);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const galaxies = reality.galaxies || [];
  const clusters = reality.clusters || [];
  const worldsCount = reality.bodies?.length ?? 0;

  const handleSaveName = () => {
    if (editName.trim() && editName.trim() !== reality.name) {
      actions.updateRealityMeta(reality.id, { name: editName.trim() });
      toast(`Renamed reality to "${editName.trim()}"`);
    }
    setIsEditingName(false);
  };

  const handleColorChange = (colorA: string, colorB: string) => {
    actions.updateRealityMeta(reality.id, { colorA, colorB, starColor: colorA });
    toast(`Recolored ${reality.name}`);
  };

  return (
    <div
      className={`group relative rounded-2xl border transition-all duration-300 backdrop-blur-xl flex flex-col justify-between overflow-hidden ${
        active
          ? 'bg-linear-to-b from-cyan-500/15 via-slate-900/90 to-slate-950 border-cyan-400/60 shadow-[0_0_25px_rgba(6,182,212,0.2)]'
          : 'bg-slate-900/60 hover:bg-slate-900/80 border-white/12 hover:border-cyan-400/40 shadow-lg'
      }`}
    >
      {/* Top Accent Line */}
      <div
        className="h-1 w-full"
        style={{ background: `linear-gradient(90deg, ${reality.colorA}, ${reality.colorB})` }}
      />

      {/* Card Header */}
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {/* Chromatic Sphere with Orb Glow */}
            <div
              className="relative w-11 h-11 rounded-xl ring-2 ring-white/20 shadow-md flex items-center justify-center shrink-0 cursor-pointer transition-transform group-hover:scale-105"
              style={{ background: `radial-gradient(circle at 30% 30%, ${reality.colorA}, ${reality.colorB})` }}
              onClick={() => setShowColorPicker(!showColorPicker)}
              title="Click to recolor this reality"
            >
              <Sparkles className="w-4 h-4 text-white/90 drop-shadow" />
              <span className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-slate-950 border border-white/20">
                <Palette className="w-2.5 h-2.5 text-cyan-300" />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              {isEditingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') setIsEditingName(false);
                    }}
                    autoFocus
                    className="px-2 py-0.5 rounded bg-slate-900 border border-cyan-400 text-xs text-white font-semibold focus:outline-none"
                  />
                  <button
                    onClick={handleSaveName}
                    className="p-1 rounded bg-cyan-500/30 text-cyan-200 hover:bg-cyan-500/50"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white group-hover:text-cyan-200 transition-colors truncate">
                    {reality.name}
                  </h3>
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="p-0.5 text-slate-500 hover:text-cyan-300 transition-colors"
                    title="Rename reality"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-1.5 font-mono text-[9.5px] text-slate-400 mt-0.5">
                <span className="text-cyan-300/90">{reality.codeName}</span>
                <span>·</span>
                <span className="truncate">{reality.spectral}</span>
              </div>
            </div>
          </div>

          {active && (
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/25 border border-cyan-400/50 text-[8.5px] font-mono font-bold uppercase tracking-wider text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.4)]">
              ANCHORED
            </span>
          )}
        </div>

        {/* Color Palette Popover */}
        {showColorPicker && (
          <div className="p-2.5 rounded-xl bg-slate-950 border border-cyan-500/30 flex flex-wrap gap-1.5 shadow-xl">
            {[
              { label: 'Cyan / Violet', a: '#00f5d4', b: '#8b5cf6' },
              { label: 'Solar Gold', a: '#f59e0b', b: '#fbbf24' },
              { label: 'Neon Emerald', a: '#10b981', b: '#06b6d4' },
              { label: 'Supernova Ruby', a: '#ef4444', b: '#f97316' },
              { label: 'Tachyon Magenta', a: '#ec4899', b: '#8b5cf6' },
            ].map((theme) => (
              <button
                key={theme.label}
                onClick={() => {
                  handleColorChange(theme.a, theme.b);
                  setShowColorPicker(false);
                }}
                className="px-2 py-0.5 rounded-lg border border-white/15 text-[9px] font-mono text-slate-200 hover:border-cyan-400 transition-all flex items-center gap-1"
                style={{ background: `linear-gradient(90deg, ${theme.a}44, ${theme.b}44)` }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.a }} />
                <span>{theme.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Telemetry Metrics Pods */}
        <div className="grid grid-cols-3 gap-2 text-center font-mono">
          <div className="p-2 rounded-xl bg-white/4 border border-white/8 flex flex-col items-center">
            <div className="flex items-center gap-1 text-cyan-300 text-xs font-bold">
              <Orbit className="w-3 h-3" />
              <span>{galaxies.length}</span>
            </div>
            <span className="text-[8.5px] uppercase tracking-wider text-slate-400 mt-0.5">Galaxies</span>
          </div>

          <div className="p-2 rounded-xl bg-white/4 border border-white/8 flex flex-col items-center">
            <div className="flex items-center gap-1 text-violet-300 text-xs font-bold">
              <Layers className="w-3 h-3" />
              <span>{clusters.length}</span>
            </div>
            <span className="text-[8.5px] uppercase tracking-wider text-slate-400 mt-0.5">Clusters</span>
          </div>

          <div className="p-2 rounded-xl bg-white/4 border border-white/8 flex flex-col items-center">
            <div className="flex items-center gap-1 text-amber-300 text-xs font-bold">
              <Sun className="w-3 h-3" />
              <span>{worldsCount}</span>
            </div>
            <span className="text-[8.5px] uppercase tracking-wider text-slate-400 mt-0.5">Worlds</span>
          </div>
        </div>

        {/* Orbiting Galaxies Preview Chips */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[9.5px] font-mono uppercase tracking-wider text-slate-400">
            <span>Contained Galaxies ({galaxies.length}):</span>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-cyan-400 hover:text-cyan-200 flex items-center gap-0.5"
            >
              <span>{isExpanded ? 'Collapse' : 'Inspect'}</span>
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto custom-scroll">
            {galaxies.slice(0, isExpanded ? 99 : 3).map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/5 text-[10px] font-mono text-slate-300"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: g.color || '#00f5d4' }} />
                  <span className="truncate">{g.name}</span>
                </div>
                <button
                  onClick={() => onEnterGalaxy(reality.id, g.id)}
                  className="px-1.5 py-0.5 rounded bg-violet-500/20 hover:bg-violet-500/40 text-violet-200 text-[8.5px] uppercase tracking-wider flex items-center gap-0.5"
                  title="Dive into this galaxy"
                >
                  <ExternalLink className="w-2.5 h-2.5" /> Dive
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Card Action Footer Bar */}
      <div className="px-4 py-3 bg-black/30 border-t border-white/8 flex items-center justify-between gap-2">
        <button
          onClick={onWarp}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-mono uppercase tracking-wider font-bold transition-all flex items-center justify-center gap-1.5 ${
            active
              ? 'bg-cyan-500/30 text-cyan-100 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
              : 'bg-white/6 hover:bg-cyan-500/20 text-slate-200 border border-white/10 hover:border-cyan-400/40'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>{active ? 'Anchored' : 'Warp to Reality'}</span>
        </button>

        {!protectedReality && (
          confirmDel ? (
            <button
              onClick={() => {
                onDelete();
                setConfirmDel(false);
              }}
              className="py-1.5 px-3 rounded-xl bg-rose-500/40 hover:bg-rose-500/60 border border-rose-400/70 text-rose-100 text-[10px] font-mono uppercase tracking-wider transition-all"
            >
              Confirm Erase
            </button>
          ) : (
            <button
              onClick={() => {
                setConfirmDel(true);
                setTimeout(() => setConfirmDel(false), 2800);
              }}
              className="p-2 rounded-xl text-rose-300 hover:text-rose-100 hover:bg-rose-500/20 border border-transparent hover:border-rose-400/40 transition-all"
              title="Collapse this reality"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )
        )}
      </div>

      {/* Expanded Deep Advanced Reality Workbench */}
      {isExpanded && (
        <div className="p-4 bg-slate-950/80 border-t border-cyan-500/30">
          <RealityAdvancedPanel realityId={reality.id} onEnterGalaxy={onEnterGalaxy} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Deep Multiverse Hierarchy View (Side-by-Side Cockpit)           */
/* ------------------------------------------------------------------ */
function DeepHierarchyExplorer({
  realities,
  onEnterGalaxy,
  onWarpReality,
}: {
  realities: RealityConfig[];
  onEnterGalaxy: (realityId: string, galaxyId: string) => void;
  onWarpReality: (realityId: string) => void;
}) {
  const [selectedRealityId, setSelectedRealityId] = useState<string>(realities[0]?.id || 'sol-prime');
  const selectedReality = realities.find((r) => r.id === selectedRealityId) || realities[0];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
      {/* Left: Reality Branch Selection Column */}
      <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col gap-2 overflow-y-auto custom-scroll max-h-[560px]">
        <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-300 mb-1 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5" /> Reality Branches ({realities.length})
        </span>

        {realities.map((r) => {
          const isSel = r.id === selectedRealityId;
          return (
            <button
              key={r.id}
              onClick={() => setSelectedRealityId(r.id)}
              className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                isSel
                  ? 'bg-cyan-500/20 border-cyan-400/60 text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                  : 'bg-white/3 border-white/8 text-slate-300 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ background: `linear-gradient(45deg, ${r.colorA}, ${r.colorB})` }}
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{r.name}</p>
                  <p className="font-mono text-[9px] text-slate-400 truncate">{r.codeName}</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono text-cyan-200 shrink-0">
                {r.galaxies?.length ?? 0} Gal
              </span>
            </button>
          );
        })}
      </div>

      {/* Right: Deep Galaxy & Stellar System Deck */}
      <div className="md:col-span-2 p-4 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col gap-3 overflow-y-auto custom-scroll max-h-[560px]">
        {selectedReality && (
          <>
            <div className="flex items-center justify-between pb-3 border-b border-white/10 flex-wrap gap-2">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>{selectedReality.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
                    {selectedReality.spectral}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Anchor Star: {selectedReality.bodies[0]?.name || 'Primordial Anchor'} ({selectedReality.bodies.length} Stellar Worlds)
                </p>
              </div>

              <button
                onClick={() => onWarpReality(selectedReality.id)}
                className="px-3 py-1.5 rounded-xl bg-cyan-500/25 hover:bg-cyan-500/40 border border-cyan-400/50 text-cyan-100 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" /> Warp Here
              </button>
            </div>

            <div className="space-y-2">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                <Orbit className="w-3.5 h-3.5" /> Major Orbiting Galaxies & Stellar Systems
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(selectedReality.galaxies || []).map((g) => (
                  <div
                    key={g.id}
                    className="p-3 rounded-xl bg-black/40 border border-white/10 hover:border-cyan-400/40 transition-all flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Orbit className="w-4 h-4 text-cyan-300 shrink-0" />
                          <h4 className="text-xs font-bold text-white truncate">{g.name}</h4>
                        </div>
                        <span className="text-[8.5px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 shrink-0">
                          {g.type}
                        </span>
                      </div>

                      <div className="mt-2 space-y-1 text-[10px] font-mono text-slate-300">
                        <div>
                          Anchor Star: <span className="text-amber-200">{g.lineage?.stellarSystem?.starName || 'Anchor Star'}</span>
                        </div>
                        <div>
                          Worlds: <span className="text-cyan-200">{g.lineage?.stellarSystem?.worldsCount ?? 5} Planets/Moons</span>
                        </div>
                        <div>
                          Stars: <span className="text-slate-400">{g.starsCount}</span> · Span: <span className="text-slate-400">{g.diameterKly} kly</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onEnterGalaxy(selectedReality.id, g.id)}
                      className="w-full py-1 px-2.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/40 border border-violet-400/40 text-violet-200 text-[10px] font-mono uppercase tracking-wider flex items-center justify-center gap-1 transition-all"
                    >
                      <ExternalLink className="w-3 h-3" /> Dive into Galaxy
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 6. MAIN MULTIVERSE CORE CONSOLE COMPONENT                           */
/* ------------------------------------------------------------------ */
export const CoreConsole: React.FC<Props> = ({
  onClose,
  onWarpReality,
  onZoomToCore,
  onTriggerKamui,
  onEnterGalaxy,
  onShowToolbar,
}) => {
  const state = useUniverse();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'anchored' | 'custom' | 'dense'>('all');

  const activeRealityId = state.activeRealityId || 'sol-prime';
  const realities: RealityConfig[] = REALITIES;
  const activeReality = getReality(activeRealityId, state.customRealityDescriptions);
  const totalGalaxies = realities.reduce((n, r) => n + (r.galaxies?.length ?? 0), 0);
  const totalClusters = realities.reduce((n, r) => n + (r.clusters?.length ?? 0), 0);
  const totalWorlds = realities.reduce((n, r) => n + r.bodies.length, 0);

  // Search & Filter Realities
  const filteredRealities = useMemo(() => {
    return realities.filter((r) => {
      if (filterType === 'anchored' && r.id !== activeRealityId) return false;
      if (filterType === 'custom' && r.id === 'sol-prime') return false;
      if (filterType === 'dense' && (r.galaxies?.length ?? 0) < 4) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchName = r.name.toLowerCase().includes(q);
      const matchCode = r.codeName.toLowerCase().includes(q);
      const matchSpectral = r.spectral.toLowerCase().includes(q);
      const matchGalaxies = (r.galaxies || []).some((g) => g.name.toLowerCase().includes(q));
      return matchName || matchCode || matchSpectral || matchGalaxies;
    });
  }, [realities, searchQuery, filterType, activeRealityId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-100 overlay-in bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 lg:p-6 select-none"
      onClick={onClose}
    >
      {/* 3D Holographic Backdrop */}
      <CoreBackdrop />

      {/* Aurora Ambient Lighting */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(90% 70% at 50% 40%, rgba(6,182,212,0.14), transparent 60%), radial-gradient(70% 60% at 75% 80%, rgba(139,92,246,0.16), transparent 65%)',
        }}
      />

      {/* THE 3D HOLOGRAPHIC COMMAND DECK PLATE */}
      <div
        className="core-plate relative w-full max-w-[1440px] h-[92vh] max-h-[920px] rounded-[28px] border border-cyan-400/35 bg-slate-950/70 backdrop-blur-3xl shadow-[0_35px_100px_rgba(0,0,0,0.85),0_0_70px_rgba(6,182,212,0.22),inset_0_1px_1px_rgba(255,255,255,0.25)] text-slate-100 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Specular Edge Highlighting */}
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-300/90 to-transparent pointer-events-none" />

        {/* TOP COMMAND HEADER BAR */}
        <div className="shrink-0 flex items-center justify-between gap-4 px-5 sm:px-7 py-3.5 border-b border-cyan-500/20 bg-linear-to-r from-slate-950/80 via-slate-900/60 to-slate-950/80">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Pulsing Core Gyro Sigil */}
            <div className="relative w-11 h-11 shrink-0">
              <div className="absolute inset-0 rounded-full bg-linear-to-br from-cyan-400/80 via-violet-500/70 to-pink-500/70 blur-[8px] opacity-90 animate-pulse" />
              <div className="absolute inset-0.75 rounded-full bg-slate-950/90 border border-white/30 backdrop-blur-md flex items-center justify-center">
                <span className="core-sigil block w-4 h-4 rounded-full bg-linear-to-br from-cyan-300 to-pink-400 shadow-[0_0_16px_rgba(6,182,212,0.95)]" />
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-base sm:text-lg tracking-[0.14em] font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  MULTIVERSE CORE COMMAND DECK
                </h2>
                <span className="text-[9.5px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                  3D Holographic Singularity Origin (0,0,0)
                </span>
              </div>
              <p className="font-mono text-[9.5px] tracking-[0.2em] uppercase text-cyan-300/80 truncate">
                Status: Sovereign Continuum Active · {realities.length} Realities · {totalClusters} Clusters · {totalGalaxies} Galaxies · {totalWorlds} Worlds
              </p>
            </div>
          </div>

          {/* Top Quick Tools & Close */}
          <div className="flex items-center gap-3">
            {/* Celestial Forge Symbol with Animated Thinking Cloud */}
            <ThinkingCloudTooltip
              onClick={() => setShowCreate(true)}
              label="Forge Reality Continuum"
              subtitle="Manifest a new parallel realm & disk directory"
              position="bottom"
              size="md"
              iconType="forge"
              id="core-forge-reality-btn"
            />
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/6 hover:bg-white/15 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-all backdrop-blur-md shrink-0 cursor-pointer"
              title="Close Console (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TAB CONTROLS & SEARCH BAR */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 sm:px-7 py-2.5 border-b border-white/10 bg-slate-900/40 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {([
              { id: 'dashboard' as Tab, label: 'Command Matrix', icon: <Cpu className="w-3.5 h-3.5" /> },
              { id: 'realities' as Tab, label: `Realities Grid (${realities.length})`, icon: <Globe className="w-3.5 h-3.5" /> },
              { id: 'hierarchy' as Tab, label: 'Deep Hierarchy', icon: <Layers className="w-3.5 h-3.5" /> },
              {
                id: 'bin' as Tab,
                label: `Quantum Bin (${(state.binRealities || []).length})`,
                icon: <Trash2 className="w-3.5 h-3.5 text-rose-400" />,
                badge: (state.binRealities || []).length > 0 ? (state.binRealities || []).length : undefined,
              },
            ]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-mono uppercase tracking-wider border transition-all backdrop-blur-md cursor-pointer ${
                  tab === t.id
                    ? t.id === 'bin'
                      ? 'bg-rose-500/25 text-white border-rose-400/60 shadow-[0_0_12px_rgba(244,63,94,0.35)]'
                      : 'bg-cyan-500/25 text-white border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                    : 'bg-white/4 text-slate-300 border-white/10 hover:border-cyan-400/30 hover:text-white'
                }`}
              >
                {t.icon} <span>{t.label}</span>
                {t.badge !== undefined && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold">
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Live Search & Filter Bar */}
          <div className="flex items-center gap-2 flex-1 max-w-md ml-auto">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search reality, spectral code, galaxy..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400/60 font-mono"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-1 font-mono text-[9.5px]">
              {[
                { id: 'all', label: 'All' },
                { id: 'anchored', label: 'Anchor' },
                { id: 'custom', label: 'Custom' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id as any)}
                  className={`px-2 py-1 rounded-lg border transition-all ${
                    filterType === f.id
                      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50'
                      : 'bg-white/4 text-slate-400 border-white/10 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN BODY AREA (HORIZONTAL COCKPIT LAYOUT) */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scroll px-5 sm:px-7 py-4">
          {tab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full">
              {/* LEFT WING: 3D Holographic Radar + Core Telemetry Hub (4 cols) */}
              <div className="lg:col-span-4 flex flex-col gap-4">
                {/* 3D Interactive Radar */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-cyan-500/25 backdrop-blur-xl flex flex-col items-center">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-cyan-300 mb-2 flex items-center gap-1.5 self-start">
                    <Orbit className="w-3.5 h-3.5 text-cyan-400" />
                    Multiverse Radar Scan
                  </span>
                  <HolographicMultiverseRadar
                    realities={realities}
                    activeId={activeRealityId}
                    onSelect={(id) => onWarpReality(id)}
                  />
                  <div className="mt-3 w-full flex items-center justify-between text-[10px] font-mono text-slate-400 pt-2 border-t border-white/5">
                    <span>Anchor: <span className="text-cyan-300 font-bold">{activeReality.name}</span></span>
                    <button onClick={() => setTab('realities')} className="text-cyan-400 hover:text-white">View All →</button>
                  </div>
                </div>

                {/* Singularity Telemetry Gauges */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-xl space-y-2.5">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-cyan-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                    Singularity Vitals — Live
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <CircularTelemetryGauge label="Quantum Flux" value={0.88} color="#00f5d4" />
                    <CircularTelemetryGauge label="Spacetime Harmonic" value={0.94} color="#8b5cf6" />
                    <CircularTelemetryGauge label="Bubble Integrity" value={0.91} color="#38bdf8" />
                    <CircularTelemetryGauge label="Barrier Strength" value={0.96} color="#ec4899" />
                  </div>
                </div>

                {/* Quick Action Matrix */}
                <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-xl">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-cyan-300 block mb-2">
                    Singularity Quick Pods
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={onZoomToCore}
                      className="p-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-100 text-[10.5px] font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Crosshair className="w-3.5 h-3.5" /> Frame Core
                    </button>
                    <button
                      onClick={onTriggerKamui}
                      className="p-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 text-[10.5px] font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Zap className="w-3.5 h-3.5" /> Kamui Warp
                    </button>
                    {onShowToolbar && (
                      <button
                        onClick={onShowToolbar}
                        className="p-2.5 rounded-xl bg-violet-500/15 hover:bg-violet-500/30 border border-violet-400/40 text-violet-200 text-[10.5px] font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Compass className="w-3.5 h-3.5" /> Toolbar
                      </button>
                    )}
                    <button
                      onClick={() => setShowCreate(true)}
                      className="p-2.5 rounded-xl bg-white/6 hover:bg-white/12 border border-white/15 text-slate-200 text-[10.5px] font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> New Reality
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT WING: Multi-Column Bento Reality Grid (8 cols) */}
              <div className="lg:col-span-8 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-300 flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    Active Realities Matrix ({filteredRealities.length})
                  </span>
                  <span className="font-mono text-[9.5px] text-slate-400">
                    Showing {filteredRealities.length} of {realities.length} branches
                  </span>
                </div>

                {/* 2-Column Responsive Bento Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredRealities.map((r) => (
                    <BentoRealityCard
                      key={r.id}
                      reality={r}
                      active={r.id === activeRealityId}
                      onWarp={() => onWarpReality(r.id)}
                      onDelete={() => {
                        if (r.id === 'sol-prime') {
                          toast('Sol Prime is the primordial anchor — it cannot be erased', 'warn');
                          return;
                        }
                        actions.deleteReality(r.id);
                        toast(`${r.name} collapsed out of existence`);
                      }}
                      onEnterGalaxy={onEnterGalaxy}
                    />
                  ))}
                </div>

                {/* C++ Native Desktop Engine Card */}
                <CppNativeEngineCard />

                {/* Core Live Chronicle Ticker */}
                <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-xl mt-auto">
                  <div className="flex items-center gap-2 mb-2">
                    <Wind className="w-3.5 h-3.5 text-cyan-300" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200">
                      Singularity Live Chronicle
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 max-h-24 overflow-y-auto custom-scroll">
                    {[...state.audit].reverse().slice(0, 8).map((a, i) => (
                      <div key={`${a.t}-${i}`} className="flex items-baseline gap-2 font-mono text-[9.5px]">
                        <span className="text-slate-500 tabular-nums shrink-0">
                          {new Date(a.t).toLocaleTimeString(undefined, { hour12: false })}
                        </span>
                        <span className="text-slate-300 truncate">{a.msg}</span>
                      </div>
                    ))}
                    {state.audit.length === 0 && (
                      <p className="text-[10px] text-slate-500">No multiverse events recorded yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'realities' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-300 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  All Parallel Realities ({filteredRealities.length})
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  Each reality manages its own independent physical continuum and disk folder
                </span>
              </div>

              {/* 3-Column Bento Reality Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredRealities.map((r) => (
                  <BentoRealityCard
                    key={r.id}
                    reality={r}
                    active={r.id === activeRealityId}
                    onWarp={() => onWarpReality(r.id)}
                    onDelete={() => {
                      if (r.id === 'sol-prime') {
                        toast('Sol Prime is the primordial anchor — it cannot be erased', 'warn');
                        return;
                      }
                      actions.deleteReality(r.id);
                      toast(`${r.name} collapsed out of existence`);
                    }}
                    onEnterGalaxy={onEnterGalaxy}
                  />
                ))}
              </div>

              {filteredRealities.length === 0 && (
                <div className="p-12 text-center rounded-2xl bg-white/2 border border-white/5 font-mono text-xs text-slate-400">
                  No realities match "{searchQuery}"
                </div>
              )}
            </div>
          )}

          {tab === 'hierarchy' && (
            <DeepHierarchyExplorer
              realities={realities}
              onEnterGalaxy={onEnterGalaxy}
              onWarpReality={onWarpReality}
            />
          )}

          {tab === 'bin' && (
            <QuantumBinTab />
          )}
        </div>
      </div>

      <CreateRealityModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={(params) => {
          const config = createNewRealityConfig(params);
          actions.createReality(config);
          toast(`✦ Reality ${config.name} manifested — its bubble and backend folder ignite into existence`);
        }}
      />
    </div>
  );
};

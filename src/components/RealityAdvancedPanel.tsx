import React, { useEffect, useState } from 'react';
import {
  Palette, BookOpen, Orbit, Save, RotateCcw, Check, Sparkles,
} from 'lucide-react';
import { getReality, RAW_REALITIES, RealityMetaOverride } from '../realities';
import { actions, useUniverse } from '../state';
import { toast } from '../ui/toast';
import { GalaxyRoster } from './GalaxyRoster';

type Tab = 'identity' | 'lore' | 'galaxies';

interface PanelProps {
  realityId: string;
  focusGalaxyId?: string | null;
  onEnterGalaxy?: (realityId: string, galaxyId: string) => void;
}

const LORE_INSPIRATIONS = [
  {
    title: 'Quantum Divergence',
    snippet: 'A universe where the cosmological constant underwent symmetric spontaneous breaking during inflation, forging crystalline nebular corridors and exotic energy fields.',
  },
  {
    title: 'Dyson Megastructures',
    snippet: 'An advanced Kardashev-II stellar manifold enclosed in nested geometric megastructures, extracting the full thermodynamic luminosity of the central anchor star.',
  },
  {
    title: 'Primordial Biolume',
    snippet: 'A warm, radiant stellar cradle harboring oceanic gas giants with bioluminescent microbial atmospheric clouds that pulse with harmonic planetary resonance.',
  },
  {
    title: 'Eventide Singularity',
    snippet: 'A spacetime bubble bordering the event horizon of a primordial supermassive singularity, warping time dilation and preserving quantum memories indefinitely.',
  },
];

/* one-click anchor-star auras — each preset reweaves the star core, corona
   and reality light together so the whole aura follows the chosen flame */
const STAR_AURAS: { name: string; base: string }[] = [
  { name: 'Solar Gold', base: '#ffb54d' },
  { name: 'Crimson', base: '#ff3d5a' },
  { name: 'Neon Green', base: '#39ff88' },
  { name: 'Ice Blue', base: '#6fd8ff' },
  { name: 'Violet Nova', base: '#a86bff' },
  { name: 'Rose Pink', base: '#ff6fd8' },
  { name: 'Ember', base: '#ff7a2a' },
  { name: 'Pure White', base: '#f6f7ff' },
];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16) || 0x888888;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const clamp255 = (v: number) => Math.round(Math.max(0, Math.min(255, v)));
function mixTowardWhite(hex: string, k: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `#${[r, g, b].map((c) => clamp255(c + (255 - c) * k).toString(16).padStart(2, '0')).join('')}`;
}
function darkenHex(hex: string, k: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `#${[r, g, b].map((c) => clamp255(c * (1 - k)).toString(16).padStart(2, '0')).join('')}`;
}

/** The full reality workbench — identity, lore and its major-galaxy ring.
    Shared by the Core Console (embedded) and the double-click modal. */
export const RealityAdvancedPanel: React.FC<PanelProps> = ({ realityId, focusGalaxyId, onEnterGalaxy }) => {
  const state = useUniverse();
  const reality = getReality(realityId, state.customRealityDescriptions);

  const [tab, setTab] = useState<Tab>(focusGalaxyId ? 'galaxies' : 'identity');

  /* identity draft — applied with one "Weave Changes" action so dragging a
     color doesn't rebuild the multiverse on every pixel */
  const [identity, setIdentity] = useState<RealityMetaOverride>({});
  useEffect(() => {
    setIdentity({
      name: reality.name,
      codeName: reality.codeName,
      spectral: reality.spectral,
      colorA: reality.colorA,
      colorB: reality.colorB,
      starColor: reality.starColor,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realityId, reality.name, reality.codeName, reality.spectral, reality.colorA, reality.colorB, reality.starColor]);

  const [lore, setLore] = useState(reality.description);
  useEffect(() => setLore(reality.description), [realityId, reality.description]);

  const [savedFlash, setSavedFlash] = useState(false);
  const identityDirty = ['name', 'codeName', 'spectral', 'colorA', 'colorB', 'starColor'].some(
    (k) => identity[k as keyof RealityMetaOverride] !== undefined && identity[k as keyof RealityMetaOverride] !== reality[k as keyof typeof reality]
  );
  const loreDirty = lore !== reality.description;

  const applyIdentity = () => {
    const patch: RealityMetaOverride = {};
    if (identity.name?.trim() && identity.name !== reality.name) patch.name = identity.name.trim();
    if (identity.codeName?.trim() && identity.codeName !== reality.codeName) patch.codeName = identity.codeName.trim();
    if (identity.spectral?.trim() && identity.spectral !== reality.spectral) patch.spectral = identity.spectral.trim();
    if (identity.colorA && identity.colorA !== reality.colorA) patch.colorA = identity.colorA;
    if (identity.colorB && identity.colorB !== reality.colorB) patch.colorB = identity.colorB;
    if (identity.starColor && identity.starColor !== reality.starColor) patch.starColor = identity.starColor;
    if (!Object.keys(patch).length) return;
    actions.updateRealityMeta(realityId, patch);
    toast('Reality reweaved — the multiverse ring has been redrawn');
  };

  /* a preset reweaves the whole aura at once: the star core burns in the
     chosen flame while the reality light follows it (light + deep variants) */
  const applyAuraPreset = (a: { name: string; base: string }) => {
    const colorA = mixTowardWhite(a.base, 0.45);
    const colorB = darkenHex(a.base, 0.45);
    actions.updateRealityMeta(realityId, { starColor: a.base, colorA, colorB });
    setIdentity((d) => ({ ...d, starColor: a.base, colorA, colorB }));
    toast(`The anchor star now burns ${a.name} — the whole aura follows`);
  };

  const saveLore = () => {
    actions.updateRealityDescription(realityId, lore);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 900);
    toast('Reality lore saved to the cosmological record');
  };

  const resetLore = () => {
    actions.resetRealityDescription(realityId);
    const raw = RAW_REALITIES.find((r) => r.id === realityId);
    setLore(raw?.description ?? lore);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'identity', label: 'Identity', icon: <Palette className="w-3.5 h-3.5" /> },
    { id: 'lore', label: 'Lore', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'galaxies', label: `Galaxies (${reality.galaxies?.length ?? 0})`, icon: <Orbit className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col gap-4 min-h-0">
      {/* tab bar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[11px] font-mono uppercase tracking-wider border transition-all backdrop-blur-md ${
              tab === t.id
                ? 'bg-cyan-500/20 text-white border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                : 'bg-white/4 text-slate-300 border-white/10 hover:border-cyan-400/30 hover:text-white'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
        <span className="ml-auto font-mono text-[9.5px] text-slate-400 truncate max-w-[45%]" title={reality.id}>
          {reality.spectral} · {reality.bodies.length} worlds · {reality.clusters?.length ?? 0} clusters
        </span>
      </div>

      {/* IDENTITY */}
      {tab === 'identity' && (
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[10px] font-mono uppercase tracking-[0.22em] text-cyan-300 mb-1">Reality Name</span>
              <input
                value={identity.name ?? ''}
                onChange={(e) => setIdentity((d) => ({ ...d, name: e.target.value }))}
                className="w-full rounded-xl bg-white/6 border border-white/15 focus:border-cyan-400 px-3 py-2 text-sm text-white outline-none backdrop-blur-md"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] font-mono uppercase tracking-[0.22em] text-cyan-300 mb-1">Code Designation</span>
              <input
                value={identity.codeName ?? ''}
                onChange={(e) => setIdentity((d) => ({ ...d, codeName: e.target.value }))}
                className="w-full rounded-xl bg-white/6 border border-white/15 focus:border-cyan-400 px-3 py-2 text-sm text-white font-mono outline-none backdrop-blur-md"
              />
            </label>
          </div>

          <label className="block">
            <span className="block text-[10px] font-mono uppercase tracking-[0.22em] text-cyan-300 mb-1">Spectral Classification</span>
            <input
              value={identity.spectral ?? ''}
              onChange={(e) => setIdentity((d) => ({ ...d, spectral: e.target.value }))}
              className="w-full rounded-xl bg-white/6 border border-white/15 focus:border-cyan-400 px-3 py-2 text-sm text-white font-mono outline-none backdrop-blur-md"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            {(['colorA', 'colorB'] as const).map((key, idx) => (
              <div key={key}>
                <span className="block text-[10px] font-mono uppercase tracking-[0.22em] text-cyan-300 mb-1">
                  {idx === 0 ? 'Primary Light' : 'Secondary Light'}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={identity[key] ?? '#00f5d4'}
                    onChange={(e) => setIdentity((d) => ({ ...d, [key]: e.target.value }))}
                    className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    value={identity[key] ?? ''}
                    onChange={(e) => setIdentity((d) => ({ ...d, [key]: e.target.value }))}
                    className="flex-1 rounded-xl bg-white/6 border border-white/15 focus:border-cyan-400 px-2.5 py-2 text-xs text-white font-mono outline-none"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* STAR AURA — one-click presets + custom core color */}
          <div className="rounded-xl border border-white/10 bg-white/3 p-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-cyan-300">Anchor Star Aura</span>
              <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: identity.starColor ?? reality.starColor }}>
                {identity.starColor ?? reality.starColor}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {STAR_AURAS.map((a) => {
                const active = (identity.starColor ?? reality.starColor ?? '').toLowerCase() === a.base.toLowerCase();
                return (
                  <button
                    key={a.name}
                    title={a.name}
                    onClick={() => applyAuraPreset(a)}
                    className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                      active ? 'border-white shadow-[0_0_12px_rgba(255,255,255,0.45)]' : 'border-white/20 hover:border-white/60'
                    }`}
                    style={{ background: `radial-gradient(circle at 35% 35%, ${mixTowardWhite(a.base, 0.65)}, ${a.base} 55%, ${darkenHex(a.base, 0.4)})` }}
                  />
                );
              })}
              <label className="flex items-center gap-2 ml-1 cursor-pointer" title="Custom aura color">
                <input
                  type="color"
                  value={identity.starColor ?? reality.starColor ?? '#ffb54d'}
                  onChange={(e) => setIdentity((d) => ({ ...d, starColor: e.target.value }))}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">custom → weave</span>
              </label>
            </div>
            <p className="text-[9.5px] text-slate-400 leading-relaxed">
              Presets reweave the whole aura instantly — the star core, its corona and the reality light all follow the flame.
            </p>
          </div>

          {/* live chromatic preview */}
          <div
            className="h-9 rounded-xl border border-white/15 shadow-inner"
            style={{ background: `linear-gradient(120deg, ${identity.colorA ?? reality.colorA}, ${identity.colorB ?? reality.colorB})` }}
          />

          <button
            onClick={applyIdentity}
            disabled={!identityDirty}
            className={`self-start flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-mono uppercase tracking-wider border transition-all ${
              identityDirty
                ? 'bg-linear-to-r from-cyan-500/80 to-blue-600/80 hover:from-cyan-400 hover:to-blue-500 text-white border-cyan-300/40 shadow-[0_0_16px_rgba(6,182,212,0.35)]'
                : 'bg-white/4 text-slate-500 border-white/10 cursor-default'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Weave Changes
          </button>
        </div>
      )}

      {/* LORE */}
      {tab === 'lore' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-cyan-300">Cosmological Lore & Description</span>
            <span className="font-mono text-[10px] text-slate-400">{lore.length} chars</span>
          </div>
          <textarea
            value={lore}
            onChange={(e) => setLore(e.target.value)}
            rows={6}
            placeholder="Write the history, physics, civilizations and anomalies of this reality…"
            className="w-full rounded-2xl bg-white/5 border border-white/15 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 p-4 text-sm text-slate-100 placeholder-slate-400 outline-none leading-relaxed resize-y min-h-32.5 backdrop-blur-md shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {LORE_INSPIRATIONS.map((insp) => (
              <button
                key={insp.title}
                onClick={() => setLore((prev) => (prev.trim() ? `${prev.trim()}\n\n${insp.snippet}` : insp.snippet))}
                className="text-left p-2.5 rounded-xl bg-white/4 hover:bg-cyan-500/15 border border-white/10 hover:border-cyan-400/40 transition-all text-[11px] group backdrop-blur-sm"
              >
                <div className="font-medium text-slate-200 group-hover:text-cyan-200 flex items-center justify-between">
                  <span>{insp.title}</span>
                  <span className="text-[9px] text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity font-mono">+ Add</span>
                </div>
                <p className="text-slate-400 text-[10px] mt-1 line-clamp-2 leading-relaxed">{insp.snippet}</p>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={saveLore}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-linear-to-r from-cyan-500/80 to-blue-600/80 hover:from-cyan-400 hover:to-blue-500 text-white text-[11px] font-semibold border border-cyan-300/40 shadow-[0_0_16px_rgba(6,182,212,0.3)] font-mono uppercase tracking-wider transition-all"
            >
              {savedFlash ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
              {savedFlash ? 'Saved' : 'Save Lore'}
            </button>
            <button
              onClick={resetLore}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 hover:text-white text-[11px] font-medium backdrop-blur-md transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" /> Reset to Canon
            </button>
          </div>
        </div>
      )}

      {/* GALAXIES */}
      {tab === 'galaxies' && (
        <GalaxyRoster
          realityId={realityId}
          highlightGalaxyId={focusGalaxyId}
          onEnterGalaxy={(gid) => onEnterGalaxy?.(realityId, gid)}
        />
      )}
    </div>
  );
};

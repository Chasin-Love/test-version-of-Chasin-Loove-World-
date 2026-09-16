import React, { useEffect, useState } from 'react';
import {
  Plus, Trash2, Home, ChevronDown, ChevronRight, Orbit, Sparkles, CircleDot,
} from 'lucide-react';
import { getReality, GalaxyData } from '../../realities';
import { actions, useUniverse } from '../../state';
import { toast } from '../../ui/toast';

/* Tiny live preview of the galaxy's ellipse orbit — the same 1-ellipse-per-
   galaxy contract the 3D multiverse ring renders. */
function EllipsePreview({ color, incl, home }: { color: string; incl: number; home: boolean }) {
  const ry = 7 + Math.abs(Math.sin(incl)) * 8;
  return (
    <svg width="52" height="30" viewBox="0 0 52 30" className="shrink-0">
      <ellipse cx="26" cy="15" rx="22" ry={ry} fill="none" stroke={color} strokeOpacity={home ? 0.85 : 0.5} strokeWidth="1.4" />
      <circle cx="26" cy={15 + ry * 0.72} r="3" fill={color} />
      <circle cx="26" cy="15" r="1.6" fill="#fff" fillOpacity="0.8" />
    </svg>
  );
}

interface Props {
  realityId: string;
  onEnterGalaxy?: (galaxyId: string) => void;
  highlightGalaxyId?: string | null;
}

/** Full CRUD editor for a reality's major galaxies. Every mutation is live:
    the multiverse ring redraws its ellipses the instant the roster changes. */
export const GalaxyRoster: React.FC<Props> = ({ realityId, onEnterGalaxy, highlightGalaxyId }) => {
  const state = useUniverse();
  const reality = getReality(realityId, state.customRealityDescriptions);
  const galaxies: GalaxyData[] = reality.galaxies ?? [];

  const [expanded, setExpanded] = useState<string | null>(highlightGalaxyId ?? null);
  const [newName, setNewName] = useState('');
  const [bulkCount, setBulkCount] = useState(3);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  /* local draft for the expanded galaxy — committed on blur / pointer release
     so dragging sliders doesn't rebuild the whole multiverse every frame */
  const [draft, setDraft] = useState<Partial<GalaxyData>>({});
  const expand = (g: GalaxyData) => {
    setExpanded(g.id);
    setDraft({ name: g.name, type: g.type, color: g.color, description: g.description, diameterKly: g.diameterKly, starsCount: g.starsCount });
  };

  /* auto-expansion from outside (focusGalaxyId) must fill the draft too */
  useEffect(() => {
    if (!highlightGalaxyId) return;
    const g = galaxies.find((x) => x.id === highlightGalaxyId);
    if (g) {
      setExpanded(g.id);
      setDraft({ name: g.name, type: g.type, color: g.color, description: g.description, diameterKly: g.diameterKly, starsCount: g.starsCount });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightGalaxyId, realityId]);

  const commit = (g: GalaxyData, patch: Partial<GalaxyData>) => {
    actions.updateGalaxy(realityId, g.id, patch);
  };

  const handleAdd = (count: number) => {
    const created = actions.addGalaxies(realityId, count, { names: newName.trim() ? [newName.trim()] : undefined });
    toast(`✦ ${created.length} galax${created.length === 1 ? 'y' : 'ies'} forged — the ring updates live`);
    setNewName('');
    if (created[0]) expand(created[0]);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-[10.5px] font-mono tracking-[0.18em] uppercase text-cyan-300">
          <Orbit className="w-3.5 h-3.5" />
          <span>Major Galaxies — 1 ellipse = 1 galaxy</span>
        </div>
        <span className="font-mono text-[10px] text-slate-400">{galaxies.length} on this reality's ring</span>
      </div>

      {/* roster */}
      <div className="flex flex-col gap-1.5 max-h-75 overflow-y-auto custom-scroll pr-1">
        {galaxies.length === 0 && (
          <p className="text-[11px] text-slate-400 px-3 py-4 text-center border border-dashed border-white/15 rounded-xl">
            No galaxies — this reality's ring is empty. Forge one below.
          </p>
        )}
        {galaxies.map((g) => {
          const open = expanded === g.id;
          return (
            <div
              key={g.id}
              className={`rounded-xl border transition-all backdrop-blur-md ${
                open
                  ? 'bg-cyan-500/10 border-cyan-400/45 shadow-[0_0_16px_rgba(6,182,212,0.14)]'
                  : highlightGalaxyId === g.id
                    ? 'bg-cyan-500/[0.07] border-cyan-400/35'
                    : 'bg-white/3 border-white/10 hover:border-white/25'
              }`}
            >
              <button
                onClick={() => (open ? setExpanded(null) : expand(g))}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left"
              >
                {open ? <ChevronDown className="w-3.5 h-3.5 text-cyan-300 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                <EllipsePreview color={g.color} incl={g.orbitIncl} home={g.isHomeGalaxy} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[12.5px] font-semibold text-white truncate">{g.name}</span>
                    {g.isHomeGalaxy && (
                      <span className="text-[8.5px] font-mono px-1.5 py-px rounded-full bg-amber-400/15 border border-amber-300/40 text-amber-200 uppercase tracking-wider shrink-0">
                        Home
                      </span>
                    )}
                  </span>
                  <span className="block font-mono text-[9.5px] text-slate-400 truncate">{g.type} · {g.starsCount}</span>
                </span>
              </button>

              {open && (
                <div className="px-3 pb-3 pt-1 flex flex-col gap-2.5 border-t border-white/10 mt-1">
                  {/* name */}
                  <label className="block">
                    <span className="block text-[9px] font-mono uppercase tracking-[0.2em] text-cyan-300/90 mb-1">Galaxy Name</span>
                    <input
                      value={draft.name ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      onBlur={() => { if (draft.name && draft.name !== g.name) commit(g, { name: draft.name }); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      className="w-full rounded-lg bg-white/6 border border-white/15 focus:border-cyan-400 px-2.5 py-1.5 text-xs text-white outline-none backdrop-blur-md"
                    />
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* morphology */}
                    <label className="block">
                      <span className="block text-[9px] font-mono uppercase tracking-[0.2em] text-cyan-300/90 mb-1">Morphology</span>
                      <input
                        value={draft.type ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
                        onBlur={() => { if (draft.type !== undefined && draft.type !== g.type) commit(g, { type: draft.type }); }}
                        className="w-full rounded-lg bg-white/6 border border-white/15 focus:border-cyan-400 px-2.5 py-1.5 text-xs text-white font-mono outline-none backdrop-blur-md"
                      />
                    </label>
                    {/* tint */}
                    <label className="block">
                      <span className="block text-[9px] font-mono uppercase tracking-[0.2em] text-cyan-300/90 mb-1">Light Color</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={draft.color ?? g.color}
                          onChange={(e) => { setDraft((d) => ({ ...d, color: e.target.value })); commit(g, { color: e.target.value }); }}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                        />
                        <input
                          value={draft.color ?? ''}
                          onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
                          onBlur={() => { if (draft.color && draft.color !== g.color) commit(g, { color: draft.color }); }}
                          className="flex-1 rounded-lg bg-white/6 border border-white/15 focus:border-cyan-400 px-2.5 py-1.5 text-xs text-white font-mono outline-none"
                        />
                      </div>
                    </label>
                  </div>

                  {/* orbit sliders — committed on release */}
                  {([
                    ['Orbit Radius', 'orbitRadius', 1.05, 6, 0.01],
                    ['Orbit Speed', 'orbitSpeed', -0.25, 0.25, 0.005],
                    ['Ellipse Tilt', 'orbitIncl', -1.5, 1.5, 0.01],
                  ] as const).map(([label, key, min, max, step]) => (
                    <label key={key} className="block">
                      <span className="flex items-center justify-between text-[9px] font-mono uppercase tracking-[0.2em] text-cyan-300/90 mb-1">
                        <span>{label}</span>
                        <span className="text-slate-400 tabular-nums">{Number(draft[key] ?? g[key]).toFixed(2)}</span>
                      </span>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={Number(draft[key] ?? g[key])}
                        onChange={(e) => setDraft((d) => ({ ...d, [key]: Number(e.target.value) }))}
                        onPointerUp={() => commit(g, { [key]: Number(draft[key] ?? g[key]) } as Partial<GalaxyData>)}
                        onKeyUp={() => commit(g, { [key]: Number(draft[key] ?? g[key]) } as Partial<GalaxyData>)}
                        className="w-full accent-cyan-400"
                      />
                    </label>
                  ))}

                  {/* lore */}
                  <label className="block">
                    <span className="block text-[9px] font-mono uppercase tracking-[0.2em] text-cyan-300/90 mb-1">Galaxy Lore</span>
                    <textarea
                      rows={2}
                      value={draft.description ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                      onBlur={() => { if (draft.description !== undefined && draft.description !== g.description) commit(g, { description: draft.description }); }}
                      className="w-full rounded-lg bg-white/6 border border-white/15 focus:border-cyan-400 px-2.5 py-1.5 text-xs text-slate-100 outline-none resize-none leading-relaxed backdrop-blur-md"
                    />
                  </label>

                  {/* row actions */}
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {onEnterGalaxy && (
                      <button
                        onClick={() => onEnterGalaxy(g.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/40 text-cyan-100 text-[10px] font-mono uppercase tracking-wider transition-all"
                      >
                        <CircleDot className="w-3 h-3" /> Enter & Navigate
                      </button>
                    )}
                    {!g.isHomeGalaxy && (
                      <button
                        onClick={() => { actions.setHomeGalaxy(realityId, g.id); toast(`${g.name} is now the home galaxy`); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 border border-amber-300/30 text-amber-200 text-[10px] font-mono uppercase tracking-wider transition-all"
                      >
                        <Home className="w-3 h-3" /> Set Home
                      </button>
                    )}
                    {g.isHomeGalaxy ? (
                      <span className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                        <Sparkles className="w-3 h-3" /> anchors the hierarchy — protected
                      </span>
                    ) : confirmDel === g.id ? (
                      <button
                        onClick={() => { actions.deleteGalaxy(realityId, g.id); setConfirmDel(null); setExpanded(null); toast(`${g.name} dissolved — its ellipse left the ring`); }}
                        className="ml-auto px-2.5 py-1.5 rounded-lg bg-rose-500/30 hover:bg-rose-500/50 border border-rose-400/60 text-rose-100 text-[10px] font-mono uppercase tracking-wider transition-all"
                      >
                        Confirm Dissolve
                      </button>
                    ) : (
                      <button
                        onClick={() => { setConfirmDel(g.id); setTimeout(() => setConfirmDel((c) => (c === g.id ? null : c)), 2600); }}
                        className="ml-auto p-1.5 rounded-lg text-rose-300 hover:text-rose-100 hover:bg-rose-500/20 border border-transparent hover:border-rose-400/40 transition-all"
                        title="Dissolve this galaxy"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* forge controls */}
      <div className="flex items-center gap-2 flex-wrap p-2.5 rounded-xl bg-white/3 border border-white/10">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(1); }}
          placeholder="New galaxy name (optional)…"
          className="flex-1 min-w-35 rounded-lg bg-white/6 border border-white/15 focus:border-cyan-400 px-2.5 py-1.5 text-xs text-white placeholder-slate-400 outline-none backdrop-blur-md"
        />
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-slate-400 uppercase">Count</span>
          <input
            type="number"
            min={1}
            max={12}
            value={bulkCount}
            onChange={(e) => setBulkCount(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
            className="w-14 rounded-lg bg-white/6 border border-white/15 focus:border-cyan-400 px-2 py-1.5 text-xs text-white font-mono outline-none"
          />
        </div>
        <button
          onClick={() => handleAdd(bulkCount)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-linear-to-r from-cyan-500/80 to-blue-600/80 hover:from-cyan-400 hover:to-blue-500 text-white text-[11px] font-bold shadow-[0_0_14px_rgba(6,182,212,0.3)] border border-cyan-300/40 backdrop-blur-md transition-all font-mono uppercase tracking-wider"
        >
          <Plus className="w-3.5 h-3.5" /> Forge {bulkCount} Galax{bulkCount > 1 ? 'ies' : 'y'}
        </button>
      </div>
    </div>
  );
};

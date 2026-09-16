import React from 'react';
import { GalaxyData } from '../realities';
import { Orbit, Edit3, Compass, ArrowRight, Home, CircleDot } from 'lucide-react';

interface Props {
  galaxy: GalaxyData;
  realityName: string;
  screenPos?: { x: number; y: number } | null;
  onEnter: (galaxyId: string, realityId: string) => void;
  onEdit: (galaxy: GalaxyData) => void;
  onInspectLineage: (galaxy: GalaxyData) => void;
}

/** Hover card for a major galaxy riding its ellipse around a reality bubble.
    One ellipse = this galaxy; click dives in, double-click opens the editor. */
export const GalaxyHoverCard: React.FC<Props> = ({ galaxy, realityName, screenPos, onEnter, onEdit, onInspectLineage }) => {
  let style: React.CSSProperties = { bottom: '2.5rem', left: '2rem' };
  if (screenPos && screenPos.x > 0 && screenPos.y > 0) {
    const cardWidth = 360;
    const cardHeight = 300;
    const padding = 20;
    let left = screenPos.x + 24;
    let top = screenPos.y - 40;
    if (left + cardWidth > window.innerWidth - padding) left = screenPos.x - cardWidth - 24;
    if (top + cardHeight > window.innerHeight - padding) top = window.innerHeight - cardHeight - padding;
    if (top < padding) top = padding;
    style = { position: 'fixed', left: `${Math.max(padding, left)}px`, top: `${Math.max(padding, top)}px` };
  }

  return (
    <div
      style={{
        ...style,
        borderColor: `${galaxy.color}66`,
        boxShadow: `0 16px 45px rgba(0,0,0,0.65), 0 0 30px ${galaxy.color}44, inset 0 1px 1px rgba(255,255,255,0.18)`,
      }}
      className="fixed z-50 pointer-events-none w-[360px] rounded-2xl border bg-slate-950/45 backdrop-blur-2xl p-4 text-slate-100 rise-in select-none relative overflow-hidden transition-all duration-150"
    >
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />
      <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full blur-2xl pointer-events-none" style={{ background: `${galaxy.color}14` }} />

      {/* header */}
      <div className="flex items-start justify-between gap-2 relative z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-3.5 h-3.5 rounded-full shrink-0 ring-2 ring-white/20 animate-pulse"
            style={{ backgroundColor: galaxy.color, boxShadow: `0 0 14px ${galaxy.color}` }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-[9px] tracking-[0.22em] uppercase font-semibold" style={{ color: galaxy.color }}>
                MAJOR GALAXY
              </span>
              {galaxy.isHomeGalaxy && (
                <span className="flex items-center gap-0.5 text-[8.5px] font-mono px-1.5 py-px rounded-full bg-amber-400/15 border border-amber-300/40 text-amber-200 uppercase tracking-wider">
                  <Home className="w-2.5 h-2.5" /> Home
                </span>
              )}
            </div>
            <h3 className="font-display text-sm tracking-wider font-semibold text-white mt-0.5 truncate">{galaxy.name}</h3>
            <p className="font-mono text-[9px] text-slate-400 truncate">{galaxy.type} · inside {realityName}</p>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(galaxy); }}
          className="pointer-events-auto flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 border border-amber-300/30 hover:border-amber-300/60 text-amber-200 hover:text-amber-100 text-[10px] font-mono tracking-wider backdrop-blur-md transition-all shrink-0"
          title="Edit this galaxy (same as double-click)"
        >
          <Edit3 className="w-2.5 h-2.5" /> Edit
        </button>
      </div>

      {/* description */}
      <div className="mt-2 p-2.5 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-md text-xs text-slate-200 leading-relaxed max-h-16 overflow-y-auto custom-scroll shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] relative z-10">
        {galaxy.description}
      </div>

      {/* lineage strip */}
      <button
        onClick={(e) => { e.stopPropagation(); onInspectLineage(galaxy); }}
        className="pointer-events-auto mt-2 w-full text-left p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-cyan-400/30 transition-all relative z-10"
      >
        <div className="flex items-center justify-between font-mono text-[8.5px] uppercase tracking-wider text-cyan-300 mb-0.5">
          <span className="flex items-center gap-1"><Compass className="w-2.5 h-2.5" /> Its 11-stage lineage</span>
          <span className="text-amber-300 font-semibold">Explore</span>
        </div>
        <div className="font-mono text-[9.5px] text-slate-300 truncate">
          <span className="text-white font-semibold">{galaxy.lineage.galaxy.name}</span>
          <span className="text-slate-500"> ➔ {galaxy.lineage.spiralArm.name}</span>
          <span className="text-slate-500"> ➔ </span>
          <span className="text-emerald-300">{galaxy.lineage.stellarSystem.starName}</span>
        </div>
      </button>

      {/* footer stats + enter */}
      <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-white/10 relative z-10">
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-300">
          <Orbit className="w-3 h-3" style={{ color: galaxy.color }} />
          <span>{galaxy.starsCount}</span>
          <span className="text-slate-500">·</span>
          <span>{galaxy.diameterKly}</span>
        </div>
        <button
          onClick={() => onEnter(galaxy.id, galaxy.realityId)}
          className="pointer-events-auto flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10.5px] font-medium backdrop-blur-md transition-all border"
          style={{
            background: `${galaxy.color}22`,
            borderColor: `${galaxy.color}66`,
            color: '#fff',
            boxShadow: `0 0 12px ${galaxy.color}33`,
          }}
        >
          <CircleDot className="w-2.5 h-2.5" />
          <span>Dive In</span>
          <ArrowRight className="w-2.5 h-2.5" />
        </button>
      </div>

      <div className="mt-1.5 text-center relative z-10">
        <span className="font-mono text-[7.5px] tracking-[0.18em] text-slate-400/80 uppercase">
          ✦ click — dive in & navigate · double-click — full galaxy editor
        </span>
      </div>
    </div>
  );
};

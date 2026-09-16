import React, { useEffect } from 'react';
import { X, Compass } from 'lucide-react';
import { getReality } from '../realities';
import { useUniverse } from '../state';
import { RealityAdvancedPanel } from './RealityAdvancedPanel';

interface Props {
  realityId: string;
  focusGalaxyId?: string | null;
  onClose: () => void;
  onEnterGalaxy?: (realityId: string, galaxyId: string) => void;
}

/** Double-click a reality bubble in the multiverse → the full advanced editor:
    rename / recolor / reclassify, rewrite its lore, forge & dissolve galaxies. */
export const RealityAdvancedModal: React.FC<Props> = ({ realityId, focusGalaxyId, onClose, onEnterGalaxy }) => {
  const state = useUniverse();
  const reality = getReality(realityId, state.customRealityDescriptions);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-xl animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl border border-cyan-400/30 bg-slate-950/45 backdrop-blur-3xl shadow-[0_24px_70px_rgba(0,0,0,0.7),0_0_44px_rgba(6,182,212,0.14),inset_0_1px_1px_rgba(255,255,255,0.18)] text-slate-100 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-60" style={{ background: `radial-gradient(circle, ${reality.colorA}33, transparent 70%)` }} />

        {/* header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="w-10 h-10 rounded-2xl shadow-[0_0_20px_currentColor] flex items-center justify-center border border-white/30 shrink-0"
              style={{ background: `linear-gradient(135deg, ${reality.colorA}cc, ${reality.colorB}88)`, color: reality.colorA }}
            >
              <Compass className="w-5 h-5 text-white drop-shadow" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-cyan-300 font-semibold px-2 py-0.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40">
                  {reality.codeName || 'PARALLEL REALITY'}
                </span>
                <span className="font-mono text-[9.5px] tracking-wider text-slate-300 truncate">{reality.spectral}</span>
              </div>
              <h2 className="font-display text-lg tracking-wider font-bold text-white mt-0.5 truncate">{reality.name}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 transition-all backdrop-blur-md shrink-0"
            title="Close editor"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scroll px-6 py-5 relative z-10">
          <RealityAdvancedPanel
            realityId={realityId}
            focusGalaxyId={focusGalaxyId}
            onEnterGalaxy={(rid, gid) => { onClose(); onEnterGalaxy?.(rid, gid); }}
          />
        </div>
      </div>
    </div>
  );
};

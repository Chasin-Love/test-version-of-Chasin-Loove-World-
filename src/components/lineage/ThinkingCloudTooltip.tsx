import React, { useState } from 'react';
import { Sparkles, Plus, Wand2 } from 'lucide-react';

interface ThinkingCloudTooltipProps {
  label?: string;
  subtitle?: string;
  onClick: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  iconType?: 'forge' | 'star' | 'singularity' | 'plus';
  position?: 'bottom' | 'top' | 'left' | 'right';
  id?: string;
}

export const ThinkingCloudTooltip: React.FC<ThinkingCloudTooltipProps> = ({
  label = 'Forge Reality Continuum',
  subtitle = 'Manifest a new parallel realm & disk directory',
  onClick,
  className = '',
  size = 'md',
  iconType = 'forge',
  position = 'bottom',
  id = 'thinking-cloud-forge',
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  }[size];

  const posClasses = {
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-3',
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-3',
    left: 'right-full top-1/2 -translate-y-1/2 mr-3',
    right: 'left-full top-1/2 -translate-y-1/2 ml-3',
  }[position];

  return (
    <div
      id={id}
      className={`relative inline-flex items-center justify-center ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
    >
      {/* The Celestial Catalyst Symbol Button */}
      <button
        type="button"
        onClick={onClick}
        className={`group relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 via-slate-900/90 to-violet-600/30 border border-cyan-400/50 hover:border-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.35),inset_0_0_12px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6),inset_0_0_16px_rgba(139,92,246,0.35)] active:scale-95 transition-all duration-300 cursor-pointer ${sizeClasses}`}
        aria-label={label}
        title={label}
      >
        {/* Subtle rotating orbital aura */}
        <span className="absolute inset-0 rounded-2xl border border-cyan-400/30 group-hover:border-cyan-300/70 animate-[spin_8s_linear_infinite] pointer-events-none" />
        <span className="absolute -inset-1 rounded-2xl bg-cyan-400/15 blur-sm group-hover:bg-cyan-400/30 transition-all pointer-events-none" />

        {/* Central Glyphic Symbol */}
        <div className="relative flex items-center justify-center text-cyan-300 group-hover:text-white transition-colors duration-200">
          {iconType === 'forge' && (
            <div className="relative">
              <Plus className="w-5 h-5 text-cyan-300 group-hover:text-white group-hover:rotate-90 transition-transform duration-300 drop-shadow-[0_0_8px_#22d3ee]" />
              <Sparkles className="w-2.5 h-2.5 text-amber-300 absolute -top-1.5 -right-1.5 animate-pulse" />
            </div>
          )}
          {iconType === 'star' && (
            <Sparkles className="w-5 h-5 text-amber-300 group-hover:scale-110 transition-transform drop-shadow-[0_0_10px_#f59e0b]" />
          )}
          {iconType === 'singularity' && (
            <Wand2 className="w-5 h-5 text-violet-300 group-hover:scale-110 transition-transform drop-shadow-[0_0_10px_#8b5cf6]" />
          )}
          {iconType === 'plus' && (
            <Plus className="w-5 h-5 text-cyan-300 group-hover:text-white group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_#22d3ee]" />
          )}
        </div>
      </button>

      {/* THE THINKING CLOUD / THOUGHT BUBBLE ANIMATION */}
      {isHovered && (
        <div
          className={`absolute ${posClasses} z-50 pointer-events-none select-none transition-all duration-300 animate-in fade-in zoom-in-90`}
          style={{ transformOrigin: position === 'top' ? 'bottom center' : 'top center' }}
        >
          {/* Puff 1: Smallest thought puff */}
          <div
            className={`absolute ${
              position === 'bottom' ? '-top-2.5 left-1/2 -translate-x-1/2' : 'bottom-0 left-1/2 -translate-x-1/2'
            } w-2.5 h-2.5 rounded-full bg-slate-900/90 border border-cyan-400/60 shadow-[0_0_8px_rgba(6,182,212,0.4)] animate-bounce`}
            style={{ animationDuration: '2s' }}
          />

          {/* Puff 2: Medium thought puff */}
          <div
            className={`absolute ${
              position === 'bottom' ? '-top-1 left-1/2 -translate-x-[14px]' : 'bottom-2 left-1/2 -translate-x-[14px]'
            } w-4 h-4 rounded-full bg-slate-900/90 border border-cyan-400/70 shadow-[0_0_12px_rgba(6,182,212,0.5)]`}
          />

          {/* Puff 3: Large billowed cloud container */}
          <div className="relative min-w-[240px] max-w-[320px] px-4 py-3 rounded-[24px] bg-slate-950/92 backdrop-blur-2xl border-2 border-cyan-400/70 shadow-[0_15px_35px_rgba(0,0,0,0.8),0_0_25px_rgba(6,182,212,0.35),inset_0_2px_4px_rgba(255,255,255,0.2)] text-left">
            {/* Cloud Billow Decorative Puffs along perimeter */}
            <div className="absolute -top-2 left-4 w-6 h-6 rounded-full bg-slate-950/92 border-t-2 border-l-2 border-cyan-400/60 -z-10" />
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-slate-950/92 border-t-2 border-cyan-400/70 -z-10 shadow-[0_-4px_10px_rgba(6,182,212,0.2)]" />
            <div className="absolute -top-2 right-4 w-6 h-6 rounded-full bg-slate-950/92 border-t-2 border-r-2 border-cyan-400/60 -z-10" />

            <div className="absolute -bottom-2 left-6 w-6 h-6 rounded-full bg-slate-950/92 border-b-2 border-l-2 border-cyan-400/60 -z-10" />
            <div className="absolute -bottom-2 right-6 w-6 h-6 rounded-full bg-slate-950/92 border-b-2 border-r-2 border-cyan-400/60 -z-10" />

            {/* Content inside cloud */}
            <div className="relative z-10 flex items-start gap-2.5">
              <div className="p-1.5 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 shrink-0 mt-0.5 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-spin" style={{ animationDuration: '6s' }} />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-violet-300 tracking-wide">
                    {label}
                  </span>
                </div>
                {subtitle && (
                  <p className="font-mono text-[9px] text-slate-300/85 mt-0.5 leading-tight">
                    {subtitle}
                  </p>
                )}
                <div className="mt-1.5 flex items-center gap-1 font-mono text-[8px] text-cyan-400/90 uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping inline-block" />
                  <span>Click to initiate</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

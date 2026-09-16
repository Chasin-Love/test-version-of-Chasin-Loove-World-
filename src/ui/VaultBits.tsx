/**
 * Shared Vault visual atoms — glyphs, tile previews, byte inspector.
 * Used by both the vault shell (VaultUI) and the EFS FileManager.
 */

import { useMemo } from 'react';
import type { VaultFile, VaultKind } from '../types';

export function seedRnd(name: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function KindGlyph({ kind, size = 18 }: { kind: VaultKind; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'document': return <svg {...common}><path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7" /></svg>;
    case 'image': return <svg {...common}><path d="M4 5h16v14H4zM8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM4 16l5-4 3 2.5L16 11l4 4" /></svg>;
    case 'audio': return <svg {...common}><path d="M9 18V6l10-2v11M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 15a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" /></svg>;
    case 'video': return <svg {...common}><path d="M4 5h16v14H4zM10 9l5 3-5 3z" /></svg>;
    case 'dataset': return <svg {...common}><path d="M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6" /></svg>;
    case 'archive': return <svg {...common}><path d="M4 7h16v13H4zM4 7l2-3h12l2 3M10 11h4" /></svg>;
    case 'iso': return <svg {...common}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /></svg>;
    case 'exe': case 'application': return <svg {...common}><path d="M5 4h14v16H5zM9 8l3 3-3 3M13 14h3" /></svg>;
    case 'game': return <svg {...common}><path d="M6 9h12a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-2a3 3 0 0 1 3-3zM8 12v2M7 13h2M15.5 12h.01M17.5 14h.01" /></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v4M12 15h.01" /></svg>;
  }
}

export function WaveStripLocal({ name, height = 30 }: { name: string; height?: number }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const bars = Array.from({ length: 40 }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(i * 0.8 + (h % 7))));
  return <div className="flex items-end gap-0.5 w-full" style={{ height }}>{bars.map((b, i) => <span key={i} className="flex-1 bg-teal-ice/50" style={{ height: `${Math.round(b * 100)}%` }} />)}</div>;
}

export function TilePreview({ f }: { f: VaultFile }) {
  if (f.payloadMissing) {
    return <div className="w-full h-full grid place-items-center bg-solar/5"><span className="font-mono text-[7px] tracking-[0.22em] text-solar/80 uppercase text-center">payload unavailable</span></div>;
  }
  if (f.kind === 'image' && (f.content || f.thumb)) return <img src={f.thumb ?? f.content} alt="" className="w-full h-full object-cover opacity-90" />;
  if (f.kind === 'audio') return <div className="px-2 py-2.5 h-full"><WaveStripLocal name={f.name} height={30} /></div>;
  if (f.kind === 'video') return (
    <div className="w-full h-full grid place-items-center relative" style={{ background: 'linear-gradient(160deg, rgba(18,32,42,0.9), rgba(6,9,16,0.95))' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(111,194,180,0.85)"><path d="M8 5.5v13l11-6.5z" /></svg>
      {f.content && <span className="absolute top-1 right-1.5 font-mono text-[6.5px] tracking-[0.18em] text-teal-ice/80">LIVE</span>}
    </div>
  );
  if (f.kind === 'document' && f.content && !f.sealed) {
    const lines = f.content.replace(/<[^>]+>/g, '').split('\n').filter((l) => l.trim()).slice(0, 2);
    return <div className="px-2 py-1.5 font-mono text-[7.5px] leading-[1.7] text-slate-soft/80 overflow-hidden">{lines.map((l, i) => <div key={i} className="truncate">{l}</div>)}</div>;
  }
  if (f.kind === 'dataset') {
    const rnd = seedRnd(f.name);
    const dots = Array.from({ length: 26 }, () => ({ x: rnd() * 100, y: rnd() * 100, r: rnd() * 1.6 + 0.6, w: rnd() > 0.8 }));
    return (
      <svg viewBox="0 0 100 52" className="w-full h-full" preserveAspectRatio="none">
        {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y * 0.52} r={d.r} fill={d.w ? 'rgba(242,193,120,0.8)' : 'rgba(143,208,184,0.6)'} />)}
      </svg>
    );
  }
  if (f.kind === 'iso' || f.kind === 'archive') return (
    <div className="w-full h-full grid place-items-center" style={{ background: 'repeating-linear-gradient(45deg, rgba(139,161,196,0.05) 0 6px, transparent 6px 12px)' }}>
      <span className="font-mono text-[7px] tracking-[0.3em] text-slate-dim uppercase">{f.kind === 'iso' ? 'iso9660' : 'table'}</span>
    </div>
  );
  return (
    <div className="w-full h-full grid place-items-center">
      <span className="font-mono text-[7px] tracking-[0.26em] text-slate-dim/70 uppercase">{f.sealed ? 'sealed binary' : f.kind}</span>
    </div>
  );
}

function synthHeader(f: VaultFile, n = 128): number[] {
  const rnd = seedRnd(f.name);
  const b = new Array(n).fill(0).map(() => Math.floor(rnd() * 256));
  const put = (o: number, bytes: number[]) => bytes.forEach((v, i) => { if (o + i < n) b[o + i] = v; });
  const ascii = (o: number, s: string) => put(o, [...s].map((c) => c.charCodeAt(0)));
  switch (f.kind) {
    case 'iso': put(0, [0x01]); ascii(1, 'CD001'); put(6, [0x01]); ascii(40, 'EVENTIDE'); break;
    case 'archive': put(0, [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]); ascii(30, f.name.slice(0, 14)); break;
    case 'exe': case 'game': case 'application': put(0, [0x4d, 0x5a, 0x90, 0x00]); ascii(60, 'PE'); break;
    case 'audio': ascii(0, 'RIFF'); ascii(8, 'WAVEfmt '); break;
    case 'image': put(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); break;
    case 'video': ascii(4, 'ftyp'); ascii(8, 'isom'); break;
    case 'dataset': ascii(0, (f.content ?? 'SIMPLE  =').slice(0, 60)); break;
    default: ascii(0, (f.content ?? f.name).slice(0, 60));
  }
  return b;
}

const toHex = (b: number) => b.toString(16).padStart(2, '0');
const toChar = (b: number) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '·');

export function HexInspector({ file }: { file: VaultFile }) {
  const bytes = useMemo(() => synthHeader(file, 128), [file]);
  const rows = useMemo(() => {
    const r: { off: string; hex: string[]; ascii: string }[] = [];
    for (let i = 0; i < bytes.length; i += 16) {
      r.push({ off: i.toString(16).padStart(8, '0'), hex: bytes.slice(i, i + 16).map(toHex), ascii: bytes.slice(i, i + 16).map(toChar).join('') });
    }
    return r;
  }, [bytes]);
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <p className="font-mono text-[9px] tracking-[0.28em] uppercase text-teal-ice/80">byte signature · first 128 B</p>
        <span className="font-mono text-[8.5px] text-slate-dim">{bytes.slice(0, 8).map(toHex).join(' ')} …</span>
      </div>
      <div className="relative border border-line/60 bg-void/60 overflow-hidden">
        <div className="hex-scan absolute inset-x-0 h-0.5" style={{ background: 'linear-gradient(90deg, transparent, rgba(111,194,180,0.8), transparent)' }} />
        <pre className="p-3 font-mono text-[10.5px] leading-[1.8] overflow-x-auto">
          {rows.map((r, i) => (
            <div key={i} className="hex-row" style={{ animationDelay: `${i * 45}ms` }}>
              <span className="text-teal-ice/70">{r.off}</span>
              <span className="text-slate-soft">  {r.hex.join(' ')}</span>
              <span className="text-slate-dim">  {r.ascii}</span>
            </div>
          ))}
        </pre>
      </div>
      <p className="font-body text-[11.5px] text-slate-dim leading-relaxed mt-3">
        The magic bytes identify the container to any inspector. The full payload stays sealed in the execution layer.
      </p>
    </div>
  );
}

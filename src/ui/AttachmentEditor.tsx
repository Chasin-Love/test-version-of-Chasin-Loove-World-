import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from './toast';

/**
 * AttachmentEditor — the advanced image editor for diary attachments.
 *
 * Everything runs client-side on a canvas:
 *   • crop with a draggable frame (free / 1:1 / 4:3 / 16:9)
 *   • rotate 90° steps + fine straighten (−15°…15°)
 *   • flip horizontal / vertical
 *   • output scale (resize) 10–200%
 *   • brightness / contrast / saturation
 * Apply renders the full-resolution result; output stays ≤ ~220KB by stepping
 * JPEG quality so the edit can live inline in the diary page.
 */

type Aspect = 'free' | '1:1' | '4:3' | '16:9';

interface CropRect { x: number; y: number; w: number; h: number }

const PREVIEW_MAX_W = 620;
const PREVIEW_MAX_H = 380;
const MAX_OUTPUT_DIM = 2400;
const MAX_INLINE_BYTES = 220 * 1024;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export default function AttachmentEditor({
  name,
  src,
  onCancel,
  onApply,
}: {
  name: string;
  src: string;
  onCancel: () => void;
  onApply: (dataUrl: string) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [rot90, setRot90] = useState(0);            // 0 | 90 | 180 | 270
  const [fineRot, setFineRot] = useState(0);        // degrees
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [aspect, setAspect] = useState<Aspect>('free');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [scalePct, setScalePct] = useState(100);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [busy, setBusy] = useState(false);
  /* if the source never arrives at all, the payload is genuinely gone */
  const [payloadTimeout, setPayloadTimeout] = useState(false);
  useEffect(() => {
    if (src) { setPayloadTimeout(false); return; }
    const t = setTimeout(() => setPayloadTimeout(true), 8000);
    return () => clearTimeout(t);
  }, [src]);

  const previewRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef({ scale: 1, dx: 0, dy: 0, w: 0, h: 0 });
  const dragRef = useRef<{
    mode: 'move' | 'resize' | 'new';
    handle?: string;
    startX: number; startY: number;
    orig: CropRect;
  } | null>(null);

  /* live preview box — sized to the actual available space so the editor
     never overflows the window (the fixed 620px canvas used to push the
     controls panel off-screen with no way to reach Apply) */
  const [box, setBox] = useState({ w: 320, h: 220 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const availW = el.clientWidth;
      const availH = Math.max(180, Math.min(PREVIEW_MAX_H, Math.round(window.innerHeight * 0.44)));
      const w = clamp(Math.min(availW, PREVIEW_MAX_W), 220, PREVIEW_MAX_W);
      const h = clamp(Math.min(availH, Math.round(w * 0.62)), 150, PREVIEW_MAX_H);
      setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [img]);

  /* transformed (pre-crop) natural dimensions */
  const transformed = useMemo(() => {
    if (!img) return { w: 0, h: 0 };
    const swap = rot90 === 90 || rot90 === 270;
    return { w: swap ? img.height : img.width, h: swap ? img.width : img.height };
  }, [img, rot90]);

  /* load the source image. The source may arrive asynchronously (offloaded
     payloads resolve from storage), so an empty src means "still loading" —
     an empty-string src would fire onerror and we must never latch onto it. */
  useEffect(() => {
    if (!src) { setImg(null); setFailed(false); return; }
    setFailed(false);
    setImg(null);
    const image = new Image();
    image.onload = () => setImg(image);
    image.onerror = () => setFailed(true);
    image.src = src;
  }, [src]);

  /* render the transformed image into the preview canvas */
  useEffect(() => {
    const cv = previewRef.current;
    if (!cv || !img) return;
    const g = cv.getContext('2d');
    if (!g) return;
    const W = box.w;
    const H = box.h;
    cv.width = W;
    cv.height = H;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#05070f';
    g.fillRect(0, 0, W, H);

    const rad = (fineRot * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const swapFine = fineRot !== 0;
    const baseW = transformed.w;
    const baseH = transformed.h;
    // bounding box after fine rotation
    const bw = swapFine ? baseW * cos + baseH * sin : baseW;
    const bh = swapFine ? baseW * sin + baseH * cos : baseH;

    const scale = Math.min((W - 20) / bw, (H - 20) / bh);
    const dw = bw * scale;
    const dh = bh * scale;
    const dx = (W - dw) / 2;
    const dy = (H - dh) / 2;
    fitRef.current = { scale, dx, dy, w: dw, h: dh };

    g.save();
    g.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    g.translate(dx + dw / 2, dy + dh / 2);
    g.rotate(rad);
    g.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    g.rotate((rot90 * Math.PI) / 180);
    g.scale(scale, scale);
    g.drawImage(img, -img.width / 2, -img.height / 2);
    g.restore();

    /* re-clamp the crop rect into the resized frame */
    setCrop((prev) => {
      if (!prev) return null;
      const maxW = transformed.w * scale;
      const maxH = transformed.h * scale;
      const x = clamp(prev.x, dx, dx + maxW - 8);
      const y = clamp(prev.y, dy, dy + maxH - 8);
      return {
        x, y,
        w: clamp(prev.w, 8, dx + maxW - x),
        h: clamp(prev.h, 8, dy + maxH - y),
      };
    });
  }, [img, rot90, fineRot, flipH, flipV, brightness, contrast, saturation, transformed, box]);

  /* (re)seed or constrain the crop rect whenever the transform/aspect changes */
  useEffect(() => {
    const { scale, dx, dy } = fitRef.current;
    const w = transformed.w * scale;
    const h = transformed.h * scale;
    if (w <= 0 || h <= 0) return;
    setCrop((prev) => {
      if (!prev) return { x: dx, y: dy, w, h };
      // clamp existing rect into the new frame
      const x = clamp(prev.x, dx, dx + w - 8);
      const y = clamp(prev.y, dy, dy + h - 8);
      return {
        x, y,
        w: clamp(prev.w, 8, dx + w - x),
        h: clamp(prev.h, 8, dy + h - y),
      };
    });
  }, [transformed, rot90, fineRot]);

  const applyAspect = useCallback((next: Aspect) => {
    setAspect(next);
    setCrop((prev) => {
      if (!prev || next === 'free') return prev;
      const [, rw, rh] = next === '1:1' ? [0, 1, 1] : next === '4:3' ? [0, 4, 3] : [0, 16, 9];
      const { scale, dx, dy } = fitRef.current;
      const maxW = transformed.w * scale;
      const maxH = transformed.h * scale;
      let w = maxW;
      let h = (w * rh) / rw;
      if (h > maxH) { h = maxH; w = (h * rw) / rh; }
      const cx = prev.x + prev.w / 2;
      const cy = prev.y + prev.h / 2;
      return {
        x: clamp(cx - w / 2, dx, dx + maxW - w),
        y: clamp(cy - h / 2, dy, dy + maxH - h),
        w, h,
      };
    });
  }, [transformed]);

  const onHandleDown = (mode: 'move' | 'resize' | 'new', handle?: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!crop) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { mode, handle, startX: e.clientX, startY: e.clientY, orig: { ...crop } };
  };

  const onHandleMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !crop) return;
    const { scale, dx, dy } = fitRef.current;
    const maxW = transformed.w * scale;
    const maxH = transformed.h * scale;
    const mx = e.clientX - drag.startX;
    const my = e.clientY - drag.startY;
    const o = drag.orig;

    if (drag.mode === 'move') {
      setCrop({
        ...o,
        x: clamp(o.x + mx, dx, dx + maxW - o.w),
        y: clamp(o.y + my, dy, dy + maxH - o.h),
      });
      return;
    }
    if (drag.mode === 'new') {
      const x1 = clamp(Math.min(o.x + mx, o.x), dx, dx + maxW);
      const y1 = clamp(Math.min(o.y + my, o.y), dy, dy + maxH);
      const x2 = clamp(Math.max(o.x + mx, o.x + o.w), dx, dx + maxW);
      const y2 = clamp(Math.max(o.y + my, o.y + o.h), dy, dy + maxH);
      setCrop({ x: x1, y: y1, w: Math.max(8, x2 - x1), h: Math.max(8, y2 - y1) });
      return;
    }
    // resize via handle
    const h = drag.handle ?? 'se';
    let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
    if (h.includes('w')) x1 = clamp(o.x + mx, dx, x2 - 8);
    if (h.includes('e')) x2 = clamp(o.x + o.w + mx, x1 + 8, dx + maxW);
    if (h.includes('n')) y1 = clamp(o.y + my, dy, y2 - 8);
    if (h.includes('s')) y2 = clamp(o.y + o.h + my, y1 + 8, dy + maxH);
    let rect = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    if (aspect !== 'free') {
      const [, rw, rh] = aspect === '1:1' ? [0, 1, 1] : aspect === '4:3' ? [0, 4, 3] : [0, 16, 9];
      const ar = rw / rh;
      if (rect.w / rect.h > ar) rect.w = rect.h * ar;
      else rect.h = rect.w / ar;
      if (h.includes('w')) rect.x = x2 - rect.w;
      if (h.includes('n')) rect.y = y2 - rect.h;
    }
    setCrop(rect);
  };

  const onHandleUp = () => { dragRef.current = null; };

  /** Full-resolution render: transform → crop → scale → filters → dataUrl. */
  const renderOutput = useCallback((): string | null => {
    if (!img || !crop) return null;
    const { scale, dx, dy } = fitRef.current;
    if (scale <= 0) return null;

    const rad = (fineRot * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const bw = fineRot !== 0 ? transformed.w * cos + transformed.h * sin : transformed.w;
    const bh = fineRot !== 0 ? transformed.w * sin + transformed.h * cos : transformed.h;

    // 1. full-res transformed source
    const src = document.createElement('canvas');
    src.width = Math.round(bw);
    src.height = Math.round(bh);
    const sg = src.getContext('2d');
    if (!sg) return null;
    sg.translate(src.width / 2, src.height / 2);
    sg.rotate(rad);
    sg.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    sg.rotate((rot90 * Math.PI) / 180);
    sg.drawImage(img, -img.width / 2, -img.height / 2);

    // 2. map the preview crop into source pixels
    const sx = (crop.x - dx) / scale;
    const sy = (crop.y - dy) / scale;
    const sw = crop.w / scale;
    const sh = crop.h / scale;

    // 3. output at the requested scale
    const outW = clamp(Math.round(sw * (scalePct / 100)), 8, MAX_OUTPUT_DIM);
    const outH = clamp(Math.round(sh * (scalePct / 100)), 8, MAX_OUTPUT_DIM);
    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const og = out.getContext('2d');
    if (!og) return null;
    og.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    og.drawImage(src, sx, sy, sw, sh, 0, 0, outW, outH);
    return out.toDataURL('image/png');
  }, [img, crop, fineRot, rot90, flipH, flipV, brightness, contrast, saturation, scalePct, transformed]);

  const handleApply = () => {
    if (!crop) { toast('crop frame missing', 'warn'); return; }
    setBusy(true);
    try {
      const png = renderOutput();
      if (!png) throw new Error('render failed');
      const keepAlpha = png.length < MAX_INLINE_BYTES * 1.4;
      if (keepAlpha) {
        onApply(png);
        return;
      }
      /* step JPEG quality down until the edit fits inline in the diary page */
      const out = document.createElement('canvas');
      const img2 = new Image();
      img2.onload = () => {
        out.width = img2.naturalWidth;
        out.height = img2.naturalHeight;
        const g = out.getContext('2d')!;
        g.fillStyle = '#05070f';
        g.fillRect(0, 0, out.width, out.height);
        g.drawImage(img2, 0, 0);
        let chosen = png;
        for (const q of [0.92, 0.85, 0.75, 0.6, 0.5]) {
          const candidate = out.toDataURL('image/jpeg', q);
          chosen = candidate;
          if (candidate.length <= MAX_INLINE_BYTES * 1.4) break;
        }
        onApply(chosen);
      };
      img2.onerror = () => { onApply(png); };
      img2.src = png;
    } catch (err) {
      toast(`edit failed: ${err instanceof Error ? err.message : 'unknown'}`, 'warn');
      setBusy(false);
    }
  };

  const handles: { id: string; cls: string }[] = [
    { id: 'nw', cls: '-top-1 -left-1 cursor-nwse-resize' },
    { id: 'ne', cls: '-top-1 -right-1 cursor-nesw-resize' },
    { id: 'sw', cls: '-bottom-1 -left-1 cursor-nesw-resize' },
    { id: 'se', cls: '-bottom-1 -right-1 cursor-nwse-resize' },
  ];
  const edges: { id: string; cls: string }[] = [
    { id: 'n', cls: '-top-1 left-1/2 -translate-x-1/2 w-10 h-2 cursor-ns-resize' },
    { id: 's', cls: '-bottom-1 left-1/2 -translate-x-1/2 w-10 h-2 cursor-ns-resize' },
    { id: 'w', cls: '-left-1 top-1/2 -translate-y-1/2 w-2 h-10 cursor-ew-resize' },
    { id: 'e', cls: '-right-1 top-1/2 -translate-y-1/2 w-2 h-10 cursor-ew-resize' },
  ];

  const cropOut = crop && img
    ? `${Math.round(crop.w / fitRef.current.scale)} × ${Math.round(crop.h / fitRef.current.scale)} px → ${Math.round((crop.w / fitRef.current.scale) * (scalePct / 100))} × ${Math.round((crop.h / fitRef.current.scale) * (scalePct / 100))} px`
    : '—';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6" onPointerDown={(e) => e.stopPropagation()}>
      <div className="w-full max-w-[880px] max-h-[94vh] overflow-y-auto rounded-2xl border border-teal-ice/30 bg-[#070b16]/95 shadow-2xl">
        {/* header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2.5 border-b border-line/40 bg-[#070b16]/95 backdrop-blur">
          <div className="min-w-0">
            <div className="font-display text-[13px] tracking-[0.12em] text-paper uppercase truncate">Attachment Editor</div>
            <div className="font-mono text-[8.5px] text-slate-dim tracking-[0.18em] uppercase truncate">{name}</div>
          </div>
          <button onClick={onCancel} className="text-slate-dim hover:text-paper px-2 text-lg leading-none">×</button>
        </div>

        {failed || payloadTimeout ? (
          <div className="p-10 text-center font-mono text-xs text-red-300">
            this attachment's image data could not be loaded (payload missing or unreadable)
          </div>
        ) : !img ? (
          <div className="p-16 text-center font-mono text-xs text-slate-dim animate-pulse">
            {src ? 'loading image…' : 'loading payload from the vault…'}
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row">
            {/* preview + crop surface */}
            <div
              ref={stageRef}
              className="relative flex-1 min-w-0 p-3 flex items-center justify-center bg-black/40 select-none"
              onPointerMove={onHandleMove}
              onPointerUp={onHandleUp}
              onPointerDown={onHandleDown('new')}
            >
              <div className="relative" style={{ width: box.w, height: box.h }}>
                <canvas ref={previewRef} className="absolute inset-0 rounded-lg" />
                {crop && (
                  <div
                    className="absolute border-2 border-teal-ice cursor-move"
                    style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h, boxShadow: '0 0 0 9999px rgba(2,4,10,0.55)' }}
                    onPointerDown={onHandleDown('move')}
                  >
                    {handles.map((h) => (
                      <div key={h.id} className={`absolute w-2.5 h-2.5 bg-teal-ice border border-black/60 rounded-sm ${h.cls}`}
                        onPointerDown={onHandleDown('resize', h.id)} />
                    ))}
                    {edges.map((h) => (
                      <div key={h.id} className={`absolute bg-teal-ice/70 ${h.cls}`}
                        onPointerDown={onHandleDown('resize', h.id)} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* controls */}
            <div className="w-full lg:w-56 shrink-0 border-t lg:border-t-0 lg:border-l border-line/40 p-3 space-y-3 font-mono text-[10px]">
              <div>
                <div className="text-slate-dim tracking-[0.2em] uppercase mb-1">crop ratio</div>
                <div className="grid grid-cols-4 gap-1">
                  {(['free', '1:1', '4:3', '16:9'] as Aspect[]).map((a) => (
                    <button key={a} onClick={() => applyAspect(a)}
                      className={`px-1 py-1 rounded border ${aspect === a ? 'bg-teal-ice/20 border-teal-ice/50 text-teal-ice' : 'bg-white/5 border-white/10 text-slate-dim hover:text-paper'}`}>
                      {a}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const { scale, dx, dy } = fitRef.current;
                    setCrop({ x: dx, y: dy, w: transformed.w * scale, h: transformed.h * scale });
                  }}
                  className="mt-1 w-full px-1 py-1 rounded bg-white/5 border border-white/10 text-slate-dim hover:text-paper">
                  reset crop frame
                </button>
              </div>

              <div>
                <div className="text-slate-dim tracking-[0.2em] uppercase mb-1">rotate & flip</div>
                <div className="grid grid-cols-4 gap-1">
                  <button onClick={() => setRot90((r) => (r + 270) % 360)} className="px-1 py-1 rounded bg-white/5 border border-white/10 text-slate-dim hover:text-paper">⟲</button>
                  <button onClick={() => setRot90((r) => (r + 90) % 360)} className="px-1 py-1 rounded bg-white/5 border border-white/10 text-slate-dim hover:text-paper">⟳</button>
                  <button onClick={() => setFlipH((f) => !f)} className={`px-1 py-1 rounded border ${flipH ? 'bg-solar/20 border-solar/50 text-solar' : 'bg-white/5 border-white/10 text-slate-dim hover:text-paper'}`}>⇄</button>
                  <button onClick={() => setFlipV((f) => !f)} className={`px-1 py-1 rounded border ${flipV ? 'bg-solar/20 border-solar/50 text-solar' : 'bg-white/5 border-white/10 text-slate-dim hover:text-paper'}`}>⇅</button>
                </div>
                <label className="block mt-1.5 text-slate-dim">straighten {fineRot}°
                  <input type="range" min={-15} max={15} step={0.5} value={fineRot}
                    onChange={(e) => setFineRot(Number(e.target.value))}
                    className="w-full accent-teal-ice" />
                </label>
              </div>

              <div>
                <div className="text-slate-dim tracking-[0.2em] uppercase mb-1">light & color</div>
                <label className="block text-slate-dim">brightness {brightness}%
                  <input type="range" min={30} max={180} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full accent-solar" />
                </label>
                <label className="block text-slate-dim">contrast {contrast}%
                  <input type="range" min={30} max={180} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="w-full accent-solar" />
                </label>
                <label className="block text-slate-dim">saturation {saturation}%
                  <input type="range" min={0} max={220} value={saturation} onChange={(e) => setSaturation(Number(e.target.value))} className="w-full accent-solar" />
                </label>
                <button onClick={() => { setBrightness(100); setContrast(100); setSaturation(100); }}
                  className="mt-1 w-full px-1 py-1 rounded bg-white/5 border border-white/10 text-slate-dim hover:text-paper">
                  reset light
                </button>
              </div>

              <div>
                <div className="text-slate-dim tracking-[0.2em] uppercase mb-1">output scale</div>
                <label className="block text-slate-dim">{scalePct}%
                  <input type="range" min={10} max={200} step={5} value={scalePct} onChange={(e) => setScalePct(Number(e.target.value))} className="w-full accent-teal-ice" />
                </label>
                <div className="text-[9px] text-slate-dim/70 mt-1">{cropOut}</div>
              </div>
            </div>
          </div>
        )}

        {/* sticky action bar — Apply is ALWAYS reachable, whatever the screen */}
        {img && !failed && (
          <div className="sticky bottom-0 z-10 flex items-center justify-between gap-2 px-4 py-2.5 border-t border-line/40 bg-[#070b16]/95 backdrop-blur">
            <span className="font-mono text-[9px] text-slate-dim truncate">{cropOut}</span>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={onCancel}
                className="px-3 py-1.5 rounded bg-white/5 border border-white/10 text-slate-dim hover:text-paper font-mono text-[10px]">
                cancel
              </button>
              <button onClick={handleApply} disabled={busy || !crop}
                className="px-4 py-1.5 rounded bg-teal-ice/25 border border-teal-ice/50 text-teal-ice hover:bg-teal-ice/35 disabled:opacity-40 font-mono text-[10px]">
                {busy ? 'applying…' : 'apply changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

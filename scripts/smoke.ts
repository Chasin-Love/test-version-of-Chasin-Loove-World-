/* R52 HEADLESS SMOKE GATE — the runtime regression net for the architecture pass.
   Run:        npx tsx scripts/smoke.ts               (compare against the reference frame)
   Capture:    npx tsx scripts/smoke.ts --capture     (write/refresh the reference frame)

   What it proves per run:
   1. the app BOOTS headless with ZERO console errors / page errors;
   2. the geodesic black hole still renders the R20.4 reference look — the boot
      sequence is driven exactly as a user would (v → cinematic focus), the frame
      is polled until the hole's bright band actually lands center-frame (fixed
      sleeps are too fragile across boot timings), the engine is paused, and the
      final frame is compared against scripts/verify/reference-hole.png via
      downsampled mean-absolute-difference + shadow/bright/mean luminance bands
      (animated-scene tolerant, structural-regression sensitive: a missing disk
      halo, a donut shadow or a dead raymarch tier all fail loudly).

   Reuses a healthy server on :3000 if one is running; otherwise spawns
   `npm run dev` and tears it down afterwards. */

import { chromium } from 'playwright';
import { spawn, type ChildProcess } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
/* SMOKE_PORT lets a second checkout verify on its own port (the spawned
   server honors PORT too) while :3000 stays the default contract. */
const PORT = Number(process.env.SMOKE_PORT) || 3000;
const BASE = `http://127.0.0.1:${PORT}`;
const VERIFY_DIR = path.join(ROOT, 'scripts/verify');
const REFERENCE = path.join(VERIFY_DIR, 'reference-hole.png');
const METRICS = path.join(VERIFY_DIR, 'reference-metrics.json');

/* thresholds tuned at the Phase 0 capture; widen only with a captured rationale.
   histL1 is the primary gate — the disk turbulence pattern free-runs until the
   pause, so raw pixel MAE varies wildly between boots at identical structure. */
const MAX_HIST_L1 = 0.12;        // 16-bin luminance histogram L1 distance
const MAX_SHADOW_DELTA = 0.08;   // central shadow luminance band vs reference
const MAX_MEAN_DELTA = 0.04;     // whole-frame luminance band vs reference
const MAX_BRIGHT_DELTA = 0.06;   // central bright-pixel fraction (the white band) vs reference
const SETTLE_TIMEOUT_MS = 40_000;

interface FrameMetrics { mae: number; shadow: number; mean: number; bright: number }

async function serverHealthy(): Promise<boolean> {
  try {
    const res = await fetch(BASE + '/api/health', { signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch { return false; }
}

async function ensureServer(): Promise<ChildProcess | null> {
  if (await serverHealthy()) return null;
  const proc = spawn('npm run dev', { cwd: ROOT, shell: true, stdio: 'ignore', detached: false });
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    if (await serverHealthy()) return proc;
  }
  throw new Error('dev server did not become healthy within 90s');
}

function killServer(proc: ChildProcess): void {
  if (!proc.pid) return;
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { shell: true, stdio: 'ignore' });
  else proc.kill('SIGTERM');
}

/* pixel analysis runs inside the page (zero extra deps): downscale to 64×36 on a
   canvas, then compare + measure luminance bands. Passed as STRING expressions —
   tsx/esbuild rewrites function literals with a __name helper that does not
   exist in the page context, and string-expression args are inlined via JSON. */
const ANALYZE_FN = `
(async ([refData, shotData]) => {
  const load = (data) => new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = 'data:image/png;base64,' + data; });
  const down = (img) => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 36;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, 64, 36);
    return g.getImageData(0, 0, 64, 36).data;
  };
  const lum = (d, x0, x1, y0, y1) => {
    let s = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * 64 + x) * 4; s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++;
    }
    return s / n / 255;
  };
  const brightFrac = (d, x0, x1, y0, y1) => {
    let n = 0, b = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * 64 + x) * 4;
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      n++; if (l > 128) b++;
    }
    return b / n;
  };
  const [refImg, shotImg] = await Promise.all([refData ? load(refData) : null, load(shotData)]);
  const shot = down(shotImg);
  const shadow = lum(shot, 24, 40, 13, 23);   // central band — shadow + the crossing disk band
  const mean = lum(shot, 0, 64, 0, 36);
  const bright = brightFrac(shot, 20, 44, 10, 26);
  /* 16-bin luminance histogram — invariant to the free-running turbulence phase
     (which shifts streaks around) but sensitive to structural breaks (a missing
     halo or a dead raymarch tier moves huge mass between bins) */
  const hist = (d) => {
    const h = new Array(16).fill(0); let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      h[Math.min(15, Math.floor(l / 16))]++; n++;
    }
    return h.map((c) => c / n);
  };
  const shotHist = hist(shot);
  if (!refImg) return { mae: 0, shadow, mean, bright, hist: shotHist, histL1: 0 };
  const ref = down(refImg);
  let acc = 0;
  for (let i = 0; i < shot.length; i += 4) {
    acc += Math.abs(shot[i] - ref[i]) + Math.abs(shot[i + 1] - ref[i + 1]) + Math.abs(shot[i + 2] - ref[i + 2]);
  }
  const mae = acc / ((shot.length / 4) * 3) / 255;
  const refHist = hist(ref);
  const histL1 = refHist.reduce((s, v, i) => s + Math.abs(v - shotHist[i]), 0) / 2;
  return {
    mae, shadow, mean, bright, hist: shotHist, histL1,
    refShadow: lum(ref, 24, 40, 13, 23), refMean: lum(ref, 0, 64, 0, 36), refBright: brightFrac(ref, 20, 44, 10, 26),
  };
})`;

type Analysis = FrameMetrics & { hist: number[]; histL1: number; refShadow?: number; refMean?: number; refBright?: number };

async function analyze(page: import('playwright').Page, refB64: string | null, shotB64: string): Promise<Analysis> {
  /* args are JSON-inlined into the expression — string expressions don't receive evaluate()'s arg */
  return page.evaluate(`(${ANALYZE_FN})(${JSON.stringify([refB64, shotB64])})`) as Promise<Analysis>;
}

async function main(): Promise<void> {
  const capture = process.argv.includes('--capture');
  const serverProc = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors: string[] = [];
  let ok = false;
  try {
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      /* headless Chromium has no audio device — this is environment noise, not an app defect */
      if (m.text().includes('AudioContext')) return;
      errors.push(`[console.error] ${m.text()}`);
    });
    page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction('Boolean(window.__ENGINE__)', undefined, { timeout: 60_000 });
    await page.waitForTimeout(3_500);                       // scene warm-up
    await page.mouse.click(150, 640);                       // focus the document (empty space)
    await page.keyboard.press('v');                         // focus the Eventide hole (R20.2 framing)
    /* set orbit and zoom target to whole-hole reference composition in one step */
    await page.evaluate(`(() => {
      const e = window.__ENGINE__;
      if (e && e.rig) {
        if (e.rig.setOrbit) e.rig.setOrbit(0.9, null);
        if (e.rig.setZoomTarget) e.rig.setZoomTarget(0.26);
      }
    })()`);

    /* deterministic settle: poll the rig until the focus flight actually reached
       its targets (zoomT/phi/theta within ε of tZoomT/tPhi/tTheta) */
    const RIG_SETTLED = `(() => { const e = window.__ENGINE__; if (!e || !e.rig) return false; const r = e.rig;
      return Math.abs(r.zoomT - r.tZoomT) < 0.003 && Math.abs(r.phi - r.tPhi) < 0.003 && Math.abs(r.theta - r.tTheta) < 0.003; })()`;
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    let settled = false;
    while (Date.now() < deadline) {
      await page.waitForTimeout(500);
      if (await page.evaluate(RIG_SETTLED)) { settled = true; break; }
    }
    if (!settled) throw new Error(`camera flight never settled within ${SETTLE_TIMEOUT_MS / 1000}s`);
    await page.waitForTimeout(1_000);                       // render catch-up

    await page.evaluate(`(() => { const e = window.__ENGINE__; if (e && typeof e.setPaused === 'function') e.setPaused(true); })()`);
    await page.waitForTimeout(800);                         // let the paused frame flush
    const shot = await page.screenshot();
    const shotB64 = shot.toString('base64');

    if (capture) {
      mkdirSync(VERIFY_DIR, { recursive: true });
      writeFileSync(REFERENCE, shot);
      const m = await analyze(page, null, shotB64);
      writeFileSync(METRICS, JSON.stringify({ shadow: m.shadow, mean: m.mean, bright: m.bright, capturedAt: new Date().toISOString() }, null, 2) + '\n');
      console.log(`SMOKE CAPTURE — reference frame written (${shot.length} bytes)`);
      console.log(`  shadow ${m.shadow.toFixed(3)} · frame mean ${m.mean.toFixed(3)} · central bright ${m.bright.toFixed(3)}`);
      ok = true;
    } else {
      if (!existsSync(REFERENCE)) throw new Error('no reference frame — run: npx tsx scripts/smoke.ts --capture');
      const ref = readFileSync(REFERENCE);
      const m = await analyze(page, ref.toString('base64'), shotB64);
      console.log(`SMOKE FRAME — histL1 ${m.histL1.toFixed(4)} (max ${MAX_HIST_L1}) · shadow ${m.shadow.toFixed(3)} vs ${m.refShadow?.toFixed(3)} · mean ${m.mean.toFixed(3)} vs ${m.refMean?.toFixed(3)} · bright ${m.bright.toFixed(3)} vs ${m.refBright?.toFixed(3)} · (mae ${m.mae.toFixed(3)} informational)`);
      const histOk = m.histL1 <= MAX_HIST_L1;
      const shadowOk = m.refShadow === undefined || Math.abs(m.shadow - m.refShadow) <= MAX_SHADOW_DELTA;
      const meanOk = m.refMean === undefined || Math.abs(m.mean - m.refMean) <= MAX_MEAN_DELTA;
      const brightOk = m.refBright === undefined || Math.abs(m.bright - m.refBright) <= MAX_BRIGHT_DELTA;
      if (!histOk) errors.push(`[frame] luminance histogram L1 ${m.histL1.toFixed(4)} > ${MAX_HIST_L1} — the black hole frame drifted structurally`);
      if (!shadowOk) errors.push('[frame] shadow luminance off band — shadow lost or bloated');
      if (!meanOk) errors.push('[frame] whole-frame luminance off band — scene composition changed');
      if (!brightOk) errors.push('[frame] central bright-band fraction off — disk halo or photon ring missing');
      ok = histOk && shadowOk && meanOk && brightOk;
    }

    if (errors.length) {
      console.error(`\n● SMOKE RED — ${errors.length} problem(s):`);
      for (const e of errors.slice(0, 20)) console.error('  ' + e);
      process.exitCode = 1;
    } else if (ok) {
      console.log('\n● SMOKE GREEN — clean boot, zero console errors, reference frame matches');
    }
  } catch (err) {
    console.error('\n● SMOKE RED —', err instanceof Error ? err.message : String(err));
    if (errors.length) console.error(errors.slice(0, 20).map((e) => '  ' + e).join('\n'));
    process.exitCode = 1;
  } finally {
    await browser.close();
    if (serverProc) killServer(serverProc);
  }
}

main();

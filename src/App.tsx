import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { InnerWorldInfo, UniverseEngine } from './engine/engine';
import { actions, getState, newId, hydrateDesktopSnapshot } from './state';
import { MEANING_LABEL, type CosmicBody, type Meaning } from './types';
import { chime, initAudio, isMuted, setAudioMode, toggleMute } from './audio';
import type { WinRect } from './ui/DiaryWindow';
import { PhysicsHUD } from './ui/PhysicsHUD';
import { ErrorBoundary, IcLink, ToastHost, useUniverse } from './ui/bits';
import { toast } from './ui/toast';
import { perfMark } from './performance';
import { MultiverseBar } from './components/hud/MultiverseBar';
import { RealityHoverCard } from './components/hud/RealityHoverCard';
import { ClusterHoverCard } from './components/hud/ClusterHoverCard';

import { CosmicWebHUD, type CosmicWebSettings } from './components/hud/CosmicWebHUD';
const DiaryWindow = lazy(() => import('./ui/DiaryWindow'));
const CoreMode = lazy(() => import('./ui/CoreMode'));
const VaultUI = lazy(() => import('./ui/VaultUI'));
const CosmicLineageModal = lazy(() => import('./components/lineage/CosmicLineageModal').then((module) => ({ default: module.CosmicLineageModal })));
const CoreConsole = lazy(() => import('./components/console/CoreConsole').then((module) => ({ default: module.CoreConsole })));
const RealityAdvancedModal = lazy(() => import('./components/realities/RealityAdvancedModal').then((module) => ({ default: module.RealityAdvancedModal })));
import { GalaxyHoverCard } from './components/hud/GalaxyHoverCard';
import { getReality, type RealityConfig, type GalaxyClusterData, type GalaxyData } from './realities';

interface Win { key: string; planetId: string; rect: WinRect; minimized: boolean; maximized?: boolean }

/* when maximized, the diary fills the viewport edge-to-edge (with a slim margin) */
const MAX_RECT = (): WinRect => ({ x: 12, y: 12, w: window.innerWidth - 24, h: window.innerHeight - 24 });

/* bump on every shipped build — lets you confirm the running bundle is current */
export const BUILD = 'R28';

const MEANINGS: Meaning[] = ['memory', 'idea', 'person', 'dream', 'project', 'moment', 'unresolved', 'chapter'];

function AsyncOverlay({ label = 'LOADING' }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-200 grid place-items-center bg-void/80 backdrop-blur-sm pointer-events-none">
      <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-teal-ice/80 animate-pulse">{label}</span>
    </div>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<UniverseEngine | null>(null);
  const state = useUniverse();

  const [mode, setMode] = useState<'space' | 'core' | 'vault'>('space');
  const modeRef = useRef(mode);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverRealityId, setHoverRealityId] = useState<string | null>(null);
  const [hoverCluster, setHoverCluster] = useState<GalaxyClusterData | null>(null);
  const [hoverGalaxy, setHoverGalaxy] = useState<{ galaxy: GalaxyData; realityName: string } | null>(null);
  const [hoverScreenPos, setHoverScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [activeLineageCluster, setActiveLineageCluster] = useState<GalaxyClusterData | null>(null);
  const [lineageGalaxy, setLineageGalaxy] = useState<{ galaxy: GalaxyData; realityName: string } | null>(null);
  /* the advanced reality editor (double-click a reality ring) */
  const [advancedReality, setAdvancedReality] = useState<{ realityId: string; focusGalaxyId: string | null } | null>(null);
  /* the Multiverse Core Console (click the Astral Core) */
  const [coreConsoleOpen, setCoreConsoleOpen] = useState(false);
  /* the galaxy the traveler is currently inside (drives the toolbar chip) */
  const [activeGalaxyId, setActiveGalaxyId] = useState<string | null>(null);
  const [selectId, setSelectId] = useState<string | null>(null);
  /* a clicked world inside an isolated galaxy's stellar system */
  const [innerWorld, setInnerWorld] = useState<InnerWorldInfo | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [label, setLabel] = useState('PLANETARY SYSTEM');
  const [clock, setClock] = useState(() => new Date());
  const [paused, setPaused] = useState(false);
  const [showPhysics, setShowPhysics] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [idle, setIdle] = useState(false);
  const [wins, setWins] = useState<Win[]>([]);
  const [zTop, setZTop] = useState(0);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [entered, setEntered] = useState<string | null>(null);
  const [intro, setIntro] = useState(true);
  const [cosmicSettings, setCosmicSettings] = useState<CosmicWebSettings>({
    mode: 'simulation',
    showMatterDensity: true,
    showDarkMatterHalos: true,
    showFilaments: true,
    showVoidBoundaries: true,
    showClusterMass: true,
    showRedshift: true,
    showCoordinates: true,
  });
  const [showMultiverseBar, setShowMultiverseBar] = useState(false);
  const [kamuiKey, setKamuiKey] = useState(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    /* keep in sync with .intro-veil / .intro-track / .intro-sub (4.4s in index.css) */
    const t = setTimeout(() => setIntro(false), 4400);
    return () => clearTimeout(t);
  }, []);

  /* announce the running build so you can confirm the bundle is current */
  useEffect(() => {
    console.log(`%c✦ MY UNIVERSE — build ${BUILD}`, 'color:#f2c178;font-weight:bold');
  }, []);

  /* desktop boot hydrate: adopt the authoritative state file (may reload once) */
  useEffect(() => {
    void hydrateDesktopSnapshot();
  }, []);

  /* real local time, ticking */
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const clockDate = useMemo(
    () => clock.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }),
    [clock],
  );
  const clockTime = useMemo(() => clock.toLocaleTimeString(undefined, { hour12: false }), [clock]);

  const bodyOf = useCallback((id: string | null) =>
    (id ? state.bodies.find((b) => b.id === id) ?? engineRef.current?.getInnerBody(id) ?? null : null), [state.bodies]);

  /* ---------------------------- engine boot ---------------------------- */
  useEffect(() => {
    if (!canvasRef.current || engineRef.current) return;
    let cancelled = false;
    let loadedEngine: UniverseEngine | null = null;
    let boot: (() => void) | null = null;
    void import('./engine/engine').then(({ UniverseEngine }) => {
      if (cancelled || !canvasRef.current || engineRef.current) return;
      const engine = new UniverseEngine(canvasRef.current, getState().bodies, {
      onHover: (id, x, y) => {
        /* a fresh hover cancels any pending sticky-clear */
        if (id && hoverClearTimer.current) { clearTimeout(hoverClearTimer.current); hoverClearTimer.current = null; }
        setHoverId(id);
        if (id && id.startsWith('cluster:')) {
          const parts = id.split(':');
          const clusterId = parts[1];
          const rId = parts[2];
          const r = getReality(rId, getState().customRealityDescriptions);
          const cl = r.clusters?.find((c) => c.id === clusterId) ?? null;
          setHoverCluster(cl);
          setHoverRealityId(null);
          setHoverGalaxy(null);
          if (x !== undefined && y !== undefined) {
            setHoverScreenPos({ x, y });
          }
        } else if (id && id.startsWith('reality:')) {
          const rId = id.replace('reality:', '');
          setHoverRealityId(rId);
          setHoverCluster(null);
          setHoverGalaxy(null);
          if (x !== undefined && y !== undefined) {
            setHoverScreenPos({ x, y });
          }
        } else if (id && id.startsWith('galaxy:')) {
          const parts = id.split(':');
          const gid = parts[1];
          const rId = parts.slice(2).join(':');
          const r = getReality(rId, getState().customRealityDescriptions);
          const gal = r.galaxies?.find((g) => g.id === gid) ?? null;
          setHoverGalaxy(gal ? { galaxy: gal, realityName: r.name } : null);
          setHoverRealityId(null);
          setHoverCluster(null);
          if (x !== undefined && y !== undefined) {
            setHoverScreenPos({ x, y });
          }
        } else {
          /* sticky hover — the card lingers ~550ms after the pointer leaves
             its object, so reaching the card's own buttons never races the
             unmount (a plain hover-out used to kill the card mid-click) */
          if (hoverClearTimer.current) clearTimeout(hoverClearTimer.current);
          hoverClearTimer.current = setTimeout(() => {
            setHoverRealityId(null);
            setHoverCluster(null);
            setHoverGalaxy(null);
            setHoverScreenPos(null);
          }, 550);
        }
      },
      onSelect: (id) => { setSelectId(id); if (id) setInnerWorld(null); },
      onSelectInnerWorld: (info) => {
        setInnerWorld(info);
        if (info) chime(680);
      },
      onSelectCluster: (cluster) => {
        setActiveLineageCluster(cluster);
        chime(720);
      },
      onActivate: (id) => {
        if (id === 'anchor') {
          engine.enterCoreMode();
          engine.setConnections(getState().connections.map((c) => [c.a, c.b] as [string, string]));
          setMode('core');
          setAudioMode('core');
          chime(440);
        }
      },
      onPortalPeak: (kind, id) => {
        engine.finishEntry();
        chime(kind === 'vault' ? 520 : 660);
        if (kind === 'vault') {
          setMode('vault');
          setAudioMode('vault');
        } else {
          setEntered(id);
          setAudioMode('diary');
          setWins((cur) => {
            const existing = cur.find((w) => w.planetId === id);
            if (existing) {
              queueMicrotask(() => { setFocusKey(existing.key); setZTop((z) => z + 1); });
              return cur.map((w) => (w.planetId === id ? { ...w, minimized: false } : w));
            }
            const key = newId();
            const n = cur.length;
            queueMicrotask(() => { setFocusKey(key); setZTop((z) => z + 1); });
            return [...cur, {
              key, planetId: id, minimized: false,
              rect: { x: 90 + n * 44, y: 70 + n * 34, w: Math.min(680, window.innerWidth - 200), h: Math.min(520, window.innerHeight - 170) },
            }];
          });
        }
      },
      onPortalDone: () => undefined,
      onContext: (id, x, y) => setMenu({ id, x, y }),
      onScaleLabel: (l) => setLabel(l),
      onSimDate: () => undefined,
      onSelectReality: (realityId) => {
        actions.switchReality(realityId);
        const r = getReality(realityId, getState().customRealityDescriptions);
        toast(`Quantum Warp: Traveled into Reality — ${r.name}`);
        chime(880);
        engineRef.current?.resetView();
      },
      onDoubleClickReality: (realityId) => {
        setAdvancedReality({ realityId, focusGalaxyId: null });
        chime(520);
      },
      onSelectGalaxy: (galaxyId, realityId) => {
        const r = getReality(realityId, getState().customRealityDescriptions);
        const gal = r.galaxies?.find((g) => g.id === galaxyId);
        if (!gal) return;
        /* entering another reality's galaxy carries the dimensional barrier over */
        if ((getState().activeRealityId || 'sol-prime') !== realityId) {
          actions.switchReality(realityId);
          toast(`Quantum Warp: Traveled into Reality — ${r.name}`);
          chime(880);
        }
        setActiveGalaxyId(galaxyId);
        engineRef.current?.enterGalaxy(realityId, galaxyId);
        toast(`⌖ ${gal.name} — ${r.name}`);
        chime(760);
      },
      onSelectCore: () => {
        setCoreConsoleOpen(true);
        chime(960);
        toast('✦ Multiverse Core Console online');
      },
      onSelectDemonCore: () => {
        setKamuiKey((k) => k + 1);
        setShowMultiverseBar(true);
        toast('✦ Kamui: Core Activated');
        chime(960);
      },
    });
      engineRef.current = engine;
      /* The engine is loaded asynchronously, so the one-time reality-sync
         effect may have already run before engineRef was assigned. Initialize
         the active reality here as well; this builds the galaxy-stage roster
         and gives Kamui a valid reality target on the first interaction. */
      const initialState = getState();
      engine.setReality(getReality(initialState.activeRealityId || 'sol-prime', initialState.customRealityDescriptions));
      engine.setRendering(modeRef.current !== 'vault');
      loadedEngine = engine;
      perfMark('engine-ready');
      (window as any).__ENGINE__ = engine;

      boot = () => { initAudio(); if (boot) window.removeEventListener('pointerdown', boot); };
      window.addEventListener('pointerdown', boot);
    });
    return () => {
      cancelled = true;
      if (boot) window.removeEventListener('pointerdown', boot);
      loadedEngine?.dispose();
      engineRef.current = null;
    };
  }, []);

  /* while the vault's own glass scene covers the screen, stop the heavy
     universe composer from drawing a scene nobody can see — kills the lag */
  useEffect(() => {
    engineRef.current?.setRendering(mode !== 'vault');
    return () => { engineRef.current?.setRendering(true); };
  }, [mode]);

  /* ------------------------------ keyboard ------------------------------ */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
      const eng = engineRef.current;
      if (!eng) return;
      if (e.key === '?') { setShowKeys((v) => !v); return; }
      if (e.key === 'Escape') {
        if (menu) setMenu(null);
        else if (showKeys) setShowKeys(false);
        else if (mode === 'core') closeCore();
        else if (mode === 'vault') closeVault();
        return;
      }
      if (e.key === 'h' || e.key === 'H') { eng.resetView(); setMode('space'); eng.exitCoreMode(); toast('returning home'); }
      if (e.key === 'c' || e.key === 'C') {
        if (mode === 'core') closeCore();
        else { eng.enterCoreMode(); eng.setConnections(getState().connections.map((c) => [c.a, c.b] as [string, string])); setMode('core'); setAudioMode('core'); }
      }
      if (e.key === 'v' || e.key === 'V') { if (mode === 'space') eng.focusOn('eventide'); }
      if (e.key === 'm' || e.key === 'M') { const m = toggleMute(); toast(m ? 'silence — the universe mutes' : 'the hum returns'); }
      if (e.key === ' ') { e.preventDefault(); eng.setPaused(!eng.pausedNow); setPaused(eng.pausedNow); toast(paused ? 'time flows' : 'time held'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, menu, showKeys, paused]);

  /* idle chrome fade */
  useEffect(() => {
    const wake = () => {
      setIdle(false);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setIdle(true), 6500);
    };
    window.addEventListener('pointermove', wake);
    window.addEventListener('keydown', wake);
    wake();
    return () => {
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('keydown', wake);
    };
  }, []);

  /* keep connection lines fresh while core is open */
  useEffect(() => {
    if (mode === 'core' && engineRef.current) {
      engineRef.current.setConnections(state.connections.map((c) => [c.a, c.b] as [string, string]));
    }
  }, [state.connections, mode]);

  /* sync reality and dimensional barrier when active reality shifts */
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const r = getReality(state.activeRealityId || 'sol-prime', state.customRealityDescriptions);
    eng.setReality(r);
  }, [state.activeRealityId, state.customRealityDescriptions]);

  /* EXISTENCE SYNC — the 3D multiverse is rebuilt from the live reality list
     whenever a reality or galaxy is created/edited/deleted, so the scene is
     always literal: a bubble exists iff the reality exists, an ellipse exists
     iff that galaxy exists. Deps are value signatures (the store hands out
     fresh array identities on every keystroke — identity deps would over-fire). */
  const galSig = useMemo(() => JSON.stringify(state.customGalaxies ?? {}), [state.customGalaxies]);
  const metaSig = useMemo(() => JSON.stringify(state.customRealityMeta ?? {}), [state.customRealityMeta]);
  const customIdsSig = useMemo(() => (state.customRealities ?? []).map((r) => r.id).join(','), [state.customRealities]);
  const deletedSig = useMemo(() => (state.deletedRealityIds ?? []).join(','), [state.deletedRealityIds]);
  const skipFirstRebuild = useRef(true);
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    if (skipFirstRebuild.current) { skipFirstRebuild.current = false; return; } /* constructor already built it */
    eng.rebuildMultiverse();
    const r = getReality(state.activeRealityId || 'sol-prime', state.customRealityDescriptions);
    eng.setReality(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galSig, metaSig, customIdsSig, deletedSig]);

  /* keep the living structure in sync — new worlds form, dissolved worlds vanish,
     and moons always mirror the diary pages of their planet */
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.syncBodies(state.bodies);
    eng.syncMoons(state.entries);
    eng.setConnections(state.connections.map((c) => [c.a, c.b] as [string, string]));
  }, [state.bodies, state.entries, state.connections]);

  /* close diary windows whose world has dissolved */
  useEffect(() => {
    setWins((cur) => cur.filter((w) => state.bodies.some((b) => b.id === w.planetId)));
    setEntered((cur) => (cur && !state.bodies.some((b) => b.id === cur) ? null : cur));
  }, [state.bodies]);

  /* ------------------------------ helpers ------------------------------ */

  const closeCore = useCallback(() => {
    engineRef.current?.exitCoreMode();
    engineRef.current?.setTemporal(null);
    setMode('space');
    setAudioMode('space');
  }, []);

  const closeVault = useCallback(() => {
    setMode('space');
    setAudioMode('space');
    /* Let the engine show the reverse gravitational release before it
       returns the camera to the stellar-system frame. */
    engineRef.current?.leavePortal();
  }, []);

  const closeWin = (key: string) => {
    setWins((cur) => {
      const next = cur.filter((w) => w.key !== key);
      if (next.length === 0) {
        engineRef.current?.leavePortal();
        setAudioMode('space');
        setEntered(null);
      }
      return next;
    });
  };

  const minimizeWin = (key: string) => setWins((cur) => cur.map((w) => (w.key === key ? { ...w, minimized: true } : w)));
  const restoreWin = (key: string) => {
    setWins((cur) => cur.map((w) => (w.key === key ? { ...w, minimized: false } : w)));
    setFocusKey(key);
  };
  const maximizeWin = (key: string) => setWins((cur) => cur.map((w) => (w.key === key ? { ...w, maximized: !w.maximized } : w)));

  /* open (or raise) a diary window for a world — used by constellation links */
  const openDiaryFor = useCallback((id: string) => {
    setAudioMode('diary');
    setWins((cur) => {
      const existing = cur.find((w) => w.planetId === id);
      if (existing) {
        queueMicrotask(() => { setFocusKey(existing.key); setZTop((z) => z + 1); });
        return cur.map((w) => (w.planetId === id ? { ...w, minimized: false } : w));
      }
      const key = newId();
      const n = cur.length;
      queueMicrotask(() => { setFocusKey(key); setZTop((z) => z + 1); });
      return [...cur, {
        key, planetId: id, minimized: false,
        rect: { x: 110 + n * 44, y: 84 + n * 34, w: Math.min(680, window.innerWidth - 200), h: Math.min(520, window.innerHeight - 170) },
      }];
    });
  }, []);

  const onTemporal = useCallback((ms: number | null) => {
    engineRef.current?.setTemporal(ms);
  }, []);

  const hoverBody = bodyOf(hoverId);
  const selectBody = bodyOf(selectId);
  const menuBody = bodyOf(menu?.id ?? null);

  const caption = useMemo(() => {
    if (hoverBody) {
      const m = hoverBody.meaning ? ` · ${MEANING_LABEL[hoverBody.meaning]}` : '';
      if (hoverBody.id === 'anchor') return 'ANCHOR STAR — the core · double-click to enter core mode';
      return `${hoverBody.name.toUpperCase()}${m} · double-click to enter · right-click for meaning`;
    }
    if (selectBody) return `${selectBody.name.toUpperCase()} selected · double-click to enter`;
    if (mode === 'core') return 'core mode — drag the timeline to rewind the universe · esc to leave';
    if (entered) return `${bodyOf(entered)?.name.toUpperCase()} environment — windows are physical · drag them`;
    if (paused) return 'time held — press space to release';
    return 'scroll — travel the scales · click — select · double-click — enter · ? — keys';
  }, [hoverBody, selectBody, mode, entered, paused, bodyOf]);

  /* ------------------------------- render ------------------------------- */

  return (
    <div className="fixed inset-0 overflow-hidden bg-void">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ cursor: 'grab', touchAction: 'none' }} />

      {/* ambient vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(130% 100% at 50% 45%, transparent 55%, rgba(2,4,9,0.5) 100%)' }} />

      {/* opening veil — absolute darkness, the name, then a smooth fade home */}
      {intro && (
        <div className="intro-veil fixed inset-0 z-35 pointer-events-none flex flex-col items-center justify-center" style={{ background: '#04060c' }}>
          <div className="intro-track font-display font-medium text-paper/90 text-[clamp(20px,3.4vw,34px)]" style={{ letterSpacing: '0.5em', textIndent: '0.5em' }}>
            MY UNIVERSE
          </div>
          <div className="intro-sub mt-4 font-mono text-[9.5px] tracking-[0.34em] uppercase text-solar/70">
            a personal cosmos · scroll to travel · double-click to enter
          </div>
        </div>
      )}

      {/* wordmark + scale */}
      <div className={`chrome absolute top-5 left-6 pointer-events-none ${idle ? 'idle' : ''}`}>
        <div className="wordmark text-[13px] text-paper/85">MY&nbsp;UNIVERSE</div>
        <div className="font-mono text-[9px] tracking-[0.3em] text-solar/70 mt-1.5">{label}</div>
      </div>

      {/* local time */}
      <div className={`chrome absolute top-5 right-6 text-right pointer-events-none ${idle ? 'idle' : ''}`}>
        <div className="font-mono text-[11px] tracking-[0.22em] text-slate-soft tabular-nums">{clockTime}</div>
        <div className="font-mono text-[8.5px] tracking-[0.22em] text-slate-dim mt-1 tabular-nums">{clockDate}</div>
        <div className="font-mono text-[7.5px] tracking-[0.26em] text-slate-dim/70 mt-1">
          LOCAL TIME{paused ? ' · EPHEMERIS HELD' : ''}{isMuted() ? ' · MUTED' : ''}
        </div>
      </div>

      {/* caption container removed per user request */}

      {/* selection card */}
      {selectBody && (
        <div className="chrome absolute bottom-12 left-6 rise-in z-50" key={selectBody.id}>
          <div className="px-4 py-3 border-l-2 max-w-[320px] rounded-r-lg" style={{ borderColor: selectBody.palette.atmo, background: 'rgba(8,12,22,0.85)', backdropFilter: 'blur(6px)' }}>
            <div className="flex items-center justify-between">
              <p className="font-display text-[12px] tracking-[0.18em] text-paper">{selectBody.name.toUpperCase()}</p>
              <button
                onClick={() => setShowPhysics(!showPhysics)}
                className="font-mono text-[9px] tracking-wider uppercase px-2 py-0.5 rounded bg-teal-ice/15 hover:bg-teal-ice/30 text-teal-ice border border-teal-ice/30 transition-colors"
              >
                {showPhysics ? 'HIDE LAWS' : 'PHYSICS LAWS'}
              </button>
            </div>
            <p className="font-body text-[11px] text-slate-soft leading-relaxed mt-1">{selectBody.note}</p>
            {selectBody.meaning && (
              <p className="font-mono text-[8.5px] tracking-[0.2em] uppercase text-solar/80 mt-1.5">represents · {MEANING_LABEL[selectBody.meaning]}</p>
            )}

            {showPhysics && (
              <div className="mt-3 pointer-events-auto">
                <PhysicsHUD body={selectBody} onClose={() => setShowPhysics(false)} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* isolated inner world selection card */}
      {innerWorld && (
        <div className="chrome absolute bottom-12 left-6 rise-in z-50" key={innerWorld.body.id}>
          <div className="px-4 py-3 border-l-2 max-w-[320px] rounded-r-lg" style={{ borderColor: innerWorld.body.palette.atmo, background: 'rgba(8,12,22,0.85)', backdropFilter: 'blur(6px)' }}>
            <div className="flex items-center justify-between">
              <p className="font-display text-[12px] tracking-[0.18em] text-paper">{innerWorld.body.name.toUpperCase()}</p>
              <button
                onClick={() => setShowPhysics(!showPhysics)}
                className="font-mono text-[9px] tracking-wider uppercase px-2 py-0.5 rounded bg-teal-ice/15 hover:bg-teal-ice/30 text-teal-ice border border-teal-ice/30 transition-colors"
              >
                {showPhysics ? 'HIDE LAWS' : 'PHYSICS LAWS'}
              </button>
            </div>
            <p className="font-mono text-[8.5px] tracking-[0.2em] uppercase text-solar/80 mt-1">
              {innerWorld.galaxyName} · {innerWorld.starName} system
            </p>
            <p className="font-body text-[11px] text-slate-soft leading-relaxed mt-1">{innerWorld.body.note}</p>
            {showPhysics && (
              <div className="mt-3 pointer-events-auto">
                <PhysicsHUD body={innerWorld.body} onClose={() => setShowPhysics(false)} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* context menu */}
      {menu && menuBody && (
        <>
          <div className="fixed inset-0 z-90" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} />
          <div className="ctx-menu fixed z-95 w-54.5 py-1.5" style={{ left: Math.min(menu.x, window.innerWidth - 230), top: Math.min(menu.y, window.innerHeight - 330) }}>
            <p className="px-4 py-1.5 font-mono text-[8.5px] tracking-[0.26em] uppercase text-slate-dim">
              {menuBody.kind === 'vault' ? `${menuBody.name} — the universal vault` : `${menuBody.name} — assign meaning`}
            </p>
            <p className="px-4 pb-2 font-mono text-[7.5px] leading-relaxed text-slate-dim/85">
              The colored chip is this world's <span className="text-solar/80">meaning</span> — what it represents to you.
              {selectId && selectId !== menuBody.id && selectId !== 'anchor' && menuBody.kind !== 'vault'
                ? <> Linking ties it to <span className="text-paper/70">{bodyOf(selectId)?.name}</span> as a constellation — drawn in the Anchor core.</>
                : ' Single-click another world first to enable “link”.'}
            </p>
            {menuBody.kind !== 'vault' && MEANINGS.map((m) => (
              <button key={m ?? 'x'} className="ctx-item w-full text-left px-4 py-1.75 text-[12px] text-slate-soft flex items-center justify-between"
                onClick={() => { actions.setMeaning(menuBody.id, m); setMenu(null); toast(`${menuBody.name} now represents: ${MEANING_LABEL[m!]}`); }}>
                {MEANING_LABEL[m!]}
                {menuBody.meaning === m && <span className="text-solar">·</span>}
              </button>
            ))}
            <div className="h-px bg-line/70 my-1.5" />
            <button className="ctx-item w-full text-left px-4 py-1.75 text-[12px] text-slate-soft flex items-center gap-2"
              onClick={() => {
                if (selectId && selectId !== menuBody.id && selectId !== 'anchor') {
                  actions.connect(selectId, menuBody.id);
                  toast('a new constellation is born');
                  if (mode === 'core') engineRef.current?.setConnections(getState().connections.map((c) => [c.a, c.b] as [string, string]));
                } else toast('select another body first, then link', 'warn');
                setMenu(null);
              }}>
              <IcLink size={11} /> link with selected
            </button>
            <button className="ctx-item w-full text-left px-4 py-1.75 text-[12px] text-teal-ice flex items-center gap-2"
              onClick={() => { setSelectId(menuBody.id); setShowPhysics(true); setMenu(null); }}>
              <span>✦</span> physics telemetry & laws
            </button>
            <button className="ctx-item w-full text-left px-4 py-1.75 text-[12px] text-slate-soft"
              onClick={() => { engineRef.current?.focusOn(menuBody.id); setMenu(null); }}>
              focus camera
            </button>
            <RenameRow body={menuBody} onDone={() => setMenu(null)} />
          </div>
        </>
      )}

      {/* diary windows */}
      {wins.filter((w) => !w.minimized).map((w, i) => {
        const planet = state.bodies.find((b) => b.id === w.planetId) ?? engineRef.current?.getInnerBody(w.planetId) ?? null;
        if (!planet) return null;
        return (
          <DiaryWindowFrame key={w.key} z={zTop + i} focused={focusKey === w.key}>
            <Suspense fallback={null}>
              <ErrorBoundary label="THE DIARY">
                <DiaryWindow
                  planet={planet}
                  rect={w.maximized ? MAX_RECT() : w.rect}
                  maximized={!!w.maximized}
                  focused={focusKey === w.key}
                  onFocus={() => { setFocusKey(w.key); setZTop((z) => z + 1); }}
                  onMinimize={() => minimizeWin(w.key)}
                  onMaximize={() => maximizeWin(w.key)}
                  onClose={() => closeWin(w.key)}
                  onOpenLinked={openDiaryFor}
                />
              </ErrorBoundary>
            </Suspense>
          </DiaryWindowFrame>
        );
      })}

      {/* minimized dock */}
      {wins.some((w) => w.minimized) && (
        <div className="fixed bottom-5 right-5 z-65 flex gap-2">
          {wins.filter((w) => w.minimized).map((w) => {
            const p = state.bodies.find((b) => b.id === w.planetId);
            return (
              <button key={w.key} onClick={() => restoreWin(w.key)}
                className="rise-in flex items-center gap-2 px-3 py-1.5 border border-line bg-abyss/90 hover:border-solar/40 transition-colors">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: p?.palette.atmo }} />
                <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-slate-soft">{p?.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* core mode */}
      {mode === 'core' && (
        <Suspense fallback={<AsyncOverlay label="OPENING CORE" />}>
          <CoreMode
            onClose={closeCore}
            onInspect={(id) => { closeCore(); engineRef.current?.focusOn(id); }}
            onTemporal={onTemporal}
            onEnterWorld={(id) => { closeCore(); engineRef.current?.portalTo(id); }}
          />
        </Suspense>
      )}

      {/* vault */}
      {mode === 'vault' && (
        <Suspense fallback={<AsyncOverlay label="OPENING VAULT" />}>
          <ErrorBoundary label="THE VAULT">
            <VaultUI onClose={closeVault} />
          </ErrorBoundary>
        </Suspense>
      )}

      {/* shortcuts */}
      {showKeys && (
        <div className="fixed inset-0 z-130 flex items-center justify-center overlay-in" style={{ background: 'rgba(3,5,10,0.7)' }} onClick={() => setShowKeys(false)}>
          <div className="ctx-menu w-75 p-5 rise-in" onClick={(e) => e.stopPropagation()}>
            <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-solar/80 mb-4">hidden keys</p>
            {[
              ['H', 'return home'], ['C', 'anchor star core'], ['V', 'find the vault'],
              ['SPACE', 'hold / release time'], ['M', 'mute the hum'], ['?', 'this list'], ['ESC', 'leave'],
            ].map(([k, d]) => (
              <div key={k} className="flex items-center justify-between py-1.5 border-b border-line/40 last:border-0">
                <span className="font-mono text-[10px] text-solar">{k}</span>
                <span className="text-[11.5px] text-slate-soft">{d}</span>
              </div>
            ))}
            <div className="mt-4 pt-3 border-t border-line/50 flex flex-col items-center gap-2">
              <button
                onClick={() => {
                  if (window.confirm('Reset universe to fresh defaults? Local changes will be re-seeded.')) {
                    actions.resetUniverse();
                    setShowKeys(false);
                    toast('Universe reset to clean defaults');
                  }
                }}
                className="px-3 py-1 font-mono text-[9px] tracking-[0.16em] uppercase text-rose-300 hover:text-rose-100 border border-rose-500/30 hover:border-rose-400 bg-rose-950/20 rounded transition-colors"
              >
                Reset Universe Data
              </button>
              <p className="font-mono text-[8.5px] tracking-[0.2em] uppercase text-slate-dim/70 text-center">
                build <span className="text-teal-ice">{BUILD}</span> · active
              </p>
            </div>
          </div>
        </div>
      )}

      {showMultiverseBar && (
        <MultiverseBar
          activeRealityId={state.activeRealityId || 'sol-prime'}
          currentScaleLabel={label}
          galaxies={getReality(state.activeRealityId || 'sol-prime', state.customRealityDescriptions).galaxies ?? []}
          activeGalaxyId={activeGalaxyId}
          onEnterGalaxy={(gid) => {
            const rid = state.activeRealityId || 'sol-prime';
            const r = getReality(rid, state.customRealityDescriptions);
            const gal = r.galaxies?.find((g) => g.id === gid);
            if (!gal) return;
            setActiveGalaxyId(gid);
            engineRef.current?.enterGalaxy(rid, gid);
            toast(`⌖ Diving into ${gal.name} — ${r.name}`);
            chime(760);
          }}
          onOpenCoreConsole={() => {
            setCoreConsoleOpen(true);
            chime(960);
          }}
          onWarpReality={(id) => {
            actions.switchReality(id);
            const r = getReality(id, state.customRealityDescriptions);
            toast(`Quantum Warp: Switched to Reality ${r.name}`);
            chime(880);
            engineRef.current?.resetView();
          }}
          onZoomToMultiverse={() => {
            engineRef.current?.zoomToMultiverse();
            toast('Camera set to Multiverse Scale');
          }}
          onZoomToSystem={() => {
            engineRef.current?.zoomToSystem();
            toast('Camera focused on Stellar System');
          }}
          onZoomToHierarchy={(stageIndex) => {
            engineRef.current?.zoomToHierarchy(stageIndex);
            chime(720);
          }}
          onZoomIn={() => {
            engineRef.current?.zoomIn();
          }}
          onZoomOut={() => {
            engineRef.current?.zoomOut();
          }}
          onEditRealityLore={(r) => {
            setAdvancedReality({ realityId: r.id, focusGalaxyId: null });
          }}
          onInspectLineage={(cluster) => {
            setActiveLineageCluster(cluster);
            chime(720);
          }}
          onZoomToDemonCore={() => {
            engineRef.current?.zoomToDemonCore();
            setKamuiKey((k) => k + 1);
            toast('✦ Kamui: Focused on Core');
            chime(960);
          }}
          onTriggerKamui={() => {
            engineRef.current?.triggerKamui();
            setKamuiKey((k) => k + 1);
            chime(960);
          }}
          onCloseBar={() => {
            setShowMultiverseBar(false);
          }}
          kamuiKey={kamuiKey}
        />
      )}

      {/* Hover HUD for the Astral Core — the multiverse's living center */}
      {hoverId === 'multiverse-core' && mode === 'space' && label.includes('MULTIVERSE') && !coreConsoleOpen && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-auto bg-slate-950/85 backdrop-blur-2xl border border-cyan-400/50 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(6,182,212,0.35)] text-slate-100 max-w-md w-[92vw] sm:w-105 kamui-demon-badge">
          <div className="flex items-center justify-between border-b border-cyan-400/30 pb-2 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="demon-eye-spin inline-block w-3.5 h-3.5 rounded-full bg-linear-to-br from-cyan-300 to-violet-500 shadow-[0_0_10px_#00f5d4] ring-1 ring-white/70" />
              <h3 className="font-bold text-sm tracking-wider text-cyan-100 uppercase font-mono">THE ASTRAL CORE</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-400/40 text-cyan-300">
              ORIGIN (0, 0, 0)
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed mb-3">
            The supreme singularity anchoring every parallel reality through quantum flux resonance and space-time harmonic containment. It is the command deck of the multiverse.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCoreConsoleOpen(true);
                chime(960);
              }}
              className="flex-1 py-1.5 px-3 bg-cyan-500/30 hover:bg-cyan-500/50 border border-cyan-400/60 rounded-xl font-mono text-[11px] font-bold text-cyan-100 hover:text-white transition-all shadow-[0_0_12px_rgba(6,182,212,0.3)] cursor-pointer text-center"
            >
              ✦ OPEN CORE CONSOLE
            </button>
            <button
              onClick={() => {
                engineRef.current?.zoomToCore();
                chime(720);
              }}
              className="py-1.5 px-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-mono text-[11px] text-slate-200 hover:text-white transition-all cursor-pointer"
            >
              FRAME
            </button>
          </div>
        </div>
      )}

      {/* Hover Tooltip / HUD for Parallel Realities (Only active at Multiverse Macro Scale) */}
      {hoverRealityId && mode === 'space' && label.includes('MULTIVERSE') && !hoverGalaxy && !advancedReality && !coreConsoleOpen && !hoverCluster && !activeLineageCluster && (
        <RealityHoverCard
          reality={getReality(hoverRealityId, state.customRealityDescriptions)}
          screenPos={hoverScreenPos}
          onEditDescription={(r) => {
            setAdvancedReality({ realityId: r.id, focusGalaxyId: null });
          }}
          onWarp={(id) => {
            actions.switchReality(id);
            const r = getReality(id, state.customRealityDescriptions);
            toast(`Quantum Warp: Switched to Reality ${r.name}`);
            chime(880);
            engineRef.current?.resetView();
          }}
          onInspectLineage={(cluster) => {
            setActiveLineageCluster(cluster);
            chime(720);
          }}
        />
      )}

      {/* Hover Tooltip / HUD for a Major Galaxy — on a reality's ellipse ring
          (multiverse scale) or out in the galaxy field (galaxy scale) */}
      {hoverGalaxy && mode === 'space' && (label.includes('MULTIVERSE') || label.includes('GALAXY')) && !advancedReality && !coreConsoleOpen && !hoverCluster && !activeLineageCluster && !lineageGalaxy && (
        <GalaxyHoverCard
          galaxy={hoverGalaxy.galaxy}
          realityName={hoverGalaxy.realityName}
          screenPos={hoverScreenPos}
          onEnter={(gid, rid) => {
            const r = getReality(rid, state.customRealityDescriptions);
            const gal = r.galaxies?.find((g) => g.id === gid);
            if (!gal) return;
            if ((state.activeRealityId || 'sol-prime') !== rid) {
              actions.switchReality(rid);
              toast(`Quantum Warp: Traveled into Reality — ${r.name}`);
              chime(880);
            }
            setActiveGalaxyId(gid);
            engineRef.current?.enterGalaxy(rid, gid);
            toast(`⌖ Diving into ${gal.name} — ${r.name}`);
            chime(760);
          }}
          onEdit={(gal) => {
            setAdvancedReality({ realityId: gal.realityId, focusGalaxyId: gal.id });
          }}
          onInspectLineage={(gal) => {
            setLineageGalaxy({ galaxy: gal, realityName: hoverGalaxy.realityName });
            chime(720);
          }}
        />
      )}

      {/* Hover Tooltip / HUD for Orbiting Galaxy Clusters / Galaxy Groups (Only active at Multiverse Macro Scale) */}
      {hoverCluster && mode === 'space' && label.includes('MULTIVERSE') && !advancedReality && !coreConsoleOpen && !activeLineageCluster && (
        <ClusterHoverCard
          cluster={hoverCluster}
          realityName={getReality(hoverCluster.realityId, state.customRealityDescriptions).name}
          screenPos={hoverScreenPos}
          onInspectLineage={(cluster) => {
            setActiveLineageCluster(cluster);
            chime(720);
          }}
          onWarp={(realityId) => {
            actions.switchReality(realityId);
            const r = getReality(realityId, state.customRealityDescriptions);
            toast(`Quantum Warp: Traveled into Reality — ${r.name}`);
            chime(880);
            engineRef.current?.resetView();
          }}
        />
      )}

      {/* Deep-Dive Cosmic Lineage & Hierarchy Explorer Modal */}
      {activeLineageCluster && (
        <Suspense fallback={<AsyncOverlay label="OPENING LINEAGE" />}>
          <CosmicLineageModal
            cluster={activeLineageCluster}
            realityName={getReality(activeLineageCluster.realityId, state.customRealityDescriptions).name}
            onClose={() => setActiveLineageCluster(null)}
            onWarpToReality={(realityId) => {
              actions.switchReality(realityId);
              const r = getReality(realityId, state.customRealityDescriptions);
              toast(`Quantum Warp: Traveled into Reality — ${r.name}`);
              chime(880);
              engineRef.current?.resetView();
              setActiveLineageCluster(null);
            }}
          />
        </Suspense>
      )}

      {/* Per-galaxy lineage explorer — every major galaxy is navigable */}
      {lineageGalaxy && (
        <Suspense fallback={<AsyncOverlay label="OPENING LINEAGE" />}>
          <CosmicLineageModal
            lineageOverride={lineageGalaxy.galaxy.lineage}
            subjectLabel={lineageGalaxy.galaxy.name}
            realityName={lineageGalaxy.realityName}
            onClose={() => setLineageGalaxy(null)}
            onWarpToReality={(realityId) => {
              actions.switchReality(realityId);
              const r = getReality(realityId, state.customRealityDescriptions);
              toast(`Quantum Warp: Traveled into Reality — ${r.name}`);
              chime(880);
              engineRef.current?.resetView();
              setLineageGalaxy(null);
            }}
          />
        </Suspense>
      )}

      {/* Reality Advanced Editor — double-click a reality bubble (or its Edit buttons) */}
      {advancedReality && (
        <Suspense fallback={<AsyncOverlay label="OPENING EDITOR" />}>
          <RealityAdvancedModal
            realityId={advancedReality.realityId}
            focusGalaxyId={advancedReality.focusGalaxyId}
            onClose={() => setAdvancedReality(null)}
            onEnterGalaxy={(rid, gid) => {
            const r = getReality(rid, state.customRealityDescriptions);
            const gal = r.galaxies?.find((g) => g.id === gid);
            if (!gal) return;
            if ((state.activeRealityId || 'sol-prime') !== rid) {
              actions.switchReality(rid);
              toast(`Quantum Warp: Traveled into Reality — ${r.name}`);
              chime(880);
            }
            setActiveGalaxyId(gid);
            engineRef.current?.enterGalaxy(rid, gid);
            toast(`⌖ Diving into ${gal.name} — ${r.name}`);
              chime(760);
            }}
          />
        </Suspense>
      )}

      {/* THE MULTIVERSE CORE CONSOLE — click the Astral Core at (0,0,0) */}
      {coreConsoleOpen && (
        <Suspense fallback={<AsyncOverlay label="OPENING CORE CONSOLE" />}>
          <CoreConsole
            onClose={() => setCoreConsoleOpen(false)}
            onWarpReality={(id) => {
            actions.switchReality(id);
            const r = getReality(id, state.customRealityDescriptions);
            toast(`Quantum Warp: Switched to Reality ${r.name}`);
            chime(880);
            engineRef.current?.resetView();
          }}
          onZoomToCore={() => {
            engineRef.current?.zoomToCore();
            chime(720);
          }}
          onTriggerKamui={() => {
            engineRef.current?.triggerKamui();
            setKamuiKey((k) => k + 1);
            chime(960);
          }}
          onShowToolbar={() => {
            setKamuiKey((k) => k + 1);
            setShowMultiverseBar(true);
            setCoreConsoleOpen(false);
            toast('✦ Hierarchy toolbar summoned');
          }}
          onEnterGalaxy={(rid, gid) => {
            const r = getReality(rid, state.customRealityDescriptions);
            const gal = r.galaxies?.find((g) => g.id === gid);
            if (!gal) return;
            setCoreConsoleOpen(false);
            if ((state.activeRealityId || 'sol-prime') !== rid) {
              actions.switchReality(rid);
              toast(`Quantum Warp: Traveled into Reality — ${r.name}`);
              chime(880);
            }
            setActiveGalaxyId(gid);
            engineRef.current?.enterGalaxy(rid, gid);
            toast(`⌖ Diving into ${gal.name} — ${r.name}`);
            chime(760);
            }}
          />
        </Suspense>
      )}

      <ToastHost />
    </div>
  );
}

/* wrapper that controls stacking without fighting the spring transform.
   pointer-events pass straight through — the window root re-enables them —
   so the universe stays clickable while diaries are open. */
function DiaryWindowFrame({ children, z }: { children: ReactNode; z: number; focused: boolean }) {
  return <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 40 + (z % 50) }}>{children}</div>;
}

function RenameRow({ body, onDone }: { body: CosmicBody; onDone: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(body.name);
  if (!editing) {
    return (
      <button className="ctx-item w-full text-left px-4 py-1.75 text-[12px] text-slate-soft" onClick={() => setEditing(true)}>
        rename
      </button>
    );
  }
  return (
    <div className="px-4 py-1.5">
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { actions.renameBody(body.id, val); toast('the world answers to a new name'); onDone(); }
          if (e.key === 'Escape') onDone();
        }}
        onBlur={() => { actions.renameBody(body.id, val); onDone(); }}
        className="field w-full px-2 py-1 text-[12px] text-paper"
      />
    </div>
  );
}

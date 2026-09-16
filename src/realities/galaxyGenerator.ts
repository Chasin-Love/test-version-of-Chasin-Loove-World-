/* Genesis engine for major galaxies.
   Every reality owns a list of major galaxies; the multiverse view draws one
   ellipse orbit around the reality bubble per galaxy (1 ellipse = 1 galaxy).
   Default rosters are generated deterministically from the reality id so they
   are identical on every boot without being persisted; once the user edits a
   reality's roster the full list is persisted in state.customGalaxies. */

import { CosmicLineage, GalaxyClusterData, GalaxyData } from './hierarchyTypes';
import type { CosmicBody, Palette } from '../types';

/* deterministic string hash → uint32 seed */
function seedOf(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* mulberry32 — small, stable, good enough for layout aesthetics */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GALAXY_NAME_POOL = [
  'Andromeda Reach', 'Triangulum Veil', 'Sombrero Halo', 'Whirlpool Crown',
  'Cartwheel Drift', 'Pinwheel Ember', 'Vesper Cascade', 'Lyra Bloom',
  'Auriga Lantern', 'Messier Echo', 'Cygnum spur', 'Draco Wisp',
  'Perseus Mirror', 'Tucana Dial', 'Fornax Chime', 'Ursa Cradle',
];

const GALAXY_TYPE_POOL = [
  'Barred Spiral (SBbc)', 'Grand-Design Spiral (SAc)', 'Elliptical Giant (E3)',
  'Lenticular Disc (S0)', 'Irregular Starburst (Irr-II)', 'Interacting Pair (Arp)',
  'Seyfert Spiral (SBb)', 'Dwarf Spheroidal (dSph)', 'Ring Galaxy (Rng)',
];

const GALAXY_COLOR_POOL = ['#38bdf8', '#f59e0b', '#ec4899', '#a78bfa', '#34d399', '#fbbf24', '#22d3ee', '#fb7185'];

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'galaxy';
}

/** Full 11-stage cosmic lineage for one galaxy, derived from its host cluster
    so the web→…→system ladder above the galaxy stays coherent. */
export function buildGalaxyLineage(params: {
  realityId: string;
  realityName: string;
  cluster: GalaxyClusterData | undefined;
  clusterIdx: number;
  galaxyName: string;
  galaxyType: string;
  isHome: boolean;
  anchorStarName: string;
  worldsCount: number;
}): CosmicLineage {
  const { realityId, realityName, cluster, clusterIdx, galaxyName, galaxyType, isHome, anchorStarName, worldsCount } = params;
  const base = cluster?.lineage;
  const addressSeed = seedOf(galaxyName) % 997;
  const armName = isHome
    ? (base?.spiralArm.name ?? 'Orion–Cygnus Arm (Local Spur)')
    : `${galaxyName.split(' ')[0]} Density-Wave Arm`;
  const regionName = isHome
    ? (base?.galacticRegion.name ?? 'Local Interstellar Fluff & Gould Belt')
    : `${galaxyName.split(' ')[0]} ${['Auroral', 'Meridian', 'Frontier', 'Halo', 'Coronal'][addressSeed % 5]} Sector`;
  const nebulaName = isHome
    ? (base?.starFormingRegion.name ?? 'Orion Molecular Cloud Complex')
    : `${galaxyName.split(' ')[0]} ${['Starforge', 'Nursery', 'Emission', 'Molecular', 'Reflection'][addressSeed % 5]} Nebula`;

  return {
    multiverse: base?.multiverse ?? {
      id: 'multiverse-prime',
      name: 'The Infinite Multiverse',
      description: 'Omni-dimensional bulk space hosting all parallel bubble universes and quantum continuums.',
    },
    reality: base?.reality ?? {
      id: realityId,
      name: realityName,
      spectral: 'Quantum Bubble Reality',
      description: `Parallel Universe continuum ${realityName} operating with isolated physical parameters.`,
    },
    cosmicWeb: base?.cosmicWeb ?? {
      id: `web-${realityId}`,
      name: `${realityName} Cosmic Filament Web`,
      filamentDensity: '0.84 Baryonic Mass / Vol',
      description: 'Large-scale dark matter filaments and vast cosmic voids interconnecting all supercluster complexes.',
    },
    superclusterComplex: base?.superclusterComplex ?? {
      id: `complex-${realityId}-${Math.floor(clusterIdx / 2)}`,
      name: `${realityName} Complex ${String.fromCharCode(65 + Math.floor(clusterIdx / 2))}`,
      spanMly: `${400 + clusterIdx * 80} Mly`,
      description: 'Hyper-scale gravitational complex containing multiple supercluster nodes.',
    },
    supercluster: base?.supercluster ?? {
      id: `supercluster-${realityId}-${clusterIdx}`,
      name: `${(cluster?.name ?? realityName).replace(/(Group|Cluster|Node)/, '').trim()} Supercluster`,
      clustersCount: 12 + clusterIdx * 4,
      description: 'Dense concentration of galaxy clusters and group filaments.',
    },
    galaxyCluster: base?.galaxyCluster ?? {
      id: cluster?.code ?? `GRP-${realityId.slice(0, 4).toUpperCase()}-01`,
      name: cluster?.name ?? `${realityName} Home Cluster`,
      type: cluster?.type ?? 'Galaxy Group',
      galaxiesCount: cluster?.galaxiesCount ?? 84,
      diameterMly: cluster ? `${(6 + clusterIdx * 2.2).toFixed(1)} Mly` : '9.8 Mly',
      description: cluster?.lineage?.galaxyCluster?.description ?? 'Gravitationally bound group containing this galaxy.',
      isHomeCluster: cluster?.isHomeCluster ?? isHome,
    },
    galaxy: {
      id: `galaxy-${realityId}-${slugify(galaxyName)}`,
      name: galaxyName,
      type: galaxyType,
      diameterKly: `${(58 + (addressSeed % 90)).toFixed(0)} kly`,
      starsCount: `${100 + (addressSeed % 500)} Billion Stars`,
      description: isHome
        ? `The home galaxy of ${realityName} — the anchor star system, every memory world and the Eventide vault all live on its arms.`
        : `A major galaxy of ${realityName}. Its own arms, nurseries and stellar systems are fully navigable.`,
    },
    galacticRegion: {
      id: `region-${realityId}-${slugify(galaxyName)}`,
      name: regionName,
      distanceFromCore: `${18 + (addressSeed % 40)} kly from Galactic Core`,
      temperature: 'Warm Interstellar Medium (~7,000 K)',
      description: 'The surrounding galactic sub-sector with balanced cosmic radiation and rich heavy-element abundance.',
    },
    spiralArm: {
      id: `arm-${realityId}-${slugify(galaxyName)}`,
      name: armName,
      pitchAngle: `${(9 + (addressSeed % 9)).toFixed(1)}° Galactic Pitch`,
      description: 'A major density wave compressing interstellar molecular clouds and triggering new generations of stars.',
    },
    starFormingRegion: {
      id: `sfr-${realityId}-${slugify(galaxyName)}`,
      name: nebulaName,
      type: isHome ? (base?.starFormingRegion.type ?? 'Giant H II Stellar Nursery') : 'Giant H II Emission Complex',
      spanLy: `${(120 + (addressSeed % 600))} ly`,
      protostarsCount: `${900 + (addressSeed % 2200)} Protostellar Cores`,
      description: 'Vast stellar nursery where gas and dust collapse gravitationally to birth proto-planetary solar systems.',
    },
    stellarSystem: {
      id: `system-${realityId}-${slugify(galaxyName)}`,
      starName: isHome ? anchorStarName : `${galaxyName.split(' ')[0]} ${['Primary', 'Verge', 'Crown', 'Twin', 'Hearth'][addressSeed % 5]} Star`,
      spectralClass: isHome ? 'G2V Main Sequence / Spectral Core' : 'F5V Luminous Dwarf',
      habitableZoneAU: '0.95 – 1.42 AU',
      worldsCount: isHome ? worldsCount : 3 + (addressSeed % 7),
      description: isHome
        ? `The primary anchor stellar system of ${realityName}, holding all ${worldsCount} recorded cosmic worlds, memory planets, and quantum vault.`
        : `A neighboring stellar system within the ${nebulaName} sector.`,
    },
  };
}

/** Deterministic default roster — exactly what the reality's ellipse ring shows. */
export function generateGalaxiesForReality(params: {
  realityId: string;
  realityName: string;
  colorA: string;
  colorB: string;
  clusters: GalaxyClusterData[];
  anchorStarName: string;
  worldsCount: number;
  galaxyCountHint?: number;
}): GalaxyData[] {
  const { realityId, realityName, colorA, colorB, clusters, anchorStarName, worldsCount, galaxyCountHint } = params;
  const rnd = prng(seedOf(`galaxies::${realityId}`));
  const count = Math.max(1, Math.min(12, galaxyCountHint ?? 3 + Math.floor(rnd() * 3))); /* 3–5 majors by default */

  const galaxies: GalaxyData[] = [];
  const usedNames = new Set<string>();
  for (let i = 0; i < count; i++) {
    const isHome = i === 0;
    const hostIdx = isHome ? 0 : (i - 1) % Math.max(1, clusters.length);
    const cluster = clusters[hostIdx];

    let name: string;
    if (isHome) {
      name = cluster?.lineage?.galaxy?.name ?? `${realityName} Grand Spiral`;
    } else {
      let candidate = '';
      let guard = 0;
      do {
        const raw = GALAXY_NAME_POOL[Math.floor(rnd() * GALAXY_NAME_POOL.length)];
        candidate = raw.charAt(0).toUpperCase() + raw.slice(1);
        guard++;
      } while (usedNames.has(candidate) && guard < 40);
      name = candidate;
    }
    usedNames.add(name);

    const type = isHome
      ? (cluster?.lineage?.galaxy?.type ?? 'Barred Spiral (SBbc)')
      : GALAXY_TYPE_POOL[Math.floor(rnd() * GALAXY_TYPE_POOL.length)];
    const color = isHome
      ? colorA
      : [colorA, colorB, ...GALAXY_COLOR_POOL][Math.floor(rnd() * (GALAXY_COLOR_POOL.length + 2))];

    galaxies.push({
      id: `gal-${realityId}-${i}`,
      realityId,
      clusterId: cluster?.id,
      name,
      type,
      color,
      diameterKly: cluster?.lineage?.galaxy?.diameterKly ?? `${80 + i * 12} kly`,
      starsCount: cluster?.lineage?.galaxy?.starsCount ?? '220 Billion Stars',
      description: isHome
        ? `The home galaxy of ${realityName} — the anchor star system, every memory world and the Eventide vault all live on its arms.`
        : `A major galaxy orbiting inside the ${realityName} continuum. Select its ellipse to dive in and navigate it.`,
      isHomeGalaxy: isHome,
      /* golden-angle phase spread + slowly widening band → even, elegant ellipses */
      orbitRadius: 1.14 + i * 0.26 + rnd() * 0.08,
      orbitSpeed: (i % 2 === 0 ? 1 : -1) * (0.05 + rnd() * 0.05),
      orbitIncl: Math.sin(i * 2.1 + seedOf(realityId) % 6) * (0.42 + rnd() * 0.35),
      orbitPhase: i * 2.399963 + rnd() * 0.5,
      lineage: buildGalaxyLineage({
        realityId, realityName, cluster, clusterIdx: hostIdx,
        galaxyName: name, galaxyType: type, isHome, anchorStarName, worldsCount,
      }),
    });
  }
  return galaxies;
}

/** Factory for a user-created galaxy (persisted verbatim in customGalaxies). */
export function createGalaxyData(params: {
  realityId: string;
  realityName: string;
  clusters: GalaxyClusterData[];
  anchorStarName: string;
  worldsCount: number;
  name?: string;
  type?: string;
  color?: string;
  slotIndex: number;
}): GalaxyData {
  const { realityId, realityName, clusters, anchorStarName, worldsCount, name, type, color, slotIndex } = params;
  const rnd = prng(seedOf(`${name ?? 'nova'}::${realityId}::${slotIndex}::${Date.now()}`));
  const hostIdx = slotIndex % Math.max(1, clusters.length);
  const cluster = clusters[hostIdx];
  const finalName = name?.trim() || `Nova Galaxy ${slotIndex + 1}`;

  return {
    id: `gal-${realityId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    realityId,
    clusterId: cluster?.id,
    name: finalName,
    type: type || GALAXY_TYPE_POOL[Math.floor(rnd() * GALAXY_TYPE_POOL.length)],
    color: color || GALAXY_COLOR_POOL[Math.floor(rnd() * GALAXY_COLOR_POOL.length)],
    diameterKly: `${60 + Math.floor(rnd() * 90)} kly`,
    starsCount: `${80 + Math.floor(rnd() * 500)} Billion Stars`,
    description: 'A newly condensed major galaxy. Edit its morphology, orbit and lore — its ellipse is live in the multiverse.',
    isHomeGalaxy: false,
    orbitRadius: 1.14 + slotIndex * 0.26 + rnd() * 0.08,
    orbitSpeed: (slotIndex % 2 === 0 ? 1 : -1) * (0.05 + rnd() * 0.05),
    orbitIncl: Math.sin(slotIndex * 2.1) * (0.42 + rnd() * 0.35),
    orbitPhase: slotIndex * 2.399963 + rnd() * 0.5,
    lineage: buildGalaxyLineage({
      realityId, realityName, cluster, clusterIdx: hostIdx,
      galaxyName: finalName, galaxyType: type || 'Barred Spiral (SBbc)',
      isHome: false, anchorStarName, worldsCount,
    }),
  };
}

/* =================== REAL ISOLATED STELLAR SYSTEMS ========================
   Every non-home galaxy owns a REAL stellar system — same construction
   grammar as the home anchor system (Kepler worlds on shader surfaces,
   cloud decks, atmospheres, ring systems, moons, an asteroid belt) —
   generated deterministically from the galaxy's lineage so it is identical
   on every boot. The engine builds meshes from these CosmicBody specs. */

const TAU = Math.PI * 2;

/* hex → shaded variant without pulling in three: f≤1 darkens, f>1 lightens
   toward white */
function shadeHex(hex: string, f: number): string {
  const n = parseInt(hex.replace('#', ''), 16) || 0x888888;
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f <= 1) { r *= f; g *= f; b *= f; }
  else {
    const k = Math.min(1, f - 1);
    r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k;
  }
  const to2 = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

/* world archetypes — each carries a full palette like the home realities do.
   Radii are COPIED from the home anchor system (Cinder 1.15, Veil 1.9,
   Aurelia 2.05, Rust 1.5, Goliath 4.3, Mirror 1.75) so a foreign system
   reads at exactly the same scale as the real one. */
const WORLD_ARCHETYPES: { label: string; radius: number; palette: Palette; clouds?: boolean; nightside?: boolean; rings?: boolean; giant?: boolean }[] = [
  { label: 'scorched', radius: 1.15, palette: { deep: '#1c1512', base: '#6e5a4c', high: '#b39a83', atmo: '#8a7462', ice: '#d8cfc4' } },
  { label: 'shrouded', radius: 1.9, palette: { deep: '#2a1f14', base: '#c9a86a', high: '#efd9a8', atmo: '#e8cf9e', ice: '#fff2d8' }, clouds: true },
  { label: 'terran', radius: 2.05, palette: { deep: '#0b2d4d', base: '#1f6e52', high: '#9db88a', atmo: '#7fc4e8', ice: '#eef6ff' }, clouds: true, nightside: true },
  { label: 'rust', radius: 1.5, palette: { deep: '#2b120c', base: '#a34b2a', high: '#d98d5f', atmo: '#d9a184', ice: '#f0d9c8' } },
  { label: 'gas-giant', radius: 4.3, palette: { deep: '#241a12', base: '#b08d5f', high: '#e8d3a8', atmo: '#e0c493', ice: '#f5ead0' }, rings: true, giant: true, clouds: true },
  { label: 'ice', radius: 1.75, palette: { deep: '#10222e', base: '#4f7f96', high: '#bcd9e6', atmo: '#a8d8ea', ice: '#f2fbff' } },
  { label: 'oceanic', radius: 2.0, palette: { deep: '#062033', base: '#13618a', high: '#7fd4c8', atmo: '#6fc2e8', ice: '#e8fbff' }, clouds: true },
  { label: 'volcanic', radius: 1.35, palette: { deep: '#1a0606', base: '#7a2418', high: '#e8763a', atmo: '#e85a2a', ice: '#ffb890' }, nightside: true },
  { label: 'violet', radius: 1.7, palette: { deep: '#160b2a', base: '#5a3d8a', high: '#b89ae8', atmo: '#a88ae8', ice: '#efe4ff' } },
  { label: 'emerald', radius: 1.6, palette: { deep: '#0a2415', base: '#2a7a4a', high: '#9ae8b8', atmo: '#7ae8a8', ice: '#eafff2' }, clouds: true },
];

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/* orbit ladder COPIED from the home system (26 / 38 / 52 / 68 / 100 / 132 /
   160 …) with the belt falling between Rust's and Goliath's slots */
const ORBIT_LADDER = [26, 38, 52, 68, 100, 132, 160, 196, 236];

/** A REAL, deterministic CosmicBody system for one galaxy: the star itself
    (tinted by the galaxy's light) plus its full planet roster — Kepler
    orbits on real periods (T² = a³), archetypes spread like the home
    system, a habitable terran world in the temperate band and a ringed
    gas giant in the outer system. */
export function generateStellarSystemForGalaxy(gal: GalaxyData): CosmicBody[] {
  const sys = gal.lineage.stellarSystem;
  const rnd = prng(seedOf(`system::${gal.id}::${sys.starName}`));
  const tint = gal.color || '#38bdf8';
  const now = Date.now();
  const worlds = Math.max(4, Math.min(9, sys.worldsCount || 5));

  const bodies: CosmicBody[] = [
    {
      id: `${gal.id}-star`, name: sys.starName, kind: 'star', meaning: null,
      note: `The ${sys.spectralClass} heart of this isolated realm.`,
      createdAt: now, radius: 6,
      palette: { deep: shadeHex(tint, 0.3), base: tint, high: shadeHex(tint, 1.7), atmo: shadeHex(tint, 1.35), ice: '#ffffff' },
      orbit: { a: 0, speed: 0, phase: 0, incl: 0 },
    },
  ];

  /* one guaranteed terran world in the temperate band (slot 2), one ringed
     gas giant in the outer system (slot ≥3) — everything else rolls */
  const giantIdx = Math.max(3, worlds - 3);
  for (let i = 0; i < worlds; i++) {
    const a = ORBIT_LADDER[Math.min(i, ORBIT_LADDER.length - 1)] + (rnd() * 4 - 2);
    const isGiant = i === giantIdx;
    const isTerran = i === 2 && !isGiant;
    const arche = isTerran
      ? WORLD_ARCHETYPES[2]
      : isGiant
        ? WORLD_ARCHETYPES[4]
        : WORLD_ARCHETYPES[[0, 1, 3, 5, 6, 7, 8, 9][(rnd() * 8) | 0]];
    const isDwarf = !isGiant && !isTerran && rnd() > 0.82;
    const radius = isDwarf ? 0.8 : arche.radius;
    const periodDays = 365.256 * Math.pow(a / 52, 1.5); /* Kepler's third law */
    bodies.push({
      id: `${gal.id}-w${i}`,
      name: `${sys.starName.split(' ')[0]} ${ROMAN[i]}`,
      kind: isDwarf ? 'dwarf' : 'planet',
      meaning: null,
      note: isTerran
        ? 'A temperate terran world riding the habitable band of this isolated realm.'
        : `A ${arche.label} world of the ${sys.starName} system.`,
      createdAt: now,
      radius,
      rings: arche.rings,
      clouds: arche.clouds,
      nightside: arche.nightside,
      palette: arche.palette,
      orbit: { a, speed: TAU / periodDays, phase: rnd() * TAU, incl: (rnd() - 0.5) * 0.24 },
    });
  }

  /* every isolated galaxy carries its own Eventide vault. It is a real
     destination, not just a home-galaxy convenience, so the inner system
     can use the same black-hole Kamui grammar everywhere. */
  bodies.push({
    id: `${gal.id}-vault-blackhole`,
    name: `${sys.starName.split(' ')[0]} Eventide Black Hole`,
    kind: 'vault', meaning: null,
    note: `An isolated Eventide black-hole vault orbiting the ${sys.starName} system.`,
    createdAt: now - 850 * 86400000,
    radius: 2.8,
    palette: {
      deep: '#000000',
      base: shadeHex(tint, 0.16),
      high: shadeHex(tint, 1.45),
      atmo: '#6fc2b4',
      ice: '#ffffff',
    },
    orbit: { a: 220 + rnd() * 18, speed: TAU / 10000, phase: rnd() * TAU, incl: -0.15 + rnd() * 0.3 },
  });

  /* a stellar nursery at the system edge — the Wisp Nebula grammar */
  const nebTints = [
    { deep: '#0a2a2c', base: '#2f8f83', high: '#9fe8d8', atmo: '#6fc2b4', ice: '#e8fff8' },
    { deep: '#14092a', base: '#4a2f8f', high: '#b89ae8', atmo: '#8a6fc2', ice: '#f0e8ff' },
    { deep: '#2a120a', base: '#8f4a2f', high: '#e8b89a', atmo: '#c27f6f', ice: '#fff0e8' },
  ];
  bodies.push({
    id: `${gal.id}-nebula`,
    name: `${sys.starName.split(' ')[0]} Veil Nebula`,
    kind: 'nebula', meaning: null,
    note: `A stellar nursery drifting at the edge of the ${sys.starName} system.`,
    createdAt: now, radius: 7,
    palette: nebTints[(rnd() * nebTints.length) | 0],
    orbit: { a: 285 + rnd() * 20, speed: TAU / 9000, phase: rnd() * TAU, incl: 0.3 },
  });
  return bodies;
}

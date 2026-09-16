/**
 * The 11-stage cosmological hierarchy ladder — SINGLE SOURCE OF TRUTH.
 *
 * Three consumers previously hand-copied this data and were drifting apart:
 *   1. MultiverseBar.hierarchyStages (UI stepper labels)
 *   2. engine.zoomToHierarchy (calibrated camera dials)
 *   3. CosmicWebHUD.getLODInfo (label-string matching)
 *
 * Order is fixed: index 0 = Multiverse … index 10 = Stellar System.
 * `dial` values are calibrated against the engine's scale-label distance
 * windows (dist = 3 · 800000^zoomT) so each stage LANDS inside its own
 * label band.
 */
export interface HierarchyStage {
  /** Full display name */
  label: string;
  /** Compact chip label for the stepper */
  short: string;
  /** Uppercase key matched against the engine's scale-label ladder */
  key: string;
  /** One-line description shown in tooltips */
  desc: string;
  /** Camera zoom dial that centers this stage */
  dial: number;
}

export const HIERARCHY_STAGES: readonly HierarchyStage[] = [
  { label: 'Multiverse', short: 'Bulk', key: 'MULTIVERSE', desc: 'Omni-dimensional bulk space hosting all parallel bubble realities', dial: 0 },
  { label: 'Reality / Universe', short: 'Reality', key: 'REALITY', desc: 'Isolated universe continuum with unique physical parameters', dial: 0.88 },
  { label: 'Cosmic Web', short: 'Web', key: 'COSMIC WEB', desc: 'Observable universe dark matter filaments & voids', dial: 0.858 },
  { label: 'Supercluster Complex', short: 'Complex', key: 'COMPLEX', desc: 'Hyper-scale gravitational complex containing multiple superclusters', dial: 0.842 },
  { label: 'Supercluster', short: 'Supercluster', key: 'SUPERCLUSTER', desc: 'Virgo & Laniakea supercluster galaxy streams', dial: 0.773 },
  { label: 'Galaxy Cluster / Group', short: 'Cluster', key: 'GALAXY CLUSTER', desc: 'Local group, interacting galaxies & satellite cluster', dial: 0.722 },
  { label: 'Galaxy', short: 'Galaxy', key: 'SPIRAL GALAXY', desc: 'The Milliandra galactic disk & luminous core', dial: 0.668 },
  { label: 'Galactic Region', short: 'Region', key: 'REGION', desc: 'Local galactic quadrant & stellar neighborhood', dial: 0.589 },
  { label: 'Spiral Arm', short: 'Arm', key: 'SPIRAL ARM', desc: 'Local density wave spur & starburst arm', dial: 0.503 },
  { label: 'Star-Forming Region', short: 'Nursery', key: 'STAR-FORMING', desc: 'Stellar nursery & molecular cloud forge', dial: 0.411 },
  { label: 'Stellar System', short: 'System', key: 'STELLAR SYSTEM', desc: 'Planets, moons, rings & central star', dial: 0.15 },
];

/** Dial lookup in stage order — mirrors the array previously inlined in engine.zoomToHierarchy. */
export const HIERARCHY_DIALS: readonly number[] = HIERARCHY_STAGES.map((s) => s.dial);

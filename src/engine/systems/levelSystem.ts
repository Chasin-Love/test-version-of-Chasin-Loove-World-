/**
 * Scale-label ladder for the cosmic web stage — the distance windows that map
 * camera distance to the 11-stage hierarchy labels. Extracted from
 * engine.ts's updateLevels so the band edges are named and documented.
 *
 * Distances are world units; the ladder assumes the web stage
 * (`cosmicStage === 'web'`) and distances at or above the system scale.
 */

/** Below this distance the engine shows APPROACH / SURFACE / inner-system labels instead. */
export const WEB_LADDER_MIN_D = 260;

/** Distances inside this band interpolate the nearest major galaxy's name into the label. */
export const GALAXY_NAME_BAND_MAX = 38000;

/** Distance windows (exclusive upper bounds) for the web-stage ladder. */
export const SCALE_BANDS = {
  starForming: 1200,
  spiralArm: 4500,
  galacticRegion: 14000,
  galaxyName: GALAXY_NAME_BAND_MAX,
  cluster: 85000,
  supercluster: 160000,
  superclusterComplex: 320000,
  cosmicWeb: 650000,
  reality: 1200000,
} as const;

/**
 * Label for distances at or above the galaxy-name band (d ≥ GALAXY_NAME_BAND_MAX).
 * Returns null for smaller distances — the engine handles those specially.
 */
export function highScaleLabel(d: number): string | null {
  if (d < SCALE_BANDS.galaxyName) return null;
  if (d < SCALE_BANDS.cluster) return 'GALAXY CLUSTER / GALAXY GROUP';
  if (d < SCALE_BANDS.supercluster) return 'SUPERCLUSTER';
  if (d < SCALE_BANDS.superclusterComplex) return 'SUPERCLUSTER COMPLEX';
  if (d < SCALE_BANDS.cosmicWeb) return 'COSMIC WEB';
  if (d < SCALE_BANDS.reality) return 'REALITY / UNIVERSE';
  return 'MULTIVERSE';
}

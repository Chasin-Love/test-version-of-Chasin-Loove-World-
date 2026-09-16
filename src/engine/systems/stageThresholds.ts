/**
 * Stage-edge dial thresholds — the magic numbers that govern warp triggering
 * in the engine's tick loop, extracted from inline literals so the stage
 * grammar lives in one documented place.
 *
 * The camera zoom dial `zoomT ∈ [0,1]` maps to distance via
 * `dist = 3.0 · 800000^zoomT` (see cameraRig.ts). These thresholds are
 * calibrated against the scale-label ladder in levelSystem.ts.
 */

/* ---- cosmic web ceiling: the edge that tears reality open ---- */

/** Hard clamp — the dial can never rest above this on the web stage. */
export const WEB_CEILING = 0.865;
/** Pulling at or beyond this with outward zoom velocity starts the Kamui tear. */
export const WEB_EDGE_TRIGGER = 0.855;
/** Outward zoom velocity (dial/s) required to fire a warp at a stage edge. */
export const WARP_ZOOM_VEL = 0.05;

/* ---- multiverse floor: the return tear ---- */

/** Soft floor the rig is held at inside the multiverse. */
export const MULTIVERSE_FLOOR_CLAMP = 0.8;
/** Crossing below this while pushing inward fires the return tear to the web. */
export const MULTIVERSE_FLOOR_RETURN = 0.802;
/** Inward zoom velocity (dial/s) required to fire the return tear. */
export const RETURN_ZOOM_VEL = -0.05;
/** Reality marble frame releases below this zoom. */
export const REALITY_FLOOR = 0.787;

/* ---- galaxy band: the dial fold between region and system scales ---- */

/** Upper edge of the galaxy band (dial above this = cluster scale). */
export const GALAXY_BAND_UPPER = 0.70;
/** Lower edge of the galaxy band (dial below this = region scale). */
export const GALAXY_BAND_LOWER = 0.58;
/** Arrive crossing: falling past this dial from above enters the galaxy. */
export const GALAXY_ARRIVE_CROSS = 0.695;
/** Descend crossing: falling past this dial folds down into the home system. */
export const GALAXY_DESCEND_CROSS = 0.585;
/** Ascend crossing: rising above this dial folds up to the galaxy frame. */
export const GALAXY_ASCEND_ENTER = 0.60;
/** Small hysteresis margin applied to the ascend crossing. */
export const GALAXY_ASCEND_CROSS = 0.605;
/** Zoom dial that frames the galaxy stage (HIERARCHY_DIALS[6]). */
export const GALAXY_DIAL = 0.668;

/** A latched band crossing older than this (seconds) is stale and dropped. */
export const BAND_LATCH_TTL = 3;

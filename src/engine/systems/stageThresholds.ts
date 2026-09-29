/**
 * Stage-edge dial thresholds — the magic numbers that govern stage crossings
 * in the engine's tick loop, extracted from inline literals so the stage
 * grammar lives in one documented place.
 *
 * The camera zoom dial `zoomT ∈ [0,1]` maps to distance via
 * `dist = 3.0 · 800000^zoomT` (see cameraRig.ts). These thresholds are
 * calibrated against the scale-label ladder in levelSystem.ts.
 */

/* ---- cosmic web ceiling: the edge that hands you to the multiverse ---- */

/* R68 — THE EXPLORATION MARGIN. The ceiling used to sit at 0.865, so the
   outer band of the web (whole-structure views, the dome's rim) was
   unreachable: the dial was still in-range when the crossing fired. The
   ceiling now rides out to 0.94 — the traveler can explore the whole web
   band first — and the crossing demands a DELIBERATE push: the dial at the
   edge AND a strong outward velocity (WARP_ZOOM_VEL), not any fast scroll. */

/** Hard clamp — the dial can never rest above this on the web stage. */
export const WEB_CEILING = 0.94;
/** Pulling at or beyond this with outward zoom velocity crosses into the multiverse. */
export const WEB_EDGE_TRIGGER = 0.936;
/** Outward zoom velocity (dial/s) required to cross at a stage edge. */
export const WARP_ZOOM_VEL = 0.05;

/* ---- multiverse floor: the way back to the web ---- */

/* R68 — same margin on the multiverse side: the overview can pull back to
   a true whole-sphere vantage before the return crossing is even possible. */

/** Soft floor the rig is held at inside the multiverse. */
export const MULTIVERSE_FLOOR_CLAMP = 0.735;
/** Crossing below this while pushing inward carries the dial back to the web. */
export const MULTIVERSE_FLOOR_RETURN = 0.737;
/** Inward zoom velocity (dial/s) required to cross back. */
export const RETURN_ZOOM_VEL = -0.05;
/** Reality marble frame releases below this zoom. */
export const REALITY_FLOOR = 0.787;

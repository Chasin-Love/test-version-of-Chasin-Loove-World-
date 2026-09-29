/**
 * KAMUI (v1) — the Space-Time Vortex shared contract.
 *
 * The red demonic vortex (shaders.ts `portalFrag` + engine.triggerKamui())
 * is theater: it tears the SCREEN around the Multiverse Core while the
 * plain-zoom portal, the galaxy dive and the stage dial do the actual
 * travel. This module keeps the one piece of the old chain the engine
 * still consumes — the portal zoom's field-intensity weights — so the
 * portal timeline and any tooling share one source of truth.
 */

export type PortalPhase =
  | 'idle'
  | 'entering'
  | 'open'
  | 'leaving';

/** Field intensity each phase contributes before its own progress is added. */
export const KAMUI_PHASE_WEIGHTS: Record<PortalPhase, number> = {
  idle: 0,
  entering: 0.55,
  open: 1,
  leaving: 0.4,
};

/** The v1 vortex envelope: one slow sin breath over KAMUI_TRIGGER_DURATION
    seconds (rise → crest → fall), so the summon can actually be watched.

    R69 — THE SNAPPier SUMMON: the traveler's verdict on the R67 handoff —
    the FINAL stage (the throat/vacuum stabilization) dragged and read as
    lag. The whole choreography is compressed 5.5 s → 3.5 s (−2 s, the user's
    own bound): every beat keeps its relative shape and the swallow stays
    theatrical, but the summon no outstays its welcome. The beat table below
    is the compression — recompute the spans, never slow one motion. */
export const KAMUI_TRIGGER_DURATION = 3.5; /* seconds */

/** THE EJECT (the reverse/return tear) has its own, shorter life: ~0.6s at
    full burst while the open overlay is swallowed (kamui-suck), then the
    spin and the glow UNWIND together over the rest — the warped screen
    relaxes smoothly back to the idle image instead of freezing at full
    twist and hard-cutting. */
export const KAMUI_REVERSE_DURATION = 1.9; /* seconds */

export const KAMUI_RAMP: string[] = ['#ff1744', '#8b5cf6', '#f2c178'];

/** THE CHOREOGRAPHY — the summon is a SEQUENCE of distinct beats, not one
    stretched motion. The rip opens (the original start, kept), the middle
    adds new frames — the twist winds up, the void flickers, the pull
    deepens — and the throat finishes (the vacuum gulp, the original end,
    kept). Every beat plays at full speed; the length comes from how many
    there are, never from slowing the one motion down. */
export interface KamuiBeat { kind: 'tear' | 'wind' | 'flicker' | 'deepen' | 'throat'; t0: number; t1: number; peak: number }

export const KAMUI_BEATS: KamuiBeat[] = [
  { kind: 'tear',    t0: 0.0,  t1: 0.6,  peak: 1.0 },
  { kind: 'wind',    t0: 0.22, t1: 1.3,  peak: 0.62 },
  { kind: 'flicker', t0: 0.92, t1: 1.95, peak: 0.7 },
  { kind: 'deepen',  t0: 1.63, t1: 2.77, peak: 0.85 },
  { kind: 'throat',  t0: 2.35, t1: 3.5,  peak: 1.0 },
];

/* The spans OVERLAP on purpose: the max of neighboring bumps never dips to
   zero, so the forming vortex never blinks or relaxes backward at a seam.
   The spin itself is driven by the running maximum (uTwist) — it only ever
   winds forward. */

/** A beat's envelope — one full-speed rise-and-fall inside its own span. */
export function kamuiBeatEase(elapsed: number, beat: KamuiBeat): number {
  if (elapsed < beat.t0 || elapsed > beat.t1) return 0;
  return Math.sin(((elapsed - beat.t0) / (beat.t1 - beat.t0)) * Math.PI) * beat.peak;
}

/**
 * THE VACUUM GULP — the tear's final stage.
 *
 * In the last KAMUI_VACUUM_WINDOW seconds of a forward summon the throat
 * completes: the pull, spin and void all surge with rising acceleration
 * (shader uVac), the swallowed subject's own size drains, and the frame
 * rumbles — the universe briefly unstable at the instant the tunnel
 * finishes, like a vacuum ripping its subject in.
 */
export const KAMUI_VACUUM_WINDOW = 0.95; /* seconds */

/**
 * CAMERA STABILITY — the summon hold.
 *
 * The vortex breathes for KAMUI_TRIGGER_DURATION seconds, cresting at the
 * midpoint, but the portal's zoom used to start on the same frame as the
 * tear, so the camera was already arriving at the body while the red swirl
 * was still rising — the jutsu was never actually seen, and pinning the rig
 * to the clicked body on that frame swept the whole sky sideways. The entry
 * therefore holds the camera EXACTLY where the traveler left it for this
 * long, and only then hands the focus and the dive to the rig — through the
 * crest, into the fall, so the arrival still feels like falling through it.
 */
export const KAMUI_ENTRY_HOLD = 3.5; /* seconds — the whole choreography plays on a locked frame; the dive begins as the throat completes */

/** The arrival framing, as a multiple of the body's radius. The old 3.2 put
    the camera almost on the surface by the time the overlay opened; 4.2 keeps
    the world composed instead of filling the screen. */
export const KAMUI_ENTRY_FRAMING = 4.2;

/**
 * Portal Kamui phase machine — shared definitions for the 9-phase
 * planet/vault traversal (`idle → arming → disturbance → deformation →
 * vortex → collapse → opening → hold → out`).
 *
 * The state machine itself lives in UniverseEngine (the phases drive shader
 * uniforms, camera squeeze and FOV); this module formalizes the phase
 * contract: the ordered chain, the per-phase field-intensity weights, and
 * the per-phase durations (normal vs reduced-motion).
 */

export type PortalPhase =
  | 'idle'
  | 'arming'
  | 'disturbance'
  | 'deformation'
  | 'vortex'
  | 'collapse'
  | 'opening'
  | 'hold'
  | 'out';

/** Field intensity each phase contributes before its own progress is added. */
export const PORTAL_PHASE_WEIGHTS: Record<PortalPhase, number> = {
  idle: 0, arming: 0.02, disturbance: 0.10, deformation: 0.30,
  vortex: 0.62, collapse: 0.82, opening: 1, hold: 1, out: 1,
};

/** One linear transition of the chain. `hold`/`out` have bespoke logic and are not listed. */
export interface PortalTransition {
  from: Exclude<PortalPhase, 'idle' | 'hold' | 'out'>;
  next: PortalPhase;
  /** duration in seconds at full motion */
  duration: number;
  /** duration in seconds with reduced motion */
  reduced: number;
}

/** The linear chain in causal order. */
export const PORTAL_CHAIN: readonly PortalTransition[] = [
  { from: 'arming', next: 'disturbance', duration: 0.18, reduced: 0.08 },
  { from: 'disturbance', next: 'deformation', duration: 0.42, reduced: 0.12 },
  { from: 'deformation', next: 'vortex', duration: 0.72, reduced: 0.18 },
  { from: 'vortex', next: 'collapse', duration: 1.0, reduced: 0.22 },
  { from: 'collapse', next: 'opening', duration: 0.72, reduced: 0.18 },
];

/** Lookup: current phase → next transition (null for idle/hold/out). */
export function portalTransitionFor(phase: PortalPhase): PortalTransition | null {
  return PORTAL_CHAIN.find((t) => t.from === phase) ?? null;
}

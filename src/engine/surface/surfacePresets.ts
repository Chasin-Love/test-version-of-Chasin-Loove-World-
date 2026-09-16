import type { RealityConfig } from '../../realities/types';
import type { UniverseSurfaceConfig } from './types';

/**
 * Deterministic surface profiles for each reality in the multiverse.
 * Any new reality or customized backdrop theme can be added or adjusted here
 * without modifying any celestial body mechanics, black holes, or anchor star code.
 */
export const SURFACE_PRESETS: Record<string, UniverseSurfaceConfig> = {
  'sol-prime': {
    realityId: 'sol-prime',
    name: 'Sol Prime Horizon',
    colorA: '#38bdf8',
    colorB: '#f59e0b',
    deepColor: '#000104',
    starColor: '#ffb54d',
    webFilaments: '#1e3a8a',
    nebulaIntensity: 1.0,
    dustLaneIntensity: 0.85,
    starDensity: 1.0,
  },
  'chronos-paradox': {
    realityId: 'chronos-paradox',
    name: 'Chronos Relativistic Dilation',
    colorA: '#06b6d4',
    colorB: '#eab308',
    deepColor: '#020108',
    starColor: '#fbbf24',
    webFilaments: '#4338ca',
    nebulaIntensity: 1.25,
    dustLaneIntensity: 0.7,
    starDensity: 1.15,
  },
  'singularity-rift': {
    realityId: 'singularity-rift',
    name: 'Singularity Event Horizon Void',
    colorA: '#a855f7',
    colorB: '#10b981',
    deepColor: '#000000',
    starColor: '#c084fc',
    webFilaments: '#581c87',
    nebulaIntensity: 1.4,
    dustLaneIntensity: 1.1,
    starDensity: 0.85,
  },
  'biolume-primordial': {
    realityId: 'biolume-primordial',
    name: 'Biolume Primordial Lumina',
    colorA: '#14b8a6',
    colorB: '#f43f5e',
    deepColor: '#010809',
    starColor: '#2dd4bf',
    webFilaments: '#0f766e',
    nebulaIntensity: 1.6,
    dustLaneIntensity: 0.6,
    starDensity: 1.3,
  },
  'hyperion-lumina': {
    realityId: 'hyperion-lumina',
    name: 'Hyperion Solar Radiance',
    colorA: '#fbbf24',
    colorB: '#38bdf8',
    deepColor: '#040301',
    starColor: '#fef08a',
    webFilaments: '#78350f',
    nebulaIntensity: 1.2,
    dustLaneIntensity: 0.5,
    starDensity: 1.2,
  },
  'ignis-ember': {
    realityId: 'ignis-ember',
    name: 'Ignis Scorched Ash Cloud',
    colorA: '#ef4444',
    colorB: '#f97316',
    deepColor: '#060100',
    starColor: '#fb923c',
    webFilaments: '#7f1d1d',
    nebulaIntensity: 1.5,
    dustLaneIntensity: 1.2,
    starDensity: 0.75,
  },
  'kardashev-matrix': {
    realityId: 'kardashev-matrix',
    name: 'Kardashev Lattice Grid',
    colorA: '#6366f1',
    colorB: '#06b6d4',
    deepColor: '#010207',
    starColor: '#818cf8',
    webFilaments: '#312e81',
    nebulaIntensity: 0.9,
    dustLaneIntensity: 0.5,
    starDensity: 1.4,
  },
  'vespera-twilight': {
    realityId: 'vespera-twilight',
    name: 'Vespera Twilight Veil',
    colorA: '#c084fc',
    colorB: '#818cf8',
    deepColor: '#030208',
    starColor: '#e9d5ff',
    webFilaments: '#3b0764',
    nebulaIntensity: 1.35,
    dustLaneIntensity: 0.75,
    starDensity: 1.1,
  },
};

/**
 * Resolves the appropriate surface configuration for a given reality or fallback.
 */
export function getSurfaceConfigForReality(reality?: RealityConfig | string | null): UniverseSurfaceConfig {
  if (!reality) {
    return SURFACE_PRESETS['sol-prime'];
  }
  const id = typeof reality === 'string' ? reality : reality.id;
  const preset = SURFACE_PRESETS[id];
  if (preset) {
    return preset;
  }

  // If dynamic reality object has custom colors, synthesize a surface config
  if (typeof reality === 'object' && reality.colorA && reality.colorB) {
    return {
      realityId: reality.id,
      name: `${reality.name} Surface`,
      colorA: reality.colorA,
      colorB: reality.colorB,
      deepColor: '#000104',
      starColor: reality.starColor || '#ffffff',
      webFilaments: reality.colorA,
      nebulaIntensity: 1.0,
      dustLaneIntensity: 0.85,
      starDensity: 1.0,
    };
  }

  return SURFACE_PRESETS['sol-prime'];
}

import { UniverseSurfaceConfig } from '../../engine/surface/types';

export const parallelSurfaces: Record<string, UniverseSurfaceConfig> = {
  'quantum-foam': {
    realityId: 'quantum-foam',
    name: 'Quantum Foam',
    colorA: '#00f5d4',
    colorB: '#8b5cf6',
    deepColor: '#020b12',
    starColor: '#a7f3d0',
    webFilaments: '#0d9488',
    nebulaIntensity: 1.1,
    dustLaneIntensity: 0.8,
    starDensity: 0.9,
  },
  'cyber-grid': {
    realityId: 'cyber-grid',
    name: 'Cyber Grid',
    colorA: '#06b6d4',
    colorB: '#ec4899',
    deepColor: '#05030f',
    starColor: '#67e8f9',
    webFilaments: '#0891b2',
    nebulaIntensity: 1.15,
    dustLaneIntensity: 0.85,
    starDensity: 0.85,
  },
};

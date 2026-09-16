import type * as THREE from 'three';
import type { RealityConfig } from '../../realities/types';

/**
 * Visual configuration for the Universe Surface (cosmic background).
 * Allows each reality in the multiverse to project its own distinct
 * chromatic palette, nebula clouds, stellar density, and cosmic web colors.
 */
export interface UniverseSurfaceConfig {
  realityId: string;
  name: string;
  colorA: string;
  colorB: string;
  deepColor: string;
  starColor: string;
  webFilaments: string;
  nebulaIntensity: number;
  dustLaneIntensity: number;
  starDensity: number;
}

/**
 * Runtime frame update parameters passed to the Universe Surface engine.
 */
export interface UniverseSurfaceUpdateParams {
  dt: number;
  clockT: number;
  camera: THREE.Camera;
  kamuiErase: number;
  vortexDir: THREE.Vector3;
  skyVisible: boolean;
  neighborhoodVisibility: number;
}

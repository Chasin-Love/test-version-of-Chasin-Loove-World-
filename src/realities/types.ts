import { CosmicBody, DiaryEntry } from '../types';
import { CosmicLineage, GalaxyClusterData, GalaxyData } from './hierarchyTypes';

export * from './hierarchyTypes';

/* user-authored appearance/identity overrides — persisted per reality id */
export interface RealityMetaOverride {
  name?: string;
  codeName?: string;
  spectral?: string;
  colorA?: string;
  colorB?: string;
  starColor?: string; /* the anchor star's aura — core surface + corona light */
}

export interface RealityConfig {
  id: string;
  name: string;
  codeName: string;
  spectral: string;
  description: string;
  bubblePos: [number, number, number];
  bubbleSize: number;
  colorA: string;
  colorB: string;
  starColor: string;
  bodies: CosmicBody[];
  entries: DiaryEntry[];
  clusters?: GalaxyClusterData[];
  /* major galaxies — the multiverse view draws ONE ellipse orbit around the
     reality bubble per entry, so this list IS the reality's visible ring */
  galaxies?: GalaxyData[];
  homeLineage?: CosmicLineage;
}


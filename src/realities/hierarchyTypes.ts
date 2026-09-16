export interface CosmicAddress {
  realityId: string;
  cosmicWebId: string;
  complexId?: string;
  superclusterId?: string;
  clusterId?: string;
  galaxyId?: string;
  regionId?: string;
  spiralArmId?: string;
  starFormingRegionId?: string;
  stellarSystemId?: string;
}

export interface CosmicLineage {
  multiverse?: {
    id: string;
    name: string;
    description: string;
  };
  reality: {
    id: string;
    name: string;
    spectral: string;
    description: string;
  };
  cosmicWeb: {
    id: string;
    name: string;
    filamentDensity: string;
    description: string;
  };
  superclusterComplex: {
    id: string;
    name: string;
    spanMly: string;
    description: string;
  };
  supercluster: {
    id: string;
    name: string;
    clustersCount: number;
    description: string;
  };
  galaxyCluster: {
    id: string;
    name: string;
    type: 'Galaxy Cluster' | 'Galaxy Group' | 'Supercluster Node';
    galaxiesCount: number;
    diameterMly: string;
    description: string;
    isHomeCluster?: boolean;
  };
  galaxy: {
    id: string;
    name: string;
    type: string;
    diameterKly: string;
    starsCount: string;
    description: string;
  };
  galacticRegion: {
    id: string;
    name: string;
    distanceFromCore: string;
    temperature: string;
    description: string;
  };
  spiralArm: {
    id: string;
    name: string;
    pitchAngle: string;
    description: string;
  };
  starFormingRegion: {
    id: string;
    name: string;
    type: string;
    spanLy: string;
    protostarsCount: string;
    description: string;
  };
  stellarSystem: {
    id: string;
    starName: string;
    spectralClass: string;
    habitableZoneAU: string;
    worldsCount: number;
    description: string;
  };
}

/* A major galaxy of a reality. These are the ellipse orbits drawn around a
   reality bubble in the multiverse view — ONE ellipse = ONE galaxy, so a
   reality's galaxy list is exactly what you see circling its ring. */
export interface GalaxyData {
  id: string;
  realityId: string;
  clusterId?: string;        /* host galaxy cluster / group inside the cosmic web */
  name: string;
  type: string;              /* morphology, e.g. 'Barred Spiral (SBbc)' */
  color: string;             /* tint of the node + its ellipse orbit */
  diameterKly: string;
  starsCount: string;
  description: string;
  isHomeGalaxy: boolean;     /* the galaxy holding the reality's anchor star system */
  /* orbital elements around the reality bubble (radius in bubble-size units) */
  orbitRadius: number;       /* × bubbleSize */
  orbitSpeed: number;        /* radians / second */
  orbitIncl: number;         /* ellipse tilt */
  orbitPhase: number;        /* starting angle */
  /* the full 11-stage cosmic address of this galaxy — every galaxy is
     enterable and navigable down to its own stellar systems */
  lineage: CosmicLineage;
}

export interface GalaxyClusterData {
  id: string;
  realityId: string;
  address: CosmicAddress;
  name: string;
  type: 'Galaxy Cluster' | 'Galaxy Group' | 'Supercluster Node';
  code: string;
  color: string;
  orbitRadius: number;
  orbitSpeed: number;
  orbitPhase: number;
  orbitIncl: number;
  galaxiesCount: number;
  isHomeCluster: boolean;
  lineage: CosmicLineage;
}

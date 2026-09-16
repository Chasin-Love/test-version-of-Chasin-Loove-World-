import { NOISE } from '../shaders';

/**
 * Universe Surface Vertex Shader.
 * Projects positions of the inverted celestial sky sphere into directional vectors.
 */
export const universeSurfaceVert = /* glsl */ `
varying vec3 vDir;

void main(){
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Universe Surface Fragment Shader.
 * Generates an authentic, multi-layered deep space reality canvas:
 * 1. Abyssal vacuum background tuned to reality deep colors.
 * 2. Multi-tier Cosmic Web filaments and superclusters.
 * 3. Galactic plane and custom nebular ion fields matching the active reality palette.
 * 4. Interstellar dust lanes and relativistic dark matter folds.
 * 5. Multi-tiered star fields.
 * 6. Authentic geometric Kamui Space-Time vacuum vortex for dimension transitions.
 */
export const universeSurfaceFrag = /* glsl */ `
uniform float uTime;
uniform float uKamuiErase;
uniform vec3 uVortexDir;

// Reality-specific custom surface uniforms
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uDeepColor;
uniform vec3 uStarColor;
uniform vec3 uWebFilaments;
uniform float uNebulaIntensity;
uniform float uDustLaneIntensity;
uniform float uStarDensity;

varying vec3 vDir;

${NOISE}

float starHash(vec3 p){
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void main(){
  float k = clamp(uKamuiErase, 0.0, 1.0);
  if (k >= 0.998) {
    discard;
  }
  
  vec3 rawD = normalize(vDir);
  vec3 d = rawD;
  float edgeAlpha = 1.0;
  
  // =========================================================================
  // AUTHENTIC KAMUI SPACE-TIME VACUUM VORTEX (REALITY TRANSCENDENCE JUTSU)
  // =========================================================================
  if (k > 0.0005) {
    vec3 vAxis = normalize(uVortexDir);
    if (length(vAxis) < 0.01) {
      vAxis = vec3(0.0, 0.0, -1.0);
    }
    
    vec3 upRef = abs(vAxis.y) < 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangentX = normalize(cross(vAxis, upRef));
    vec3 tangentY = cross(tangentX, vAxis);
    
    float dotV = clamp(dot(rawD, vAxis), -1.0, 1.0);
    float alpha = acos(dotV);
    float r = alpha / 3.14159265;
    
    float theta = atan(dot(rawD, tangentY), dot(rawD, tangentX));
    
    // Logarithmic Spiral Frame-Dragging Streamlines
    float vortexTwist = (18.0 * pow(k, 1.25)) / (pow(r, 0.58) + 0.035) + uTime * (5.5 + 4.5 * k);
    float twistedTheta = theta + vortexTwist;
    
    // 3-Blade Spiral Streamline Phase Coordinate
    float psi = 3.0 * theta + (14.0 * pow(k, 1.2)) / (pow(r, 0.52) + 0.05) - uTime * 7.2;
    float spiralArmMetric = sin(psi) * 0.35 * k + cos(psi * 2.0 + uTime * 3.0) * 0.12 * k;
    
    // Suction Horizon
    float spiralHorizon = (1.0 - pow(k, 1.12)) * 1.35 + spiralArmMetric * (1.0 - 0.3 * k);
    spiralHorizon = max(0.0001, spiralHorizon);

    // Coordinate Inward Draw
    float rNorm = r / max(0.001, spiralHorizon);
    float rSuction = pow(clamp(rNorm, 0.0002, 1.0), 1.0 + k * 1.5) * (1.0 + sin(psi) * 0.15 * k);
    rSuction = clamp(rSuction, 0.0002, 1.0);
    float warpedAlpha = rSuction * 3.14159265;

    vec3 warpedRay = cos(twistedTheta) * sin(warpedAlpha) * tangentX +
                     sin(twistedTheta) * sin(warpedAlpha) * tangentY +
                     cos(warpedAlpha) * vAxis;
    d = normalize(warpedRay);

    float distToHorizon = spiralHorizon - r;
    edgeAlpha = r > spiralHorizon ? smoothstep(0.12, 0.0, r - spiralHorizon) : smoothstep(-0.07, 0.0, distToHorizon);
  }
  
  // Abyssal deep universe background base, modulated by reality deepColor
  vec3 col = max(vec3(0.001, 0.0015, 0.003), uDeepColor);
  
  // =========================================================================
  // COSMOLOGICAL HIERARCHY STRUCTURE (From Cosmic Web to Solar System Scale)
  // =========================================================================
  
  // 1. COSMIC WEB & FILAMENTS
  vec3 webCoord = d * 4.5 + vec3(uTime * 0.001, 0.0, uTime * 0.0005);
  float n1 = snoise(webCoord);
  float n2 = snoise(webCoord * 2.1 + vec3(3.2, 7.1, 1.4));
  float filaments = pow(max(0.0, 1.0 - abs(n1) - abs(n2)), 3.5);
  float cosmicVoid = smoothstep(0.2, 0.7, abs(fbm3(d * 1.8)));
  
  vec3 webTone = mix(uWebFilaments * 0.4, uColorA * 0.3, filaments);
  col += webTone * filaments * cosmicVoid * 1.6;
  
  // 2. SUPERCLUSTERS & GALAXY CLUSTERS AT WEB NODES
  float nodes = pow(filaments, 2.5) * smoothstep(0.3, 0.8, fbm3(d * 6.0));
  vec3 superclusterGlow = mix(vec3(0.08, 0.09, 0.16), uColorB * 0.25, 0.4) * nodes * 2.5;
  col += superclusterGlow;
  
  // 3. DISTANT GALAXY SPECS
  vec3 galCell = floor(d * 32.0);
  float galHash = starHash(galCell);
  if (galHash > 0.985) {
    float galDist = length(fract(d * 32.0) - 0.5);
    float galFall = smoothstep(0.42, 0.0, galDist);
    float galCore = pow((galHash - 0.985) / 0.015, 3.0) * galFall;
    vec3 galCol = mix(uColorA, uColorB, fract(galHash * 43.0));
    col += galCol * galCore * 0.45;
  }
  
  // 4. GALACTIC PLANE & SPIRAL STREAM
  vec3 bn = normalize(vec3(d.x, d.y * 2.2, d.z));
  float galacticPlane = exp(-pow(bn.y * 3.2, 2.0));
  vec3 bulgeCol = mix(vec3(0.065, 0.05, 0.075), uColorA * 0.08, 0.5);
  col += bulgeCol * galacticPlane;
  
  // 5. INTERSTELLAR DUST LANES
  float dustLanes = fbm3(d * 3.5 + vec3(1.4, -2.1, 4.8));
  float dustMask = 1.0 - smoothstep(0.35, 0.75, dustLanes) * galacticPlane * (0.85 * uDustLaneIntensity);
  col *= dustMask;
  
  // 6. LOCAL STAR-FORMING REGIONS / REALITY NEBULA VEIL
  float HII_region = fbm3(d * 2.2 + vec3(-5.2, 3.1, -1.8));
  float nebulaIon = pow(smoothstep(0.45, 0.82, HII_region), 2.2) * galacticPlane;
  vec3 HII_col = mix(uColorA * 0.1, uColorB * 0.12, sin(d.x * 3.0) * 0.5 + 0.5);
  col += HII_col * nebulaIon * (1.5 * uNebulaIntensity);
  
  // 7. MULTI-SCALE PROCEDURAL STARS
  vec3 starCell1 = floor(d * 900.0);
  float s1 = starHash(starCell1);
  float starThreshold1 = mix(0.9992, 0.9980, uStarDensity);
  if(s1 > starThreshold1) {
    float starDist1 = length(fract(d * 900.0) - 0.5);
    float b = pow((s1 - starThreshold1) / (1.0 - starThreshold1), 2.5) * smoothstep(0.45, 0.0, starDist1);
    vec3 specCol = mix(vec3(0.65, 0.82, 1.0), uStarColor, fract(s1 * 17.0));
    col += specCol * b * 0.55 * dustMask;
  }

  vec3 starCell2 = floor(d * 1500.0);
  float s2 = starHash(starCell2);
  float starThreshold2 = mix(0.9998, 0.9994, uStarDensity);
  if(s2 > starThreshold2) {
    float starDist2 = length(fract(d * 1500.0) - 0.5);
    float b = pow((s2 - starThreshold2) / (1.0 - starThreshold2), 3.0) * smoothstep(0.45, 0.0, starDist2);
    vec3 specCol = mix(vec3(0.8, 0.9, 1.0), uStarColor, fract(s2 * 31.0));
    col += specCol * b * 0.85;
  }
  
  float alpha = edgeAlpha * (1.0 - smoothstep(0.88, 0.998, k));
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`;

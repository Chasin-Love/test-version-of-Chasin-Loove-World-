import * as THREE from 'three';
import type { RealityConfig } from '../../realities/types';
import { universeSurfaceVert, universeSurfaceFrag } from './surfaceShaders';
import { getSurfaceConfigForReality } from './surfacePresets';
import type { UniverseSurfaceConfig, UniverseSurfaceUpdateParams } from './types';

/**
 * Creates a circular soft radial gradient texture for star sprites.
 */
function makeGlowTexture(size: number, stops: [number, string][]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([pos, col]) => g.addColorStop(pos, col));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

/**
 * UniverseSurfaceManager
 * 
 * Manages the entire visual backdrop of the universe ("Universe Surface"):
 * - Inverted Celestial Sky Sphere with multi-layered cosmic web, nebulae & Kamui vacuum
 * - Deep-space outer star shell (far stars)
 * - Volumetric deep nebular clouds
 * - Near-neighborhood celestial bodies (Sirius, Vega, Proxima, etc.)
 * 
 * Completely decoupled from celestial bodies, black holes, and the anchor star.
 * Future developers and AI models can freely modify the Universe Surface here
 * without any risk of affecting planet physics or orbital mechanics.
 */
export class UniverseSurfaceManager {
  private scene: THREE.Scene;
  private skyDomeMesh!: THREE.Mesh;
  private backdropMat!: THREE.ShaderMaterial;
  private farStarsPoints!: THREE.Points;
  private skyNebulae: THREE.Points[] = [];
  private gNeighborhood = new THREE.Group();
  private levelSprites: { mat: THREE.SpriteMaterial; base: number }[] = [];
  private currentConfig: UniverseSurfaceConfig;

  constructor(scene: THREE.Scene, initialReality?: RealityConfig | string | null) {
    this.scene = scene;
    this.currentConfig = getSurfaceConfigForReality(initialReality);
    this.buildSkyDome();
    this.buildDeepNebulae();
    this.buildFarStars();
    this.buildNeighborhood();
  }

  /**
   * 1. The Inverted Celestial Sky Sphere
   */
  private buildSkyDome(): void {
    const colA = new THREE.Color(this.currentConfig.colorA);
    const colB = new THREE.Color(this.currentConfig.colorB);
    const deepCol = new THREE.Color(this.currentConfig.deepColor);
    const starCol = new THREE.Color(this.currentConfig.starColor);
    const webCol = new THREE.Color(this.currentConfig.webFilaments);

    this.backdropMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uKamuiErase: { value: 0 },
        uVortexDir: { value: new THREE.Vector3(0, 0, -1) },
        uColorA: { value: colA },
        uColorB: { value: colB },
        uDeepColor: { value: deepCol },
        uStarColor: { value: starCol },
        uWebFilaments: { value: webCol },
        uNebulaIntensity: { value: this.currentConfig.nebulaIntensity },
        uDustLaneIntensity: { value: this.currentConfig.dustLaneIntensity },
        uStarDensity: { value: this.currentConfig.starDensity },
      },
      vertexShader: universeSurfaceVert,
      fragmentShader: universeSurfaceFrag,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      transparent: true,
    });

    const dome = new THREE.Mesh(new THREE.SphereGeometry(460000, 48, 32), this.backdropMat);
    dome.frustumCulled = false;
    dome.renderOrder = -100; // Always the first transparent layer painted behind everything
    this.scene.add(dome);
    this.skyDomeMesh = dome;
  }

  /**
   * 2. Deep-Sky Volumetric Nebulae
   */
  private buildDeepNebulae(): void {
    const R = Math.random;
    const mkNebula = (col: [number, number, number], center: [number, number, number], radius: number, count: number) => {
      const pos = new Float32Array(count * 3);
      const size = new Float32Array(count);
      const colArr = new Float32Array(count * 3);
      const alp = new Float32Array(count);

      for (let i = 0; i < count; i++) {
        const r = Math.pow(R(), 0.7) * radius;
        const t = R() * Math.PI * 2;
        const p = Math.acos(2 * R() - 1);
        pos[i * 3] = center[0] + r * Math.sin(p) * Math.cos(t);
        pos[i * 3 + 1] = center[1] + r * Math.cos(p);
        pos[i * 3 + 2] = center[2] + r * Math.sin(p) * Math.sin(t);
        size[i] = 3.2 + R() * 5.5;
        colArr[i * 3] = col[0];
        colArr[i * 3 + 1] = col[1];
        colArr[i * 3 + 2] = col[2];
        alp[i] = 0.08 + R() * 0.16;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
      geo.setAttribute('aColor', new THREE.BufferAttribute(colArr, 3));
      geo.setAttribute('aAlpha', new THREE.BufferAttribute(alp, 1));

      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uScale: { value: 4.0 },
          uTime: { value: 0 },
          uTwinkle: { value: 1.0 },
          uOpacity: { value: 1.0 },
        },
        vertexShader: /* glsl */ `
          attribute float aSize; attribute vec3 aColor; attribute float aAlpha;
          uniform float uScale; uniform float uTime; uniform float uTwinkle;
          varying vec3 vColor; varying float vAlpha;
          void main(){
            vColor = aColor;
            float tw = uTwinkle > 0.5 ? (0.8 + 0.2 * sin(uTime * 1.5 + position.x * 0.001)) : 1.0;
            vAlpha = aAlpha * tw;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = clamp(aSize * uScale * (260.0 / max(-mv.z, 0.001)), 2.0, 48.0);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uOpacity;
          varying vec3 vColor; varying float vAlpha;
          void main(){
            vec2 c = gl_PointCoord - 0.5;
            float d = length(c);
            if (d >= 0.49) discard;
            float core = exp(-d * d * 18.0);
            gl_FragColor = vec4(vColor, vAlpha * core * uOpacity);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      mat.userData.immuneToVortex = true; // Immune to any portal suction
      const pts = new THREE.Points(geo, mat);
      pts.userData.immuneToVortex = true;
      pts.frustumCulled = false;
      this.skyNebulae.push(pts);
      this.scene.add(pts);
    };

    mkNebula([0.15, 0.35, 0.55], [-140000, 60000, -190000], 120000, 1600);
    mkNebula([0.18, 0.40, 0.65], [170000, -50000, 120000], 100000, 1400);
    mkNebula([0.20, 0.42, 0.60], [60000, 140000, 170000], 90000, 1100);
  }

  /**
   * 3. Far Outer Deep Star Shell (Beyond everything)
   */
  private buildFarStars(): void {
    const R = Math.random;
    const count = 1600;
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const colArr = new Float32Array(count * 3);
    const alp = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const r = 320000 + R() * 160000;
      const t = R() * Math.PI * 2;
      const p = Math.acos(2 * R() - 1);
      pos[i * 3] = r * Math.sin(p) * Math.cos(t);
      pos[i * 3 + 1] = r * Math.cos(p);
      pos[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
      size[i] = 0.5 + R() * 1.0;
      colArr[i * 3] = 0.6;
      colArr[i * 3 + 1] = 0.68;
      colArr[i * 3 + 2] = 0.85;
      alp[i] = 0.25 + R() * 0.3;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colArr, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alp, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uScale: { value: 1.2 },
        uTime: { value: 0 },
        uTwinkle: { value: 0 },
        uOpacity: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute float aSize; attribute vec3 aColor; attribute float aAlpha;
        uniform float uScale;
        varying vec3 vColor; varying float vAlpha;
        void main(){
          vColor = aColor;
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * uScale * (260.0 / max(-mv.z, 0.001)), 1.5, 36.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying vec3 vColor; varying float vAlpha;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if(d >= 0.49) discard;
          float core = exp(-d * d * 36.0);
          gl_FragColor = vec4(mix(vColor, vec3(1.0, 0.96, 0.9), core * 0.5), vAlpha * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    mat.userData.immuneToVortex = true; // Immune to portal suction
    const far = new THREE.Points(geo, mat);
    far.userData.immuneToVortex = true;
    far.frustumCulled = false;
    this.farStarsPoints = far;
    this.scene.add(far);
  }

  /**
   * 4. Near Neighborhood Star Shell & Named Nearby Stars
   */
  private buildNeighborhood(): void {
    const R = Math.random;

    // Near star shell points
    const count = 2600;
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const colArr = new Float32Array(count * 3);
    const alp = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const r = 700 + R() * 2300;
      const t = R() * Math.PI * 2;
      const p = Math.acos(2 * R() - 1);
      pos[i * 3] = r * Math.sin(p) * Math.cos(t);
      pos[i * 3 + 1] = r * Math.cos(p) * 0.7;
      pos[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
      size[i] = 0.5 + R() * 1.1;
      const w = R();
      const c = w > 0.8 ? [1, 0.85, 0.65] : w > 0.5 ? [0.8, 0.88, 1] : [0.72, 0.78, 0.9];
      colArr[i * 3] = c[0];
      colArr[i * 3 + 1] = c[1];
      colArr[i * 3 + 2] = c[2];
      alp[i] = 0.35 + R() * 0.6;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colArr, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alp, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uScale: { value: 2.1 },
        uTime: { value: 0 },
        uTwinkle: { value: 1 },
        uOpacity: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute float aSize; attribute vec3 aColor; attribute float aAlpha;
        uniform float uScale; uniform float uTime; uniform float uTwinkle;
        varying vec3 vColor; varying float vAlpha;
        void main(){
          vColor = aColor;
          float tw = uTwinkle > 0.5 ? (0.76 + 0.24 * sin(uTime * 2.6 + position.x * 17.3 + position.y * 11.1 + position.z * 7.7)) : 1.0;
          vAlpha = aAlpha * tw;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * uScale * (260.0 / max(-mv.z, 0.001)), 1.5, 36.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying vec3 vColor; varying float vAlpha;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if(d >= 0.49) discard;
          float core = exp(-d * d * 36.0);
          gl_FragColor = vec4(mix(vColor, vec3(1.0, 0.96, 0.9), core * 0.5), vAlpha * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    mat.userData.immuneToVortex = true;
    const near = new THREE.Points(geo, mat);
    near.userData.immuneToVortex = true;
    near.frustumCulled = false;
    this.gNeighborhood.add(near);

    // Named neighbor star sprites
    const glowWarm = makeGlowTexture(128, [[0, 'rgba(255,244,220,1)'], [0.25, 'rgba(255,220,160,0.55)'], [1, 'rgba(255,200,120,0)']]);
    const glowCool = makeGlowTexture(128, [[0, 'rgba(230,240,255,1)'], [0.25, 'rgba(170,200,255,0.55)'], [1, 'rgba(150,180,255,0)']]);
    const named: [string, number, number, number, boolean][] = [
      ['SIRIUS', 900, 260, -1400, false],
      ['VEGA', -1300, 520, 800, false],
      ['PROXIMA', 420, -140, 640, true],
      ['ALTAIN', -700, -380, -900, true],
      ['KEID', 1500, -300, 600, false],
    ];

    named.forEach(([, x, y, z, warm]) => {
      const m = new THREE.SpriteMaterial({ map: warm ? glowWarm : glowCool, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
      const s = new THREE.Sprite(m);
      s.position.set(x, y, z);
      s.scale.setScalar(60 + R() * 50);
      s.frustumCulled = false;
      this.gNeighborhood.add(s);
      this.levelSprites.push({ mat: m, base: m.opacity });
    });

    this.scene.add(this.gNeighborhood);
  }

  /**
   * Set the active reality to dynamically update the Universe Surface.
   * Seamlessly shifts the celestial canvas palette without affecting any scene bodies.
   */
  public setReality(reality?: RealityConfig | string | null): void {
    this.currentConfig = getSurfaceConfigForReality(reality);
    if (!this.backdropMat) return;

    const u = this.backdropMat.uniforms;
    (u.uColorA.value as THREE.Color).set(this.currentConfig.colorA);
    (u.uColorB.value as THREE.Color).set(this.currentConfig.colorB);
    (u.uDeepColor.value as THREE.Color).set(this.currentConfig.deepColor);
    (u.uStarColor.value as THREE.Color).set(this.currentConfig.starColor);
    (u.uWebFilaments.value as THREE.Color).set(this.currentConfig.webFilaments);
    u.uNebulaIntensity.value = this.currentConfig.nebulaIntensity;
    u.uDustLaneIntensity.value = this.currentConfig.dustLaneIntensity;
    u.uStarDensity.value = this.currentConfig.starDensity;
  }

  /**
   * Called on every animation frame.
   */
  public update(params: UniverseSurfaceUpdateParams): void {
    const { clockT, kamuiErase, vortexDir, skyVisible, neighborhoodVisibility } = params;

    if (this.skyDomeMesh) {
      this.skyDomeMesh.visible = skyVisible;
    }

    if (this.backdropMat) {
      this.backdropMat.uniforms.uKamuiErase.value = kamuiErase * 0.5;
      this.backdropMat.uniforms.uTime.value = clockT;
      (this.backdropMat.uniforms.uVortexDir.value as THREE.Vector3).copy(vortexDir);
    }

    // Neighborhood visibility and smooth opacity fade
    this.gNeighborhood.visible = neighborhoodVisibility > 0.01;
    if (this.gNeighborhood.visible) {
      const op = Math.max(0, Math.min(1, neighborhoodVisibility));
      this.levelSprites.forEach(({ mat, base }) => {
        mat.opacity = base * op;
      });
      const pts = this.gNeighborhood.children.find((c) => c instanceof THREE.Points) as THREE.Points | undefined;
      if (pts && pts.material instanceof THREE.ShaderMaterial) {
        pts.material.uniforms.uOpacity.value = op;
        pts.material.uniforms.uTime.value = clockT;
      }
    }

    // Update far stars & nebulae uniforms
    if (this.farStarsPoints?.material instanceof THREE.ShaderMaterial) {
      this.farStarsPoints.material.uniforms.uTime.value = clockT;
    }

    this.skyNebulae.forEach((neb) => {
      if (neb.material instanceof THREE.ShaderMaterial) {
        neb.material.uniforms.uTime.value = clockT;
      }
    });
  }

  public getBackdropMaterial(): THREE.ShaderMaterial {
    return this.backdropMat;
  }

  public getSkyDomeMesh(): THREE.Mesh {
    return this.skyDomeMesh;
  }

  public getNeighborhoodGroup(): THREE.Group {
    return this.gNeighborhood;
  }

  public dispose(): void {
    if (this.skyDomeMesh) {
      this.scene.remove(this.skyDomeMesh);
      this.skyDomeMesh.geometry.dispose();
      this.backdropMat.dispose();
    }
    if (this.farStarsPoints) {
      this.scene.remove(this.farStarsPoints);
      this.farStarsPoints.geometry.dispose();
      (this.farStarsPoints.material as THREE.Material).dispose();
    }
    this.skyNebulae.forEach((neb) => {
      this.scene.remove(neb);
      neb.geometry.dispose();
      (neb.material as THREE.Material).dispose();
    });
    this.skyNebulae = [];
    if (this.gNeighborhood) {
      this.scene.remove(this.gNeighborhood);
    }
  }
}

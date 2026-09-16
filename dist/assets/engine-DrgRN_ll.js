import{M as k,O as Ei,B as yt,F as Ct,S as W,U as Te,V as Mt,W as Me,H as we,N as _i,T as Li,C as z,a as S,A,b as O,R as Vi,c as Bi,d as Wi,L as Ni,e as Oi,f as Ui,g as Di,h as Hi,i as Zi,j as Yi,G as U,k as j,D as tt,l as At,m as J,n as it,o as Ft,p as Wt,q as Xi,r as qi,Q as Ht,s as Re,t as et,u as ji,v as Ki,P as Qi,w as $i,x as ze,y as Zt,z as Vt,E as Rt,I as ce,J as Ae,K as Fe,X as he,Y as Ge,Z as $e,_ as ue,$ as ie,a0 as dt,a1 as Ee,a2 as Je,a3 as ti,a4 as ei,a5 as _e,a6 as ii,a7 as ai,a8 as si,a9 as oi,aa as Ji,ab as ri,ac as ta}from"./three-DWrlOGSQ.js";import{ak as ea,al as ia,am as de,an as me,ab as ni,ao as li,ap as ci,aq as aa}from"./index-GMijZo2G.js";import"./react-FdIrbp_3.js";const xe={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};class Kt{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}const sa=new Ei(-1,1,1,-1,0,1);class oa extends yt{constructor(){super(),this.setAttribute("position",new Ct([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new Ct([0,2,0,0,2,0],2))}}const ra=new oa;class Ue{constructor(t){this._mesh=new k(ra,t)}dispose(){this._mesh.geometry.dispose()}render(t){t.render(this._mesh,sa)}get material(){return this._mesh.material}set material(t){this._mesh.material=t}}class na extends Kt{constructor(t,e="tDiffuse"){super(),this.textureID=e,this.uniforms=null,this.material=null,t instanceof W?(this.uniforms=t.uniforms,this.material=t):t&&(this.uniforms=Te.clone(t.uniforms),this.material=new W({name:t.name!==void 0?t.name:"unspecified",defines:Object.assign({},t.defines),uniforms:this.uniforms,vertexShader:t.vertexShader,fragmentShader:t.fragmentShader})),this._fsQuad=new Ue(this.material)}render(t,e,a){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=a.texture),this._fsQuad.material=this.material,this.renderToScreen?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(e),this.clear&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),this._fsQuad.render(t))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class hi extends Kt{constructor(t,e){super(),this.scene=t,this.camera=e,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(t,e,a){const i=t.getContext(),o=t.state;o.buffers.color.setMask(!1),o.buffers.depth.setMask(!1),o.buffers.color.setLocked(!0),o.buffers.depth.setLocked(!0);let s,l;this.inverse?(s=0,l=1):(s=1,l=0),o.buffers.stencil.setTest(!0),o.buffers.stencil.setOp(i.REPLACE,i.REPLACE,i.REPLACE),o.buffers.stencil.setFunc(i.ALWAYS,s,4294967295),o.buffers.stencil.setClear(l),o.buffers.stencil.setLocked(!0),t.setRenderTarget(a),this.clear&&t.clear(),t.render(this.scene,this.camera),t.setRenderTarget(e),this.clear&&t.clear(),t.render(this.scene,this.camera),o.buffers.color.setLocked(!1),o.buffers.depth.setLocked(!1),o.buffers.color.setMask(!0),o.buffers.depth.setMask(!0),o.buffers.stencil.setLocked(!1),o.buffers.stencil.setFunc(i.EQUAL,1,4294967295),o.buffers.stencil.setOp(i.KEEP,i.KEEP,i.KEEP),o.buffers.stencil.setLocked(!0)}}class la extends Kt{constructor(){super(),this.needsSwap=!1}render(t){t.state.buffers.stencil.setLocked(!1),t.state.buffers.stencil.setTest(!1)}}class ca{constructor(t,e){if(this.renderer=t,this._pixelRatio=t.getPixelRatio(),e===void 0){const a=t.getSize(new Mt);this._width=a.width,this._height=a.height,e=new Me(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:we}),e.texture.name="EffectComposer.rt1"}else this._width=e.width,this._height=e.height;this.renderTarget1=e,this.renderTarget2=e.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new na(xe),this.copyPass.material.blending=_i,this.timer=new Li}swapBuffers(){const t=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=t}addPass(t){this.passes.push(t),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(t,e){this.passes.splice(e,0,t),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(t){const e=this.passes.indexOf(t);e!==-1&&this.passes.splice(e,1)}isLastEnabledPass(t){for(let e=t+1;e<this.passes.length;e++)if(this.passes[e].enabled)return!1;return!0}render(t){this.timer.update(),t===void 0&&(t=this.timer.getDelta());const e=this.renderer.getRenderTarget();let a=!1;for(let i=0,o=this.passes.length;i<o;i++){const s=this.passes[i];if(s.enabled!==!1){if(s.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(i),s.render(this.renderer,this.writeBuffer,this.readBuffer,t,a),s.needsSwap){if(a){const l=this.renderer.getContext(),r=this.renderer.state.buffers.stencil;r.setFunc(l.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,t),r.setFunc(l.EQUAL,1,4294967295)}this.swapBuffers()}hi!==void 0&&(s instanceof hi?a=!0:s instanceof la&&(a=!1))}}this.renderer.setRenderTarget(e)}reset(t){if(t===void 0){const e=this.renderer.getSize(new Mt);this._pixelRatio=this.renderer.getPixelRatio(),this._width=e.width,this._height=e.height,t=this.renderTarget1.clone(),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=t,this.renderTarget2=t.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(t,e){this._width=t,this._height=e;const a=this._width*this._pixelRatio,i=this._height*this._pixelRatio;this.renderTarget1.setSize(a,i),this.renderTarget2.setSize(a,i);for(let o=0;o<this.passes.length;o++)this.passes[o].setSize(a,i)}setPixelRatio(t){this._pixelRatio=t,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}class ha extends Kt{constructor(t,e,a=null,i=null,o=null){super(),this.scene=t,this.camera=e,this.overrideMaterial=a,this.clearColor=i,this.clearAlpha=o,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new z}render(t,e,a){const i=t.autoClear;t.autoClear=!1;let o,s;this.overrideMaterial!==null&&(s=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(t.getClearColor(this._oldClearColor),t.setClearColor(this.clearColor,t.getClearAlpha())),this.clearAlpha!==null&&(o=t.getClearAlpha(),t.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&t.clearDepth(),t.setRenderTarget(this.renderToScreen?null:a),this.clear===!0&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),t.render(this.scene,this.camera),this.clearColor!==null&&t.setClearColor(this._oldClearColor),this.clearAlpha!==null&&t.setClearAlpha(o),this.overrideMaterial!==null&&(this.scene.overrideMaterial=s),t.autoClear=i}}const ua={uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new z(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};class jt extends Kt{constructor(t,e=1,a,i){super(),this.strength=e,this.radius=a,this.threshold=i,this.resolution=t!==void 0?new Mt(t.x,t.y):new Mt(256,256),this.clearColor=new z(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let o=Math.round(this.resolution.x/2),s=Math.round(this.resolution.y/2);this.renderTargetBright=new Me(o,s,{type:we}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let n=0;n<this.nMips;n++){const c=new Me(o,s,{type:we});c.texture.name="UnrealBloomPass.h"+n,c.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(c);const m=new Me(o,s,{type:we});m.texture.name="UnrealBloomPass.v"+n,m.texture.generateMipmaps=!1,this.renderTargetsVertical.push(m),o=Math.round(o/2),s=Math.round(s/2)}const l=ua;this.highPassUniforms=Te.clone(l.uniforms),this.highPassUniforms.luminosityThreshold.value=i,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new W({uniforms:this.highPassUniforms,vertexShader:l.vertexShader,fragmentShader:l.fragmentShader}),this.separableBlurMaterials=[];const r=[6,10,14,18,22];o=Math.round(this.resolution.x/2),s=Math.round(this.resolution.y/2);for(let n=0;n<this.nMips;n++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(r[n])),this.separableBlurMaterials[n].uniforms.invSize.value=new Mt(1/o,1/s),o=Math.round(o/2),s=Math.round(s/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=e,this.compositeMaterial.uniforms.bloomRadius.value=.1;const f=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=f,this.bloomTintColors=[new S(1,1,1),new S(1,1,1),new S(1,1,1),new S(1,1,1),new S(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=Te.clone(xe.uniforms),this.blendMaterial=new W({uniforms:this.copyUniforms,vertexShader:xe.vertexShader,fragmentShader:xe.fragmentShader,premultipliedAlpha:!0,blending:A,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new z,this._oldClearAlpha=1,this._basic=new O,this._fsQuad=new Ue(null)}dispose(){for(let t=0;t<this.renderTargetsHorizontal.length;t++)this.renderTargetsHorizontal[t].dispose();for(let t=0;t<this.renderTargetsVertical.length;t++)this.renderTargetsVertical[t].dispose();this.renderTargetBright.dispose();for(let t=0;t<this.separableBlurMaterials.length;t++)this.separableBlurMaterials[t].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(t,e){let a=Math.round(t/2),i=Math.round(e/2);this.renderTargetBright.setSize(a,i);for(let o=0;o<this.nMips;o++)this.renderTargetsHorizontal[o].setSize(a,i),this.renderTargetsVertical[o].setSize(a,i),this.separableBlurMaterials[o].uniforms.invSize.value=new Mt(1/a,1/i),a=Math.round(a/2),i=Math.round(i/2)}render(t,e,a,i,o){t.getClearColor(this._oldClearColor),this._oldClearAlpha=t.getClearAlpha();const s=t.autoClear;t.autoClear=!1,t.setClearColor(this.clearColor,0),o&&t.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=a.texture,t.setRenderTarget(null),t.clear(),this._fsQuad.render(t)),this.highPassUniforms.tDiffuse.value=a.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,t.setRenderTarget(this.renderTargetBright),t.clear(),this._fsQuad.render(t);let l=this.renderTargetBright;for(let r=0;r<this.nMips;r++)this._fsQuad.material=this.separableBlurMaterials[r],this.separableBlurMaterials[r].uniforms.colorTexture.value=l.texture,this.separableBlurMaterials[r].uniforms.direction.value=jt.BlurDirectionX,t.setRenderTarget(this.renderTargetsHorizontal[r]),t.clear(),this._fsQuad.render(t),this.separableBlurMaterials[r].uniforms.colorTexture.value=this.renderTargetsHorizontal[r].texture,this.separableBlurMaterials[r].uniforms.direction.value=jt.BlurDirectionY,t.setRenderTarget(this.renderTargetsVertical[r]),t.clear(),this._fsQuad.render(t),l=this.renderTargetsVertical[r];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,t.setRenderTarget(this.renderTargetsHorizontal[0]),t.clear(),this._fsQuad.render(t),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,o&&t.state.buffers.stencil.setTest(!0),this.renderToScreen?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(a),this._fsQuad.render(t)),t.setClearColor(this._oldClearColor,this._oldClearAlpha),t.autoClear=s}_getSeparableBlurMaterial(t){const e=[],a=t/3;for(let i=0;i<t;i++)e.push(.39894*Math.exp(-.5*i*i/(a*a))/a);return new W({defines:{KERNEL_RADIUS:t},uniforms:{colorTexture:{value:null},invSize:{value:new Mt(.5,.5)},direction:{value:new Mt(.5,.5)},gaussianCoefficients:{value:e}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				#include <common>

				varying vec2 vUv;

				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {

					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;

					for ( int i = 1; i < KERNEL_RADIUS; i ++ ) {

						float x = float( i );
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += ( sample1 + sample2 ) * w;

					}

					gl_FragColor = vec4( diffuseSum, 1.0 );

				}`})}_getCompositeMaterial(t){return new W({defines:{NUM_MIPS:t},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				varying vec2 vUv;

				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor( const in float factor ) {

					float mirrorFactor = 1.2 - factor;
					return mix( factor, mirrorFactor, bloomRadius );

				}

				void main() {

					// 3.0 for backwards compatibility with previous alpha-based intensity
					vec3 bloom = 3.0 * bloomStrength * (
						lerpBloomFactor( bloomFactors[ 0 ] ) * bloomTintColors[ 0 ] * texture2D( blurTexture1, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 1 ] ) * bloomTintColors[ 1 ] * texture2D( blurTexture2, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 2 ] ) * bloomTintColors[ 2 ] * texture2D( blurTexture3, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 3 ] ) * bloomTintColors[ 3 ] * texture2D( blurTexture4, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 4 ] ) * bloomTintColors[ 4 ] * texture2D( blurTexture5, vUv ).rgb
					);

					float bloomAlpha = max( bloom.r, max( bloom.g, bloom.b ) );
					gl_FragColor = vec4( bloom, bloomAlpha );

				}`})}}jt.BlurDirectionX=new Mt(1,0);jt.BlurDirectionY=new Mt(0,1);const fe={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};class da extends Kt{constructor(){super(),this.isOutputPass=!0,this.uniforms=Te.clone(fe.uniforms),this.material=new Vi({name:fe.name,uniforms:this.uniforms,vertexShader:fe.vertexShader,fragmentShader:fe.fragmentShader}),this._fsQuad=new Ue(this.material),this._outputColorSpace=null,this._toneMapping=null}render(t,e,a){this.uniforms.tDiffuse.value=a.texture,this.uniforms.toneMappingExposure.value=t.toneMappingExposure,(this._outputColorSpace!==t.outputColorSpace||this._toneMapping!==t.toneMapping)&&(this._outputColorSpace=t.outputColorSpace,this._toneMapping=t.toneMapping,this.material.defines={},Bi.getTransfer(this._outputColorSpace)===Wi&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===Ni?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===Oi?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===Ui?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===Di?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===Hi?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===Zi?this.material.defines.NEUTRAL_TONE_MAPPING="":this._toneMapping===Yi&&(this.material.defines.CUSTOM_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(e),this.clear&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),this._fsQuad.render(t))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}const lt=`
vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0,0.5,1.0,2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0,i1.z,i2.z,1.0))
        + i.y + vec4(0.0,i1.y,i2.y,1.0)) + i.x + vec4(0.0,i1.x,i2.x,1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0*floor(p*ns.z*ns.z);
  vec4 x_ = floor(j*ns.z);
  vec4 y_ = floor(j - 7.0*x_);
  vec4 x = x_*ns.x + ns.yyyy;
  vec4 y = y_*ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
  m = m*m;
  return 42.0*dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){
  float f = 0.0; float a = 0.5;
  for(int i=0;i<5;i++){ f += a*snoise(p); p *= 2.03; a *= 0.5; }
  return f;
}
float fbm3(vec3 p){
  float f = 0.0; float a = 0.5;
  for(int i=0;i<3;i++){ f += a*snoise(p); p *= 2.11; a *= 0.5; }
  return f;
}
`,ui=`
varying vec3 vN; varying vec3 vW; varying vec3 vP;
void main(){
  vN = normalize(mat3(modelMatrix) * normal);
  vW = (modelMatrix * vec4(position,1.0)).xyz;
  vP = position;
  gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
}`,di=`
uniform float uTime; uniform float uBoost;
uniform vec3 uColorA; uniform vec3 uColorB; uniform vec3 uCoreColor;
varying vec3 vN; varying vec3 vW; varying vec3 vP;
${lt}

// Ultra-detailed thermal palette adapted to current reality's star spectrum
vec3 getStarColor(float t, float spot) {
  vec3 colA = length(uColorA) > 0.05 ? uColorA : vec3(1.0, 0.65, 0.15);
  vec3 colB = length(uColorB) > 0.05 ? uColorB : vec3(0.9, 0.2, 0.02);
  vec3 coreCol = length(uCoreColor) > 0.05 ? uCoreColor : vec3(1.0, 1.0, 1.0);

  vec3 dark = colB * 0.12;
  vec3 cool = colB;
  vec3 warm = colA;
  vec3 hot  = mix(colA, coreCol, 0.65);
  vec3 core = coreCol;
  
  vec3 col = mix(dark, cool, smoothstep(0.0, 0.3, t));
  col = mix(col, warm, smoothstep(0.3, 0.6, t));
  col = mix(col, hot, smoothstep(0.6, 0.85, t));
  col = mix(col, core, smoothstep(0.85, 1.0, t));
  
  // Sunspots dim the thermal emission strongly
  return mix(col, dark, spot);
}

void main(){
  vec3 n = normalize(vN);
  vec3 viewDir = normalize(cameraPosition - vW);
  float mu = max(dot(n, viewDir), 0.0);
  
  vec3 q = normalize(vP);
  float t_slow = uTime * 0.015;
  float t_fast = uTime * 0.04;
  
  // 1. High-frequency Granulation (convection cells)
  float n1 = fbm3(q * 38.0 + vec3(t_fast));
  float n2 = fbm3(q * 72.0 - vec3(t_fast * 1.3));
  float gran = abs(n1 + n2 * 0.5); // cellular look
  gran = 1.0 - smoothstep(0.0, 1.3, gran);
  gran = pow(gran, 2.2); // sharp cell edges
  
  // 2. Magnetic Flux Tubes / Solar Filaments (swirling structures)
  vec3 warp = q * 2.2 + vec3(fbm3(q * 1.8 + t_slow));
  float tubes = fbm(warp * 4.2 - vec3(0.0, t_slow, 0.0));
  
  // 3. Sunspots (dark magnetic disturbances)
  float spotNoise = fbm(q * 3.2 + vec3(t_slow * 0.6));
  float spots = smoothstep(0.62, 0.85, spotNoise);
  // Penumbra (lighter outer ring of spot)
  float penumbra = smoothstep(0.45, 0.62, spotNoise) - spots;
  
  // Combine temperatures
  // Base temp modified by granulation and filaments
  float temp = 0.25 + 0.35 * gran + 0.4 * tubes;
  // Boost temperature at filament ridges (plages/active regions)
  temp += smoothstep(0.4, 0.8, tubes) * 0.35;
  
  // spot strength
  float spotFactor = spots * 0.95 + penumbra * 0.55;
  
  vec3 col = getStarColor(clamp(temp, 0.0, 1.0), spotFactor);
  
  // Extreme limb darkening (center is much brighter, edges are darker/redder)
  float limb = pow(max(mu, 0.0), 0.55); 
  col *= mix(vec3(0.5, 0.1, 0.0), vec3(1.0), limb);
  
  // Active region glowing near limbs
  float limbGlow = pow(1.0 - mu, 3.0);
  vec3 limbCol = length(uColorA) > 0.05 ? uColorA : vec3(1.0, 0.5, 0.1);
  col += limbCol * limbGlow * (tubes * 1.8) * uBoost;
  
  float pulse = 1.0 + 0.02 * sin(uTime * 0.6);
  col *= pulse * uBoost;
  
  // Incandescent central glow
  vec3 coreHighlight = length(uCoreColor) > 0.05 ? uCoreColor : vec3(1.0, 0.95, 0.85);
  col += coreHighlight * pow(max(mu, 0.0), 4.5) * 0.35;
  
  gl_FragColor = vec4(col * 1.25, 1.0);
}`,Yt=`
uniform float uTear; uniform float uTearTime; uniform float uReverse;
uniform vec3 uGravityCenter; uniform vec3 uGravityLocalCenter;
uniform float uGravityRadius; uniform float uGravityStrength; uniform float uGravityTime;
varying vec3 vN; varying vec3 vW; varying vec3 vP; varying float vTear;
${lt}
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 nView = normalize(normalMatrix * normal);
  vec3 centerView = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 viewAxis = normalize(-centerView);
  float front = max(dot(nView, viewAxis), 0.0);
  float spot = pow(front, 5.0);
  vec3 swirlAxis = normalize(cross(viewAxis, nView) + vec3(0.0001, 0.0, 0.0));

  /* Embedded spatial core: object-space sphere deformation with radial
     compression, differential rotation, and multi-scale flow noise. The
     core center arrives pre-transformed into this mesh's local space
     (uGravityLocalCenter) — no per-vertex matrix inverse needed. */
  vec3 coreDelta = position - uGravityLocalCenter;
  float coreDistance = length(coreDelta);
  float field = uGravityRadius > 0.0
    ? pow(max(0.0, 1.0 - coreDistance / uGravityRadius), 1.65) * uGravityStrength
    : 0.0;
  /* The portal field radius is intentionally much larger than the body.
     Normalize the deformation to the actual sphere so the planet remains a
     visible, continuous surface while its shell bends inward. */
  float bodyRadius = max(length(position), 0.001);
  float bodyInfluence = clamp(uGravityStrength, 0.0, 1.0);
  float radiusNorm = clamp(coreDistance / max(bodyRadius * 2.0, 0.001), 0.001, 1.0);
  /* Differential (Keplerian-style) rotation: the inner region spins far
     faster than the rim, so the shell reads as matter shearing around a
     gravitational structure — never like a texture merely rotating. */
  float angularVelocity = 1.15 / pow(max(radiusNorm, 0.07), 0.55);
  float angle = field * angularVelocity * (0.55 + 0.22 * sin(uGravityTime * 1.7 + coreDistance * 0.08)) * uReverse;
  float cs = cos(angle);
  vec3 radial = normalize(coreDelta + vec3(0.0001));
  vec3 tangent = normalize(cross(vec3(0.0, 1.0, 0.0), radial) + vec3(0.0001));
  float largeFlow = snoise(radial * 3.0 + vec3(uGravityTime * 0.12));
  float mediumFlow = snoise(radial * 9.0 - vec3(uGravityTime * 0.4));
  float turbulence = (largeFlow * 0.65 + mediumFlow * 0.35) * field;
  float localField = field * bodyInfluence;
  vec3 bentRadial = radial * (1.0 - localField * (0.12 + 0.10 * turbulence));
  vec3 bentTangent = tangent * (sin(angle) * localField * (0.16 + 0.10 * mediumFlow));
  vec3 surfaceOffset = bentRadial * bodyRadius * 0.16 + bentTangent * bodyRadius * 0.12;
  /* Never displace the shell by more than a controlled fraction of its own
     radius; this prevents the entire planet from vanishing. */
  float offsetLimit = bodyRadius * 0.24;
  surfaceOffset = clamp(length(surfaceOffset), 0.0, offsetLimit) * normalize(surfaceOffset + vec3(0.0001));
  mv.xyz += mat3(viewMatrix * modelMatrix) * surfaceOffset;

  float csFlow = cs - 1.0;
  mv.xyz += mat3(viewMatrix * modelMatrix) * (radial * bodyRadius * csFlow * localField * 0.08);
  float around = atan(nView.z, nView.x);
  float wave = sin(around * 8.0 + uTearTime * 5.4 + front * 18.0);
  float fracture = pow(max(0.0, 0.5 + 0.5 * sin(around * 13.0 - uTearTime * 4.2 + front * 31.0)), 8.0);
  float shell = exp(-pow((front - (0.66 + 0.09 * sin(around * 5.0 + uTearTime * 1.7))) / 0.14, 2.0));
  float radius = length(position);

  /* Local Planet Kamui: the actual sphere surface caves inward and slides
     around its own center. This is vertex geometry, never a screen overlay.
     uReverse flips the whole flow for the return traversal — suction becomes
     expulsion and the swirl unwinds the opposite way. */
  float flow = uTear * uReverse;
  float suction = flow * spot * (0.34 + 0.22 * (0.5 + 0.5 * wave));
  float shear = flow * spot * (0.18 * wave + 0.08 * fracture);
  float rimKick = flow * shell * fracture * 0.12;
  mv.xyz -= nView * radius * suction;
  mv.xyz += swirlAxis * radius * shear;
  mv.xyz += nView * radius * rimKick;

  vN = normalize(mat3(modelMatrix) * normal);
  vW = (modelMatrix * vec4(position, 1.0)).xyz;
  vP = position;
  vTear = uTear * spot;
  gl_Position = projectionMatrix * mv;
}`,mi=`
uniform vec3 uDeep; uniform vec3 uBase; uniform vec3 uHigh; uniform vec3 uIce;
uniform vec3 uGravityCenter; uniform float uGravityRadius; uniform float uGravityStrength; uniform float uGravityTime;
uniform vec3 uSunDir; uniform float uTime; uniform float uSea; uniform float uGhost;
uniform float uNight; uniform vec3 uSeed; uniform float uFade;
uniform float uTear; uniform float uTearTime; uniform float uReverse;
varying vec3 vN; varying vec3 vW; varying vec3 vP; varying float vTear;
${lt}
void main(){
  vec3 n = normalize(vN);
  vec3 q = normalize(vP) + uSeed;

  /* Planet-centered reality lens. The field is evaluated in world space and
     only bends the rendered surface; no camera overlay or object transform is
     involved. */
  vec3 gravityDelta = vW - uGravityCenter;
  float gravityDistance = length(gravityDelta);
  float gravityFalloff = uGravityRadius > 0.0
    ? pow(max(0.0, 1.0 - gravityDistance / uGravityRadius), 2.4) * uGravityStrength
    : 0.0;
  float gravityAngle = gravityFalloff * (1.8 + 2.4 * sin(uGravityTime * 2.0 + gravityDistance * 0.018));
  float gravitySpin = sin(gravityAngle + gravityDistance * 0.03);
  float gravityCompression = gravityFalloff * (0.35 + 0.25 * gravitySpin);
  
  float warp = fbm3(q*2.3);
  float h = fbm(q*2.9 + warp*0.55);
  
  // High-frequency detail added to the height directly for coloring (not normals)
  float detail = fbm(q*9.0)*0.16;
  h += detail;
  
  float land = smoothstep(uSea - 0.03, uSea + 0.03, h);
  vec3 terrain = mix(uDeep, uBase, smoothstep(uSea, uSea + 0.30, h));
  terrain = mix(terrain, uHigh, smoothstep(uSea + 0.28, uSea + 0.62, h));
  
  float lat = abs(normalize(vP).y);
  float iceMask = smoothstep(0.62, 0.86, lat + h*0.18 - 0.1);
  terrain = mix(terrain, uIce, iceMask);
  
  vec3 ocean = uDeep * (0.75 + 0.45*smoothstep(-0.5, uSea, h));
  vec3 col = mix(ocean, terrain, land);
  
  // Smooth lighting based on actual sphere normal
  float sun = dot(n, normalize(uSunDir));
  float day = smoothstep(-0.12, 0.28, sun);
  
  // Gentle ambient boost
  vec3 lit = col * (0.15 + 1.15*day);

  /* Surface-level event horizon and fracture light. The world remains the
     source image; only the region being swallowed darkens, caves, and tears. */
  vec3 viewDir = normalize(cameraPosition - vW);
  float visibleFront = max(dot(n, viewDir), 0.0);
  float surfaceAngle = atan(n.z, n.x);
  float tearNoise = fbm(q * 6.5 + vec3(uTearTime * 0.08, -uTearTime * 0.05, uTearTime * 0.06));
  float fracture = pow(max(0.0, 0.5 + 0.5 * sin(surfaceAngle * 13.0 + visibleFront * 28.0 - uTearTime * 4.8 + tearNoise * 4.0)), 12.0);
  float tearRing = exp(-pow((visibleFront - (0.68 + 0.08 * sin(surfaceAngle * 5.0 + uTearTime * 1.7))) / 0.12, 2.0));
  float aperture = vTear * smoothstep(0.28, 0.92, visibleFront);
  /* Darken the swallowed surface without adding a second camera-facing layer.
     The embedded singularity is revealed through the planet's own shell. */
  lit *= 1.0 - aperture * 0.82;
  lit += vec3(1.0, 0.86, 0.58) * fracture * uTear * 0.62;
  /* dense, high-energy edge glow traces the compressed reality surface */
  lit += vec3(0.65, 0.82, 1.0) * gravityFalloff * (0.18 + 0.22 * sin(uGravityTime * 5.0 + gravityDistance * 0.04));
  lit *= 1.0 + gravityCompression * 0.32;
  lit += mix(vec3(0.9, 0.55, 0.25), vec3(0.42, 0.9, 1.0), 0.5 + 0.5 * sin(uTearTime * 2.0)) * tearRing * uTear * 0.48;

  /* Spiral accretion flow — log-spiral bands wrap the opening and anisotropic
     noise stretches them into elongated luminous streaks, never clean rings.
     Color stays inside the body's own palette; uReverse unwinds the spiral
     for the return traversal. */
  float rr = 1.0 - visibleFront;
  float armPhase = surfaceAngle * 3.0 + pow(max(rr, 0.001), 0.62) * 21.0
    - uReverse * uTearTime * 2.6 + tearNoise * 2.4;
  float arms = pow(max(0.0, 0.5 + 0.5 * sin(armPhase)), 2.2);
  float streak = fbm3(vec3(cos(surfaceAngle) * 2.2, sin(surfaceAngle) * 2.2, rr * 9.0 - uReverse * uTearTime * 0.55));
  arms *= 0.55 + 0.45 * streak;
  float tearBand = uTear * smoothstep(0.30, 0.55, visibleFront) * (1.0 - smoothstep(0.88, 0.99, visibleFront));
  vec3 flowCol = mix(vec3(1.0, 0.86, 0.6), col, 0.35);
  lit += flowCol * arms * tearBand * uTear * 0.85;
  /* bright compressed accretion rim around the deepening mouth */
  float accretionRim = exp(-pow((visibleFront - 0.72) / 0.10, 2.0));
  lit += mix(vec3(1.0, 0.9, 0.7), vec3(0.75, 0.85, 1.0), 0.4 + 0.4 * sin(uTearTime * 2.2))
    * accretionRim * uTear * (0.35 + 0.5 * arms) * 0.8;
  /* deep dimensional throat — normal surface information is swallowed */
  float throat = smoothstep(0.86, 0.995, visibleFront) * uTear;
  lit *= 1.0 - throat * 0.96;

  float spec = pow(max(dot(reflect(-normalize(uSunDir), n), viewDir), 0.0), 42.0);
  lit += vec3(1.0, 0.92, 0.78) * spec * (1.0 - land) * day * 0.55;
  
  float cityMask = smoothstep(0.52, 0.78, fbm(q*7.5 + 11.0)) * land * (1.0 - iceMask);
  vec3 nightCol = vec3(1.0, 0.78, 0.42) * cityMask * uNight * (1.0 - day) * 0.9;
  lit += nightCol;
  
  float term = smoothstep(-0.14, 0.14, sun);
  lit = mix(lit * vec3(0.5, 0.62, 0.85), lit, term);
  lit = mix(lit, vec3(0.45, 0.53, 0.66) * (0.25 + 0.75*day), uGhost);
  
  gl_FragColor = vec4(lit, uFade);
}`,fi=`
uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSeed; uniform float uCover; uniform float uFade;
uniform vec3 uGravityCenter; uniform float uGravityRadius; uniform float uGravityStrength; uniform float uGravityTime;
uniform float uTear;
varying vec3 vN; varying vec3 vW; varying vec3 vP;
${lt}
void main(){
  vec3 q = normalize(vP) + uSeed;
  float c = fbm(q*3.4 + vec3(uTime*0.012, 0.0, uTime*0.008));
  c += 0.35*fbm(q*8.0 - vec3(uTime*0.02));
  float a = smoothstep(0.62 - uCover*0.3, 0.86, c);
  float front = max(dot(normalize(vN), normalize(cameraPosition - vW)), 0.0);
  float aperture = uTear * smoothstep(0.28, 0.92, front);
  if (uTear > 0.22 && aperture > 0.70) discard;
  float sun = dot(normalize(vN), normalize(uSunDir));
  float day = smoothstep(-0.2, 0.4, sun); // softened terminator
  vec3 col = vec3(1.0) * (0.25 + 0.85*day); // gentler ambient
  gl_FragColor = vec4(col, a * 0.82 * uFade);
}`,pi=`
uniform vec3 uColor; uniform float uStrength; uniform vec3 uSunDir;
uniform float uTear;
varying vec3 vN; varying vec3 vW;
void main(){
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  float ndotv = abs(dot(n, v));
  float aperture = uTear * smoothstep(0.28, 0.92, max(dot(n, v), 0.0));
  if (uTear > 0.22 && aperture > 0.66) discard;
  float rim = pow(max(1.0 - ndotv, 0.0), 3.5);
  float sun = dot(n, normalize(uSunDir));
  float day = smoothstep(-0.25, 0.25, sun);
  float a = rim * uStrength * (0.35 + 0.65*day);
  vec3 col = mix(uColor * 0.8, uColor * 1.5, day);
  gl_FragColor = vec4(col, a);
}`,Le=`
uniform vec3 uGravityLocalCenter; uniform float uGravityStrength; uniform float uGravityTime;
uniform float uOuter; uniform float uReverse;
varying vec2 vP;
void main(){
  vec3 p3 = position;
  /* Kamui field — the ring is real geometry beside the core: its radii
     compress and the annulus shears into a spiral, inner edge leading.
     Evaluated in the ring's own plane, normalized to the ring's span so the
     inner edge always reacts harder than the trailing outer edge. */
  vec2 delta = p3.xy - uGravityLocalCenter.xy;
  float rn = clamp(length(delta) / max(uOuter, 0.001), 0.0, 1.0);
  float infl = uGravityStrength * pow(1.0 - rn, 1.2);
  if (infl > 0.001) {
    float a = uReverse * infl * (3.0 + 5.0 * (1.0 - rn)) * (0.72 + 0.28 * sin(uGravityTime * 1.4 + rn * 9.0));
    float ca = cos(a), sa = sin(a);
    vec2 spun = vec2(delta.x * ca - delta.y * sa, delta.x * sa + delta.y * ca);
    p3.xy = uGravityLocalCenter.xy + spun * (1.0 - infl * 0.26);
  }
  vP = p3.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p3, 1.0);
}`,vi=`
uniform float uInner; uniform float uOuter; uniform vec3 uTint; uniform vec3 uSunLocal;
varying vec2 vP;
${lt}
void main(){
  float r = length(vP);
  float t = (r - uInner) / (uOuter - uInner);
  if(t < 0.0 || t > 1.0) discard;
  float bands = 0.5 + 0.5*snoise(vec3(t*46.0, 3.7, 1.3));
  bands *= 0.55 + 0.45*snoise(vec3(t*130.0, 9.1, 4.4));
  float gap1 = smoothstep(0.02, 0.07, abs(t - 0.62));
  float gap2 = smoothstep(0.015, 0.05, abs(t - 0.31));
  float edge = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.9, 1.0, t));
  float a = bands * gap1 * gap2 * edge * 0.9;
  vec2 dir = normalize(vP + vec2(1e-5));
  vec2 sl = normalize(uSunLocal.xy + vec2(1e-4));
  float shade = 0.3 + 0.7*smoothstep(-0.5, 0.35, dot(dir, sl));
  float lit = 0.45 + 0.55*abs(uSunLocal.z);
  vec3 col = mix(vec3(0.62, 0.55, 0.44), uTint, 0.45) * lit * shade * 1.5;
  gl_FragColor = vec4(col, a);
}`,ma=`
uniform float uTime; uniform float uInner; uniform float uOuter;
uniform vec3 uColor; uniform vec3 uColor2;
varying vec2 vP;
${lt}
void main(){
  float r = length(vP);
  float t = (r - uInner) / (uOuter - uInner);
  if(t < 0.0 || t > 1.0) discard;
  float ang = atan(vP.y, vP.x);
  float swirl = fbm3(vec3(cos(ang)*2.0 + r*3.0 - uTime*0.9, sin(ang)*2.0, r*6.0 - uTime*0.6));
  float heat = pow(1.0 - t, 2.2);
  float streaks = 0.55 + 0.45*sin(ang*9.0 + r*30.0 - uTime*2.4 + swirl*4.0);
  vec3 col = mix(uColor, uColor2, heat);
  float a = heat * streaks * (0.4 + 0.6*smoothstep(0.0, 0.18, t)) * (1.0 - smoothstep(0.7, 1.0, t));
  a *= 0.75 + 0.25*swirl;
  gl_FragColor = vec4(col * (0.8 + heat*1.4), a * 0.9);
}`,gi=`
uniform vec3 uCamLocalP;
varying vec2 vUv;
varying vec3 vLocalP;
varying vec3 vWorldP;
varying vec3 vCamLocalP;

void main(){
  vUv = uv;
  vLocalP = position;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldP = worldPosition.xyz;
  vCamLocalP = uCamLocalP;

  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}`,yi=`
uniform float uTime;
uniform vec3 uColorA; // Ionized gas / cyan-indigo ambient
uniform vec3 uColorB; // Deep dust / amber warm scattering
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vLocalP;
varying vec3 vWorldP;
varying vec3 vCamLocalP;

${lt}

// Intersect ray O + t*D with axis-aligned bounding box [-bounds, bounds]
vec2 intersectAABB(vec3 ro, vec3 rd, vec3 boxMin, vec3 boxMax) {
  vec3 invD = 1.0 / (rd + vec3(1e-7));
  vec3 t0 = (boxMin - ro) * invD;
  vec3 t1 = (boxMax - ro) * invD;
  vec3 tmin = min(t0, t1);
  vec3 tmax = max(t0, t1);
  float tn = max(max(tmin.x, tmin.y), tmin.z);
  float tf = min(min(tmax.x, tmax.y), tmax.z);
  return vec2(tn, tf);
}

// 3D Density evaluation for procedural astronomical Pillars of Creation & Stellar Nursery
// Returns vec4(dustDensity, gasDensity, photoIonization, temperature)
vec4 evalNebula3D(vec3 p, float t) {
  // Domain warping for multi-scale turbulent 3D fluid motion & filaments
  vec3 warp = vec3(
    fbm3(p * 2.2 + vec3(0.0, t * 0.01, 0.0)),
    fbm3(p * 2.4 + vec3(1.7, -t * 0.008, 0.5)),
    fbm3(p * 2.1 + vec3(3.2, 0.8, t * 0.012))
  );
  vec3 pw = p + warp * 0.38;

  // 1. LEFT TOWERING PILLAR (Rising from lower-middle, broad base narrowing upward, top bending right)
  vec3 p1 = pw - vec3(-0.42, -0.15, 0.02);
  p1.x += sin(p1.y * 2.8 + t * 0.02) * 0.08; // Organic curving body
  p1.z += cos(p1.y * 3.2) * 0.05;
  float h1 = (p1.y + 0.8) / 1.35; // Normalized height [0, 1]
  float width1 = 0.22 * (1.0 - smoothstep(-0.8, 0.55, p1.y) * 0.58);
  // Finger-like columns and eroded tip extensions at upper tip
  float tip1 = exp(-pow((p1.y - 0.48) / 0.14, 2.0)) * (sin(p1.x * 22.0 + 1.2) * 0.035 + cos(p1.z * 18.0) * 0.025);
  float d1 = length(p1.xz) - (width1 + tip1);
  float p1Mask = smoothstep(0.08, -0.06, d1) * smoothstep(-0.9, -0.65, p1.y) * (1.0 - smoothstep(0.48, 0.62, p1.y));

  // 2. CENTER TALLEST & MOST VISUALLY DOMINANT PILLAR (Elongated, narrow/bulky sections, protruding ridges)
  vec3 p2 = pw - vec3(-0.05, -0.05, -0.08);
  p2.x += cos(p2.y * 3.4 - t * 0.015) * 0.06;
  p2.z += sin(p2.y * 4.1) * 0.06;
  float width2 = 0.18 * (1.0 - smoothstep(-0.85, 0.75, p2.y) * 0.52);
  // Protruding 3D ridges and branching structures
  float ridges2 = sin(p2.y * 14.0) * cos(p2.x * 12.0) * 0.03;
  float tip2 = exp(-pow((p2.y - 0.78) / 0.16, 2.0)) * (cos(p2.x * 26.0) * 0.04 + sin(p2.z * 20.0) * 0.03);
  float d2 = length(p2.xz) - (width2 + ridges2 + tip2);
  float p2Mask = smoothstep(0.08, -0.05, d2) * smoothstep(-0.92, -0.72, p2.y) * (1.0 - smoothstep(0.78, 0.88, p2.y));

  // 3. UPPER-RIGHT BRANCHING PILLAR COMPLEX (Claw-like sculpted silhouette, connected via diffuse gas)
  vec3 p3 = pw - vec3(0.42, 0.25, -0.12);
  p3.x += sin(p3.y * 4.5) * 0.05;
  p3.z += cos(p3.y * 3.8) * 0.05;
  // Multiple upward extensions / claw arms
  float claw1 = length(p3.xz - vec2(-0.06, 0.02)) - 0.09;
  float claw2 = length(p3.xz - vec2(0.08, -0.04)) - 0.07;
  float d3 = min(claw1, claw2);
  float p3Mask = smoothstep(0.07, -0.05, d3) * smoothstep(-0.4, -0.15, p3.y) * (1.0 - smoothstep(0.68, 0.82, p3.y));

  // 4. LOWER-CENTER FOREGROUND BULBOUS CLOUD MOUND (Dense mound of gas & dust with dark cavities & folds)
  vec3 p4 = pw - vec3(0.05, -0.62, 0.32);
  float d4 = length(p4) - 0.38 + fbm3(p4 * 6.0) * 0.12;
  float p4Mask = smoothstep(0.12, -0.08, d4);

  // 5. FAR-RIGHT / LOWER-RIGHT EDGE CLOUD (Enormous cloud structure entering frame partially)
  vec3 p5 = pw - vec3(0.85, -0.48, 0.08);
  float d5 = length(p5) - 0.48 + fbm3(p5 * 4.5) * 0.15;
  float p5Mask = smoothstep(0.15, -0.1, d5);

  // Combine primary dust structures
  float mainPillars = max(max(max(p1Mask, p2Mask), p3Mask), max(p4Mask, p5Mask));

  // Multi-scale 3D FBM noise to carve filaments, cavities, knots, and erosion channels
  float microNoise = fbm(pw * 5.8) * 0.5 + fbm3(pw * 14.0) * 0.25;
  float dustDensity = clamp(mainPillars * (0.65 + microNoise * 0.75) - (microNoise - 0.35) * 0.3, 0.0, 1.0);

  // Diffuse background nebular gas fill between structures
  float bgGas = fbm3(pw * 1.8 + vec3(0.0, 0.0, t * 0.01)) * 0.45;
  bgGas += exp(-length(pw.xy) * 1.8) * 0.35;
  float gasDensity = clamp(bgGas + dustDensity * 0.85, 0.0, 1.0);

  // Photo-ionization UV radiation surface erosion calculation
  vec3 lightDirUV = normalize(vec3(-0.75, 0.65, 0.8));
  // Compute finite difference numerical gradient of dust density for surface normals
  vec3 eps = vec3(0.02, 0.02, 0.02);
  float dX = fbm(pw + vec3(eps.x, 0.0, 0.0)) - fbm(pw - vec3(eps.x, 0.0, 0.0));
  float dY = fbm(pw + vec3(0.0, eps.y, 0.0)) - fbm(pw - vec3(0.0, eps.y, 0.0));
  float dZ = fbm(pw + vec3(0.0, 0.0, eps.z)) - fbm(pw - vec3(0.0, 0.0, eps.z));
  vec3 grad = normalize(vec3(dX, dY, dZ) + vec3(1e-5));
  float photoIonization = pow(clamp(dot(-grad, lightDirUV), 0.0, 1.0), 1.8) * smoothstep(0.05, 0.6, dustDensity);

  float temperature = smoothstep(0.1, 0.85, dustDensity) + photoIonization * 0.5;

  return vec4(dustDensity, gasDensity, photoIonization, temperature);
}

void main(){
  // Bounding local space [-1.2, 1.2]^3
  vec3 boxMin = vec3(-1.25);
  vec3 boxMax = vec3(1.25);

  vec3 ro = vCamLocalP;
  vec3 rd = normalize(vLocalP - vCamLocalP);

  vec2 hit = intersectAABB(ro, rd, boxMin, boxMax);
  if (hit.x > hit.y || hit.y < 0.0) discard;

  float tNear = max(0.0, hit.x);
  float tFar = hit.y;

  // Volumetric Raymarching Settings
  const int STEPS = 54;
  float stepSize = (tFar - tNear) / float(STEPS);
  float tCurrent = tNear;

  vec3 accumColor = vec3(0.0);
  float transmittance = 1.0;

  // Color Palette Definitions
  vec3 colDeepBackground = vec3(0.008, 0.015, 0.038); // Deep Cosmic Blue Backdrop
  vec3 colIonizedCyan = length(uColorA) > 0.05 ? uColorA : vec3(0.12, 0.78, 0.95); // Ionized Cyan/Blue
  vec3 colGoldenYellow = vec3(1.0, 0.72, 0.22); // Warm Golden Yellow
  vec3 colAmberOrange = length(uColorB) > 0.05 ? uColorB : vec3(0.95, 0.48, 0.12); // Amber Orange
  vec3 colCopperRed = vec3(0.82, 0.26, 0.06); // Copper Reddish
  vec3 colDarkDustCharcoal = vec3(0.08, 0.05, 0.04); // Dark Charcoal Dust
  vec3 colDarkRedUmber = vec3(0.22, 0.10, 0.05); // Dark Reddish Brown
  vec3 colPaleCreamHighlight = vec3(1.0, 0.96, 0.88); // Subtle Pale Cream Highlights

  float simTime = uTime * 0.05;

  for (int i = 0; i < STEPS; i++) {
    vec3 p = ro + rd * tCurrent;

    // Sample 3D Nebular Density
    vec4 nData = evalNebula3D(p, uTime);
    float dDust = nData.x;
    float dGas = nData.y;
    float photoIon = nData.z;
    float temp = nData.w;

    if (dGas > 0.001 || dDust > 0.001) {
      // Physical Dust Color Transition (Charcoal -> Reddish Brown -> Illuminated Amber)
      vec3 dustColor = mix(colDarkDustCharcoal, colDarkRedUmber, smoothstep(0.1, 0.6, dDust));

      // Physical Gas Emission Color Transition (Golden Yellow -> Amber -> Copper -> Cream Highlights)
      vec3 gasColor = mix(colCopperRed, colAmberOrange, smoothstep(0.1, 0.45, temp));
      gasColor = mix(gasColor, colGoldenYellow, smoothstep(0.45, 0.8, temp));
      gasColor = mix(gasColor, colPaleCreamHighlight, smoothstep(0.8, 1.0, temp));

      // Photo-ionization UV Rim Glow (Cool blue-white & electric cyan edges)
      vec3 rimGlow = mix(colIonizedCyan, vec3(0.85, 0.95, 1.0), photoIon * 0.6) * photoIon * 2.4;

      // Combine emission and scattering
      vec3 stepEmission = mix(gasColor, dustColor, dDust * 0.88) * dGas * 1.6 + rimGlow;

      // Optical Absorption / Extinction
      float stepAbsorption = (dDust * 4.8 + dGas * 0.85) * stepSize;
      float stepTransmittance = exp(-stepAbsorption);

      // Accumulate color scaled by current transmittance
      accumColor += transmittance * stepEmission * (1.0 - stepTransmittance);
      transmittance *= stepTransmittance;

      if (transmittance < 0.015) break; // Early ray termination when optically opaque
    }

    tCurrent += stepSize;
  }

  // Blend background cosmic blue into unabsorbed ray transmittance
  vec3 finalCol = accumColor + colDeepBackground * transmittance;

  // Edge boundary opacity falloff
  vec3 edgeDist = abs(vLocalP) / 1.25;
  float maxEdge = max(max(edgeDist.x, edgeDist.y), edgeDist.z);
  float edgeFade = smoothstep(1.0, 0.6, maxEdge);

  float alpha = (1.0 - transmittance) * edgeFade * uOpacity;
  if (alpha < 0.002) discard;

  gl_FragColor = vec4(finalCol * 1.35, clamp(alpha, 0.0, 1.0));
}`,fa=`
attribute float aSize; attribute vec3 aColor; attribute float aAlpha;
uniform float uScale; uniform float uTime; uniform float uTwinkle;
uniform vec3 uVortexC; uniform float uVortexR; uniform float uVortexS; uniform float uVortexT;
uniform float uVortexPull; uniform float uVortexRev;
varying vec3 vColor; varying float vAlpha; varying float vSize;
void main(){
  vColor = aColor;
  float tw = uTwinkle > 0.5 ? (0.76 + 0.24 * sin(uTime * 2.6 + position.x * 17.3 + position.y * 11.1 + position.z * 7.7)) : 1.0;
  vAlpha = aAlpha * tw;
  /* Kamui tear vortex — a consumption wave expands from the tear point:
     nearest points are bent, spun and pulled into the center first, then the
     wave reaches farther ones (nearest-first suction). Consumed points dissolve.
     uVortexRev flips the swirl for the return traversal and a negative
     uVortexPull ejects matter back outward (white-hole release). */
  vec3 vp = position;
  if (uVortexS > 0.001) {
    float d = distance(vp, uVortexC);
    float infl = uVortexS * smoothstep(uVortexR, uVortexR * 0.1, d);
    if (infl > 0.001) {
      vec3 axis = normalize(vec3(0.18, 1.0, 0.12));
      vec3 dir = vp - uVortexC;
      float rev = uVortexRev < 0.0 ? -1.0 : 1.0;
      float a = infl * (5.0 + uVortexT * 3.5) * rev;
      vec3 spun = dir * cos(a) + cross(axis, dir) * sin(a) * 1.15;
      float pullAmt = clamp(abs(uVortexPull), 0.0, 1.0);
      float radial = infl * (0.5 + pullAmt * 0.5) * (uVortexPull < 0.0 ? -1.45 : 1.0);
      vp = uVortexC + spun * max(0.035, 1.0 - radial);
      vAlpha *= (1.0 - infl * (0.6 + pullAmt * 0.3));
    }
  }
  vec4 mv = modelViewMatrix * vec4(vp, 1.0);
  float pSize = aSize * uScale * (260.0 / max(-mv.z, 0.001));
  gl_PointSize = clamp(pSize, 1.5, 36.0);
  vSize = gl_PointSize;
  gl_Position = projectionMatrix * mv;
}`,pa=`
uniform float uOpacity;
varying vec3 vColor; varying float vAlpha; varying float vSize;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if(d >= 0.49) discard;
  
  float mask = smoothstep(0.49, 0.0, d);
  float core = exp(-d * d * 36.0);
  float halo = exp(-d * 6.0) * 0.22;
  
  vec3 col = mix(vColor, vec3(1.0, 0.96, 0.9), core * 0.5);
  float a = (core * 0.85 + halo) * mask * vAlpha * uOpacity;
  
  if (a < 0.003) discard;
  
  gl_FragColor = vec4(col, a);
}`,va=`
uniform vec3 uDeep; uniform vec3 uBase; uniform vec3 uHigh; uniform vec3 uIce;
uniform vec3 uSunDir; uniform vec3 uFog; uniform float uFogDensity;
varying vec3 vN; varying vec3 vW; varying vec3 vP;
${lt}
void main(){
  vec3 n = normalize(vN);
  vec3 q = vP * 0.16;
  float h = fbm(q*1.4);
  float patch = smoothstep(0.0, 0.4, fbm(q*0.5 + 9.0));
  vec3 col = mix(uBase, uHigh, smoothstep(0.05, 0.5, h));
  col = mix(col, uDeep, smoothstep(-0.1, -0.45, h) * 0.7);
  col = mix(col, uIce * 0.9, smoothstep(0.55, 0.8, h) * 0.4);
  float sun = max(dot(n, normalize(uSunDir)), 0.0);
  /* night ambient raised — the dark side must read as ground, not void */
  vec3 lit = col * (0.3 + 1.05*sun);
  float dist = length(cameraPosition - vW);
  float fog = 1.0 - exp(-dist * dist * uFogDensity * uFogDensity);
  lit = mix(lit, uFog, clamp(fog, 0.0, 1.0));
  gl_FragColor = vec4(lit, 1.0);
}`,ga=`
varying vec3 vN; varying vec3 vW; varying vec3 vP;
void main(){
  vN = normalize(mat3(modelMatrix) * normal);
  vW = (modelMatrix * vec4(position,1.0)).xyz;
  vP = position;
  gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
}`,bi=`
varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy;
  gl_Position = projectionMatrix * mv;
}`,Mi=`
uniform float uTime; uniform float uBoost;
uniform vec3 uColorA; uniform vec3 uColorB;
varying vec2 vUv;
${lt}

void main(){
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  if(r > 1.0) discard;
  
  float ang = atan(p.y, p.x);
  float t = uTime * 0.05;
  
  // Base field distortion for plasma swirling
  float swirl = fbm(vec3(p * 2.5, t)) * 0.8;
  float angDist = ang + swirl * (1.0 - r); 
  
  // Radial magnetic rays (high frequency)
  float rayNoise1 = snoise(vec3(cos(angDist)*4.0, sin(angDist)*4.0, t * 2.0));
  float rayNoise2 = snoise(vec3(cos(angDist)*14.0, sin(angDist)*14.0, t * 4.0 + 10.0));
  float rays = rayNoise1 * 0.5 + rayNoise2 * 0.25;
  rays = rays * 0.5 + 0.5; // map to 0..1
  
  // Sweeping Coronal Mass Ejections (CMEs) / Prominences
  float eruptDist = ang - swirl * 1.5 - r * 2.5;
  float eruptions = fbm3(vec3(cos(eruptDist)*1.5, sin(eruptDist)*1.5, t*1.2));
  eruptions = smoothstep(0.3, 0.8, eruptions);
  
  // Smooth physical falloff — inner K-corona bright, outer F-corona faint
  float inner = pow(1.0 - smoothstep(0.12, 0.45, r), 2.8);
  float outer = pow(1.0 - smoothstep(0.2, 1.0, r), 1.8);
  
  // Structure details
  float streaks = 0.35 + 0.65 * pow(rays, 1.8);
  float wisps = eruptions * (1.0 - smoothstep(0.15, 1.0, r)) * 1.8;
  
  // Dynamic spectral palette adapted to active reality
  vec3 colA = length(uColorA) > 0.05 ? uColorA : vec3(1.0, 0.6, 0.15);
  vec3 colB = length(uColorB) > 0.05 ? uColorB : vec3(0.9, 0.15, 0.02);

  vec3 ultraHot = mix(vec3(1.0, 1.0, 1.0), colA, 0.4);
  vec3 warm = colA;
  vec3 deep = colB;
  
  // Blend colors radially and structurally
  vec3 col = mix(deep, warm, inner * streaks + wisps * 0.5);
  col = mix(col, ultraHot, pow(inner, 3.0));
  
  // Opacity masking
  float a = (inner * streaks * 0.9 + outer * 0.3 * (0.3 + 0.7*streaks) + wisps * 0.45);
  
  // Hide the center slightly so it doesn't wash out the star completely (additive blending)
  float starMask = smoothstep(0.15, 0.20, r);
  a *= (0.4 + 0.6 * starMask);
  
  a *= uBoost;
  
  gl_FragColor = vec4(col * (1.0 + inner * 1.5), a * (1.0 - smoothstep(0.8, 1.0, r)));
}`,ya=`
varying vec3 vDir;

void main(){
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,ba=`
uniform float uTime;
uniform float uKamuiErase;
uniform vec3 uVortexDir;
varying vec3 vDir;
${lt}

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
  // AUTHENTIC KAMUI SPACE-TIME NINJUTSU: PURE GEOMETRIC SPACE BENDING & VACUUM
  // =========================================================================
  // No external lightning, no artificial lines, no fake energy fx.
  // Space itself bends, twists, spirals into a singularity vacuum that sucks
  // reality in (and uncurls/releases when entering).
  if (k > 0.0005) {
    vec3 vAxis = normalize(uVortexDir);
    if (length(vAxis) < 0.01) {
      vAxis = vec3(0.0, 0.0, -1.0);
    }
    
    // Dynamic orthonormal coordinate frame aligned directly with camera sightline
    vec3 upRef = abs(vAxis.y) < 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangentX = normalize(cross(vAxis, upRef));
    vec3 tangentY = cross(tangentX, vAxis);
    
    // Angular displacement from the Kamui vortex center [0, PI]
    float dotV = clamp(dot(rawD, vAxis), -1.0, 1.0);
    float alpha = acos(dotV);
    float r = alpha / 3.14159265; // Normalized spherical radius [0, 1]
    
    // Azimuthal angle around vortex center [-PI, PI]
    float theta = atan(dot(rawD, tangentY), dot(rawD, tangentX));
    
    // 1. Relativistic Logarithmic Spiral Streamlines & Frame-Dragging Vortex
    // In polar vortex flow, space flows along logarithmic spirals: theta'(r) = theta + Omega(r, t)
    float vortexTwist = (18.0 * pow(k, 1.25)) / (pow(r, 0.58) + 0.035) + uTime * (5.5 + 4.5 * k);
    float twistedTheta = theta + vortexTwist;
    
    // 2. 3-Blade Spiral Streamline Phase Coordinate
    // Points of constant psi define continuous logarithmic spiral arms twisting into the core
    float psi = 3.0 * theta + (14.0 * pow(k, 1.2)) / (pow(r, 0.52) + 0.05) - uTime * 7.2;
    float spiralArmMetric = sin(psi) * 0.35 * k + cos(psi * 2.0 + uTime * 3.0) * 0.12 * k;
    
    // 3. Authentic Spiral Suction Horizon (True Spiraling Vortex Edge, NOT Concentric Circles)
    // The reality boundary contracts inward as an authentic multi-armed spiral whirlpool
    float spiralHorizon = (1.0 - pow(k, 1.12)) * 1.35 + spiralArmMetric * (1.0 - 0.3 * k);
    spiralHorizon = max(0.0001, spiralHorizon);

    // 4. Inward Logarithmic Suction & Space-Time Metric Compression
    // Coordinates are drawn inward along the logarithmic spiral streamlines into the throat
    float rNorm = r / max(0.001, spiralHorizon);
    float rSuction = pow(clamp(rNorm, 0.0002, 1.0), 1.0 + k * 1.5) * (1.0 + sin(psi) * 0.15 * k);
    rSuction = clamp(rSuction, 0.0002, 1.0);
    float warpedAlpha = rSuction * 3.14159265;

    // Reconstruct the curved, twisted 3D ray through warped space-time
    vec3 warpedRay = cos(twistedTheta) * sin(warpedAlpha) * tangentX +
                     sin(twistedTheta) * sin(warpedAlpha) * tangentY +
                     cos(warpedAlpha) * vAxis;
    d = normalize(warpedRay);

    // Smooth natural edge falloff at the spiraling horizon boundary of the vacuum portal
    float distToHorizon = spiralHorizon - r;
    edgeAlpha = r > spiralHorizon ? smoothstep(0.12, 0.0, r - spiralHorizon) : smoothstep(-0.07, 0.0, distToHorizon);
  }
  
  // Abyssal deep space vacuum background (360-degree dark universe base)
  vec3 col = vec3(0.001, 0.0015, 0.003);
  
  // =========================================================================
  // COSMOLOGICAL HIERARCHY STRUCTURE (From Cosmic Web to Solar System Scale)
  // =========================================================================
  
  // 1. COSMIC WEB & SUPERCLUSTER COMPLEX (Filaments & Voids across billions of light-years)
  vec3 webCoord = d * 4.5 + vec3(uTime * 0.001, 0.0, uTime * 0.0005);
  float n1 = snoise(webCoord);
  float n2 = snoise(webCoord * 2.1 + vec3(3.2, 7.1, 1.4));
  float filaments = pow(max(0.0, 1.0 - abs(n1) - abs(n2)), 3.5);
  float cosmicVoid = smoothstep(0.2, 0.7, abs(fbm3(d * 1.8)));
  
  vec3 webCol = mix(vec3(0.015, 0.035, 0.095), vec3(0.045, 0.025, 0.11), filaments);
  col += webCol * filaments * cosmicVoid * 1.6;
  
  // 2. SUPERCLUSTERS & GALAXY CLUSTERS AT WEB NODES
  float nodes = pow(filaments, 2.5) * smoothstep(0.3, 0.8, fbm3(d * 6.0));
  vec3 superclusterGlow = vec3(0.08, 0.09, 0.16) * nodes * 2.5;
  col += superclusterGlow;
  
  // 3. DISTANT GALAXIES & GALAXY GROUPS
  vec3 galCell = floor(d * 32.0);
  float galHash = starHash(galCell);
  if (galHash > 0.985) {
    float galDist = length(fract(d * 32.0) - 0.5);
    float galFall = smoothstep(0.42, 0.0, galDist);
    float galCore = pow((galHash - 0.985) / 0.015, 3.0) * galFall;
    vec3 galCol = mix(vec3(0.9, 0.7, 0.5), vec3(0.5, 0.7, 1.0), fract(galHash * 43.0));
    col += galCol * galCore * 0.45;
  }
  
  // 4. MILKY WAY GALAXY PLANE & SPIRAL ARMS
  vec3 bn = normalize(vec3(d.x, d.y * 2.2, d.z));
  float galacticPlane = exp(-pow(bn.y * 3.2, 2.0));
  
  vec3 bulgeCol = vec3(0.065, 0.05, 0.075);
  col += bulgeCol * galacticPlane;
  
  // 5. DARK MATTER & INTERSTELLAR DUST LANES
  float dustLanes = fbm3(d * 3.5 + vec3(1.4, -2.1, 4.8));
  float dustMask = 1.0 - smoothstep(0.35, 0.75, dustLanes) * galacticPlane * 0.85;
  col *= dustMask;
  
  // 6. LOCAL STAR-FORMING REGIONS
  float HII_region = fbm3(d * 2.2 + vec3(-5.2, 3.1, -1.8));
  float nebulaIon = pow(smoothstep(0.45, 0.82, HII_region), 2.2) * galacticPlane;
  vec3 HII_col = mix(vec3(0.05, 0.015, 0.06), vec3(0.02, 0.05, 0.08), sin(d.x * 3.0) * 0.5 + 0.5);
  col += HII_col * nebulaIon * 1.5;
  
  // 7. STELLAR SYSTEM & LOCAL FOREGROUND STARS
  vec3 starCell1 = floor(d * 900.0);
  float s1 = starHash(starCell1);
  if(s1 > 0.9986) {
    float starDist1 = length(fract(d * 900.0) - 0.5);
    float b = pow((s1 - 0.9986) / 0.0014, 2.5) * smoothstep(0.45, 0.0, starDist1);
    vec3 specCol = mix(vec3(0.65, 0.82, 1.0), vec3(1.0, 0.85, 0.65), fract(s1 * 17.0));
    col += specCol * b * 0.5 * dustMask;
  }

  vec3 starCell2 = floor(d * 1500.0);
  float s2 = starHash(starCell2);
  if(s2 > 0.9997) {
    float starDist2 = length(fract(d * 1500.0) - 0.5);
    float b = pow((s2 - 0.9997) / 0.0003, 3.0) * smoothstep(0.45, 0.0, starDist2);
    vec3 specCol = mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.92, 0.75), fract(s2 * 31.0));
    col += specCol * b * 0.85;
  }
  
  float alpha = edgeAlpha * (1.0 - smoothstep(0.88, 0.998, k));
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`,wi=`
varying vec3 vN; varying vec3 vW; varying vec3 vP; varying vec3 vSun;
${lt}
void main(){
  vec3 p = position;
  float bump = fbm(p * 1.4) * 0.28 + fbm3(p * 4.8) * 0.08;
  p += normal * bump;
  // Compute displaced normal for smooth non-blocky lighting
  vec3 e1 = vec3(0.01, 0.0, 0.0);
  vec3 e2 = vec3(0.0, 0.01, 0.0);
  float bX = fbm((p + e1) * 1.4) * 0.28;
  float bY = fbm((p + e2) * 1.4) * 0.28;
  vec3 norm = normalize(normal + vec3((bX - bump)*20.0, (bY - bump)*20.0, 0.0));
  vec4 wp;
  #ifdef USE_INSTANCING
    vN = normalize(normalMatrix * (mat3(instanceMatrix) * norm));
    wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  #else
    vN = normalize(normalMatrix * norm);
    wp = modelMatrix * vec4(p, 1.0);
  #endif
  vW = wp.xyz;
  vP = p;
  /* the sun sits at the origin — light direction comes from where the rock actually floats */
  vSun = normalize(-wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,xi=`
uniform vec3 uColor;
varying vec3 vN; varying vec3 vW; varying vec3 vP; varying vec3 vSun;
${lt}
void main(){
  vec3 n = normalize(vN);
  float sun = max(dot(n, normalize(vSun)), 0.0);
  float detail = fbm(vP * 5.5) * 0.35 + 0.65;
  // Crater rim details
  float crater = smoothstep(0.42, 0.68, fbm3(vP * 8.0));
  detail -= crater * 0.25;
  vec3 base = uColor * detail;
  // hard key light + a whisper of warm starlight fill so night sides stay readable
  vec3 lit = base * (0.14 + 1.2 * sun);
  lit += base * vec3(0.42, 0.27, 0.15) * 0.09;
  gl_FragColor = vec4(lit, 1.0);
}`,Ma=`
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunDir;
varying vec3 vW;
void main(){
  vec3 d = normalize(vW - cameraPosition);
  float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(h, 0.8));
  float sun = pow(max(dot(d, normalize(uSunDir)), 0.0), 220.0);
  float halo = pow(max(dot(d, normalize(uSunDir)), 0.0), 8.0);
  col += vec3(1.0, 0.9, 0.72) * sun * 2.2 + vec3(1.0, 0.85, 0.6) * halo * 0.18;
  gl_FragColor = vec4(col, 1.0);
}
`,wa=`
uniform float uTime;
varying vec3 vN;
varying vec3 vW;
varying vec3 vP;
${lt}
void main(){
  vN = normalize(mat3(modelMatrix) * normal);
  vP = position;
  
  // Relativistic Kerr gravitational pulsating surface distortion
  float disp = fbm(position * 0.00035 + vec3(uTime * 0.3, -uTime * 0.2, uTime * 0.25)) * 420.0;
  float pulse = sin(uTime * 2.8 + length(position) * 0.0008) * 180.0;
  vec3 displaced = position + normal * (disp + pulse);
  
  vW = (modelMatrix * vec4(displaced, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
}
`,xa=`
uniform float uTime;
uniform vec3 uColorCore;
uniform vec3 uColorAura;
uniform float uHover;
uniform float uTearStrength;
varying vec3 vN;
varying vec3 vW;
varying vec3 vP;
${lt}

void main(){
  vec3 n = normalize(vN);
  vec3 viewDir = normalize(cameraPosition - vW);
  float mu = max(dot(n, viewDir), 0.0);
  
  vec3 q = normalize(vP);
  float t = uTime * 0.55;
  
  // 1. Relativistic Kerr Frame-Dragging Vortex (differential angular rotation)
  float ang = atan(q.z, q.x);
  float radius = length(q.xz);
  float vortexSpeed = 1.8 / (radius + 0.35);
  float rotAng = ang + t * vortexSpeed;
  
  // 2. Relativistic Doppler Beaming Asymmetry (approaching side is blueshifted & brighter)
  float doppler = sin(ang + t * 0.9) * 0.35 + 0.65;
  
  // 3. Multi-scale Quantum Vacuum Fluctuations & Turbulent Magnetohydrodynamics
  vec3 warpedQ = vec3(cos(rotAng) * radius, q.y, sin(rotAng) * radius);
  float warp = fbm3(warpedQ * 3.8 + vec3(t * 0.25, -t * 0.15, t * 0.18));
  float n1 = fbm(warpedQ * 5.5 + warp * 0.75);
  float n2 = fbm(warpedQ * 12.0 - vec3(t * 0.35, t * 0.2, -t * 0.25));
  float plasma = (n1 * 0.55 + n2 * 0.35 + warp * 0.2) * (0.75 + 0.35 * doppler);
  
  // 4. Supreme Multiverse Spectrum: Deep Void Black -> Electric Sapphire -> Dimensional Violet -> Supernova Amber-Gold
  // Dimmed to preserve rich geometric contrast without blinding white saturation
  vec3 colVoid = vec3(0.008, 0.005, 0.018);
  vec3 colSapphire = vec3(0.015, 0.32, 0.75);
  vec3 colViolet = vec3(0.52, 0.08, 0.72);
  vec3 colAmberGold = vec3(0.85, 0.48, 0.06);
  vec3 colWarmGlow = vec3(0.95, 0.82, 0.65);
  
  vec3 col = mix(colVoid, colSapphire, smoothstep(0.08, 0.42, plasma));
  col = mix(col, colViolet, smoothstep(0.42, 0.72, plasma));
  col = mix(col, colAmberGold, smoothstep(0.72, 0.90, plasma));
  col = mix(col, colWarmGlow, smoothstep(0.90, 0.99, plasma));
  
  // 5. Chromatic Gravitational Lensing Separation
  float chromaR = fbm(warpedQ * 6.2 + vec3(0.05, 0.0, 0.0));
  float chromaB = fbm(warpedQ * 6.2 - vec3(0.05, 0.0, 0.0));
  col.r += chromaR * 0.15 * (1.0 - mu);
  col.b += chromaB * 0.22 * (1.0 - mu);
  
  // 6. Sacred Multidimensional Tesseract Resonance Grid (Crisp neon filament lines)
  float gridX = abs(fract(q.x * 12.0 + t * 0.15) - 0.5);
  float gridY = abs(fract(q.y * 12.0 - t * 0.12) - 0.5);
  float gridZ = abs(fract(q.z * 12.0 + t * 0.18) - 0.5);
  float tesseractLattice = smoothstep(0.46, 0.495, min(gridX, min(gridY, gridZ)));
  col += vec3(0.0, 0.85, 0.75) * tesseractLattice * 0.85 * smoothstep(0.15, 0.85, plasma);
  
  // 7. Photon Ring & Relativistic Event Horizon Rim Glow (Tightly calibrated, non-overexposing)
  float photonRing = pow(1.0 - mu, 3.2);
  float thinCorona = pow(1.0 - mu, 8.5);
  vec3 rimCol = mix(vec3(0.0, 0.85, 0.75), vec3(0.85, 0.12, 0.55), sin(t * 1.2 + q.y * 5.0) * 0.5 + 0.5);
  col += rimCol * photonRing * 0.95 + vec3(0.85, 0.92, 0.98) * thinCorona * 1.1;
  
  // 8. Central Singularity Focus
  float eyeGaze = pow(mu, 6.0);
  col += mix(vec3(0.85, 0.08, 0.32), vec3(0.2, 0.75, 0.85), sin(t * 1.6) * 0.5 + 0.5) * eyeGaze * 0.75;
  
  // Hover & Active Resonance Boost (Clean & subtle)
  col *= 0.92 + uHover * 0.35 + sin(t * 2.5) * 0.06;
  
  // Semi-transparent animated surface tears & cracks overlay before entering Kamui vortex
  float tear = clamp(uTearStrength, 0.0, 1.0);
  if (tear > 0.001) {
    vec3 crackCoord = q * 9.5 + vec3(uTime * 0.14, -uTime * 0.09, uTime * 0.11);
    vec3 warpTear = vec3(
      fbm3(crackCoord + vec3(0.0, 1.5, 3.1)),
      fbm3(crackCoord + vec3(4.1, 0.9, 2.2)),
      fbm3(crackCoord + vec3(2.3, 3.8, 0.5))
    );
    vec3 tearP = crackCoord * 1.5 + warpTear * 2.4;
    
    float ridge1 = abs(snoise(tearP));
    float ridge2 = abs(snoise(tearP * 2.7 + vec3(4.5)));
    
    float crackCore = smoothstep(0.08 * tear + 0.008, 0.0, ridge1);
    float crackEdge = smoothstep(0.25 * tear + 0.015, 0.0, ridge1);
    float subCrack = smoothstep(0.06 * tear + 0.008, 0.0, ridge2) * 0.65;
    
    float crackPattern = max(crackCore, subCrack);
    float crackMask = smoothstep(1.0 - tear * 1.35, 1.0 - tear * 0.75, fbm3(q * 3.5));
    
    vec3 tearGlowCol = mix(vec3(0.0, 0.95, 1.0), vec3(1.0, 0.25, 0.75), sin(uTime * 4.0 + tearP.y * 3.0) * 0.5 + 0.5);
    vec3 tearHotCore = vec3(1.0, 0.98, 0.92);
    vec3 tearColor = mix(tearGlowCol * 3.2, tearHotCore * 5.0, crackCore);
    
    col = mix(col, col + tearColor * (crackPattern * 2.2 + crackEdge * 0.7), crackMask * tear);
  }
  
  gl_FragColor = vec4(col, 0.95);
}
`,Ta=`
varying vec3 vN;
varying vec3 vW;
varying vec3 vP;
varying vec2 vUv;
void main(){
  vN = normalize(normalMatrix * normal);
  vW = (modelMatrix * vec4(position, 1.0)).xyz;
  vP = position;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
}
`,Sa=`
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uKamuiErase;
uniform vec3 uVortexDir;
varying vec3 vN;
varying vec3 vW;
varying vec3 vP;
varying vec2 vUv;
${lt}

void main(){
  float k = clamp(uKamuiErase, 0.0, 1.0);
  vec3 q = normalize(vP);
  
  // Kamui Space-Time Bending & Spiral Suction directly on the Multiverse Hypersphere surface
  if (k > 0.001) {
    vec3 vAxis = normalize(uVortexDir);
    if (length(vAxis) < 0.01) vAxis = vec3(0.0, 0.0, -1.0);
    
    vec3 upRef = abs(vAxis.y) < 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangentX = normalize(cross(vAxis, upRef));
    vec3 tangentY = cross(tangentX, vAxis);
    
    float dotV = clamp(dot(q, vAxis), -1.0, 1.0);
    float alpha = acos(dotV);
    float r = alpha / 3.14159265;
    float theta = atan(dot(q, tangentY), dot(q, tangentX));
    
    // Logarithmic spiral swirling on the giant sphere surface
    float vortexTwist = (14.0 * pow(k, 1.25)) / (pow(r, 0.58) + 0.038) + uTime * (4.2 + 3.8 * k);
    float twistedTheta = theta + vortexTwist;
    
    // Logarithmic metric suction pulling geodesic lines toward vortex axis
    float rSuction = pow(clamp(r, 0.0001, 1.0), 1.0 + k * 1.5);
    float warpedAlpha = rSuction * 3.14159265;
    
    vec3 warpedQ = cos(twistedTheta) * sin(warpedAlpha) * tangentX +
                   sin(twistedTheta) * sin(warpedAlpha) * tangentY +
                   cos(warpedAlpha) * vAxis;
    q = normalize(warpedQ);
  }

  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  float ndotv = abs(dot(n, v));
  float rim = pow(1.0 - ndotv, 2.8);
  
  // Spherical celestial coordinates (Quantum flux geodesics & spiral streamlines)
  float lat = q.y;
  float lon = atan(q.z, q.x);
  
  // Continuous Helical & Spiral Flux Streamlines (No static concentric circles)
  float spiral1 = abs(fract((lon / 3.14159265) * 4.0 + lat * 3.5 - uTime * 0.04) - 0.5);
  float spiral2 = abs(fract((lon / 3.14159265) * 4.0 - lat * 3.5 + uTime * 0.035) - 0.5);
  float flowLines = min(spiral1, spiral2);
  float grid = smoothstep(0.46, 0.492, flowLines);
  
  // Subtle iridescent aurora membrane across outer multiverse sphere
  float aurora = fbm3(q * 3.8 + vec3(uTime * 0.012, uTime * 0.008, 0.0));
  vec3 baseCol = mix(uColorA, uColorB, aurora * 0.5 + 0.5);
  vec3 gridCol = vec3(0.0, 0.96, 0.85);
  
  vec3 col = mix(baseCol * 0.4, gridCol, grid * 0.55);
  col += vec3(0.65, 0.35, 0.95) * rim * 1.4;
  
  if (k > 0.01) {
    float kGlow = sin(uTime * 5.0 + lat * 4.0) * 0.2 + 0.8;
    col += vec3(0.0, 0.95, 0.85) * k * kGlow * 0.45;
  }
  
  float alpha = rim * 0.28 + grid * 0.16 + aurora * 0.07;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.55));
}
`;function Ri(I){const t=(a,i)=>{let o=I^Math.imul(a|0,374761393)^Math.imul(i|0,668265263);return o=Math.imul(o^o>>>13,1274126177),((o^o>>>16)>>>0)/4294967296},e=a=>a*a*(3-2*a);return(a,i)=>{const o=Math.floor(a),s=Math.floor(i),l=e(a-o),r=e(i-s),f=t(o,s),n=t(o+1,s),c=t(o,s+1),m=t(o+1,s+1);return f+(n-f)*l+(c-f)*r+(f-n-c+m)*l*r}}const qt=I=>I<0?0:I>1?1:I,bt=(I,t,e)=>I+(t-I)*e;function Ca(I){const e=document.createElement("canvas");e.width=e.height=1024;const a=e.getContext("2d"),i=a.createImageData(1024,1024),o=i.data,s=Ri(1337),l=1024/2,r=1024/2-2,f=3/12;for(let c=0;c<1024;c++)for(let m=0;m<1024;m++){const y=(m-l)/r,g=(c-l)/r,x=Math.sqrt(y*y+g*g),u=(c*1024+m)*4;if(x<f||x>1)continue;const h=(x-f)/(1-f),d=Math.atan2(g,y);let p=Math.pow(1-h,1.25)*.85+.38*Math.exp(-h*9);const M=Math.cos(d-x*3.2)*5.5,P=Math.sin(d-x*3.2)*5.5,w=s(M+x*9,P+x*5.5)*.55+s(M*2.1+x*16,P*2.1+x*9)*.45,E=.35+.85*qt((w-.2)/.62);p*=E;const D=1+.85*Math.cos(d);p*=.42+.58*D,p*=(1-Pt(.74,1,x))*Pt(f,f+.05,x),p=Math.min(p,3.6);let _,B,C;if(h<.35)_=1,B=bt(.88,.62,h/.35),C=bt(.6,.28,h/.35);else if(h<.75){const F=(h-.35)/.4;_=1,B=bt(.62,.4,F),C=bt(.28,.1,F)}else{const F=(h-.75)/.25;_=.95,B=bt(.4,.24,F),C=bt(.1,.04,F)}const v=qt((D-1.15)*.6)*(1-h)*.55;_=bt(_,.95,v),B=bt(B,.96,v),C=bt(C,1,v);const R=Math.min(255,p*205);o[u]=Math.min(255,_*R*1.4),o[u+1]=Math.min(255,B*R*1.4),o[u+2]=Math.min(255,C*R*1.4),o[u+3]=Math.min(255,qt(p*.75)*255)}a.putImageData(i,0,0);const n=new Ft(e);return n.colorSpace=Wt,n}function Pt(I,t,e){const a=qt((e-I)/(t-I));return a*a*(3-2*a)}function Pa(){const t=document.createElement("canvas");t.width=t.height=256;const e=t.getContext("2d"),a=e.createImageData(256,256);for(let o=0;o<256;o++)for(let s=0;s<256;s++){const l=Math.sqrt((s-128)**2+(o-128)**2)/128,r=Pt(.78,.9,l)*Pt(1,.94,l),f=(o*256+s)*4,n=r*255;He(a.data,f,255*r,235*r,190*r,n)}e.putImageData(a,0,0);const i=new Ft(t);return i.colorSpace=Wt,i}function Ti(I){const e=document.createElement("canvas");e.width=e.height=512;const a=e.getContext("2d"),i=a.createImageData(512,512),o=Ri(I);for(let l=0;l<512;l++)for(let r=0;r<512;r++){const f=(r-256)/256,n=(l-256)/256,c=Math.sqrt(f*f+n*n),m=Math.atan2(n,f),y=Pt(.5,.56,c),g=1-Pt(.56,1,c),x=Pt(.015,.16,Math.abs(n)),u=.7+.3*o(Math.cos(m)*5+9,Math.sin(m)*5+c*22);let h=y*g*u*.95*x;const d=Pt(.5,.53,c)*(1-Pt(.53,.62,c))*x,p=(l*512+r)*4,M=bt(255,255,d),P=bt(190*g+40,245,d),w=bt(120*g+20,255,d);h=qt(h+d*.8),He(i.data,p,M*h,P*h,w*h,h*255)}a.putImageData(i,0,0);const s=new Ft(e);return s.colorSpace=Wt,s}function ka(){const t=document.createElement("canvas");t.width=t.height=512;const e=t.getContext("2d");let a=20260909;const i=()=>(a=a*1664525+1013904223>>>0,a/4294967296),o=e.createRadialGradient(256,256,256*.54,256,256,256);o.addColorStop(0,"rgba(0,0,0,0)"),o.addColorStop(.18,"rgba(215, 225, 255, 0.10)"),o.addColorStop(.55,"rgba(230, 215, 190, 0.13)"),o.addColorStop(1,"rgba(0,0,0,0)"),e.fillStyle=o,e.fillRect(0,0,512,512);const s=170;for(let r=0;r<s;r++){const f=.55+Math.pow(i(),1.35)*.43,n=i()*Math.PI*2,c=(.35+i()*1.6)*(.6+f),m=.6+i()*1.9,y=i()>.42,g=.1+i()*.42;e.strokeStyle=y?`rgba(255, ${205+Math.floor(i()*35)}, ${150+Math.floor(i()*60)}, ${g})`:`rgba(${185+Math.floor(i()*40)}, ${215+Math.floor(i()*30)}, 255, ${g})`,e.lineWidth=m,e.beginPath(),e.arc(256,256,f*256,n,n+c),e.stroke()}const l=new Ft(t);return l.colorSpace=Wt,l}function Ia(){const I=document.createElement("canvas");I.width=I.height=256;const t=I.getContext("2d"),e=t.createRadialGradient(128,128,0,128,128,128);e.addColorStop(0,"rgba(255, 205, 140, 0.55)"),e.addColorStop(.3,"rgba(255, 165, 85, 0.26)"),e.addColorStop(.65,"rgba(160, 90, 40, 0.08)"),e.addColorStop(1,"rgba(0, 0, 0, 0)"),t.fillStyle=e,t.fillRect(0,0,256,256);const a=new Ft(I);return a.colorSpace=Wt,a}function Da(){const I=document.createElement("canvas");I.width=I.height=256;const t=I.getContext("2d"),e=t.createImageData(256,256);for(let i=0;i<256;i++)for(let o=0;o<256;o++){const s=Math.sqrt((o-128)**2+(i-128)**2)/128,l=Pt(.6,.72,s)*(1-Pt(.74,.99,s))*.5,r=(i*256+o)*4;He(e.data,r,255*l,175*l,95*l,l*255)}t.putImageData(e,0,0);const a=new Ft(I);return a.colorSpace=Wt,a}function He(I,t,e,a,i,o){I[t]=e,I[t+1]=a,I[t+2]=i,I[t+3]=o}function Ve(I){const t=I*.62,e=new U,a=new k(new j(t*2.35,48,32),new O({color:0}));e.add(a);const i=new S(.055,1,.04).normalize(),o=Ca(),s=new O({map:o,transparent:!0,depthWrite:!1,side:tt,blending:A}),l=new k(new At(t*3,t*12,160,1),s),r=new U;r.quaternion.setFromUnitVectors(new S(0,0,1),i),r.add(l);const f=new O({map:Da(),transparent:!0,depthWrite:!1,side:tt,blending:A,opacity:.55}),n=new k(new At(t*10,t*16.5,96,1),f);r.add(n),e.add(r);const c=new U,m=new O({map:Pa(),transparent:!0,depthWrite:!1,blending:A,side:tt}),y=new k(new At(t*2.42,t*2.62,96,1),m);c.add(y);const g=Ti(4242),x=Ti(909),u=new k(new At(t*2.7,t*5.4,96,1,0,Math.PI),new O({map:g,transparent:!0,depthWrite:!1,blending:A,side:tt})),h=new k(new At(t*2.8,t*4.6,96,1,Math.PI,Math.PI),new O({map:x,transparent:!0,depthWrite:!1,blending:A,side:tt,opacity:.7}));c.add(u,h);const d=ka(),p=new O({map:d,transparent:!0,depthWrite:!1,blending:A,side:tt}),M=new k(new At(t*2.55,t*4.7,128,1),p);M.renderOrder=2,c.add(M);const P=new J(new it({map:Ia(),transparent:!0,blending:A,depthWrite:!1,opacity:.5}));return P.scale.setScalar(t*9),c.add(P),c.renderOrder=6,l.renderOrder=5,e.add(c),{group:e,update(w,E,D=0){E&&c.quaternion.copy(E);const _=qt(D);l.rotation.z=-w*.055-_*(.55+.12*Math.sin(w*6)),l.scale.setScalar(1+_*.16),r.scale.setScalar(1+_*.1),M.rotation.z=w*.12+_*(.85+.18*Math.sin(w*5)),c.scale.setScalar(1+_*(.14+.035*Math.sin(w*7)))},dispose(){var w;e.traverse(E=>{const D=E;D.geometry&&D.geometry.dispose();const _=D.material;_&&(_.map&&_.map.dispose(),_.dispose())}),(w=P.material.map)==null||w.dispose(),P.material.dispose()}}}const pe=3,Be=8e5,We=.06,Ne=Math.PI-.06,Si=7.5,Ra=3.6,Oe=3.2,Ci=7,za=21e-5,Pi=140,Aa=.0016,ve=.0048,ki=.0016,Fa=.55,ge=2600,ye=2.2,Ga=2.2,mt=(I,t,e)=>Math.min(e,Math.max(t,I)),Xt=(I,t,e,a)=>I+(t-I)*(1-Math.exp(-e*a));class kt{constructor(t,e){this.zoomT=.47,this.tZoomT=.335,this.theta=.32,this.tTheta=.9,this.phi=1.28,this.tPhi=1.12,this.orbitVX=0,this.orbitVY=0,this.zoomVel=0,this.panVel=new S,this.panOffset=new S,this.panRight=new S,this.panUp=new S,this.focus=new S,this.renderCenter=new S,this.focused=!1,this.focusRadius=6,this.focusMin=1.35,this.focusMax=3500,this.panKeys={},this.dragging=!1,this.panning=!1,this.dragVX=0,this.dragVY=0,this.lastMoveT=0,this.pinchD=0,this.pinchX=0,this.pinchY=0,this.onKeyDown=a=>{const i=a.target;i&&(i.tagName==="INPUT"||i.tagName==="TEXTAREA"||i.isContentEditable)||(this.panKeys[a.key.toLowerCase()]=!0)},this.onKeyUp=a=>{this.panKeys[a.key.toLowerCase()]=!1},this.onWheel=a=>{a.preventDefault();const i=a.deltaMode===1?16:a.deltaMode===2?400:1,o=mt(a.deltaY*i,-Pi,Pi);this.zoomVel+=o*za*Ci},this.onTouchStart=a=>{a.touches.length===2&&(this.pinchD=Math.hypot(a.touches[0].clientX-a.touches[1].clientX,a.touches[0].clientY-a.touches[1].clientY),this.pinchX=(a.touches[0].clientX+a.touches[1].clientX)/2,this.pinchY=(a.touches[0].clientY+a.touches[1].clientY)/2,this.dragging=!1,this.panning=!1,this.orbitVX=0,this.orbitVY=0,this.panVel.set(0,0,0))},this.onTouchMove=a=>{if(a.touches.length!==2)return;const i=Math.hypot(a.touches[0].clientX-a.touches[1].clientX,a.touches[0].clientY-a.touches[1].clientY);this.tZoomT=mt(this.tZoomT-(i-this.pinchD)*Aa,0,1),this.zoomVel=0,this.pinchD=i;const o=(a.touches[0].clientX+a.touches[1].clientX)/2,s=(a.touches[0].clientY+a.touches[1].clientY)/2;this.panBy(o-this.pinchX,s-this.pinchY),this.pinchX=o,this.pinchY=s},this.camera=t,this.canvas=e,e.addEventListener("wheel",this.onWheel,{passive:!1}),e.addEventListener("touchstart",this.onTouchStart,{passive:!0}),e.addEventListener("touchmove",this.onTouchMove,{passive:!0}),window.addEventListener("keydown",this.onKeyDown),window.addEventListener("keyup",this.onKeyUp)}beginDrag(t){this.dragging=!0,this.panning=t,this.dragVX=0,this.dragVY=0,this.lastMoveT=performance.now(),this.orbitVX=0,this.orbitVY=0,this.panVel.set(0,0,0)}dragMove(t,e){if(!this.dragging)return;const a=performance.now(),i=Math.max(.001,(a-this.lastMoveT)/1e3);this.lastMoveT=a;const o=.6,s=mt(t/i,-ge,ge),l=mt(e/i,-ge,ge);this.panning?(this.panBy(t,e),this.dragVX=o*this.dragVX+(1-o)*s,this.dragVY=o*this.dragVY+(1-o)*l):(this.tTheta+=t*ve,this.tPhi=mt(this.tPhi-e*ve,We,Ne),this.dragVX=o*this.dragVX+(1-o)*s,this.dragVY=o*this.dragVY+(1-o)*l)}endDrag(){if(this.dragging){if(this.dragging=!1,this.panning){this.panRight.setFromMatrixColumn(this.camera.matrixWorld,0),this.panUp.setFromMatrixColumn(this.camera.matrixWorld,1);const t=this.dist()*ki;this.panVel.addScaledVector(this.panRight,-this.dragVX*t).addScaledVector(this.panUp,this.dragVY*t);const e=this.dist()*Ga;this.panVel.length()>e&&this.panVel.setLength(e)}else this.orbitVX=mt(this.dragVX*ve,-ye,ye),this.orbitVY=mt(this.dragVY*ve,-ye,ye);this.panning=!1,this.dragVX=0,this.dragVY=0}}panBy(t,e){const a=this.dist()*ki;this.panRight.setFromMatrixColumn(this.camera.matrixWorld,0),this.panUp.setFromMatrixColumn(this.camera.matrixWorld,1),this.panOffset.addScaledVector(this.panRight,-t*a).addScaledVector(this.panUp,e*a);const i=Math.max(60,this.dist()*1.2);this.panOffset.length()>i&&this.panOffset.setLength(i)}setZoomTarget(t){this.tZoomT=mt(t,0,1)}nudgeZoom(t){this.tZoomT=mt(this.tZoomT+t,0,1)}killZoomMomentum(){this.zoomVel=0}get zoomVelocity(){return this.zoomVel}setOrbit(t,e){t!==null&&(this.tTheta=t),e!==null&&(this.tPhi=mt(e,We,Ne))}clearPan(){this.panOffset.set(0,0,0),this.panVel.set(0,0,0)}holdFocus(t){this.focus.copy(t),this.panOffset.set(0,0,0),this.panVel.set(0,0,0)}dist(){const t=pe*Math.pow(Be,this.zoomT);return this.focused?Math.min(Math.max(t,this.focusMin),this.focusMax):t}baseDist(){return pe*Math.pow(Be,this.zoomT)}get atFocusMax(){return this.focused&&this.baseDist()>=this.focusMax}get atFocusMin(){return this.focused&&this.baseDist()<=this.focusMin}get zoomTrend(){return this.tZoomT-this.zoomT}static zoomTOf(t){return mt(Math.log(Math.max(t,pe)/pe)/Math.log(Be),0,1)}update(t,e){if(!this.dragging){if(Math.abs(this.orbitVX)>1e-4||Math.abs(this.orbitVY)>1e-4){this.tTheta+=this.orbitVX*t,this.tPhi=mt(this.tPhi-this.orbitVY*t,We,Ne);const l=Math.exp(-3.4*t);this.orbitVX*=l,this.orbitVY*=l}if(this.panVel.lengthSq()>1e-8){this.panOffset.addScaledVector(this.panVel,t);const l=Math.max(60,this.dist()*1.2);this.panOffset.length()>l&&this.panOffset.setLength(l),this.panVel.multiplyScalar(Math.exp(-5.5*t))}}Math.abs(this.zoomVel)>1e-5&&(this.tZoomT=mt(this.tZoomT+this.zoomVel*t,0,1),this.zoomVel*=Math.exp(-Ci*t));const a=this.panKeys;if(a.arrowup||a.w||a.arrowdown||a.s||a.arrowleft||a.a||a.arrowright||a.d){const l=this.dist()*Fa*t;this.panRight.setFromMatrixColumn(this.camera.matrixWorld,0),this.panUp.setFromMatrixColumn(this.camera.matrixWorld,1),(a.arrowleft||a.a)&&this.panOffset.addScaledVector(this.panRight,-l),(a.arrowright||a.d)&&this.panOffset.addScaledVector(this.panRight,l),(a.arrowup||a.w)&&this.panOffset.addScaledVector(this.panUp,l),(a.arrowdown||a.s)&&this.panOffset.addScaledVector(this.panUp,-l);const r=Math.max(60,this.dist()*1.2);this.panOffset.length()>r&&this.panOffset.setLength(r)}this.theta=Xt(this.theta,this.tTheta,Si,t),this.phi=Xt(this.phi,this.tPhi,Si,t),this.zoomT=Xt(this.zoomT,this.tZoomT,Ra,t),this.focus.x=Xt(this.focus.x,e.focus.x,Oe,t),this.focus.y=Xt(this.focus.y,e.focus.y,Oe,t),this.focus.z=Xt(this.focus.z,e.focus.z,Oe,t),this.focused=e.focused,this.focusRadius=e.focusRadius,this.focusMin=e.focusMin??this.focusRadius*1.35,this.focusMax=e.focusMax??3500,this.renderCenter.copy(this.focus).add(this.panOffset);const i=Math.max(.5,this.dist()*(1-e.portalEase*.45)),o=Math.sin(this.phi),s=Math.cos(this.phi);this.camera.position.set(this.renderCenter.x+i*o*Math.cos(this.theta),this.renderCenter.y+i*s,this.renderCenter.z+i*o*Math.sin(this.theta)),this.camera.up.set(0,1,0),this.camera.lookAt(this.renderCenter),this.camera.near=mt(i*.004,.05,5e3),this.camera.far=5e6,this.camera.updateProjectionMatrix()}dispose(){this.canvas.removeEventListener("wheel",this.onWheel),this.canvas.removeEventListener("touchstart",this.onTouchStart),this.canvas.removeEventListener("touchmove",this.onTouchMove),window.removeEventListener("keydown",this.onKeyDown),window.removeEventListener("keyup",this.onKeyUp)}}const Ii=864e5;function ae(I,t,e){const a=Math.min(1,Math.max(0,(e-I)/(t-I)));return a*a*(3-2*a)}function Bt(I,t,e,a,i){return ae(t,e,I)*(1-ae(a,i,I))}function Q(I,t){const e=Math.sin(I*127.1+t*311.7)*43758.5453;return e-Math.floor(e)}function Ea(I,t){const e=Math.floor(I),a=Math.floor(t),i=I-e,o=t-a,s=i*i*(3-2*i),l=o*o*(3-2*o),r=Q(e,a),f=Q(e+1,a),n=Q(e,a+1),c=Q(e+1,a+1);return r+(f-r)*s+(n-r)*l+(r-f-n+c)*s*l}function be(I,t){let e=0,a=.5,i=I,o=t;for(let s=0;s<4;s++)e+=a*(Ea(i,o)*2-1),i*=2.07,o*=2.03,a*=.5;return e}function nt(I,t){const e=document.createElement("canvas");e.width=e.height=I;const a=e.getContext("2d");a.clearRect(0,0,I,I);const i=I/2,o=i-1,s=a.createRadialGradient(i,i,0,i,i,o);t.forEach(([r,f])=>s.addColorStop(r,f)),a.fillStyle=s,a.beginPath(),a.arc(i,i,o,0,Math.PI*2),a.fill();const l=new Ft(e);return l.generateMipmaps=!1,l.minFilter=ri,l.magFilter=ri,l}class zt{constructor(t,e,a){var n;this.scene=new Xi,this.bodies=[],this.colliderList=[],this.raycaster=new qi,this.pointer=new Mt(-2,-2),this.pointerMoved=!1,this.hoveredId=null,this.selectedId=null,this.focusId=null,this.simDays=0,this.timeScale=1,this.paused=!1,this.rendering=!0,this.coreActive=!1,this.coreT=0,this.epoch=Date.now()-400*Ii,this.portal={phase:"idle",t:0,fired:!1,kind:"diary",bodyId:""},this.portalTargetInnerId=null,this.portalVisualT=0,this.portalProfile="normal",this.portalReturn=!1,this.reducedMotion=typeof window<"u"&&((n=window.matchMedia)==null?void 0:n.call(window,"(prefers-reduced-motion: reduce)").matches),this.portalWasInner=!1,this.portalLocalCenter=new S,this.portalGravityUniforms={center:new S,radius:0,strength:0,time:0},this.portalBodyRadius=0,this.portalSingularity=null,this.portalReverse=1,this.portalCloseLevel=0,this.portalEject=0,this.portalPointSets=[],this._vScratch4=new S,this.dragging=!1,this.lastPX=0,this.lastPY=0,this.downX=0,this.downY=0,this.downT=0,this.vaultPulse=0,this.lastClickT=0,this.lastClickId=null,this.clickTimer=null,this.starUniforms={},this.gNeighborhood=new U,this.gGalaxy=new U,this.gCluster=new U,this.gSupercluster=new U,this.gWeb=new U,this.gMultiverse=new U,this.meteors=[],this.multiverseColliders=[],this.galaxyNodes=[],this.multiverseMats=[],this.clouds=[],this.levelSprites=[],this.levelPointMats=[],this.realityMarbles=[],this.marbleRingTex=null,this.cosmicStage="web",this.kamuiFlight=null,this.kamuiFromZoom=0,this.arrivalZoom=.787,this.warpDir="toMultiverse",this.postWarpZoom=null,this.kamuiWarpFx=0,this.kamuiEjectK=0,this.kamuiSuckDrift=0,this.kamuiTunnelMats=[],this.bootIntro=!0,this.birthK=0,this.introMarbleMats=[],this.introMarbleSprites=[],this.realityFocused=!1,this.webVortexMats=[],this.galaxyTearGroup=new U,this.galaxyEntryFlight=null,this.surface=new U,this.surfaceLocked=!1,this.surfaceQuat=new Ht,this.surfaceBlend=0,this.activeRealityId="sol-prime",this.activeReality=null,this.realityGroups={},this.activeRealityShieldMesh=null,this.activeGalaxyName=null,this.galaxyWarp=null,this.galaxyWarpDrift=0,this.prevDialTarget=.15,this.gGalaxyContents=new U,this.galaxyStageNodes=[],this.galaxyStageColliders=[],this.galaxyStagePointMats=[],this.innerColliderList=[],this.innerFocusBodyId=null,this.galaxyFocusId=null,this.galaxyInnerFocus=!1,this.bandLatch=null,this.clusterGasMats=[],this.astralCoreGroup=null,this.astralCoreMats=[],this.astralCoreRings=[],this.astralCoreHalo=[],this.coreHoverT=0,this.demonCoreRings=[],this.demonCoreSpires=[],this.demonCorePulseRings=[],this.demonCoreJets=[],this.demonCoreTesseract=null,this.demonCoreTachyonNodes=[],this.corePulseOrbs=[],this.kamuiErase=0,this.lastLabel="",this.lastDateSent=0,this.clockT=0,this.disposed=!1,this.originalTouchAction="",this.onVaultPulse=c=>{const m=c.detail;this.vaultPulse=Math.min(1.5,this.vaultPulse+((m==null?void 0:m.intensity)??1))},this.onContextLost=c=>{c.preventDefault()},this.onContextRestored=()=>{this.disposed||this.renderer.compile(this.scene,this.camera)},this._vScratch1=new S,this._vScratch2=new S,this._vScratch3=new S,this._vDirScratch=new S,this._vFocusScratch=new S,this._qScratch=new Ht,this._qScratch2=new Ht,this._corePosBuffer=new Float32Array(1e3*3),this.skyNebulae=[],this.grabCooldown=0,this.asteroidInst=[],this._rockM=new Re,this._rockQ=new Ht,this.onPointerDown=c=>{this.pointer.set(c.clientX/window.innerWidth*2-1,-(c.clientY/window.innerHeight)*2+1),this.pointerMoved=!0;const m=c.button===1||c.button===2||c.button===0&&c.shiftKey;if(c.button===0||m){try{this.canvas.setPointerCapture(c.pointerId)}catch{}this.dragging=!0,this.rig.beginDrag(m),this.lastPX=c.clientX,this.lastPY=c.clientY,this.downX=c.clientX,this.downY=c.clientY,this.downT=performance.now()}},this.onPointerMove=c=>{if(this.mouseScreenX=c.clientX,this.mouseScreenY=c.clientY,this.dragging){const m=c.clientX-this.lastPX,y=c.clientY-this.lastPY;this.rig.dragMove(m,y),this.lastPX=c.clientX,this.lastPY=c.clientY}this.pointer.set(c.clientX/window.innerWidth*2-1,-(c.clientY/window.innerHeight)*2+1),this.pointerMoved=!0},this.onPointerUp=c=>{this.finishPointerDrag(c,!0)},this.onPointerCancel=c=>{this.finishPointerDrag(c,!1)},this.onDoubleClick=c=>{c.preventDefault()},this.onContextMenu=c=>{if(c.preventDefault(),Math.hypot(c.clientX-this.downX,c.clientY-this.downY)>8)return;const m=this.pick();m&&this.cb.onContext(m,c.clientX,c.clientY)},this.mouseScreenX=0,this.mouseScreenY=0,this.resize=()=>{const c=window.innerWidth,m=window.innerHeight;this.renderer.setSize(c,m),this.composer.setSize(c,m),this.camera.aspect=c/m,this.camera.updateProjectionMatrix()},this.tick=()=>{var _,B,C;if(this.disposed)return;const c=ea()?performance.now():0;if(!this.rendering){this.clock.getDelta();return}const m=Math.min(.05,this.clock.getDelta());this.clockT+=m;const y=this.paused?0:6*this.timeScale*(this.coreActive?.35:1);this.simDays+=m*y,this.clockT-this.lastDateSent>.25&&(this.lastDateSent=this.clockT,this.cb.onSimDate(new Date(this.epoch+this.simDays*Ii).toISOString()));const g=(v,R)=>{this.portal.t=Math.min(1,this.portal.t+m/v),this.portal.t>=1&&(this.portal.t=0,this.portal.phase=R)};if(this.portal.phase==="arming")g(this.reducedMotion?.08:.18,"disturbance");else if(this.portal.phase==="disturbance")g(this.reducedMotion?.12:.42,"deformation");else if(this.portal.phase==="deformation")g(this.reducedMotion?.18:.72,"vortex");else if(this.portal.phase==="vortex")g(this.reducedMotion?.22:1,"collapse");else if(this.portal.phase==="collapse")g(this.reducedMotion?.18:.72,"opening");else if(this.portal.phase==="opening")g(this.reducedMotion?.15:this.portalProfile==="vault"?.72:.9,"hold"),!this.portal.fired&&this.portal.t>.72&&(this.portal.fired=!0,this.cb.onPortalPeak(this.portal.kind,this.portal.bodyId));else if(this.portal.phase==="hold")this.portal.t=Math.min(1,this.portal.t+m/1.6);else if(this.portal.phase==="out"&&(this.portal.t=Math.max(0,this.portal.t-m/(this.portalReturn?1.5:1.15)),this.portal.t<=0)){const v=this.portalWasInner||!!this.portalTargetInnerId;this.portal.phase="idle",this.portalTargetInnerId=null,this.portalReverse=1,this.portalEject=0,this.portalCloseLevel=0,this.kamuiWarpFx=0,this.portalPointSets.length=0,this.portalReturn&&(this.portalReturn=!1,this.portalWasInner=!1,this.focusId=null,this.selectedId=null,v?(this.innerFocusBodyId=null,this.rig.setZoomTarget(kt.zoomTOf(150)),this.prevDialTarget=kt.zoomTOf(150),(B=(_=this.cb).onSelectInnerWorld)==null||B.call(_,null)):(this.galaxyFocusId=null,this.galaxyInnerFocus=!1,this.innerFocusBodyId=null,this.rig.setZoomTarget(.15),this.rig.setOrbit(null,1.12),this.rig.clearPan(),this.prevDialTarget=.15)),this.cb.onPortalDone()}const x=this.portal.t*this.portal.t*(3-2*this.portal.t),u={idle:0,arming:.02,disturbance:.1,deformation:.3,vortex:.62,collapse:.82,opening:1,hold:1,out:1};let h=this.portal.phase==="out"?x:Math.min(1,(u[this.portal.phase]??0)+x*.22);if(this.portalEject=0,this.portal.phase==="out"&&this.portalReturn){const v=1-this.portal.t,R=F=>F*F*(3-2*F);if(v<.24)h=et.lerp(this.portalCloseLevel,.92,R(v/.24));else if(v<.52){const F=(v-.24)/.28;h=et.lerp(.92,.18,F)+.1*Math.sin(F*Math.PI),this.portalEject=Math.sin(F*Math.PI)}else h=.18*(1-R((v-.52)/.48));this.kamuiWarpFx=this.portalEject*.85}this.portalVisualT=this.portal.phase==="idle"?0:h;const d=50+h*14-this.coreT*4+this.kamuiWarpFx*28;if(this.camera.fov+=(d-this.camera.fov)*Math.min(1,m*4),this.camera.updateProjectionMatrix(),this.grabCooldown=Math.max(0,this.grabCooldown-m),this.focusBody()&&this.rig.dist()>1200&&this.portal.phase==="idle"&&(this.focusId=null,this.grabCooldown=.6),this.kamuiFlight!==null){this.kamuiFlight=Math.min(1,this.kamuiFlight+m/3.6);const v=this.kamuiFlight;this.rig.killZoomMomentum(),this.kamuiWarpFx=Math.sin(Math.min(v,.92)/.92*Math.PI);const R=.3,F=.68;if(v>R&&v<F){const Y=(v-R)/(F-R);this.kamuiTunnel.visible=!0,this.kamuiTunnel.position.z=et.lerp(-16e5,16e5,Y),this.kamuiTunnel.rotation.z+=m*(3.5+Y*6),this.kamuiTunnelMats.forEach(X=>{X.uniforms.uTime.value=this.clockT,X.uniforms.uSpin.value=this.kamuiTunnel.rotation.z,X.uniforms.uOpacity.value=Math.sin(Y*Math.PI)*.9})}else this.kamuiTunnel.visible&&(this.kamuiTunnel.visible=!1);if(this.warpDir==="toMultiverse")if(v<.55){const Y=Math.min(1,v/.45),X=45e3+Y*48e4;this.webVortexMats.forEach(q=>{q.uniforms.uVortexC.value.set(0,0,0),q.uniforms.uVortexR.value=X,q.uniforms.uVortexS.value=1,q.uniforms.uVortexT.value=this.clockT}),this.kamuiSuckDrift=Y*6e4,v<.45?this.rig.setZoomTarget(et.lerp(.86,.855,Math.min(1,v/.45))):this.rig.setZoomTarget(et.lerp(.855,.72,Math.min(1,(v-.45)/.1)))}else{this.cosmicStage!=="multiverse"&&(this.cosmicStage="multiverse",this.realityFocused=!0,this.kamuiSuckDrift=0,this.kamuiEjectK=0,this.webVortexMats.forEach(q=>{q.uniforms.uVortexS.value=0}));const Y=Math.min(1,(v-.55)/.35);this.kamuiEjectK=Y;const X=1-Math.pow(1-Y,3);this.rig.setZoomTarget(et.lerp(.72,this.arrivalZoom,X)+.05*Math.sin(Y*Math.PI))}else if(v<.55)this.cosmicStage!=="multiverse"&&(this.cosmicStage="multiverse"),v<.45?this.rig.setZoomTarget(et.lerp(this.kamuiFromZoom,.8,Math.min(1,v/.45))):this.rig.setZoomTarget(et.lerp(.8,.72,Math.min(1,(v-.45)/.1)));else{this.cosmicStage!=="web"&&(this.cosmicStage="web",this.realityFocused=!1);const Y=Math.min(1,(v-.55)/.35),X=this.postWarpZoom??.82,q=1-Math.pow(1-Y,3);this.rig.setZoomTarget(et.lerp(.72,X,q)+.05*Math.sin(Y*Math.PI))}v>=1&&(this.kamuiFlight=null,this.kamuiEjectK=0,this.kamuiSuckDrift=0,this.postWarpZoom!==null&&(this.rig.setZoomTarget(this.postWarpZoom),this.postWarpZoom=null),this.prevDialTarget=this.rig.tZoomT)}else if(this.galaxyEntryFlight!==null)this.updateGalaxyEntryFlight(m);else if(this.galaxyWarp!==null){const v=this.galaxyWarp;v.t=Math.min(1,v.t+m/2.6);const R=v.t;this.rig.killZoomMomentum(),this.kamuiWarpFx=Math.sin(Math.min(R,.92)/.92*Math.PI)*.8,this.galaxyWarpDrift=Math.sin(R*Math.PI)*(v.dir==="descend"?9e3:7e3);const F=.3,Y=.68;if(R>F&&R<Y){const N=(R-F)/(Y-F);this.kamuiTunnel.visible=!0,this.kamuiTunnel.position.z=et.lerp(-16e5,16e5,N),this.kamuiTunnel.rotation.z+=m*(3.5+N*6),this.kamuiTunnelMats.forEach(at=>{at.uniforms.uTime.value=this.clockT,at.uniforms.uSpin.value=this.kamuiTunnel.rotation.z,at.uniforms.uOpacity.value=Math.sin(N*Math.PI)*.85})}else this.kamuiTunnel.visible&&(this.kamuiTunnel.visible=!1);const X=22e3+R*7e4;this.webVortexMats.forEach(N=>{N.uniforms.uVortexC.value.copy(v.center),N.uniforms.uVortexR.value=X,N.uniforms.uVortexS.value=1,N.uniforms.uVortexT.value=this.clockT});const q=R<.5?2*R*R:1-Math.pow(-2*R+2,2)/2;this.rig.setZoomTarget(et.lerp(v.fromDial,v.toDial,q)),R>=1&&(this.galaxyWarp=null,this.kamuiWarpFx=0,this.galaxyWarpDrift=0,this.webVortexMats.forEach(N=>{N.uniforms.uVortexS.value=0}),this.kamuiTunnel.visible&&(this.kamuiTunnel.visible=!1),this.galaxyInnerFocus=v.endInner,!v.endInner&&v.toDial<=.3&&(this.galaxyFocusId=null),this.prevDialTarget=this.rig.tZoomT)}else if(this.bootIntro){if(this.cosmicStage="web",this.realityFocused=!1,this.birthK=1,this.anchorGroup.visible=!0,this.anchorGroup.scale.setScalar(1),this.skyDomeMesh&&(this.skyDomeMesh.visible=!0),this.farStarsPoints){const v=this.farStarsPoints.material;v.uniforms&&v.uniforms.uOpacity&&(v.uniforms.uOpacity.value=1)}this.skyNebulae.forEach(v=>{v.uniforms.uOpacity&&(v.uniforms.uOpacity.value=1)}),this.bodies.forEach(v=>{v.fadeTarget=1}),this.rig.setZoomTarget(.15),this.rig.setOrbit(null,1.12),this.bootIntro=!1}else{if(this.cosmicStage==="web"&&this.rig.tZoomT>.865&&this.rig.setZoomTarget(.865),this.cosmicStage==="web"&&this.rig.tZoomT>=.855&&this.rig.zoomVelocity>.05&&this.grabCooldown<=0&&!this.dragging&&this.portal.phase==="idle"&&!this.focusId&&!this.coreActive&&this.activeReality&&(this.realityFocused=!1,this.warpDir="toMultiverse",this.kamuiFlight=0,this.kamuiFromZoom=this.rig.zoomT,this.arrivalZoom=this.activeReality?kt.zoomTOf(this.activeReality.bubbleSize*5.5):.787,this.grabCooldown=1.2),this.cosmicStage==="multiverse"&&(this.realityFocused&&this.rig.tZoomT<.787&&this.rig.setZoomTarget(.787),this.realityFocused&&this.rig.atFocusMax&&this.rig.zoomTrend>0&&(this.realityFocused=!1,this.grabCooldown=.6),this.rig.tZoomT<.8&&this.rig.setZoomTarget(.8),this.rig.tZoomT<=.802&&this.rig.zoomVelocity<-.05&&this.grabCooldown<=0&&!this.dragging&&this.portal.phase==="idle"&&(this.realityFocused=!1,this.warpDir="toWeb",this.kamuiFlight=0,this.kamuiFromZoom=this.rig.zoomT,this.grabCooldown=1.2)),this.cosmicStage==="web"&&this.galaxyFocusId&&this.rig.atFocusMax&&this.rig.zoomTrend>0&&(this.innerFocusBodyId?(this.releaseInnerWorld(),this.grabCooldown=.35):this.galaxyInnerFocus?(this.galaxyInnerFocus=!1,this.rig.setZoomTarget(.668),this.prevDialTarget=.668,this.grabCooldown=.6):(this.galaxyFocusId=null,this.grabCooldown=.6)),this.cosmicStage==="web"&&this.galaxyFocusId&&this.rig.atFocusMin&&this.rig.zoomTrend<0){const at=this.galaxyStageNodes.find(vt=>vt.data.id===this.galaxyFocusId);at&&at.data.isHomeGalaxy&&!this.galaxyInnerFocus&&(this.galaxyFocusId=null,this.grabCooldown=.35)}const v=this.rig.tZoomT,R=this.prevDialTarget,F=this.galaxyWarp===null&&this.kamuiFlight===null&&this.portal.phase==="idle"&&!this.dragging&&!this.bootIntro,Y=R>=.7&&v<.695&&v>=.58,X=R>=.6&&R<=.7&&v<.585,q=R<=.585&&v>.605;F&&this.grabCooldown<=0&&this.cosmicStage==="web"?Y?this.beginGalaxyWarp("arrive",.668,null):X?this.beginGalaxyWarp("descend",Math.max(.15,v),null,!1):q&&this.fireAscend():F&&this.grabCooldown>0&&(Y?this.bandLatch={dir:"arrive",at:this.clockT}:X?this.bandLatch={dir:"down",at:this.clockT}:q&&(this.bandLatch={dir:"up",at:this.clockT})),this.bandLatch&&(this.clockT-this.bandLatch.at>3?this.bandLatch=null:F&&this.grabCooldown<=0&&this.cosmicStage==="web"&&(this.bandLatch.dir==="arrive"&&v<.695&&v>=.58?(this.beginGalaxyWarp("arrive",.668,null),this.bandLatch=null):this.bandLatch.dir==="up"&&v>.6&&v<.695?(this.fireAscend(),this.bandLatch=null):this.bandLatch.dir==="down"&&v<.585&&(this.beginGalaxyWarp("descend",Math.max(.15,v),null,!1),this.bandLatch=null))),this.prevDialTarget=v}if(!this.focusId&&!this.realityFocused&&this.cosmicStage==="web"&&!this.bootIntro&&!this.coreActive&&this.rig.dist()<150&&this.portal.phase==="idle"&&this.grabCooldown<=0&&!this.dragging&&this.rig.zoomTrend<-.018&&this.hoveredId&&this.hoveredId!=="anchor"){const v=this.bodies.find(R=>R.data.id===this.hoveredId);v&&v.data.kind!=="nebula"&&v.data.kind!=="hole"&&(this.focusId=v.data.id)}const M=this.focusBody();let P,w,E=M?M.data.radius:this.activeReality?this.activeReality.bubbleSize*2.6:6,D=!1;if(this.realityFocused&&this.activeReality)this._vFocusScratch.set(...this.activeReality.bubblePos),this.kamuiEjectK>.001&&this.kamuiEjectK<1&&(this._vFocusScratch.z-=this.activeReality.bubbleSize*2*(1-this.kamuiEjectK)),P=this.activeReality.bubbleSize*3.1,w=52e4;else if(M)M.group.getWorldPosition(this._vFocusScratch);else if(this.galaxyFocusId){const v=this.galaxyStageNodes.find(R=>R.data.id===this.galaxyFocusId);if(v)if(v.group.getWorldPosition(this._vFocusScratch),this.galaxyInnerFocus){const R=this.innerFocusBodyId?((C=v.innerSys)==null?void 0:C.planets.find(F=>F.data.id===this.innerFocusBodyId))??null:null;R?(R.group.getWorldPosition(this._vFocusScratch),P=Math.max(2.2,R.data.radius*1.9),w=this.galaxyWarp?9e4:4200,E=R.data.radius):(P=12,w=this.galaxyWarp?9e4:7e3,E=30),D=!0}else P=v.radius*2.1,w=9e4,E=v.radius,D=!0}else this._vFocusScratch.set(0,0,this.kamuiSuckDrift);this.galaxyWarp&&(this._vFocusScratch.z+=this.galaxyWarpDrift),this.portal.phase!=="idle"&&this.rig.holdFocus(this._vFocusScratch),this.rig.update(m,{focus:this._vFocusScratch,focused:!!M||this.realityFocused||D,focusRadius:E,portalEase:h,focusMin:P,focusMax:w}),this.updateBodies(m),this.updateMeteors(m),this.updateLevels(m),this.updatePortalGravity(),this.updatePortalSingularity(),this.updatePortalPointsVortex(),this.updateSurface(m),this.updateCore(m),this.updateHover(),this.rendering&&this.composer.render(),c&&ia(performance.now()-c)},this.clock=new ji,this.connections=[],this.cb=a,this.canvas=t,this.originalTouchAction=t.style.touchAction;const i=navigator.deviceMemory,o=navigator.hardwareConcurrency<=4||i!==void 0&&i<=4,s=o?1:1.35;this.renderer=new Ki({canvas:t,antialias:!o,powerPreference:o?"default":"high-performance"}),this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,s)),this.renderer.outputColorSpace=Wt,this.renderer.toneMapping=Di,this.renderer.toneMappingExposure=1,this.renderer.setClearColor("#04060c",1),this.camera=new Qi(50,1,.1,8e6),this.rig=new kt(this.camera,t),this.scene.add(new $i(1976635,.3));const l=new ze(16773334,.95,0,0);this.scene.add(l),this.buildSky(),this.buildBackdrop(),this.buildAnchor(),e.forEach(c=>this.buildBody(c)),this.buildBelt(),this.buildLevels(),this.buildMultiverse(),this.buildMeteors(),this.buildSurface(),this.buildKamuiTunnel(),this.buildGalaxyTear(),this.buildIntroMarble(),this.scene.add(this.camera),[this.gNeighborhood,this.gGalaxy,this.gCluster,this.gSupercluster,this.gWeb,this.gMultiverse].forEach(c=>{const m=c===this.gMultiverse?"multiverse":"standard";c.traverse(y=>{if(y instanceof Zt){const g=y.material;g.uniforms&&g.uniforms.uScale&&!this.levelPointMats.includes(g)&&(g.userData.pointMode=g.userData.pointMode??m,this.levelPointMats.push(g))}})}),this.connectionMat=new Vt({color:15909240,transparent:!0,opacity:0,blending:A,depthWrite:!1});const r=new yt,f=new Rt(this._corePosBuffer,3);f.setUsage(ce),r.setAttribute("position",f),this.connectionLines=new Ae(r,this.connectionMat),this.connectionLines.frustumCulled=!1,this.scene.add(this.connectionLines),this.composer=new ca(this.renderer),this.composer.setPixelRatio(Math.min(window.devicePixelRatio,s)),this.composer.addPass(new ha(this.scene,this.camera)),this.bloomPass=new jt(new Mt(512,512),.12,.15,.9),this.composer.addPass(this.bloomPass),this.composer.addPass(new da),this.bindEvents(),this.resize(),window.addEventListener("resize",this.resize),this.renderer.debug.onShaderError=(c,m,y,g)=>{const x=(c.getShaderSource(g)??"").slice(0,4e3),u=c.getShaderInfoLog(g)||c.getProgramInfoLog(m)||"unknown shader error";console.error("[universe] shader compile failure:",u),window.dispatchEvent(new CustomEvent("eventide-shader-error",{detail:{source:x,log:u}}))},window.addEventListener("eventide-vault-pulse",this.onVaultPulse),this.renderer.compile(this.scene,this.camera),this.renderer.domElement.addEventListener("webglcontextlost",this.onContextLost),this.renderer.domElement.addEventListener("webglcontextrestored",this.onContextRestored),this.renderer.debug.checkShaderErrors=!1,this.renderer.setAnimationLoop(this.tick)}pointsMaterial(t,e){const a=new W({uniforms:{uScale:{value:1},uTime:{value:0},uTwinkle:{value:e?1:0},uOpacity:{value:1},uVortexC:{value:new S},uVortexR:{value:0},uVortexS:{value:0},uVortexT:{value:0},uVortexPull:{value:0},uVortexRev:{value:1}},vertexShader:fa,fragmentShader:pa,transparent:!0,depthWrite:!1,blending:A});return this.clouds.push({mat:a,px:t}),a}collectPointsMaterials(t,e,a="standard"){t.traverse(i=>{if(i instanceof Zt){const o=i.material;o.uniforms&&o.uniforms.uScale&&!this.levelPointMats.includes(o)&&(o.userData.pointMode=o.userData.pointMode??a,o.userData.rebuildTag=e,this.levelPointMats.push(o))}})}dropOwnedPointsMaterials(t){this.levelPointMats=this.levelPointMats.filter(e=>e.userData.rebuildTag!==t)}makePoints(t,e,a,i,o,s,l){const r=new Float32Array(t*3),f=new Float32Array(t),n=new Float32Array(t*3),c=new Float32Array(t);for(let y=0;y<t;y++){e(y,r),f[y]=a(y);const g=i(y);n[y*3]=g[0],n[y*3+1]=g[1],n[y*3+2]=g[2],c[y]=o(y)}const m=new yt;return m.setAttribute("position",new Rt(r,3)),m.setAttribute("aSize",new Rt(f,1)),m.setAttribute("aColor",new Rt(n,3)),m.setAttribute("aAlpha",new Rt(c,1)),new Zt(m,this.pointsMaterial(s,l))}buildBackdrop(){const t=()=>Math.random(),e=this.makePoints(2600,(r,f)=>{const n=700+t()*2300,c=t()*Math.PI*2,m=Math.acos(2*t()-1);f[r*3]=n*Math.sin(m)*Math.cos(c),f[r*3+1]=n*Math.cos(m)*.7,f[r*3+2]=n*Math.sin(m)*Math.sin(c)},()=>.5+t()*1.1,()=>{const r=t();return r>.8?[1,.85,.65]:r>.5?[.8,.88,1]:[.72,.78,.9]},()=>.35+t()*.6,2.1,!0);this.gNeighborhood.add(e);const a=nt(128,[[0,"rgba(255,244,220,1)"],[.25,"rgba(255,220,160,0.55)"],[1,"rgba(255,200,120,0)"]]),i=nt(128,[[0,"rgba(230,240,255,1)"],[.25,"rgba(170,200,255,0.55)"],[1,"rgba(150,180,255,0)"]]);[["SIRIUS",900,260,-1400,!1],["VEGA",-1300,520,800,!1],["PROXIMA",420,-140,640,!0],["ALTAIN",-700,-380,-900,!0],["KEID",1500,-300,600,!1]].forEach(([,r,f,n,c])=>{const m=new it({map:c?a:i,blending:A,depthWrite:!1,transparent:!0}),y=new J(m);y.position.set(r,f,n),y.scale.setScalar(60+t()*50),this.gNeighborhood.add(y),this.levelSprites.push({mat:m,base:m.opacity,level:"neighborhood"})});const s=this.makePoints(5200,(r,f)=>{const n=t()*Math.PI*2,c=14e3+t()*42e3,m=(t()+t()+t()-1.5)*3400;f[r*3]=Math.cos(n)*c,f[r*3+1]=m*.32,f[r*3+2]=Math.sin(n)*c},()=>.4+t()*.9,()=>t()>.75?[1,.82,.6]:[.62,.7,.88],()=>.16+t()*.3,1.5,!0);s.rotation.z=.42,s.rotation.x=.22,this.gGalaxy.add(s);const l=this.makePoints(1600,(r,f)=>{const n=32e4+t()*16e4,c=t()*Math.PI*2,m=Math.acos(2*t()-1);f[r*3]=n*Math.sin(m)*Math.cos(c),f[r*3+1]=n*Math.cos(m),f[r*3+2]=n*Math.sin(m)*Math.sin(c)},()=>.5+t()*1,()=>[.6,.68,.85],()=>.25+t()*.3,1.2,!1);this.farStarsPoints=l,this.scene.add(l),this.scene.add(this.gNeighborhood),this.scene.traverse(r=>{r.frustumCulled=!1})}buildSky(){this.backdropMat=new W({uniforms:{uTime:{value:0},uKamuiErase:{value:0},uVortexDir:{value:new S(0,0,-1)}},vertexShader:ya,fragmentShader:ba,side:Fe,depthWrite:!1,fog:!1,transparent:!0});const t=new k(new j(46e4,48,32),this.backdropMat);t.frustumCulled=!1,t.renderOrder=-100,this.scene.add(t),this.skyDomeMesh=t;const e=(a,i,o,s)=>{const l=Math.random,r=this.makePoints(s,(f,n)=>{const c=Math.pow(l(),.7)*o,m=l()*Math.PI*2,y=Math.acos(2*l()-1);n[f*3]=i[0]+c*Math.sin(y)*Math.cos(m),n[f*3+1]=i[1]+c*Math.cos(y),n[f*3+2]=i[2]+c*Math.sin(y)*Math.sin(m)},()=>3.2+l()*5.5,()=>a,()=>.08+l()*.16,4,!0);this.skyNebulae.push(r.material),this.scene.add(r)};e([.15,.35,.55],[-14e4,6e4,-19e4],12e4,1600),e([.18,.4,.65],[17e4,-5e4,12e4],1e5,1400),e([.2,.42,.6],[6e4,14e4,17e4],9e4,1100)}buildAnchor(){const t=new U;this.starUniforms={uTime:{value:0},uBoost:{value:1}};const e=new W({uniforms:this.starUniforms,vertexShader:ui,fragmentShader:di}),a=new k(new j(6,96,64),e);t.add(a),this.coronaMat=new W({uniforms:{uTime:{value:0},uBoost:{value:1}},vertexShader:bi,fragmentShader:Mi,transparent:!0,depthWrite:!1,blending:A,side:tt});const i=new k(new he(64,64),this.coronaMat);i.renderOrder=5,i.frustumCulled=!1,t.add(i);const o=(f,n,c,m,y)=>{const g=Math.random,x=this.makePoints(n,(u,h)=>{const d=u/n*Math.PI*2+g()*.06,p=f+(g()-.5)*.7;h[u*3]=Math.cos(d)*p,h[u*3+1]=(g()-.5)*.35,h[u*3+2]=Math.sin(d)*p},()=>.5+g()*.9,()=>c,()=>.3+g()*.55,y,!0);return x.rotation.x=m,t.add(x),x},s=o(9.6,700,[1,.82,.55],.42,1.6),l=o(11.4,420,[.55,.85,.8],-.55,1.3);t.userData.haloA=s,t.userData.haloB=l,t.userData.starMesh=a,t.rotation.z=.126,this.scene.add(t);const r=new k(new j(8.4,12,12),new O({visible:!1}));r.userData.bodyId="anchor",t.add(r),this.colliderList.push(r),t.userData.anchorGroup=!0,t.visible=!1,this.anchorGroup=t}buildBody(t){if(t.id==="anchor")return;const e=new U,a={data:t,group:e,collider:null,moons:[],ghost:0,ghostTarget:0,fade:1,fadeTarget:1,hoverT:0,baseScale:1},i=t.palette,o=r=>new z(r);if(t.kind==="planet"||t.kind==="dwarf"){const r=new W({uniforms:{uDeep:{value:o(i.deep)},uBase:{value:o(i.base)},uHigh:{value:o(i.high)},uIce:{value:o(i.ice)},uSunDir:{value:new S(1,0,0)},uTime:{value:0},uSea:{value:t.id==="aurelia"?.02:-.55},uGhost:{value:0},uFade:{value:1},uTear:{value:0},uTearTime:{value:0},uGravityCenter:{value:new S},uGravityLocalCenter:{value:new S},uGravityRadius:{value:0},uGravityStrength:{value:0},uGravityTime:{value:0},uReverse:{value:1},uNight:{value:t.nightside?1:0},uSeed:{value:new S(Q(t.id.length,3)*40,Q(7,t.id.length)*40,Q(t.id.length,11)*40)}},vertexShader:Yt,fragmentShader:mi,transparent:!0}),f=new U;f.rotation.z=.35+Q(t.id.length,2)*.5,e.add(f);const n=new k(new j(t.radius,64,48),r);f.add(n),a.mat=r;const c=Q(3,t.id.length)>.82?-1:1;if(a.spinMesh=n,a.spinRate=c*(Math.PI*2)/(24+Q(t.id.length,5)*52),t.clouds){const g=new W({uniforms:{uTime:{value:0},uSunDir:{value:new S(1,0,0)},uSeed:{value:new S(3.7,8.1,1.9)},uCover:{value:t.id==="veil"?.95:.5},uFade:{value:1},uTear:{value:0},uTearTime:{value:0},uGravityCenter:{value:new S},uGravityLocalCenter:{value:new S},uGravityRadius:{value:0},uGravityStrength:{value:0},uGravityTime:{value:0},uReverse:{value:1}},vertexShader:Yt,fragmentShader:fi,transparent:!0,depthWrite:!1}),x=new k(new j(t.radius*1.018,48,32),g);f.add(x),a.cloudMat=g,a.cloudMesh=x,a.cloudSpinRate=a.spinRate*(.86+Q(9,t.id.length)*.2)}const m=new W({uniforms:{uColor:{value:o(i.atmo)},uStrength:{value:t.id==="mirror"?1.5:.85},uSunDir:{value:new S(1,0,0)},uTear:{value:0},uTearTime:{value:0},uGravityCenter:{value:new S},uGravityLocalCenter:{value:new S},uGravityRadius:{value:0},uGravityStrength:{value:0},uGravityTime:{value:0},uReverse:{value:1}},vertexShader:Yt,fragmentShader:pi,transparent:!0,depthWrite:!1,blending:A,side:Ge}),y=new k(new j(t.radius*1.07,48,32),m);if(y.renderOrder=2,e.add(y),a.atmo=y,t.rings){const g=t.radius*1.45,x=t.radius*2.5,u=new W({uniforms:{uInner:{value:g},uOuter:{value:x},uTint:{value:o(i.high)},uSunLocal:{value:new S(1,0,.4)},uGravityLocalCenter:{value:new S},uGravityStrength:{value:0},uGravityTime:{value:0},uReverse:{value:1}},vertexShader:Le,fragmentShader:vi,transparent:!0,depthWrite:!1,side:tt}),h=new k(new At(g,x,96,1),u);h.rotation.x=-Math.PI/2+.32,h.renderOrder=3,e.add(h),a.ringMat=u,a.ringMesh=h}}else if(t.kind==="nebula"){const r=t.radius*3.2,f=o(i.base),n=o(i.high),c=new W({uniforms:{uTime:{value:0},uColorA:{value:f},uColorB:{value:n},uOpacity:{value:.95},uCamLocalP:{value:new S}},vertexShader:gi,fragmentShader:yi,transparent:!0,depthWrite:!1,side:tt,blending:$e}),m=new k(new ue(r*2.5,r*2.5,r*2.5),c);m.renderOrder=3,e.add(m),a.mat=c;const y=this.makePoints(1600,(M,P)=>{const w=Math.pow(Math.random(),.55)*r*1.8,E=Math.random()*Math.PI*2,D=Math.acos(2*Math.random()-1);P[M*3]=w*Math.sin(D)*Math.cos(E),P[M*3+1]=w*Math.cos(D),P[M*3+2]=w*Math.sin(D)*Math.sin(E)},M=>M%30===0?3.5+Math.random()*2.8:.6+Math.random()*1.2,M=>{const P=Math.random();return P>.85?[.72,.88,1]:P>.6?[1,.95,.88]:[1,.82,.62]},()=>.4+Math.random()*.55,2.2,!0);e.add(y);const g=nt(128,[[0,"rgba(255,255,255,1)"],[.15,"rgba(255,220,130,0.9)"],[.42,"rgba(255,140,50,0.4)"],[1,"rgba(0,0,0,0)"]]),x=new it({map:g,blending:A,depthWrite:!1,transparent:!0}),u=new J(x);u.position.set(-r*.42,r*.48,r*.02),u.scale.setScalar(r*.38),e.add(u);const h=new J(x);h.position.set(-r*.05,r*.78,-r*.08),h.scale.setScalar(r*.42),e.add(h);const d=new J(x);d.position.set(r*.05,-r*.62,r*.32),d.scale.setScalar(r*.32),e.add(d);const p=this.makePoints(850,(M,P)=>{const w=Math.pow(Math.random(),.7)*r*1.1,E=Math.random()*Math.PI*2,D=Math.acos(2*Math.random()-1);P[M*3]=w*Math.sin(D)*Math.cos(E),P[M*3+1]=w*Math.cos(D)*.8,P[M*3+2]=w*Math.sin(D)*Math.sin(E)},()=>2.2+Math.random()*4.2,()=>Math.random()>.75?[.25,.85,1]:[.85,.45,.15],()=>.3+Math.random()*.45,2.6,!0);e.add(p)}else if(t.kind==="hole"){const r=new k(new j(1.15,48,32),new O({color:0}));e.add(r);const f=new W({uniforms:{uTime:{value:0},uInner:{value:1.5},uOuter:{value:6.2},uColor:{value:new z("#fa8c2e")},uColor2:{value:new z("#ffe6b8")}},vertexShader:Le,fragmentShader:ma,transparent:!0,depthWrite:!1,blending:A,side:tt}),n=new k(new At(1.5,6.2,96,1),f);n.rotation.x=-Math.PI/2+.5,n.renderOrder=4,e.add(n),a.mat=f;const c=new J(new it({map:nt(128,[[0,"rgba(0,0,0,0)"],[.3,"rgba(255,190,110,0.7)"],[.42,"rgba(255,170,90,0.18)"],[1,"rgba(255,150,70,0)"]]),blending:A,depthWrite:!1,transparent:!0}));c.scale.setScalar(6.5),e.add(c)}else if(t.kind==="vault"){const r=t.radius,f=Ve(r);e.add(f.group);const n=new ie({color:791576,emissive:new z("#6fc2b4"),emissiveIntensity:1.8,metalness:.7,roughness:.35}),c=new k(new dt(r*1.9,.04,8,110),n),m=new k(new dt(r*2.4,.026,8,110),n.clone());c.rotation.x=1.1,m.rotation.x=-.7,m.rotation.y=.6,e.add(c,m),e.userData.spin={r1:c,r2:m},e.userData.bh=f}const s=Math.max(t.radius*1.5,2.6),l=new k(new j(s,10,10),new O({visible:!1}));if(l.userData.bodyId=t.id,e.add(l),a.collider=l,this.colliderList.push(l),t.kind==="planet"||t.kind==="dwarf"||t.kind==="vault"){const r=[],n=de(t).eccentricity,c=t.orbit.speed||.01,m=256,y=Math.PI*2/c;for(let h=0;h<=m;h++){const d=h/m*y,p=me(t.orbit.a,n,t.orbit.phase,t.orbit.incl,d,c);r.push(p.x,p.y,p.z)}const g=new yt;g.setAttribute("position",new Ct(r,3));const x=new Vt({color:9150916,transparent:!0,opacity:0}),u=new Ee(g,x);this.scene.add(u),a.orbitLine=u}this.scene.add(e),this.bodies.push(a)}buildBelt(){const t=Math.random,e=new U,a=this.makePoints(4800,(l,r)=>{const f=t()*Math.PI*2,n=78+t()*15+Math.pow(t(),3)*4,c=(t()+t()+t()-1.5)/1.5;r[l*3]=Math.cos(f)*n,r[l*3+1]=c*1.7,r[l*3+2]=Math.sin(f)*n},()=>.22+t()*.6,()=>{const l=.38+t()*.3,r=t()*.1;return[l+r,l*.86,l*.7]},()=>.25+t()*.55,1.15,!1);e.add(a);const i=["#8d8781","#726c65","#9c948b","#615c55","#7f766b","#91867a"],o=6,s=56;for(let l=0;l<o;l++){const r=this.makeRockGeometry(l*17.31+3.7),f=new W({vertexShader:wi,fragmentShader:xi,uniforms:{uColor:{value:new z(i[l%i.length])}}}),n=new Je(r,f,s);n.instanceMatrix.setUsage(ce);const c=[],m=new Re;for(let y=0;y<s;y++){const g=t()*Math.PI*2,x=78+t()*15,u=(t()+t()+t()-1.5)/1.5*1.9,h=.22+Math.pow(t(),2.4)*1.45,d=new Ht().setFromEuler(new ti(t()*Math.PI*2,t()*Math.PI*2,t()*Math.PI*2)),p=new S(Math.cos(g)*x,u,Math.sin(g)*x);m.compose(p,d,new S(h,h,h)),n.setMatrixAt(y,m),c.push({pos:p,q:d,scale:new S(h,h,h),axis:new S(t()-.5,t()-.5,t()-.5).normalize(),speed:.12+t()*.55})}e.add(n),this.asteroidInst.push({mesh:n,tumbles:c})}this.scene.add(e),this.belt=e}makeRockGeometry(t){const e=new ei(1,2),a=e.attributes.position,i=new S,o=1.2+t%.9;for(let s=0;s<a.count;s++){i.fromBufferAttribute(a,s).normalize(),i.y*=.82,i.z*=.92;const l=be(i.x*o+t,i.y*o+i.z*.7+t*1.3)*.4+be(i.y*3.6+t*1.7,i.z*3.6-t)*.13;i.multiplyScalar(1+l),a.setXYZ(s,i.x,i.y,i.z)}return e.computeVertexNormals(),e}buildMeteors(){const t=nt(128,[[0,"rgba(255,255,255,1)"],[.2,"rgba(180,240,255,0.9)"],[.5,"rgba(100,200,255,0.4)"],[1,"rgba(60,140,255,0)"]]),e=Math.random;for(let a=0;a<40;a++){const i=new it({map:t,blending:A,transparent:!0,depthWrite:!1}),o=new J(i),s=new yt;s.setAttribute("position",new Ct([0,0,0,0,0,0],3)),s.setAttribute("color",new Ct([1,1,1,.2,.5,1],3));const l=new Vt({vertexColors:!0,transparent:!0,opacity:.85,blending:A,depthWrite:!1}),r=new _e(s,l),f=new U;f.add(o),f.add(r),this.scene.add(f);const n={pos:new S,vel:new S,len:1,life:0,maxLife:1,headSprite:o,line:r,lineGeom:s,size:1};this.resetMeteor(n),n.life=e()*n.maxLife,this.meteors.push(n)}}resetMeteor(t){const e=Math.random,a=180+e()*22e4,i=e()*Math.PI*2,o=Math.acos(2*e()-1);t.pos.set(a*Math.sin(o)*Math.cos(i),a*Math.cos(o)*.5,a*Math.sin(o)*Math.sin(i));const s=400+e()*3200,l=new S((e()-.5)*2,(e()-.5)*.8,(e()-.5)*2).normalize();t.vel.copy(l).multiplyScalar(s),t.len=120+e()*1100,t.life=0,t.maxLife=1.2+e()*3.5,t.size=Math.max(6,a*.007),t.headSprite.scale.setScalar(t.size)}updateMeteors(t){if(this.bootIntro&&this.clockT<2.4){this.meteors.forEach(e=>{e.headSprite.visible=!1,e.line.visible=!1});return}this.meteors.forEach(e=>{if(e.headSprite.visible=!0,e.line.visible=!0,e.life+=t,e.life>=e.maxLife){this.resetMeteor(e);return}e.pos.addScaledVector(e.vel,t),e.headSprite.position.copy(e.pos);const a=e.pos.clone().sub(e.vel.clone().normalize().multiplyScalar(e.len)),i=e.lineGeom.getAttribute("position");i.setXYZ(0,e.pos.x,e.pos.y,e.pos.z),i.setXYZ(1,a.x,a.y,a.z),i.needsUpdate=!0;const o=Math.sin(e.life/e.maxLife*Math.PI);e.headSprite.material.opacity=o*.95,e.line.material.opacity=o*.8})}buildMultiverse(t){const e=Math.random,a=t||ni;this.multiverseColliders=[],this.galaxyNodes=[],this.multiverseMats=[],this.realityMarbles=[],this.realityGroups={},this.astralCoreGroup=null,this.astralCoreMats=[],this.astralCoreRings=[],this.astralCoreHalo=[],this.demonCorePulseRings=[],this.demonCoreRings=[],this.demonCoreSpires=[],this.demonCoreJets=[],this.demonCoreTachyonNodes=[],this.corePulseOrbs=[];const i=new U,o=96e4;this.giantMultiverseBoundaryMat=new W({uniforms:{uTime:{value:0},uColorA:{value:new z("#06b6d4")},uColorB:{value:new z("#8b5cf6")},uKamuiErase:{value:0},uVortexDir:{value:new S(0,0,-1)}},vertexShader:Ta,fragmentShader:Sa,transparent:!0,depthWrite:!1,side:tt,blending:A});const s=new k(new j(o,64,48),this.giantMultiverseBoundaryMat);i.add(s);const l=new O({color:440020,transparent:!0,opacity:.28,blending:A,side:tt,depthWrite:!1}),r=new k(new dt(o,1800,8,160),l);i.add(r);const f=new k(new dt(o,1400,8,160),l.clone());f.rotation.x=Math.PI/2,i.add(f);const n=new k(new dt(o,1400,8,160),l.clone());n.rotation.y=Math.PI/2,i.add(n);const c=this.makePoints(480,(b,T)=>{const L=Math.acos(2*e()-1),G=e()*Math.PI*2;T[b*3]=o*Math.sin(L)*Math.cos(G),T[b*3+1]=o*Math.cos(L),T[b*3+2]=o*Math.sin(L)*Math.sin(G)},()=>2.5+e()*3.5,b=>b%2===0?[0,.96,.85]:[.55,.35,.95],()=>.45+e()*.45,2.8,!0);i.add(c),this.giantMultiverseSphereGroup=i,this.gMultiverse.add(i);const m="varying vec3 vN; varying vec3 vV; varying vec3 vWN; void main(){ vN = normalize(normalMatrix * normal); vWN = normalize(normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",y=`uniform vec3 uColorA; uniform vec3 uColorB; uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vWN;
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(vV);
  /* chromatic dispersion — each channel refracts at its own edge width */
  float fr = pow(1.0 - abs(dot(N, V)), 1.7);
  float fg = pow(1.0 - abs(dot(N, V)), 1.45);
  float fb = pow(1.0 - abs(dot(N, V)), 1.2);
  vec3 chroma = vec3(fr, fg, fb);
  float band = 0.5 + 0.5 * sin(vWN.y * 5.0 - uTime * 0.5) * sin(vWN.x * 3.0 + uTime * 0.35);
  vec3 base = mix(uColorA, uColorB, 0.35 + 0.3 * band);
  /* key-light specular glint — the sun catching the glass */
  vec3 L = normalize(vec3(0.35, 0.8, 0.42));
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 100.0);
  float sheen = pow(max(dot(N, H), 0.0), 12.0) * 0.22;
  vec3 col = base * (chroma * 4.2 + 0.07) + vec3(1.0, 0.98, 0.94) * (spec * 1.6 + sheen);
  float a = min(1.0, (chroma.r + chroma.g + chroma.b) * 0.9 + 0.07 + spec);
  gl_FragColor = vec4(col, a);
}`,g=nt(128,[[0,"rgba(255,255,255,1)"],[.3,"rgba(255,255,255,0.45)"],[1,"rgba(255,255,255,0)"]]);for(let b=0;b<a.length;b++){const T=a[b],L=new S(...T.bubblePos),G=T.bubbleSize,V=new U;V.userData={realityId:T.id};const st=new k(new j(G,16,12),new O({visible:!1}));st.position.copy(L),st.userData={realityId:T.id,isRealityBubble:!0},V.add(st),this.multiverseColliders.push(st);const Qt=new O({color:new z(T.colorA).lerp(new z(T.colorB),.5),transparent:!0,opacity:.45,depthWrite:!1,blending:A}),re=new k(new j(G*.16,24,18),Qt);re.position.copy(L),V.add(re);const Lt=new z(T.colorA),ne=new z(T.colorB),Ze=new W({uniforms:{uColorA:{value:Lt.clone()},uColorB:{value:ne.clone()},uTime:{value:0}},vertexShader:m,fragmentShader:y,transparent:!0,depthWrite:!1,blending:A});if(V.add(new k(new j(G*2.6,48,32),Ze)),!this.marbleRingTex){const K=document.createElement("canvas");K.width=K.height=256;const Z=K.getContext("2d");Z.strokeStyle="rgba(255,255,255,0.95)",Z.lineWidth=10,Z.shadowColor="rgba(255,255,255,0.8)",Z.shadowBlur=14,Z.beginPath(),Z.arc(128,128,108,0,Math.PI*2),Z.stroke(),this.marbleRingTex=new Ft(K)}const Se=new J(new it({map:this.marbleRingTex,color:Lt.clone().lerp(ne,.5),blending:A,depthWrite:!1,transparent:!0,opacity:.7}));Se.scale.setScalar(G*5),Se.position.copy(L),V.add(Se);const Ce=new J(new it({map:g,color:Lt.clone().lerp(ne,.4).lerp(new z("#ffffff"),.55),blending:A,depthWrite:!1,transparent:!0,opacity:.8}));Ce.scale.setScalar(G*.9),Ce.position.copy(L),V.add(Ce);let $t=0;for(let K=0;K<T.id.length;K++)$t=$t*31+T.id.charCodeAt(K)>>>0;const $=()=>($t=$t*1664525+1013904223>>>0,$t/4294967296),Nt=this.makePoints(700,(K,Z)=>{const pt=K%3,Et=Math.pow($(),.6)*G*.85,ut=pt/3*Math.PI*2+Et*8e-4+($()-.5)*.4,Jt=($()+$()-1)*G*.08;Z[K*3]=Math.cos(ut)*Et+Math.cos(ut+1.57)*Jt,Z[K*3+1]=($()+$()-1)*G*.12,Z[K*3+2]=Math.sin(ut)*Et+Math.sin(ut+1.57)*Jt},()=>1.1+$()*1.3,()=>{const K=$();if(K>.85)return[1,1,1];const Z=K>.5?Lt:ne;return[Z.r,Z.g,Z.b]},()=>.45+$()*.45,1.6,!0);Nt.material.userData.pointMode="marble",Nt.position.copy(L),Nt.rotation.x=($()-.5)*1.2,Nt.rotation.z=($()-.5)*1.2,V.add(Nt),this.realityMarbles.push({spiral:Nt,glassMat:Ze,speed:.04+$()*.06});const zi=this.makePoints(140,(K,Z)=>{const pt=G*(1.08+e()*.4),Et=e()*Math.PI*2,ut=Math.acos(2*e()-1);Z[K*3]=L.x+pt*Math.sin(ut)*Math.cos(Et),Z[K*3+1]=L.y+pt*Math.cos(ut),Z[K*3+2]=L.z+pt*Math.sin(ut)*Math.sin(Et)},()=>2.2+e()*3,()=>[1,.95,.85],()=>.55+e()*.35,2.6,!0);V.add(zi);const Pe=T.galaxies||[];for(let K=0;K<Pe.length;K++){const Z=Pe[K],pt=G*Math.max(1.05,Z.orbitRadius),Et=Z.orbitSpeed||.05,ut=Z.orbitIncl||.3,Jt=Z.orbitPhase||K/Math.max(1,Pe.length)*Math.PI*2,Ye=[],Xe=96;for(let Tt=0;Tt<=Xe;Tt++){const St=Tt/Xe*Math.PI*2,De=Math.cos(St)*pt,ee=Math.sin(St)*pt*Math.sin(ut),Ut=Math.sin(St)*pt*Math.cos(ut);Ye.push(L.x+De,L.y+ee,L.z+Ut)}const qe=new yt;qe.setAttribute("position",new Ct(Ye,3));const Ai=new Vt({color:new z(Z.color||T.colorA),transparent:!0,opacity:Z.isHomeGalaxy?.38:.2,blending:A,depthWrite:!1}),je=new Ee(qe,Ai);V.add(je);const Ot=new U,ke=Jt;Ot.position.set(L.x+Math.cos(ke)*pt,L.y+Math.sin(ke)*pt*Math.sin(ut),L.z+Math.sin(ke)*pt*Math.cos(ut));const Fi=new z(Z.color||T.colorA),te=new U;te.rotation.x=.5+K*37%11*.06,te.rotation.z=K*53%13*.05;const Ke=this.makePoints(420,(Tt,St)=>{const De=Tt%3,ee=Math.pow($(),.6)*G*.085,Ut=De/3*Math.PI*2+ee*.0035+($()-.5)*.4,Qe=($()+$()-1)*G*.012;St[Tt*3]=Math.cos(Ut)*ee+Math.cos(Ut+1.57)*Qe,St[Tt*3+1]=($()+$()-1)*G*.01,St[Tt*3+2]=Math.sin(Ut)*ee+Math.sin(Ut+1.57)*Qe},()=>1+$()*1.2,()=>{const Tt=$();if(Tt>.88)return[1,1,1];const St=Tt>.5?Fi:new z(T.colorB);return[St.r,St.g,St.b]},()=>.45+$()*.45,1.5,!0);Ke.material.userData.pointMode="marble",te.add(Ke),Ot.add(te);const Gi=nt(128,[[0,Z.color||T.colorA],[.35,`${Z.color||T.colorA}88`],[.7,`${Z.color||T.colorA}22`],[1,"rgba(0,0,0,0)"]]),Ie=new J(new it({map:Gi,blending:A,depthWrite:!1,transparent:!0}));Ie.scale.setScalar(G*.1),Ot.add(Ie);const le=new k(new j(G*.18,10,10),new O({visible:!1}));le.userData={isGalaxy:!0,galaxyData:Z,galaxyId:Z.id,realityId:T.id},Ot.add(le),this.multiverseColliders.push(le),V.add(Ot),this.galaxyNodes.push({galaxyData:Z,realityId:T.id,group:Ot,collider:le,orbitRadius:pt,orbitSpeed:Et,orbitIncl:ut,phase:Jt,centerPos:L,spiralGroup:te,glowSprite:Ie,orbitLine:je})}V.visible=T.id===this.activeRealityId,this.gMultiverse.add(V),this.realityGroups[T.id]=V}const x=new U;x.position.set(65e3,12e3,-55e3);const u=this.makePoints(14e3,(b,T)=>{const L=b%4,G=Math.pow(e(),.58)*9500,V=L/4*Math.PI*2+G*6e-4*3.4+(e()-.5)*.4,st=(e()+e()-1)*(400+G*.08);T[b*3]=Math.cos(V)*G+Math.cos(V+1.57)*st,T[b*3+1]=(e()-.5)*(300+G*.03),T[b*3+2]=Math.sin(V)*G+Math.sin(V+1.57)*st},()=>1.2+e()*2.2,()=>{const b=e();return b>.85?[1,.72,.85]:b>.6?[.45,.75,1]:[.75,.85,1]},()=>.35+e()*.55,2.2,!0);u.rotation.x=.8,u.rotation.z=-.3,x.add(u);const h=this.makePoints(8e3,(b,T)=>{const L=b%2,G=Math.pow(e(),.52)*5200,V=L/2*Math.PI*2+G*.001*4.2+(e()-.5)*.35;T[b*3]=Math.cos(V)*G-6500,T[b*3+1]=Math.sin(V)*G*.4+3200,T[b*3+2]=Math.sin(V)*G-4200},()=>1+e()*2,()=>[1,.8,.6],()=>.4+e()*.5,2,!0);x.add(h);const d=new J(new it({map:nt(128,[[0,"rgba(255,220,160,0.6)"],[.35,"rgba(255,160,80,0.25)"],[1,"rgba(0,0,0,0)"]]),blending:A,depthWrite:!1,transparent:!0}));d.scale.setScalar(4500),x.add(d);const p=new U,M=new O({color:440020,transparent:!0,opacity:.85,blending:A,side:tt,depthWrite:!1}),P=new k(new dt(1.2,.035,16,64),M),w=new k(new dt(1.38,.02,16,64),M);w.rotation.x=Math.PI/3,w.rotation.y=Math.PI/6,p.add(P),p.add(w);const E=a.find(b=>b.id===this.activeRealityId)||a[0];E&&(p.position.set(...E.bubblePos),p.scale.setScalar(E.bubbleSize)),this.activeRealityShieldMesh=p,this.gMultiverse.add(p);const D=new U;D.position.set(0,0,0),this.demonCoreMat=new W({uniforms:{uTime:{value:0},uColorCore:{value:new z("#ff0055")},uColorAura:{value:new z("#8b5cf6")},uHover:{value:0},uTearStrength:{value:0}},vertexShader:wa,fragmentShader:xa,transparent:!0,side:tt});const _=new k(new ei(9200,4),this.demonCoreMat);D.add(_),this.demonCoreInnerGeom=new k(new ii(6200,2),new O({color:16758531,wireframe:!0,transparent:!0,opacity:.65,blending:A})),D.add(this.demonCoreInnerGeom);const B=new U,C=new O({color:62932,wireframe:!0,transparent:!0,opacity:.45,blending:A}),v=new O({color:16096779,wireframe:!0,transparent:!0,opacity:.6,blending:A}),R=new k(new ue(4800,4800,4800),C),F=new k(new ue(2400,2400,2400),v);B.add(R),B.add(F),D.add(B),this.demonCoreTesseract=B;const Y=new k(new ai(3200,1),new O({color:62932,wireframe:!1,transparent:!0,opacity:.65,blending:A}));D.add(Y),this.demonCoreJets=[];const X=new O({color:3718648,transparent:!0,opacity:.2,blending:A,side:tt,depthWrite:!1}),q=new k(new si(2400,95e3,32,1,!0),X);q.position.set(0,48e3,0),D.add(q),this.demonCoreJets.push(q);const N=new k(new si(2400,95e3,32,1,!0),X);N.position.set(0,-48e3,0),N.rotation.x=Math.PI,D.add(N),this.demonCoreJets.push(N),this.demonCoreRings=[];const at=["#f59e0b","#06b6d4","#8b5cf6","#ff0055"],vt=[14e3,19500,25e3,31e3],gt=[110,95,80,70];for(let b=0;b<4;b++){const T=new dt(vt[b],gt[b],16,120),L=new O({color:new z(at[b]),transparent:!0,opacity:.65,blending:A,side:tt,depthWrite:!1}),G=new k(T,L);G.rotation.x=b*Math.PI/4+.3,G.rotation.y=b*.65,D.add(G),this.demonCoreRings.push(G);for(let V=0;V<6;V++){const st=V/6*Math.PI*2,Qt=new ii(550,0),re=new O({color:new z(at[b]),wireframe:!0,blending:A}),Lt=new k(Qt,re);Lt.position.set(Math.cos(st)*vt[b],Math.sin(st)*vt[b],0),G.add(Lt)}}this.demonCoreTachyonNodes=[];for(let b=0;b<6;b++){const T=new ai(600,0),L=new O({color:b%2===0?62932:16096779,wireframe:!0,blending:A}),G=new k(T,L);G.userData={radius:36e3+b*4500,speed:.015+b*.005,incl:b*Math.PI/6,phase:b*1.05},D.add(G),this.demonCoreTachyonNodes.push(G)}this.demonCoreSpires=[];const H=new ie({color:590612,emissive:new z("#8b5cf6"),emissiveIntensity:1.1,metalness:.95,roughness:.15}),ot=12;for(let b=0;b<ot;b++){const T=b/ot*Math.PI*2,L=b%3===0?0:b%3===1?.52:-.52,G=new oi(240,1100,11e3,6),V=new k(G,H),st=14500;V.position.set(Math.cos(T)*Math.cos(L)*st,Math.sin(L)*st,Math.sin(T)*Math.cos(L)*st),V.quaternion.setFromUnitVectors(new S(0,1,0),V.position.clone().normalize()),D.add(V),this.demonCoreSpires.push(V)}this.demonCorePulseRings=[];const wt=[62932,15485081,9133302,16096779];for(let b=0;b<4;b++){const T=new dt(11e3,75,12,90),L=new O({color:wt[b%wt.length],transparent:!0,opacity:.35,blending:A,depthWrite:!1}),G=new k(T,L);G.rotation.x=b*Math.PI/4+.35,G.rotation.y=b*.78,G.rotation.z=b*Math.PI/3,G.userData={phase:b/4,baseScale:1,rotSpeed:.005+b*.003},D.add(G),this.demonCorePulseRings.push(G)}const ct=this.makePoints(2200,(b,T)=>{const L=11e3+Math.pow(e(),.6)*28e3,G=e()*Math.PI*2,V=Math.acos(2*e()-1);T[b*3]=L*Math.sin(V)*Math.cos(G),T[b*3+1]=L*Math.cos(V)*.35+(e()-.5)*1200,T[b*3+2]=L*Math.sin(V)*Math.sin(G)},()=>2.5+e()*4.5,b=>{const T=[[0,.85,.75],[.85,.6,0],[.45,.28,.85],[.85,0,.28]];return T[b%T.length]},()=>.45+e()*.35,2.6,!0);D.add(ct),this.demonCoreLight=new ze(9133302,.45,18e4),D.add(this.demonCoreLight);const It=new ze(62932,.3,15e4);D.add(It);const xt=[],_t=[];a.forEach(b=>{const T=new S(...b.bubblePos);_t.push(T),xt.push(0,0,0),xt.push(T.x,T.y,T.z)});const Gt=new yt;Gt.setAttribute("position",new Ct(xt,3)),this.coreStabilizerBeamMat=new Vt({color:440020,transparent:!0,opacity:.25,blending:A,depthWrite:!1}),this.coreStabilizerBeams=new Ae(Gt,this.coreStabilizerBeamMat),this.gMultiverse.add(this.coreStabilizerBeams),this.corePulseOrbs=[],_t.forEach((b,T)=>{const L=new j(220,8,8),G=new O({color:T%2===0?62932:16096779,transparent:!0,opacity:.75,blending:A}),V=new k(L,G);V.userData={targetPos:b,progress:T*.05%1},this.gMultiverse.add(V),this.corePulseOrbs.push(V)}),this.demonCoreCollider=new k(new j(32e3,16,14),new O({visible:!1})),this.demonCoreCollider.userData={isDemonCore:!0,id:"demon-core"},D.add(this.demonCoreCollider),D.visible=!1,this.demonCoreLight.intensity=0,this.coreStabilizerBeams.visible=!1,this.corePulseOrbs.forEach(b=>b.visible=!1),this.demonCoreGroup=D,this.gMultiverse.add(D);const Dt=new U;Dt.position.set(0,0,0);const se=new W({uniforms:{uTime:{value:0},uHover:{value:0},uColorA:{value:new z("#00f5d4")},uColorB:{value:new z("#8b5cf6")},uColorHeart:{value:new z("#ff2d78")}},vertexShader:`
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = normalize(-mv.xyz);
          vP = position;
          gl_Position = projectionMatrix * mv;
        }`,fragmentShader:`
        uniform float uTime; uniform float uHover;
        uniform vec3 uColorA; uniform vec3 uColorB; uniform vec3 uColorHeart;
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){
          vec3 N = normalize(vN); vec3 V = normalize(vV);
          float fres = pow(1.0 - abs(dot(N, V)), 2.1);
          /* living energy bands crawling over the glass shell */
          float bands = 0.5 + 0.5 * sin(vP.y * 0.00042 + uTime * 0.9) * sin(vP.x * 0.00037 - uTime * 0.62);
          float swirl = 0.5 + 0.5 * sin(atan(vP.z, vP.x) * 3.0 + uTime * 0.8 + vP.y * 0.00028);
          vec3 col = mix(uColorA, uColorB, swirl);
          col = mix(col, uColorHeart, bands * 0.42);
          col += vec3(1.0) * pow(bands, 5.0) * 0.6;
          float a = fres * (0.85 + uHover * 0.6) + bands * 0.10 + 0.04;
          gl_FragColor = vec4(col * (1.25 + uHover * 0.8), a);
        }`,transparent:!0,depthWrite:!1,blending:A,side:Ge}),oe=new k(new j(2e4,56,40),se);Dt.add(oe),this.astralCoreMats.push(se);const rt=new J(new it({map:nt(256,[[0,"rgba(255,255,255,1)"],[.18,"rgba(255,170,210,0.9)"],[.42,"rgba(139,92,246,0.42)"],[1,"rgba(0,0,0,0)"]]),blending:A,depthWrite:!1,transparent:!0,opacity:.95}));rt.scale.setScalar(96e3),Dt.add(rt);for(let b=0;b<2;b++){const T=this.makePoints(700,(L,G)=>{const V=26e3+b*14e3+(e()-.5)*5200,st=e()*Math.PI*2,Qt=(e()+e()+e()-1.5)*3400;G[L*3]=Math.cos(st)*V,G[L*3+1]=Qt,G[L*3+2]=Math.sin(st)*V},()=>1.6+e()*2.6,()=>b===0?[0,.96,.83]:[.62,.42,1],()=>.35+e()*.45,2.4,!0);T.material.userData.pointMode="multiverse",Dt.add(T),this.astralCoreHalo.push(T)}const ht=["#00f5d4","#8b5cf6","#ff2d78"];for(let b=0;b<3;b++){const T=new k(new dt(25e3+b*6500,260-b*40,12,140),new O({color:new z(ht[b]),transparent:!0,opacity:.5,blending:A,depthWrite:!1}));T.rotation.x=b*Math.PI/3+.35,T.rotation.y=b*.9,Dt.add(T),this.astralCoreRings.push(T)}const ft=new k(new j(3e4,16,14),new O({visible:!1}));ft.userData={isMultiverseCore:!0,id:"multiverse-core"},Dt.add(ft),this.multiverseColliders.push(ft),this.astralCoreGroup=Dt,this.gMultiverse.add(Dt),this.gWeb.traverse(b=>{const T=b.material;T&&T.uniforms&&T.uniforms.uVortexS&&!this.webVortexMats.includes(T)&&this.webVortexMats.push(T)}),this.gMultiverse.add(x),this.scene.add(this.gMultiverse),this.gMultiverse.traverse(b=>{b.frustumCulled=!1})}rebuildMultiverse(t){li("multiverse-rebuild-start");const e=new Set;for(this.marbleRingTex&&e.add(this.marbleRingTex),this.disposeObject3D(this.gMultiverse,{textures:e});this.gMultiverse.children.length>0;){const a=this.gMultiverse.children[0];this.gMultiverse.remove(a)}this.dropOwnedPointsMaterials("multiverse"),this.buildMultiverse(t),this.collectPointsMaterials(this.gMultiverse,"multiverse","multiverse"),ci("multiverse-rebuild","multiverse-rebuild-start")}buildLevels(){const t=Math.random;this.gGalaxy.add(this.gGalaxyContents),this.scene.add(this.gGalaxy),this.buildClusterStage(),this.scene.add(this.gCluster);const e=this.makePoints(4500,(d,p)=>{const M=Math.floor(d/150),P=M/30*Math.PI*2,w=Math.acos(2*(M/30)-1),E=38e3+M%12*4500,D=d%150/150,_=new S(E*Math.sin(w)*Math.cos(P),E*Math.cos(w)*.45,E*Math.sin(w)*Math.sin(P)),B=new S(42e3,8e3,-35e3),C=_.lerp(B,D*.4),v=(t()-.5)*(1800+D*800);p[d*3]=C.x+v,p[d*3+1]=C.y+(t()-.5)*1200,p[d*3+2]=C.z+v},()=>1.4+t()*2.5,d=>{const p=t();return p>.7?[1,.85,.6]:p>.4?[.4,.85,.9]:[.75,.8,1]},()=>.35+t()*.45,2,!0);this.gSupercluster.add(e);const a=new J(new it({map:nt(256,[[0,"rgba(255,220,160,0.9)"],[.3,"rgba(255,160,80,0.4)"],[1,"rgba(0,0,0,0)"]]),blending:A,depthWrite:!1,transparent:!0}));a.position.set(42e3,8e3,-35e3),a.scale.setScalar(11e3),this.gSupercluster.add(a),this.levelSprites.push({mat:a.material,base:1,level:"supercluster"}),this.scene.add(this.gSupercluster);const i=240,o=135e3,s=[],l=[];for(let d=0;d<i;d++){const p=t()*Math.PI*2,M=Math.acos(2*t()-1),P=o*(.18+.82*Math.pow(t(),.65));s.push(new S(P*Math.sin(M)*Math.cos(p),P*Math.cos(M)*.55,P*Math.sin(M)*Math.sin(p)));const w=t();l.push(w>.82?new z("#ffc878"):w>.5?new z("#64dfdf"):new z("#83c5be"))}const r=[],f=new Array(i).fill(0);s.forEach((d,p)=>{const M=s.map((w,E)=>[E,d.distanceTo(w)]).filter(([w])=>w!==p).sort((w,E)=>w[1]-E[1]),P=3+Math.floor(t()*3);for(let w=0;w<P;w++){const E=M[w][0];d.distanceTo(s[E])<o*.52&&(r.push([p,E]),f[p]++,f[E]++)}});const n=220,c=this.makePoints(r.length*n,(d,p)=>{const[M,P]=r[d%r.length],w=Math.floor(d/r.length)/n,E=s[M],D=s[P],_=Math.sin(w*Math.PI*3+M*.5)*1200+Math.cos(w*Math.PI*2+P*.3)*900,B=E.clone().lerp(D,w).add(new S(_,_*.5,-_)),C=450+B.length()*.008;p[d*3]=B.x+(t()-.5)*C,p[d*3+1]=B.y+(t()-.5)*C,p[d*3+2]=B.z+(t()-.5)*C},()=>.5+t()*1.8,()=>{const d=t();return d>.85?[1,.88,.62]:d>.55?[.38,.82,.95]:[.58,.72,.95]},()=>.22+t()*.5,1.8,!0);this.gWeb.add(c);const m=this.makePoints(i,(d,p)=>{p[d*3]=s[d].x,p[d*3+1]=s[d].y,p[d*3+2]=s[d].z},d=>2+f[d]*.55,d=>{const p=l[d];return[p.r,p.g,p.b]},()=>.6+t()*.4,2.8,!0);this.gWeb.add(m);const y=[],g=[];r.forEach(([d,p])=>{y.push(s[d].x,s[d].y,s[d].z,s[p].x,s[p].y,s[p].z);const M=l[d],P=l[p];g.push(M.r,M.g,M.b,P.r,P.g,P.b)});const x=new yt;x.setAttribute("position",new Ct(y,3)),x.setAttribute("color",new Ct(g,3)),this.webLineMat=new W({uniforms:{uOpacity:{value:0},uVortexC:{value:new S},uVortexR:{value:0},uVortexS:{value:0},uVortexT:{value:0}},vertexShader:`
        attribute vec3 position; attribute vec3 color;
        uniform vec3 uVortexC; uniform float uVortexR; uniform float uVortexS; uniform float uVortexT;
        varying vec3 vColor; varying float vFade;
        void main(){
          vColor = color;
          vec3 vp = position;
          float d = distance(vp, uVortexC);
          float infl = uVortexS * smoothstep(uVortexR, uVortexR * 0.1, d);
          if (infl > 0.001) {
            vec3 axis = normalize(vec3(0.18, 1.0, 0.12));
            vec3 dir = vp - uVortexC;
            float a = infl * (5.0 + uVortexT * 3.5);
            vec3 spun = dir * cos(a) + cross(axis, dir) * sin(a) * 1.15;
            vp = uVortexC + spun * (1.0 - infl * 0.5);
            vFade = 1.0 - infl * 0.6;
          } else { vFade = 1.0; }
          gl_Position = projectionMatrix * modelViewMatrix * vec4(vp, 1.0);
        }`,fragmentShader:`
        uniform float uOpacity; varying vec3 vColor; varying float vFade;
        void main(){ gl_FragColor = vec4(vColor, uOpacity * vFade); }`,transparent:!0,depthWrite:!1,blending:A,vertexColors:!0}),this.gWeb.add(new Ae(x,this.webLineMat));const u=s.map((d,p)=>[d,f[p]]).sort((d,p)=>p[1]-d[1]).slice(0,35),h=this.makePoints(u.length*70,(d,p)=>{const M=Math.floor(d/70),P=u[M][0],w=Math.pow(t(),1.5)*3200,E=t()*Math.PI*2;p[d*3]=P.x+Math.cos(E)*w,p[d*3+1]=P.y+(t()-.5)*1100,p[d*3+2]=P.z+Math.sin(E)*w},()=>1.6+t()*3,d=>Math.floor(d/70)%3===0?[1,.9,.7]:[.5,.85,1],()=>.55+t()*.45,2.4,!0);this.gWeb.add(h),this.scene.add(this.gWeb),this.beacon=new J(new it({map:nt(128,[[0,"rgba(255,240,210,1)"],[.3,"rgba(255,205,130,0.5)"],[1,"rgba(255,180,100,0)"]]),blending:A,depthWrite:!1,transparent:!0})),this.beacon.scale.setScalar(1500),this.scene.add(this.beacon),[this.gNeighborhood,this.gGalaxy,this.gCluster,this.gSupercluster,this.gWeb].forEach(d=>{d.traverse(p=>{p.frustumCulled=!1})}),this.gCluster.children.forEach(d=>{(d instanceof Zt||d instanceof _e)&&(d.frustumCulled=!0)})}static galaxyStagePosition(t,e,a,i){if(i===0)return new S(0,0,0);const o=i-1,s=13e3+Math.floor(o/4)*9e3,l=o*2.399963+Math.floor(o/4)*.9,r=Math.sin(a*2.2+i*.7)*2200;return new S(Math.cos(l)*s,r,Math.sin(l)*s)}buildGalaxyStageContents(t){this.dropOwnedPointsMaterials("galaxyStage");const e=new Set,a=new Set;for(this.moonGeo&&e.add(this.moonGeo),this.moonMat&&a.add(this.moonMat),this.disposeObject3D(this.gGalaxyContents,{geometries:e,materials:a});this.gGalaxyContents.children.length>0;)this.gGalaxyContents.remove(this.gGalaxyContents.children[0]);this.galaxyStageNodes=[],this.galaxyStageColliders=[],this.galaxyStagePointMats=[],this.innerColliderList=[],this.innerFocusBodyId=null;const i=t.galaxies??[];let o=0;for(let l=0;l<t.id.length;l++)o=o*31+t.id.charCodeAt(l)>>>0;const s=()=>(o=o*1664525+1013904223>>>0,o/4294967296);i.forEach((l,r)=>{const f=l.isHomeGalaxy||r===0,n=f?0:r,c=f?5600:2600+s()*1600,m=3+Math.floor(s()*3),y=2.6+s()*1.2,g=zt.galaxyStagePosition(l.orbitRadius,l.orbitPhase,l.orbitIncl,n),x=new z(l.color||t.colorA),u=new U;u.position.copy(g),u.rotation.x=.32+s()*.55,u.rotation.z=(s()-.5)*.7;const h=this.makePoints(f?13e3:6500+Math.floor(s()*2500),(_,B)=>{const C=_%m,v=Math.pow(s(),.62)*c,R=C/m*Math.PI*2+v*.001*y*3.2+(s()-.5)*(.5-v/c*.32),F=(s()+s()+s()-1.5)*(170+v*.09);B[_*3]=Math.cos(R)*v+Math.cos(R+1.57)*F,B[_*3+1]=(s()+s()-1)*(90+v*.012),B[_*3+2]=Math.sin(R)*v+Math.sin(R+1.57)*F},()=>.6+s()*1.3,()=>{const _=s();if(_>.93)return[1,1,1];if(_>.55)return[x.r,x.g,x.b];if(_>.3)return[1,.88,.68];const B=.55+s()*.4;return[B*.75,B*.84,B]},()=>.2+s()*.55,1.7,!1);h.frustumCulled=!0,u.add(h),this.galaxyStagePointMats.push({points:h,mat:h.material});const d=x.clone().lerp(new z("#ffffff"),.42),p=nt(256,[[0,`rgba(${Math.round(d.r*255)},${Math.round(d.g*255)},${Math.round(d.b*255)},1)`],[.28,`rgba(${Math.round(x.r*255)},${Math.round(x.g*255)},${Math.round(x.b*255)},0.85)`],[.58,`rgba(${Math.round(x.r*200)},${Math.round(x.g*200)},${Math.round(x.b*200)},0.3)`],[1,"rgba(0,0,0,0)"]]),M=new J(new it({map:p,blending:A,depthWrite:!1,transparent:!0,opacity:.95}));M.scale.setScalar(c*.85),u.add(M);const P=M.material,w=new k(new j(c*1.35,12,10),new O({visible:!1}));w.userData={isGalaxy:!0,galaxyData:l,galaxyId:l.id,realityId:t.id},u.add(w),this.galaxyStageColliders.push(w);let E=null;const D=new U;if(!f){const _=this.buildInnerStellarSystem(l,x,s,t);E=_.sys,D.add(_.root)}D.visible=!1,u.add(D),this.gGalaxyContents.add(u),this.galaxyStageNodes.push({data:l,group:u,collider:w,radius:c,glowMat:P,discMat:h.material,inner:D,innerSys:E})}),this.collectPointsMaterials(this.gGalaxyContents,"galaxyStage","standard"),this.lastEntries&&this.syncMoons(this.lastEntries)}buildInnerStellarSystem(t,e,a,i){const o=new U,s=aa(t),l=s.find(C=>C.kind==="star")??s[0],r={starData:l,starUniforms:{},starMesh:null,corona:null,coronaMat:null,haloA:null,haloB:null,planets:[],belt:new U,beltInst:[],beltDustMat:null};o.add(r.belt);const f=C=>new z(C),n=f(i.colorA),c=f(i.colorB),m=f(i.starColor||i.colorA);r.starUniforms={uTime:{value:0},uBoost:{value:1},uColorA:{value:n.clone()},uColorB:{value:c.clone()},uCoreColor:{value:m.clone()}};const y=new W({uniforms:r.starUniforms,vertexShader:ui,fragmentShader:di});r.starMesh=new k(new j(l.radius,96,64),y),o.add(r.starMesh);const g=new k(new j(Math.max(l.radius*1.4,8.4),12,12),new O({visible:!1}));g.userData={isInner:!0,isInnerStar:!0,bodyId:`inner:${l.id}`},o.add(g),this.innerColliderList.push(g),r.coronaMat=new W({uniforms:{uTime:{value:0},uBoost:{value:1},uColorA:{value:n.clone()},uColorB:{value:c.clone()}},vertexShader:bi,fragmentShader:Mi,transparent:!0,depthWrite:!1,blending:A,side:tt});const x=new k(new he(l.radius*10.6,l.radius*10.6),r.coronaMat);x.renderOrder=5,x.frustumCulled=!1,o.add(x),r.corona=x;const u=(C,v,R,F,Y)=>{const X=this.makePoints(v,(q,N)=>{const at=q/v*Math.PI*2+a()*.06,vt=C+(a()-.5)*.7;N[q*3]=Math.cos(at)*vt,N[q*3+1]=(a()-.5)*.35,N[q*3+2]=Math.sin(at)*vt},()=>.5+a()*.9,()=>R,()=>.3+a()*.55,Y,!0);return X.rotation.x=F,o.add(X),X};r.haloA=u(l.radius*1.6,700,[1,.82,.55],.42,1.6),r.haloB=u(l.radius*1.9,420,[.55,.85,.8],-.55,1.3);const h=nt(128,[[0,"rgba(255,252,244,1)"],[.25,`rgba(${Math.round(e.r*255)},${Math.round(e.g*255)},${Math.round(e.b*255)},0.55)`],[1,"rgba(0,0,0,0)"]]),d=new J(new it({map:h,blending:A,depthWrite:!1,transparent:!0,opacity:.45}));d.scale.setScalar(l.radius*8.5),o.add(d);const p=s.find(C=>/-w2$/.test(C.id)),M=s.find(C=>C.rings),P=p&&M&&M!==p?(p.orbit.a+M.orbit.a)/2:80;this.moonGeo||(this.moonGeo=new j(1,22,14)),this.moonMat||(this.moonMat=new ie({color:11051674,roughness:.95,metalness:.02}));for(const C of s){if(C.kind==="star")continue;const v=C.palette,R=H=>new z(H),F=new U;if(C.kind==="vault"){const H=Ve(C.radius);F.add(H.group);const ot=new ie({color:791576,emissive:new z("#6fc2b4"),emissiveIntensity:1.8,metalness:.7,roughness:.35}),wt=new k(new dt(C.radius*1.9,.04,8,110),ot),ct=new k(new dt(C.radius*2.4,.026,8,110),ot.clone());wt.rotation.x=1.1,ct.rotation.x=-.7,ct.rotation.y=.6,F.add(wt,ct),F.userData.spin={r1:wt,r2:ct};const It={data:C,group:F,blackHole:H,moons:[],hoverT:0};this.addInnerColliderAndOrbit(It,o,a),o.add(F),r.planets.push(It);continue}if(C.kind==="nebula"){const H=C.radius*3.2,ot=R(v.base),wt=R(v.high),ct=new W({uniforms:{uTime:{value:0},uColorA:{value:ot},uColorB:{value:wt},uOpacity:{value:.95},uCamLocalP:{value:new S}},vertexShader:gi,fragmentShader:yi,transparent:!0,depthWrite:!1,side:tt,blending:$e}),It=new k(new ue(H*2.5,H*2.5,H*2.5),ct);It.renderOrder=3,F.add(It);const xt=this.makePoints(1600,(rt,ht)=>{const ft=Math.pow(Math.random(),.55)*H*1.8,b=Math.random()*Math.PI*2,T=Math.acos(2*Math.random()-1);ht[rt*3]=ft*Math.sin(T)*Math.cos(b),ht[rt*3+1]=ft*Math.cos(T),ht[rt*3+2]=ft*Math.sin(T)*Math.sin(b)},rt=>rt%30===0?3.5+Math.random()*2.8:.6+Math.random()*1.2,rt=>{const ht=Math.random();return ht>.85?[.72,.88,1]:ht>.6?[1,.95,.88]:[1,.82,.62]},()=>.4+Math.random()*.55,2.2,!0);F.add(xt);const _t=nt(128,[[0,"rgba(255,255,255,1)"],[.15,"rgba(255,220,130,0.9)"],[.42,"rgba(255,140,50,0.4)"],[1,"rgba(0,0,0,0)"]]),Gt=new it({map:_t,blending:A,depthWrite:!1,transparent:!0});[[-H*.42,H*.48,H*.02,H*.38],[-H*.05,H*.78,-H*.08,H*.42],[H*.05,-H*.62,H*.32,H*.32]].forEach(([rt,ht,ft,b])=>{const T=new J(Gt);T.position.set(rt,ht,ft),T.scale.setScalar(b),F.add(T)});const se=this.makePoints(850,(rt,ht)=>{const ft=Math.pow(Math.random(),.7)*H*1.1,b=Math.random()*Math.PI*2,T=Math.acos(2*Math.random()-1);ht[rt*3]=ft*Math.sin(T)*Math.cos(b),ht[rt*3+1]=ft*Math.cos(T)*.8,ht[rt*3+2]=ft*Math.sin(T)*Math.sin(b)},()=>2.2+Math.random()*4.2,()=>Math.random()>.75?[.25,.85,1]:[.85,.45,.15],()=>.3+Math.random()*.45,2.6,!0);F.add(se);const oe={data:C,group:F,mat:ct,moons:[],hoverT:0};this.addInnerColliderAndOrbit(oe,o,a),o.add(F),r.planets.push(oe);continue}const Y=new W({uniforms:{uDeep:{value:R(v.deep)},uBase:{value:R(v.base)},uHigh:{value:R(v.high)},uIce:{value:R(v.ice)},uSunDir:{value:new S(1,0,0)},uTime:{value:0},uSea:{value:C.nightside?.02:-.55},uGhost:{value:0},uFade:{value:1},uTear:{value:0},uTearTime:{value:0},uGravityCenter:{value:new S},uGravityLocalCenter:{value:new S},uGravityRadius:{value:0},uGravityStrength:{value:0},uGravityTime:{value:0},uReverse:{value:1},uNight:{value:C.nightside?1:0},uSeed:{value:new S(Q(C.id.length,3)*40,Q(7,C.id.length)*40,Q(C.id.length,11)*40)}},vertexShader:Yt,fragmentShader:mi,transparent:!0}),X=new U;X.rotation.z=.35+Q(C.id.length,2)*.5,F.add(X);const q=new k(new j(C.radius,40,28),Y);X.add(q);const N={data:C,group:F,mat:Y,moons:[],hoverT:0},at=Q(3,C.id.length)>.82?-1:1;if(N.spinMesh=q,N.spinRate=at*(Math.PI*2)/(24+Q(C.id.length,5)*52),C.clouds){const H=new W({uniforms:{uTime:{value:0},uSunDir:{value:new S(1,0,0)},uSeed:{value:new S(3.7,8.1,1.9)},uCover:{value:.5},uFade:{value:1},uTear:{value:0},uTearTime:{value:0},uGravityCenter:{value:new S},uGravityLocalCenter:{value:new S},uGravityRadius:{value:0},uGravityStrength:{value:0},uGravityTime:{value:0},uReverse:{value:1}},vertexShader:Yt,fragmentShader:fi,transparent:!0,depthWrite:!1}),ot=new k(new j(C.radius*1.018,32,20),H);X.add(ot),N.cloudMat=H,N.cloudMesh=ot,N.cloudSpinRate=N.spinRate*(.86+Q(9,C.id.length)*.2)}const vt=new W({uniforms:{uColor:{value:R(v.atmo)},uStrength:{value:.85},uSunDir:{value:new S(1,0,0)},uTear:{value:0},uTearTime:{value:0},uGravityCenter:{value:new S},uGravityLocalCenter:{value:new S},uGravityRadius:{value:0},uGravityStrength:{value:0},uGravityTime:{value:0},uReverse:{value:1}},vertexShader:Yt,fragmentShader:pi,transparent:!0,depthWrite:!1,blending:A,side:Ge}),gt=new k(new j(C.radius*1.07,32,20),vt);if(gt.renderOrder=2,F.add(gt),N.atmo=gt,C.rings){const H=C.radius*1.45,ot=C.radius*2.5,wt=new W({uniforms:{uInner:{value:H},uOuter:{value:ot},uTint:{value:R(v.high)},uSunLocal:{value:new S(1,0,.4)},uGravityLocalCenter:{value:new S},uGravityStrength:{value:0},uGravityTime:{value:0},uReverse:{value:1}},vertexShader:Le,fragmentShader:vi,transparent:!0,depthWrite:!1,side:tt}),ct=new k(new At(H,ot,96,1),wt);ct.rotation.x=-Math.PI/2+.32,ct.renderOrder=3,F.add(ct),N.ringMat=wt,N.ringMesh=ct;const It=2+Math.floor(a()*2);for(let xt=0;xt<It;xt++){const _t=Q(xt+1,C.id.length+3),Gt=new k(this.moonGeo,this.moonMat);Gt.scale.setScalar(Math.max(.09,C.radius*(.1+.09*_t))),F.add(Gt),N.moons.push({mesh:Gt,a:C.radius*(1.75+.55*xt)+C.radius*1.5,speed:Math.PI*2/(14+xt*8),phase:_t*6.28})}}this.addInnerColliderAndOrbit(N,o,a),o.add(F),r.planets.push(N)}const w=a,E=this.makePoints(3200,(C,v)=>{const R=w()*Math.PI*2,F=P-8+w()*16+Math.pow(w(),3)*4,Y=(w()+w()+w()-1.5)/1.5;v[C*3]=Math.cos(R)*F,v[C*3+1]=Y*1.7,v[C*3+2]=Math.sin(R)*F},()=>.22+w()*.6,()=>{const C=.38+w()*.3,v=w()*.1;return[C+v,C*.86,C*.7]},()=>.25+w()*.55,1.15,!1);r.beltDustMat=E.material,r.belt.add(E);const D=["#8d8781","#726c65","#9c948b","#615c55","#7f766b","#91867a"],_=4,B=44;for(let C=0;C<_;C++){const v=this.makeRockGeometry(C*17.31+3.7),R=new W({vertexShader:wi,fragmentShader:xi,uniforms:{uColor:{value:new z(D[C%D.length])}}}),F=new Je(v,R,B);F.instanceMatrix.setUsage(ce);const Y=[],X=new Re;for(let q=0;q<B;q++){const N=w()*Math.PI*2,at=P-8+w()*16,vt=(w()+w()+w()-1.5)/1.5*1.9,gt=.22+Math.pow(w(),2.4)*1.45,H=new Ht().setFromEuler(new ti(w()*Math.PI*2,w()*Math.PI*2,w()*Math.PI*2)),ot=new S(Math.cos(N)*at,vt,Math.sin(N)*at);X.compose(ot,H,new S(gt,gt,gt)),F.setMatrixAt(q,X),Y.push({pos:ot,q:H,scale:new S(gt,gt,gt),axis:new S(w()-.5,w()-.5,w()-.5).normalize(),speed:.12+w()*.55})}r.belt.add(F),r.beltInst.push({mesh:F,tumbles:Y})}return{root:o,sys:r}}addInnerColliderAndOrbit(t,e,a){const i=t.data,o=new k(new j(Math.max(i.radius*1.5,2.6),10,10),new O({visible:!1}));o.userData={isInner:!0,bodyId:`inner:${i.id}`},t.group.add(o),this.innerColliderList.push(o);const s=[],r=de(i).eccentricity,f=i.orbit.speed||.01,n=256,c=Math.PI*2/f;for(let g=0;g<=n;g++){const x=g/n*c,u=me(i.orbit.a,r,i.orbit.phase,i.orbit.incl,x,f);s.push(u.x,u.y,u.z)}const m=new yt;m.setAttribute("position",new Ct(s,3));const y=new Ee(m,new Vt({color:9150916,transparent:!0,opacity:0,depthWrite:!1}));y.visible=!1,e.add(y),t.orbitLine=y}updateInnerSystem(t,e,a){const i=t.innerSys;if(!i)return;i.starUniforms.uTime.value=this.clockT,i.starMesh.rotation.y+=e*.15,i.coronaMat.uniforms.uTime.value=this.clockT,i.coronaMat.uniforms.uBoost.value=.92+.08*Math.sin(this.clockT*.8),t.inner.getWorldQuaternion(this._qScratch2).invert(),i.corona.quaternion.copy(this._qScratch2).multiply(this.camera.quaternion),i.haloA.rotation.y+=e*.05,i.haloB.rotation.y-=e*.038;const o=Math.max(1,a)/90;for(const s of[i.haloA,i.haloB]){const l=s.material;l.uniforms.uTime.value=this.clockT,l.uniforms.uOpacity.value=1,l.uniforms.uScale.value=o}t.group.getWorldPosition(this._vScratch3),t.inner.getWorldQuaternion(this._qScratch).invert();for(const s of i.planets){const l=s.data.orbit,r=de(s.data,this.simDays),f=me(l.a,r.eccentricity,l.phase,l.incl,this.simDays,l.speed||.01);s.group.position.set(f.x,f.y,f.z);const n=this.hoveredId===`inner:${s.data.id}`?1:0;s.hoverT+=(n-s.hoverT)*Math.min(1,e*8),s.group.scale.setScalar(1+s.hoverT*.045),s.group.getWorldPosition(this._vScratch2),this._vScratch1.copy(this._vScratch2).sub(this._vScratch3).normalize().multiplyScalar(-1),this._vDirScratch.copy(this._vScratch1).applyQuaternion(this._qScratch);const c=this.portalTargetInnerId===s.data.id?this.portalVisualT:0;if(s.blackHole){s.group.getWorldQuaternion(this._qScratch2).invert().multiply(this.camera.quaternion),s.blackHole.update(this.clockT,this._qScratch2,c);const m=s.group.userData.spin;if(m){m.r1.rotation.z+=e*.3,m.r2.rotation.x+=e*.22;const y=1+Math.sin(this.clockT*2.2)*.018;m.r1.scale.setScalar(y),m.r2.scale.setScalar(y)}}if(s.mat&&(s.mat.uniforms.uSunDir&&s.mat.uniforms.uSunDir.value.copy(this._vDirScratch),s.mat.uniforms.uTime.value=this.clockT,s.mat.uniforms.uTear&&(s.mat.uniforms.uTear.value=c),s.mat.uniforms.uTearTime&&(s.mat.uniforms.uTearTime.value=this.clockT),this.applyPortalGravityUniforms(s.mat),this.setPortalLocalCenter(s.mat,s.spinMesh),s.mat.uniforms.uCamLocalP&&(this._vScratch1.copy(this.camera.position),s.group.worldToLocal(this._vScratch1),s.mat.uniforms.uCamLocalP.value.copy(this._vScratch1))),s.spinMesh&&s.spinRate&&(s.spinMesh.rotation.y+=e*s.spinRate),s.cloudMat&&(s.cloudMat.uniforms.uTime.value=this.clockT,s.cloudMat.uniforms.uTear&&(s.cloudMat.uniforms.uTear.value=c),s.cloudMat.uniforms.uTearTime&&(s.cloudMat.uniforms.uTearTime.value=this.clockT),s.cloudMat.uniforms.uSunDir.value.copy(this._vDirScratch),this.applyPortalGravityUniforms(s.cloudMat),this.setPortalLocalCenter(s.cloudMat,s.cloudMesh)),s.cloudMesh&&s.cloudSpinRate&&(s.cloudMesh.rotation.y+=e*s.cloudSpinRate),s.atmo){const m=s.atmo.material;m.uniforms.uSunDir.value.copy(this._vDirScratch),m.uniforms.uTear&&(m.uniforms.uTear.value=c),m.uniforms.uTearTime&&(m.uniforms.uTearTime.value=this.clockT),this.applyPortalGravityUniforms(m),this.setPortalLocalCenter(m,s.atmo)}if(s.ringMat&&(s.ringMesh.getWorldQuaternion(this._qScratch2).invert(),s.ringMat.uniforms.uSunLocal.value.copy(this._vScratch1).applyQuaternion(this._qScratch2),this.applyPortalGravityUniforms(s.ringMat),this.setPortalLocalCenter(s.ringMat,s.ringMesh)),s.moons.forEach(m=>{const y=m.phase+this.simDays*m.speed;m.mesh.position.set(Math.cos(y)*m.a,Math.sin(y*.7)*m.a*.12,Math.sin(y)*m.a)}),s.orbitLine){const m=s.hoverT*.22;s.orbitLine.material.opacity=m,s.orbitLine.visible=m>.01}if(s.streakRing){const m=s.streakRing.material,y=s.streakTarget??0,g=s.streakDays??0,x=g>0?Math.min(.95,.22+.16*y+.02*g):0;m.opacity+=(x-m.opacity)*Math.min(1,e*3.5);const u=1+.022*Math.sin(this.clockT*1.8+s.data.id.length);s.streakRing.scale.setScalar(u),s.streakRing.visible=m.opacity>.02}}i.belt.rotation.y=this.simDays*.0016,i.beltInst.forEach(({mesh:s,tumbles:l})=>{for(let r=0;r<l.length;r++){const f=l[r];f.q.multiply(this._rockQ.setFromAxisAngle(f.axis,f.speed*e)),this._rockM.compose(f.pos,f.q,f.scale),s.setMatrixAt(r,this._rockM)}s.instanceMatrix.needsUpdate=!0}),i.beltDustMat.uniforms.uScale.value=Math.max(1,a)/90,i.beltDustMat.uniforms.uOpacity.value=1-ae(500,1400,a)}buildClusterStage(){const t=Math.random;for(;this.gCluster.children.length>0;)this.gCluster.remove(this.gCluster.children[0]);this.clusterGasMats=[];const e=1e3,a=10,i=[[0,0,0,15e3],[26e3,-7e3,13e3,17e3],[-24e3,9e3,-15e3,15e3],[9e3,14e3,-29e3,13e3]],o=new Float32Array(e),s=new Float32Array(e),l=new Float32Array(e),r=new Float32Array(e),f=new Float32Array(e),n=new Float32Array(e),c=new Float32Array(e),m=new Uint8Array(e);for(let h=0;h<e;h++){const d=i[Math.min(i.length-1,Math.floor(Math.pow(t(),1.55)*i.length))];o[h]=d[0]+(t()+t()-1)*d[3],s[h]=d[1]+(t()+t()-1)*d[3]*.7,l[h]=d[2]+(t()+t()-1)*d[3];const p=90+Math.pow(t(),1.6)*260;r[h]=p,f[h]=p*(.35+t()*.4),n[h]=t()*Math.PI,c[h]=(t()-.5)*1;const M=t();m[h]=M>.94?2:M>.6?1:0}const y=this.makePoints(e*a,(h,d)=>{const p=Math.floor(h/a),P=h%a/a*Math.PI*2+Q(p,7)*6.2831,w=.72+Q(p,13)*.55,E=Math.cos(P)*r[p]*w,D=Math.sin(P)*f[p]*w,_=Math.cos(n[p]),B=Math.sin(n[p]),C=-Math.sin(n[p])*Math.sin(c[p]),v=Math.cos(c[p]),R=Math.cos(n[p])*Math.sin(c[p]);d[h*3]=o[p]+E*_+D*C,d[h*3+1]=s[p]+D*v,d[h*3+2]=l[p]+E*B+D*R},h=>{const d=Math.floor(h/a);return m[d]===2?1.4+t()*1.6:.6+t()*1.1},h=>{const d=Math.floor(h/a);return m[d]===2?[1,1,1]:m[d]===1?[.72,.82,1]:[1,.88,.72]},()=>.3+t()*.5,1.6,!1);this.gCluster.add(y);const g=this.makePoints(600,(h,d)=>{const p=26e3+t()*52e3,M=t()*Math.PI*2,P=Math.acos(2*t()-1);d[h*3]=p*Math.sin(P)*Math.cos(M),d[h*3+1]=p*Math.cos(P)*.6,d[h*3+2]=p*Math.sin(P)*Math.sin(M)},()=>.4+t()*.8,()=>[.85,.9,1],()=>.2+t()*.4,1.2,!1);this.gCluster.add(g);const x=nt(256,[[0,"rgba(255,255,255,0.9)"],[.35,"rgba(255,255,255,0.28)"],[1,"rgba(0,0,0,0)"]]);[[0,0,0,72e3,"#ff5e8a",.1],[2e4,-5e3,8e3,46e3,"#b46bff",.085],[-17e3,7e3,-13e3,4e4,"#ff8ab0",.075],[0,0,0,15e3,"#ffe1ee",.32]].forEach(([h,d,p,M,P,w])=>{const E=new it({map:x,color:new z(P),transparent:!0,opacity:w,blending:A,depthWrite:!1});E.userData.baseColor=new z(P);const D=new J(E);D.position.set(h,d,p),D.scale.setScalar(M),this.gCluster.add(D),this.clusterGasMats.push(E)});for(let h=0;h<12;h++){const d=5200+t()*15e3,p=h<2?1.5+t()*.5:.5+t()*1.1,M=48,P=[];for(let _=0;_<=M;_++){const B=_/M*p;P.push(Math.cos(B)*d,Math.sin(B)*d*.24,0)}const w=new yt;w.setAttribute("position",new Ct(P,3));const E=new Vt({color:new z("#9fdcff"),transparent:!0,opacity:h<2?.42:.16+t()*.1,blending:A,depthWrite:!1}),D=new _e(w,E);D.position.set((t()-.5)*8e3,(t()-.5)*5e3,(t()-.5)*8e3),D.rotation.set(t()*Math.PI,t()*Math.PI,t()*Math.PI),this.gCluster.add(D)}}buildKamuiTunnel(){const t=(i,o,s)=>{const l=new W({uniforms:{uTime:{value:0},uSpin:{value:0},uOpacity:{value:0},uPhase:{value:s},uColorA:{value:new z("#38bdf8")},uColorB:{value:new z("#8b5cf6")}},vertexShader:`
          varying vec2 vUv; varying float vW;
          uniform float uTime;
          void main(){
            vUv = uv;
            vec3 p = position;
            /* unstable — the wall radius breathes and shakes */
            float w = sin(uv.x * 18.849 + uTime * 7.0) * 0.5 + sin(uv.y * 40.0 - uTime * 11.0) * 0.5;
            p.xy *= 1.0 + w * 0.09;
            vW = w;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }`,fragmentShader:`
          varying vec2 vUv; varying float vW;
          uniform float uTime; uniform float uSpin; uniform float uOpacity; uniform float uPhase;
          uniform vec3 uColorA; uniform vec3 uColorB;
          void main(){
            /* high-torque swirling bands streaming down the tunnel */
            float bands = 0.5 + 0.5 * sin((vUv.x * 16.0 + uSpin * 1.4 + uPhase + vW * 1.6) * 6.2831);
            float flow  = 0.5 + 0.5 * sin((vUv.y * 36.0 - uTime * 16.0 + vUv.x * 10.0) * 6.2831);
            vec3 col = mix(uColorA, uColorB, 0.35 + 0.4 * bands);
            col += vec3(1.0, 0.97, 0.9) * pow(bands, 3.0) * 0.9;
            float ends = smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.78, vUv.y);
            float a = (0.30 + bands * 0.38 + flow * 0.16) * uOpacity * ends;
            gl_FragColor = vec4(col * (0.75 + flow * 0.7), a);
          }`,transparent:!0,depthWrite:!1,side:Fe,blending:A}),r=new k(new oi(i,i,o,64,20,!0),l);return r.rotation.x=Math.PI/2,r};this.kamuiTunnel=new U;const e=t(3e5,32e5,0),a=t(252e3,32e5,.5);this.kamuiTunnelMats.push(e.material,a.material),this.kamuiTunnel.add(e,a),this.kamuiTunnel.visible=!1,this.camera.add(this.kamuiTunnel)}buildGalaxyTear(){this.galaxyTearMat=new W({uniforms:{uTime:{value:0},uProgress:{value:0},uIntensity:{value:0},uColorA:{value:new z("#38bdf8")},uColorB:{value:new z("#8b5cf6")}},vertexShader:`
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,fragmentShader:`
        varying vec2 vUv;
        uniform float uTime; uniform float uProgress; uniform float uIntensity;
        uniform vec3 uColorA; uniform vec3 uColorB;
        void main(){
          vec2 q = vUv * 2.0 - 1.0;
          float r = length(q);
          float a = atan(q.y, q.x);
          float p = clamp(uProgress, 0.0, 1.0);
          float spin = uTime * (4.5 + 13.0 * p);
          /* The source tears open first; the destination white hole takes over
             after the camera has crossed the darkest part of the fold. */
          float whiteHole = smoothstep(0.57, 0.78, p);
          float source = 1.0 - whiteHole;
          float turbulence = sin(a * 8.0 - spin * 1.7 + r * 26.0)
            + 0.55 * sin(a * 15.0 + spin * 0.9 - r * 43.0)
            + 0.22 * sin(a * 23.0 + spin * 2.7 + r * 71.0);

          /* A ragged event horizon and a flattened, frame-dragged accretion
             disc make this a gravitational surface rupture rather than a flat
             circular portal. */
          float horizonR = mix(0.12, 0.65, p) + turbulence * 0.022 * (0.35 + p * 0.65);
          float horizonRim = exp(-abs(r - horizonR) * (78.0 + p * 48.0));
          float diskR = 0.13 + p * 0.24 + sin(a * 3.0 - spin * 0.45) * 0.018;
          float disk = exp(-abs(r - diskR) * 52.0) * (0.45 + 0.55 * sin(a * 5.0 - spin + r * 15.0));
          disk = max(disk, 0.0);
          float lensRingA = exp(-abs(r - (0.17 + p * 0.23)) * 48.0);
          float lensRingB = exp(-abs(r - (0.30 + p * 0.27)) * 82.0);

          /* Tidal streams stretch along the rotating gravitational field. */
          float stream = pow(max(0.0, sin(a * 7.0 - spin * 1.8 + r * 21.0)), 8.0);
          stream *= smoothstep(0.06, 0.72, r) * (1.0 - smoothstep(0.48, 0.98, r));
          float tearStrands = pow(max(0.0, sin(a * 13.0 + r * 31.0 - spin * 2.4)), 12.0);
          tearStrands *= smoothstep(0.10, 0.66, r) * (1.0 - smoothstep(0.52, 0.96, r));

          vec3 sourceCol = mix(uColorA, uColorB, 0.5 + 0.5 * sin(a * 2.0 + spin * 0.2));
          sourceCol += vec3(0.76, 0.93, 1.0) * (horizonRim * 1.45 + lensRingA * 0.62);
          sourceCol += vec3(1.0, 0.68, 0.28) * (disk * 1.25 + tearStrands * 0.9);
          sourceCol += vec3(0.5, 0.8, 1.0) * (stream * 0.72 + lensRingB * 0.38);

          /* The exit is a white-hole burst: a hot photon ring, radial jets,
             and matter being expelled instead of consumed. */
          float exitR = mix(0.06, 0.48, whiteHole) + turbulence * 0.014;
          float exitRim = exp(-abs(r - exitR) * 92.0);
          float exitCore = exp(-r * (10.0 + whiteHole * 16.0)) * whiteHole;
          float jet = pow(max(0.0, cos(a * 2.0 + spin * 0.65)), 18.0);
          jet *= smoothstep(0.04, 0.62, r) * (1.0 - smoothstep(0.48, 0.92, r));
          vec3 exitCol = vec3(1.0, 0.96, 0.82) * (exitCore * 2.3 + exitRim * 1.55);
          exitCol += mix(vec3(0.28, 0.82, 1.0), vec3(1.0, 0.55, 0.18), 0.5 + 0.5 * sin(a + spin * 0.35)) * jet * 1.4;
          exitCol += vec3(0.75, 0.9, 1.0) * (lensRingA * 0.5 + lensRingB * 0.35) * whiteHole;

          vec3 col = sourceCol * source + exitCol * whiteHole;
          float alpha = (horizonRim * 1.55 + disk * 0.8 + stream * 0.78 + tearStrands * 0.7
            + lensRingA * 0.5 + lensRingB * 0.32) * source;
          alpha += (exitRim * 1.65 + exitCore * 1.5 + jet * 0.9) * whiteHole;
          alpha *= uIntensity * smoothstep(0.0, 0.10, p) * (1.0 - smoothstep(0.50, 1.02, r));
          if (alpha < 0.002) discard;
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
        }`,transparent:!0,depthWrite:!1,depthTest:!1,side:tt,blending:A});const t=new k(new he(2,2),this.galaxyTearMat);t.renderOrder=30,this.galaxyTearGroup.add(t),this.galaxyTearGroup.visible=!1,this.galaxyTearGroup.frustumCulled=!1,this.scene.add(this.galaxyTearGroup)}buildIntroMarble(){const t=new U,e=new k(new j(14,48,32),new W({uniforms:{uFade:{value:1},uTime:{value:0},uColorA:{value:new z("#38bdf8")},uColorB:{value:new z("#8b5cf6")}},vertexShader:`
          varying vec3 vN; varying vec3 vV;
          void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,fragmentShader:`
          uniform float uFade; uniform float uTime; uniform vec3 uColorA; uniform vec3 uColorB;
          varying vec3 vN; varying vec3 vV;
          void main(){
            vec3 N = normalize(vN); vec3 V = normalize(vV);
            float fr = pow(1.0 - abs(dot(N, V)), 1.9);
            float shimmer = 0.5 + 0.5 * sin(N.y * 5.0 + uTime * 0.8);
            vec3 rim = mix(uColorA, uColorB, 0.35 + 0.3 * shimmer);
            gl_FragColor = vec4(rim * fr * 2.6, min(1.0, fr * 1.5 + 0.05) * uFade);
          }`,transparent:!0,depthWrite:!1,blending:A}));t.add(e),this.introMarbleMats.push(e.material);const a=240,i=new Float32Array(a*3),o=new Float32Array(a),s=new Float32Array(a*3),l=Math.random;for(let y=0;y<a;y++){const g=y%3,x=Math.pow(l(),.6)*9.5,u=g/3*Math.PI*2+x*.09+(l()-.5)*.5;i[y*3]=Math.cos(u)*x+(l()-.5)*1.6,i[y*3+1]=(l()-.5)*1.8,i[y*3+2]=Math.sin(u)*x+(l()-.5)*1.6,o[y]=.5+l()*.7;const h=l(),d=h>.82?[1,1,1]:h>.45?[.55,.78,1]:[.66,.5,1];s[y*3]=d[0],s[y*3+1]=d[1],s[y*3+2]=d[2]}const r=new yt;r.setAttribute("position",new Rt(i,3)),r.setAttribute("aSize",new Rt(o,1)),r.setAttribute("aColor",new Rt(s,3));const f=new W({uniforms:{uFade:{value:1},uTime:{value:0},uOpacity:{value:1}},vertexShader:`
        attribute float aSize; attribute vec3 aColor;
        uniform float uTime; varying vec3 vC; varying float vA;
        void main(){
          vC = aColor;
          vA = 0.55 + 0.45 * sin(uTime * 2.0 + position.x * 5.0);
          vec3 p = position;
          float a = uTime * 0.12;
          p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz; /* the coil slowly turns */
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = clamp(300.0 / max(-mv.z, 0.001), 1.5, 6.0);
          gl_Position = projectionMatrix * mv;
        }`,fragmentShader:`
        uniform float uFade; uniform float uOpacity; varying vec3 vC; varying float vA;
        void main(){
          vec2 c = gl_PointCoord - 0.5; float d = length(c);
          if (d > 0.49) discard;
          gl_FragColor = vec4(vC, (exp(-d * d * 28.0) * 0.9 + 0.08) * vA * uFade * uOpacity);
        }`,transparent:!0,depthWrite:!1,blending:A});t.add(new Zt(r,f)),this.introMarbleMats.push(f);const n=nt(128,[[0,"rgba(255,255,255,1)"],[.3,"rgba(255,255,255,0.45)"],[1,"rgba(255,255,255,0)"]]),c=new J(new it({map:n,color:new z("#bfe3ff"),blending:A,depthWrite:!1,transparent:!0,opacity:.9}));if(c.scale.setScalar(11),t.add(c),this.introMarbleSprites.push(c.material),!this.marbleRingTex){const y=document.createElement("canvas");y.width=y.height=256;const g=y.getContext("2d");g.strokeStyle="rgba(255,255,255,0.95)",g.lineWidth=10,g.shadowColor="rgba(255,255,255,0.8)",g.shadowBlur=14,g.beginPath(),g.arc(128,128,108,0,Math.PI*2),g.stroke(),this.marbleRingTex=new Ft(y)}const m=new J(new it({map:this.marbleRingTex,color:new z("#8ab6ff"),blending:A,depthWrite:!1,transparent:!0,opacity:.5}));m.scale.setScalar(34),t.add(m),this.introMarbleSprites.push(m.material),t.visible=!1,this.introMarble=t,this.scene.add(t)}buildSurface(){const t=new he(90,90,140,140);t.rotateX(-Math.PI/2);const e=t.attributes.position;for(let l=0;l<e.count;l++){const r=e.getX(l),f=e.getZ(l),n=be(r*.055+3.1,f*.055+7.7)*2.4+be(r*.19,f*.19)*.55,c=(r*r+f*f)/2.05;e.setY(l,1+n*.32-c*.011)}t.computeVertexNormals(),this.surfaceMat=new W({uniforms:{uDeep:{value:new z("#0b2d4d")},uBase:{value:new z("#1f6e52")},uHigh:{value:new z("#9db88a")},uIce:{value:new z("#eef6ff")},uSunDir:{value:new S(1,.2,0)},uFog:{value:new z("#7fc4e8")},uFogDensity:{value:.02}},vertexShader:ga,fragmentShader:va});const a=new k(t,this.surfaceMat);this.surface.add(a),this.skyMat=new W({uniforms:{uZenith:{value:new z("#0a1e38")},uHorizon:{value:new z("#7fc4e8")},uSunDir:{value:new S(1,.2,0)}},vertexShader:"varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW,1.0); }",fragmentShader:Ma,side:Fe,depthWrite:!1});const i=new k(new j(120,32,20),this.skyMat);this.surface.add(i);const o=Math.random,s=this.makePoints(320,(l,r)=>{r[l*3]=(o()-.5)*60,r[l*3+1]=1+o()*7,r[l*3+2]=(o()-.5)*60},()=>.35+o()*.6,()=>[.85,.92,1],()=>.25+o()*.4,1.1,!0);this.surfaceParticlesMat=s.material,this.surface.add(s),this.surface.visible=!1,this.scene.add(this.surface)}bindEvents(){this.canvas.style.touchAction="none",this.canvas.addEventListener("pointerdown",this.onPointerDown),this.canvas.addEventListener("pointermove",this.onPointerMove),this.canvas.addEventListener("pointerup",this.onPointerUp),this.canvas.addEventListener("pointercancel",this.onPointerCancel),this.canvas.addEventListener("dblclick",this.onDoubleClick),this.canvas.addEventListener("contextmenu",this.onContextMenu)}finishPointerDrag(t,e){if(!this.dragging)return;this.dragging=!1,this.rig.endDrag();try{this.canvas.releasePointerCapture(t.pointerId)}catch{}const a=Math.hypot(t.clientX-this.downX,t.clientY-this.downY);e&&a<7&&performance.now()-this.downT<600&&t.button===0&&this.handleClick()}pick(){this.raycaster.setFromCamera(this.pointer,this.camera);const t=this.currentDist();if(this.cosmicStage==="multiverse"&&this.gMultiverse&&this.gMultiverse.visible){this.raycaster.far=5e6;const e=this.multiverseColliders,a=this.raycaster.intersectObjects(e,!1);if(a.length>0){const i=a[0].object.userData;if(i.isMultiverseCore||i.id==="multiverse-core")return"multiverse-core";if(i.isGalaxy&&i.galaxyData)return`galaxy:${i.galaxyData.id}:${i.realityId}`;if(i.isGalaxyCluster&&i.clusterData)return`cluster:${i.clusterData.id}:${i.realityId}`;if(i.isRealityBubble&&i.realityId)return`reality:${i.realityId}`}return null}if(t<=1400){this.raycaster.far=t*3+120;const e=this.innerColliderList.length>0?this.colliderList.concat(this.innerColliderList):this.colliderList,a=this.raycaster.intersectObjects(e,!1);for(const i of a){let o=!0;for(let r=i.object;r;r=r.parent)if(!r.visible){o=!1;break}if(!o)continue;const s=i.object.userData.bodyId;if(i.object.userData.isInner)return s;const l=this.bodies.find(r=>r.data.id===s);if(!(l&&l.ghost>.6))return s}return null}if(this.cosmicStage==="web"&&t>1400&&t<12e4&&this.galaxyStageColliders.length){this.raycaster.far=t*4+6e3;const e=this.raycaster.intersectObjects(this.galaxyStageColliders,!1);if(e.length>0){const a=e[0].object.userData;if(a.isGalaxy&&a.galaxyData)return`galaxy:${a.galaxyData.id}:${a.realityId}`}}return null}handleClick(){var a;const t=this.pick();if(t==="multiverse-core"){this.cb.onSelectCore?this.cb.onSelectCore():this.cb.onActivate("multiverse-core");return}if(t&&t.startsWith("cluster:")){const i=t.split(":"),o=i[1],s=i[2],l=ni.find(f=>f.id===s),r=(a=l==null?void 0:l.clusters)==null?void 0:a.find(f=>f.id===o);r&&this.cb.onSelectCluster&&this.cb.onSelectCluster(r);return}if(t&&t.startsWith("galaxy:")){const i=t.split(":"),o=i[1],s=i.slice(2).join(":");this.cb.onSelectGalaxy&&this.cb.onSelectGalaxy(o,s);return}if(t&&t.startsWith("reality:")){const i=t.replace("reality:",""),o=performance.now();if(o-this.lastClickT<360&&t===this.lastClickId){this.clickTimer&&(clearTimeout(this.clickTimer),this.clickTimer=null),this.lastClickT=0,this.cb.onDoubleClickReality&&this.cb.onDoubleClickReality(i);return}this.lastClickT=o,this.lastClickId=t,this.clickTimer&&clearTimeout(this.clickTimer),this.clickTimer=setTimeout(()=>{this.cb.onSelectReality&&this.cb.onSelectReality(i),this.clickTimer=null},350);return}if(t&&t.startsWith("inner:")){const i=performance.now();if(i-this.lastClickT<330&&t===this.lastClickId){this.clickTimer&&(clearTimeout(this.clickTimer),this.clickTimer=null),this.lastClickT=0,this.activateInner(t);return}this.lastClickT=i,this.lastClickId=t,this.clickTimer&&clearTimeout(this.clickTimer),this.clickTimer=setTimeout(()=>{this.selectInnerWorld(t),this.clickTimer=null},340);return}const e=performance.now();if(e-this.lastClickT<330&&t===this.lastClickId){this.clickTimer&&(clearTimeout(this.clickTimer),this.clickTimer=null),this.lastClickT=0,this.activate(t);return}this.lastClickT=e,this.lastClickId=t,this.clickTimer&&clearTimeout(this.clickTimer),this.clickTimer=setTimeout(()=>{t===null&&this.cosmicStage==="web"&&(this.innerFocusBodyId?this.releaseInnerWorld():this.galaxyInnerFocus?(this.galaxyInnerFocus=!1,this.rig.setZoomTarget(.668),this.prevDialTarget=.668):(this.focusId=null,this.galaxyFocusId=null)),this.selectedId=t,this.cb.onSelect(t),this.clickTimer=null},340)}activate(t){if(!t){this.cosmicStage==="web"&&(this.innerFocusBodyId?this.releaseInnerWorld():this.galaxyInnerFocus?(this.galaxyInnerFocus=!1,this.rig.setZoomTarget(.668),this.prevDialTarget=.668):(this.focusId=null,this.galaxyFocusId=null)),this.cb.onSelect(null);return}if(t==="demon-core"){this.cb.onSelectDemonCore?this.cb.onSelectDemonCore():this.cb.onActivate("demon-core");return}const e=this.bodies.find(a=>a.data.id===t);if(t==="anchor"){this.selectedId=t,this.cb.onActivate("anchor");return}e&&(this.selectedId=t,this.beginPortal(e))}currentDist(){return this.rig.dist()}focusBody(){return this.focusId?this.bodies.find(t=>t.data.id===this.focusId)??null:null}resetView(){this.cancelGalaxyEntryFlight(),this.focusId=null,this.realityFocused=!1,this.activeGalaxyName=null,this.galaxyFocusId=null,this.innerFocusBodyId=null,this.cosmicStage==="multiverse"?this.beginKamui("toWeb",.15):(this.rig.setZoomTarget(.15),this.rig.setOrbit(null,1.12),this.rig.clearPan()),this.prevDialTarget=.15}zoomToMultiverse(){this.cancelGalaxyEntryFlight(),this.focusId=null,this.realityFocused=!1,this.activeGalaxyName=null,this.galaxyFocusId=null,this.cosmicStage==="web"?this.beginKamui("toMultiverse"):(this.realityFocused=!0,this.rig.setOrbit(null,1.05),this.rig.setZoomTarget(this.activeReality?kt.zoomTOf(this.activeReality.bubbleSize*5.5):.787))}zoomToSystem(){this.cancelGalaxyEntryFlight(),this.focusId=null,this.realityFocused=!1,this.activeGalaxyName=null,this.galaxyFocusId=null,this.cosmicStage==="multiverse"?this.beginKamui("toWeb",.15):(this.rig.setZoomTarget(.15),this.rig.setOrbit(null,1.12),this.rig.clearPan()),this.prevDialTarget=.15}zoomToHierarchy(t){if(this.cancelGalaxyEntryFlight(),this.focusId=null,this.rig.clearPan(),(t<=2||t>6)&&(this.activeGalaxyName=null,this.galaxyFocusId=null),t===0){this.zoomToMultiverse();return}if(t===1){this.cosmicStage==="multiverse"?(this.realityFocused=!1,this.rig.setZoomTarget(.88),this.rig.setOrbit(null,1.05)):this.beginKamui("toMultiverse",.88);return}const e=[0,.88,.858,.842,.773,.722,.668,.589,.503,.411,.15][t]??.15,a=t===6?1.08:t<=8?1.1:1.12,i=this.cosmicStage==="web"&&this.galaxyWarp===null&&this.kamuiFlight===null&&this.portal.phase==="idle"&&!this.bootIntro;if(!(this.galaxyInnerFocus&&t>=7)){if(i&&t===6){if(this.rig.tZoomT>=.7){this.beginGalaxyWarp("arrive",e,null),this.prevDialTarget=e;return}if(this.rig.tZoomT<=.585){this.beginGalaxyWarp("ascend",e,this.galaxyFocusId,!1),this.prevDialTarget=e;return}}if(i&&t>=7&&this.rig.tZoomT>=.6&&this.rig.tZoomT<=.7){this.beginGalaxyWarp("descend",e,null),this.prevDialTarget=e;return}this.cosmicStage==="multiverse"?this.beginKamui("toWeb",e):(this.realityFocused=!1,this.rig.setZoomTarget(e),this.rig.setOrbit(null,a)),this.prevDialTarget=e}}beginKamui(t,e=null){this.kamuiFlight!==null||this.galaxyEntryFlight!==null||(this.warpDir=t,this.postWarpZoom=e,this.kamuiFlight=0,this.kamuiFromZoom=this.rig.zoomT,this.grabCooldown=1.2,t==="toMultiverse"&&(this.realityFocused=!1,this.arrivalZoom=this.activeReality?kt.zoomTOf(this.activeReality.bubbleSize*5.5):.787))}zoomIn(t=.12){this.rig.nudgeZoom(-t)}zoomOut(t=.12){this.rig.nudgeZoom(t)}focusOn(t){if(t==="anchor"){this.resetView();return}if(this.focusId=t,this.realityFocused=!1,this.cosmicStage==="multiverse"){this.beginKamui("toWeb",.16);return}this.rig.clearPan(),this.rig.setZoomTarget(Math.min(this.rig.tZoomT,.16)),this.prevDialTarget=this.rig.tZoomT}enterCoreMode(){this.coreActive=!0,this.focusId=null,this.realityFocused=!1,this.cosmicStage==="multiverse"?this.beginKamui("toWeb",.24):this.rig.setZoomTarget(.24),this.prevDialTarget=.24}exitCoreMode(){this.coreActive=!1}setPaused(t){this.paused=t}get pausedNow(){return this.paused}setRendering(t){this.rendering=t}setTemporal(t){this.bodies.forEach(e=>{const a=t!==null&&e.data.createdAt>t;e.ghostTarget=a?1:0,e.fadeTarget=a?0:1})}clearPortalSingularity(){if(!this.portalSingularity)return;const{parent:t,visual:e}=this.portalSingularity;t.remove(e.group),e.dispose(),this.portalSingularity=null}preparePortalSingularity(t){var o;if(this.clearPortalSingularity(),t.kind==="vault")return;let e=null;const a=this.bodies.find(s=>s.data.id===t.id);if(a&&(e=a.group),!e)for(const s of this.galaxyStageNodes){const l=(o=s.innerSys)==null?void 0:o.planets.find(r=>r.data.id===t.id);if(l){e=l.group;break}}if(!e)return;const i=Ve(Math.max(.2,t.radius*.14));e.add(i.group),this.portalSingularity={parent:e,visual:i}}updatePortalSingularity(){if(!this.portalSingularity)return;if(this.portal.phase==="idle"){this.clearPortalSingularity();return}const{parent:t,visual:e}=this.portalSingularity;t.getWorldQuaternion(this._qScratch2).invert().multiply(this.camera.quaternion),e.update(this.clockT,this._qScratch2,this.portalVisualT)}beginPortal(t){var a;if(this.portal.phase!=="idle")return;const e=this.findInnerBody(t.data.id);if(this.portalTargetInnerId=e?t.data.id:null,e&&(this.galaxyFocusId=e.galaxyId,this.galaxyInnerFocus=!0,this.innerFocusBodyId=e.data.id),this.focusId=this.portalTargetInnerId?null:t.data.id,this.realityFocused=!1,this.cosmicStage="web",this.portalReturn=!1,this.portalWasInner=!!e,e){const i=this.galaxyStageNodes.flatMap(o=>{var s;return((s=o.innerSys)==null?void 0:s.planets)??[]}).find(o=>o.data.id===t.data.id);i==null||i.group.getWorldPosition(this.portalLocalCenter)}else(a=this.bodies.find(i=>i.data.id===t.data.id))==null||a.group.getWorldPosition(this.portalLocalCenter);this.portalProfile=t.data.kind==="vault"?"vault":"normal",this.portalBodyRadius=Math.max(.1,t.data.radius),this.portal={phase:"arming",t:0,fired:!1,kind:t.data.kind==="vault"?"vault":"diary",bodyId:t.data.id},this.portalReverse=1,this.portalEject=0,this.portalCloseLevel=0,this.portalPointSets.length=0,this.scene.traverse(i=>{var o;if(i.isPoints){const s=i.material;(o=s==null?void 0:s.uniforms)!=null&&o.uVortexC&&s.uniforms.uVortexS&&!this.portalPointSets.some(l=>l.mat===s)&&this.portalPointSets.push({points:i,mat:s})}}),t.data.kind==="vault"&&this.preparePortalSingularity(t.data)}leavePortal(){this.portalCloseLevel=this.portal.phase==="idle"?0:this.portalVisualT,this.portalReverse=-1,this.portalEject=0,this.portalReturn=!0,this.portal.phase="out",this.portal.t=1,this.portal.fired=!1;const t=this.findInnerBody(this.portal.bodyId);if(t&&(this.portalTargetInnerId=this.portal.bodyId),!this.portalSingularity){const e=t??this.bodies.find(a=>a.data.id===this.portal.bodyId);e&&this.preparePortalSingularity(e.data)}}finishEntry(){this.portalReturn=!1,this.portal.phase="out",this.portal.t=Math.max(this.portal.t,.62)}portalTo(t){const e=this.bodies.find(a=>a.data.id===t);e&&(this.selectedId=t,this.beginPortal(e))}static dayKey(t){return Math.floor(t/864e5)}static streakOf(t){if(!t.length)return 0;const e=new Set(t.map(o=>zt.dayKey(Math.max(o.createdAt,o.updatedAt))));let a=zt.dayKey(Date.now());if(e.has(a)||(a-=1),!e.has(a))return 0;let i=0;for(;e.has(a);)i+=1,a-=1;return i}static daysOf(t){return new Set(t.map(e=>zt.dayKey(Math.max(e.createdAt,e.updatedAt)))).size}syncMoons(t){this.lastEntries=t,this.moonGeo||(this.moonGeo=new j(1,22,14)),this.moonMat||(this.moonMat=new ie({color:11051674,roughness:.95,metalness:.02})),this.bodies.forEach(e=>{if(e.data.kind!=="planet"&&e.data.kind!=="dwarf")return;const a=t.filter(o=>o.planetId===e.data.id);if(!e.streakRing){const o=new k(new dt(e.data.radius*(e.data.rings?2.1:1.5),Math.max(.02,e.data.radius*.011),8,128),new O({color:new z(e.data.palette.atmo),transparent:!0,opacity:0,blending:A,depthWrite:!1}));o.rotation.x=Math.PI/2-.12,e.group.add(o),e.streakRing=o}e.streakTarget=zt.streakOf(a),e.streakDays=zt.daysOf(a);const i=Math.min(12,a.length);if(i!==e.moons.length){e.moons.forEach(o=>e.group.remove(o.mesh)),e.moons=[];for(let o=0;o<i;o++){const s=Q(o+1,e.data.id.length+3),l=e.data.radius*(.1+.09*s),r=new k(this.moonGeo,this.moonMat);r.scale.setScalar(Math.max(.09,l)),e.group.add(r),e.moons.push({mesh:r,a:e.data.radius*(1.75+.55*o)+(e.data.rings?e.data.radius*1.5:0),speed:Math.PI*2/(14+o*8),phase:s*6.28})}}});for(const e of this.galaxyStageNodes){const a=e.innerSys;if(a)for(const i of a.planets){if(i.data.kind!=="planet"&&i.data.kind!=="dwarf")continue;const o=t.filter(l=>l.planetId===i.data.id);if(!i.streakRing){const l=new k(new dt(i.data.radius*(i.data.rings?2.1:1.5),Math.max(.02,i.data.radius*.011),8,128),new O({color:new z(i.data.palette.atmo),transparent:!0,opacity:0,blending:A,depthWrite:!1}));l.rotation.x=Math.PI/2-.12,i.group.add(l),i.streakRing=l}i.streakTarget=zt.streakOf(o),i.streakDays=zt.daysOf(o);const s=Math.min(12,o.length);if(!(s===0&&i.moons.length>0&&!i.entryMoons)&&s!==i.moons.length){i.moons.forEach(l=>i.group.remove(l.mesh)),i.moons=[],i.entryMoons=s>0;for(let l=0;l<s;l++){const r=Q(l+1,i.data.id.length+3),f=i.data.radius*(.1+.09*r),n=new k(this.moonGeo,this.moonMat);n.scale.setScalar(Math.max(.09,f)),i.group.add(n),i.moons.push({mesh:n,a:i.data.radius*(1.75+.55*l)+(i.data.rings?i.data.radius*1.5:0),speed:Math.PI*2/(14+l*8),phase:r*6.28})}}}}}syncBodies(t){const e=new Set(t.map(i=>i.id));for(let i=this.bodies.length-1;i>=0;i--){const o=this.bodies[i];if(!e.has(o.data.id)){const s=new Set,l=new Set;this.moonGeo&&s.add(this.moonGeo),this.moonMat&&l.add(this.moonMat),this.disposeObject3D(o.group,{geometries:s,materials:l}),this.scene.remove(o.group),o.orbitLine&&(this.scene.remove(o.orbitLine),this.disposeObject3D(o.orbitLine,{geometries:s,materials:l}));const r=this.colliderList.indexOf(o.collider);r>=0&&this.colliderList.splice(r,1),this.bodies.splice(i,1),this.focusId===o.data.id&&(this.focusId=null)}}const a=new Set(this.bodies.map(i=>i.data.id));t.forEach(i=>{a.has(i.id)||this.buildBody(i)})}setReality(t){li("reality-rebuild-start"),this.activeRealityId=t.id,this.activeReality=t;const e=new z(t.colorA),a=new z(t.colorB),i=new z(t.starColor||t.colorA);this.starUniforms&&(this.starUniforms.uColorA?this.starUniforms.uColorA.value.copy(e):this.starUniforms.uColorA={value:e},this.starUniforms.uColorB?this.starUniforms.uColorB.value.copy(a):this.starUniforms.uColorB={value:a},this.starUniforms.uCoreColor?this.starUniforms.uCoreColor.value.copy(i):this.starUniforms.uCoreColor={value:i}),this.coronaMat&&this.coronaMat.uniforms&&(this.coronaMat.uniforms.uColorA?this.coronaMat.uniforms.uColorA.value.copy(e):this.coronaMat.uniforms.uColorA={value:e},this.coronaMat.uniforms.uColorB?this.coronaMat.uniforms.uColorB.value.copy(a):this.coronaMat.uniforms.uColorB={value:a}),this.activeRealityShieldMesh&&(this.activeRealityShieldMesh.position.set(...t.bubblePos),this.activeRealityShieldMesh.scale.setScalar(t.bubbleSize),this.activeRealityShieldMesh.traverse(s=>{s instanceof k&&s.material instanceof O&&s.material.color.copy(e)})),this.syncBodies(t.bodies),this.syncMoons(t.entries),this.buildGalaxyStageContents(t);const o=new z(t.colorB);if(this.clusterGasMats.forEach(s=>{s.color.copy(s.userData.baseColor).lerp(o,.42)}),this.renderer.compile(this.scene,this.camera),this.selectedId&&!t.bodies.some(s=>s.id===this.selectedId)&&this.selectedId!=="anchor"&&(this.selectedId=null,this.cb.onSelect(null)),this.focusId&&!t.bodies.some(s=>s.id===this.focusId)&&this.focusId!=="anchor"&&(this.focusId=null),this.realityGroups){const s=this.cosmicStage==="multiverse";Object.keys(this.realityGroups).forEach(l=>{this.realityGroups[l]&&(this.realityGroups[l].visible=s||l===t.id)})}ci("reality-rebuild","reality-rebuild-start")}triggerKamui(t){}zoomToDemonCore(){this.focusId=null,this.realityFocused=!1,this.cosmicStage==="web"?this.beginKamui("toMultiverse",.94):(this.rig.setZoomTarget(.94),this.prevDialTarget=.94),this.rig.setOrbit(.82,1.12),this.rig.clearPan()}zoomToCore(){this.focusId=null,this.realityFocused=!1,this.cosmicStage==="web"?this.beginKamui("toMultiverse",.93):(this.rig.setZoomTarget(.93),this.prevDialTarget=.93),this.rig.setOrbit(.85,1.1),this.rig.clearPan()}setActiveGalaxy(t){this.activeGalaxyName=t}cancelGalaxyEntryFlight(){var e;const t=this.galaxyEntryFlight;t&&(this.galaxyEntryFlight=null,this.kamuiWarpFx=0,this.galaxyTearGroup.visible=!1,this.galaxyStagePointMats.forEach(({mat:a})=>{a.uniforms.uVortexS.value=0,a.uniforms.uVortexR.value=0,a.uniforms.uVortexPull.value=0}),t.galaxyId&&((e=this.galaxyStageNodes.find(a=>a.data.id===t.galaxyId))==null||e.group.scale.setScalar(1)),this.galaxyInnerFocus=!1)}beginGalaxyEntry(t){var s,l;if(this.galaxyEntryFlight!==null||this.galaxyWarp!==null||this.kamuiFlight!==null||this.portal.phase!=="idle"||this.bootIntro||this.cosmicStage!=="web")return!1;const e=this.galaxyStageNodes.find(r=>r.data.id===t.id),a=new S;if(e)e.group.getWorldPosition(a);else if(!t.isHomeGalaxy)return!1;const i=(e==null?void 0:e.radius)??5600,o=!t.isHomeGalaxy;return this.galaxyFocusId=o?t.id:null,this.galaxyInnerFocus=!1,this.galaxyEntryFlight={t:0,fromDial:this.rig.tZoomT,toDial:t.isHomeGalaxy?.15:kt.zoomTOf(140),center:a,galaxyId:o?t.id:null,radius:i,endInner:o},this.grabCooldown=1.25,this.rig.clearPan(),this.rig.setOrbit(null,1.08),this.galaxyTearMat.uniforms.uProgress.value=0,this.galaxyTearMat.uniforms.uIntensity.value=.25,this.galaxyTearMat.uniforms.uColorA.value.set(t.color||((s=this.activeReality)==null?void 0:s.colorA)||"#38bdf8"),this.galaxyTearMat.uniforms.uColorB.value.set(((l=this.activeReality)==null?void 0:l.colorB)||"#8b5cf6"),this.galaxyTearGroup.visible=!0,!0}updateGalaxyEntryFlight(t){const e=this.galaxyEntryFlight;if(!e)return;e.t=Math.min(1,e.t+t/4.6);const a=e.t,i=1-Math.pow(1-a,3),o=Math.sin(Math.min(a,.96)/.96*Math.PI),s=et.smoothstep(a,.08,.52)*(1-et.smoothstep(a,.82,1)*.65),l=et.smoothstep(a,.68,.88),r=e.galaxyId?this.galaxyStageNodes.find(c=>c.data.id===e.galaxyId):null;r?r.group.getWorldPosition(this._vScratch2):this._vScratch2.copy(e.center),e.center.copy(this._vScratch2),this.galaxyTearGroup.position.copy(e.center),this.galaxyTearGroup.quaternion.copy(this.camera.quaternion),this.galaxyTearGroup.rotateZ(t*(2+a*9));const f=e.radius*(.045+i*1.55+o*.18);this.galaxyTearGroup.scale.set(f*this.camera.aspect,f,1),this.galaxyTearMat.uniforms.uTime.value=this.clockT,this.galaxyTearMat.uniforms.uProgress.value=a,this.galaxyTearMat.uniforms.uIntensity.value=.55+o*1.35+l*.28;const n=e.radius*(1.8+a*18);this.galaxyStagePointMats.forEach(({points:c,mat:m})=>{this._vScratch3.copy(e.center),c.worldToLocal(this._vScratch3),m.uniforms.uVortexC.value.copy(this._vScratch3),m.uniforms.uVortexR.value=n,m.uniforms.uVortexS.value=.05+s*1.25,m.uniforms.uVortexT.value=this.clockT*1.8,m.uniforms.uVortexPull.value=1}),r&&(r.group.rotation.y+=t*(1.2+a*7),r.group.rotation.z+=t*(.7+a*4),r.group.scale.setScalar(1+o*.42+s*.14)),e.endInner&&a>.82&&(this.galaxyInnerFocus=!0),this.rig.killZoomMomentum(),this.rig.setZoomTarget(et.lerp(e.fromDial,e.toDial,i)),this.kamuiWarpFx=o*1.18+l*.18,e.t>=1&&(this.galaxyEntryFlight=null,this.kamuiWarpFx=0,this.galaxyTearGroup.visible=!1,this.galaxyStagePointMats.forEach(({mat:c})=>{c.uniforms.uVortexS.value=0,c.uniforms.uVortexR.value=0,c.uniforms.uVortexPull.value=0}),r&&r.group.scale.setScalar(1),this.galaxyInnerFocus=e.endInner,this.rig.setZoomTarget(e.toDial),this.prevDialTarget=this.rig.tZoomT)}beginGalaxyWarp(t,e,a,i=!1){if(this.galaxyEntryFlight!==null||this.galaxyWarp!==null||this.kamuiFlight!==null||this.portal.phase!=="idle"||this.bootIntro||this.cosmicStage!=="web")return!1;const o=new S(0,0,0);if(a){const s=this.galaxyStageNodes.find(l=>l.data.id===a);s&&s.group.getWorldPosition(o)}return this.galaxyFocusId=a,i||(this.galaxyInnerFocus=!1),this.galaxyWarp={dir:t,t:0,fromDial:this.rig.tZoomT,toDial:e,center:o,endInner:i},this.grabCooldown=1,!0}fireAscend(){this.beginGalaxyWarp("ascend",.668,this.galaxyFocusId,this.galaxyInnerFocus)}enterGalaxy(t,e){var i,o,s,l;const a=((i=this.galaxyStageNodes.find(r=>r.data.id===e))==null?void 0:i.data)??(this.cosmicStage==="multiverse"?(o=this.galaxyNodes.find(r=>r.galaxyData.id===e))==null?void 0:o.galaxyData:void 0);if(a){if(this.focusId=null,this.realityFocused=!1,this.activeGalaxyName=a.name,this.cosmicStage==="multiverse"){this.galaxyFocusId=a.id,this.beginKamui("toWeb",kt.zoomTOf(26e3));return}if(a.isHomeGalaxy){this.releaseInnerWorld(),this.beginGalaxyEntry(a);return}this.beginGalaxyEntry(a)&&(this.innerFocusBodyId&&(this.innerFocusBodyId=null,(l=(s=this.cb).onSelectInnerWorld)==null||l.call(s,null)),this.rig.clearPan(),this.rig.setOrbit(null,1.08))}}selectInnerWorld(t){var a,i;const e=this.findInnerBody(t.slice(6));e&&(this.innerFocusBodyId=e.data.id,this.selectedId=t,(i=(a=this.cb).onSelectInnerWorld)==null||i.call(a,{galaxyId:e.galaxyId,galaxyName:e.galaxyName,starName:e.starName,body:e.data}))}activateInner(t){const e=t.slice(6),a=this.findInnerBody(e);if(a){if(a.data.kind==="star"){this.selectedId=t,this.innerFocusBodyId=null,this.cb.onActivate("anchor");return}this.selectedId=t,this.innerFocusBodyId=a.data.id,this.beginPortal({data:a.data})}}getInnerBody(t){var a;const e=t.startsWith("inner:")?t.slice(6):t;return((a=this.findInnerBody(e))==null?void 0:a.data)??null}findInnerBody(t){for(const e of this.galaxyStageNodes){const a=e.innerSys;if(!a)continue;if(a.starData.id===t)return{data:a.starData,galaxyId:e.data.id,galaxyName:e.data.name,starName:a.starData.name};const i=a.planets.find(o=>o.data.id===t);if(i)return{data:i.data,galaxyId:e.data.id,galaxyName:e.data.name,starName:a.starData.name}}return null}releaseInnerWorld(){var t,e;this.innerFocusBodyId&&(this.innerFocusBodyId=null,this.selectedId=null,this.rig.setZoomTarget(kt.zoomTOf(150)),this.prevDialTarget=kt.zoomTOf(150),(e=(t=this.cb).onSelectInnerWorld)==null||e.call(t,null))}applyPortalGravityUniforms(t){const e=t.uniforms;e.uGravityCenter&&(e.uGravityCenter.value.copy(this.portalGravityUniforms.center),e.uGravityRadius.value=this.portalGravityUniforms.radius,e.uGravityStrength.value=this.portalGravityUniforms.strength,e.uGravityTime.value=this.portalGravityUniforms.time,e.uReverse&&(e.uReverse.value=this.portalReverse))}setPortalLocalCenter(t,e){!e||!t.uniforms.uGravityLocalCenter||(this._vScratch4.copy(this.portalGravityUniforms.center),e.worldToLocal(this._vScratch4),t.uniforms.uGravityLocalCenter.value.copy(this._vScratch4))}updatePortalPointsVortex(){if(this.kamuiFlight!==null||this.galaxyEntryFlight!==null)return;const t=this.portal.phase!=="idle"&&this.portalVisualT>.001;for(const{points:e,mat:a}of this.portalPointSets){if(!t){a.uniforms.uVortexS.value!==0&&(a.uniforms.uVortexS.value=0,a.uniforms.uVortexR.value=0,a.uniforms.uVortexPull.value=0);continue}this._vScratch4.copy(this.portalGravityUniforms.center),e.worldToLocal(this._vScratch4),a.uniforms.uVortexC.value.copy(this._vScratch4),a.uniforms.uVortexR.value=this.portalGravityUniforms.radius,a.uniforms.uVortexS.value=this.portalVisualT*.85,a.uniforms.uVortexT.value=this.clockT*1.6,a.uniforms.uVortexRev&&(a.uniforms.uVortexRev.value=this.portalReverse),a.uniforms.uVortexPull&&(a.uniforms.uVortexPull.value=this.portalEject>.001?-this.portalEject*1.1:.25+this.portalVisualT*.6)}}updatePortalGravity(){var l;if(this.portal.phase==="idle"||this.portalVisualT<=.001){this.portalGravityUniforms.strength=0,this.portalGravityUniforms.radius=0,this.portalBodyRadius=0;return}const t=this.portalLocalCenter;let e=2,a=null,i=null;if(this.portalTargetInnerId)for(const r of this.galaxyStageNodes){const f=(l=r.innerSys)==null?void 0:l.planets.find(n=>n.data.id===this.portalTargetInnerId);if(f){i=f,f.group.getWorldPosition(t),e=f.data.radius;break}}else{const r=this.bodies.find(f=>f.data.id===this.portal.bodyId);r&&(a=r.data.id,r.group.getWorldPosition(t),e=r.data.radius)}if(!i&&!a)return;const o=Math.max(120,e*180),s=et.clamp(this.portalVisualT,0,1);this.portalGravityUniforms.center.copy(t),this.portalGravityUniforms.radius=o,this.portalGravityUniforms.strength=s,this.portalGravityUniforms.time=this.clockT}updateBodies(t){var r;const e=1-ae(430,860,this.currentDist());for(let f=0;f<this.bodies.length;f++){const n=this.bodies[f],c=n.data.orbit,m=de(n.data,this.simDays),y=me(c.a,m.eccentricity,c.phase,c.incl,this.simDays,c.speed||.01);if(n.group.position.set(y.x,y.y,y.z),this.bootIntro&&this.birthK<1){const h=1-Math.pow(1-this.birthK,3);n.group.position.multiplyScalar(h);const d=(1-h)*2.8,p=n.group.position.x,M=n.group.position.z;n.group.position.x=p*Math.cos(d)-M*Math.sin(d),n.group.position.z=p*Math.sin(d)+M*Math.cos(d)}n.group.getWorldPosition(this._vScratch2),this._vScratch1.copy(this._vScratch2).multiplyScalar(-1).normalize(),n.ghost+=(n.ghostTarget-n.ghost)*Math.min(1,t*3),n.fade+=(n.fadeTarget-n.fade)*Math.min(1,t*3),n.hoverT+=((this.hoveredId===n.data.id?1:0)-n.hoverT)*Math.min(1,t*8);const g=!this.portalTargetInnerId&&this.portal.bodyId===n.data.id?this.portalVisualT:0;if(n.mat&&(n.mat.uniforms.uSunDir&&n.mat.uniforms.uSunDir.value.copy(this._vScratch1),n.mat.uniforms.uTime&&(n.mat.uniforms.uTime.value=this.clockT),n.mat.uniforms.uGhost&&(n.mat.uniforms.uGhost.value=n.ghost),n.mat.uniforms.uFade&&(n.mat.uniforms.uFade.value=n.fade*e),n.mat.uniforms.uTear&&(n.mat.uniforms.uTear.value=g),n.mat.uniforms.uTearTime&&(n.mat.uniforms.uTearTime.value=this.clockT),this.applyPortalGravityUniforms(n.mat),this.setPortalLocalCenter(n.mat,n.spinMesh),n.mat.uniforms.uCamLocalP&&n.data.kind==="nebula"&&(this._vScratch3.copy(this.camera.position),n.group.worldToLocal(this._vScratch3),n.mat.uniforms.uCamLocalP.value.copy(this._vScratch3))),(r=n.extras)==null||r.forEach(h=>{h.uniforms.uTime.value=this.clockT}),n.spinMesh&&n.spinRate&&(n.spinMesh.rotation.y+=t*n.spinRate),n.cloudMesh&&n.cloudSpinRate&&(n.cloudMesh.rotation.y+=t*n.cloudSpinRate),n.cloudMat&&(n.cloudMat.uniforms.uTime.value=this.clockT,n.cloudMat.uniforms.uTear&&(n.cloudMat.uniforms.uTear.value=g),n.cloudMat.uniforms.uTearTime&&(n.cloudMat.uniforms.uTearTime.value=this.clockT),this.applyPortalGravityUniforms(n.cloudMat),this.setPortalLocalCenter(n.cloudMat,n.cloudMesh),n.cloudMat.uniforms.uSunDir.value.copy(this._vScratch1),n.cloudMat.uniforms.uFade.value=n.fade*e*(1-n.ghost),n.cloudMat.visible=n.cloudMat.uniforms.uFade.value>.02),n.atmo){const h=n.atmo.material;h.uniforms.uSunDir.value.copy(this._vScratch1),h.uniforms.uTear&&(h.uniforms.uTear.value=g),h.uniforms.uTearTime&&(h.uniforms.uTearTime.value=this.clockT),this.applyPortalGravityUniforms(h),this.setPortalLocalCenter(h,n.atmo),n.atmo.visible=n.fade*e*(1-n.ghost)>.05}if(n.ringMat&&(n.ringMesh.getWorldQuaternion(this._qScratch).invert(),n.ringMat.uniforms.uSunLocal.value.copy(this._vScratch1).applyQuaternion(this._qScratch),this.applyPortalGravityUniforms(n.ringMat),this.setPortalLocalCenter(n.ringMat,n.ringMesh),n.ringMesh.visible=n.fade*e*(1-n.ghost*.85)>.05),n.moons.forEach(h=>{const d=h.phase+this.simDays*h.speed;h.mesh.position.set(Math.cos(d)*h.a,Math.sin(d*.7)*h.a*.12,Math.sin(d)*h.a),h.mesh.visible=n.fade*e*(1-n.ghost)>.05}),n.orbitLine){const h=n.hoverT*e*.22;n.orbitLine.material.opacity=h,n.orbitLine.visible=h>.01}const x=this.selectedId===n.data.id?1:0,u=x?1+.025*Math.sin(this.clockT*3.2):1;if(n.group.scale.setScalar((1+Math.max(n.hoverT,x*.5)*.035)*u*(1-n.ghost*.35)),n.group.visible=n.fade*e>.03,n.streakRing){const h=n.streakRing.material,d=n.streakTarget??0,p=n.streakDays??0,M=p>0?Math.min(.95,.22+.16*d+.02*p):0;h.opacity+=(M-h.opacity)*Math.min(1,t*3.5);const P=1+.022*Math.sin(this.clockT*1.8+n.data.id.length);h.opacity=Math.max(0,h.opacity+.05*M*Math.sin(this.clockT*3.1)),n.streakRing.scale.setScalar(P),n.streakRing.rotation.z+=t*.25,n.streakRing.visible=h.opacity>.02&&n.fade*e>.03}if(n.data.kind==="vault"&&n.group.userData.spin){const h=n.group.userData.spin;h.r1.rotation.z+=t*.3,h.r2.rotation.x+=t*.22;const d=n.group.userData.bh;d&&d.update(this.clockT,this.camera.quaternion,g);const p=h.r1.material,M=h.r2.material;if(this.vaultPulse>0){this.vaultPulse=Math.max(0,this.vaultPulse-t*.5);const P=1+Math.sin(this.clockT*12)*.015*this.vaultPulse;h.r1.scale.setScalar(P),h.r2.scale.setScalar(P),(p==null?void 0:p.emissiveIntensity)!==void 0&&(p.emissiveIntensity=1.8+this.vaultPulse*2.2),(M==null?void 0:M.emissiveIntensity)!==void 0&&(M.emissiveIntensity=1.8+this.vaultPulse*2.2)}else h.r1.scale.setScalar(1),h.r2.scale.setScalar(1),p&&(p.emissiveIntensity+=(1.8-p.emissiveIntensity)*Math.min(1,t*2)),M&&(M.emissiveIntensity+=(1.8-M.emissiveIntensity)*Math.min(1,t*2))}}this.anchorGroup.rotation.y+=t*.08;const a=this.anchorGroup.userData.starMesh;a&&(a.rotation.y+=t*.15),this.starUniforms.uTime.value=this.clockT;const i=1-this.coreT*.42;this.starUniforms.uBoost.value+=(i-this.starUniforms.uBoost.value)*Math.min(1,t*3),this.bloomPass.strength=.18-this.coreT*.08;const o=this.anchorGroup.userData.haloA,s=this.anchorGroup.userData.haloB;o.rotation.y+=t*.05,s.rotation.y-=t*.038,o.material.uniforms.uTime.value=this.clockT,s.material.uniforms.uTime.value=this.clockT,o.material.uniforms.uOpacity.value=1-this.coreT*.5,s.material.uniforms.uOpacity.value=1-this.coreT*.5,this.coronaMat.uniforms.uTime.value=this.clockT,this.coronaMat.uniforms.uBoost.value=(1-this.coreT*.55)*(.92+.08*Math.sin(this.clockT*.8)),this.anchorGroup.visible=e>.02;const l=this.bootIntro&&this.clockT<2.4;this.belt.visible=e>.02&&!l,this.belt.rotation.y=this.simDays*.0016,this.belt.visible&&this.asteroidInst.forEach(({mesh:f,tumbles:n})=>{for(let c=0;c<n.length;c++){const m=n[c];m.q.multiply(this._rockQ.setFromAxisAngle(m.axis,m.speed*t)),this._rockM.compose(m.pos,m.q,m.scale),f.setMatrixAt(c,this._rockM)}f.instanceMatrix.needsUpdate=!0})}updateLevels(t=0){const e=this.currentDist(),a=this.camera.position.length()+1,i={neighborhood:Bt(e,260,750,4800,12e3),galaxy:Bt(e,3500,7500,38e3,25e4),cluster:Bt(e,42e3,6e4,95e3,35e4),supercluster:Bt(e,7e4,1e5,25e4,6e5),web:Bt(e,18e4,28e4,65e4,12e5),multiverse:Bt(e,34e4,7e5,1e12,1e12)},o=et.smoothstep(this.rig.tZoomT,.845,.865);if(o>0&&(i.web=Math.max(i.web,o),i.supercluster*=1-o,i.cluster*=1-o,i.galaxy*=1-o,i.neighborhood*=1-o),this.kamuiFlight!==null&&this.warpDir==="toMultiverse"&&this.kamuiFlight<.4){i.web=Math.max(i.web,1);const u=1-this.kamuiErase;i.supercluster*=u,i.cluster*=u,i.galaxy*=u,i.neighborhood*=u}this.cosmicStage==="multiverse"?(i.neighborhood=0,i.galaxy=0,i.cluster=0,i.supercluster=0,i.web=0,i.multiverse=1):i.multiverse=0,this.gNeighborhood.visible=i.neighborhood>.01,this.gGalaxy.visible=i.galaxy>.01||this.galaxyInnerFocus,this.gCluster.visible=i.cluster>.01,this.gSupercluster.visible=i.supercluster>.01,this.gWeb.visible=i.web>.01,this.gMultiverse.visible=i.multiverse>.01,this.bootIntro&&this.kamuiFlight===null&&this.clockT<2.2&&(this.gMultiverse.visible=!1);const s=i.multiverse>.01;this.realityGroups&&Object.keys(this.realityGroups).forEach(u=>{this.realityGroups[u]&&(this.realityGroups[u].visible=s||u===this.activeRealityId)});const l=Math.sin(this.kamuiErase*Math.PI)*1.35,r=this.portal.phase!=="idle"?Math.sin(this.portal.t*Math.PI)*1.5:0,f=Math.max(l,r);if(this.multiverseMats.forEach(u=>{u.uniforms.uTime.value=this.clockT;const h=this.hoveredId&&this.hoveredId.startsWith("reality:"),d=Math.max(f,h?.35+.15*Math.sin(this.clockT*3.5):0);u.uniforms.uTearStrength&&(u.uniforms.uTearStrength.value=d)}),this.demonCoreMat){this.demonCoreMat.uniforms.uTime.value=this.clockT,this.demonCoreMat.uniforms.uHover.value=this.hoveredId==="demon-core"?1:0;const u=this.hoveredId==="demon-core",h=Math.max(f,u?.65+.25*Math.sin(this.clockT*4):0);this.demonCoreMat.uniforms.uTearStrength&&(this.demonCoreMat.uniforms.uTearStrength.value=h)}if(this.demonCoreGroup&&(this.demonCoreGroup.rotation.y+=.005,this.demonCoreInnerGeom&&(this.demonCoreInnerGeom.rotation.x-=.014,this.demonCoreInnerGeom.rotation.y+=.022,this.demonCoreInnerGeom.rotation.z+=.008),this.demonCoreTesseract&&(this.demonCoreTesseract.rotation.x+=.016,this.demonCoreTesseract.rotation.y+=.024,this.demonCoreTesseract.rotation.z-=.012),this.demonCoreJets.forEach((u,h)=>{const d=1+.18*Math.sin(this.clockT*12+h*Math.PI),p=1+.12*Math.sin(this.clockT*6+h*2);u.scale.set(d,p,d)}),this.demonCoreRings.forEach((u,h)=>{const d=h%2===0?1:-1;u.rotation.z+=d*(.008+h*.004),u.rotation.y+=(h%3===0?1:-1)*.006,u.rotation.x+=.003}),this.demonCoreTachyonNodes.forEach(u=>{const h=u.userData,d=h.phase+this.clockT*h.speed,p=Math.cos(d)*h.radius,M=Math.sin(d)*h.radius*Math.sin(h.incl),P=Math.sin(d)*h.radius*Math.cos(h.incl);u.position.set(p,M,P),u.rotation.x+=.02,u.rotation.y+=.03}),this.demonCoreSpires.forEach((u,h)=>{const d=1+.12*Math.sin(this.clockT*2.4+h*.52);u.scale.set(d,1+.08*Math.sin(this.clockT*2+h*.3),d)}),this.demonCorePulseRings.forEach(u=>{u.userData.phase=(u.userData.phase+.006)%1;const h=u.userData.phase,d=1+h*3.2;u.scale.set(d,d,d);const p=u.material;p.opacity=Math.sin(h*Math.PI)*.55;const M=u.userData.rotSpeed||.005;u.rotation.z+=M,u.rotation.x+=M*.7,u.rotation.y+=M*.5})),this.coreStabilizerBeamMat&&i.multiverse>.01){const u=this.hoveredId==="demon-core";this.coreStabilizerBeamMat.opacity=(u?.85:.35)+.1*Math.sin(this.clockT*3)}if(this.corePulseOrbs&&i.multiverse>.01&&this.corePulseOrbs.forEach(u=>{u.userData.progress=(u.userData.progress+.0035)%1;const h=u.userData.progress,d=u.userData.targetPos;u.position.set(d.x*h,d.y*h,d.z*h);const p=u.material;p.opacity=Math.sin(h*Math.PI)*.95;const M=1+.4*Math.sin(this.clockT*4+h*6.28);u.scale.set(M,M,M)}),this.exoplanetPlateMat&&(this.exoplanetPlateMat.uniforms.uTime.value=this.clockT),this.webLineMat.uniforms.uOpacity.value=i.web*.17,this.gWeb.rotation.y=this.clockT*.0017,this.gSupercluster.rotation.y=this.clockT*.0011,this.gMultiverse.rotation.y=this.clockT*8e-4,this.activeRealityShieldMesh&&i.multiverse>.01&&(this.activeRealityShieldMesh.rotation.y+=.012,this.activeRealityShieldMesh.rotation.z+=.006),this.realityMarbles.forEach(u=>{(i.multiverse>.01||i.web>.01)&&(u.spiral.rotation.y+=t*u.speed,u.glassMat.uniforms.uTime.value=this.clockT)}),this.galaxyNodes.forEach(u=>{const h=u.phase+this.clockT*u.orbitSpeed,d=Math.cos(h)*u.orbitRadius,p=Math.sin(h)*u.orbitRadius*Math.sin(u.orbitIncl),M=Math.sin(h)*u.orbitRadius*Math.cos(u.orbitIncl);u.group.position.set(u.centerPos.x+d,u.centerPos.y+p,u.centerPos.z+M),u.spiralGroup.rotation.y+=.005;const P=this.hoveredId===`galaxy:${u.galaxyData.id}:${u.realityId}`;u.group.scale.setScalar(P?1.5:1);const w=u.orbitLine.material,E=P?.6:u.galaxyData.isHomeGalaxy?.36:.2;w.opacity+=(E-w.opacity)*Math.min(1,t*8),u.glowSprite.material.opacity=P?1:.82}),this.astralCoreGroup){this.astralCoreGroup.rotation.y+=t*.02;const u=this.hoveredId==="multiverse-core"?1:0;this.coreHoverT+=(u-this.coreHoverT)*Math.min(1,t*6),this.astralCoreMats.forEach(d=>{d.uniforms.uTime.value=this.clockT,d.uniforms.uHover.value=this.coreHoverT}),this.astralCoreHalo.forEach((d,p)=>{d.rotation.y+=t*(p===0?.05:-.035),d.rotation.x=Math.sin(this.clockT*.11+p)*.22}),this.astralCoreRings.forEach((d,p)=>{d.rotation.z+=t*(.1+p*.04)*(p%2===0?1:-1),d.rotation.y+=t*.06*(p%2===0?-1:1)});const h=this.astralCoreGroup.children.find(d=>d instanceof J);if(h){const d=1+.05*Math.sin(this.clockT*1.4)+this.coreHoverT*.12;h.scale.setScalar(96e3*d)}}let n=0;if(this.kamuiFlight!==null){const u=this.kamuiFlight;n=u<.35?u/.35:u<.72?1:Math.max(0,1-(u-.72)/.28)}else this.galaxyEntryFlight!==null?n=Math.sin(Math.min(this.galaxyEntryFlight.t,1)*Math.PI)*1.15:this.galaxyWarp!==null&&(n=Math.sin(Math.min(this.galaxyWarp.t,1)*Math.PI)*.85);if(this.kamuiErase=et.damp(this.kamuiErase,n,6,Math.max(t,.001)),this.backdropMat&&(this.backdropMat.uniforms.uKamuiErase.value=this.kamuiErase*.5,this.backdropMat.uniforms.uTime.value=this.clockT,this.camera.getWorldDirection(this._vDirScratch),this.backdropMat.uniforms.uVortexDir.value.copy(this._vDirScratch)),this.giantMultiverseBoundaryMat){this.giantMultiverseBoundaryMat.uniforms.uTime.value=this.clockT;const u=Math.max(this.kamuiErase,i.multiverse>.01?(1-i.multiverse)*.5:0);this.giantMultiverseBoundaryMat.uniforms.uKamuiErase.value=u,this.camera.getWorldDirection(this._vDirScratch),this.giantMultiverseBoundaryMat.uniforms.uVortexDir.value.copy(this._vDirScratch)}const c=this.cosmicStage!=="multiverse";if(this.skyDomeMesh&&(this.skyDomeMesh.visible=c),this.farStarsPoints){const u=this.farStarsPoints.material;u&&u.uniforms&&u.uniforms.uOpacity&&(u.uniforms.uOpacity.value=c?Math.max(.45,1-this.kamuiErase):0)}this.skyNebulae.forEach(u=>{u.uniforms&&u.uniforms.uOpacity&&(u.uniforms.uOpacity.value=c?Math.max(.45,1-this.kamuiErase):0),u.uniforms.uTime.value=this.clockT*.4}),this.clouds.forEach(u=>{u.mat.uniforms.uScale.value=u.px*a/240,u.mat.uniforms.uTime.value=this.clockT});const m=a/90;this.levelPointMats.forEach(u=>{const h=u.userData.pointMode;u.uniforms.uScale.value=h==="marble"?a/130:h==="multiverse"?1:m}),this.giantMultiverseBoundaryMat&&(this.giantMultiverseBoundaryMat.uniforms.uTime.value=this.clockT),this.setLevelOpacity(this.gNeighborhood,i.neighborhood),this.setLevelOpacity(this.gGalaxy,i.galaxy),this.galaxyInnerFocus&&(this.gGalaxy.visible=!0),this.setLevelOpacity(this.gCluster,i.cluster),this.setLevelOpacity(this.gSupercluster,i.supercluster),this.setLevelOpacity(this.gWeb,i.web),this.setLevelOpacity(this.gMultiverse,i.multiverse),this.levelSprites.forEach(u=>{let h=1;u.level==="neighborhood"&&(h=i.neighborhood),u.level==="cluster"&&(h=Math.max(i.cluster,i.galaxy*.9)),u.level==="supercluster"&&(h=i.supercluster),u.level==="web"&&(h=i.web),u.level==="multiverse"&&(h=i.multiverse),u.mat.opacity=u.base*h}),this.galaxyStageNodes.forEach(u=>{u.group.getWorldPosition(this._vScratch2);const h=this.camera.position.distanceTo(this._vScratch2),d=h<1600;u.inner.visible!==d&&(u.inner.visible=d),d&&this.updateInnerSystem(u,t,h);let p=this.galaxyFocusId&&u.data.id!==this.galaxyFocusId?.4:1;this.galaxyInnerFocus&&u.data.id===this.galaxyFocusId&&(p*=et.smoothstep(h,400,1200)),u.glowMat.opacity=.95*i.galaxy*p,u.discMat.uniforms.uOpacity&&(u.discMat.uniforms.uOpacity.value=i.galaxy*p)});const y=Bt(e,2600,7e3,64e3,1e5);this.beacon.visible=y>.01,this.beacon.material.opacity=y,this.beacon.scale.setScalar(a*.011),this.gGalaxy.rotation.y=this.clockT*.0022;let g="STELLAR SYSTEM";const x=this.focusBody();if(x&&this.surfaceBlend>.5)g=`SURFACE · ${x.data.name.toUpperCase()}`;else if(this.cosmicStage==="multiverse")g=this.realityFocused?"MULTIVERSE":"REALITY / UNIVERSE";else if(e<260)if(this.galaxyInnerFocus){const u=this.galaxyStageNodes.find(h=>h.data.id===this.galaxyFocusId);g=u?`STELLAR SYSTEM · ${u.data.lineage.stellarSystem.starName.toUpperCase()}`:"STELLAR SYSTEM"}else g=x?`APPROACH · ${x.data.name.toUpperCase()}`:"STELLAR SYSTEM";else if(e<1200)g="STAR-FORMING REGION";else if(e<4500)g="SPIRAL ARM";else if(e<14e3)g="GALACTIC REGION";else if(e<38e3){let u=this.activeGalaxyName,h=1/0;for(const d of this.galaxyStageNodes){d.group.getWorldPosition(this._vScratch2);const p=this.camera.position.distanceTo(this._vScratch2);p<h&&(h=p,u=d.data.name)}g=u?`GALAXY · ${u.toUpperCase()}`:"GALAXY"}else e<85e3?g="GALAXY CLUSTER / GALAXY GROUP":e<16e4?g="SUPERCLUSTER":e<32e4?g="SUPERCLUSTER COMPLEX":e<65e4?g="COSMIC WEB":e<12e5?g="REALITY / UNIVERSE":g="MULTIVERSE";g!==this.lastLabel&&(this.lastLabel=g,this.cb.onScaleLabel(g))}setLevelOpacity(t,e){const a=e>.001;t.visible=a,a&&t.traverse(i=>{if(i instanceof Zt){const o=i.material;o.uniforms&&o.uniforms.uOpacity&&(o.uniforms.uOpacity.value=e)}})}updateSurface(t){const e=this.focusBody();let a=0;if(e&&(e.data.kind==="planet"||e.data.kind==="dwarf")){const s=this.currentDist(),l=e.data.radius;a=1-ae(l*1.9,l*2.7,s)}this.surfaceBlend+=(a-this.surfaceBlend)*Math.min(1,t*4);const i=this.surfaceBlend>.02;if(this.surface.visible=i,!i){this.surfaceLocked=!1;return}if(e){!this.surfaceLocked&&this.surfaceBlend>.06&&(this._vScratch1.copy(this.camera.position).sub(e.group.position).normalize(),this.surfaceQuat.setFromUnitVectors(new S(0,1,0),this._vScratch1),this.surfaceLocked=!0),this.surface.position.copy(e.group.position),this.surface.quaternion.slerp(this.surfaceQuat,Math.min(1,t*6)),this.surface.scale.setScalar(e.data.radius);const s=e.data.palette;this.surfaceMat.uniforms.uDeep.value.set(s.deep),this.surfaceMat.uniforms.uBase.value.set(s.base),this.surfaceMat.uniforms.uHigh.value.set(s.high),this.surfaceMat.uniforms.uIce.value.set(s.ice),this.skyMat.uniforms.uHorizon.value.set(s.atmo),this.skyMat.uniforms.uZenith.value.set(s.deep),this._vScratch2.copy(e.group.position).multiplyScalar(-1).normalize(),this.surfaceMat.uniforms.uSunDir.value.copy(this._vScratch2),this.skyMat.uniforms.uSunDir.value.copy(this._vScratch2),this.surfaceMat.uniforms.uFogDensity.value=.03/e.data.radius,this.surfaceMat.uniforms.uFog.value.set(s.atmo).multiplyScalar(.75),this.surfaceParticlesMat.uniforms.uOpacity.value=this.surfaceBlend}const o=this.surfaceBlend>.92;e&&(e.mat&&e.mat.uniforms.uFade&&(e.mat.uniforms.uFade.value=o?0:e.mat.uniforms.uFade.value),e.atmo&&(e.atmo.visible=e.atmo.visible&&!o),e.cloudMesh&&(e.cloudMesh.visible=e.cloudMesh.visible&&!o),e.ringMesh&&(e.ringMesh.visible=e.ringMesh.visible&&!o),e.moons.forEach(s=>{s.mesh.visible=s.mesh.visible&&!o}))}updateCore(t){const e=this.coreActive?1:0;if(this.coreT+=(e-this.coreT)*Math.min(1,t*2.6),this.connectionMat.opacity=this.coreT*.3,this.coreT>.02){const a=this.connections.length*6;if(a>this._corePosBuffer.length){this._corePosBuffer=new Float32Array(Math.max(a*2,3e3));const s=new Rt(this._corePosBuffer,3);s.setUsage(ce),this.connectionLines.geometry.setAttribute("position",s)}let i=0;for(let s=0;s<this.connections.length;s++){const[l,r]=this.connections[s];l.ghostTarget>.5||r.ghostTarget>.5||(l.group.getWorldPosition(this._vScratch1),r.group.getWorldPosition(this._vScratch2),this._corePosBuffer[i++]=this._vScratch1.x,this._corePosBuffer[i++]=this._vScratch1.y,this._corePosBuffer[i++]=this._vScratch1.z,this._corePosBuffer[i++]=this._vScratch2.x,this._corePosBuffer[i++]=this._vScratch2.y,this._corePosBuffer[i++]=this._vScratch2.z)}const o=this.connectionLines.geometry.getAttribute("position");o&&(o.needsUpdate=!0),this.connectionLines.geometry.setDrawRange(0,i/3)}this.connectionLines.visible=this.coreT>.02}setConnections(t){this.connections=t.map(([e,a])=>[this.bodies.find(i=>i.data.id===e),this.bodies.find(i=>i.data.id===a)]).filter(e=>!!(e[0]&&e[1]))}updateHover(){if(!this.pointerMoved&&!this.dragging)return;this.pointerMoved=!1;const t=this.pick();t!==this.hoveredId&&(this.hoveredId=t,this.cb.onHover(t,this.mouseScreenX,this.mouseScreenY));const e=this.renderer.domElement;e.style.cursor=t?"pointer":this.dragging?"grabbing":"grab"}disposeObject3D(t,e={}){const a=new Set,i=new Set,o=new Set,s=e.geometries??new Set,l=e.materials??new Set,r=e.textures??new Set,f=c=>{c instanceof ta?o.add(c):Array.isArray(c)&&c.forEach(f)},n=c=>{if(Array.isArray(c)){c.forEach(n);return}if(!(c instanceof Ji)||l.has(c)||i.has(c))return;i.add(c);const m=c;Object.keys(m).forEach(y=>f(m[y])),c instanceof W&&Object.values(c.uniforms).forEach(y=>f(y.value))};t.traverse(c=>{const m=c;m.geometry instanceof yt&&!s.has(m.geometry)&&a.add(m.geometry),n(m.material)}),o.forEach(c=>{r.has(c)||c.dispose()}),a.forEach(c=>c.dispose()),i.forEach(c=>c.dispose())}dispose(){this.disposed||(this.disposed=!0,this.clickTimer&&(clearTimeout(this.clickTimer),this.clickTimer=null),this.renderer.setAnimationLoop(null),this.canvas.removeEventListener("pointerdown",this.onPointerDown),this.canvas.removeEventListener("pointermove",this.onPointerMove),this.canvas.removeEventListener("pointerup",this.onPointerUp),this.canvas.removeEventListener("pointercancel",this.onPointerCancel),this.canvas.removeEventListener("dblclick",this.onDoubleClick),this.canvas.removeEventListener("contextmenu",this.onContextMenu),this.renderer.domElement.removeEventListener("webglcontextlost",this.onContextLost),this.renderer.domElement.removeEventListener("webglcontextrestored",this.onContextRestored),window.removeEventListener("resize",this.resize),window.removeEventListener("eventide-vault-pulse",this.onVaultPulse),this.canvas.style.touchAction=this.originalTouchAction,this.rig.dispose(),this.disposeObject3D(this.scene),this.scene.clear(),this.composer.dispose(),this.renderer.dispose())}}export{zt as UniverseEngine};

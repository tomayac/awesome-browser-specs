// SPDX-FileCopyrightText: 2026 Thomas Steiner
// SPDX-License-Identifier: Apache-2.0

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const FxShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uChroma: { value: 0.003 },
    uGlitch: { value: 0 },
    uFlash: { value: 0 },
    uInvert: { value: 0 },
    uPunch: { value: 0 },
    uMotion: { value: 1 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uChroma;
    uniform float uGlitch;
    uniform float uFlash;
    uniform float uInvert;
    uniform float uPunch;
    uniform float uMotion;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    // The bulge of a curved picture tube
    vec2 tube(vec2 uv) {
      uv = uv * 2.0 - 1.0;
      vec2 bend = abs(uv.yx) / vec2(5.0, 4.2);
      uv += uv * bend * bend;
      return uv * 0.5 + 0.5;
    }

    void main() {
      vec2 screen = tube(vUv);
      vec2 uv = (screen - 0.5) * (1.0 - uPunch * 0.05) + 0.5;

      // A hum bar rolls up the picture
      float tick = floor(uTime * 60.0);
      float roll = fract(-uTime * 0.07);
      float hum = 1.0 - smoothstep(0.0, 0.07, abs(screen.y - roll));

      // Occasional flicker, decided per half second by the clock
      float flicker = step(0.88, hash(vec2(floor(uTime * 2.0), 11.0)));

      // A worn tape: the whole picture always wavers a little, and now and
      // then, for a second and a half, it sways, bends at the top, slips,
      // and breathes, easing in and out
      float spell = floor(uTime / 1.5);
      float within = fract(uTime / 1.5);
      float issue = step(0.72, hash(vec2(spell, 31.0)))
        * pow(sin(within * 3.14159), 2.0) * uMotion;
      uv.x += 0.0012 * sin(uTime * 1.3) * uMotion;
      uv.x += issue * 0.012 * sin(uTime * 6.0 + screen.y * 3.0);
      uv.x += issue * 0.025 * pow(screen.y, 6.0) * sin(uTime * 2.7);
      uv.y += issue * 0.008 * sin(uTime * 5.3);
      uv = (uv - 0.5) * (1.0 + issue * 0.012 * sin(uTime * 4.1)) + 0.5;

      // Horizontal slices that jump sideways while glitching
      float frame = floor(uTime * 24.0);
      float band = floor(uv.y * 28.0 + hash(vec2(frame, 3.0)) * 9.0);
      float slice = step(1.0 - uGlitch * 0.55, hash(vec2(band, frame)));
      uv.x += slice * (hash(vec2(band, frame + 1.0)) - 0.5) * 0.18 * uGlitch;

      // Convergence errors and color bleed spread red and blue apart
      vec2 dir = uv - 0.5;
      float shift = uChroma + uGlitch * 0.012;
      // VHS smears color more than brightness, and the smear wavers
      vec2 bleed = vec2(
        0.0009 + 0.0005 * sin(screen.y * 40.0 + uTime * 3.0) + issue * 0.004,
        0.0
      );
      vec3 color = vec3(
        texture2D(tDiffuse, uv + dir * shift + bleed).r,
        texture2D(tDiffuse, uv).g,
        texture2D(tDiffuse, uv - dir * shift - bleed).b
      );
      // A faint ghost from a reflected signal
      color += texture2D(tDiffuse, uv - vec2(0.008, 0.0)).rgb * 0.07;

      // Scanlines and the aperture grille's red, green, and blue stripes
      float scan = 0.5 + 0.5 * sin(screen.y * uResolution.y * 2.0944);
      color *= 0.7 + 0.3 * scan;
      float stripe = mod(gl_FragCoord.x, 3.0);
      vec3 grille = vec3(
        stripe < 1.0 ? 1.0 : 0.72,
        stripe >= 1.0 && stripe < 2.0 ? 1.0 : 0.72,
        stripe >= 2.0 ? 1.0 : 0.72
      );
      color *= grille * 1.18;

      color *= 1.0 + hum * 0.1 * uMotion;
      color *= 1.0 - 0.04 * uMotion * hash(vec2(tick, 7.0));

      // The worn tape also loses color and pumps its brightness
      color = mix(color, vec3(dot(color, vec3(0.3, 0.59, 0.11))), issue * 0.55);
      color *= 1.0 - issue * 0.15 * (0.5 + 0.5 * sin(uTime * 13.0));
      color *= 1.0 - flicker * uMotion * (0.2 + 0.4 * hash(vec2(tick, 3.0)));
      color += (hash(vUv * uResolution + fract(uTime) * 100.0) - 0.5) * 0.08;
      color *= mix(1.0, smoothstep(0.95, 0.2, length(screen - 0.5)), 0.7);

      color = mix(color, vec3(1.0) - clamp(color, 0.0, 1.0), uInvert);
      color += uFlash;

      // Black beyond the rounded edges of the tube
      vec2 inside = smoothstep(0.0, 0.012, screen) * smoothstep(0.0, 0.012, 1.0 - screen);
      color *= inside.x * inside.y;
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export function createEngine(container) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.append(renderer.domElement);

  const composer = new EffectComposer(renderer);
  const scenePass = new RenderPass(new THREE.Scene(), new THREE.Camera());
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1, 0.55, 0.3);
  const fx = new ShaderPass(FxShader);
  composer.addPass(scenePass);
  composer.addPass(bloom);
  let overlayPass = null;
  const addOverlay = (scene, camera) => {
    overlayPass = new RenderPass(scene, camera);
    overlayPass.clear = false;
    composer.insertPass(overlayPass, 2);
  };
  composer.addPass(fx);
  composer.addPass(new OutputPass());

  const resize = (width, height) => {
    renderer.setSize(width, height);
    composer.setSize(width, height);
    bloom.resolution.set(width, height);
    fx.uniforms.uResolution.value.set(
      width * renderer.getPixelRatio(),
      height * renderer.getPixelRatio(),
    );
  };

  const render = (scene, camera, settings) => {
    scenePass.scene = scene;
    scenePass.camera = camera;
    bloom.strength = settings.bloom;
    bloom.threshold = settings.threshold;
    const uniforms = fx.uniforms;
    uniforms.uTime.value = settings.time;
    uniforms.uChroma.value = settings.chroma;
    uniforms.uGlitch.value = settings.glitch;
    uniforms.uFlash.value = settings.flash;
    uniforms.uInvert.value = settings.invert;
    uniforms.uPunch.value = settings.punch;
    uniforms.uMotion.value = settings.motion ?? 1;
    composer.render();
  };

  return { renderer, resize, render, addOverlay };
}

// Soft additive points with a color and a scale per point
export function pointsMaterial(size = 1) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: size },
      uPixelRatio: { value: Math.min(devicePixelRatio, 2) },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aScale;
      uniform float uSize;
      uniform float uPixelRatio;
      varying vec3 vColor;
      void main() {
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * aScale * uPixelRatio * (300.0 / max(0.1, -mv.z));
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        a *= a;
        gl_FragColor = vec4(vColor * a * 1.5 * uOpacity, a * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// Points geometry with `count` points and writable position, color, and scale
export function pointsGeometry(count) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(count * 3), 3),
  );
  geometry.setAttribute(
    'aColor',
    new THREE.BufferAttribute(new Float32Array(count * 3), 3),
  );
  geometry.setAttribute(
    'aScale',
    new THREE.BufferAttribute(new Float32Array(count).fill(1), 1),
  );
  return geometry;
}

// Random helpers seeded per part, so every run looks the same
export function random(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (min, max) => min + next() * (max - min);
  next.inSphere = (radius, target = new THREE.Vector3()) => {
    do {
      target.set(next() * 2 - 1, next() * 2 - 1, next() * 2 - 1);
    } while (target.lengthSq() > 1);
    return target.multiplyScalar(radius);
  };
  next.onSphere = (radius, target = new THREE.Vector3()) =>
    next.inSphere(1, target).normalize().multiplyScalar(radius);
  return next;
}

export const clamp01 = (value) => Math.min(1, Math.max(0, value));
export const easeOutExpo = (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p));
export const easeInOutCubic = (p) =>
  p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;

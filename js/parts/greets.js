// SPDX-FileCopyrightText: 2026 Thomas Steiner
// SPDX-License-Identifier: Apache-2.0

import * as THREE from 'three';
import { clamp01 } from '../engine.js';
import { BAR } from '../music.js';
import { BG, ENGINE, FONT_DISPLAY } from '../palette.js';
import { canvasTexture } from '../text.js';

const SCROLL_BARS = 12;

const plasma = {
  uniforms: {
    uTime: { value: 0 },
    uKick: { value: 0 },
    uFade: { value: 1 },
    uAspect: { value: 1 },
    uBg: { value: new THREE.Color(BG) },
    uBlink: { value: new THREE.Color(ENGINE.blink) },
    uGecko: { value: new THREE.Color(ENGINE.gecko) },
    uWebkit: { value: new THREE.Color(ENGINE.webkit) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform float uKick;
    uniform float uFade;
    uniform float uAspect;
    uniform vec3 uBg;
    uniform vec3 uBlink;
    uniform vec3 uGecko;
    uniform vec3 uWebkit;
    varying vec2 vUv;

    void main() {
      vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 4.0;
      float t = uTime * 0.6;
      float v = sin(p.x * 1.3 + t)
        + sin((p.y * 1.7 + t) * 0.8)
        + sin((p.x + p.y) * 1.1 + t * 1.3)
        + sin(length(p - vec2(sin(t) * 2.0, cos(t * 0.7) * 2.0)) * 1.8);
      v = v * 0.25 + 0.5;
      vec3 color = mix(uBlink, uWebkit, smoothstep(0.2, 0.6, v));
      color = mix(color, uGecko, smoothstep(0.6, 0.95, v));
      color = mix(uBg, color, 0.16 + uKick * 0.1);

      // Copper bars, one per engine
      vec3 bars[3];
      bars[0] = uBlink;
      bars[1] = uGecko;
      bars[2] = uWebkit;
      for (int i = 0; i < 3; i++) {
        float center = 0.62 + sin(uTime * 1.7 + float(i) * 2.1) * 0.25;
        float d = abs(vUv.y - center) / 0.035;
        float bar = clamp(1.0 - d, 0.0, 1.0);
        color = mix(color, bars[i] * (0.3 + 0.9 * bar * bar), smoothstep(0.0, 0.25, bar));
      }
      gl_FragColor = vec4(color * uFade, 1.0);
    }
  `,
};

export function createGreets({ stats }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  const material = new THREE.ShaderMaterial({ ...plasma, depthWrite: false });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  backdrop.frustumCulled = false;
  scene.add(backdrop);

  const orgs = stats.orgs
    .slice(0, 8)
    .map(({ name, count }) => `${name} (${count})`)
    .join(' · ');
  const groups = stats.groups
    .slice(0, 10)
    .map(({ name, count }) => `${name} (${count})`)
    .join(' · ');
  const message =
    `GREETINGS TO ${orgs} ··· AND TO ${groups} ··· ` +
    `AND EVERY EDITOR OF ${stats.total} SPECS ··· ` +
    'DATA: BROWSER-SPECS · WEBREF · BROWSER-COMPAT-DATA · MDN · CAN I USE · ' +
    'WEB PLATFORM TESTS · WEB-FEATURES ··· MUSIC AND VOICES SYNTHESIZED LIVE IN YOUR BROWSER ···';
  const text = message.toUpperCase();

  // The sine scroller redraws onto a strip canvas every frame
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const texture = canvasTexture(canvas);
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  strip.position.set(0, -0.42, 1);
  scene.add(strip);
  let advances = [];
  let fontPx = 0;
  let textWidth = 0;
  const layout = (width, height) => {
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height * 0.34));
    fontPx = Math.round(canvas.height * 0.36);
    ctx.font = `900 ${fontPx}px ${FONT_DISPLAY}`;
    advances = [...text].map((char) => ctx.measureText(char).width);
    textWidth = advances.reduce((a, b) => a + b, 0);
    // Reallocate the GPU texture at the new size
    texture.dispose();
  };

  const greet = stats.orgs
    .slice(0, 5)
    .map(({ name }) => name)
    .join(', ');
  const cues = [
    {
      from: 12.2,
      to: 16,
      at: 'center',
      lines: [
        { text: 'AWESOME', size: 0.14 },
        { text: 'BROWSER SPECS', size: 0.14 },
        {
          text: 'PRESS R TO REPLAY',
          size: 0.026,
          font: 'mono',
          color: '#c9cdf0',
        },
      ],
    },
  ];
  const voice = [
    { at: 0.3, text: `Greetings to ${greet}` },
    {
      at: 6.3,
      text: `And every editor of ${stats.total} specs`,
      style: 'name',
    },
    { at: 12.4, text: 'Awesome browser specs' },
  ];

  let size = { width: 0, height: 0 };
  return {
    scene,
    camera,
    cues,
    voice,
    update({ lb, lt, kick, aspect, viewport }) {
      if (viewport.width !== size.width || viewport.height !== size.height) {
        size = viewport;
        layout(
          viewport.width * viewport.pixelRatio,
          viewport.height * viewport.pixelRatio,
        );
        camera.left = -aspect;
        camera.right = aspect;
        camera.updateProjectionMatrix();
        strip.scale.set(aspect * 2, 0.68, 1);
      }
      const fade = 1 - clamp01((lb - 11.5) / 1);
      material.uniforms.uTime.value = lt;
      material.uniforms.uKick.value = kick;
      material.uniforms.uFade.value = 0.15 + 0.85 * fade;
      material.uniforms.uAspect.value = aspect;

      // Scroll the whole message across before the logo
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (fade > 0) {
        const speed = (textWidth + canvas.width) / (SCROLL_BARS * BAR);
        let x = canvas.width - lt * speed;
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0.2, '#ffffff');
        gradient.addColorStop(0.55, '#ffd54a');
        gradient.addColorStop(0.85, '#ff7a3d');
        ctx.fillStyle = gradient;
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = fade;
        for (let i = 0; i < advances.length; i++) {
          if (x > -fontPx && x < canvas.width) {
            const y =
              canvas.height / 2 +
              Math.sin(x * 0.006 + lt * 3) * canvas.height * 0.22;
            ctx.fillText(text[i], x, y);
          }
          x += advances[i];
        }
        ctx.globalAlpha = 1;
      }
      texture.needsUpdate = true;
    },
    fx({ kick }) {
      return { bloom: 0.5, threshold: 0.75, chroma: 0.003 + kick * 0.008 };
    },
  };
}

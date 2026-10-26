// SPDX-FileCopyrightText: 2026 Thomas Steiner
// SPDX-License-Identifier: Apache-2.0

import * as THREE from 'three';
import {
  clamp01,
  easeOutExpo,
  pointsGeometry,
  pointsMaterial,
  random,
} from '../engine.js';
import { BAR } from '../music.js';
import { BG, ENGINE, HEAT } from '../palette.js';
import { textMesh } from '../text.js';

// Greetings slam in one per half bar, from local bar FIRST on
const FIRST = 1;
const SLOT = 0.5;
const STARS = 1400;
const SPARKS = 500;
const COLORS = [ENGINE.blink, ENGINE.gecko, ENGINE.webkit, HEAT[2], HEAT[3]];

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
      color = mix(uBg, color, 0.07 + uKick * 0.06);

      // Copper bars, one per engine
      vec3 bars[3];
      bars[0] = uBlink;
      bars[1] = uGecko;
      bars[2] = uWebkit;
      for (int i = 0; i < 3; i++) {
        // Above and below the greetings, never across them
        float side = mod(float(i), 2.0) * 2.0 - 1.0;
        float center = 0.5 + side * (0.36 + sin(uTime * 1.7 + float(i) * 2.1) * 0.08);
        float d = abs(vUv.y - center) / 0.035;
        float bar = clamp(1.0 - d, 0.0, 1.0);
        color = mix(color, bars[i] * (0.2 + 0.6 * bar * bar), smoothstep(0.0, 0.25, bar));
      }
      gl_FragColor = vec4(color * uFade, 1.0);
    }
  `,
};

export function createGreets({ stats }) {
  const rand = random(474);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  camera.position.set(0, 0, 12);

  // The plasma and copper bars fill the screen behind everything
  const material = new THREE.ShaderMaterial({
    ...plasma,
    depthWrite: false,
    depthTest: false,
  });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  backdrop.frustumCulled = false;
  backdrop.renderOrder = -1;
  scene.add(backdrop);

  // A warp field that races with the wobble
  const stars = pointsGeometry(STARS);
  const starColor = new THREE.Color('#c9cdf0');
  const starZ = new Float32Array(STARS);
  for (let i = 0; i < STARS; i++) {
    const angle = rand() * Math.PI * 2;
    const radius = rand.range(4, 30);
    starZ[i] = rand.range(-200, 12);
    stars
      .getAttribute('position')
      .setXYZ(i, Math.cos(angle) * radius, Math.sin(angle) * radius, starZ[i]);
    stars
      .getAttribute('aColor')
      .setXYZ(i, starColor.r, starColor.g, starColor.b);
    stars.getAttribute('aScale').setX(i, rand.range(0.5, 1.5));
  }
  const starMaterial = pointsMaterial(0.12);
  scene.add(new THREE.Points(stars, starMaterial));

  // Sparks burst from every greeting as it lands
  const sparks = pointsGeometry(SPARKS);
  const sparkDirections = Array.from({ length: SPARKS }, () =>
    rand.onSphere(rand.range(4, 22)),
  );
  const sparkMaterial = pointsMaterial(0.3);
  scene.add(new THREE.Points(sparks, sparkMaterial));

  // The organizations first, then the working groups with the most specs
  const greetings = [
    ...stats.orgs.slice(0, 8).map((org) => ({ ...org, kind: 'org' })),
    ...stats.groups.slice(0, 10).map((group) => ({ ...group, kind: 'group' })),
  ].map(({ name, count, kind }, i) => {
    const color = COLORS[i % COLORS.length];
    const group = new THREE.Group();
    // Spell out the organization, abbreviate the group type
    const short = name
      .replace(/ Working Group$/, ' WG')
      .replace(/ Community Group$/, ' CG');
    const title = textMesh(short.toUpperCase(), { height: 3.2, color });
    const label = textMesh(`${count} SPECS`, {
      height: 0.9,
      font: 'mono',
      px: 96,
      color: '#ffffff',
    });
    label.position.y = -2.1;
    const ghost = textMesh(String(count), { height: 14, color, opacity: 0.16 });
    ghost.position.z = -6;
    group.add(ghost, title, label);
    group.visible = false;
    scene.add(group);
    return { name, kind, group, title, ghost, color: new THREE.Color(color) };
  });
  const last = FIRST + greetings.length * SLOT;

  const mono = (text, color = '#c9cdf0') => ({
    text,
    size: 0.024,
    font: 'mono',
    color,
  });
  const cues = [
    {
      from: 0.1,
      to: last,
      at: 'top-left',
      lines: [{ text: 'GREETINGS TO', size: 0.07 }],
    },
    {
      from: last + 0.1,
      to: 11.9,
      at: 'center',
      lines: [
        { text: `AND EVERY EDITOR OF ${stats.total} SPECS`, size: 0.07 },
        mono(
          'DATA: BROWSER-SPECS · WEBREF · BROWSER-COMPAT-DATA · MDN · CAN I USE',
        ),
        mono('WEB PLATFORM TESTS · WEB-FEATURES'),
        mono('MUSIC AND VOICES SYNTHESIZED LIVE IN YOUR BROWSER', HEAT[2]),
      ],
    },
  ];
  const voice = [
    { at: 0.2, text: 'Greetings to' },
    ...greetings
      .filter(({ kind }) => kind === 'org')
      .map(({ name }, i) => ({
        at: FIRST + i * SLOT + 0.02,
        text: name,
        style: 'name',
      })),
    { at: last + 0.2, text: `And every editor of ${stats.total} specs` },
    { at: 12.4, text: 'Awesome browser specs' },
  ];

  let flow = 0;
  let previous = 0;
  const color = new THREE.Color();
  return {
    scene,
    camera,
    cues,
    voice,
    update({ lb, lt, kick, bass, wobble, aspect }) {
      const dt = lt - previous;
      const step = dt >= 0 && dt < 0.5 ? dt : 0;
      flow = step ? flow + step * (1 + wobble.level * 4) : lt;
      previous = lt;

      const fade = 1 - clamp01((lb - 11.5) / 1);
      material.uniforms.uTime.value = flow;
      material.uniforms.uKick.value = kick;
      material.uniforms.uFade.value = 0.15 + 0.85 * fade;
      material.uniforms.uAspect.value = aspect;

      const speed = 30 + wobble.level * 120 + kick * 60;
      const positions = stars.getAttribute('position');
      for (let i = 0; i < STARS; i++) {
        starZ[i] += speed * step;
        if (starZ[i] > 12) {
          starZ[i] -= 212;
        }
        positions.setZ(i, starZ[i]);
      }
      positions.needsUpdate = true;
      starMaterial.uniforms.uSize.value = 0.12 + bass * 0.15;
      starMaterial.uniforms.uOpacity.value = fade;

      // The view at each greeting's distance, so long names fit the screen
      const slope = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const slot = Math.floor((lb - FIRST) / SLOT);
      greetings.forEach(({ group, title, ghost }, i) => {
        const s = (lb - FIRST - i * SLOT) / SLOT;
        group.visible = s >= 0 && s < 1.15;
        if (!group.visible) {
          return;
        }
        // Slam in, push slowly toward the camera, then fly past it
        const arrive = easeOutExpo(clamp01(s / 0.22));
        const leave = clamp01((s - 0.85) / 0.3) ** 2;
        group.position.z = -90 * (1 - arrive) + s * 2.5 + leave * 16;
        group.rotation.z = (1 - arrive) * (i % 2 ? 0.5 : -0.5);
        const distance = Math.max(1, 12 - group.position.z);
        const fit = Math.min(
          1,
          (distance * slope * aspect * 0.8) / title.userData.width,
        );
        title.scale.setScalar(fit * (1 + kick * 0.06));
        ghost.scale.setScalar(1 + kick * 0.15 + bass * 0.1);
        for (const child of group.children) {
          child.material.opacity =
            (child === ghost ? 0.16 : 1) * (1 - leave) * fade;
        }
      });

      // Sparks from the greeting that landed last
      const current = greetings[slot];
      const age = (lb - FIRST - slot * SLOT) * BAR - 0.08;
      const sparkPositions = sparks.getAttribute('position');
      const sparkColors = sparks.getAttribute('aColor');
      const burst = 1 - Math.exp(-Math.max(0, age) * 4);
      const glow = current && age > 0 ? Math.exp(-age * 2.5) : 0;
      if (current) {
        color.copy(current.color).multiplyScalar(glow * 1.5);
      }
      sparkDirections.forEach((direction, i) => {
        sparkPositions.setXYZ(
          i,
          direction.x * burst,
          direction.y * burst,
          direction.z * burst * 0.5,
        );
        sparkColors.setXYZ(i, color.r, color.g, color.b);
      });
      sparkPositions.needsUpdate = true;
      sparkColors.needsUpdate = true;

      camera.rotation.set(
        0,
        0,
        Math.sin(lt * 0.7) * 0.06 + wobble.level * 0.08,
      );
      camera.fov = 60 + kick * 5 + wobble.level * 6;
      camera.updateProjectionMatrix();
    },
    fx({ kick }) {
      return { bloom: 0.7, threshold: 0.6, chroma: 0.003 + kick * 0.008 };
    },
  };
}

// SPDX-FileCopyrightText: 2026 Thomas Steiner
// SPDX-License-Identifier: Apache-2.0

import * as THREE from 'three';
import {
  clamp01,
  easeInOutCubic,
  pointsGeometry,
  pointsMaterial,
  random,
} from '../engine.js';
import { BG, HEAT } from '../palette.js';
import { textCanvas } from '../text.js';

// Every spec is one particle, and together they spell out how many there are
function sampleText(text, count, rand) {
  const canvas = textCanvas(text, { font: 'display', px: 420 });
  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const hits = [];
  for (let y = 0; y < canvas.height; y += 3) {
    for (let x = 0; x < canvas.width; x += 3) {
      if (data[(y * canvas.width + x) * 4 + 3] > 140) {
        hits.push([x, y]);
      }
    }
  }
  const scale = 26 / canvas.width;
  return Array.from({ length: count }, () => {
    const [x, y] = hits[Math.floor(rand() * hits.length)];
    return new THREE.Vector3(
      (x - canvas.width / 2) * scale,
      (canvas.height / 2 - y) * scale,
      rand.range(-0.4, 0.4),
    );
  });
}

export function createIntro({ stats }) {
  const rand = random(641);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);

  const count = stats.total;
  const targets = sampleText(String(count), count, rand);
  const starts = targets.map(() => rand.onSphere(rand.range(40, 90)));
  const away = targets.map((target) =>
    target.clone().add(rand.onSphere(1)).normalize(),
  );
  const geometry = pointsGeometry(count);
  const colors = geometry.getAttribute('aColor');
  const scales = geometry.getAttribute('aScale');
  stats.specs.forEach((spec, i) => {
    const color = new THREE.Color(HEAT[spec.bucket]);
    colors.setXYZ(i, color.r, color.g, color.b);
    scales.setX(i, rand.range(0.8, 1.6));
  });
  const material = pointsMaterial(0.55);
  scene.add(new THREE.Points(geometry, material));

  const dust = pointsGeometry(1500);
  const dustColor = new THREE.Color('#6d74b8');
  for (let i = 0; i < 1500; i++) {
    const p = rand.onSphere(rand.range(60, 200));
    dust.getAttribute('position').setXYZ(i, p.x, p.y, p.z);
    dust
      .getAttribute('aColor')
      .setXYZ(i, dustColor.r, dustColor.g, dustColor.b);
    dust.getAttribute('aScale').setX(i, rand.range(0.5, 1.5));
  }
  const dustPoints = new THREE.Points(dust, pointsMaterial(0.6));
  scene.add(dustPoints);

  const built = new Date(stats.sources.built);
  const builtText = Number.isNaN(built.getTime())
    ? ''
    : ` · BUILT ${built.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
  const origin = stats.origin === 'live' ? 'LIVE DATA' : 'SNAPSHOT DATA';
  const cues = [
    {
      from: 0.5,
      to: 7.6,
      at: 'top-left',
      lines: [
        { text: 'AWESOME BROWSER SPECS', size: 0.06 },
        {
          text: `${origin} · BROWSER-SPECS.GITHUB.IO${builtText}`,
          size: 0.022,
          font: 'mono',
          color: '#9aa0d0',
        },
      ],
    },
    {
      from: 3.5,
      to: 7.6,
      at: 'bottom',
      lines: [
        { text: 'SPECS RUN THE WEB PLATFORM', size: 0.034, font: 'mono' },
        {
          text: 'A DEMO IN EIGHT PARTS',
          size: 0.022,
          font: 'mono',
          color: '#9aa0d0',
        },
      ],
    },
  ];

  const voice = [
    { at: 1, text: 'Awesome browser specs' },
    { at: 4.2, text: `${count} specs run the web platform` },
  ];

  const point = new THREE.Vector3();
  const positions = geometry.getAttribute('position');
  return {
    scene,
    camera,
    cues,
    voice,
    update({ lb, lt, kick, bass }) {
      const gather = easeInOutCubic(clamp01((lb - 0.25) / 3));
      const burst = clamp01((lb - 6.75) / 1.25) ** 3;
      for (let i = 0; i < count; i++) {
        // The riser before the drop makes every particle shiver harder
        const riser = clamp01((lb - 6) / 2) * 0.5;
        const wobble = (1 - gather) * 2 + 0.05 + riser + bass * 0.15;
        point
          .lerpVectors(starts[i], targets[i], gather)
          .addScaledVector(away[i], burst * 90);
        point.x += Math.sin(lt * 1.3 + i) * wobble;
        point.y += Math.cos(lt * 1.1 + i * 1.7) * wobble;
        positions.setXYZ(i, point.x, point.y, point.z);
      }
      positions.needsUpdate = true;
      material.uniforms.uSize.value = 0.55 + kick * 0.2 + bass * 0.35;
      material.uniforms.uOpacity.value = clamp01(lt / 2);
      dustPoints.rotation.y = lt * 0.02;
      camera.position.set(
        Math.sin(lt * 0.2) * 5,
        Math.sin(lt * 0.26) * 2,
        44 - gather * 10 + burst * 8,
      );
      camera.lookAt(0, 0, 0);
    },
    fx({ lb }) {
      return {
        bloom: 1.1 + clamp01((lb - 6) / 2) * 1.2,
        chroma: 0.002 + clamp01((lb - 6.5) / 1.5) * 0.02,
      };
    },
  };
}

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
import { ENGINES } from '../data.js';
import { BG, ENGINE, ENGINE_NAME, HEAT } from '../palette.js';
import { textMesh } from '../text.js';

const RADIUS = 8;

// Groups arrive one after another, four bars apart
const ARRIVAL = { 3: 0, 2: 4, 1: 8, none: 12, nodata: 12 };

export function createEngines({ stats }) {
  const rand = random(3);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);

  // Blink at the top, Gecko bottom left, WebKit bottom right
  const corners = {};
  ENGINES.forEach((engine, i) => {
    const angle = Math.PI / 2 + (i * Math.PI * 2) / 3;
    corners[engine] = new THREE.Vector3(
      Math.cos(angle) * RADIUS,
      Math.sin(angle) * RADIUS,
      0,
    );
  });

  const cores = ENGINES.map((engine) => {
    const group = new THREE.Group();
    const color = new THREE.Color(ENGINE[engine]);
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color, wireframe: true }),
    );
    const heart = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 24, 16),
      new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2) }),
    );
    group.add(shell, heart);
    group.position.copy(corners[engine]);
    const label = new THREE.Group();
    const name = textMesh(ENGINE_NAME[engine].toUpperCase(), {
      height: 1.6,
      color: ENGINE[engine],
    });
    const count = textMesh(`SHIPS ${stats.shippedBy[engine]} SPECS`, {
      height: 0.55,
      font: 'mono',
      px: 64,
      color: '#c9cdf0',
    });
    count.position.y = -0.95;
    label.add(name, count);
    label.position.copy(corners[engine]).multiplyScalar(1.38);
    scene.add(group, label);
    return { group, shell, label };
  });

  const specs = stats.specs;
  const starts = [];
  const targets = [];
  const geometry = pointsGeometry(specs.length);
  const colors = geometry.getAttribute('aColor');
  const scales = geometry.getAttribute('aScale');
  const delays = [];
  const baseColors = [];
  specs.forEach((spec, i) => {
    starts.push(rand.onSphere(rand.range(45, 75)));
    let target;
    let color;
    switch (spec.bucket) {
      case '3':
        target = rand.inSphere(2.4);
        color = new THREE.Color(HEAT[3]);
        break;
      case '2': {
        const [a, b] = spec.engines;
        target = corners[a]
          .clone()
          .add(corners[b])
          .multiplyScalar(0.5 * 0.8)
          .add(rand.inSphere(1.1));
        color = new THREE.Color(ENGINE[a]).lerp(
          new THREE.Color(ENGINE[b]),
          0.5,
        );
        break;
      }
      case '1':
        target = corners[spec.engines[0]]
          .clone()
          .multiplyScalar(0.7)
          .add(rand.inSphere(1.4));
        color = new THREE.Color(ENGINE[spec.engines[0]]);
        break;
      case 'none': {
        const angle = rand() * Math.PI * 2;
        target = new THREE.Vector3(
          Math.cos(angle) * 12.5,
          Math.sin(angle) * 12.5,
          rand.range(-0.5, 0.5),
        );
        color = new THREE.Color(HEAT.none);
        break;
      }
      default:
        target = rand.onSphere(rand.range(16, 22));
        color = new THREE.Color(HEAT.nodata);
    }
    targets.push(target);
    baseColors.push(color);
    delays.push(ARRIVAL[spec.bucket] + rand() * 1.2);
    colors.setXYZ(i, color.r, color.g, color.b);
    scales.setX(i, spec.bucket === 'nodata' ? 0.9 : 1.4);
  });
  const material = pointsMaterial(0.5);
  scene.add(new THREE.Points(geometry, material));

  // A beam from every spec to each engine that ships it
  const links = [];
  specs.forEach((spec, i) => {
    for (const engine of spec.engines) {
      links.push([i, engine]);
    }
  });
  const lineGeometry = new THREE.BufferGeometry();
  const linePositions = new Float32Array(links.length * 6);
  const lineColors = new Float32Array(links.length * 6);
  lineGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(linePositions, 3),
  );
  lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));
  const lines = new THREE.LineSegments(
    lineGeometry,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.07,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  scene.add(lines);

  const pairText = stats.pairs
    .map(
      ({ engines, count }) =>
        `${engines.map((engine) => ENGINE_NAME[engine].toUpperCase()).join('+')} ${count}`,
    )
    .join(' · ');
  const onlyRuns = ENGINES.flatMap((engine, i) => [
    [
      `${ENGINE_NAME[engine].toUpperCase()} ${stats.only[engine].length}`,
      ENGINE[engine],
    ],
    ...(i < ENGINES.length - 1 ? [[' · ', '#c9cdf0']] : []),
  ]);
  const { buckets } = stats;
  const mono = (text, color = '#c9cdf0') => ({
    text,
    size: 0.026,
    font: 'mono',
    color,
  });
  const big = (text, color = '#fff') => ({ text, size: 0.2, color });
  const cues = [
    {
      from: 0.25,
      to: 3.9,
      at: 'left',
      lines: [
        big(String(buckets[3])),
        mono('SPECS SHIP IN ALL THREE ENGINES', '#fff'),
      ],
    },
    {
      from: 4.25,
      to: 7.9,
      at: 'left',
      lines: [
        big(String(buckets[2]), HEAT[2]),
        mono('SHIP IN TWO', '#fff'),
        mono(pairText),
      ],
    },
    {
      from: 8.25,
      to: 11.9,
      at: 'left',
      lines: [
        big(String(buckets[1]), HEAT[1]),
        mono('SHIP IN JUST ONE', '#fff'),
        mono(onlyRuns),
      ],
    },
    {
      from: 12.25,
      to: 15.9,
      at: 'left',
      lines: [
        big(String(buckets.none + buckets.nodata), HEAT.none),
        mono('SHIP NOWHERE OR ARE UNTRACKED', '#fff'),
        mono(`${buckets.none} IN NO ENGINE · ${buckets.nodata} WITHOUT DATA`),
      ],
    },
  ];

  const voice = [
    { at: 0.3, text: `${buckets[3]} specs ship in all three engines` },
    { at: 2.3, text: 'Blink. Gecko. WebKit.', style: 'name' },
    { at: 4.3, text: `${buckets[2]} ship in two` },
    { at: 8.3, text: `${buckets[1]} ship in just one` },
    {
      at: 10.3,
      text: ENGINES.map(
        (engine) => `${ENGINE_NAME[engine]} ${stats.only[engine].length}`,
      ).join('. '),
      style: 'name',
    },
    {
      at: 12.3,
      text: `${buckets.none + buckets.nodata} ship nowhere or are untracked`,
    },
  ];

  const positions = geometry.getAttribute('position');
  const point = new THREE.Vector3();
  const arrived = new Float32Array(specs.length);
  return {
    scene,
    camera,
    cues,
    voice,
    update({ lb, lt, kick, snare, wobble, bass }) {
      const swell = 1 + kick * 0.06 + wobble.level * 0.1;
      for (let i = 0; i < specs.length; i++) {
        const p = easeOutExpo(clamp01((lb - delays[i]) / 1.6));
        arrived[i] = p;
        point.lerpVectors(starts[i], targets[i], p);
        point.multiplyScalar(1 + (swell - 1) * p);
        point.x += Math.sin(lt * 0.9 + i) * 0.08;
        point.y += Math.cos(lt * 0.7 + i * 1.3) * 0.08;
        positions.setXYZ(i, point.x, point.y, point.z);
        const glow = 0.25 + 0.75 * p;
        const color = baseColors[i];
        colors.setXYZ(i, color.r * glow, color.g * glow, color.b * glow);
      }
      positions.needsUpdate = true;
      colors.needsUpdate = true;

      links.forEach(([i, engine], k) => {
        const p = arrived[i];
        const corner = corners[engine];
        const color = baseColors[i];
        const fade = p * p * (0.6 + snare * 0.8 + wobble.level * 0.8);
        linePositions.set(
          [
            positions.getX(i),
            positions.getY(i),
            positions.getZ(i),
            corner.x,
            corner.y,
            corner.z,
          ],
          k * 6,
        );
        lineColors.set(
          [
            color.r * fade,
            color.g * fade,
            color.b * fade,
            color.r * fade * 0.3,
            color.g * fade * 0.3,
            color.b * fade * 0.3,
          ],
          k * 6,
        );
      });
      lineGeometry.attributes.position.needsUpdate = true;
      lineGeometry.attributes.color.needsUpdate = true;

      cores.forEach(({ group, shell, label }, i) => {
        group.scale.setScalar(1 + kick * 0.45 + bass * 0.25);
        shell.rotation.set(lt * 0.8 + i, lt * 1.2 + wobble.level, 0);
        label.quaternion.copy(camera.quaternion);
      });

      const distance = 34 + clamp01((lb - 12) / 2) * 12;
      const swing = Math.sin(lt * 0.28) * 0.6;
      camera.position.set(
        Math.sin(swing) * distance,
        Math.sin(lt * 0.4) * 4,
        Math.cos(swing) * distance,
      );
      camera.lookAt(-4, 0, 0);
      camera.fov = 50 - kick * 3;
      camera.updateProjectionMatrix();
    },
    fx({ kick }) {
      return { bloom: 0.75, threshold: 0.5, chroma: 0.003 + kick * 0.006 };
    },
  };
}

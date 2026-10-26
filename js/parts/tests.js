// SPDX-FileCopyrightText: 2026 Thomas Steiner
// SPDX-License-Identifier: Apache-2.0

import * as THREE from 'three';
import { clamp01, easeInOutCubic, easeOutExpo } from '../engine.js';
import { BROWSERS } from '../data.js';
import { BG, BROWSER_ENGINE, ENGINE, HEAT } from '../palette.js';

const COLUMNS = 20;
const CELL = 1.6;
const HEIGHT = 9;

const format = (value) => `${Math.round(value * 10) / 10}%`;

// Low interop burns red, full interop glows white
function interopColor(value, target) {
  const low = new THREE.Color(HEAT.none);
  const mid = new THREE.Color(HEAT[2]);
  const high = new THREE.Color(HEAT[3]);
  const p = value / 100;
  return p < 0.6
    ? target.copy(low).lerp(mid, p / 0.6)
    : target.copy(mid).lerp(high, (p - 0.6) / 0.4);
}

export function createTests({ stats }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 18, 55);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  scene.add(new THREE.HemisphereLight('#8a90ff', '#120c20', 1.6));
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.position.set(-6, 14, 8);
  scene.add(sun);

  const { tested, median, medianInterop, perfect, worst } = stats.wpt;
  const rows = Math.ceil(tested.length / COLUMNS);

  // Three thin towers per spec, one per browser
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  const towers = new THREE.InstancedMesh(
    box,
    new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.2 }),
    tested.length * 3,
  );
  // A white slab marks each spec's interop level
  const slabs = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CELL * 0.86, 0.08, CELL * 0.86),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(HEAT[3]).multiplyScalar(1.1),
      transparent: true,
      opacity: 0,
      toneMapped: false,
    }),
    tested.length,
  );
  scene.add(towers, slabs);

  const cells = tested.map((spec, i) => {
    const column = i % COLUMNS;
    const row = Math.floor(i / COLUMNS);
    return {
      spec,
      column,
      row,
      x: (column - (COLUMNS - 1) / 2) * CELL,
      z: ((rows - 1) / 2 - row) * CELL,
    };
  });

  const grid = new THREE.GridHelper(120, 75, '#3b2f8a', '#1c1640');
  grid.position.y = -0.01;
  scene.add(grid);

  const browserRuns = BROWSERS.flatMap((browser, i) => [
    [
      `${browser.toUpperCase()} ${format(median[browser])}`,
      ENGINE[BROWSER_ENGINE[browser]],
    ],
    ...(i < BROWSERS.length - 1 ? [[' · ', '#c9cdf0']] : []),
  ]);
  const mono = (text, color = '#c9cdf0') => ({
    text,
    size: 0.026,
    font: 'mono',
    color,
  });
  const big = (text, color = '#fff') => ({ text, size: 0.2, color });
  const revision = stats.sources.wpt
    ? `WPT ${stats.sources.wpt.revision} · ${stats.sources.wpt.date}`
    : 'WEB PLATFORM TESTS';
  const cues = [
    {
      from: 0.25,
      to: 3.9,
      at: 'left',
      lines: [
        big(String(tested.length)),
        mono('SPECS RUN WEB PLATFORM TESTS', '#fff'),
        mono(revision),
      ],
    },
    {
      from: 4.25,
      to: 7.9,
      at: 'left',
      lines: [
        big(format(medianInterop), HEAT[2]),
        mono('MEDIAN INTEROP', '#fff'),
        mono('TESTS THAT PASS IN ALL THREE BROWSERS'),
      ],
    },
    {
      from: 8.25,
      to: 11.9,
      at: 'left',
      lines: [
        { text: 'ALONE, EACH DOES BETTER', size: 0.08 },
        mono('MEDIAN PASS RATE PER BROWSER', '#fff'),
        mono(browserRuns),
      ],
    },
    {
      from: 12.25,
      to: 15.9,
      at: 'left',
      lines: [
        big(String(perfect)),
        mono('SPECS AT 100% INTEROP', '#fff'),
        mono(
          `LOWEST: ${worst.title.toUpperCase()} AT ${format(worst.interop)}`,
        ),
      ],
    },
  ];
  const voice = [
    { at: 0.3, text: `${tested.length} specs run web platform tests` },
    { at: 4.3, text: `Median interop: ${Math.round(medianInterop)} percent` },
    { at: 8.3, text: 'Chrome. Firefox. Safari.', style: 'name' },
    { at: 12.3, text: `${perfect} specs at 100 percent interop` },
    { at: 14.3, text: `Lowest: ${worst.title}`, style: 'name' },
  ];

  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const engineColors = BROWSERS.map(
    (browser) => new THREE.Color(ENGINE[BROWSER_ENGINE[browser]]),
  );
  const width = (CELL * 0.86) / 3;
  return {
    scene,
    camera,
    cues,
    voice,
    update({ lb, lt, kick, fft }) {
      const split = easeInOutCubic(clamp01((lb - 7.5) / 1.5));
      cells.forEach(({ spec, column, row, x, z }, i) => {
        const rise = easeOutExpo(clamp01((lb - row * 0.12) / 1.2));
        const level = fft ? fft[2 + (column % 40)] / 255 : 0;
        BROWSERS.forEach((browser, b) => {
          const value = spec.wpt[browser] ?? 0;
          const height =
            Math.max(
              0.05,
              (spec.interop + (value - spec.interop) * split) / 100,
            ) *
            HEIGHT *
            rise;
          matrix.makeScale(width * 0.9, height, CELL * 0.86);
          matrix.setPosition(x + (b - 1) * width, 0, z);
          towers.setMatrixAt(i * 3 + b, matrix);
          interopColor(spec.interop, color).lerp(engineColors[b], split);
          color.multiplyScalar(0.7 + level * 0.9 + kick * 0.2);
          towers.setColorAt(i * 3 + b, color);
        });
        matrix.makeTranslation(
          x,
          (spec.interop / 100) * HEIGHT * rise + 0.04,
          z,
        );
        slabs.setMatrixAt(i, matrix);
      });
      towers.instanceMatrix.needsUpdate = true;
      towers.instanceColor.needsUpdate = true;
      slabs.instanceMatrix.needsUpdate = true;
      slabs.material.opacity = split * 0.9;

      // Fly from the least interoperable rows to the most
      const p = lb / 16;
      const front = ((rows - 1) / 2) * CELL;
      camera.position.set(
        Math.sin(lt * 0.2) * 6,
        14 + Math.sin(lt * 0.3) * 1.5,
        front + 16 - p * (front * 2 + 6),
      );
      camera.lookAt(0, 1, camera.position.z - 12);
    },
    fx({ kick }) {
      return { bloom: 0.8, threshold: 0.55, chroma: 0.003 + kick * 0.006 };
    },
  };
}

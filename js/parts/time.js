// SPDX-FileCopyrightText: 2026 Thomas Steiner
// SPDX-License-Identifier: Apache-2.0

import * as THREE from 'three';
import { pointsGeometry, pointsMaterial, random } from '../engine.js';
import { BG, HEAT } from '../palette.js';
import { textMesh } from '../text.js';

const GAP = 1.2;
const STREAK = 3;
const MONTHS = 'JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split(' ');

export function createTime({ stats }) {
  const rand = random(1995);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.FogExp2(BG, 0.012);
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 300);

  // Specs ordered by their last update, one star each along the flight path
  const { dated, years } = stats;
  const depth = dated.length * GAP;
  const geometry = pointsGeometry(dated.length);
  const streaks = new Float32Array(dated.length * 6);
  const streakColors = new Float32Array(dated.length * 6);
  const point = new THREE.Vector3();
  dated.forEach((spec, i) => {
    const angle = rand() * Math.PI * 2;
    const radius = rand.range(3, 13);
    point.set(Math.cos(angle) * radius, Math.sin(angle) * radius, -i * GAP);
    geometry.getAttribute('position').setXYZ(i, point.x, point.y, point.z);
    const color = new THREE.Color(HEAT[spec.bucket]);
    geometry.getAttribute('aColor').setXYZ(i, color.r, color.g, color.b);
    geometry.getAttribute('aScale').setX(i, rand.range(1, 2));
    streaks.set(
      [point.x, point.y, point.z, point.x, point.y, point.z + STREAK],
      i * 6,
    );
    streakColors.set([color.r, color.g, color.b, 0, 0, 0], i * 6);
  });
  scene.add(new THREE.Points(geometry, pointsMaterial(0.2)));
  const streakGeometry = new THREE.BufferGeometry();
  streakGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(streaks, 3),
  );
  streakGeometry.setAttribute(
    'color',
    new THREE.BufferAttribute(streakColors, 3),
  );
  scene.add(
    new THREE.LineSegments(
      streakGeometry,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    ),
  );

  // A gate wherever a new year starts, and every month of the latest year
  const latestYear = years.at(-1)?.name;
  const markers = [];
  let previous = '';
  dated.forEach((spec, i) => {
    const year = spec.updated.slice(0, 4);
    const month = spec.updated.slice(5, 7);
    let label = null;
    if (year !== previous.slice(0, 4)) {
      label = year;
    } else if (year === latestYear && month !== previous.slice(5, 7)) {
      label = `${MONTHS[Number(month) - 1]} ${year}`;
    }
    previous = spec.updated;
    if (label) {
      const mesh = textMesh(label, {
        height: label.length > 4 ? 2.4 : 4,
        opacity: 0.55,
        color: '#c9cdf0',
      });
      mesh.position.set(
        markers.length % 2 ? 5 : -5,
        rand.range(-2, 2),
        -i * GAP + 0.5,
      );
      scene.add(mesh);
      markers.push(mesh);
    }
  });

  const oldest = dated[0];
  const latest = dated.at(-1);
  const count = (year) => years.find(({ name }) => name === year)?.count ?? 0;
  const previousYear = String(Number(latestYear) - 1);
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
        { text: 'OLDEST', size: 0.08, color: HEAT.nodata },
        mono(oldest.title.toUpperCase(), '#fff'),
        mono(`LAST UPDATED ${oldest.updated}`),
      ],
    },
    {
      from: 4.25,
      to: 7.9,
      at: 'left',
      lines: [
        big(String(dated.length)),
        mono('SPECS, ORDERED BY LAST UPDATE', '#fff'),
        mono(`${stats.undated} MORE CARRY NO DATE`),
      ],
    },
    {
      from: 8.25,
      to: 11.9,
      at: 'left',
      lines: [
        big(String(count(previousYear)), HEAT[1]),
        mono(`UPDATED IN ${previousYear}`, '#fff'),
      ],
    },
    {
      from: 12.25,
      to: 15.9,
      at: 'left',
      lines: [
        big(String(count(latestYear)), HEAT[2]),
        mono(`UPDATED IN ${latestYear}`, '#fff'),
        mono(`LATEST: ${latest.title.toUpperCase()} · ${latest.updated}`),
      ],
    },
  ];
  const voice = [
    { at: 0.3, text: `Oldest: ${oldest.title}` },
    { at: 4.3, text: `${dated.length} specs, ordered by last update` },
    { at: 8.3, text: `${count(previousYear)} updated in ${previousYear}` },
    { at: 12.3, text: `${count(latestYear)} updated in ${latestYear}` },
    { at: 14.3, text: latest.title, style: 'name' },
  ];

  return {
    scene,
    camera,
    cues,
    voice,
    update({ lb, lt, kick }) {
      const z = 8 - (lb / 16) * (depth + 8);
      camera.position.set(
        Math.sin(lt * 0.3) * 1.5,
        Math.cos(lt * 0.25) * 1.5,
        z,
      );
      camera.rotation.set(0, 0, lt * 0.05);
      camera.fov = 75 + kick * 6;
      camera.updateProjectionMatrix();
      for (const mesh of markers) {
        mesh.quaternion.copy(camera.quaternion);
      }
    },
    fx({ kick }) {
      return { bloom: 1.3, chroma: 0.004 + kick * 0.01 };
    },
  };
}

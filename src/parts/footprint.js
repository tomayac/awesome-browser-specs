// SPDX-FileCopyrightText: 2026 Thomas Steiner
// SPDX-License-Identifier: Apache-2.0

import * as THREE from 'three';
import { clamp01 } from '../engine.js';
import { BG, HEAT } from '../palette.js';
import { textMesh } from '../text.js';

const SPACING = 7;
const BARS_EACH = 2;

const easeOutBack = (p) => {
  const c = 1.4;
  return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2;
};

export function createFootprint({ stats }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 14, 60);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  scene.add(new THREE.AmbientLight('#6a5cff', 0.4));
  const key = new THREE.DirectionalLight('#ffffff', 2);
  key.position.set(5, 12, 10);
  scene.add(key);
  const glow = new THREE.PointLight('#ff7a3d', 30, 30);
  scene.add(glow);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({
      color: '#07060f',
      roughness: 0.3,
      metalness: 0.8,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  const grid = new THREE.GridHelper(400, 200, '#2a2266', '#151033');
  grid.position.y = 0.01;
  scene.add(floor, grid);

  // The most referenced specs, tallest first
  const { referenced } = stats;
  const max = referenced[0]?.footprint || 1;
  const monoliths = referenced.map((spec, i) => {
    const height = 3 + (spec.footprint / max) * 13;
    const group = new THREE.Group();
    const geometry = new THREE.BoxGeometry(2.4, height, 0.6);
    geometry.translate(0, height / 2, 0);
    const slab = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: '#0d0b18',
        roughness: 0.25,
        metalness: 0.9,
      }),
    );
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: HEAT[spec.bucket],
        toneMapped: false,
      }),
    );
    edges.userData.color = new THREE.Color(HEAT[spec.bucket]);
    const title = textMesh(spec.title.toUpperCase(), {
      height: 1.5,
      color: '#8a90c8',
    });
    title.rotation.z = Math.PI / 2;
    // Run the title up the face and shrink it if it would overflow
    const fit = Math.min(1, (height - 2.2) / title.userData.width);
    title.scale.setScalar(fit);
    title.position.set(0.1, 1.9 + (title.userData.width * fit) / 2, 0.31);
    const rank = textMesh(`#${i + 1}`, {
      height: 1.1,
      font: 'mono',
      px: 96,
      color: '#8a90c8',
    });
    rank.position.set(0, 0.8, 0.31);
    group.add(slab, edges, title, rank);
    group.position.set(i * SPACING, 0, i % 2 ? -3 : 0);
    scene.add(group);
    return { group, edges };
  });

  const cues = [
    {
      from: 0.1,
      to: 15.9,
      at: 'top-left',
      lines: [
        { text: 'MOST REFERENCED', size: 0.07 },
        {
          text: 'PLATFORM FOOTPRINT: HOW MANY OTHER SPECS POINT AT IT',
          size: 0.022,
          font: 'mono',
          color: '#c9cdf0',
        },
      ],
    },
    ...referenced.map((spec, i) => ({
      from: i * BARS_EACH + 0.25,
      to: i * BARS_EACH + 1.95,
      at: 'left',
      lines: [
        { text: `#${i + 1} ${spec.title.toUpperCase()}`, size: 0.08 },
        {
          text: `REFERENCED BY ${spec.footprint} SPECS`,
          size: 0.028,
          font: 'mono',
          color: HEAT[2],
        },
        {
          text: `${spec.mdn} MDN ARTICLES · ${spec.caniuse} CAN I USE FEATURES · ${spec.org}`,
          size: 0.022,
          font: 'mono',
          color: '#c9cdf0',
        },
      ],
    })),
  ];
  const voice = referenced.map((spec, i) => ({
    at: i * BARS_EACH + 0.3,
    text: i === 0 ? `Most referenced: ${spec.title}` : spec.title,
    style: i === 0 ? 'announcer' : 'name',
  }));

  return {
    scene,
    camera,
    cues,
    voice,
    update({ lb, lt, kick, bass, wobble }) {
      monoliths.forEach(({ group, edges }, i) => {
        const p = clamp01((lb - i * BARS_EACH) / 0.6);
        group.position.y = -40 * (1 - easeOutBack(p));
        group.visible = p > 0;
        // Edges flare as a monolith lands, then settle
        const fresh = clamp01(1 - (lb - i * BARS_EACH) / 2);
        edges.material.color
          .copy(edges.userData.color)
          .multiplyScalar(0.6 + fresh * 1.6 + kick * 1.2 + wobble.level * 0.6);
        group.rotation.y = Math.sin(lt * 0.6 + i) * 0.12;
        group.scale.y = 1 + kick * 0.04;
      });
      const focus = Math.min(lb / BARS_EACH, monoliths.length - 1);
      // Keep the newest monolith right of center, clear of the captions
      const x = focus * SPACING;
      camera.position.set(
        x - 9 + Math.sin(lt * 0.4) * 2.5,
        5 + Math.sin(lt * 0.3) * 1.8,
        24,
      );
      camera.lookAt(x - 4, 7, 0);
      glow.position.set(x + 2, 2, 4);
      glow.intensity = 12 + kick * 40 + bass * 30;
    },
    fx({ kick }) {
      return { bloom: 0.9, threshold: 0.6, chroma: 0.003 + kick * 0.007 };
    },
  };
}

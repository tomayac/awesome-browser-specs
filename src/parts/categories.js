// SPDX-FileCopyrightText: 2026 Thomas Steiner
// SPDX-License-Identifier: Apache-2.0

import * as THREE from 'three';
import { BUCKETS } from '../data.js';
import { BG, FONT_MONO, HEAT } from '../palette.js';
import { canvasTexture, textMesh } from '../text.js';

const TUNNEL_RADIUS = 7;
const TUNNEL_LENGTH = 300;
const REPEAT = new THREE.Vector2(2, 6);
const BAR_LENGTH = 34;

// Every spec title, written around the tunnel wall in its heat color
function titleAtlas(specs) {
  const canvas = document.createElement('canvas');
  canvas.width = 4096;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = `700 30px ${FONT_MONO}`;
  ctx.textBaseline = 'middle';
  const rowHeight = 44;
  let index = 0;
  for (let y = rowHeight / 2; y < canvas.height; y += rowHeight) {
    let x = 12 - Math.random() * 300;
    while (x < canvas.width) {
      const spec = specs[index++ % specs.length];
      const text = `${spec.title.toUpperCase()}  //  `;
      ctx.fillStyle = HEAT[spec.bucket];
      ctx.globalAlpha = spec.bucket === 'nodata' ? 0.6 : 0.85;
      ctx.fillText(text, x, y);
      x += ctx.measureText(text).width;
    }
  }
  return canvas;
}

function gate(category) {
  const group = new THREE.Group();
  const total = category.count;
  const gap = 0.03;
  let start = Math.PI / 2;
  for (const bucket of BUCKETS) {
    const count = category.buckets[bucket];
    if (!count) {
      continue;
    }
    const length = (count / total) * Math.PI * 2;
    const segment = new THREE.Mesh(
      new THREE.RingGeometry(
        4.1,
        5.3,
        Math.max(4, Math.ceil(length * 20)),
        1,
        start + gap / 2,
        Math.max(0.01, length - gap),
      ),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(HEAT[bucket]).multiplyScalar(0.6),
        side: THREE.DoubleSide,
        transparent: true,
      }),
    );
    group.add(segment);
    start += length;
  }
  const name = textMesh(category.name.toUpperCase(), { height: 1.25 });
  name.position.y = 0.45;
  const count = textMesh(`${category.count} SPECS`, {
    height: 0.6,
    font: 'mono',
    px: 72,
    color: '#c9cdf0',
  });
  count.position.y = -0.55;
  // Long names shrink to stay inside the ring
  const fit = Math.min(1, 7 / name.userData.width);
  name.scale.setScalar(fit);
  group.add(name, count);
  return group;
}

export function createCategories({ stats }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.FogExp2(BG, 0.03);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 300);

  const atlas = canvasTexture(titleAtlas(stats.specs));
  atlas.wrapS = THREE.RepeatWrapping;
  atlas.wrapT = THREE.RepeatWrapping;
  // Seen from inside the cylinder, the texture would read mirrored
  atlas.repeat.set(-REPEAT.x, REPEAT.y);
  const wall = new THREE.MeshBasicMaterial({
    map: atlas,
    side: THREE.BackSide,
    color: new THREE.Color(0.5, 0.5, 0.5),
  });
  const tunnelGeometry = new THREE.CylinderGeometry(
    TUNNEL_RADIUS,
    TUNNEL_RADIUS,
    TUNNEL_LENGTH,
    64,
    1,
    true,
  );
  tunnelGeometry.rotateX(-Math.PI / 2);
  const tunnel = new THREE.Mesh(tunnelGeometry, wall);
  scene.add(tunnel);

  const shown = stats.categories.slice(0, 16);
  const gates = shown.map((category) => {
    const group = gate(category);
    scene.add(group);
    return group;
  });

  const legend = [
    ['■ ALL THREE  ', HEAT[3]],
    ['■ TWO  ', HEAT[2]],
    ['■ ONE  ', HEAT[1]],
    ['■ NONE  ', HEAT.none],
    ['■ NO DATA', HEAT.nodata],
  ];
  const cues = [
    {
      from: 0.1,
      to: 3.4,
      at: 'top-left',
      lines: [
        { text: `${stats.categories.length} CATEGORIES`, size: 0.09 },
        {
          text: 'EACH RING SPLITS ONE BY HOW MANY ENGINES SHIP ITS SPECS',
          size: 0.024,
          font: 'mono',
          color: '#c9cdf0',
        },
      ],
    },
    {
      from: 0.1,
      to: 15.9,
      at: 'bottom-left',
      lines: [{ text: legend, size: 0.024, font: 'mono' }],
    },
  ];

  // Name each category just before its ring flies past
  const voice = shown.map((category, i) => ({
    at: i + 0.55,
    text: category.name,
    style: 'name',
  }));

  return {
    scene,
    camera,
    cues,
    voice,
    update({ lb, lt, kick, snare, wobble, bass }) {
      const travelled = lb * BAR_LENGTH;
      atlas.offset.y = (travelled * REPEAT.y) / TUNNEL_LENGTH;
      atlas.offset.x = lt * 0.01;
      wall.color.setScalar(0.3 + snare * 0.35 + wobble.level * 0.25);
      const breathe = 1 - wobble.level * 0.14 - kick * 0.05;
      tunnel.scale.set(breathe, breathe, 1);
      tunnel.rotation.z = lt * 0.15 + wobble.level * 0.2;
      gates.forEach((group, i) => {
        // Gate i flies past the camera at the start of local bar i + 1
        group.position.z = -(i + 1 - lb) * BAR_LENGTH;
        group.visible = group.position.z < 4 && group.position.z > -120;
        // Labels fade before they fill the screen
        const near = Math.min(1, Math.max(0, (-group.position.z - 3) / 9));
        group.children.forEach((child, k) => {
          child.material.opacity = k < group.children.length - 2 ? 1 : near;
        });
        group.rotation.z = Math.sin(lt * 0.5 + i) * 0.25 + wobble.level * 0.3;
        group.scale.setScalar(1 + kick * 0.1 + bass * 0.08);
      });
      camera.position.set(
        Math.sin(lt * 1.1) * 0.8,
        Math.cos(lt * 0.8) * 0.6,
        0,
      );
      camera.rotation.set(0, 0, Math.sin(lt * 0.3) * 0.2);
      camera.fov = 70 + kick * 6 + wobble.level * 4;
      camera.updateProjectionMatrix();
    },
    fx({ kick, snare }) {
      return {
        bloom: 0.8,
        threshold: 0.7,
        chroma: 0.004 + kick * 0.008 + snare * 0.004,
      };
    },
  };
}

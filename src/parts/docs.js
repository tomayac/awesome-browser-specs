// SPDX-FileCopyrightText: 2026 Thomas Steiner
// SPDX-License-Identifier: Apache-2.0

import * as THREE from 'three';
import { clamp01 } from '../engine.js';
import { BG, ENGINE, FONT_DISPLAY, HEAT } from '../palette.js';
import { canvasTexture } from '../text.js';

const COUNT = 8;
const BARS_EACH = 2;
const RADIUS = 8;
const COLORS = [
  ENGINE.blink,
  ENGINE.gecko,
  ENGINE.webkit,
  HEAT[2],
  ENGINE.blink,
  ENGINE.gecko,
  ENGINE.webkit,
  HEAT[1],
];

// One shape per spec, from smooth to faceted
const SHAPES = [
  () => new THREE.TorusKnotGeometry(1.1, 0.36, 220, 28),
  () => new THREE.IcosahedronGeometry(1.6, 0),
  () => new THREE.TorusGeometry(1.25, 0.5, 32, 96),
  () => new THREE.DodecahedronGeometry(1.5, 0),
  () => new THREE.CapsuleGeometry(0.85, 1.4, 10, 28),
  () => new THREE.OctahedronGeometry(1.7, 0),
  () => new THREE.CylinderGeometry(1.1, 1.1, 2.2, 6),
  () => new THREE.TetrahedronGeometry(1.9, 0),
];

// The spec's name, tiled in rows across a texture that wraps around the shape
function nameTexture(title, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#07060f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = `900 92px ${FONT_DISPLAY}`;
  ctx.textBaseline = 'middle';
  const text = `${title.toUpperCase()}  ✦  `;
  const width = ctx.measureText(text).width;
  for (let row = 0; row < 4; row++) {
    ctx.fillStyle = row % 2 ? '#ffffff' : color;
    const y = 64 + row * 128;
    for (let x = -(row * width) / 3; x < canvas.width; x += width) {
      ctx.fillText(text, x, y);
    }
  }
  const texture = canvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  return texture;
}

export function createDocs({ stats }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 18, 42);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  scene.add(new THREE.AmbientLight('#8a90ff', 0.35));
  const key = new THREE.DirectionalLight('#ffffff', 1.4);
  key.position.set(4, 8, 10);
  const rim = new THREE.PointLight(ENGINE.gecko, 25, 40);
  rim.position.set(-8, 4, -4);
  const fill = new THREE.PointLight(ENGINE.blink, 25, 40);
  fill.position.set(8, -3, 6);
  scene.add(key, rim, fill);

  // A slow wireframe cage around the stage
  const cage = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(24, 1)),
    new THREE.LineBasicMaterial({ color: '#2a2266' }),
  );
  scene.add(cage);

  // The specs with the most MDN articles
  const documented = [...stats.specs]
    .sort((a, b) => b.mdn - a.mdn || b.caniuse - a.caniuse)
    .slice(0, COUNT);
  const most = documented[0]?.mdn || 1;
  const ring = new THREE.Group();
  scene.add(ring);
  const shapes = documented.map((spec, i) => {
    const color = COLORS[i % COLORS.length];
    const texture = nameTexture(spec.title, color);
    const geometry = SHAPES[i % SHAPES.length]();
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        map: texture,
        emissiveMap: texture,
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: 0.2,
        metalness: 0.1,
        roughness: 0.6,
      }),
    );
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 30),
      new THREE.LineBasicMaterial({ color, toneMapped: false }),
    );
    mesh.add(edges);
    const angle = (i / COUNT) * Math.PI * 2;
    const holder = new THREE.Group();
    holder.position.set(Math.sin(angle) * RADIUS, 0, Math.cos(angle) * RADIUS);
    holder.add(mesh);
    ring.add(holder);
    // Bigger documentation, bigger shape
    const size = 0.7 + 0.6 * Math.sqrt(spec.mdn / most);
    return { mesh, texture, holder, size, spin: 0.3 + (i % 3) * 0.15 };
  });

  const cues = [
    {
      from: 0.1,
      to: 15.9,
      at: 'top-left',
      lines: [
        { text: 'BEST DOCUMENTED', size: 0.07 },
        {
          text: 'MDN ARTICLES PER SPEC',
          size: 0.022,
          font: 'mono',
          color: '#c9cdf0',
        },
      ],
    },
    ...documented.map((spec, i) => ({
      from: i * BARS_EACH + 0.25,
      to: i * BARS_EACH + 1.95,
      at: 'left',
      lines: [
        { text: `#${i + 1} ${spec.title.toUpperCase()}`, size: 0.08 },
        {
          text: `${spec.mdn} MDN ARTICLES`,
          size: 0.028,
          font: 'mono',
          color: HEAT[2],
        },
        {
          text: `${spec.caniuse} CAN I USE FEATURES · ${spec.org}`,
          size: 0.022,
          font: 'mono',
          color: '#c9cdf0',
        },
      ],
    })),
  ];
  const voice = documented.map((spec, i) => ({
    at: i * BARS_EACH + 0.3,
    text: i === 0 ? `Best documented: ${spec.title}` : spec.title,
    style: i === 0 ? 'announcer' : 'name',
  }));

  let flow = 0;
  let previous = 0;
  return {
    scene,
    camera,
    cues,
    voice,
    update({ lb, lt, kick, bass, wobble }) {
      const dt = lt - previous;
      flow = dt >= 0 && dt < 0.5 ? flow + dt * (1 + wobble.level * 3) : lt;
      previous = lt;

      // The ring snaps the next spec to the front every two bars
      const focus = Math.min(lb / BARS_EACH, COUNT - 1);
      const turn = Math.floor(focus) + clamp01((focus % 1) / 0.3) ** 0.5;
      ring.rotation.y = -(Math.min(turn, COUNT - 1) / COUNT) * Math.PI * 2;
      const front = Math.floor(focus);

      shapes.forEach(({ mesh, texture, size, spin }, i) => {
        const near = Math.max(0, 1 - Math.abs(i - focus));
        const scale = size * (1 + near * 0.35) * (1 + kick * 0.1);
        mesh.scale.setScalar(scale);
        mesh.rotation.x = flow * spin + i;
        mesh.rotation.y = flow * (spin + 0.25) + wobble.level * 0.6;
        texture.offset.x = -flow * 0.08;
        mesh.material.emissiveIntensity =
          (i === front ? 0.3 : 0.12) + kick * 0.25 + bass * 0.1;
      });
      cage.rotation.set(lt * 0.05, lt * 0.08, 0);
      camera.position.set(
        Math.sin(lt * 0.3) * 2,
        3 + Math.sin(lt * 0.45) * 1.2,
        RADIUS + 9,
      );
      camera.lookAt(-2.5, 0, RADIUS - 2);
      camera.fov = 50 + kick * 3;
      camera.updateProjectionMatrix();
    },
    fx({ kick }) {
      return { bloom: 0.6, threshold: 0.85, chroma: 0.003 + kick * 0.007 };
    },
  };
}

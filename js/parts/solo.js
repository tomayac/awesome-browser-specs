// SPDX-FileCopyrightText: 2026 Thomas Steiner
// SPDX-License-Identifier: Apache-2.0

import * as THREE from 'three';
import { clamp01, random } from '../engine.js';
import { ENGINE, ENGINE_NAME } from '../palette.js';
import { textMesh } from '../text.js';

const MAX_LISTED = 8;

// Spec names that only one engine ships, listed in that engine's color
function list(engine, specs) {
  const name = ENGINE_NAME[engine].toUpperCase();
  const shown = specs.slice(0, MAX_LISTED);
  const lines = [
    {
      text: `${specs.length} IN ${name} ALONE`,
      size: 0.09,
      color: ENGINE[engine],
    },
    ...shown.map((spec) => ({
      text: spec.title.toUpperCase(),
      size: 0.03,
      font: 'mono',
    })),
  ];
  if (specs.length > shown.length) {
    lines.push({
      text: `AND ${specs.length - shown.length} MORE`,
      size: 0.03,
      font: 'mono',
      color: '#c9cdf0',
    });
  }
  return lines;
}

export function createSolo({ stats }) {
  const rand = random(107);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#020208');
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);

  // Titles of every spec that ships in Blink alone fall like rain
  const blink = stats.only.blink;
  const drops = blink.map((spec) => {
    const mesh = textMesh(spec.title.toUpperCase(), {
      height: 0.7,
      font: 'mono',
      px: 56,
      color: ENGINE.blink,
    });
    const z = rand.range(-34, -8);
    mesh.position.set(rand.range(-1, 1), rand.range(-1, 1), z);
    mesh.userData.speed = rand.range(2.5, 7);
    mesh.userData.phase = rand() * 100;
    mesh.userData.spread = -z * 0.75;
    scene.add(mesh);
    return mesh;
  });

  const cues = [
    {
      from: 0.25,
      to: 3.9,
      at: 'center',
      lines: [
        { text: String(blink.length), size: 0.3, color: ENGINE.blink },
        {
          text: 'SPECS SHIP IN BLINK ALONE',
          size: 0.035,
          font: 'mono',
        },
      ],
    },
    {
      from: 4.1,
      to: 5.95,
      at: 'center',
      lines: list('gecko', stats.only.gecko),
    },
    {
      from: 6.05,
      to: 7.95,
      at: 'center',
      lines: list('webkit', stats.only.webkit),
    },
  ];

  // Read out the names, as many as fit before the next list starts
  const names = (engine, from, to) =>
    stats.only[engine].slice(0, 4).map((spec, i, shown) => ({
      at: from + ((to - from) * i) / shown.length,
      text: spec.title,
      style: 'name',
    }));
  const voice = [
    { at: 0.3, text: `${blink.length} specs ship in Blink alone` },
    { at: 2.3, text: blink[0]?.title, style: 'name' },
    { at: 4.15, text: 'Gecko alone' },
    ...names('gecko', 4.7, 5.9),
    { at: 6.1, text: 'WebKit alone' },
    ...names('webkit', 6.65, 7.9),
  ];

  return {
    scene,
    camera,
    cues,
    voice,
    update({ lb, lt, hat, aspect }) {
      const fade = 1 - clamp01((lb - 3.6) / 0.6);
      for (const mesh of drops) {
        const { speed, phase, spread } = mesh.userData;
        const range = spread * 1.6;
        mesh.position.y = range / 2 - ((lt * speed + phase * range) % range);
        mesh.position.x = Math.sin(phase * 7) * spread * aspect * 0.8;
        const flicker = Math.random() < hat * 0.25 ? 2 : 1;
        mesh.material.opacity = fade * 0.75 * flicker;
        mesh.visible = fade > 0;
      }
      camera.position.set(Math.sin(lt * 0.4) * 0.5, 0, 0);
      camera.rotation.z = Math.sin(lt * 0.25) * 0.08;
    },
    fx({ lb, hat }) {
      const switching = lb > 3.9 && lb < 4.3 ? 1 : lb > 5.9 && lb < 6.2 ? 1 : 0;
      return {
        bloom: 0.9,
        chroma: 0.006 + hat * 0.006,
        glitch: 0.15 + hat * 0.25 + switching * 0.6,
      };
    },
  };
}

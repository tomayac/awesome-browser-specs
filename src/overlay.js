// SPDX-FileCopyrightText: 2026 Thomas Steiner
// SPDX-License-Identifier: Apache-2.0

import * as THREE from 'three';
import { BAR } from './music.js';
import { ENGINE } from './palette.js';
import { dispose, textMesh } from './text.js';

// Captions drawn on top of each part, after bloom and before the glitch pass.
// The camera spans 2 units vertically, so a line `size` 0.1 is a tenth of the
// screen height. A cue shows from local bar `from` to local bar `to`.
//
//   { from, to, at: 'left' | 'center' | 'top-left' | 'bottom-left' | 'bottom',
//     lines: [{ text, size, font: 'display' | 'mono', color }] }

const MARGIN = 0.12;
const BANDS = 64;
const IN = 0.22;
const OUT = 0.16;
const STAGGER = 0.06;

const easeOutBack = (p) => {
  const c = 1.9;
  return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2;
};
const clamp01 = (value) => Math.min(1, Math.max(0, value));

export class Overlay {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
    this.built = new Map();
    this.aspect = 1;
    this.heightPx = 1;

    // A spectrum analyzer along the bottom edge, from Blink blue through
    // WebKit teal to Gecko orange
    const bar = new THREE.PlaneGeometry(1, 1);
    bar.translate(0, 0.5, 0);
    this.bands = new THREE.InstancedMesh(
      bar,
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.4,
        depthTest: false,
        toneMapped: false,
      }),
      BANDS,
    );
    const from = new THREE.Color(ENGINE.blink);
    const mid = new THREE.Color(ENGINE.webkit);
    const to = new THREE.Color(ENGINE.gecko);
    const color = new THREE.Color();
    for (let i = 0; i < BANDS; i++) {
      const p = i / (BANDS - 1);
      color.copy(p < 0.5 ? from : mid).lerp(p < 0.5 ? mid : to, (p % 0.5) * 2);
      this.bands.setColorAt(i, color);
    }
    this.bands.visible = false;
    this.scene.add(this.bands);

    // Winamp-style peak caps that hang above each bar, then fall
    this.caps = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        depthTest: false,
        toneMapped: false,
      }),
      BANDS,
    );
    this.caps.visible = false;
    this.scene.add(this.caps);
    this.peaks = new Float32Array(BANDS);
    this.lastSpectrum = performance.now();
    this.matrix = new THREE.Matrix4();
  }

  // Builds and shows every cue at once, so their textures upload while
  // warming up; the next `update()` hides them again
  prepare(cues) {
    for (const cue of cues) {
      (this.built.get(cue) ?? this.build(cue)).visible = true;
    }
  }

  // Bins spread on a curve, so the bass gets more bars than the hiss. At full
  // `amount` the bars reach a fifth of the screen.
  spectrum(fft, kick, amount = 1) {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastSpectrum) / 1000);
    this.lastSpectrum = now;
    const visible = Boolean(fft) && amount > 0.01;
    this.bands.visible = visible;
    this.caps.visible = visible;
    if (!visible) {
      return;
    }
    this.bands.material.opacity = 0.6 * amount;
    this.caps.material.opacity = 0.9 * amount;
    const width = (this.aspect * 2) / BANDS;
    for (let i = 0; i < BANDS; i++) {
      const bin = Math.floor(1 + (i / BANDS) ** 1.7 * 90);
      const height = Math.max(
        0.002,
        (fft[bin] / 255) ** 1.4 * 0.4 * amount * (1 + kick * 0.3),
      );
      const x = -this.aspect + width * (i + 0.5);
      this.matrix.makeScale(width * 0.7, height, 1);
      this.matrix.setPosition(x, -1, 0);
      this.bands.setMatrixAt(i, this.matrix);
      this.peaks[i] = Math.max(height, this.peaks[i] - dt * 0.3);
      this.matrix.makeScale(width * 0.7, 0.012, 1);
      this.matrix.setPosition(x, -1 + this.peaks[i] + 0.012, 0);
      this.caps.setMatrixAt(i, this.matrix);
    }
    this.bands.instanceMatrix.needsUpdate = true;
    this.caps.instanceMatrix.needsUpdate = true;
  }

  resize(width, height) {
    this.aspect = width / height;
    this.heightPx = height * Math.min(devicePixelRatio, 2);
    this.camera.left = -this.aspect;
    this.camera.right = this.aspect;
    this.camera.updateProjectionMatrix();
    this.clear();
  }

  clear() {
    for (const group of this.built.values()) {
      dispose(group);
      group.removeFromParent();
    }
    this.built.clear();
  }

  build(cue) {
    const group = new THREE.Group();
    const align =
      cue.at === 'center' || cue.at === 'bottom' ? 'center' : 'left';
    let y = 0;
    let widest = 0;
    for (const line of cue.lines) {
      const height = line.size * 2;
      const px = Math.min(400, Math.ceil((line.size * this.heightPx) / 1.3));
      const mesh = textMesh(line.text, {
        height,
        px,
        font: line.font ?? 'display',
        color: line.color ?? '#fff',
      });
      const lead = height * (line.font === 'mono' ? 0.62 : 0.4);
      y -= lead;
      mesh.position.set(align === 'left' ? mesh.userData.width / 2 : 0, y, 0);
      y -= lead;
      mesh.userData.restX = mesh.position.x;
      widest = Math.max(widest, mesh.userData.width);
      group.add(mesh);
    }
    // Shrink the cue to fit narrow screens
    const room = this.aspect * 2 - MARGIN * 2;
    const scale = Math.min(1, room / widest);
    group.scale.setScalar(scale);
    const total = -y * scale;
    const left = -this.aspect + MARGIN;
    switch (cue.at) {
      case 'center':
        group.position.set(0, total / 2, 0);
        break;
      case 'bottom':
        group.position.set(0, -1 + MARGIN + total, 0);
        break;
      case 'top-left':
        group.position.set(left, 1 - MARGIN, 0);
        break;
      case 'bottom-left':
        group.position.set(left, -1 + MARGIN + total, 0);
        break;
      default:
        group.position.set(left, Math.min(0.55, total / 2), 0);
    }
    this.scene.add(group);
    this.built.set(cue, group);
    return group;
  }

  // Shows the cues of the current part at local time `lt` (seconds)
  update(cues, lt) {
    const active = new Set();
    for (const cue of cues) {
      const start = cue.from * BAR;
      const end = cue.to * BAR;
      if (lt < start || lt > end) {
        continue;
      }
      active.add(cue);
      const group = this.built.get(cue) ?? this.build(cue);
      group.visible = true;
      group.children.forEach((mesh, i) => {
        const p = clamp01((lt - start - i * STAGGER) / IN);
        const q = clamp01((end - lt) / OUT);
        const flicker = p < 1 && Math.random() < 0.35 ? 0.2 : 1;
        mesh.scale.y = Math.max(0.0001, easeOutBack(p) * q);
        mesh.position.x =
          mesh.userData.restX + (1 - p) * (Math.random() - 0.5) * 0.25;
        mesh.material.opacity = p * q * flicker;
      });
    }
    for (const [cue, group] of this.built) {
      if (!active.has(cue)) {
        group.visible = false;
      }
    }
  }
}

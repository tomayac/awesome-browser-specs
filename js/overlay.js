// SPDX-FileCopyrightText: 2026 Thomas Steiner
// SPDX-License-Identifier: Apache-2.0

import * as THREE from 'three';
import { BAR } from './music.js';
import { dispose, textMesh } from './text.js';

// Captions drawn on top of each part, after bloom and before the glitch pass.
// The camera spans 2 units vertically, so a line `size` 0.1 is a tenth of the
// screen height. A cue shows from local bar `from` to local bar `to`.
//
//   { from, to, at: 'left' | 'center' | 'top-left' | 'bottom-left' | 'bottom',
//     lines: [{ text, size, font: 'display' | 'mono', color }] }

const MARGIN = 0.12;
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

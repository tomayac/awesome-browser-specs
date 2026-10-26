// SPDX-FileCopyrightText: 2026 Thomas Steiner
// SPDX-License-Identifier: Apache-2.0

import * as THREE from 'three';
import { FONT_DISPLAY, FONT_MONO } from './palette.js';

const FONTS = {
  display: { family: FONT_DISPLAY, weight: 900, spacing: 0.01 },
  mono: { family: FONT_MONO, weight: 700, spacing: 0.06 },
};

// A line of text is either a string or a list of colored runs: [[text, color]]
const runsOf = (text, color) =>
  typeof text === 'string' ? [[text, color]] : text;

// Draws one line of text onto a canvas sized to fit it. The glyphs take up
// 1/1.3 of the canvas height, so a plane of height h shows text of cap height
// about 0.55h.
export function textCanvas(
  text,
  { font = 'display', px = 128, color = '#fff' } = {},
) {
  const { family, weight, spacing } = FONTS[font];
  const runs = runsOf(text, color);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fontString = `${weight} ${px}px ${family}`;
  const setup = () => {
    ctx.font = fontString;
    ctx.letterSpacing = `${spacing * px}px`;
    ctx.textBaseline = 'middle';
  };
  setup();
  const widths = runs.map(([run]) => ctx.measureText(run).width);
  const pad = Math.ceil(px * 0.15);
  canvas.width = Math.ceil(widths.reduce((a, b) => a + b, 0) + pad * 2);
  canvas.height = Math.ceil(px * 1.3);
  setup();
  let x = pad;
  runs.forEach(([run, runColor], i) => {
    ctx.fillStyle = runColor ?? color;
    ctx.fillText(run, x, canvas.height / 2);
    x += widths[i];
  });
  return canvas;
}

export function canvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// A flat mesh showing one line of text, `height` world units tall
export function textMesh(text, { height = 1, opacity = 1, ...options } = {}) {
  const canvas = textCanvas(text, options);
  const material = new THREE.MeshBasicMaterial({
    map: canvasTexture(canvas),
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const width = (height * canvas.width) / canvas.height;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.userData.width = width;
  return mesh;
}

export function dispose(object) {
  object.traverse((child) => {
    child.geometry?.dispose();
    child.material?.map?.dispose();
    child.material?.dispose();
  });
}

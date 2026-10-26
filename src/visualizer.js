// SPDX-FileCopyrightText: 2026 Thomas Steiner
// SPDX-License-Identifier: Apache-2.0

import * as THREE from 'three';

// A MilkDrop-style feedback visualizer: every frame warps the previous one
// (zooming, rotating, rippling) and fades it a little, then draws the music's
// waveform into it as a line and a ring. The result is laid additively over
// the demo.

const feedback = {
  uniforms: {
    uPrevious: { value: null },
    uWave: { value: null },
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uBass: { value: 0 },
    uKick: { value: 0 },
    uWobble: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D uPrevious;
    uniform sampler2D uWave;
    uniform float uTime;
    uniform float uAspect;
    uniform float uBass;
    uniform float uKick;
    uniform float uWobble;
    varying vec2 vUv;

    vec3 hue(float h) {
      return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    }

    void main() {
      vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
      float radius = length(p);
      float angle = atan(p.y, p.x);

      // Pull the last frame inward, turn it, and ripple it outward
      float r = radius * (0.975 - uBass * 0.025);
      r += 0.004 * sin(radius * 22.0 - uTime * 4.0);
      float a = angle + 0.012 + 0.025 * sin(uTime * 0.31) + uWobble * 0.03;
      vec2 q = vec2(cos(a), sin(a)) * r / vec2(uAspect, 1.0) + 0.5;
      vec3 trail = texture2D(uPrevious, q).rgb * 0.9;

      // The waveform as a line across the middle and as a ring
      float wave = texture2D(uWave, vec2(vUv.x, 0.5)).r - 0.5;
      float line = smoothstep(0.01, 0.0, abs(vUv.y - 0.5 - wave * 0.7));
      float around = texture2D(uWave, vec2(fract(angle / 6.28318 + 0.5), 0.5)).r - 0.5;
      float ring = smoothstep(
        0.012,
        0.0,
        abs(radius - (0.2 + around * 0.3 + uKick * 0.1))
      );

      vec3 color = hue(fract(uTime * 0.06 + radius * 0.8));
      vec3 next = trail + color * (line * 0.45 + ring * (0.4 + uKick * 0.5));
      gl_FragColor = vec4(min(next, vec3(1.5)), 1.0);
    }
  `,
};

export class Visualizer {
  constructor() {
    const options = { type: THREE.HalfFloatType, depthBuffer: false };
    this.targets = [
      new THREE.WebGLRenderTarget(1, 1, options),
      new THREE.WebGLRenderTarget(1, 1, options),
    ];
    this.wave = new THREE.DataTexture(
      new Uint8Array(256).fill(128),
      256,
      1,
      THREE.RedFormat,
    );
    this.wave.minFilter = THREE.LinearFilter;
    this.wave.magFilter = THREE.LinearFilter;
    this.material = new THREE.ShaderMaterial({
      ...feedback,
      depthTest: false,
      depthWrite: false,
    });
    this.material.uniforms.uWave.value = this.wave;
    this.scene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
    this.camera = new THREE.Camera();

    // What the overlay shows: the latest frame, added onto the demo
    this.display = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.display.renderOrder = -1;
    this.display.visible = false;
  }

  resize(width, height) {
    for (const target of this.targets) {
      target.setSize(Math.ceil(width / 2), Math.ceil(height / 2));
    }
    this.material.uniforms.uAspect.value = width / height;
    this.display.scale.set((width / height) * 2, 2, 1);
  }

  update(renderer, { time, kick, bass, wobble, wave, amount }) {
    this.display.visible = amount > 0.001;
    if (!this.display.visible || !wave) {
      return;
    }
    this.wave.image.data.set(wave.subarray(0, 256));
    this.wave.needsUpdate = true;
    const [read, write] = this.targets;
    const uniforms = this.material.uniforms;
    uniforms.uPrevious.value = read.texture;
    uniforms.uTime.value = time;
    uniforms.uKick.value = kick;
    uniforms.uBass.value = bass;
    uniforms.uWobble.value = wobble;
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(write);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(previous);
    this.targets.reverse();
    const material = this.display.material;
    if (!material.map) {
      // The first map switches the material to a textured shader
      material.needsUpdate = true;
    }
    material.map = write.texture;
    material.opacity = amount * 0.25;
  }
}

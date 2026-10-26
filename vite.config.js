// SPDX-FileCopyrightText: 2026 Thomas Steiner
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'vite';
import { cosPlugin } from 'vite-plugin-cross-origin-storage';

// Packages that production builds load through Cross-Origin Storage (COS)
// where the browser supports it. Each one, plus everything it imports, gets a
// content-addressed chunk that every site shipping the same version shares.
// A package only matters once your code imports it, so listing ones you don't
// use costs nothing. Add your own plain-JavaScript dependencies here.
//
// `three` also covers its subpaths: `three/addons/*`, `three/webgpu`, and
// `three/tsl`. The others are popular libraries from the three.js ecosystem.
// Their own `import 'three'` resolves to the same shared chunk, so there is
// only ever one copy of three.js on the page.

const COS_PACKAGES = [
	'three',
	// Effects, controls, and helpers.
	'postprocessing',
	'three-mesh-bvh',
	'camera-controls',
	'troika-three-text',
	// Debug UI and stats.
	'lil-gui',
	'tweakpane',
	'stats-gl',
	// Animation and physics.
	'@tweenjs/tween.js',
	'cannon-es',
	'@dimforge/rapier3d-compat'
];

const escape = ( name ) => name.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );

export default defineConfig( {
	// Relative URLs, so the build works from any path, GitHub Pages included.
	base: './',
	plugins: [
		cosPlugin( {
			// Matches each package and any of its subpaths, but not packages that
			// merely share a prefix (`three` does not match `three-mesh-bvh`).
			packages: [ new RegExp( `^(?:${ COS_PACKAGES.map( escape ).join( '|' ) })(?:/|$)` ) ]
		} )
	],
	build: {
		target: 'esnext',
		// GitHub Pages serves the committed `docs/` folder of `main`.
		outDir: 'docs',
		emptyOutDir: true
	},
	server: {
		open: true
	}
} );

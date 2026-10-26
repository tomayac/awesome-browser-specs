// SPDX-FileCopyrightText: 2026 Thomas Steiner
// SPDX-License-Identifier: Apache-2.0

export const BG = '#05040d';

// One identity color per engine, used wherever an engine or its browser shows
export const ENGINE = {
  blink: '#3b8cff',
  gecko: '#ff7a1a',
  webkit: '#1fe0b0',
};

export const ENGINE_NAME = {
  blink: 'Blink',
  gecko: 'Gecko',
  webkit: 'WebKit',
};

// WPT reports results per browser, so each browser borrows its engine's color
export const BROWSER_ENGINE = {
  chrome: 'blink',
  firefox: 'gecko',
  safari: 'webkit',
};

// How many engines ship a spec, as a heat ramp from white-hot to cold
export const HEAT = {
  3: '#ffffff',
  2: '#ffd54a',
  1: '#ff7a3d',
  none: '#e0144c',
  nodata: '#4a5080',
};

export const FONT_DISPLAY = '"Big Shoulders Display", Impact, sans-serif';
export const FONT_MONO = '"IBM Plex Mono", ui-monospace, monospace';

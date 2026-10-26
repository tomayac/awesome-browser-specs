// SPDX-FileCopyrightText: 2026 Thomas Steiner
// SPDX-License-Identifier: Apache-2.0

import { deriveStats, loadSpecs } from './data.js';
import { createEngine } from './engine.js';
import { Overlay } from './overlay.js';
import { Visualizer } from './visualizer.js';
import {
  BAR,
  Music,
  PARTS,
  SONG_END,
  isDrop,
  partIndexAt,
  since,
  wobbleAt,
} from './music.js';
import { Speaker } from './speech.js';
import { createIntro } from './parts/intro.js';
import { createEngines } from './parts/engines.js';
import { createCategories } from './parts/categories.js';
import { createTests } from './parts/tests.js';
import { createSolo } from './parts/solo.js';
import { createFootprint } from './parts/footprint.js';
import { createDocs } from './parts/docs.js';
import { createTime } from './parts/time.js';
import { createGreets } from './parts/greets.js';

const CREATORS = {
  intro: createIntro,
  engines: createEngines,
  categories: createCategories,
  tests: createTests,
  solo: createSolo,
  footprint: createFootprint,
  docs: createDocs,
  time: createTime,
  greets: createGreets,
};

const dom = {
  stage: document.querySelector('#stage'),
  start: document.querySelector('#start'),
  osd: document.querySelector('#osd'),
  logo: document.querySelector('#logo'),
  play: document.querySelector('#play'),
  fullscreen: document.querySelector('#fullscreen'),
  chapters: document.querySelector('#chapters'),
  chapterList: document.querySelector('#chapter-list'),
  chaptersButton: document.querySelector('#chapters-button'),
  status: document.querySelector('#status'),
  hud: document.querySelector('#hud'),
  part: document.querySelector('#hud-part'),
  clock: document.querySelector('#hud-clock'),
  scrubber: document.querySelector('#scrubber'),
  progress: document.querySelector('#progress'),
};

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Canvas textures are drawn once, so the fonts have to be there first. Don't
// hang if Google Fonts can't be reached.
const fontsReady = Promise.race([
  Promise.all([
    document.fonts.load('900 64px "Big Shoulders Display"'),
    document.fonts.load('700 32px "IBM Plex Mono"'),
  ]),
  new Promise((resolve) => setTimeout(resolve, 4000)),
]).catch(() => {});

const [data] = await Promise.all([loadSpecs(), fontsReady]);
const stats = deriveStats(data);

const engine = createEngine(dom.stage);
const overlay = new Overlay();
engine.addOverlay(overlay.scene, overlay.camera);
const visualizer = new Visualizer();
overlay.scene.add(visualizer.display);
const parts = PARTS.map((part) => CREATORS[part.key]({ stats }));

// Every voice cue on one timeline, in song seconds
const voiceCues = PARTS.flatMap((part, i) =>
  (parts[i].voice ?? []).map((cue) => ({
    ...cue,
    time: (part.startBar + cue.at) * BAR,
  })),
).sort((a, b) => a.time - b.time);

const viewport = { width: 1, height: 1, pixelRatio: 1 };
function resize() {
  viewport.width = innerWidth;
  viewport.height = innerHeight;
  viewport.pixelRatio = Math.min(devicePixelRatio, 2);
  engine.resize(innerWidth, innerHeight);
  overlay.resize(innerWidth, innerHeight);
  visualizer.resize(innerWidth, innerHeight);
  for (const { camera } of parts) {
    if (camera.isPerspectiveCamera) {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
    }
  }
}
addEventListener('resize', resize);
resize();

let music = null;
const speaker = new Speaker({
  onSpeaking: (speaking) => {
    if (music) {
      music.speaking = speaking;
    }
  },
});

let spokenUntil = 0;
function speakDue(time) {
  // A jump in time is a seek: skip what lies in between
  if (time < spokenUntil || time - spokenUntil > 0.5) {
    spokenUntil = time;
    return;
  }
  for (const cue of voiceCues) {
    if (cue.time > spokenUntil && cue.time <= time) {
      speaker.say(cue.text, cue.style);
    }
  }
  spokenUntil = time;
}

// Shows a VCR message, for `ms` milliseconds or until the next one
let osdTimer = 0;
function osd(text, ms = 1200) {
  dom.osd.textContent = text;
  dom.osd.classList.add('on');
  clearTimeout(osdTimer);
  if (Number.isFinite(ms)) {
    osdTimer = setTimeout(() => dom.osd.classList.remove('on'), ms);
  }
}

const lastSeek = { time: 0, at: -Infinity };
function seek(time) {
  if (!music) {
    return;
  }
  if (music.playing) {
    osd(time < music.time ? '◀◀ REW' : '▶▶ FF');
  }
  speaker.stop();
  music.seek(time);
  spokenUntil = music.time;
  lastSeek.time = Math.min(SONG_END, Math.max(0, time));
  lastSeek.at = performance.now();
}

const envelope = (instrument, time, decay) => {
  const { dt, velocity } = since(instrument, time);
  return velocity * Math.exp(-dt * decay);
};

// Low-end energy from the analyser, 0 to 1
const bassOf = (fft) => {
  if (!fft) {
    return 0;
  }
  let sum = 0;
  for (let i = 1; i < 7; i++) {
    sum += fft[i];
  }
  return Math.min(1, Math.max(0, (sum / 6 / 255 - 0.35) / 0.6));
};

// The chapters with little on screen, where MilkDrop gets room to swirl
const CALM = ['intro', 'solo', 'time'];

// 0 shows the equalizer, 1 the MilkDrop-style feedback, crossfading over the
// first and last bar of a calm chapter
function visualizerMix(bar) {
  const part = PARTS[partIndexAt(bar)];
  if (!CALM.includes(part.key)) {
    return 0;
  }
  const into = bar - part.startBar;
  return Math.min(1, into, part.bars - into);
}

// Shakes and rolls a perspective camera on the hits. Every part sets its camera
// from scratch each frame, so the offset never accumulates.
function shake(camera, { kick, snare, wobble }, amount) {
  if (!camera.isPerspectiveCamera || !amount) {
    return;
  }
  const strength =
    (kick * 0.45 + wobble.level * (wobble.rate >= 4 ? 0.12 : 0)) * amount;
  camera.position.x += (Math.random() - 0.5) * strength;
  camera.position.y += (Math.random() - 0.5) * strength;
  camera.rotation.z += (Math.random() - 0.5) * snare * 0.05 * amount;
}

const formatTime = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

function frame() {
  const time = music ? music.time : 0;
  const bar = time / BAR;
  const index = partIndexAt(bar);
  const part = parts[index];
  const lb = Math.min(bar - PARTS[index].startBar, PARTS[index].bars - 0.001);
  const lt = lb * BAR;
  const state = {
    time,
    lb,
    lt,
    kick: envelope('kick', time, 7),
    snare: envelope('snare', time, 6),
    hat: envelope('hat', time, 16),
    crash: envelope('crash', time, 2),
    wobble: wobbleAt(time),
    drop: isDrop(Math.floor(bar)),
    fft: music?.readFft(),
    aspect: viewport.width / viewport.height,
    viewport,
  };
  state.bass = bassOf(state.fft);
  const motion = reducedMotion.matches ? 0.2 : 1;
  part.update(state);
  shake(part.camera, state, motion);
  overlay.update(part.cues, lt);
  // MilkDrop-style feedback takes over from the equalizer in calm chapters
  const milkdrop = visualizerMix(bar);
  overlay.spectrum(state.fft, state.kick, 1 - milkdrop);
  visualizer.update(engine.renderer, {
    time,
    kick: state.kick,
    bass: state.bass,
    wobble: state.wobble.level,
    wave: music?.readWave(),
    amount: milkdrop,
  });

  const fx = {
    bloom: 1,
    threshold: 0.3,
    chroma: 0.003,
    glitch: 0,
    flash: 0,
    invert: 0,
    ...part.fx(state),
  };
  if (music && index > 0) {
    fx.flash += Math.exp(-lt * 5) * 0.5;
    fx.glitch += Math.exp(-lt * 6) * 0.8;
  }
  // The whole frame answers the music: punch on kicks, flashes on the drop
  // snares, smear on the wobble, and glitches when it wobbles fast
  const { wobble } = state;
  fx.flash += state.crash * 0.08 + (state.drop ? state.snare * 0.12 : 0);
  fx.chroma += wobble.level * 0.006 + state.bass * 0.003;
  fx.glitch += wobble.rate >= 6 ? wobble.level * 0.3 : 0;
  fx.bloom *= 1 + state.bass * 0.4;
  const big = since('crash', time);
  fx.invert = state.drop && big.velocity === 1 && big.dt < 0.07 ? 1 : 0;
  let punch = state.kick * 2.2 + (state.drop ? state.snare : 0);
  fx.flash *= motion;
  fx.glitch *= motion;
  fx.invert *= motion;
  punch *= motion;
  engine.render(part.scene, part.camera, { ...fx, punch, time, motion });

  if (music?.playing) {
    speakDue(time);
  }
  dom.part.textContent = `${String(index + 1).padStart(2, '0')} / ${PARTS[index].name}`;
  typeOnTheBeat(state, index, motion);
  markChapter(music ? index : -1);
  dom.clock.textContent = `${formatTime(time)} / ${formatTime(SONG_END)}`;
  dom.progress.style.width = `${(time / SONG_END) * 100}%`;
}
engine.renderer.setAnimationLoop(frame);

dom.status.textContent =
  data.origin === 'live'
    ? `${stats.total} specs loaded live from browser-specs.github.io`
    : `Live data unavailable, using a snapshot of ${stats.total} specs`;
dom.start.classList.add('ready');
dom.play.disabled = false;

const canFullscreen =
  document.fullscreenEnabled || document.webkitFullscreenEnabled;
function toggleFullscreen() {
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document);
    return;
  }
  const root = document.documentElement;
  const request = root.requestFullscreen ?? root.webkitRequestFullscreen;
  Promise.resolve(request?.call(root)).catch(() => {});
}
if (!canFullscreen) {
  dom.play.textContent = 'Play';
  dom.fullscreen.hidden = true;
}
const syncFullscreen = () => {
  const on = Boolean(
    document.fullscreenElement || document.webkitFullscreenElement,
  );
  dom.fullscreen.textContent = on ? 'Exit full screen' : 'Full screen';
};
document.addEventListener('fullscreenchange', syncFullscreen);
document.addEventListener('webkitfullscreenchange', syncFullscreen);

async function start({ fullscreen = false, at = 0 } = {}) {
  if (music) {
    return;
  }
  if (fullscreen && canFullscreen) {
    toggleFullscreen();
  }
  music = new Music();
  await music.play(at);
  spokenUntil = at;
  lastSeek.time = at;
  lastSeek.at = performance.now();
  dom.start.hidden = true;
  document.body.classList.add('playing');
}

function togglePause() {
  if (!music) {
    return;
  }
  if (music.playing) {
    music.pause();
    speaker.stop();
    osd('❚❚ PAUSE', Infinity);
  } else {
    music.play();
    spokenUntil = music.time;
    osd('▶ PLAY', 2000);
  }
}

// Every way to start goes full screen, where the browser allows it
dom.start.addEventListener('click', (event) => {
  if (!event.target.closest('a')) {
    start({ fullscreen: true });
  }
});
dom.fullscreen.addEventListener('click', toggleFullscreen);
dom.stage.addEventListener('dblclick', toggleFullscreen);

addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }
  // A focused button or link handles its own Space and Enter
  if (
    [' ', 'Enter'].includes(event.key) &&
    event.target.closest?.('#chapters, a, #hud button')
  ) {
    return;
  }
  if (event.key === 'c' || event.key === 'C') {
    toggleChapters();
    return;
  }
  if (event.key === 'Escape' && !dom.chapters.hidden) {
    toggleChapters(false);
    return;
  }
  if (!music) {
    if ([' ', 'Enter', 'f', 'F'].includes(event.key)) {
      event.preventDefault();
      start({ fullscreen: true });
    }
    return;
  }
  // Right after a seek the clock trails its target by the output latency, so
  // repeated presses count from the last target
  const recent = performance.now() - lastSeek.at < 800;
  const bar = ((recent ? lastSeek.time : music.time) + 0.01) / BAR;
  const index = partIndexAt(bar);
  switch (event.key) {
    case ' ':
      event.preventDefault();
      togglePause();
      break;
    case 'ArrowRight':
      seek((Math.floor(bar / 4) * 4 + 4) * BAR);
      break;
    case 'ArrowLeft':
      seek((Math.ceil(bar / 4) * 4 - 4) * BAR);
      break;
    case 'PageDown':
      seek(PARTS[Math.min(PARTS.length - 1, index + 1)].startBar * BAR);
      break;
    case 'PageUp':
      seek(PARTS[Math.max(0, index - 1)].startBar * BAR);
      break;
    case 'r':
    case 'R':
      seek(0);
      if (!music.playing) {
        togglePause();
      }
      break;
    case 'm':
    case 'M':
      music.muted = speaker.muted = document.body.classList.toggle('muted');
      if (speaker.muted) {
        speaker.stop();
      }
      break;
    case 'f':
    case 'F':
      toggleFullscreen();
      break;
    default:
      if (/^[1-9]$/.test(event.key)) {
        seek(PARTS[Number(event.key) - 1].startBar * BAR);
      }
  }
});

dom.scrubber.addEventListener('click', (event) => {
  const box = dom.scrubber.getBoundingClientRect();
  seek(((event.clientX - box.left) / box.width) * SONG_END);
});

// The type moves with the music. Every Bitcount element shares axes set here:
// the dots swell on the kick, change shape on the snare, smear their ink
// layers with the wobble, and gain weight with the bass. The closing logo's
// letters rumble with the level of the music.
function typeOnTheBeat({ lb, kick, snare, wobble, bass, fft }, index, motion) {
  const root = document.documentElement.style;
  const swing = (wobble.level - 0.5) * 2 * (wobble.level ? 1 : 0);
  root.setProperty('--elxp', (kick * 100 * motion).toFixed(1));
  root.setProperty('--elsh', (snare * 100 * motion).toFixed(1));
  root.setProperty('--szp1', (35 + bass * 65 * motion).toFixed(1));
  root.setProperty('--xpn1', (swing * 60 * motion).toFixed(1));
  root.setProperty('--ypn1', (-wobble.level * 50 * motion).toFixed(1));
  root.setProperty('--wght', (400 + bass * 500 * motion).toFixed(0));

  const logo = PARTS[index].key === 'greets' && lb >= 12.2;
  dom.logo.classList.toggle('on', logo);
  if (logo) {
    rumble(fft, motion);
  }
}

// The closing title, one element per letter
const logoLetters = [];
const logoName = dom.logo.querySelector('.name');
['Awesome', 'Browser Specs'].forEach((line, i) => {
  if (i) {
    logoName.append(document.createElement('br'));
  }
  for (const char of line) {
    if (char === ' ') {
      logoName.append(' ');
      continue;
    }
    const letter = document.createElement('span');
    letter.className = 'letter';
    letter.textContent = char;
    logoName.append(letter);
    logoLetters.push(letter);
  }
});

// Sizes and offsets each letter's gradient to its place in the whole title
function sliceGradient() {
  const box = logoName.getBoundingClientRect();
  for (const letter of logoLetters) {
    letter.style.transform = '';
    const rect = letter.getBoundingClientRect();
    letter.style.backgroundSize = `${box.width}px ${box.height}px`;
    letter.style.backgroundPosition = `${box.left - rect.left}px ${
      box.top - rect.top
    }px`;
  }
}
sliceGradient();
addEventListener('resize', sliceGradient);
document.fonts.ready.then(sliceGradient);

// Each letter jitters by a few pixels with the music's overall level
function rumble(fft, motion) {
  let level = 0;
  if (fft) {
    for (let i = 1; i < 40; i++) {
      level += fft[i];
    }
    level /= 39 * 255;
  }
  const amount = (0.4 + level * 7) * motion;
  for (const letter of logoLetters) {
    const x = (Math.random() - 0.5) * amount;
    const y = (Math.random() - 0.5) * amount;
    const turn = (Math.random() - 0.5) * amount * 0.5;
    letter.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(
      2,
    )}px) rotate(${turn.toFixed(2)}deg)`;
  }
}

// The chapter navigator lists every part with its start time. Picking one
// jumps there, or starts the demo there from the start screen.
const chapterButtons = PARTS.map((part, i) => {
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.tabIndex = i === 0 ? 0 : -1;
  const number = document.createElement('span');
  number.className = 'number';
  number.textContent = String(i + 1).padStart(2, '0');
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = part.name;
  const at = document.createElement('span');
  at.className = 'at';
  at.textContent = formatTime(part.startBar * BAR);
  button.append(number, name, at);
  button.addEventListener('click', () => {
    const time = part.startBar * BAR;
    toggleChapters(false);
    if (music) {
      seek(time);
    } else {
      start({ fullscreen: true, at: time });
    }
  });
  item.append(button);
  dom.chapterList.append(item);
  return button;
});

let marked = null;
function markChapter(index) {
  if (index === marked) {
    return;
  }
  chapterButtons[marked]?.removeAttribute('aria-current');
  chapterButtons[index]?.setAttribute('aria-current', 'step');
  marked = index;
}

// Roving focus: one chapter is in the tab order, and the arrow keys, Home,
// and End move between them
function focusChapter(index) {
  const count = chapterButtons.length;
  const next = (index + count) % count;
  chapterButtons.forEach((button, i) => {
    button.tabIndex = i === next ? 0 : -1;
  });
  chapterButtons[next].focus();
}

dom.chapterList.addEventListener('keydown', (event) => {
  const index = chapterButtons.indexOf(document.activeElement);
  const moves = {
    ArrowDown: index + 1,
    ArrowRight: index + 1,
    ArrowUp: index - 1,
    ArrowLeft: index - 1,
    Home: 0,
    End: chapterButtons.length - 1,
  };
  if (index === -1 || !(event.key in moves)) {
    return;
  }
  // Keep the arrows from also seeking through the demo
  event.preventDefault();
  event.stopPropagation();
  focusChapter(moves[event.key]);
});

function toggleChapters(open = dom.chapters.hidden) {
  dom.chapters.hidden = !open;
  document.body.classList.toggle('chapters-open', open);
  if (open) {
    focusChapter(Math.max(0, marked ?? 0));
  }
}

dom.chaptersButton.addEventListener('click', () => toggleChapters());

// The controls show while the pointer moves and hide again after a moment
let idle = 0;
addEventListener('pointermove', () => {
  document.body.classList.add('active');
  clearTimeout(idle);
  idle = setTimeout(() => document.body.classList.remove('active'), 2000);
});

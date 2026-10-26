<!--
SPDX-FileCopyrightText: 2026 Thomas Steiner
SPDX-License-Identifier: Apache-2.0
-->

# Awesome Browser Specs

A demoscene production about every spec the web runs on. It visualizes the data
behind [browser-specs.github.io](https://browser-specs.github.io/) in nine
chapters, set to a dubstep soundtrack and robot voices that are all synthesized
live in the browser.

## Chapters

| Key | Chapter                       | What it shows                                                                |
| --- | ----------------------------- | ---------------------------------------------------------------------------- |
| 1   | The specs behind the web      | One particle per spec, gathering into the total                              |
| 2   | Which engines ship each spec  | Blink, Gecko, and WebKit, with every spec placed by the engines that ship it |
| 3   | Specs by category             | One ring per category, split by how many engines ship its specs              |
| 4   | Interop in web platform tests | WPT pass rates per spec: interop first, then Chrome, Firefox, and Safari     |
| 5   | Specs only one engine ships   | The specs that ship in only one engine                                       |
| 6   | The most referenced specs     | The specs that the most other specs point at                                 |
| 7   | The best-documented specs     | The specs with the most MDN articles, as rotating shapes wrapped in names    |
| 8   | Specs by last update          | Every spec ordered by its last update                                        |
| 9   | The groups that write them    | The standards organizations and working groups, slammed in on the beat       |

Every number comes from the data at load time, so the demo changes as the specs
do.

## Controls

- <kbd>Space</kbd>: play or pause
- <kbd>F</kbd>, a double-click, or the **Full screen** button: toggle full
  screen
- <kbd>1</kbd>–<kbd>9</kbd>: jump to a chapter
- <kbd>←</kbd> <kbd>→</kbd>: jump four bars
- <kbd>Page Up</kbd> <kbd>Page Down</kbd>: previous or next part
- <kbd>R</kbd>: replay from the start
- <kbd>M</kbd>: mute
- <kbd>C</kbd> or the **Chapters** button: open the chapter navigator

## Data

The demo fetches `https://browser-specs.github.io/data/specs.json` on every
load. The site serves it with `Access-Control-Allow-Origin: *`, so any origin
can read it with a plain `fetch()`, with no proxy or build step. When the live
fetch fails, the demo falls back to the snapshot in
[`public/data/specs.json`](public/data/specs.json).

## Sound

The soundtrack is generated with the Web Audio API at 160 BPM in C minor: a
half-time beat with a driven kick and snare, a saturated sub, and a wobble bass
that an LFO locked to the beat sweeps through a resonant lowpass, a vowel
filter, and a screeching high band, with two drive stages and bit-crushed grit.
Minor-ninth pads, delayed plucks, a lead, and vinyl crackle fill out the mix,
and a soft clipper and a compressor squeeze it.

The visuals read the same arrangement as the sequencer, so every kick, snare,
crash, and wobble lines up exactly. The wobble's filter sweep is computed from
the phrase being played, which lets the tunnel breathe, the skyline ripple, and
the image smear and glitch in step with what you hear. An equalizer with falling
peak caps runs along the bottom of the most referenced specs, and two sparse
chapters get a MilkDrop-style feedback of the waveform.

The voices use the Web Speech API. They read the numbers and the spec names as
each part presents them, and pronounce the jargon the way people say it (W3C is
"dub dub three see"). On macOS, the demo picks the robotic system voices such as
Fred and Zarvox. Elsewhere, it pitches an English voice down. The music ducks
while a voice speaks.

## Development

The project is based on
[three-starter](https://github.com/tomayac/three-starter).

```sh
npm install
npm run dev
```

| Command           | What it does                           |
| ----------------- | -------------------------------------- |
| `npm run dev`     | Starts the dev server with hot reload. |
| `npm run build`   | Builds the site into `docs/`.          |
| `npm run preview` | Serves `docs/` locally.                |

Production builds load three.js through
[Cross-Origin Storage](https://github.com/WICG/cross-origin-storage) where the
browser supports it, so visitors who already have the same three.js chunks from
another site skip the download.

GitHub Pages serves the `docs/` folder of `main`. On every push to `main`, a
GitHub Actions workflow rebuilds `docs/` and commits it when the output changed.

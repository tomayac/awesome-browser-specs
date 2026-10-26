<!--
SPDX-FileCopyrightText: 2026 Thomas Steiner
SPDX-License-Identifier: Apache-2.0
-->

# Awesome Browser Specs

A demoscene production about every spec the web runs on. It visualizes the data
behind [browser-specs.github.io](https://browser-specs.github.io/) in eight
parts, set to a chillstep soundtrack and robot voices that are all synthesized
live in the browser.

## Parts

| Key | Part            | What it shows                                                                |
| --- | --------------- | ---------------------------------------------------------------------------- |
| 1   | 641             | One particle per spec, gathering into the total                              |
| 2   | Engine triangle | Blink, Gecko, and WebKit, with every spec placed by the engines that ship it |
| 3   | Category tunnel | One ring per category, split by how many engines ship its specs              |
| 4   | Interop skyline | WPT pass rates per spec: interop first, then Chrome, Firefox, and Safari     |
| 5   | Going solo      | The specs that ship in only one engine                                       |
| 6   | Monoliths       | The most referenced specs, by platform footprint                             |
| 7   | Time warp       | Every spec ordered by its last update                                        |
| 8   | Greetings       | The standards organizations and working groups, in a sine scroller           |

Every number comes from the data at load time, so the demo changes as the specs
do.

## Controls

- <kbd>Space</kbd>: play or pause
- <kbd>1</kbd>–<kbd>8</kbd>: jump to a part
- <kbd>←</kbd> <kbd>→</kbd>: jump four bars
- <kbd>Page Up</kbd> <kbd>Page Down</kbd>: previous or next part
- <kbd>R</kbd>: replay from the start
- <kbd>M</kbd>: mute
- <kbd>F</kbd>: full screen

## Data

The demo fetches `https://browser-specs.github.io/data/specs.json` on every
load. The site serves it with `Access-Control-Allow-Origin: *`, so any origin
can read it with a plain `fetch()`, with no proxy or build step. When the live
fetch fails, the demo falls back to the snapshot in
[`data/specs.json`](data/specs.json).

## Sound

The soundtrack is generated with the Web Audio API at 136 BPM in C minor: a
half-time beat, a deep sub, beat-locked wobble bass in the drops, minor-ninth
pads, delayed plucks, a lead, and vinyl crackle. The visuals read the same
arrangement as the sequencer, so every kick, snare, and crash lines up exactly.

The voices use the Web Speech API. They read the numbers and the spec names as
each part presents them, and pronounce the jargon the way people say it (W3C is
"dub dub three see"). On macOS, the demo picks the robotic system voices such as
Fred and Zarvox. Elsewhere, it pitches an English voice down. The music ducks
while a voice speaks.

## Running locally

Serve the folder over `http://localhost`, for example:

```sh
python3 -m http.server 5180
```

Then open `http://localhost:5180/`. Three.js loads from jsDelivr through an
import map, and the typefaces load from Google Fonts.

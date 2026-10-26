// SPDX-FileCopyrightText: 2026 Thomas Steiner
// SPDX-License-Identifier: Apache-2.0

// Robotic announcements through the Web Speech API. Speech plays outside the
// Web Audio graph, so the music ducks while a voice talks.

// Standards jargon, spelled the way people say it
const PRONUNCIATIONS = [
  [/_/g, ' '],
  [/\bW3C\b/g, 'dub dub three see'],
  [/\bWHATWG\b/gi, 'what W G'],
  [/\bWICG\b/g, 'W I C G'],
  [/\bIETF\b/g, 'I E T F'],
  [/\bTC39\b/g, 'T C thirty-nine'],
  [/\bECMA\b/g, 'Ecma'],
  [/\bWebGL\b/gi, 'web G L'],
  [/\bWebGPU\b/gi, 'web G P U'],
  [/\bWebRTC\b/gi, 'web R T C'],
  [/\bWebXR\b/gi, 'web X R'],
  [/\bWebNN\b/gi, 'web N N'],
  [/\bWebIDL\b/gi, 'web I D L'],
  [/\bWASM\b/gi, 'wasm'],
  [/\bAVIF\b/g, 'ay-vif'],
  [/\bJPEG\b/g, 'jay-peg'],
  [/\bPNG\b/g, 'ping'],
  [/\bGLSL\b/g, 'G L S L'],
  [/\bARIA\b/g, 'aria'],
  [/\bWPT\b/g, 'W P T'],
  [/\bMDN\b/g, 'M D N'],
  [/\bCSSOM\b/g, 'C S S O M'],
  [
    /\b(CSS|HTML|SVG|HTTP|URL|API|IDL|UI|XR|RTC|JS|MIME|TLS|QUIC|IME|EME|MSE|OES|EXT|AV1|GPU|ES)\b/g,
    (acronym) => acronym.split('').join(' '),
  ],
  [/\bOpenGL\b/g, 'open G L'],
  [/\bES(\d)/g, 'E S $1'],
  [/\bAPIs\b/g, 'A P eyes'],
  [/®|™/g, ''],
  [/\+/g, ' and '],
];

export function pronounce(text) {
  return PRONUNCIATIONS.reduce(
    (spoken, [pattern, replacement]) => spoken.replace(pattern, replacement),
    text,
  );
}

// The most robotic voices macOS ships, then anything that speaks English
const ROBOTS = [
  'Zarvox',
  'Trinoids',
  'Ralph',
  'Fred',
  'Albert',
  'Junior',
  'Grandpa',
];

export class Speaker {
  constructor({ onSpeaking }) {
    this.onSpeaking = onSpeaking;
    this.enabled = 'speechSynthesis' in window;
    this.voices = [];
    this.pending = 0;
    this.muted = false;
    if (this.enabled) {
      const load = () => {
        this.voices = speechSynthesis.getVoices();
      };
      load();
      speechSynthesis.addEventListener('voiceschanged', load);
    }
  }

  voice(name) {
    const english = this.voices.filter((voice) => /^en/i.test(voice.lang));
    return (
      english.find((voice) => voice.name.startsWith(name)) ??
      english.find((voice) =>
        ROBOTS.some((robot) => voice.name.startsWith(robot)),
      ) ??
      english.find((voice) => voice.localService) ??
      english[0] ??
      null
    );
  }

  // `style` 'announcer' reads numbers and claims, 'name' reads spec names
  say(text, style = 'announcer') {
    if (!this.enabled || this.muted || !text) {
      return;
    }
    const utterance = new SpeechSynthesisUtterance(pronounce(text));
    const announcer = style === 'announcer';
    utterance.voice = this.voice(announcer ? 'Fred' : 'Zarvox');
    // A low pitch makes even a natural voice sound like a machine
    const robotic = ROBOTS.some((robot) =>
      utterance.voice?.name.startsWith(robot),
    );
    utterance.pitch = robotic ? 1 : announcer ? 0.2 : 0.4;
    utterance.rate = announcer ? 0.95 : 1.05;
    utterance.volume = 1;
    utterance.addEventListener('start', () => {
      this.pending++;
      this.onSpeaking(true);
    });
    const done = () => {
      this.pending = Math.max(0, this.pending - 1);
      if (!this.pending) {
        this.onSpeaking(false);
      }
    };
    utterance.addEventListener('end', done);
    utterance.addEventListener('error', done);
    // A voice that runs long gives way, so announcements stay on the beat
    if (speechSynthesis.speaking || speechSynthesis.pending) {
      speechSynthesis.cancel();
    }
    speechSynthesis.speak(utterance);
  }

  stop() {
    if (this.enabled) {
      speechSynthesis.cancel();
    }
    this.pending = 0;
    this.onSpeaking(false);
  }
}

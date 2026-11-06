// Sound effects, made on the spot with the Web Audio API so the site ships no
// audio files. As in Cribbage and Connect Four, every effect is built from two
// ingredients: a burst of filtered noise and a short tone. The fanfare for a
// perfect round is a brass ensemble of its own, in fanfare.js.

import { playFanfare } from './fanfare.js';

const noiseByContext = new WeakMap();

function noiseFor(context) {
  let buffer = noiseByContext.get(context);
  if (!buffer) {
    buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    noiseByContext.set(context, buffer);
  }
  return buffer;
}

// Fades a gain node in fast and out by `at + length`.
function shape(level, at, length, gain) {
  level.gain.setValueAtTime(0.0001, at);
  level.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.004, length / 3));
  level.gain.exponentialRampToValueAtTime(0.0001, at + length);
}

// `sweep` slides the pitch over the burst: above 1 rises; below 1 falls.
function burst(context, at, { length, pitch, sweep = 1, gain }) {
  const source = context.createBufferSource();
  source.buffer = noiseFor(context);
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(pitch, at);
  filter.frequency.exponentialRampToValueAtTime(pitch * sweep, at + length);
  const level = context.createGain();
  shape(level, at, length, gain);
  source.connect(filter).connect(level).connect(context.destination);
  source.start(at, Math.random() * 0.5, length + 0.01);
}

function tone(context, at, { length, pitch, glide = 1, gain, wave = 'sine' }) {
  const oscillator = context.createOscillator();
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(pitch, at);
  oscillator.frequency.exponentialRampToValueAtTime(pitch * glide, at + length);
  const level = context.createGain();
  shape(level, at, length, gain);
  oscillator.connect(level).connect(context.destination);
  oscillator.start(at);
  oscillator.stop(at + length + 0.01);
}

const EFFECTS = {
  // A right answer: two quick notes, up a fourth.
  right(context, at) {
    tone(context, at, { length: 0.12, pitch: 784, gain: 0.16, wave: 'triangle' });
    tone(context, at + 0.09, { length: 0.3, pitch: 1046, gain: 0.16, wave: 'triangle' });
  },

  // Right, but spelled with a slip: one note, sinking a little.
  slip(context, at) {
    tone(context, at, { length: 0.3, pitch: 880, glide: 0.94, gain: 0.15, wave: 'triangle' });
  },

  // A wrong answer: a soft step down, low enough not to sting.
  wrong(context, at) {
    tone(context, at, { length: 0.16, pitch: 311, gain: 0.2, wave: 'triangle' });
    tone(context, at + 0.14, { length: 0.34, pitch: 233, glide: 0.96, gain: 0.2, wave: 'triangle' });
    burst(context, at, { length: 0.05, pitch: 500, sweep: 0.6, gain: 0.12 });
  },

  // The end of a round that wasn't perfect: a short rising arpeggio.
  finish(context, at) {
    [523, 659, 784, 1046].forEach((pitch, i) =>
      tone(context, at + i * 0.09, { length: i === 3 ? 0.42 : 0.16, pitch, gain: 0.15, wave: 'triangle' }));
  },

  // About three seconds of brass and timpani, then the hall's ring.
  win(context, at) {
    playFanfare(context, at, noiseFor(context));
  },

  // A firework bursting: a soft thump and bang, then a scatter of crackles.
  firework(context, at) {
    tone(context, at, { length: 0.2, pitch: 110, glide: 0.45, gain: 0.25 });
    burst(context, at, { length: 0.16, pitch: 900, sweep: 0.4, gain: 0.4 });
    for (let i = 0; i < 7; i++) {
      burst(context, at + 0.12 + Math.random() * 0.4, { length: 0.012, pitch: 4000 + Math.random() * 2500, gain: 0.15 + Math.random() * 0.15 });
    }
  },
};

export const SOUNDS = Object.keys(EFFECTS);

// Schedules one effect on any audio context; the tests use an offline one.
export function renderSound(name, context, at = context.currentTime) {
  EFFECTS[name](context, at);
}

let context = null;
let muted = false;
let waking = false;

export function setMuted(value) {
  muted = value;
}

// Browsers only let a page make sound after a tap or key press, so this is
// called from every one of those.
export function unlockSound() {
  if (muted || !window.AudioContext) return;
  context ??= new AudioContext();
  if (context.state === 'running' || waking) return;
  waking = true;
  context
    .resume()
    .catch(() => {})
    .then(() => {
      waking = false;
    });
}

export function playSound(name, delay = 0) {
  // A suspended context would hoard sounds and play them all at once on waking.
  if (muted || !context || (context.state !== 'running' && !waking)) return;
  try {
    renderSound(name, context, context.currentTime + delay);
  } catch {
    // Sound is decoration: a browser that cannot make it must not stop the page.
  }
}

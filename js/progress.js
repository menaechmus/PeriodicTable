// What the quizzes have taught: for each quiz and element a step from 0
// (never asked) to 5, with counts of answers. Nothing here touches the page or
// storage; ui.js saves what this keeps.
//
// A right answer moves an element up a step; one never asked before goes
// straight to step 2, so three right in a row from new reach step 4,
// Mastered. A wrong answer drops it two steps (to no lower than 1). A slip,
// right but misspelled, scores but moves nothing up.

import { ELEMENTS } from './elements.js';

export const QUIZZES = ['name', 'symbol', 'weight', 'series'];
export const TOP = 5;
export const MASTERED = 4;
export const MAX_ROUNDS = 50;
export const SKIP_RECENT = 3; // the last few asked are left out of the next pick

// How likely an element is to be picked, by its step: the ones being learned
// come up most, the mastered ones now and then.
export const WEIGHTS = [3, 6, 4, 2, 1, 0.5];

export const LEVELS = [
  { key: 'new', label: 'New', plural: 'New', short: 'New' },
  { key: 'learning', label: 'Learning', plural: 'Learning', short: 'Learning' },
  { key: 'almost', label: 'Almost', plural: 'Almost', short: 'Almost' },
  { key: 'mastered', label: 'Mastered', plural: 'Mastered', short: 'Mastered' },
];

export function emptyProgress() {
  return { v: 1, items: Object.fromEntries(QUIZZES.map(quiz => [quiz, {}])), asked: 0, rounds: [], celebrated: {} };
}

// Pours saved data into the current shape, so a missing or damaged entry
// falls back to zero instead of breaking the page. (From Connect Four's stats.)
function fill(shape, saved) {
  if (typeof shape === 'string') return typeof saved === 'string' ? saved.slice(0, 40) : shape;
  if (Array.isArray(shape)) return shape.map((item, i) => fill(item, saved?.[i]));
  if (typeof shape === 'object') {
    return Object.fromEntries(Object.entries(shape).map(([key, item]) => [key, fill(item, saved?.[key])]));
  }
  return Number.isFinite(saved) ? saved : shape;
}

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = value => (Number.isInteger(value) && value > 0 ? value : 0);
const roundShape = () => ({ at: '', quiz: '', size: 0, asked: 0, right: 0, slips: 0, ms: 0 });

export function loadProgress(saved) {
  const progress = emptyProgress();
  if (!isObject(saved)) return progress;
  progress.asked = count(saved.asked);
  for (const quiz of QUIZZES) {
    const items = saved.items?.[quiz];
    if (!isObject(items)) continue;
    for (const [key, item] of Object.entries(items)) {
      const z = Number(key);
      if (!Number.isInteger(z) || z < 1 || z > ELEMENTS.length || !Array.isArray(item)) continue;
      const [step, right, wrong, slips, last] = [0, 1, 2, 3, 4].map(i => count(item[i]));
      if (right + wrong + slips === 0) continue;
      progress.items[quiz][z] = [Math.min(Math.max(step, 1), TOP), right, wrong, slips, Math.min(last, progress.asked)];
    }
  }
  if (Array.isArray(saved.rounds)) {
    progress.rounds = saved.rounds.filter(isObject).slice(-MAX_ROUNDS).map(round => fill(roundShape(), round));
  }
  if (isObject(saved.celebrated)) {
    for (const [key, value] of Object.entries(saved.celebrated)) {
      if (value === true && /^[a-z]+:\d+$/.test(key)) progress.celebrated[key] = true;
    }
  }
  return progress;
}

// [step, right, wrong, slips, last asked]
const itemOf = (progress, quiz, z) => progress.items[quiz][z] ?? [0, 0, 0, 0, 0];

export const stepOf = (progress, quiz, z) => itemOf(progress, quiz, z)[0];

export function recordOf(progress, quiz, z) {
  const [step, right, wrong, slips] = itemOf(progress, quiz, z);
  return { step, right, wrong, slips, level: levelOf(progress, quiz, z) };
}

export function levelOf(progress, quiz, z) {
  const step = stepOf(progress, quiz, z);
  if (step === 0) return 'new';
  if (step >= MASTERED) return 'mastered';
  return step === MASTERED - 1 ? 'almost' : 'learning';
}

// Keeps one answer ('right', 'slip' or 'wrong'); returns the step before and after.
export function record(progress, quiz, z, verdict) {
  const item = [...itemOf(progress, quiz, z)];
  const before = item[0];
  if (verdict === 'right') {
    item[0] = before === 0 ? 2 : Math.min(TOP, before + 1);
    item[1]++;
  } else if (verdict === 'slip') {
    item[0] = Math.max(before, 1);
    item[3]++;
  } else {
    item[0] = Math.max(1, before - 2);
    item[2]++;
  }
  progress.asked++;
  item[4] = progress.asked;
  progress.items[quiz][z] = item;
  return { before, after: item[0] };
}

// The next element to ask about from `pool`, weighted by step, leaving out the
// last few in `recent` (newest last) while there are others to ask.
export function pickNext(progress, quiz, pool, recent, random = Math.random) {
  const leaveOut = Math.min(SKIP_RECENT, pool.length - 1);
  const skip = new Set(leaveOut > 0 ? recent.slice(-leaveOut) : []);
  const choices = pool.filter(z => !skip.has(z));
  const weights = choices.map(z => WEIGHTS[stepOf(progress, quiz, z)]);
  let left = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < choices.length; i++) {
    left -= weights[i];
    if (left < 0) return choices[i];
  }
  return choices[choices.length - 1];
}

// How many of `pool` are at each level.
export function summarize(progress, quiz, pool) {
  const counts = { new: 0, learning: 0, almost: 0, mastered: 0 };
  for (const z of pool) counts[levelOf(progress, quiz, z)]++;
  return counts;
}

export const allMastered = (progress, quiz, pool) =>
  pool.length > 0 && pool.every(z => levelOf(progress, quiz, z) === 'mastered');

export function addRound(progress, round) {
  progress.rounds.push(fill(roundShape(), round));
  progress.rounds = progress.rounds.slice(-MAX_ROUNDS);
}

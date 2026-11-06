// What the quizzes have taught: for each quiz and element a step from 0
// (never asked) to 7, with counts of answers and the day it is next due for
// review. Nothing here touches the page or storage; ui.js saves what this
// keeps.
//
// A right answer moves an element up a step; one never asked before goes
// straight to step 2, so three right in a row from new reach step 4,
// Mastered. A mastered element comes back for review after 3 days, then a
// week, a month, and every 3 months after that. Answered right when it is
// due, it moves up a step to the next wait; answered right before then, the
// answer only counts, so one sitting can't rush it to the longest wait. A
// wrong answer drops it two steps (to no lower than 1), and one still
// Mastered comes back sooner. A slip, right but misspelled, scores but moves
// nothing up.

import { ELEMENTS } from './elements.js';

export const QUIZZES = ['name', 'symbol', 'weight', 'series'];
export const FORMAT = 2; // the shape of a save; 1 was before reviews
export const TOP = 7;
export const MASTERED = 4;
export const MAX_ROUNDS = 50;
export const SKIP_RECENT = 3; // the last few asked are left out of the next pick

// Days from reaching a step to its next review.
export const INTERVALS = { 4: 3, 5: 7, 6: 30, 7: 90 };

// How likely an element is to be picked: by its step while it is learned
// (new, 1, 2 and almost), then more often when a review is due than when not.
export const WEIGHTS = [3, 6, 4, 2];
export const DUE_WEIGHT = 5;
export const MASTERED_WEIGHT = 0.5;

export const LEVELS = [
  { key: 'new', label: 'New', plural: 'New', short: 'New' },
  { key: 'learning', label: 'Learning', plural: 'Learning', short: 'Learning' },
  { key: 'almost', label: 'Almost', plural: 'Almost', short: 'Almost' },
  { key: 'due', label: 'Due for review', plural: 'Due for review', short: 'Due' },
  { key: 'mastered', label: 'Mastered', plural: 'Mastered', short: 'Mastered' },
];

const DAY_MS = 86400000;

// The calendar day a time falls on where you are, counted from 1 January
// 1970, so a review falls due at your midnight.
export function dayOf(ms) {
  const date = new Date(ms);
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

// A day as it is said: "today", "tomorrow" or "Nov 8".
export function dayText(day, today) {
  if (day === today) return 'today';
  if (day === today + 1) return 'tomorrow';
  return new Date(day * DAY_MS).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const thisDay = () => dayOf(Date.now());

export function emptyProgress() {
  return { v: FORMAT, items: Object.fromEntries(QUIZZES.map(quiz => [quiz, {}])), asked: 0, rounds: [], celebrated: {} };
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
// kind is 'review' for a round of the reviews due, otherwise ''.
const roundShape = () => ({ at: '', quiz: '', size: 0, asked: 0, right: 0, slips: 0, ms: 0, kind: '' });

// A mastered element's review day: as saved, but never further off than its
// step's wait, and counted from today if it has none (a save from before
// reviews).
function scheduled(step, due, today) {
  if (step < MASTERED) return 0;
  const latest = today + INTERVALS[step];
  return due ? Math.min(due, latest) : latest;
}

export function loadProgress(saved, today = thisDay()) {
  const progress = emptyProgress();
  if (!isObject(saved)) return progress;
  progress.asked = count(saved.asked);
  for (const quiz of QUIZZES) {
    const items = saved.items?.[quiz];
    if (!isObject(items)) continue;
    for (const [key, item] of Object.entries(items)) {
      const z = Number(key);
      if (!Number.isInteger(z) || z < 1 || z > ELEMENTS.length || !Array.isArray(item)) continue;
      const [step, right, wrong, slips, last, due] = [0, 1, 2, 3, 4, 5].map(i => count(item[i]));
      if (right + wrong + slips === 0) continue;
      const kept = Math.min(Math.max(step, 1), TOP);
      progress.items[quiz][z] = [kept, right, wrong, slips, Math.min(last, progress.asked), scheduled(kept, due, today)];
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

// [step, right, wrong, slips, last asked, due day (0 until mastered)]
const itemOf = (progress, quiz, z) => progress.items[quiz][z] ?? [0, 0, 0, 0, 0, 0];

export const stepOf = (progress, quiz, z) => itemOf(progress, quiz, z)[0];

// Mastered, whether or not a review is due.
export const isMastered = (progress, quiz, z) => stepOf(progress, quiz, z) >= MASTERED;

export function recordOf(progress, quiz, z, today = thisDay()) {
  const [step, right, wrong, slips, , due] = itemOf(progress, quiz, z);
  return { step, right, wrong, slips, due, level: levelOf(progress, quiz, z, today) };
}

export function levelOf(progress, quiz, z, today = thisDay()) {
  const [step, , , , , due] = itemOf(progress, quiz, z);
  if (step === 0) return 'new';
  if (step >= MASTERED) return due <= today ? 'due' : 'mastered';
  return step === MASTERED - 1 ? 'almost' : 'learning';
}

// Keeps one answer ('right', 'slip' or 'wrong') given on `today`; returns the
// step before and after.
export function record(progress, quiz, z, verdict, today = thisDay()) {
  const item = [...itemOf(progress, quiz, z)];
  const [before, , , , , due] = item;
  const reschedule = () => {
    item[5] = item[0] >= MASTERED ? today + INTERVALS[item[0]] : 0;
  };
  if (verdict === 'right') {
    // Mastered and not yet due, the answer only counts.
    if (before < MASTERED || due <= today) {
      item[0] = before === 0 ? 2 : Math.min(TOP, before + 1);
      reschedule();
    }
    item[1]++;
  } else if (verdict === 'slip') {
    item[0] = Math.max(before, 1);
    item[3]++;
  } else {
    item[0] = Math.max(1, before - 2);
    reschedule();
    item[2]++;
  }
  progress.asked++;
  item[4] = progress.asked;
  progress.items[quiz][z] = item;
  return { before, after: item[0] };
}

// How likely z is to be the next pick.
export function weightOf(progress, quiz, z, today = thisDay()) {
  const level = levelOf(progress, quiz, z, today);
  if (level === 'due') return DUE_WEIGHT;
  if (level === 'mastered') return MASTERED_WEIGHT;
  return WEIGHTS[stepOf(progress, quiz, z)];
}

// The next element to ask about from `pool`, weighted by level, leaving out
// the last few in `recent` (newest last) while there are others to ask.
export function pickNext(progress, quiz, pool, recent, random = Math.random, today = thisDay()) {
  const leaveOut = Math.min(SKIP_RECENT, pool.length - 1);
  const skip = new Set(leaveOut > 0 ? recent.slice(-leaveOut) : []);
  const choices = pool.filter(z => !skip.has(z));
  const weights = choices.map(z => weightOf(progress, quiz, z, today));
  let left = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < choices.length; i++) {
    left -= weights[i];
    if (left < 0) return choices[i];
  }
  return choices[choices.length - 1];
}

// How many of `pool` are at each level.
export function summarize(progress, quiz, pool, today = thisDay()) {
  const counts = { new: 0, learning: 0, almost: 0, due: 0, mastered: 0 };
  for (const z of pool) counts[levelOf(progress, quiz, z, today)]++;
  return counts;
}

export const allMastered = (progress, quiz, pool) =>
  pool.length > 0 && pool.every(z => isMastered(progress, quiz, z));

// The elements due for review in a quiz, the longest overdue first.
export function dueList(progress, quiz, today = thisDay()) {
  return Object.entries(progress.items[quiz])
    .filter(([, item]) => item[0] >= MASTERED && item[5] <= today)
    .sort(([a, x], [b, y]) => x[5] - y[5] || a - b)
    .map(([z]) => Number(z));
}

// The first day after today that a review falls due in a quiz, or 0 if none.
export function nextDue(progress, quiz, today = thisDay()) {
  const days = Object.values(progress.items[quiz]).filter(item => item[0] >= MASTERED && item[5] > today).map(item => item[5]);
  return days.length ? Math.min(...days) : 0;
}

export function addRound(progress, round) {
  progress.rounds.push(fill(roundShape(), round));
  progress.rounds = progress.rounds.slice(-MAX_ROUNDS);
}

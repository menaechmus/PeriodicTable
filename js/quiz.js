// A round of quiz questions. Nothing here touches the page; ui.js asks for
// questions, shows them, and reports how each was answered.

import { ELEMENTS } from './elements.js';
import { hasStandardWeight } from './table.js';
import { pickNext } from './progress.js';

// The elements a quiz can draw on: 1 to N.
export const SETS = [20, 36, 54, 86, 118];

// Questions in a round; 0 keeps going until Finish.
export const LENGTHS = [10, 20, 0];

// The quizzes. Typed ones are answered in the box; the others by choosing.
export const QUIZ_KINDS = {
  name: { label: 'Symbol → name', typed: true },
  symbol: { label: 'Name → symbol', typed: true },
};

// The elements a quiz asks about, among the first `size`. The weight quiz
// keeps to elements with a standard atomic weight, and the series quiz leaves
// out 109 onwards, whose series are only predictions.
export function poolOf(quiz, size) {
  return ELEMENTS.filter(element =>
    element.z <= size &&
    (quiz !== 'weight' || hasStandardWeight(element)) &&
    (quiz !== 'series' || element.z < 109)).map(element => element.z);
}

// A round. With `order`, the questions are those elements in that order (as
// for practising the ones missed) instead of picks from the pool.
export function newRound(quiz, size, length, order = null) {
  return {
    quiz,
    size,
    length: order ? order.length : length,
    pool: order ? [...order] : poolOf(quiz, size),
    order,
    asked: [], // the elements asked so far, in order
    answers: [], // { z, verdict } for each answered
    streak: 0,
    best: 0,
  };
}

export const roundOver = round => round.length > 0 && round.answers.length >= round.length;

// The next element to ask about, or null when the round is over.
export function nextQuestion(round, progress, random = Math.random) {
  if (roundOver(round)) return null;
  const z = round.order ? round.order[round.asked.length] : pickNext(progress, round.quiz, round.pool, round.asked, random);
  round.asked.push(z);
  return z;
}

// Keeps how the current question was answered: 'right', 'slip' or 'wrong'.
export function answerQuestion(round, verdict) {
  const z = round.asked[round.asked.length - 1];
  round.answers.push({ z, verdict });
  if (verdict === 'wrong') {
    round.streak = 0;
  } else {
    round.streak++;
    round.best = Math.max(round.best, round.streak);
  }
}

// How the round went. Slips count as right.
export function scoreOf(round) {
  const right = round.answers.filter(answer => answer.verdict !== 'wrong').length;
  const slips = round.answers.filter(answer => answer.verdict === 'slip').length;
  const missed = [...new Set(round.answers.filter(answer => answer.verdict === 'wrong').map(answer => answer.z))];
  return { asked: round.answers.length, right, slips, wrong: round.answers.length - right, best: round.best, missed };
}

// A seeded random number generator (mulberry32), so a round can be repeated.
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The same list in a random order.
export function shuffled(list, random = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

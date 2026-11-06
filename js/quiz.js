// A round of quiz questions. Nothing here touches the page; ui.js asks for
// questions, shows them, and reports how each was answered.

import { ELEMENTS } from './elements.js';
import { CATEGORIES, hasStandardWeight, shortMass, categoryOf, placeOf, neighbour } from './table.js';
import { pickNext } from './progress.js';

// The elements a quiz can draw on: 1 to N.
export const SETS = [20, 36, 54, 86, 118];

// Questions in a round; 0 keeps going until Finish.
export const LENGTHS = [10, 20, 0];

// The quizzes. Typed ones are answered in the box; the others by choosing.
export const QUIZ_KINDS = {
  name: { label: 'Symbol → name', typed: true },
  symbol: { label: 'Name → symbol', typed: true },
  weight: { label: 'Atomic weight', typed: false },
  series: { label: 'Series', typed: false },
};

export const OPTIONS = 4; // choices in a multiple-choice question
export const WEIGHT_GAP = 0.3; // weights offered differ by at least this

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

// ---- Multiple choice ------------------------------------------------------------

const byZ = z => ELEMENTS[z - 1];
const weightOf = z => Number(shortMass(byZ(z)));
// 'Alkali metal' -> 'an alkali metal'.
export const withArticle = text => `${/^[aeiou]/i.test(text) ? 'an' : 'a'} ${text.toLowerCase()}`;
const cellsApart = (a, b) => {
  const [p, q] = [placeOf(a), placeOf(b)];
  return Math.abs(p.row - q.row) + Math.abs(p.column - q.column);
};

// The pool's other elements, nearest first by `distance`, ties in random order.
function nearest(z, pool, distance, random) {
  return pool
    .filter(other => other !== z)
    .map(other => ({ other, key: distance(z, other) + random() * 0.5 }))
    .sort((a, b) => a.key - b.key)
    .map(entry => entry.other);
}

const elementOption = z => ({ z, label: byZ(z).name, sym: byZ(z).sym, cat: byZ(z).cat });

// A question about element z for a multiple-choice quiz ('weight' or
// 'series'), with its wrong options drawn from `pool` (the elements of the
// set). It asks one of two ways at random:
//   weight: 'value' - iron's weight, from four weights;
//           'pick'  - the element with a given weight, from four elements;
//   series: 'which' - bromine's series, from four series;
//           'pick'  - the one element of a given series, from four.
// Returns { quiz, z, form, options: [{ label, z?, sym?, cat?, key? }],
// answer (the right option's index), explain }.
export function choiceQuestion(quiz, z, pool, random = Math.random) {
  const element = byZ(z);
  const pick = random() < 0.5;
  let others;
  let options;
  if (quiz === 'weight') {
    // The nearest elements by atomic number whose weights, to two decimals,
    // stand clear of the answer's and of each other's.
    others = [];
    for (const other of nearest(z, pool, (a, b) => Math.abs(a - b), random)) {
      if ([z, ...others].every(taken => Math.abs(weightOf(taken) - weightOf(other)) >= WEIGHT_GAP)) others.push(other);
      if (others.length === OPTIONS - 1) break;
    }
    options = [z, ...others].map(other => (pick ? elementOption(other) : { z: other, label: shortMass(byZ(other)) }));
  } else {
    if (pick) {
      // Elements of other series, nearest in the table first.
      others = nearest(z, pool.filter(other => byZ(other).cat !== element.cat), cellsApart, random).slice(0, OPTIONS - 1);
      options = [z, ...others].map(elementOption);
    } else {
      // The series of its neighbours first, then those in the set, then any.
      const near = [[0, -1], [0, 1], [-1, 0], [1, 0]].map(move => byZ(neighbour(z, ...move)).cat);
      const inSet = shuffled([...new Set(pool.map(other => byZ(other).cat))], random);
      const rest = shuffled(CATEGORIES.map(category => category.key), random);
      const keys = [...new Set([element.cat, ...shuffled(near, random), ...inSet, ...rest])].filter(key => key !== element.cat);
      others = keys.slice(0, OPTIONS - 1);
      options = [element.cat, ...others].map(key => ({ key, label: categoryOf(key).label }));
    }
  }
  const order = shuffled(options.map((_, i) => i), random);
  const shuffledOptions = order.map(i => options[i]);
  return {
    quiz,
    z,
    form: quiz === 'weight' ? (pick ? 'pick' : 'value') : pick ? 'pick' : 'which',
    options: shuffledOptions,
    answer: order.indexOf(0),
    explain: explanation(quiz, z, pick, options),
  };
}

// The prompt for a multiple-choice question, as text.
export function promptOf(question) {
  const element = byZ(question.z);
  if (question.quiz === 'weight') {
    return question.form === 'value'
      ? `What is the atomic weight of ${element.name.toLowerCase()} (${element.sym})?`
      : `Which element has an atomic weight of ${shortMass(element)}?`;
  }
  return question.form === 'which'
    ? `Which series is ${element.name.toLowerCase()} (${element.sym}) in?`
    : `Which of these is ${withArticle(categoryOf(element.cat).label)}?`;
}

// After the answer: each element on offer with its weight or series.
function explanation(quiz, z, pick, options) {
  const element = byZ(z);
  if (quiz === 'weight') {
    return [...options].sort((a, b) => a.z - b.z).map(option => `${byZ(option.z).sym} ${shortMass(byZ(option.z))}`).join(' · ');
  }
  if (pick) {
    return [...options].sort((a, b) => a.z - b.z).map(option => `${option.sym}: ${categoryOf(option.cat).label.toLowerCase()}`).join(' · ');
  }
  return `${element.name} is ${withArticle(categoryOf(element.cat).label)}.`;
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

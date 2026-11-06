// Checking a typed answer. Nothing here touches the page.
//
// Capital letters, accents, spaces, hyphens and full stops never matter, and
// names may be spelled either way where English has two (aluminium, sulphur,
// caesium). A symbol must be exactly right. A name of six letters or more is
// forgiven one slip - a letter wrong, missing, extra, or two swapped - unless
// what was typed is itself another element's name: "Cesium" for cerium is a
// different element, not a slip.

import { ELEMENTS } from './elements.js';

export const SLIP_FROM = 6; // names at least this long forgive a slip

export function normalize(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s\-‐–'’.]/g, '');
}

// Edits to turn a into b: letters changed, added or dropped, and neighbours
// swapped (the optimal string alignment distance).
export function distance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[a.length][b.length];
}

const BY_NAME = new Map(); // every accepted spelling, normalized
const BY_SYMBOL = new Map();
for (const element of ELEMENTS) {
  for (const name of [element.name, ...element.also]) BY_NAME.set(normalize(name), element.z);
  BY_SYMBOL.set(element.sym.toLowerCase(), element.z);
}

// What a typed answer was, asked for element z's name (kind 'name') or symbol
// (kind 'symbol'):
//   right - exactly right
//   slip  - a long name with one slip; it scores, but isn't learned
//   wrong - anything else; `named` is the element it does name, if any (a
//           name typed for a symbol names its own element)
//   empty - nothing typed, which isn't an answer at all
export function checkAnswer(z, kind, typed) {
  const answer = normalize(typed);
  if (!answer) return { verdict: 'empty', named: null };
  if (kind === 'symbol') {
    const named = BY_SYMBOL.get(answer) ?? BY_NAME.get(answer) ?? null;
    return { verdict: named === z && BY_SYMBOL.has(answer) ? 'right' : 'wrong', named };
  }
  const named = BY_NAME.get(answer) ?? null;
  if (named === z) return { verdict: 'right', named };
  if (named !== null) return { verdict: 'wrong', named };
  const element = ELEMENTS[z - 1];
  const slipped = [element.name, ...element.also]
    .map(normalize)
    .some(spelling => spelling.length >= SLIP_FROM && distance(answer, spelling) === 1);
  return slipped ? { verdict: 'slip', named: z } : { verdict: 'wrong', named: BY_SYMBOL.get(answer) ?? null };
}

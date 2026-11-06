// Everything on the page: the table, an element's details, Find and the key,
// the quiz and the record of what it has taught, sound, and the About box.
// The elements are in elements.js and where they go in table.js; answers,
// proficiency and rounds are worked out in answers.js, progress.js and
// quiz.js. This file draws them and turns taps, slides and keys into what is
// shown.

import { ELEMENTS } from './elements.js';
import {
  CATEGORIES, BLOCKS, STATES, PLACEHOLDERS, byNumber, categoryOf, placeOf, neighbour,
  shellsOf, stateOf, temperature, density, yearText, configHtml, minus, findElements, shortMass,
} from './table.js';
import { checkAnswer } from './answers.js';
import {
  LEVELS, emptyProgress, loadProgress, record, levelOf, recordOf, isMastered, summarize, allMastered, addRound,
  nextDue, dayOf, dayText,
} from './progress.js';
import {
  SETS, REVIEW_MOST, QUIZ_KINDS, poolOf, dueIn, newRound, nextQuestion, answerQuestion, roundOver, scoreOf, seeded, shuffled,
  choiceQuestion, withArticle,
} from './quiz.js';
import { playSound, setMuted, unlockSound } from './sound.js';
import { startParty } from './celebrate.js';

// Shown in the About box. Bump both with every release: a browser still
// running a cached copy of this file then shows the old number.
const VERSION = '1.3.0';
const RELEASED = '5 November 2026';

const SETTINGS_KEY = 'periodic.settings';
const PROGRESS_KEY = 'periodic.progress';
const BIGGEST_CELL = 64; // px: a tile never grows past this
const WIDE_CELL = 44; // px: tiles this big leave room for the key in the table's empty corner
const SIDE_KEY = 200; // px: the column beside the table on a phone on its side
const ABOVE_AND_BELOW = 78; // px: the controls above the table and the line below it
const SWALLOW_MS = 500; // a click this soon after a finger lifts belongs to that touch
const RIGHT_MS = 800; // a right answer shows this long before the next question
const CHEER_MS = 3500; // fireworks over the results; a tap or key ends them sooner
const PERFECT_FROM = 10; // a perfect round of at least this many questions is celebrated

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);

// ?store=NAME keeps this page's storage under keys of its own, so that the
// test driver can run without touching what is saved here.
const STORE = params.get('store');
const keyed = key => (STORE ? `${key}:${STORE}` : key);

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(keyed(key)));
  } catch {
    return null;
  }
}

function store(key, value) {
  try {
    if (value === null) localStorage.removeItem(keyed(key));
    else localStorage.setItem(keyed(key), JSON.stringify(value));
  } catch {
    // Storage can be switched off (private browsing); the page still works.
  }
}

// ?seed=N asks the same questions every time, for the test driver.
const SEED = Number(params.get('seed'));
const random = SEED ? seeded(SEED) : Math.random;

// Buttons carry their value as text: "true", "20", "block".
function parseValue(text) {
  if (text === 'true' || text === 'false') return text === 'true';
  return /^\d+$/.test(text) ? Number(text) : text;
}

// Saved settings are only accepted if the page offers that value.
function loadSettings() {
  const settings = { color: 'category', quiz: 'name', set: 20, length: 10, shows: 'name', sound: true };
  const saved = load(SETTINGS_KEY);
  for (const group of document.querySelectorAll('.choice[data-setting]')) {
    const key = group.dataset.setting;
    const offered = [...group.children].map(button => parseValue(button.dataset.value));
    if (offered.includes(saved?.[key])) settings[key] = saved[key];
  }
  if (typeof saved?.sound === 'boolean') settings.sound = saved.sound;
  return settings;
}

// Today, as the day number reviews are counted in.
const today = () => dayOf(Date.now());

const settings = loadSettings();
const savedProgress = load(PROGRESS_KEY);
const progress = loadProgress(savedProgress, today());
const saveProgress = () => store(PROGRESS_KEY, progress);
// A save from before reviews is written again with the review days it has
// just been given, so they don't move on each day the page is opened.
if (savedProgress?.v === 1) saveProgress();
const touchFirst = matchMedia('(pointer: coarse)').matches;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const table = $('ptable');

let view = 'explore'; // the page showing: 'explore' (the table), 'quiz' or 'progress'
let current = null; // the element in the details box, or last in it
let pointed = null; // the element under the mouse or a finger, or reached by the arrow keys
let slide = null; // the finger on the table: its pointer id
let swallowUntil = 0; // the click that follows a lifted finger is dropped
let picked = null; // the key entry whose elements are picked out
let found = []; // the elements Find matches, best first
let opener = null; // what had the focus before the details box opened
// The quiz
let round = null; // the round being played (see quiz.js)
let choice = null; // a multiple-choice question being asked (see choiceQuestion)
let phase = 'setup'; // 'setup', 'asking', 'feedback' or 'done'
let started = 0; // when the round began
let masteredBefore = new Set(); // the elements already mastered when it began
let lastMissed = []; // the elements missed in the round just finished
let onwardTimer = 0; // moves on after a right answer
let celebrating = 0; // timer while the fireworks hold the stage
let party = null; // the fireworks and confetti, which outlast the celebration a little
let skipClick = false; // the tap that skipped the fireworks does nothing else
let resetArmed = false;

setMuted(!settings.sound);

// The legend for each way of colouring the table, and the cell attribute it reads.
const KEYS = {
  category: { list: CATEGORIES, attr: 'cat' },
  block: { list: BLOCKS, attr: 'block' },
  state: { list: STATES, attr: 'state' },
  progress: { list: LEVELS, attr: 'level' },
};
const mode = () => table.dataset.color;

const setLabel = size => (size >= ELEMENTS.length ? 'All 118' : `1–${size}`);
// "5 mastered, 2 due, 1 almost, 3 learning, 9 new", leaving out due when none are.
const countsText = counts =>
  [`${counts.mastered} mastered`, counts.due ? `${counts.due} due` : '', `${counts.almost} almost`,
    `${counts.learning} learning`, `${counts.new} new`].filter(Boolean).join(', ');

// ---- The table ------------------------------------------------------------

function buildTable() {
  const parts = [];
  for (const element of ELEMENTS) {
    const place = placeOf(element.z);
    parts.push(
      `<button class="cell" data-z="${element.z}" data-cat="${element.cat}" data-block="${place.block}"` +
        ` data-state="${stateOf(element)}" data-level="new"${element.name.length > 10 ? ' data-long' : ''}` +
        ` style="grid-row:${place.row};grid-column:${place.column}" tabindex="${element.z === 1 ? 0 : -1}"` +
        ` aria-label="${element.z}, ${element.name}, ${element.sym}">` +
        `<span class="num">${element.z}</span><span class="sym">${element.sym}</span>` +
        `<span class="name">${element.name}</span><span class="mass">${element.mass}</span></button>`,
    );
  }
  for (const spot of PLACEHOLDERS) {
    parts.push(
      `<div class="cell ref" data-cat="${spot.cat}" data-block="f" aria-hidden="true"` +
        ` style="grid-row:${spot.row};grid-column:${spot.column}"><span class="sym">${spot.label}</span></div>`,
    );
  }
  parts.push('<div id="preview" class="preview" aria-hidden="true"></div>');
  table.innerHTML = parts.join('');
}

const cellFor = z => table.querySelector(`.cell[data-z="${z}"]`);
const cellOf = target => target?.closest?.('.cell[data-z]') ?? null;
const zOf = cell => (cell ? Number(cell.dataset.z) : null);
// The element under a point on the screen, whatever the pointer is captured by.
const zAt = event => zOf(cellOf(document.elementFromPoint(event.clientX, event.clientY)));

// Shows z in the preview; `mark` outlines its tile, as for a finger or the
// mouse (the keyboard has its own focus ring).
function point(z, mark = true) {
  pointed = z;
  for (const cell of table.querySelectorAll('.cell.at')) cell.classList.remove('at');
  if (z && mark) cellFor(z).classList.add('at');
  renderPreview();
}

function tileHtml(element, withMass = false) {
  return `<span class="num">${element.z}</span><span class="sym">${element.sym}</span>` +
    (withMass ? `<span class="mass">${element.mass}</span>` : '');
}

function renderPreview() {
  const preview = $('preview');
  const z = pointed ?? found[0] ?? current;
  preview.dataset.z = z ?? '';
  if (!z) {
    preview.innerHTML = `<p class="preview-hint">${touchFirst
      ? 'Tap an element, or slide a finger across the table.'
      : 'Point at an element, or click it for its details.'}</p>`;
    return;
  }
  const element = byNumber(z);
  preview.innerHTML =
    `<div class="tile" data-cat="${element.cat}">${tileHtml(element)}</div>` +
    `<div class="preview-text"><b>${element.name}</b><span>${element.mass}</span>` +
    `<span>${categoryOf(element.cat).label}</span></div>`;
}

function markCurrent() {
  for (const cell of table.querySelectorAll('.cell.current')) cell.classList.remove('current');
  if (!current) return;
  const cell = cellFor(current);
  cell.classList.add('current');
  // Tab comes back into the table at the element last opened.
  for (const other of table.querySelectorAll('.cell[tabindex="0"]')) other.tabIndex = -1;
  cell.tabIndex = 0;
}

// A finger (or pen) can slide across the table: the element under it shows in
// the preview, and lifting it opens that element. The mouse points by
// hovering and opens by clicking.
table.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse' || !event.isPrimary) return;
  slide = event.pointerId;
  try {
    table.setPointerCapture(event.pointerId);
  } catch {
    // A made-up pointer (the test driver's) cannot be captured; it needn't be.
  }
  point(zAt(event));
});

table.addEventListener('pointermove', event => {
  if (event.pointerType === 'mouse') {
    const z = zOf(cellOf(event.target));
    if (z !== pointed) point(z);
  } else if (event.pointerId === slide) {
    const z = zAt(event);
    if (z !== pointed) point(z);
  }
});

table.addEventListener('pointerup', event => {
  if (event.pointerId !== slide) return;
  slide = null;
  const z = zAt(event);
  point(null);
  swallowUntil = performance.now() + SWALLOW_MS;
  if (z) openDetails(z);
});

table.addEventListener('pointercancel', event => {
  if (event.pointerId !== slide) return;
  slide = null;
  point(null);
});

table.addEventListener('pointerleave', event => {
  if (event.pointerType === 'mouse' && pointed) point(null);
});

// A mouse click, or Enter or Space on a focused tile.
table.addEventListener('click', event => {
  if (performance.now() < swallowUntil) {
    swallowUntil = 0;
    return;
  }
  const z = zOf(cellOf(event.target));
  if (z) openDetails(z);
});

const ARROWS = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };

table.addEventListener('keydown', event => {
  const z = zOf(cellOf(event.target));
  const move = ARROWS[event.key];
  if (!z || !move || event.altKey || event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  const next = neighbour(z, ...move);
  for (const cell of table.querySelectorAll('.cell[tabindex="0"]')) cell.tabIndex = -1;
  const cell = cellFor(next);
  cell.tabIndex = 0;
  cell.focus();
  point(next, false);
});

table.addEventListener('focusin', event => {
  const z = zOf(cellOf(event.target));
  if (z && event.target.matches(':focus-visible')) point(z, false);
});

table.addEventListener('focusout', () => {
  if (pointed && slide === null) point(null);
});

// ---- The key and Find -----------------------------------------------------

// How many tiles have each value of a cell attribute.
function countBy(attr) {
  const counts = {};
  for (const cell of table.querySelectorAll('.cell[data-z]')) counts[cell.dataset[attr]] = (counts[cell.dataset[attr]] ?? 0) + 1;
  return counts;
}

function renderLegend() {
  const { list, attr } = KEYS[mode()];
  const counts = mode() === 'progress' ? countBy(attr) : null;
  $('legend').innerHTML = list
    .map(item => {
      const label = counts ? `${item.plural} ${counts[item.key] ?? 0}` : item.plural;
      const short = counts ? `${item.short} ${counts[item.key] ?? 0}` : item.short;
      return `<button class="chip" data-key="${item.key}" aria-pressed="${picked === item.key}" aria-label="${label}">` +
        `<i style="--fill: var(--${item.key})"></i><span class="long">${label}</span>` +
        `<span class="short" aria-hidden="true">${short}</span></button>`;
    })
    .join('');
}

// Fades all but the elements Find matches, or else those of the key entry picked.
function renderPicks() {
  const { attr } = KEYS[mode()];
  const lit = view === 'explore' && $('find').value.trim() ? new Set(found) : null;
  table.classList.toggle('picking', Boolean(lit) || picked !== null);
  for (const cell of table.querySelectorAll('.cell')) {
    const on = lit ? lit.has(zOf(cell)) : picked !== null && cell.dataset[attr] === picked;
    cell.classList.toggle('lit', on);
  }
  renderHint();
}

function renderHint() {
  const text = view === 'explore' ? $('find').value.trim() : '';
  let hint = '';
  if (text && !found.length) hint = `No element matches “${text}”.`;
  else if (found.length === 1) hint = `${byNumber(found[0]).name}: press Enter to open it.`;
  else if (found.length) hint = `${found.length} elements match; Enter opens ${byNumber(found[0]).name}.`;
  else if (picked !== null) {
    const { list, attr } = KEYS[mode()];
    const count = ELEMENTS.filter(element => cellFor(element.z).dataset[attr] === picked).length;
    hint = `${list.find(item => item.key === picked).plural}: ${count} element${count === 1 ? '' : 's'}.`;
  } else if (view === 'progress') {
    hint = `${QUIZ_KINDS[settings.shows].label}: ${countsText(summarize(progress, settings.shows, poolOf(settings.shows, ELEMENTS.length), today()))}.`;
  }
  $('hint').textContent = hint;
}

$('find').addEventListener('input', () => {
  found = findElements($('find').value);
  renderPicks();
  renderPreview();
});

$('find').addEventListener('keydown', event => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  if (found.length) openDetails(found[0]);
});

function clearFind() {
  $('find').value = '';
  found = [];
}

$('legend').addEventListener('click', event => {
  const chip = event.target.closest('.chip');
  if (!chip) return;
  picked = picked === chip.dataset.key ? null : chip.dataset.key;
  clearFind();
  renderLegend();
  renderPicks();
  renderPreview();
});

function renderSettings() {
  for (const group of document.querySelectorAll('.choice[data-setting]')) {
    for (const button of group.children) {
      button.setAttribute('aria-pressed', String(parseValue(button.dataset.value) === settings[group.dataset.setting]));
    }
  }
  table.dataset.color = view === 'progress' ? 'progress' : settings.color;
  $('btn-sound').setAttribute('aria-pressed', String(settings.sound));
  renderLegend();
  renderPicks();
}

for (const button of document.querySelectorAll('.choice[data-setting] button')) {
  button.addEventListener('click', () => {
    const key = button.parentElement.dataset.setting;
    settings[key] = parseValue(button.dataset.value);
    store(SETTINGS_KEY, settings);
    picked = null;
    if (key === 'shows') renderLevels();
    renderSettings();
    renderPreview();
    if (view === 'progress') renderProgressView();
    if (view === 'quiz') renderSetup();
  });
}

// ---- An element's details ---------------------------------------------------

const facts = rows => {
  const html = rows
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`)
    .join('');
  return html ? `<dl class="facts">${html}</dl>` : '';
};

const section = (title, body) => (body ? `<section><h3>${title}</h3>${body}</section>` : '');

// The shells as rings, with the electrons spaced evenly round each.
function bohrSvg(element, shells) {
  const nucleus = 16;
  const step = 13;
  const half = Math.max(nucleus + step * shells.length + 8, 60);
  const parts = [
    `<svg class="bohr" viewBox="${-half} ${-half} ${half * 2} ${half * 2}" role="img"` +
      ` aria-label="Electron shells: ${shells.join(', ')}">`,
  ];
  shells.forEach((count, i) => {
    const r = nucleus + step * (i + 1);
    parts.push(`<circle class="ring" r="${r}"/>`);
    for (let k = 0; k < count; k++) {
      const angle = (2 * Math.PI * k) / count - Math.PI / 2 + i * 0.35;
      parts.push(`<circle class="electron" cx="${(r * Math.cos(angle)).toFixed(2)}"` +
        ` cy="${(r * Math.sin(angle)).toFixed(2)}" r="2.6"/>`);
    }
  });
  parts.push(`<circle class="nucleus" r="${nucleus}"/><text y="4.5" text-anchor="middle">${element.sym}</text></svg>`);
  return parts.join('');
}

// Your record with this element, in each quiz that asks about it, and when a
// mastered one comes up for review.
function yoursHtml(element) {
  const day = today();
  return facts(Object.keys(QUIZ_KINDS)
    .filter(quiz => poolOf(quiz, ELEMENTS.length).includes(element.z))
    .map(quiz => {
      const mine = recordOf(progress, quiz, element.z, day);
      const answered = mine.right + mine.slips + mine.wrong;
      const level = LEVELS.find(item => item.key === mine.level).label;
      const review = mine.level === 'mastered' ? ` · next review ${dayText(mine.due, day)}` : '';
      return [QUIZ_KINDS[quiz].label, answered ? `${level} · ${mine.right + mine.slips} of ${answered} right${review}` : 'Not asked yet'];
    }));
}

function renderDetails() {
  const element = byNumber(current);
  const place = placeOf(element.z);
  const shells = shellsOf(element.config);
  const box = $('details');
  box.dataset.z = element.z;
  box.querySelector('.details').dataset.cat = element.cat;
  $('details-tile').dataset.cat = element.cat;
  $('details-tile').innerHTML = tileHtml(element, true);
  $('details-name').textContent = element.name;
  $('details-cat').textContent = categoryOf(element.cat).label;

  const state = STATES.find(item => item.key === element.state).label + (element.expected ? ' (expected)' : '');
  const bracketed = element.mass.startsWith('[');
  const basics = facts([
    ['Atomic number', element.z],
    ['Atomic weight', element.mass],
    ['Series', categoryOf(element.cat).label],
    ['Group', place.group],
    ['Period', place.period],
    ['Block', place.block],
    ['At room temperature', state],
  ]) + (bracketed
    ? `<p class="muted">It has no standard atomic weight: ${element.mass.slice(1, -1)} is the mass number of its longest-lived isotope.</p>`
    : '');
  const atom =
    `<div class="atom">${bohrSvg(element, shells)}<p class="muted">Electrons in each shell: ${shells.join(', ')}</p></div>` +
    facts([
      ['Electron configuration', configHtml(element.config) + (element.predicted ? ' <span class="muted">(predicted)</span>' : '')],
      ['Electronegativity', element.en],
      ['Van der Waals radius', element.radius && `${element.radius} pm`],
      ['Ionization energy', element.ie && `${element.ie} eV`],
      ['Electron affinity', element.ea && `${element.ea} eV`],
      ['Oxidation states', element.ox && minus(element.ox)],
    ]);
  const physical = facts([
    ['Melting point', temperature(element.mp, element.notes.mp)],
    ['Boiling point', temperature(element.bp, element.notes.bp)],
    ['Density', density(element)],
  ]);
  const history = facts([['Discovered', yearText(element.year)]]) + `<p>${element.origin}</p>`;
  $('details-body').innerHTML = [
    section('Basics', basics),
    section('Atom', atom),
    section('Physical', physical),
    section('History and name', history),
    section('Known for', `<p>${element.fact}</p>`),
    section('Your progress', yoursHtml(element)),
  ].join('');

  const prev = element.z > 1 ? byNumber(element.z - 1) : null;
  const next = element.z < ELEMENTS.length ? byNumber(element.z + 1) : null;
  $('btn-prev').disabled = !prev;
  $('btn-prev').textContent = prev ? `‹ ${prev.z} ${prev.sym}` : '‹';
  $('btn-prev').setAttribute('aria-label', prev ? `Previous: ${prev.name}` : 'Previous');
  $('btn-next').disabled = !next;
  $('btn-next').textContent = next ? `${next.z} ${next.sym} ›` : '›';
  $('btn-next').setAttribute('aria-label', next ? `Next: ${next.name}` : 'Next');
}

function openDetails(z) {
  const box = $('details');
  if (box.hidden) opener = document.activeElement;
  current = z;
  renderDetails();
  markCurrent();
  box.hidden = false;
  box.scrollTop = 0;
  const dialog = box.querySelector('.details');
  dialog.scrollTop = 0;
  dialog.focus({ preventScroll: true });
}

function closeDetails() {
  $('details').hidden = true;
  if (opener?.isConnected && opener !== document.body) opener.focus({ preventScroll: true });
  opener = null;
  renderPreview();
}

function step(by) {
  const z = current + by;
  if (z >= 1 && z <= ELEMENTS.length) openDetails(z);
}

$('btn-prev').addEventListener('click', () => step(-1));
$('btn-next').addEventListener('click', () => step(1));

// ---- Pages ------------------------------------------------------------------

// Shows one page. The table and its key move between the Table page and the
// Progress page, where they are coloured by how well each element is known.
function show(next) {
  view = next;
  for (const id of ['explore', 'quiz', 'progress']) $(id).hidden = id !== view;
  for (const button of $('tabs').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.view === view));
  resetArmed = false;
  $('btn-reset').textContent = 'Reset progress';
  if (view === 'quiz') {
    if (phase === 'setup') renderSetup();
    if ((phase === 'asking' || phase === 'feedback') && typed()) focusAnswer();
  } else {
    $('answer').blur(); // a phone's keyboard goes away with the quiz
    (view === 'progress' ? $('progress-tools') : $('toolbar')).after($('board-wrap'), $('hint'));
    clearFind();
    picked = null;
    pointed = null;
    if (view === 'progress') {
      renderLevels();
      renderProgressView();
    }
    renderSettings();
    renderPreview();
    fit();
  }
  window.scrollTo(0, 0);
}

$('tabs').addEventListener('click', event => {
  const button = event.target.closest('button[data-view]');
  if (button) show(button.dataset.view);
});

// ---- The quiz -----------------------------------------------------------------

function setPhase(next) {
  phase = next;
  $('quiz').dataset.phase = next;
  $('quiz-setup').hidden = next !== 'setup';
  $('quiz-ask').hidden = next !== 'asking' && next !== 'feedback';
  $('quiz-done').hidden = next !== 'done';
}

function masteryBar(counts, total) {
  const parts = ['mastered', 'due', 'almost', 'learning', 'new']
    .map(key => `<i style="--fill: var(--${key}); width: ${((100 * counts[key]) / total).toFixed(2)}%"></i>`);
  return `<div class="bar" role="img" aria-label="${countsText(counts)}">${parts.join('')}</div>`;
}

// The set chosen, how well it's known, and the reviews due in the quiz
// chosen (from the whole table), or the day the next one is.
function renderSetup() {
  const day = today();
  const pool = poolOf(settings.quiz, settings.set);
  const counts = summarize(progress, settings.quiz, pool, day);
  $('setup-mastery').innerHTML = masteryBar(counts, pool.length) +
    `<p class="muted">${setLabel(settings.set)}: ${countsText(counts)}</p>`;
  const due = dueIn(progress, settings.quiz, day).length;
  const next = nextDue(progress, settings.quiz, day);
  $('btn-review').hidden = !due;
  $('btn-review').textContent = due > REVIEW_MOST ? `Review ${REVIEW_MOST} of ${due} due` : `Review ${due} due`;
  $('setup-next').hidden = Boolean(due) || !next;
  $('setup-next').textContent = next ? `Next review: ${dayText(next, day)}` : '';
  renderDue(day);
}

// A count of the reviews due: on each quiz's button in the setup, and their
// total on the Quiz tab.
function renderDue(day = today()) {
  let total = 0;
  for (const button of document.querySelectorAll('#quiz-setup [data-setting=quiz] button')) {
    const due = dueIn(progress, button.dataset.value, day).length;
    total += due;
    countOn(button, due);
  }
  countOn($('tabs').querySelector('[data-view=quiz]'), total);
}

function countOn(button, count) {
  let badge = button.querySelector('.due-count');
  if (!count) {
    badge?.remove();
    button.removeAttribute('aria-label');
    return;
  }
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'due-count';
    badge.setAttribute('aria-hidden', 'true');
    button.append(badge);
  }
  badge.textContent = count;
  button.setAttribute('aria-label', `${button.firstChild.textContent}, ${count} due for review`);
}

const focusAnswer = () => $('answer').focus({ preventScroll: true });
const typed = () => Boolean(round && QUIZ_KINDS[round.quiz].typed);

// Start, Review, Again and Practice the misses all come here, inside the tap,
// so that focusing the answer box brings up a phone's keyboard. A
// multiple-choice round puts the keyboard away instead. `order` asks those
// elements in turn; `size` is the set that multiple-choice options come from.
function startRound({ order = null, size = settings.set, review = false } = {}) {
  clearTimeout(onwardTimer);
  endCelebration(true);
  round = newRound(settings.quiz, size, settings.length, order, review);
  masteredBefore = new Set(round.pool.filter(z => isMastered(progress, round.quiz, z)));
  started = Date.now();
  $('quiz').dataset.kind = typed() ? 'typed' : 'choice';
  ask();
  if (typed()) focusAnswer();
  else $('answer').blur();
}

// The reviews due in the quiz chosen, longest overdue first, from the whole table.
function startReview() {
  const due = dueIn(progress, settings.quiz, today()).slice(0, REVIEW_MOST);
  if (due.length) startRound({ order: due, size: ELEMENTS.length, review: true });
}

function ask() {
  const z = nextQuestion(round, progress, random, today());
  if (z === null) {
    finishRound();
    return;
  }
  setPhase('asking');
  if (typed()) renderQuestion(z);
  else renderChoice(z);
}

const question = () => round.asked[round.asked.length - 1];

function renderQuestion(z) {
  const element = byNumber(z);
  $('quiz').dataset.z = z;
  const tile = $('prompt-tile');
  tile.dataset.cat = element.cat;
  tile.classList.remove('plain');
  if (round.quiz === 'name') {
    tile.innerHTML = tileHtml(element);
    $('prompt-text').innerHTML = '<span>What is this element called?</span>';
    $('answer').placeholder = 'Its name';
  } else {
    tile.innerHTML = `<span class="num">${element.z}</span><span class="sym">?</span>`;
    $('prompt-text').innerHTML = `<b>${element.name}</b><span>What is its symbol?</span>`;
    $('answer').placeholder = 'Its symbol';
  }
  renderCount();
  renderScore();
  $('answer').value = '';
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  $('btn-check').hidden = false;
  $('btn-showme').hidden = false;
  $('btn-onward').hidden = true;
}

// "Question 3 of 10", or "Review 3 of 5".
function renderCount() {
  const n = round.asked.length;
  const word = round.review ? 'Review' : 'Question';
  $('quiz-count').textContent = round.length ? `${word} ${n} of ${round.length}` : `${word} ${n}`;
}

function renderScore() {
  const score = scoreOf(round);
  $('quiz-score').textContent = `${score.right} right` + (round.streak >= 2 ? ` · ${round.streak} in a row` : '');
}

function check() {
  const result = checkAnswer(question(), round.quiz, $('answer').value);
  if (result.verdict === 'empty') {
    $('answer').value = '';
    $('answer').placeholder = 'Type it, or Show me';
    return;
  }
  settle(result);
}

// Keeps the answer, says how it went, and moves on by itself after a right one.
function settle(result) {
  const z = question();
  const verdict = result.verdict === 'empty' ? 'wrong' : result.verdict;
  record(progress, round.quiz, z, verdict, today());
  saveProgress();
  renderDue();
  answerQuestion(round, verdict);
  setPhase('feedback');
  renderFeedback(z, verdict, result);
  renderScore();
  playSound(verdict);
  if (verdict === 'right') onwardTimer = setTimeout(onward, RIGHT_MS);
}

function renderFeedback(z, verdict, result) {
  const element = byNumber(z);
  const named = result.named ? byNumber(result.named) : null;
  const root = element.root ? ` The symbol comes from ${element.root}.` : '';
  let text;
  if (verdict === 'right') text = `✓ Right: ${element.name}, ${element.sym}.`;
  else if (verdict === 'slip') text = `✓ Right, but it's spelled ${element.name}.`;
  else if (result.shown) text = `It's ${element.name}, ${element.sym}.${root}`;
  else if (named && named.z === z) {
    text = round.quiz === 'symbol' ? `✗ That's its name. Its symbol is ${element.sym}.${root}` : `✗ That's its symbol. It's ${element.name}.`;
  } else if (named) text = `✗ That's ${named.sym}, ${named.name}. This is ${element.name}, ${element.sym}.${root}`;
  else text = `✗ It's ${element.name}, ${element.sym}.${root}`;
  $('feedback').textContent = text;
  $('feedback').className = `feedback ${verdict}`;
  // The answer goes on the tile.
  $('prompt-tile').innerHTML = tileHtml(element);
  $('btn-check').hidden = true;
  $('btn-showme').hidden = true;
  $('btn-onward').hidden = false;
  $('btn-onward').textContent = roundOver(round) ? 'See how you did' : 'Next';
}

// A multiple-choice question: the prompt beside its tile, and four choices.
// The tile stays plain wherever its colour would give the answer away.
function renderChoice(z) {
  choice = choiceQuestion(round.quiz, z, poolOf(round.quiz, round.size), random);
  const element = byNumber(z);
  const tile = $('prompt-tile');
  $('quiz').dataset.z = z;
  $('quiz').dataset.form = choice.form;
  tile.dataset.cat = element.cat;
  tile.classList.toggle('plain', choice.form !== 'value');
  let subject;
  let ask;
  if (round.quiz === 'weight' && choice.form === 'value') {
    tile.innerHTML = tileHtml(element);
    [subject, ask] = [element.name, 'What is its atomic weight?'];
  } else if (round.quiz === 'weight') {
    tile.innerHTML = '<span class="num">?</span><span class="sym">?</span>';
    [subject, ask] = [shortMass(element), 'Which element has this atomic weight?'];
  } else if (choice.form === 'which') {
    tile.innerHTML = tileHtml(element);
    [subject, ask] = [element.name, 'Which series is it in?'];
  } else {
    tile.innerHTML = '<span class="num">?</span><span class="sym">?</span>';
    tile.classList.remove('plain'); // the series' own colour: it's in the question
    [subject, ask] = [categoryOf(element.cat).label, `Which of these is ${withArticle(categoryOf(element.cat).label)}?`];
  }
  $('prompt-text').innerHTML = `<b>${subject}</b><span>${ask}</span>`;
  // Colours on the choices would give a series away.
  const colours = round.quiz !== 'series';
  $('choices').innerHTML = choice.options.map((option, i) => {
    const face = option.sym
      ? `<span class="tile${colours ? '' : ' plain'}" data-cat="${option.cat}"><span class="sym">${option.sym}</span></span><span>${option.label}</span>`
      : `<span>${option.label}</span>`;
    return `<button class="choice-btn" type="button" data-index="${i}"${option.z ? ` data-z="${option.z}"` : ''}` +
      `${option.key ? ` data-key="${option.key}"` : ''}><kbd>${i + 1}</kbd>${face}</button>`;
  }).join('');
  renderCount();
  renderScore();
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  $('btn-onward').hidden = true;
}

// A choice made: marked right or wrong, kept, and explained.
function choose(index) {
  if (phase !== 'asking' || !choice) return;
  const z = question();
  const element = byNumber(z);
  const verdict = index === choice.answer ? 'right' : 'wrong';
  record(progress, round.quiz, z, verdict, today());
  saveProgress();
  renderDue();
  answerQuestion(round, verdict);
  setPhase('feedback');
  [...$('choices').children].forEach((button, i) => {
    button.classList.toggle('right', i === choice.answer);
    button.classList.toggle('wrong', i === index && verdict === 'wrong');
    button.classList.toggle('faded', i !== choice.answer && i !== index);
  });
  const fact = round.quiz === 'weight'
    ? `The atomic weight of ${element.name.toLowerCase()} is ${shortMass(element)}.`
    : `${element.name} is ${withArticle(categoryOf(element.cat).label)}.`;
  const explain = choice.form === 'which' ? '' : `<span class="explain">${choice.explain}</span>`;
  $('feedback').innerHTML = `${verdict === 'right' ? '✓ Right. ' : '✗ '}${fact}${explain}`;
  $('feedback').className = `feedback ${verdict}`;
  $('prompt-tile').classList.remove('plain');
  $('prompt-tile').dataset.cat = element.cat;
  $('prompt-tile').innerHTML = tileHtml(element);
  renderScore();
  playSound(verdict);
  $('btn-onward').hidden = false;
  $('btn-onward').textContent = roundOver(round) ? 'See how you did' : 'Next';
  if (verdict === 'right') onwardTimer = setTimeout(onward, RIGHT_MS);
}

$('choices').addEventListener('click', event => {
  const button = event.target.closest('[data-index]');
  if (button) choose(Number(button.dataset.index));
});

function onward() {
  clearTimeout(onwardTimer);
  onwardTimer = 0;
  if (phase !== 'feedback') return;
  if (roundOver(round)) finishRound();
  else ask();
}

// End: finish now, counting what was answered (or back to the setup if nothing was).
function endRound() {
  clearTimeout(onwardTimer);
  if (round?.answers.length) finishRound();
  else {
    setPhase('setup');
    renderSetup();
  }
}

function finishRound() {
  clearTimeout(onwardTimer);
  $('answer').blur();
  const score = scoreOf(round);
  if (!score.asked) {
    setPhase('setup');
    renderSetup();
    return;
  }
  addRound(progress, {
    at: new Date().toISOString(), quiz: round.quiz, size: round.size,
    asked: score.asked, right: score.right, slips: score.slips, ms: Date.now() - started,
    kind: round.review ? 'review' : '',
  });
  const newly = round.pool.filter(z => !masteredBefore.has(z) && isMastered(progress, round.quiz, z));
  const key = `${round.quiz}:${round.size}`;
  const setDone = allMastered(progress, round.quiz, poolOf(round.quiz, round.size)) && !progress.celebrated[key];
  if (setDone) progress.celebrated[key] = true;
  saveProgress();
  renderDue();
  lastMissed = score.missed;
  const perfect = score.asked >= PERFECT_FROM && score.wrong === 0;
  renderSummary(score, Date.now() - started, newly, setDone, perfect);
  setPhase('done');
  if (perfect || setDone) celebrate();
  else playSound('finish');
}

const duration = ms => {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

function renderSummary(score, ms, newly, setDone, perfect) {
  $('done-title').textContent = perfect ? 'Perfect!' : `${score.right} out of ${score.asked}`;
  const notes = [];
  if (perfect) notes.push(`${score.right} out of ${score.asked}`);
  if (score.slips) notes.push(`${score.slips} with a spelling slip`);
  notes.push(`longest run ${score.best}`, duration(ms));
  $('done-facts').textContent = notes.join(' · ');
  const parts = [];
  if (setDone) {
    parts.push(`<p>You have mastered every element in ${setLabel(round.size)} for ${QUIZ_KINDS[round.quiz].label}!</p>`);
  }
  if (newly.length) parts.push(`<p>Newly mastered: ${newly.map(z => byNumber(z).name).join(', ')}.</p>`);
  // After reviews: how many more are due, or when the next one is.
  const day = today();
  const more = round.review ? dueIn(progress, round.quiz, day).length : 0;
  const next = round.review && !more ? nextDue(progress, round.quiz, day) : 0;
  if (more) parts.push(`<p>${more} more due for review.</p>`);
  if (next) parts.push(`<p>Next review: ${dayText(next, day)}.</p>`);
  $('btn-again').textContent = !round.review ? 'Again' : more ? `Review ${Math.min(more, REVIEW_MOST)} more` : 'Start a round';
  if (score.missed.length) {
    parts.push('<h3>To practice</h3><div class="tiles">' + score.missed.map(z => {
      const element = byNumber(z);
      return `<button class="tile" data-z="${z}" data-cat="${element.cat}" aria-label="${element.name}">${tileHtml(element)}</button>`;
    }).join('') + '</div>');
  }
  $('done-more').innerHTML = parts.join('');
  $('btn-practice').hidden = !score.missed.length;
}

$('btn-start').addEventListener('click', () => startRound());
$('btn-review').addEventListener('click', startReview);
// After reviews, Again reviews what's still due, or else starts a round as set.
$('btn-again').addEventListener('click', () => {
  if (round?.review && dueIn(progress, settings.quiz, today()).length) startReview();
  else startRound();
});
// The misses are practised with options from the same set as the round they were missed in.
$('btn-practice').addEventListener('click', () => startRound({ order: shuffled(lastMissed, random), size: round.size }));
$('btn-change').addEventListener('click', () => {
  endCelebration(true);
  setPhase('setup');
  renderSetup();
});
$('done-more').addEventListener('click', event => {
  const tile = event.target.closest('[data-z]');
  if (tile) openDetails(Number(tile.dataset.z));
});

$('answer-form').addEventListener('submit', event => {
  event.preventDefault();
  if (phase === 'asking') check();
  else if (phase === 'feedback') onward();
});

// While an answer is being marked, typing does nothing; the box keeps the
// focus so a phone's keyboard stays up for the next question.
$('answer').addEventListener('beforeinput', event => {
  if (phase !== 'asking') event.preventDefault();
});

// The buttons beside the answer box don't take the focus from it.
for (const id of ['btn-check', 'btn-showme', 'btn-onward', 'btn-end']) {
  for (const type of ['pointerdown', 'mousedown']) $(id).addEventListener(type, event => event.preventDefault());
}

$('btn-showme').addEventListener('click', () => {
  if (phase !== 'asking') return;
  settle({ verdict: 'wrong', named: null, shown: true });
  focusAnswer();
});

$('btn-onward').addEventListener('click', () => {
  onward();
  if (phase === 'asking' && typed()) focusAnswer();
});

$('btn-end').addEventListener('click', endRound);

// ---- Celebration and sound --------------------------------------------------------

// The family's fireworks and fanfare, for a perfect round or a set mastered.
// With reduced motion only the fanfare plays.
function celebrate() {
  playSound('win');
  if (reducedMotion()) return;
  party = startParty($('party'), () => playSound('firework'));
  $('quiz').dataset.cheer = 'yes';
  celebrating = setTimeout(() => endCelebration(false), CHEER_MS);
}

// Called early by a tap or key, which also stops the fireworks.
function endCelebration(skipped) {
  if (skipped && party) {
    party.stop();
    party = null;
  }
  if (!celebrating) return;
  clearTimeout(celebrating);
  celebrating = 0;
  delete $('quiz').dataset.cheer;
}

function toggleSound() {
  settings.sound = !settings.sound;
  store(SETTINGS_KEY, settings);
  setMuted(!settings.sound);
  unlockSound();
  playSound('right'); // heard only when sound has just come back on
  $('btn-sound').setAttribute('aria-pressed', String(settings.sound));
}

$('btn-sound').addEventListener('click', toggleSound);

// Browsers only allow sound once the page has been tapped or typed at, so every
// tap and key wakes the audio. During the fireworks, a tap or key ends them
// and does nothing else.
for (const type of ['pointerdown', 'keydown']) {
  document.addEventListener(
    type,
    event => {
      unlockSound();
      skipClick = Boolean(celebrating);
      if (!celebrating) return;
      endCelebration(true);
      if (type === 'keydown') {
        event.stopPropagation();
        if (event.key === 'Enter' || event.key === ' ') event.preventDefault();
      }
    },
    true,
  );
}

// The click that follows a skipping tap is dropped before anything sees it.
document.addEventListener(
  'click',
  event => {
    if (!skipClick) return;
    skipClick = false;
    event.stopPropagation();
    event.preventDefault();
  },
  true,
);

// ---- Progress -----------------------------------------------------------------

// Each tile's level in the quiz the Progress page shows.
function renderLevels() {
  const day = today();
  const pool = new Set(poolOf(settings.shows, ELEMENTS.length));
  for (const cell of table.querySelectorAll('.cell[data-z]')) {
    const z = Number(cell.dataset.z);
    cell.dataset.level = pool.has(z) ? levelOf(progress, settings.shows, z, day) : 'none';
  }
}

function when(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function renderProgressView() {
  const quiz = settings.shows;
  const day = today();
  $('progress-sets').innerHTML =
    '<thead><tr><th>Elements</th><th>Mastered</th><th>Due</th><th>Almost</th><th>Learning</th><th>New</th></tr></thead><tbody>' +
    SETS.map(size => {
      const counts = summarize(progress, quiz, poolOf(quiz, size), day);
      return `<tr><th>${setLabel(size)}</th>` +
        ['mastered', 'due', 'almost', 'learning', 'new'].map(key => `<td>${counts[key]}</td>`).join('') + '</tr>';
    }).join('') + '</tbody>';
  // The reviews: how many are due now, and the day the next one is.
  const due = dueIn(progress, quiz, day).length;
  const next = nextDue(progress, quiz, day);
  let line = '';
  if (due) line = `${due} due for review now${next ? `; next review ${dayText(next, day)}` : ''}.`;
  else if (next) line = `Next review: ${dayText(next, day)}.`;
  $('progress-next').textContent = line;
  $('progress-next').hidden = !line;
  const rounds = progress.rounds.slice(-10).reverse();
  $('progress-rounds').innerHTML = rounds.length
    ? rounds.map(r => `<li><span>${when(r.at)}</span>` +
      `<span>${QUIZ_KINDS[r.quiz]?.label ?? r.quiz}, ${r.kind === 'review' ? 'review' : setLabel(r.size)}</span>` +
      `<b>${r.right}/${r.asked}</b></li>`).join('')
    : '<li class="muted">No rounds yet. Start one on the Quiz page.</li>';
}

// The first press arms the button, the second erases.
$('btn-reset').addEventListener('click', () => {
  if (!resetArmed) {
    resetArmed = true;
    $('btn-reset').textContent = 'Tap again to erase';
    return;
  }
  resetArmed = false;
  $('btn-reset').textContent = 'Reset progress';
  Object.assign(progress, emptyProgress());
  saveProgress();
  renderLevels();
  renderProgressView();
  renderLegend();
  renderPicks();
  renderDue();
});

// A page left open overnight: when it's looked at again, what's due is
// worked out afresh.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  renderDue();
  if (view === 'quiz' && phase === 'setup') renderSetup();
  if (view === 'progress') {
    renderLevels();
    renderLegend();
    renderPicks();
    renderProgressView();
  }
});

// ---- Boxes and keys -----------------------------------------------------------

function closeOverlay(overlay) {
  if (overlay.id === 'details') closeDetails();
  else overlay.hidden = true;
}

for (const button of document.querySelectorAll('[data-close]')) {
  button.addEventListener('click', () => closeOverlay(button.closest('.overlay')));
}

// A click beside a box closes it.
for (const overlay of document.querySelectorAll('.overlay')) {
  overlay.addEventListener('click', event => {
    if (event.target === overlay) closeOverlay(overlay);
  });
}

$('about-version').textContent = `Version ${VERSION} · ${RELEASED}`;
$('btn-about').addEventListener('click', () => {
  $('about').hidden = false;
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    const open = [...document.querySelectorAll('.overlay')].filter(overlay => !overlay.hidden);
    for (const overlay of open) closeOverlay(overlay);
    if (!open.length && ($('find').value || picked !== null)) {
      clearFind();
      picked = null;
      renderLegend();
      renderPicks();
      renderPreview();
    }
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (!$('details').hidden) {
    if (event.key === 'ArrowLeft') step(-1);
    else if (event.key === 'ArrowRight') step(1);
    return;
  }
  if (!$('about').hidden || event.target.matches?.('input')) return;
  // A multiple-choice question: 1 to 4 choose, Enter moves on.
  if (view === 'quiz' && round && !typed()) {
    if (phase === 'asking' && /^[1-4]$/.test(event.key)) {
      choose(Number(event.key) - 1);
      return;
    }
    if (phase === 'feedback' && event.key === 'Enter') {
      event.preventDefault();
      onward();
      return;
    }
  }
  if (event.key.toLowerCase() === 'm') toggleSound();
  else if (event.key === '/' && view === 'explore') {
    event.preventDefault();
    $('find').focus();
  }
});

// ---- Fitting the screen ---------------------------------------------------------

// Picks the biggest tiles that fit, and where the key goes:
//   wide  - the table fits across and down with tiles of WIDE_CELL or more, and
//           the key sits in its empty corner;
//   side  - a short, wide screen (a phone on its side): the controls and key in
//           a column beside the table;
//   stack - a phone held upright: the table as wide as the screen, the key below.
function fit() {
  const screen = $('board-wrap').closest('.screen');
  if (!screen || screen.hidden) return;
  const width = screen.clientWidth;
  const top = screen.getBoundingClientRect().top + window.scrollY;
  const height = window.innerHeight - top - 10;
  const gap = width < 480 ? 1 : width < 1000 ? 2 : 3;
  const across = room => (room - 17 * gap) / 18;
  const down = room => (room - 9 * gap) / 9.4;
  const wide = Math.min(across(width), down(height - ABOVE_AND_BELOW), BIGGEST_CELL);
  const side = Math.min(across(width - SIDE_KEY - 12), down(height), BIGGEST_CELL);
  let layout = 'stack';
  let cell = Math.min(across(width), BIGGEST_CELL);
  if (wide >= WIDE_CELL) {
    layout = 'wide';
    cell = wide;
  } else if (width > height * 1.3 && side >= 16) {
    layout = 'side';
    cell = side;
  }
  cell = Math.floor(cell * 4) / 4;
  screen.dataset.layout = layout;
  table.style.setProperty('--cell', `${cell}px`);
  table.style.setProperty('--gap', `${gap}px`);
  table.dataset.size = cell < 30 ? 's' : cell < 56 ? 'm' : 'l';
  const legend = $('legend');
  if (layout === 'wide') {
    if (legend.parentElement !== table) table.append(legend);
    legend.classList.add('in-grid');
  } else {
    if (legend.previousElementSibling !== $('board-wrap')) $('board-wrap').after(legend);
    legend.classList.remove('in-grid');
  }
}

buildTable();
renderSettings();
renderPreview();
setPhase('setup');
renderDue();
fit();
window.addEventListener('resize', fit);

// Everything on the page: the table, an element's details, Find, the key and
// the About box. The elements are in elements.js and where they go in
// table.js; this file draws them and turns taps, slides and keys into what is
// shown.

import { ELEMENTS } from './elements.js';
import {
  CATEGORIES, BLOCKS, STATES, PLACEHOLDERS, byNumber, categoryOf, placeOf, neighbour,
  shellsOf, stateOf, temperature, density, yearText, configHtml, minus, findElements,
} from './table.js';

// Shown in the About box. Bump both with every release: a browser still
// running a cached copy of this file then shows the old number.
const VERSION = '1.0.0';
const RELEASED = '5 November 2026';

const SETTINGS_KEY = 'periodic.settings';
const BIGGEST_CELL = 64; // px: a tile never grows past this
const WIDE_CELL = 44; // px: tiles this big leave room for the key in the table's empty corner
const SIDE_KEY = 200; // px: the column beside the table on a phone on its side
const ABOVE_AND_BELOW = 78; // px: the controls above the table and the line below it
const SWALLOW_MS = 500; // a click this soon after a finger lifts belongs to that touch

const $ = id => document.getElementById(id);

// ?store=NAME keeps this page's storage under keys of its own, so that the
// test driver can run without touching what is saved here.
const STORE = new URLSearchParams(location.search).get('store');
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

// Buttons carry their value as text: "true", "5", "block".
function parseValue(text) {
  if (text === 'true' || text === 'false') return text === 'true';
  return /^\d+$/.test(text) ? Number(text) : text;
}

// Saved settings are only accepted if the page offers that value.
function loadSettings() {
  const settings = { color: 'category' };
  const saved = load(SETTINGS_KEY);
  for (const group of document.querySelectorAll('.choice[data-setting]')) {
    const key = group.dataset.setting;
    const offered = [...group.children].map(button => parseValue(button.dataset.value));
    if (offered.includes(saved?.[key])) settings[key] = saved[key];
  }
  return settings;
}

const settings = loadSettings();
const touchFirst = matchMedia('(pointer: coarse)').matches;
const table = $('ptable');

let current = null; // the element in the details box, or last in it
let pointed = null; // the element under the mouse or a finger, or reached by the arrow keys
let slide = null; // the finger on the table: its pointer id
let swallowUntil = 0; // the click that follows a lifted finger is dropped
let picked = null; // the key entry whose elements are picked out
let found = []; // the elements Find matches, best first
let opener = null; // what had the focus before the details box opened

// The legend for each way of colouring the table, and the cell attribute it reads.
const KEYS = {
  category: { list: CATEGORIES, attr: 'cat' },
  block: { list: BLOCKS, attr: 'block' },
  state: { list: STATES, attr: 'state' },
};

// ---- The table ------------------------------------------------------------

function buildTable() {
  const parts = [];
  for (const element of ELEMENTS) {
    const place = placeOf(element.z);
    parts.push(
      `<button class="cell" data-z="${element.z}" data-cat="${element.cat}" data-block="${place.block}"` +
        ` data-state="${stateOf(element)}"${element.name.length > 10 ? ' data-long' : ''}` +
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

function renderLegend() {
  $('legend').innerHTML = KEYS[settings.color].list
    .map(item => `<button class="chip" data-key="${item.key}" aria-pressed="${picked === item.key}" aria-label="${item.plural}">` +
      `<i style="--fill: var(--${item.key})"></i><span class="long">${item.plural}</span>` +
      `<span class="short" aria-hidden="true">${item.short}</span></button>`)
    .join('');
}

// Fades all but the elements Find matches, or else those of the key entry picked.
function renderPicks() {
  const { attr } = KEYS[settings.color];
  const lit = $('find').value.trim() ? new Set(found) : null;
  table.classList.toggle('picking', Boolean(lit) || picked !== null);
  for (const cell of table.querySelectorAll('.cell')) {
    const on = lit ? lit.has(zOf(cell)) : picked !== null && cell.dataset[attr] === picked;
    cell.classList.toggle('lit', on);
  }
  renderHint();
}

function renderHint() {
  const text = $('find').value.trim();
  let hint = '';
  if (text && !found.length) hint = `No element matches “${text}”.`;
  else if (found.length === 1) hint = `${byNumber(found[0]).name}: press Enter to open it.`;
  else if (found.length) hint = `${found.length} elements match; Enter opens ${byNumber(found[0]).name}.`;
  else if (picked !== null) {
    const { list, attr } = KEYS[settings.color];
    const count = ELEMENTS.filter(element => cellFor(element.z).dataset[attr] === picked).length;
    hint = `${list.find(item => item.key === picked).plural}: ${count} element${count === 1 ? '' : 's'}.`;
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
  table.dataset.color = settings.color;
  renderLegend();
  renderPicks();
}

for (const button of document.querySelectorAll('.choice[data-setting] button')) {
  button.addEventListener('click', () => {
    settings[button.parentElement.dataset.setting] = parseValue(button.dataset.value);
    store(SETTINGS_KEY, settings);
    picked = null;
    renderSettings();
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
  if (event.key === '/') {
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
  const explore = $('explore');
  if (explore.hidden) return;
  const width = explore.clientWidth;
  const top = explore.getBoundingClientRect().top + window.scrollY;
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
  explore.dataset.layout = layout;
  table.style.setProperty('--cell', `${cell}px`);
  table.style.setProperty('--gap', `${gap}px`);
  table.dataset.size = cell < 30 ? 's' : cell < 56 ? 'm' : 'l';
  const legend = $('legend');
  if (layout === 'wide' && legend.parentElement !== table) {
    table.append(legend);
    legend.classList.add('in-grid');
  } else if (layout !== 'wide' && legend.parentElement === table) {
    $('board-wrap').after(legend);
    legend.classList.remove('in-grid');
  }
}

buildTable();
renderSettings();
renderPreview();
fit();
window.addEventListener('resize', fit);

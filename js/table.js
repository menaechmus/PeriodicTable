// Where each element sits, how the elements are grouped, and how their
// numbers are written. Nothing here touches the page, so tests.html can check
// it directly.

import { ELEMENTS } from './elements.js';

// The ten series, in the order the legend lists them. PubChem's grouping.
// `short` is for a key squeezed beside or into the table.
export const CATEGORIES = [
  { key: 'alkali', label: 'Alkali metal', plural: 'Alkali metals', short: 'Alkali' },
  { key: 'alkaline', label: 'Alkaline earth metal', plural: 'Alkaline earth metals', short: 'Alkaline earth' },
  { key: 'transition', label: 'Transition metal', plural: 'Transition metals', short: 'Transition' },
  { key: 'post', label: 'Post-transition metal', plural: 'Post-transition metals', short: 'Post-transition' },
  { key: 'metalloid', label: 'Metalloid', plural: 'Metalloids', short: 'Metalloid' },
  { key: 'nonmetal', label: 'Nonmetal', plural: 'Nonmetals', short: 'Nonmetal' },
  { key: 'halogen', label: 'Halogen', plural: 'Halogens', short: 'Halogen' },
  { key: 'noble', label: 'Noble gas', plural: 'Noble gases', short: 'Noble gas' },
  { key: 'lanthanide', label: 'Lanthanide', plural: 'Lanthanides', short: 'Lanthanide' },
  { key: 'actinide', label: 'Actinide', plural: 'Actinides', short: 'Actinide' },
];

export const BLOCKS = [
  { key: 's', label: 's-block', plural: 's-block', short: 's-block' },
  { key: 'p', label: 'p-block', plural: 'p-block', short: 'p-block' },
  { key: 'd', label: 'd-block', plural: 'd-block', short: 'd-block' },
  { key: 'f', label: 'f-block', plural: 'f-block', short: 'f-block' },
];

// At room temperature. PubChem only expects a state for 110 to 118.
export const STATES = [
  { key: 'solid', label: 'Solid', plural: 'Solid', short: 'Solid' },
  { key: 'liquid', label: 'Liquid', plural: 'Liquid', short: 'Liquid' },
  { key: 'gas', label: 'Gas', plural: 'Gas', short: 'Gas' },
  { key: 'unknown', label: 'Not yet known', plural: 'Not yet known', short: 'Not known' },
];

export const categoryOf = key => CATEGORIES.find(category => category.key === key);

export const byNumber = z => ELEMENTS[z - 1];

// The grid is 18 columns by 10 rows: periods 1 to 7, a narrow spacer row,
// then La–Lu and Ac–Lr in rows of their own, starting under group 3.
export const COLUMNS = 18;
export const ROWS = 10;
export const F_ROWS = { 6: 9, 7: 10 };
const PERIOD_ENDS = [2, 10, 18, 36, 54, 86, 118];

// { period, group, row, column, block } for element z. Group is null in the
// two f-block rows, which have no group number in this layout.
export function placeOf(z) {
  const period = PERIOD_ENDS.findIndex(end => z <= end) + 1;
  const start = period === 1 ? 1 : PERIOD_ENDS[period - 2] + 1;
  const at = z - start; // how far along the period
  if (period === 1) {
    const group = z === 1 ? 1 : 18;
    return { period, group, row: 1, column: group, block: 's' };
  }
  let group;
  if (period <= 3) {
    group = at < 2 ? at + 1 : at + 11; // two, then a jump to group 13
  } else if (period <= 5) {
    group = at + 1;
  } else if (at < 2) {
    group = at + 1;
  } else if (at < 17) {
    // La–Lu or Ac–Lr: their own row, from the column under group 3.
    return { period, group: null, row: F_ROWS[period], column: at + 1, block: 'f' };
  } else {
    group = at - 13; // Hf or Rf in group 4 onward
  }
  const block = group <= 2 ? 's' : group <= 12 ? 'd' : 'p';
  return { period, group, row: period, column: group, block };
}

// The two spots in group 3 that point down to the f-block rows.
export const PLACEHOLDERS = [
  { row: 6, column: 3, label: '57–71', cat: 'lanthanide' },
  { row: 7, column: 3, label: '89–103', cat: 'actinide' },
];

// The empty corner over groups 3 to 12 in periods 1 to 3, where the preview goes.
export const PREVIEW_AREA = { row: 1, rows: 3, column: 3, columns: 10 };

export const blockOf = z => placeOf(z).block;

export function stateOf(element) {
  return element.expected ? 'unknown' : element.state;
}

// The element at each grid spot, for moving around with the arrow keys.
const AT = new Map(ELEMENTS.map(element => {
  const place = placeOf(element.z);
  return [`${place.row},${place.column}`, element.z];
}));
export const elementAt = (row, column) => AT.get(`${row},${column}`) ?? null;

// The next element from z in a direction, skipping empty spots; z itself if
// there is none that way. The spacer row is stepped over like an empty one.
export function neighbour(z, dRow, dColumn) {
  const { row, column } = placeOf(z);
  let r = row + dRow;
  let c = column + dColumn;
  while (r >= 1 && r <= ROWS && c >= 1 && c <= COLUMNS) {
    const found = elementAt(r, c);
    if (found) return found;
    r += dRow;
    c += dColumn;
  }
  return z;
}

// What Find matches: an exact symbol first, then names (or other spellings)
// that start with what was typed. A number finds that element.
export function findElements(text) {
  const wanted = text.trim().toLowerCase();
  if (!wanted) return [];
  if (/^\d+$/.test(wanted)) {
    const z = Number(wanted);
    return z >= 1 && z <= ELEMENTS.length ? [z] : [];
  }
  const exact = ELEMENTS.filter(element => element.sym.toLowerCase() === wanted);
  const starts = ELEMENTS.filter(element =>
    [element.name, ...element.also].some(name => name.toLowerCase().startsWith(wanted)));
  return [...new Set([...exact, ...starts].map(element => element.z))];
}

// Electrons in each shell, from the configuration: '[Ar]3d6 4s2' -> [2, 8, 14, 2].
const CORES = {
  He: '1s2',
  Ne: '[He]2s2 2p6',
  Ar: '[Ne]3s2 3p6',
  Kr: '[Ar]3d10 4s2 4p6',
  Xe: '[Kr]4d10 5s2 5p6',
  Rn: '[Xe]4f14 5d10 6s2 6p6',
};

export function shellsOf(config) {
  const shells = [];
  const add = text => {
    const core = /^\[(\w+)\]/.exec(text);
    if (core) add(CORES[core[1]]);
    for (const [, n, , count] of text.replace(/^\[\w+\]/, '').matchAll(/([1-7])([spdf])(\d+)/g)) {
      shells[n - 1] = (shells[n - 1] || 0) + Number(count);
    }
  };
  add(config);
  return Array.from(shells, count => count || 0);
}

// ---- Writing numbers --------------------------------------------------------

const MINUS = '−';

// A real minus sign, which reads better than a hyphen.
export const minus = text => String(text).replace(/-/g, MINUS);

// Up to `places` decimals, without trailing zeros.
function trim(value, places) {
  return minus(Number(value.toFixed(places)).toString());
}

// 1811 K -> '1538 °C'; with the kelvins: '1538 °C (1811 K)'.
export function celsius(kelvin) {
  return `${trim(kelvin - 273.15, kelvin < 100 ? 2 : 0)} °C`;
}

export function temperature(kelvin, note) {
  if (kelvin === null || kelvin === undefined) return null;
  const k = trim(kelvin, kelvin < 100 ? 2 : 0);
  return `${celsius(kelvin)} (${k} K)${note ? `, ${note}` : ''}`;
}

// Gases are given per litre, everything else per cubic centimetre.
export function density(element) {
  if (element.density === null) return null;
  if (element.state === 'gas') return `${Number((element.density * 1000).toPrecision(3))} g/L`;
  return `${Number(element.density.toPrecision(4))} g/cm³`;
}

export const yearText = year => (year === 0 ? 'Ancient times' : String(year));

export const hasStandardWeight = element => !element.mass.startsWith('[');

// The weight to two decimals, as the weight quiz shows it. Rounded from the
// printed digits: in floating point 55.845 is 55.84499..., which toFixed
// would turn into 55.84 rather than the 55.85 a school table gives.
export function shortMass(element) {
  const [whole, fraction = ''] = element.mass.split('.');
  const digits = `${fraction}000`.slice(0, 3);
  const hundredths = Number(whole) * 100 + Number(digits.slice(0, 2)) + (Number(digits[2]) >= 5 ? 1 : 0);
  return (hundredths / 100).toFixed(2);
}

// '[Ar]3d6 4s2' as HTML with the electron counts raised.
export function configHtml(config) {
  return config.replace(/([spdf])(\d+)/g, '$1<sup>$2</sup>');
}

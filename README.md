# Periodic Table

An interactive periodic table for the browser. Tap any element, or slide a finger across the table, to see its details: weight, series, electron shells, melting and boiling points, where its name comes from and what it is known for.

It is a static page: plain HTML, CSS and JavaScript modules, with no build step. It works on phones and computers alike and is served from GitHub Pages.

## Use

- **Tap** (or click) an element to open its details. **‹** and **›** at the bottom step to the previous and next element.
- On a phone, **press and slide** across the table. The element under your finger shows enlarged in the table's empty corner; lift your finger to open it.
- **Series**, **Block** and **State** color the table by series, by block, or by state at room temperature. Tap an entry in the key to pick out those elements; tap it again to let go.
- **Find** takes a symbol, a name or the start of one, or an atomic number. Enter opens the first match.
- Keys: the arrows move around the table, `Enter` opens an element, `←` and `→` step through the details, `Esc` closes, and `/` jumps to Find.

## Data and credits

The element data comes from [PubChem's periodic table](https://pubchem.ncbi.nlm.nih.gov/ptable/) (Source: National Library of Medicine), a US government work that is free to reuse. The series are PubChem's grouping.

Atomic weights are IUPAC's standard atomic weights as school tables print them. An element with no standard atomic weight shows, in brackets, the mass number of its longest-lived isotope. Each element's name origin and fact were written for this site.

`js/elements.js` is built from PubChem's periodic-table download by a small script kept outside the repository.

## Run locally

Modules don't load from `file://`, so serve the folder:

```
python -m http.server 8000
```

then open `http://localhost:8000/`. The tests are at `http://localhost:8000/tests.html`; `?only=data` runs one group.

## Deploy to GitHub Pages

Settings → Pages, Deploy from a branch, `main` and `/ (root)`. The site is served at `https://menaechmus.github.io/PeriodicTable/`.

## Releasing

Raise `VERSION` and `RELEASED` at the top of `js/ui.js`. The About box shows them, so a browser still holding an old copy can be spotted.

## Layout

| File | What it holds |
|---|---|
| `index.html`, `css/style.css` | The page and its styles |
| `js/ui.js` | Everything on the page: the table, details, Find, the key, and fitting the screen |
| `js/table.js` | Where each element sits; the series, blocks and states; shells; how numbers are written |
| `js/elements.js` | The 118 elements |
| `tests.html` | Tests for the data, the table and Find; `?only=table` runs just one group |

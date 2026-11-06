# Periodic Table

An interactive periodic table for the browser. Tap any element, or slide a finger across the table, to see its details: weight, series, electron shells, melting and boiling points, where its name comes from and what it is known for. A quiz teaches the names and symbols and keeps track of how well you know each one.

It is a static page: plain HTML, CSS and JavaScript modules, with no build step. It works on phones and computers alike and is served from GitHub Pages.

## Use

- **Tap** (or click) an element to open its details. **‹** and **›** at the bottom step to the previous and next element.
- On a phone, **press and slide** across the table. The element under your finger shows enlarged in the table's empty corner; lift your finger to open it.
- **Series**, **Block** and **State** color the table by series, by block, or by state at room temperature. Tap an entry in the key to pick out those elements; tap it again to let go.
- **Find** takes a symbol, a name or the start of one, or an atomic number. Enter opens the first match.
- Keys: the arrows move around the table, `Enter` opens an element, `←` and `→` step through the details, `Esc` closes, `/` jumps to Find, and `M` turns the sound on and off.
- The speaker button turns the sound on and off too.

## The quiz

- On the **Quiz** page, choose **Symbol → name** or **Name → symbol**, which elements (1–20 up to all 118), and how many questions (10, 20 or Keep going), then **Start**.
- Type the answer and press `Enter` (or **Check**).
  - Capital letters don't matter. Aluminium, sulphur and caesium are accepted as well as aluminum, sulfur and cesium.
  - A one-letter slip in a name of six letters or more counts as right, with the right spelling shown. The element isn't counted as better known until it's spelled exactly.
- A right answer moves on by itself. After a slip or a wrong answer, **Next** (or `Enter`) moves on.
- **Show me** gives the answer, which counts as wrong.
- At the end you get your score, the elements you missed, and three choices: **Practice the misses**, **Again** or **Change quiz**. Tap a missed element to open its details.
- A perfect round of ten or more, or the first time a whole set is mastered, gets fireworks and a fanfare.

## Progress

- Each element has a level in each quiz: **New**, **Learning**, **Almost** or **Mastered**.
  - Three right answers in a row take an element from new to Mastered.
  - A wrong answer drops it two steps.
  - The quiz asks most about what you are still learning, and now and then about what you have mastered.
- The **Progress** page colors the table by level, counts each set, and lists recent rounds. An element's details show your record with it.
- **Reset progress** (tap it twice) starts again.
- Progress is kept in this browser on this device.

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
| `js/ui.js` | Everything on the page: the table, details, Find, the key, the quiz and progress pages, sound, and fitting the screen |
| `js/table.js` | Where each element sits; the series, blocks and states; shells; how numbers are written |
| `js/elements.js` | The 118 elements |
| `js/answers.js` | Checking a typed answer: other spellings, and a slip forgiven |
| `js/progress.js` | What the quizzes have taught: a level for each quiz and element, choosing what to ask next, round history |
| `js/quiz.js` | Rounds of questions |
| `js/sound.js` | Sound effects, generated with the Web Audio API (no audio files) |
| `js/fanfare.js`, `js/celebrate.js` | The brass fanfare and the fireworks, shared with the other games |
| `tests.html` | Tests for the data, the table, Find, answers, progress, rounds, sound and the fireworks; `?only=answers` runs just one group |

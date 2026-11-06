# Periodic Table

An interactive periodic table for the browser. Tap any element, or slide a finger across the table, to see its details: weight, series, electron shells, melting and boiling points, where its name comes from and what it is known for. Quizzes teach the names, symbols, atomic weights and series, and keep track of how well you know each element.

It is a static page: plain HTML, CSS and JavaScript modules, with no build step. It works on phones and computers alike and is served from GitHub Pages.

## Use

- **Tap** (or click) an element to open its details. **‹** and **›** at the bottom step to the previous and next element.
- On a phone, **press and slide** across the table. The element under your finger shows enlarged in the table's empty corner; lift your finger to open it.
- **Series**, **Block** and **State** color the table by series, by block, or by state at room temperature. Tap an entry in the key to pick out those elements; tap it again to let go.
- **Find** takes a symbol, a name or the start of one, or an atomic number. Enter opens the first match.
- Keys: the arrows move around the table, `Enter` opens an element, `←` and `→` step through the details, `Esc` closes, `/` jumps to Find, and `M` turns the sound on and off.
- The speaker button turns the sound on and off too.

## The quiz

- On the **Quiz** page, choose a quiz, which elements (1–20 up to all 118), and how many questions (10, 20 or Keep going), then **Start**. There are four quizzes:
  - **Symbol → name** and **Name → symbol**: type the answer.
  - **Atomic weight** and **Series**: pick one of four.
- For the typed quizzes, type the answer and press `Enter` (or **Check**).
  - Capital letters don't matter. Aluminium, sulphur and caesium are accepted as well as aluminum, sulfur and cesium.
  - A one-letter slip in a name of six letters or more counts as right, with the right spelling shown. The element isn't counted as better known until it's spelled exactly.
  - **Show me** gives the answer, which counts as wrong.
- **Atomic weight** asks two ways: the weight of an element, or which element has a weight. The weights are to two decimals, as school tables print them. It covers the 84 elements that have a standard atomic weight.
- **Series** also asks two ways: which series an element is in, or which of four elements belongs to a series. It covers elements 1–108; the series of 109 onward are only predictions.
- Pick with a tap, or with the keys `1` to `4`.
- A right answer moves on by itself. After a slip or a wrong answer, **Next** (or `Enter`) moves on.
- At the end you get your score, the elements you missed, and three choices: **Practice the misses**, **Again** or **Change quiz**. Tap a missed element to open its details.
- A perfect round of ten or more, or the first time a whole set is mastered, gets fireworks and a fanfare.
- **Reviews:** when mastered elements are due for review, the Quiz tab shows how many, and so does each quiz's button.
  - **Review N due**, under Start, asks the ones due in the chosen quiz, longest overdue first, up to 20 at a time. It covers the whole table, whichever elements are chosen.
  - When none are due, the setup says when the next review is.

## Progress

- Each element has a level in each quiz: **New**, **Learning**, **Almost**, **Mastered** or **Due for review**.
  - Three right answers in a row take an element from new to Mastered.
  - A mastered element comes back for review after 3 days, then a week, then a month, then every 3 months. Answered right when it's due, it waits longer next time. Answered right before then, it only counts, so one sitting can't rush it.
  - A wrong answer drops it two steps. If it's still Mastered, its review comes sooner.
  - The quiz asks most about what you are still learning and what is due for review, and now and then about what you have mastered.
- The **Progress** page colors the table by level, counts each set, says how many are due and when the next review is, and lists recent rounds. An element's details show your record with it, and when it's next reviewed.
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
| `js/progress.js` | What the quizzes have taught: a level for each quiz and element, the day each is due for review, choosing what to ask next, round history |
| `js/quiz.js` | Rounds of questions (review rounds too), and the multiple-choice questions with their wrong options |
| `js/sound.js` | Sound effects, generated with the Web Audio API (no audio files) |
| `js/fanfare.js`, `js/celebrate.js` | The brass fanfare and the fireworks, shared with the other games |
| `tests.html` | Tests for the data, the table, Find, answers, progress, rounds, sound and the fireworks; `?only=answers` runs just one group |

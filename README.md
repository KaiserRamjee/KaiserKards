# KaiserKards

Flashcards and quizzes built from CSV files. Every `.csv` in the `decks/` folder becomes a study set on the site.

## Adding a deck

1. Make a CSV with two columns: the **front** and the **back** of each card. A third **hint** column is optional.
2. Put it in `decks/`, either by pushing it with git or by opening the `decks` folder on GitHub and using **Add file → Upload files**.
3. Vercel rebuilds the site automatically. The new deck shows up in about a minute.

```csv
front,back,hint
hola,hello / hi,A greeting
"el gato, la gata",the cat,Meow
```

- The header row (`front,back`) is optional.
- Put a field in "double quotes" if it contains a comma. Quoted fields can also span several lines.
- Excel and Google Sheets exports work (**File → Download → CSV**). Semicolon- and tab-separated files work too.
- **Deck names come from file names:** `spanish-verbs.csv` becomes "Spanish Verbs".
- **Subfolders become groups:** `decks/biology/cells.csv` is listed under "Biology".
- **Ordering:** a number prefix sorts decks but is left out of the name, so `01-intro.csv` shows as "Intro".
- **Drafts:** files or folders starting with `_` or `.` are ignored.
- Rows missing a front or a back are skipped. The Vercel build log lists them.

## Study modes

**Flashcards**: flip each card and mark it *Got it* or *Still learning*. You can shuffle, show the back side first, or study only the cards you're still learning. Keyboard: Space flips, ← → move, 1 = still learning, 2 = got it.

**Quiz**: separate from flashcards. You type the answer or pick from multiple choice. Choose the direction and the number of questions. Typed answers ignore case and punctuation, and they forgive small typos and missing accents. Any of these also count:
- a single alternative from an answer written as `hello / hi` or `hello; hi`
- the answer without its `(notes in brackets)`

If an answer is marked wrong but you know it was right, use **I was right**. After a quiz you can retry only the questions you missed. Your best score is saved.

Progress is saved in your browser, so each device keeps its own progress.

## Hosting on Vercel

1. On [vercel.com](https://vercel.com), choose **Add New → Project** and import this GitHub repository.
2. Leave the settings as they are (`vercel.json` already sets them) and click **Deploy**.

Every push to the repo, including adding a CSV, redeploys the site.

## Running locally (optional)

This requires [Node.js](https://nodejs.org) 18 or newer. Run `npm run preview`, then open the address it prints.

## How it works

`scripts/build.mjs` reads every CSV in `decks/`, writes `dist/decks.json`, and copies the site files from `src/` into `dist/`. The site is plain HTML, CSS, and JavaScript with no dependencies.

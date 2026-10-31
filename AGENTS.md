# Working on this project

## Stack

Plain **Vite + React + TypeScript**, deployed as a website added to the home
screen. Same stack, backend pattern and hosting as the Sauce Counter
(`allendigitaldesign/Condiment-Sauce-Counter-West-Adams-CFA`), but a separate
project: no shared code, no shared data. The chart will later move into the
owner's leadership app, so `WeeklyChart` takes everything through props.

Data lives in a **Google Sheet**, on purpose. **There is no database**, and
the owner asked for none. The Sheet's bound Apps Script (`apps-script/Code.gs`)
is deployed as a web app and is the only backend. Hosted on **GitHub Pages**
at `https://allendigitaldesign.github.io/FOH-Weekly-Cleaning-Tracker-CFA-West-Adams/`,
deployed by `.github/workflows/pages.yml` on push to `main`. It needs the
`VITE_SHEET_URL` repository secret and Pages' source set to GitHub Actions.

**The site lives in a folder, not at a root.** Every path must be relative:
`base: './'` in `vite.config.ts`, `./` links in `index.html`, relative paths in
`public/manifest.json`, the service worker registered via
`import.meta.env.BASE_URL`.

## The chart is for screenshots

People screenshot it and send it to a group chat, so **the whole week must
always fit on one screen with no scrolling**. `ChartStage` draws the board
at a fixed size (`SHAPES` in `WeeklyChart.tsx`) and scales it to fit:
`wide` (days across, exactly like the printed board) or `tall` (days down, for
an upright phone), whichever comes out bigger. If you add anything to the
board, check both shapes still fit, at iPad (1180×820, 820×1180) and phone
(390×760) sizes. All sizes in `styles.css` under `.board` are board pixels.

The look copies the printed chart: day colours in `DAYS` (`src/tasks.ts`),
navy `#1D2B4A` shift labels and dotted lines, green `#0E7C6B` title outline,
check marks and initials in Permanent Marker (bundled via `@fontsource`, so
it works offline). Don't reproduce the Chick-fil-A logo.

## Things that will bite you

- **The task list is written twice**: `src/tasks.ts` and `TASKS` in
  `apps-script/Code.gs`. Ids and names must match exactly. `npm test`
  compares them (it reads `tasks.ts` as text, so keep its one-task-per-line
  format), and CI runs it.
- **A week is named by its Monday.** Sunday (closed) belongs to the week
  before. Never use `Date.toISOString()` for a day: days are
  `America/Los_Angeles` `"YYYY-MM-DD"` strings (`src/dates.ts`, `today()` and
  `mondayOf()` in the script), stored in the Sheet as text.
- **The Sheet finds columns by header label** (`"Monday Breakfast: Drinks
  dump sink"`). Renaming a task starts a new column; missing labels get
  appended automatically.
- **A done task's cell holds the initials; its note holds the time.** A blank
  cell is not done. Initials typed in by hand count.
- **First check mark wins.** Completing a task someone else already has
  returns `notice: "Already marked done by …"` and changes nothing.
- **Initials are never remembered** on the device. The store iPad is shared.
- **`Code.gs` gets pasted by hand, and a partial paste is the likeliest
  failure.** Keep the START/END markers as the first and last lines, settings
  at the top, top-level code `typeof`-guarded, and `checkWholeFilePasted_()`
  at the bottom. `npm test` tries a paste starting at every line.
- **Changing `Code.gs` does nothing until it is redeployed** as a new
  version of the *same* deployment.
- **Requests are `text/plain`, never `application/json`** (no CORS preflight;
  Apps Script can't answer OPTIONS).
- **Every change carries an `opId`**; the script ignores repeats for 6 hours.
  The client keeps waiting changes in `localStorage` and resends them
  unchanged. Don't give a resend a new id.
- **A poll answer is dropped if a send started or finished while it was out**
  (`epoch` in `src/store.ts`).
- **A refused change is dropped, not retried.** Network failures and non-200s
  are retried with backoff.
- **Demo mode** runs when `VITE_SHEET_URL` is unset; the deploy workflow
  refuses to build without it.
- **The service worker is network-first** and never touches the Sheet's
  requests.

## Testing

- `npm test`: the real `Code.gs` against an in-memory spreadsheet
  (`scripts/gas-fakes.mjs`).
- `npm run mock-sheet` + `VITE_SHEET_URL=http://localhost:8787 npm run dev`:
  the full app against that same script over HTTP.
- Icons: `node scripts/render-icon.mjs` draws `public/icons/` from
  `design/app-icon.svg` (set `CHROMIUM_PATH` if Playwright's own browser
  isn't installed).

## Audience

The owner is not a professional developer. Explain in plain language, say
where a command goes ("in a terminal"), and run local commands yourself where
you can. Anything that needs their Google or GitHub sign-in has to be called
out as theirs to do.

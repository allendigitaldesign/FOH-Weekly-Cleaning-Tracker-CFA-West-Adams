# FOH Weekly Cleaning Schedule — Chick-fil-A West Adams

The FOH weekly cleaning chart from the wall, made digital. It's laid out like
the printed board: a coloured column for each day (Monday to Saturday), the
four shifts down the side (Breakfast, Lunch, Afternoon, Dinner), and one
cleaning task in every box.

**Whoever finishes a task taps its box, types their initials, and presses
Mark complete.** The box gets a check mark and their initials, just like the
marker on the board. Every check mark goes straight into a **Google Sheet**.
There's no database.

Every device showing the chart sees the same thing. A check mark made on one
shows up on the others within a few seconds. Each Monday starts a fresh,
empty chart, and last week's stays in the Sheet.

---

## Using it

- **Tap a task** to open it. Type your initials (2 to 4 letters) and press
  **✓ Mark complete**.
- **Marked the wrong one?** Tap it again, then **Not done? Undo the check
  mark**. Nothing is ever lost: the Sheet's Completion Log keeps every check
  mark and every undo.
- **Someone already did it?** If two people mark the same task, the first
  one stays and the second sees *"Already marked done by …"*.
- **‹ ›** next to the week flip back to earlier weeks, for example to check
  off Saturday's dinner task on Monday morning. You can't go past this week.
- Today's column has a thicker outline and says **Today**.
- **Live / Saving… / Offline** at the top right shows how it's talking to the
  Sheet. If the wifi drops, keep going: check marks wait on the device and go
  to the Sheet as soon as it's back, even after a restart.

### Sending it to the group chat

The chart always fits the screen exactly, so **a screenshot is the whole
week**:

- **iPad or laptop:** the chart looks just like the printed board.
- **Phone held upright:** the chart turns on its side (days going down,
  shifts across) so the writing stays big enough to read in the screenshot.
  Turn the phone sideways to get the board layout instead.

## What ends up in the Google Sheet

Two tabs, which the script makes by itself:

- **Weekly Chart**: one row per week (named by its Monday), one column per
  task. A done task shows the initials of whoever did it, and hovering over
  the cell shows a note with the time. **Done** says how many of the 24 are
  finished, like `18 of 24`.
- **Completion Log**: every check mark and every undo as it came in, with
  the time, the week, the day, the shift, the task and the initials.

You can type initials into the Weekly Chart by hand and they'll show on the
app within about 20 seconds. You can add your own tabs, charts or formulas.
Don't rename the two tabs or the headings in row 1, because that's how the
script finds them.

---

## Setting it up

The Sheet part has to be done by you, because it means signing in to Google.
It's the same steps as the Sauce Counter, and takes about ten minutes, once.

### Step 1: Make the Sheet and its script

1. Go to <https://sheets.google.com> and make a **new blank spreadsheet**.
   Name it something like `CFA West Adams — FOH Cleaning`.
2. In the menu click **Extensions → Apps Script**. A code editor opens in a
   new tab.
3. **Clear the editor completely.** Select everything in it, including the
   sample `function myFunction() { }`, and delete it, so the editor is empty.
4. **Copy the whole script in one go.** Open `apps-script/Code.gs` on GitHub
   and press the **Copy raw file** button (the two-overlapping-squares icon
   in the bar just above the code). Paste it into the empty editor.
5. **Check both ends.** Line 1 must say
   `// ===== START OF Code.gs (FOH Weekly Cleaning) =====`. Scroll to the very
   bottom: the last line must say
   `// ===== END OF Code.gs — if you can see this, everything was pasted =====`.
   If either is missing, go back to step 3. Then press the 💾 **Save** icon.
6. At the top, in the dropdown next to **Run**, choose **`setup`**, then
   press **Run**.
   Google will ask for permission: **Review permissions →** pick your
   account **→ Advanced → Go to (project name) → Allow**. That warning
   appears because you wrote the script yourself and Google hasn't reviewed
   it. It only ever touches this one spreadsheet.
7. Go back to the spreadsheet tab. You'll now see **Weekly Chart** and
   **Completion Log**.

**If `setup` shows an error** like *"Only part of Code.gs was pasted"* or
anything ending **"is not defined"**, the top of the file didn't make it into
the editor. Empty the editor and paste the whole file again.

### Step 2: Turn the script into a web address

1. Back in the Apps Script tab, click **Deploy → New deployment**.
2. Click the ⚙️ next to "Select type" and choose **Web app**.
3. Set:
   - **Execute as:** *Me*
   - **Who has access:** *Anyone*
4. Press **Deploy**, then copy the **Web app URL**. It ends in `/exec`.

> "Anyone" is needed because the store devices don't sign in to Google. The
> address can only mark tasks done or undone and read the chart. It can't
> read the rest of your Google Drive, and the Sheet itself stays private to
> you. Every change is in the Completion Log with a time.

**If you ever change `Code.gs`:** paste the new version in, save, then
**Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
That keeps the same address. A *new* deployment gets a new address, and the
devices would keep using the old one.

### Step 3: Put it on the web

The site is hosted free on **GitHub Pages** from this repository. Pushing to
`main` publishes it automatically, at:

**https://allendigitaldesign.github.io/FOH-Weekly-Cleaning-Tracker-CFA-West-Adams/**

It needs two things set once, in this repo's **Settings**:

1. **Pages → Build and deployment → Source: GitHub Actions.**
2. **Secrets and variables → Actions → New repository secret**, named
   `VITE_SHEET_URL`, with the `/exec` web app address from Step 2 as the value.

The publish deliberately **fails** if `VITE_SHEET_URL` is missing, instead of
putting up a demo version that looks right but saves nothing to the Sheet.
If that happens, add the secret, then open the **Actions** tab → **Deploy to
GitHub Pages** → **Run workflow**.

> The repository has to be **public** for GitHub Pages to be free, like the
> Sauce Counter's. There's nothing private in it: the Sheet's address is kept
> in the secret, not in the code.

### Step 4: Put it on the devices

Open the address above in **Safari**, then **Share → Add to Home Screen**. It
opens like a normal app from then on.

---

## Trying it on a computer

In a terminal, in this folder:

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>. With no `.env` it runs in **demo mode**: a
dark banner along the bottom, and check marks kept only in that browser.

To try it against a pretend Sheet (the real `Code.gs`, run on your computer,
with nothing sent to Google), use two terminals:

```bash
npm run mock-sheet
VITE_SHEET_URL=http://localhost:8787 npm run dev
```

`npm test` runs the Sheet script against a pretend spreadsheet and checks the
task list in the app matches the one in the script.

## Changing the tasks

The list lives in **two** places, and they have to match:

- `TASKS` in `src/tasks.ts`: what the chart shows
- `TASKS` at the top of `apps-script/Code.gs`: what the Sheet records

Change both, run `npm test` (it fails if they disagree), push to publish the
app, and paste the new `Code.gs` into the Apps Script editor as a **new
version** (see Step 2). A renamed task gets its own new column on the end of
the Weekly Chart, and old weeks keep the old column.

## Moving it into the leadership app

`src/components/WeeklyChart.tsx` draws the chart from props only (the week,
the check marks, and what to do when a box is tapped), so it can be lifted
into another React app as it is. The Sheet's web app answers:

- `GET  …/exec?week=YYYY-MM-DD` → `{ ok, week, thisWeek, marks: { "mon-breakfast": { by: "KR", at: "Mon Oct 26, 9:42 AM" } } }`
- `POST …/exec` with a `text/plain` body
  `{ opId, week, task: "mon-breakfast", action: "complete" | "undo", initials }`
  → the same shape, after the change.

## How it's put together

| File | What it does |
| --- | --- |
| `apps-script/Code.gs` | The Sheet side: reads a week's check marks, marks tasks done or undone, writes the log |
| `src/tasks.ts` | The days, shifts and the 24 tasks |
| `src/components/WeeklyChart.tsx` | The chart, scaled to fit any screen |
| `src/components/MarkSheet.tsx` | The pop-up for initials, and for undoing |
| `src/store.ts` | Holds check marks, sends them, and asks the Sheet for everyone else's |
| `src/backend.ts` | Talks to the Sheet, or to the browser in demo mode |
| `src/dates.ts` | Days and weeks in Los Angeles time |
| `src/styles.css` | The look, matched to the printed chart |
| `scripts/mock-sheet.mjs` | A pretend Sheet for trying it out locally |
| `scripts/apps-script.test.mjs` | The tests for `Code.gs` |

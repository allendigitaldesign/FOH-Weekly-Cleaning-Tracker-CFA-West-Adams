/**
 * Runs the real apps-script/Code.gs against a pretend spreadsheet.
 *
 *   npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadScript, get, post } from './gas-fakes.mjs';

// Saturday 31 Oct 2026, 10:30pm in Los Angeles — already Sunday 1 Nov in UTC,
// which is exactly the mistake the script must not make. The week is the one
// that started on Monday 26 Oct.
const SATURDAY_CLOSE = Date.UTC(2026, 10, 1, 5, 30);
const WEEK = '2026-10-26';
const DAY = 24 * 3600 * 1000;

let n = 0;
const opId = () => `test-op-${String(++n).padStart(4, '0')}`;

function fresh() {
  const loaded = loadScript();
  loaded.clock.now = SATURDAY_CLOSE;
  loaded.script.setup();
  return loaded;
}

const complete = (script, task, initials, extra = {}) =>
  post(script, { opId: opId(), week: WEEK, task, action: 'complete', initials, ...extra });

const undo = (script, task, extra = {}) =>
  post(script, { opId: opId(), week: WEEK, task, action: 'undo', ...extra });

test('setup builds both tabs, with a column for every task in chart order', () => {
  const { spreadsheet } = fresh();
  assert.deepEqual(
    spreadsheet.getSheets().map((s) => s.getName()),
    ['Weekly Chart', 'Completion Log'],
  );
  const header = spreadsheet.getSheetByName('Weekly Chart').cells[0];
  assert.equal(header[0], 'Week Of');
  assert.equal(header[1], 'Monday Breakfast: Drinks dump sink');
  assert.equal(header[24], 'Saturday Dinner: Air vents in DT cockpit');
  assert.equal(header.at(-1), 'Done');
  assert.equal(header.length, 24 + 2);
});

test('running setup again changes nothing', () => {
  const { script, spreadsheet } = fresh();
  complete(script, 'mon-lunch', 'kr');
  const before = JSON.stringify(spreadsheet.sheets.map((s) => [s.cells, s.notes]));
  script.setup();
  assert.equal(JSON.stringify(spreadsheet.sheets.map((s) => [s.cells, s.notes])), before);
});

test('the week is worked out in Los Angeles, Monday to Saturday', () => {
  const { script, clock } = fresh();
  assert.equal(get(script).week, WEEK);

  clock.now = SATURDAY_CLOSE + DAY; // Sunday: still the week that just ended
  assert.equal(get(script).week, WEEK);

  clock.now = SATURDAY_CLOSE + 2 * DAY; // Monday: a new, empty week
  const monday = get(script);
  assert.equal(monday.week, '2026-11-02');
  assert.deepEqual(monday.marks, {});
});

test('any day of a week means that week', () => {
  const { script } = fresh();
  assert.equal(get(script, { week: '2026-10-29' }).week, WEEK);
  assert.equal(get(script, { week: '2026-10-25' }).week, '2026-10-19'); // a Sunday
});

test('marking a task done keeps the initials, a time, a total and a log line', () => {
  const { script, spreadsheet } = fresh();
  complete(script, 'mon-breakfast', 'K.R.');
  const reply = complete(script, 'sat-dinner', ' jh ');

  assert.equal(reply.ok, true);
  assert.equal(reply.week, WEEK);
  assert.deepEqual(Object.keys(reply.marks).sort(), ['mon-breakfast', 'sat-dinner']);
  assert.deepEqual(reply.marks['mon-breakfast'], { by: 'KR', at: 'Sat Oct 31, 10:30 PM' });
  assert.equal(reply.marks['sat-dinner'].by, 'JH');

  const chart = spreadsheet.getSheetByName('Weekly Chart');
  assert.equal(chart.cells.length, 2);
  assert.equal(chart.cells[1][0], WEEK);
  assert.equal(chart.cells[1][1], 'KR');
  assert.equal(chart.notes[1][1], 'Done Sat Oct 31, 10:30 PM');
  assert.equal(chart.cells[1][24], 'JH');
  assert.equal(chart.cells[1].at(-1), '2 of 24');

  const log = spreadsheet.getSheetByName('Completion Log').cells.slice(1);
  assert.deepEqual(
    log.map((r) => r.slice(1)),
    [
      [WEEK, 'Monday', 'Breakfast', 'Drinks dump sink', 'KR', 'Completed'],
      [WEEK, 'Saturday', 'Dinner', 'Air vents in DT cockpit', 'JH', 'Completed'],
    ],
  );
});

test('a reader sees the same check marks', () => {
  const { script } = fresh();
  complete(script, 'wed-lunch', 'dw');
  assert.equal(get(script).marks['wed-lunch'].by, 'DW');
  assert.equal(get(script, { week: WEEK }).marks['wed-lunch'].by, 'DW');
});

test('the same change sent twice is only applied once', () => {
  const { script, spreadsheet } = fresh();
  const id = opId();
  const body = { opId: id, week: WEEK, task: 'tue-lunch', action: 'complete', initials: 'RJ' };
  post(script, body);
  undo(script, 'tue-lunch');
  const again = post(script, body); // the resend of the first one arrives late
  assert.equal(again.duplicate, true);
  assert.equal(again.marks['tue-lunch'], undefined);
  assert.equal(spreadsheet.getSheetByName('Completion Log').cells.length, 3);
});

test("someone else's check mark is never overwritten", () => {
  const { script, spreadsheet } = fresh();
  complete(script, 'thu-lunch', 'BR');
  const reply = complete(script, 'thu-lunch', 'LC');
  assert.equal(reply.ok, true);
  assert.equal(reply.marks['thu-lunch'].by, 'BR');
  assert.equal(reply.notice, 'Already marked done by BR.');
  assert.equal(spreadsheet.getSheetByName('Completion Log').cells.length, 2);

  // The same person marking it again is just a no-op, without a notice.
  assert.equal(complete(script, 'thu-lunch', 'br').notice, undefined);
});

test('undo clears the box, logs who it was, and counts down', () => {
  const { script, spreadsheet } = fresh();
  complete(script, 'fri-dinner', 'JH');
  complete(script, 'fri-lunch', 'PL');
  const reply = undo(script, 'fri-dinner');
  assert.equal(reply.marks['fri-dinner'], undefined);
  assert.equal(reply.marks['fri-lunch'].by, 'PL');

  const chart = spreadsheet.getSheetByName('Weekly Chart');
  assert.equal(chart.cells[1].at(-1), '1 of 24');
  assert.equal(chart.notes[1][20], '');
  const log = spreadsheet.getSheetByName('Completion Log').cells;
  assert.deepEqual(log.at(-1).slice(4), ['FC sauce wall', 'JH', 'Undone']);

  // Undoing a box that is already empty does nothing and logs nothing.
  undo(script, 'fri-dinner');
  assert.equal(spreadsheet.getSheetByName('Completion Log').cells.length, log.length);
});

test('initials typed into the Sheet by hand show up on the chart', () => {
  const { script, spreadsheet, clock } = fresh();
  complete(script, 'mon-lunch', 'RW');
  spreadsheet.getSheetByName('Weekly Chart').cells[1][1] = 'kj';
  clock.now += 21 * 1000; // past the 20 s read cache
  assert.deepEqual(get(script).marks['mon-breakfast'], { by: 'KJ', at: '' });
});

test('bad requests are refused in plain words', () => {
  const { script } = fresh();
  assert.match(complete(script, 'sun-lunch', 'KR').error, /no task called/);
  assert.match(complete(script, 'mon-lunch', 'K').error, /2 to 4 letters/);
  assert.match(complete(script, 'mon-lunch', 'KRISTA').error, /2 to 4 letters/);
  assert.match(complete(script, 'mon-lunch', '').error, /2 to 4 letters/);
  assert.equal(post(script, { week: WEEK, task: 'mon-lunch', action: 'complete', initials: 'KR' }).ok, false);
  assert.equal(post(script, { opId: opId(), week: WEEK, task: 'mon-lunch', action: 'erase' }).ok, false);
});

test("a week that hasn't started can't be marked, but earlier weeks can", () => {
  const { script, spreadsheet, clock } = fresh();
  assert.match(complete(script, 'mon-lunch', 'KR', { week: '2026-11-02' }).error, /hasn't started/);

  clock.now = SATURDAY_CLOSE + 2 * DAY; // Monday morning
  // Saturday's dinner task, finished at close and checked off this morning.
  const late = complete(script, 'sat-dinner', 'RJ', { week: WEEK });
  assert.equal(late.week, WEEK);
  assert.equal(late.thisWeek, '2026-11-02');
  complete(script, 'mon-breakfast', 'KR', { week: '2026-11-02' });

  const rows = spreadsheet.getSheetByName('Weekly Chart').cells.slice(1).map((r) => r[0]);
  assert.deepEqual(rows, [WEEK, '2026-11-02']);
  assert.deepEqual(Object.keys(get(script).marks), ['mon-breakfast']);
});

test('a task added to the chart later gets its own new column', () => {
  const { script, spreadsheet } = fresh();
  const header = spreadsheet.getSheetByName('Weekly Chart').cells[0];
  const label = 'Saturday Dinner: Air vents in DT cockpit';
  header.splice(header.indexOf(label), 1, ''); // pretend it is new
  complete(script, 'sat-dinner', 'AS');
  const after = spreadsheet.getSheetByName('Weekly Chart').cells;
  assert.equal(after[0].at(-1), label);
  assert.equal(after[1].at(-1), 'AS');
});

test('the tasks in the app and in the script match exactly', () => {
  const { script } = loadScript();
  // Spread into this file's own arrays: the script's arrays come from another
  // JavaScript realm, and deepEqual would compare their prototypes too.
  const fromScript = [...script.TASKS].map(([id, task]) => `${id}|${task}`);
  const days = [...script.DAYS].map(([id, label]) => `${id}|${label}`);
  const shifts = [...script.SHIFTS].map(([id, label]) => `${id}|${label}`);

  // Read src/tasks.ts as text rather than importing it, so this needs no
  // TypeScript build.
  const source = readFileSync(new URL('../src/tasks.ts', import.meta.url), 'utf8');
  const fromApp = [...source.matchAll(/^ {2}'([a-z]+-[a-z]+)': '([^']+)',$/gm)].map(
    (m) => `${m[1]}|${m[2]}`,
  );
  const appDays = [...source.matchAll(/\{ id: '([a-z]+)', label: '([A-Za-z]+)', color/g)].map(
    (m) => `${m[1]}|${m[2]}`,
  );
  const appShifts = [...source.matchAll(/\{ id: '([a-z]+)', label: '([A-Za-z]+)' \}/g)].map(
    (m) => `${m[1]}|${m[2]}`,
  );

  assert.equal(fromApp.length, 24);
  assert.deepEqual(fromApp, fromScript);
  assert.deepEqual(appDays, days);
  assert.deepEqual(appShifts, shifts);
});

test('the file starts and ends with the markers people check after pasting', () => {
  const lines = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8')
    .trimEnd()
    .split('\n');
  assert.match(lines[0], /^\/\/ ===== START OF Code\.gs/);
  assert.match(lines.at(-1), /^\/\/ ===== END OF Code\.gs/);
});

test('a paste missing the top of the file says so in plain words', () => {
  const lines = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8').split('\n');
  const firstSetting = lines.findIndex((l) => l.startsWith('var TIME_ZONE')) + 1;
  let checked = 0;

  // Try a paste that starts at every single line of the file.
  for (let fromLine = 1; fromLine <= lines.length; fromLine++) {
    let script;
    try {
      ({ script } = loadScript({ fromLine }));
    } catch (err) {
      // Cut mid-statement: the editor refuses to save it, and says where.
      assert.equal(err.name, 'SyntaxError', `paste from line ${fromLine}: ${err.message}`);
      continue;
    }
    if (typeof script.setup !== 'function') continue; // nothing to run

    let message = null;
    try {
      script.setup();
    } catch (err) {
      message = String(err.message);
    }

    if (fromLine <= firstSetting) {
      assert.equal(message, null, `paste from line ${fromLine} should work`);
    } else {
      checked++;
      assert.match(message ?? '', /Only part of Code\.gs was pasted/, `paste from line ${fromLine}`);
      if (typeof script.doGet === 'function') {
        assert.match(
          String(script.doGet({ parameter: {} }).getContent()),
          /Only part of Code\.gs was pasted/,
        );
      }
    }
  }
  assert.ok(checked > 20);
});

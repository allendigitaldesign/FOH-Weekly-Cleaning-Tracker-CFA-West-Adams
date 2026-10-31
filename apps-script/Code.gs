// ===== START OF Code.gs (FOH Weekly Cleaning) =====
// Paste ALL of this file into the Sheet's Apps Script editor: from this line
// down to the "END OF Code.gs" line at the very bottom. See README, Step 1.

var TIME_ZONE = 'America/Los_Angeles';
var CHART_SHEET = 'Weekly Chart';
var LOG_SHEET = 'Completion Log';

var DAYS = [
  ['mon', 'Monday'],
  ['tue', 'Tuesday'],
  ['wed', 'Wednesday'],
  ['thu', 'Thursday'],
  ['fri', 'Friday'],
  ['sat', 'Saturday'],
];

var SHIFTS = [
  ['breakfast', 'Breakfast'],
  ['lunch', 'Lunch'],
  ['afternoon', 'Afternoon'],
  ['dinner', 'Dinner'],
];

/**
 * The chart itself: one cleaning task for every day and shift. This list is
 * written TWICE: here, and in `src/tasks.ts` in the app. The ids and the task
 * names must match exactly. If one changes, change both, then run `npm test`,
 * which compares them.
 *
 * The Sheet finds its columns by their heading ("Monday Breakfast: Drinks
 * dump sink"), so changing a task's name starts a fresh column for it and
 * leaves the old weeks' column where it was.
 */
var TASKS = [
  ['mon-breakfast', 'Drinks dump sink'],
  ['mon-lunch', 'Desserts station'],
  ['mon-afternoon', 'Manager station'],
  ['mon-dinner', 'Mobile drinks station'],

  ['tue-breakfast', 'All FOH drains'],
  ['tue-lunch', 'Coffee/tea brewer area'],
  ['tue-afternoon', 'DT sauce wall'],
  ['tue-dinner', 'Tea, lemonade, soda tower in DT'],

  ['wed-breakfast', 'Condiment towers'],
  ['wed-lunch', 'Ice dream machine'],
  ['wed-afternoon', 'Dump sink in drinks'],
  ['wed-dinner', 'Bag holders, condiment towers'],

  ['thu-breakfast', 'Both outside doors in DT'],
  ['thu-lunch', 'FC drinks station'],
  ['thu-afternoon', 'Mop pit area'],
  ['thu-dinner', 'Scrub under all machines in DT'],

  ['fri-breakfast', 'FC register stand'],
  ['fri-lunch', 'FC, 3rd party, kids meal table'],
  ['fri-afternoon', 'Trash cans in FOH, brooms, and dustpans'],
  ['fri-dinner', 'FC sauce wall'],

  ['sat-breakfast', 'Lemonade lowboy'],
  ['sat-lunch', 'Mobile drinks lowboy'],
  ['sat-afternoon', 'Bagging lowboy'],
  ['sat-dinner', 'Air vents in DT cockpit'],
];

/** id → { day, shift, task, column }, built once from the lists above. */
var TASK_INFO =
  typeof TASKS === 'undefined' || typeof DAYS === 'undefined' || typeof SHIFTS === 'undefined'
    ? {} // only part of the file was pasted — checkWholeFilePasted_ says so
    : (function () {
        var dayNames = {};
        var shiftNames = {};
        DAYS.forEach(function (pair) {
          dayNames[pair[0]] = pair[1];
        });
        SHIFTS.forEach(function (pair) {
          shiftNames[pair[0]] = pair[1];
        });
        var out = {};
        TASKS.forEach(function (pair) {
          var parts = pair[0].split('-');
          var day = dayNames[parts[0]];
          var shift = shiftNames[parts[1]];
          out[pair[0]] = {
            day: day,
            shift: shift,
            task: pair[1],
            column: day + ' ' + shift + ': ' + pair[1],
          };
        });
        return out;
      })();

var TASK_IDS = typeof TASK_INFO === 'undefined' ? [] : Object.keys(TASK_INFO);

/**
 * HOW IT WORKS
 *
 * Paste this whole file into the Sheet's Apps Script editor (Extensions →
 * Apps Script), run `setup` once, then deploy it as a web app. The README has
 * the clicks. Every device showing the chart talks to the web app address;
 * nothing else is needed.
 *
 * WHAT IT KEEPS
 *
 *   Weekly Chart     one row per week (the Monday it starts on), one column
 *                    per task. A done task holds the initials of whoever did
 *                    it, and the cell's note says when. A blank cell is not
 *                    done. "Done" counts the week's finished tasks.
 *   Completion Log   every check mark and every undo, as it arrived.
 *
 * Weeks run Monday to Saturday. On Sunday the chart still shows the week that
 * just ended, and Monday starts a fresh, empty one.
 *
 * THREE THINGS IT IS CAREFUL ABOUT
 *
 *  1. Two people at once. Every write happens inside the script lock, so two
 *     devices marking at the same moment can't overwrite each other.
 *  2. A check mark sent twice. A device whose wifi drops mid-send cannot know
 *     whether the Sheet got it, so it sends again. Each change carries an id,
 *     and an id seen in the last six hours is answered without being applied
 *     again.
 *  3. Which week it is. Days are worked out in America/Los_Angeles, never
 *     UTC, so Saturday's dinner close isn't counted as next week.
 */

/* --- The web app ---------------------------------------------------------- */

/** GET ?week=YYYY-MM-DD → that week's check marks (this week if none is given). */
function doGet(e) {
  var params = (e && e.parameter) || {};
  return respond(function () {
    var week = weekFrom(params.week, false);
    return {
      week: week,
      thisWeek: thisWeek(),
      marks: readWeek(week),
      sheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    };
  });
}

/**
 * POST { opId, week, task, action: 'complete' | 'undo', initials } → that
 * week's check marks after the change.
 *
 * Sent as text/plain rather than JSON on purpose: a JSON content type makes
 * the browser ask permission first (a CORS "preflight"), and Apps Script has
 * no way to answer that, so the request would never be sent at all.
 */
function doPost(e) {
  return respond(function () {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return applyChange(body);
  });
}

function respond(work) {
  var out;
  try {
    checkWholeFilePasted_();
    out = work();
    out.ok = true;
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/* --- Marking a task done (or not) ----------------------------------------- */

function applyChange(body) {
  var opId = String(body.opId || '');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(opId)) throw new Error('Missing or malformed opId');

  var week = weekFrom(body.week, true);
  var id = String(body.task || '');
  if (!TASK_INFO[id]) throw new Error('There is no task called "' + id + '" on the chart.');
  var action = body.action;
  if (action !== 'complete' && action !== 'undo') throw new Error('Unknown action');
  var initials = action === 'complete' ? cleanInitials(body.initials) : '';

  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var cache = CacheService.getScriptCache();
    if (cache.get('op:' + opId)) {
      return { week: week, thisWeek: thisWeek(), marks: readWeek(week, true), duplicate: true };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ensureChartSheet(ss);
    var columns = columnMap(sheet);
    var row = findOrAddRow(sheet, week);
    var cell = sheet.getRange(row, columns[TASK_INFO[id].column]);
    var current = String(cell.getValue() || '').trim();
    var notice = null;

    if (action === 'complete') {
      if (!current) {
        cell.setNumberFormat('@');
        cell.setValue(initials);
        cell.setNote('Done ' + stamp(new Date()));
        logChange(ss, week, id, initials, 'Completed');
      } else if (current.toUpperCase() !== initials) {
        // Somebody else got there first. Their check mark stays.
        notice = 'Already marked done by ' + current + '.';
      }
    } else if (current) {
      cell.setValue('');
      cell.setNote('');
      logChange(ss, week, id, current, 'Undone');
    }

    var width = sheet.getLastColumn();
    var values = sheet.getRange(row, 1, 1, width).getValues()[0];
    var notes = sheet.getRange(row, 1, 1, width).getNotes()[0];
    var marks = marksFromRow(values, notes, columns);
    sheet.getRange(row, columns.Done).setValue(Object.keys(marks).length + ' of ' + TASK_IDS.length);

    SpreadsheetApp.flush();
    cache.put('op:' + opId, '1', 21600); // six hours — the longest the cache allows
    cache.put('week:' + week, JSON.stringify(marks), 20);

    var out = { week: week, thisWeek: thisWeek(), marks: marks };
    if (notice) out.notice = notice;
    return out;
  } finally {
    lock.releaseLock();
  }
}

/** "kr" → "KR". Letters only, two to four of them. */
function cleanInitials(raw) {
  var initials = String(raw || '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
  if (initials.length < 2 || initials.length > 4) {
    throw new Error('Initials should be 2 to 4 letters.');
  }
  return initials;
}

/**
 * One week's check marks, from a short-lived cache when there is one.
 *
 * Every device asks every few seconds, and reading the Sheet is the slow
 * part. Twenty seconds is short enough that initials typed into the Sheet by
 * hand show on the chart almost straight away, and every change refreshes it.
 */
function readWeek(week, skipCache) {
  var cache = CacheService.getScriptCache();
  if (!skipCache) {
    var hit = cache.get('week:' + week);
    if (hit) return JSON.parse(hit);
  }

  var marks = {};
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHART_SHEET);
  if (sheet) {
    var row = findRow(sheet, week);
    if (row) {
      var range = sheet.getRange(row, 1, 1, sheet.getLastColumn());
      marks = marksFromRow(range.getValues()[0], range.getNotes()[0], columnMap(sheet));
    }
  }

  cache.put('week:' + week, JSON.stringify(marks), 20);
  return marks;
}

/** Only the done tasks: { taskId: { by: 'KR', at: 'Mon Oct 26, 9:42 AM' } }. */
function marksFromRow(values, notes, columns) {
  var out = {};
  TASK_IDS.forEach(function (id) {
    var index = columns[TASK_INFO[id].column] - 1;
    var by = String(values[index] === undefined ? '' : values[index]).trim();
    if (!by) return;
    var note = String((notes && notes[index]) || '');
    out[id] = { by: by.toUpperCase(), at: note.replace(/^Done /, '') };
  });
  return out;
}

function logChange(ss, week, id, initials, action) {
  var sheet = ensureLogSheet(ss);
  var info = TASK_INFO[id];
  var row = sheet.getLastRow() + 1;
  sheet.getRange(row, 2).setNumberFormat('@');
  sheet
    .getRange(row, 1, 1, 7)
    .setValues([[new Date(), week, info.day, info.shift, info.task, initials, action]]);
}

/* --- Days and weeks ------------------------------------------------------- */

function today() {
  return Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd');
}

/** "Mon Oct 26, 9:42 AM", in the store's time. */
function stamp(date) {
  return Utilities.formatDate(date, TIME_ZONE, 'EEE MMM d, h:mm a');
}

/** The Monday a "YYYY-MM-DD" day belongs to. A Sunday belongs to the week before it. */
function mondayOf(day) {
  var parts = day.split('-');
  var date = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12));
  var weekday = date.getUTCDay(); // 0 = Sunday
  var back = weekday === 0 ? 6 : weekday - 1;
  date = new Date(date.getTime() - back * 86400000);
  return [
    date.getUTCFullYear(),
    ('0' + (date.getUTCMonth() + 1)).slice(-2),
    ('0' + date.getUTCDate()).slice(-2),
  ].join('-');
}

function thisWeek() {
  return mondayOf(today());
}

/**
 * The week a request is about, as its Monday. Anything malformed means this
 * week. Earlier weeks are allowed, so a task finished at Saturday's close can
 * still be checked off on Monday morning. A week that hasn't started is
 * refused for a change and read as this week for a look.
 */
function weekFrom(value, forChange) {
  var now = thisWeek();
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return now;
  var week = mondayOf(value);
  if (week > now) {
    if (forChange) throw new Error("That week hasn't started yet.");
    return now;
  }
  return week;
}

/* --- The sheets themselves ------------------------------------------------ */

function headerLabels() {
  var labels = ['Week Of'];
  TASK_IDS.forEach(function (id) {
    labels.push(TASK_INFO[id].column);
  });
  labels.push('Done');
  return labels;
}

function ensureChartSheet(ss) {
  var sheet = ss.getSheetByName(CHART_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CHART_SHEET);
    var labels = headerLabels();
    sheet.getRange(1, 1, 1, labels.length).setValues([labels]);
    styleHeader(sheet, labels.length);
  }
  return sheet;
}

function ensureLogSheet(ss) {
  var sheet = ss.getSheetByName(LOG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(LOG_SHEET);
    var labels = ['Timestamp', 'Week Of', 'Day', 'Shift', 'Task', 'Initials', 'Action'];
    sheet.getRange(1, 1, 1, labels.length).setValues([labels]);
    styleHeader(sheet, labels.length);
  }
  return sheet;
}

function styleHeader(sheet, width) {
  sheet
    .getRange(1, 1, 1, width)
    .setFontWeight('bold')
    .setBackground('#1D2B4A')
    .setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
}

/**
 * Header label → column number. Any task missing from the header (one added
 * or renamed since the Sheet was made) gets a new column on the end, so
 * changing the chart never needs anyone to touch the Sheet.
 */
function columnMap(sheet) {
  var width = sheet.getLastColumn();
  var header = sheet.getRange(1, 1, 1, width).getValues()[0];
  var map = {};
  header.forEach(function (label, i) {
    if (label !== '' && map[label] === undefined) map[label] = i + 1;
  });

  var wanted = TASK_IDS.map(function (id) {
    return TASK_INFO[id].column;
  }).concat(['Done']);
  wanted.forEach(function (label) {
    if (map[label] !== undefined) return;
    width += 1;
    sheet.getRange(1, width).setValue(label);
    map[label] = width;
  });

  return map;
}

/** The row holding `week`, or 0. Weeks are kept as plain text, never Sheets dates. */
function findRow(sheet, week) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var weeks = sheet.getRange(2, 1, last - 1, 1).getDisplayValues();
  // Newest rows are at the bottom, and this week is nearly always what is asked for.
  for (var i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i][0] === week) return i + 2;
  }
  return 0;
}

function findOrAddRow(sheet, week) {
  var row = findRow(sheet, week);
  if (row) return row;

  row = sheet.getLastRow() + 1;
  var cell = sheet.getRange(row, 1);
  // Text, so Sheets doesn't turn "2026-10-26" into a date and display it as
  // "10/26/2026" — which would then never match the week we look for.
  cell.setNumberFormat('@');
  cell.setValue(week);
  return row;
}

/* --- Set up, run once by hand --------------------------------------------- */

/**
 * Builds both tabs with their headings. Safe to run again at any time: it
 * never touches a check mark, and only adds headings that are missing.
 */
function setup() {
  checkWholeFilePasted_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TIME_ZONE);
  var chart = ensureChartSheet(ss);
  columnMap(chart);
  ensureLogSheet(ss);

  // A brand-new spreadsheet comes with an empty "Sheet1"; tidy it away.
  var blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
}

/** Adds a "Cleaning Chart" menu to the Sheet so setup can be re-run without the editor. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Cleaning Chart')
    .addItem('Set up / repair the tabs', 'setup')
    .addToUi();
}

/**
 * Kept at the very bottom on purpose: any paste that reaches `setup` also
 * reaches this, so the check is there whenever it is needed.
 *
 * Stops with a plain message if the top of this file didn't make it into the
 * editor. Copying a long file — especially on an iPad — easily drops its first
 * lines, and the error Google shows for that ("TIME_ZONE is not defined")
 * says nothing about what actually went wrong.
 *
 * `typeof` is used because it is the one way to ask about a name that may
 * never have been declared without that question itself being the error.
 */
function checkWholeFilePasted_() {
  if (
    typeof TIME_ZONE === 'undefined' ||
    typeof CHART_SHEET === 'undefined' ||
    typeof LOG_SHEET === 'undefined' ||
    typeof DAYS === 'undefined' ||
    typeof SHIFTS === 'undefined' ||
    typeof TASKS === 'undefined' ||
    typeof TASK_INFO === 'undefined' ||
    typeof TASK_IDS === 'undefined' ||
    TASK_IDS.length === 0
  ) {
    throw new Error(
      'Only part of Code.gs was pasted. Delete everything in this editor, paste the ' +
        'whole file again (it starts with "===== START OF Code.gs" and ends with ' +
        '"===== END OF Code.gs"), press Save, and run setup again.',
    );
  }
}

// ===== END OF Code.gs — if you can see this, everything was pasted =====

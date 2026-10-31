/**
 * Just enough of Google Apps Script to run apps-script/Code.gs in Node.
 *
 * Used by the tests (`npm test`) and by the stand-in Sheet server
 * (`npm run mock-sheet`), so both exercise the real script rather than a copy
 * of its logic. Sheets are plain 2-D arrays; formatting calls are accepted and
 * ignored. Cell notes are kept alongside the values.
 */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const CODE = new URL('../apps-script/Code.gs', import.meta.url);

class FakeSheet {
  constructor(name) {
    this.name = name;
    this.cells = []; // cells[row][col], both 0-based
    this.notes = [];
    this.formats = [];
  }
  getName() {
    return this.name;
  }
  getLastRow() {
    for (let r = this.cells.length - 1; r >= 0; r--) {
      if ((this.cells[r] ?? []).some((v) => v !== '' && v !== undefined)) return r + 1;
    }
    return 0;
  }
  getLastColumn() {
    let max = 0;
    for (const row of this.cells) {
      if (!row) continue;
      for (let c = row.length - 1; c >= 0; c--) {
        if (row[c] !== '' && row[c] !== undefined) {
          max = Math.max(max, c + 1);
          break;
        }
      }
    }
    return max;
  }
  getRange(row, col, rows = 1, cols = 1) {
    return new FakeRange(this, row, col, rows, cols);
  }
  setFrozenRows() {}
  setFrozenColumns() {}
}

class FakeRange {
  constructor(sheet, row, col, rows, cols) {
    if (row < 1 || col < 1 || rows < 1 || cols < 1) {
      throw new Error(`Bad range ${row},${col},${rows},${cols}`);
    }
    Object.assign(this, { sheet, row, col, rows, cols });
  }
  #read(grid) {
    const out = [];
    for (let r = 0; r < this.rows; r++) {
      const line = [];
      for (let c = 0; c < this.cols; c++) {
        const v = grid[this.row - 1 + r]?.[this.col - 1 + c];
        line.push(v === undefined ? '' : v);
      }
      out.push(line);
    }
    return out;
  }
  #write(grid, values) {
    if (values.length !== this.rows || values.some((l) => l.length !== this.cols)) {
      throw new Error('setValues: shape does not match the range');
    }
    values.forEach((line, r) => {
      const at = this.row - 1 + r;
      grid[at] ??= [];
      line.forEach((v, c) => {
        grid[at][this.col - 1 + c] = v;
      });
    });
    return this;
  }
  getValues() {
    return this.#read(this.sheet.cells);
  }
  getValue() {
    return this.getValues()[0][0];
  }
  getDisplayValues() {
    return this.getValues().map((line) => line.map((v) => String(v)));
  }
  setValues(values) {
    return this.#write(this.sheet.cells, values);
  }
  setValue(value) {
    return this.setValues([[value]]);
  }
  getNotes() {
    return this.#read(this.sheet.notes);
  }
  setNote(note) {
    return this.#write(this.sheet.notes, [[note]]);
  }
  setNumberFormat(format) {
    this.sheet.formats.push([this.row, this.col, format]);
    return this;
  }
  setFontWeight() {
    return this;
  }
  setBackground() {
    return this;
  }
  setFontColor() {
    return this;
  }
}

class FakeSpreadsheet {
  constructor() {
    this.sheets = [new FakeSheet('Sheet1')];
  }
  getSheetByName(name) {
    return this.sheets.find((s) => s.name === name) ?? null;
  }
  getSheets() {
    return this.sheets;
  }
  insertSheet(name) {
    const sheet = new FakeSheet(name);
    this.sheets.push(sheet);
    return sheet;
  }
  deleteSheet(sheet) {
    this.sheets = this.sheets.filter((s) => s !== sheet);
  }
  setSpreadsheetTimeZone() {}
  getUrl() {
    return 'https://docs.google.com/spreadsheets/d/fake-sheet/edit';
  }
}

/** The two patterns Code.gs uses, done with Intl the way Apps Script would. */
function formatDate(date, timeZone, pattern) {
  if (pattern === 'yyyy-MM-dd') {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }
  if (pattern === 'EEE MMM d, h:mm a') {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
        .formatToParts(date)
        .map((p) => [p.type, p.value]),
    );
    return `${parts.weekday} ${parts.month} ${parts.day}, ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
  }
  throw new Error(`Unsupported pattern ${pattern}`);
}

/**
 * A fresh copy of the script with its own empty spreadsheet and cache.
 * `clock.now` can be set to pretend it is another moment.
 *
 * `fromLine` loads the file starting part-way down, the way it arrives in the
 * Apps Script editor when the copy missed its first lines.
 */
export function loadScript({ fromLine = 1 } = {}) {
  const spreadsheet = new FakeSpreadsheet();
  const cache = new Map();
  const clock = { now: null };

  const RealDate = Date;
  class ClockDate extends RealDate {
    constructor(...args) {
      if (args.length === 0 && clock.now !== null) super(clock.now);
      else super(...args);
    }
    static now() {
      return clock.now ?? RealDate.now();
    }
  }

  const context = {
    Date: ClockDate,
    JSON,
    Math,
    Number,
    String,
    Object,
    Error,
    isFinite,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet,
      flush() {},
    },
    LockService: {
      getScriptLock: () => ({ waitLock() {}, releaseLock() {} }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (key) => {
          const hit = cache.get(key);
          if (!hit || hit.until < ClockDate.now()) return null;
          return hit.value;
        },
        put: (key, value, seconds) => {
          cache.set(key, { value, until: ClockDate.now() + seconds * 1000 });
        },
      }),
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({
        text,
        setMimeType() {
          return this;
        },
        getContent() {
          return text;
        },
      }),
    },
    Utilities: { formatDate },
  };

  vm.createContext(context);
  const source = readFileSync(CODE, 'utf8').split('\n').slice(fromLine - 1).join('\n');
  vm.runInContext(source, context, { filename: 'Code.gs' });

  return { script: context, spreadsheet, cache, clock };
}

/** The script's reply to a GET, parsed. */
export function get(script, params = {}) {
  return JSON.parse(script.doGet({ parameter: params }).getContent());
}

/** The script's reply to a POST, parsed. */
export function post(script, body) {
  return JSON.parse(script.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
}

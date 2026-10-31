/**
 * Where the check marks actually live.
 *
 * There are two implementations behind one small interface:
 *
 *   sheetBackend  the real one — the Google Sheet, through the Apps Script
 *                 web app in apps-script/Code.gs, shared by every device
 *   demoBackend   a stand-in that keeps everything in this browser only, used
 *                 when no Sheet address has been configured yet so the chart
 *                 can be looked at and tapped before any setup is done
 *
 * Nothing above this file knows which one it is talking to, apart from the
 * `demo` flag it uses to put a warning banner on screen.
 */

import { TASK_IDS } from './tasks';
import { thisWeek } from './dates';

/** A done task: who did it, and when (as the Sheet wrote it, may be empty). */
export type Mark = { by: string; at: string };
export type Marks = Record<string, Mark>;

/** One change, sent on its own. `opId` lets the Sheet ignore a resend. */
export type Change = {
  opId: string;
  week: string;
  task: string;
  action: 'complete' | 'undo';
  initials?: string;
};

export type WeekMarks = {
  week: string;
  marks: Marks;
  sheetUrl?: string;
  /** Something the Sheet wants said, like "Already marked done by BR." */
  notice?: string;
};

/**
 * Something went wrong. `retry` is true when it is worth sending the same
 * thing again later (no wifi, Google having a moment) and false when the Sheet
 * looked at the request and refused it, where sending it again would only be
 * refused again.
 */
export type Failure = { failed: true; retry: boolean; message: string };

export type Backend = {
  demo: boolean;
  load(week: string): Promise<WeekMarks | Failure>;
  send(change: Change): Promise<WeekMarks | Failure>;
};

export const isFailure = (value: WeekMarks | Failure): value is Failure => 'failed' in value;

const failure = (message: string, retry = true): Failure => ({ failed: true, retry, message });

/* --- The real one --------------------------------------------------------- */

const SHEET_URL = import.meta.env.VITE_SHEET_URL?.trim() ?? '';

type Reply = {
  ok: boolean;
  error?: string;
  week: string;
  marks: Marks;
  sheetUrl?: string;
  notice?: string;
};

/**
 * Apps Script answers every request with a redirect to a second Google
 * address, which the browser follows by itself. If the web app hasn't been
 * shared with "Anyone", that second page is a Google sign-in page instead —
 * HTML, not JSON — which is why a reply that won't parse gets its own message.
 */
async function ask(init?: RequestInit, query = ''): Promise<WeekMarks | Failure> {
  let response: Response;
  try {
    response = await fetch(SHEET_URL + query, { redirect: 'follow', ...init });
  } catch {
    return failure('No connection to the Google Sheet.');
  }

  if (!response.ok) return failure(`The Google Sheet answered ${response.status}.`);

  let reply: Reply;
  try {
    reply = (await response.json()) as Reply;
  } catch {
    return failure(
      "The Google Sheet didn't answer properly — check its web app is shared with “Anyone”.",
    );
  }

  if (!reply.ok) return failure(reply.error ?? 'The Google Sheet refused that.', false);
  return {
    week: reply.week,
    marks: reply.marks ?? {},
    sheetUrl: reply.sheetUrl,
    notice: reply.notice,
  };
}

const sheetBackend: Backend = {
  demo: false,

  load(week) {
    const join = SHEET_URL.includes('?') ? '&' : '?';
    return ask({ method: 'GET' }, `${join}week=${encodeURIComponent(week)}`);
  },

  send(change) {
    return ask({
      method: 'POST',
      // text/plain, not application/json: see doPost in apps-script/Code.gs.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(change),
    });
  },
};

/* --- The stand-in --------------------------------------------------------- */

const DEMO_KEY = 'cfa-cleaning:demo-marks';

function readDemo(): Record<string, Marks> {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY) ?? '{}') as Record<string, Marks>;
  } catch {
    return {};
  }
}

const stamp = () =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
    .format(new Date())
    .replace(/,(?= \w+ \d)/, '');

const seenOps = new Set<string>();

const demoBackend: Backend = {
  demo: true,

  async load(week) {
    return { week, marks: readDemo()[week] ?? {} };
  },

  async send(change) {
    if (change.week > thisWeek()) return failure("That week hasn't started yet.", false);
    if (!TASK_IDS.includes(change.task)) return failure('There is no such task.', false);

    const all = readDemo();
    const marks = { ...(all[change.week] ?? {}) };
    let notice: string | undefined;

    if (!seenOps.has(change.opId)) {
      seenOps.add(change.opId);
      const current = marks[change.task];
      if (change.action === 'complete' && change.initials) {
        if (!current) marks[change.task] = { by: change.initials, at: stamp() };
        else if (current.by !== change.initials) notice = `Already marked done by ${current.by}.`;
      } else if (change.action === 'undo') {
        delete marks[change.task];
      }
      all[change.week] = marks;
      try {
        localStorage.setItem(DEMO_KEY, JSON.stringify(all));
      } catch {
        // Storage full or switched off. Demo mode only; the screen still works.
      }
    }
    return { week: change.week, marks, notice };
  },
};

export const backend: Backend = SHEET_URL ? sheetBackend : demoBackend;

/**
 * Keeps this device's chart in step with the Sheet, and with every other
 * device showing it.
 *
 * HOW A CHECK MARK TRAVELS
 *
 *   tap ──► waiting ──► sent ──► the Sheet
 *
 * Marking a task done (or undoing it) puts a change in `waiting` and shows on
 * the chart at once. Changes are sent one at a time, in order. The queue is
 * saved on the device, so a reload or a wifi outage loses nothing: whatever is
 * waiting goes to the Sheet when it next can. A change that is sent again —
 * because the answer to the first try never arrived — keeps its id, and the
 * Sheet ignores an id it has already applied.
 *
 * WHAT THE CHART SHOWS
 *
 *   the Sheet's last answer for the week + every change still waiting
 *
 * Other devices' check marks arrive by asking the Sheet every few seconds. An
 * answer to that is thrown away if a change was sent or answered while it was
 * out, because it might be from just before this device's own change landed.
 */

import { useSyncExternalStore } from 'react';
import { backend, isFailure, type Change, type Mark, type Marks } from './backend';
import { thisWeek as currentWeek } from './dates';

const QUEUE_KEY = 'cfa-cleaning:waiting';
const POLL_EVERY_MS = 8000;

export type SyncStatus = 'loading' | 'live' | 'saving' | 'offline';

/** A check mark as the chart shows it. `waiting` = not yet confirmed by the Sheet. */
export type ShownMark = Mark & { waiting?: boolean };

export type ChartState = {
  /** The Monday of the week on screen. */
  week: string;
  /** The Monday of the week happening now. The chart can't go past it. */
  thisWeek: string;
  /** True until the Sheet has answered for the week on screen. */
  loading: boolean;
  marks: Record<string, ShownMark>;
  status: SyncStatus;
  waiting: number;
  /** Something worth telling whoever is looking: a refusal, or "already done by BR". */
  notice: string | null;
};

/* --- Saved on the device -------------------------------------------------- */

function readQueue(): Change[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Change[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full or switched off. Changes still go to the Sheet; only a
    // reload before they arrive would lose them.
  }
}

/* --- What is going on ------------------------------------------------------ */

let queue: Change[] = readQueue();
let server: { week: string; marks: Marks } | null = null;
let week = currentWeek();
let sending = false;
let failures = 0;
let lastPollFailed = false;
let notice: string | null = null;
/** Bumped whenever a send starts or ends, so a poll that overlapped one is ignored. */
let epoch = 0;
let retryTimer: number | undefined;

const listeners = new Set<() => void>();
let snapshot: ChartState = build();

function build(): ChartState {
  const now = currentWeek();
  const marks: Record<string, ShownMark> = {};
  const loaded = server?.week === week;
  if (loaded) Object.assign(marks, server!.marks);

  // Changes still on their way, in the order they were made.
  for (const change of queue) {
    if (change.week !== week) continue;
    if (change.action === 'undo') delete marks[change.task];
    else if (!marks[change.task] || marks[change.task].waiting) {
      marks[change.task] = { by: change.initials ?? '', at: '', waiting: true };
    }
  }

  let status: SyncStatus = 'live';
  if (failures > 0 || lastPollFailed) status = 'offline';
  else if (queue.length) status = 'saving';
  else if (!loaded) status = 'loading';

  return {
    week,
    thisWeek: now,
    loading: !loaded,
    marks,
    status,
    waiting: queue.length,
    notice,
  };
}

function changed(): void {
  snapshot = build();
  listeners.forEach((listener) => listener());
}

/* --- Sending ---------------------------------------------------------------- */

function newOpId(): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return random.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
}

async function pump(): Promise<void> {
  if (sending || queue.length === 0) return;
  window.clearTimeout(retryTimer);

  sending = true;
  epoch++;
  const change = queue[0];
  const reply = await backend.send(change);
  sending = false;
  epoch++;

  if (isFailure(reply)) {
    if (reply.retry) {
      // Keep it, id and all, and try again later: 2 s, 4 s, 8 s … up to 30 s.
      failures++;
      retryTimer = window.setTimeout(() => void pump(), Math.min(30_000, 1000 * 2 ** failures));
      changed();
      return;
    }
    // The Sheet looked at it and said no. Sending it again would only get
    // the same answer and hold up everything behind it.
    queue = queue.filter((c) => c !== change);
    notice = reply.message;
  } else {
    queue = queue.filter((c) => c !== change);
    if (reply.notice) notice = reply.notice;
    if (reply.week === week) server = { week: reply.week, marks: reply.marks };
  }

  failures = 0;
  saveQueue();
  changed();
  void pump();
}

function enqueue(change: Omit<Change, 'opId'>): void {
  queue = [...queue, { ...change, opId: newOpId() }];
  notice = null;
  saveQueue();
  changed();
  void pump();
}

/* --- Asking -------------------------------------------------------------------- */

async function poll(): Promise<void> {
  // A device left on overnight into Monday moves on to the new week by itself.
  const now = currentWeek();
  if (now !== snapshot.thisWeek && week === snapshot.thisWeek) week = now;

  if (sending) return;
  const asked = week;
  const startedAt = epoch;
  const reply = await backend.load(asked);
  if (epoch !== startedAt || asked !== week) return; // stale, see the top of this file

  if (isFailure(reply)) {
    lastPollFailed = true;
    if (!reply.retry) notice = reply.message;
  } else {
    lastPollFailed = false;
    server = { week: reply.week, marks: reply.marks };
  }
  changed();
}

/* --- What the screen uses ------------------------------------------------------ */

export function markDone(task: string, initials: string): void {
  enqueue({ week, task, action: 'complete', initials });
}

export function undoMark(task: string): void {
  enqueue({ week, task, action: 'undo' });
}

export function showWeek(monday: string): void {
  if (monday > currentWeek() || monday === week) return;
  week = monday;
  notice = null;
  changed();
  void poll();
}

export function clearNotice(): void {
  notice = null;
  changed();
}

export function useChart(): ChartState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
  );
}

/** Starts polling and sending. Returns a function that stops it all. */
export function start(): () => void {
  const wake = () => {
    if (document.visibilityState !== 'visible') return;
    void poll();
    void pump();
  };

  wake();
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void poll();
  }, POLL_EVERY_MS);
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('online', wake);
  window.addEventListener('focus', wake);

  return () => {
    window.clearInterval(timer);
    window.clearTimeout(retryTimer);
    document.removeEventListener('visibilitychange', wake);
    window.removeEventListener('online', wake);
    window.removeEventListener('focus', wake);
  };
}

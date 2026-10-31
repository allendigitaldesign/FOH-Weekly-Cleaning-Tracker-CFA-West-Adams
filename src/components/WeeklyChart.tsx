/**
 * The chart, drawn like the printed board on the wall: a coloured column for
 * each day, a navy label for each shift, and in every box the task, a check
 * box, and a line for initials.
 *
 * It is drawn at one fixed size and then scaled to fill the screen, so it
 * looks the same — and screenshots the same — on every device. There are two
 * shapes, and whichever fills the screen better wins:
 *
 *   wide  days across, shifts down: exactly the printed board. iPads in
 *         landscape, laptops.
 *   tall  shifts across, days down: the same chart turned for a phone held
 *         upright, so the text is still big enough to read in a screenshot.
 *
 * Everything the chart needs comes in through props, so it can be lifted into
 * another app (the leadership app) without bringing this one's store along.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import type { ShownMark, SyncStatus } from '../store';
import { DAYS, SHIFTS, TASK_IDS, TASKS, taskId } from '../tasks';
import { addDays, shortDate, storeToday, weekLabel } from '../dates';
import { SprayBottle } from './SprayBottle';

export type ChartProps = {
  week: string;
  thisWeek: string;
  marks: Record<string, ShownMark>;
  status: SyncStatus;
  waiting: number;
  demo: boolean;
  onOpenTask(id: string): void;
  onShowWeek(monday: string): void;
};

const SHAPES = {
  wide: { width: 1200, height: 820 },
  tall: { width: 600, height: 1130 },
} as const;

type Shape = keyof typeof SHAPES;

/** Never blow it up past this, so a big monitor doesn't get cartoon text. */
const MAX_SCALE = 1.5;

export function ChartStage(props: ChartProps) {
  const stage = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setRoom({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  let shape: Shape = 'wide';
  let scale = 1;
  if (room) {
    const fit = (s: Shape) =>
      Math.min(room.width / SHAPES[s].width, room.height / SHAPES[s].height);
    shape = fit('wide') >= fit('tall') ? 'wide' : 'tall';
    scale = Math.min(fit(shape), MAX_SCALE);
  }
  const { width, height } = SHAPES[shape];

  return (
    <div className="stage" ref={stage}>
      {room && (
        <div style={{ width: width * scale, height: height * scale }}>
          <div
            className={`board is-${shape}`}
            style={{ width, height, transform: `scale(${scale})` }}
          >
            <WeeklyChart {...props} shape={shape} />
          </div>
        </div>
      )}
    </div>
  );
}

function WeeklyChart({
  week,
  thisWeek,
  marks,
  status,
  waiting,
  demo,
  onOpenTask,
  onShowWeek,
  shape,
}: ChartProps & { shape: Shape }) {
  const today = storeToday();
  const done = TASK_IDS.filter((id) => marks[id]).length;
  const wide = shape === 'wide';

  // Grid positions: in the wide shape days are columns and shifts are rows;
  // the tall shape swaps them. Track 1 holds the labels in both.
  const place = (dayIndex: number, shiftIndex: number) =>
    wide
      ? { gridColumn: dayIndex + 2, gridRow: shiftIndex + 2 }
      : { gridColumn: shiftIndex + 2, gridRow: dayIndex + 2 };

  return (
    <>
      <header className="board-header">
        <SprayBottle className="board-icon" />
        <div className="title-pill">
          <h1>FOH Weekly Cleaning Schedule</h1>
          <div className="title-side">
            <div className="week-nav">
              <button
                type="button"
                aria-label="Previous week"
                onClick={() => onShowWeek(addDays(week, -7))}
              >
                ‹
              </button>
              <span className="week-label">
                {week === thisWeek ? 'This week' : 'Week of'} · {weekLabel(week)}
              </span>
              <button
                type="button"
                aria-label="Next week"
                disabled={week >= thisWeek}
                onClick={() => onShowWeek(addDays(week, 7))}
              >
                ›
              </button>
            </div>
            <div className="title-meta">
              <span className="done-count">
                {done} of {TASK_IDS.length} done
              </span>
              <StatusPill status={status} waiting={waiting} demo={demo} />
            </div>
          </div>
        </div>
      </header>

      <div className="grid">
        {SHIFTS.map((shift, s) => (
          <div
            key={shift.id}
            className="shift-label"
            style={wide ? { gridColumn: 1, gridRow: s + 2 } : { gridColumn: s + 2, gridRow: 1 }}
          >
            <span>{shift.label}</span>
          </div>
        ))}

        {DAYS.map((day, d) => {
          const isToday = week === thisWeek && addDays(week, d) === today;
          const band = wide
            ? { gridColumn: d + 2, gridRow: '1 / 6' }
            : { gridColumn: '1 / 6', gridRow: d + 2 };
          const head = wide ? { gridColumn: d + 2, gridRow: 1 } : { gridColumn: 1, gridRow: d + 2 };
          return [
            <div
              key={`${day.id}-band`}
              className={`day-band${isToday ? ' is-today' : ''}`}
              style={{ ...band, borderColor: day.color }}
            />,
            <div
              key={`${day.id}-head`}
              className="day-head"
              style={{ ...head, background: day.color }}
            >
              <span className="day-name">{day.label}</span>
              <span className="day-date">{isToday ? 'Today' : shortDate(week, d)}</span>
            </div>,
            ...SHIFTS.map((shift, s) => {
              const id = taskId(day.id, shift.id);
              const mark = marks[id];
              return (
                <button
                  key={id}
                  type="button"
                  className={`cell${s > 0 ? ' has-dots' : ''}${mark ? ' is-done' : ''}`}
                  style={place(d, s)}
                  onClick={() => onOpenTask(id)}
                  aria-label={`${day.label} ${shift.label}: ${TASKS[id]}${
                    mark ? `, done by ${mark.by}` : ', not done'
                  }`}
                >
                  <span className="task">{TASKS[id]}</span>
                  <span className={`sign${mark?.waiting ? ' is-waiting' : ''}`}>
                    <span className="box">{mark && <CheckMark />}</span>
                    <span className="initials">{mark?.by ?? ''}</span>
                  </span>
                </button>
              );
            }),
          ];
        })}
      </div>
    </>
  );
}

function CheckMark() {
  return (
    <svg className="check" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M7 27c4 3 7 7 10 12C23 25 32 13 44 4" />
    </svg>
  );
}

function StatusPill({ status, waiting, demo }: { status: SyncStatus; waiting: number; demo: boolean }) {
  const text = demo
    ? 'Demo'
    : status === 'offline'
      ? waiting
        ? `Offline · ${waiting} waiting`
        : 'Offline'
      : status === 'saving'
        ? 'Saving…'
        : status === 'loading'
          ? 'Loading…'
          : 'Live';
  return (
    <span className={`status is-${demo ? 'demo' : status}`}>
      <i aria-hidden="true" />
      {text}
    </span>
  );
}

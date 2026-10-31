/**
 * What opens when a box on the chart is tapped.
 *
 *   not done yet  type your initials, press Mark complete
 *   done          shows who and when, with a way to undo a mistake
 *
 * Initials are never remembered between people: the store iPad is shared,
 * and a box filled in with the last person's initials would be worse than
 * typing two letters.
 */

import { useEffect, useState, type FormEvent } from 'react';
import type { ShownMark } from '../store';
import { taskInfo } from '../tasks';
import { weekLabel } from '../dates';

type Props = {
  id: string;
  mark: ShownMark | undefined;
  week: string;
  pastWeek: boolean;
  onComplete(initials: string): void;
  onUndo(): void;
  onClose(): void;
};

const clean = (raw: string) =>
  raw
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()
    .slice(0, 4);

export function MarkSheet({ id, mark, week, pastWeek, onComplete, onUndo, onClose }: Props) {
  const info = taskInfo(id);
  const [initials, setInitials] = useState('');
  const [confirmUndo, setConfirmUndo] = useState(false);
  const ready = initials.length >= 2;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ready) onComplete(initials);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        onClick={(e) => e.stopPropagation()}
        style={{ borderTopColor: info.day.color }}
      >
        <button type="button" className="sheet-close" aria-label="Close" onClick={onClose}>
          ×
        </button>

        <p className="sheet-when" style={{ color: info.day.color }}>
          {info.day.label} · {info.shift.label}
        </p>
        <h2 id="sheet-title">{info.task}</h2>
        {pastWeek && <p className="sheet-past">For the week of {weekLabel(week)}</p>}

        {!mark && (
          <form onSubmit={submit}>
            <label className="sheet-label" htmlFor="initials">
              Your initials
            </label>
            <input
              id="initials"
              className="initials-input"
              value={initials}
              onChange={(e) => setInitials(clean(e.target.value))}
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              placeholder="AB"
              maxLength={6}
            />
            <button type="submit" className="button is-primary" disabled={!ready}>
              ✓ Mark complete
            </button>
          </form>
        )}

        {mark && !confirmUndo && (
          <>
            <div className="sheet-done">
              <span className="sheet-done-check" aria-hidden="true">
                ✓
              </span>
              <div>
                <p className="sheet-done-by">
                  Done by <strong>{mark.by}</strong>
                </p>
                <p className="sheet-done-at">
                  {mark.waiting ? 'Saving to the Sheet…' : mark.at || 'Time not recorded'}
                </p>
              </div>
            </div>
            <button type="button" className="button is-quiet" onClick={() => setConfirmUndo(true)}>
              Not done? Undo the check mark
            </button>
          </>
        )}

        {mark && confirmUndo && (
          <>
            <p className="sheet-confirm">
              Take <strong>{mark.by}</strong>’s check mark off this task?
            </p>
            <div className="sheet-buttons">
              <button type="button" className="button is-quiet" onClick={() => setConfirmUndo(false)}>
                Keep it
              </button>
              <button type="button" className="button is-danger" onClick={onUndo}>
                Undo it
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

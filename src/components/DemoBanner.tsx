import { useState } from 'react';

/**
 * Shown when no Google Sheet has been connected yet. The chart still works,
 * but only on this one device — this makes sure nobody mistakes it for the
 * real thing.
 */
export function DemoBanner() {
  const [open, setOpen] = useState(false);

  return (
    <div className="demo-banner">
      <div className="demo-banner-row">
        <span>
          <strong>Demo mode</strong> — check marks saved only on this device.
        </span>
        <button type="button" onClick={() => setOpen(!open)}>
          {open ? 'Hide' : 'Why?'}
        </button>
      </div>

      {open && (
        <div className="demo-banner-detail">
          <p>
            The chart hasn't been connected to its Google Sheet yet, so nothing
            is shared. Everything marked here stays in this browser, other
            devices can't see it, and none of it reaches the Sheet.
          </p>
          <p>
            Once the Sheet is connected, this banner disappears and every
            device shows the same chart.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * The last line of defence for a screen nobody is standing in front of.
 *
 * React unmounts the whole tree when a render throws. Without something to
 * catch it that leaves a blank white page — no header, no message, no button —
 * and the only way back is for someone to know to reload a browser they can't
 * see the address bar of. On an iPad on the wall that is
 * the worst failure there is: it looks broken, it stays broken all day, and
 * nothing anywhere says what happened.
 *
 * So a crash gets a card instead, and one silent attempt to fix itself.
 *
 * WHY IT RELOADS ITSELF, AND WHY ONLY ONCE
 *
 * Most crashes here would be a one-off — a reply from the Sheet that
 * arrived in the wrong shape — and reloading clears them. Doing that
 * automatically means the iPad is usually working again before anyone walks
 * past. But a fault that happens on every render would then reload forever, so
 * the attempt is written down in sessionStorage first: one reload per tab, and
 * if it crashes again the card stays up and says so.
 *
 * sessionStorage, not localStorage, on purpose — it is emptied when the tab is
 * closed, so tomorrow's first crash is still allowed its own retry.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

const RETRY_KEY = 'cfa-cleaning:crash-reloaded';

type Props = { children: ReactNode };
type State = { crashed: boolean; retried: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false, retried: false };
  private healthy: number | undefined;

  static getDerivedStateFromError(): Partial<State> {
    return { crashed: true };
  }

  /**
   * A tab that has been up and running for a while has clearly recovered, so
   * give it its retry back. Without this the first crash of the day would use
   * up the only automatic reload the tab ever gets, and an unrelated crash
   * three weeks later — a store iPad is never closed — would sit there white
   * when a reload would have cleared it.
   */
  componentDidMount() {
    this.healthy = window.setTimeout(() => {
      try {
        sessionStorage.removeItem(RETRY_KEY);
      } catch {
        // Nothing to clear.
      }
    }, 30_000);
  }

  componentWillUnmount() {
    window.clearTimeout(this.healthy);
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Nobody reads a store iPad's console, but this is what turns "it went
    // white" into something diagnosable when the iPad is plugged into a Mac.
    console.error('Cleaning chart crashed', error, info.componentStack);

    let alreadyTried = true;
    try {
      alreadyTried = sessionStorage.getItem(RETRY_KEY) === '1';
      if (!alreadyTried) sessionStorage.setItem(RETRY_KEY, '1');
    } catch {
      // Private browsing, or storage turned off. Show the card and let a
      // person press the button rather than risk reloading in a circle.
    }

    if (alreadyTried) {
      this.setState({ retried: true });
      return;
    }

    // A beat before reloading, so the card is on screen rather than a white
    // flash, and so anything still in flight has a moment to settle.
    window.setTimeout(() => window.location.reload(), 1200);
  }

  render() {
    if (!this.state.crashed) return this.props.children;

    return (
      <div className="panel" role="alert">
        <h2>Something went wrong</h2>
        <p>
          {this.state.retried
            ? 'The chart hit the same problem twice, so it has stopped ' +
              'trying. Every check mark already sent is safe in the Sheet — this ' +
              'is only the screen.'
            : 'Reloading the chart now. Every check mark already sent is ' +
              'safe in the Sheet.'}
        </p>
        <button
          type="button"
          className="button"
          onClick={() => {
            try {
              sessionStorage.removeItem(RETRY_KEY);
            } catch {
              // Nothing to clear. Reloading is still worth a try.
            }
            window.location.reload();
          }}
        >
          Reload the chart
        </button>
      </div>
    );
  }
}

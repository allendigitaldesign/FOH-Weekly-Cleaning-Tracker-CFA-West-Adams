import { useEffect, useState } from 'react';
import { backend } from './backend';
import { clearNotice, markDone, showWeek, start, undoMark, useChart } from './store';
import { ChartStage } from './components/WeeklyChart';
import { MarkSheet } from './components/MarkSheet';
import { DemoBanner } from './components/DemoBanner';

export default function App() {
  useEffect(() => start(), []);
  const chart = useChart();
  const [openTask, setOpenTask] = useState<string | null>(null);

  // A notice ("Already marked done by BR.") stays up for a few seconds.
  useEffect(() => {
    if (!chart.notice) return;
    const timer = window.setTimeout(clearNotice, 7000);
    return () => window.clearTimeout(timer);
  }, [chart.notice]);

  return (
    <div className={`app${backend.demo ? ' has-banner' : ''}`}>
      <ChartStage
        week={chart.week}
        thisWeek={chart.thisWeek}
        marks={chart.marks}
        status={chart.status}
        waiting={chart.waiting}
        demo={backend.demo}
        onOpenTask={setOpenTask}
        onShowWeek={showWeek}
      />

      {openTask && (
        <MarkSheet
          id={openTask}
          mark={chart.marks[openTask]}
          week={chart.week}
          pastWeek={chart.week !== chart.thisWeek}
          onComplete={(initials) => {
            markDone(openTask, initials);
            setOpenTask(null);
          }}
          onUndo={() => {
            undoMark(openTask);
            setOpenTask(null);
          }}
          onClose={() => setOpenTask(null)}
        />
      )}

      {chart.notice && (
        <button type="button" className="notice" onClick={clearNotice}>
          {chart.notice}
        </button>
      )}

      {backend.demo && <DemoBanner />}
    </div>
  );
}

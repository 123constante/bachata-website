import { useState } from 'react';
import { fullDate } from '../../shared/dateWords';
import { londonTodayKey } from '@/lib/londonDate';
import { P3SeriesGoing } from './P3Going';
import { RANGE_DAYS, byEventOf, dailyTotals, sliceStats, viewsTotal, type StatsRange } from '../data/stats';
import { useP3Views } from '../data/useP3Data';
import { L } from '../model';
import { GoingTile, RetryButton, StateCard } from './parts';

const RANGES: ReadonlyArray<readonly [StatsRange, string]> = [['d', 'Today'], ['w', '7 days'], ['m', '30 days']];

function Chart({ days, today }: { days: Array<{ day: string; count: number }>; today: string }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const w = 100 / days.length;
  return (
    <figure className="p3-chart" data-testid="p3-chart">
      <svg viewBox="0 0 100 60" preserveAspectRatio="none" role="img" aria-label={`Views per day, highest ${max}`}>
        {days.map((d, i) => {
          const h = (d.count / max) * 56;
          return <rect key={d.day} x={i * w + w * 0.15} y={60 - h} width={w * 0.7} height={h} rx={0.6} />;
        })}
      </svg>
      <figcaption className="p3-chart-ax" aria-hidden="true">
        <span>{fullDate(days[0].day, today)}</span>
        <span>Today</span>
      </figcaption>
    </figure>
  );
}

/** C3 Stats: views over Today / 7 days / 30 days, by day and by event; going when the switch is on. */
export function StatsScreen() {
  const [range, setRange] = useState<StatsRange>('m');
  const [table, setTable] = useState(false);
  const views = useP3Views();

  const seg = (
    <div className="p3-seg" role="group" aria-label="Time range">
      {RANGES.map(([k, label]) => (
        <button key={k} type="button" aria-pressed={range === k} onClick={() => setRange(k)}>
          {label}
        </button>
      ))}
    </div>
  );

  if (views.isPending) {
    return (
      <div className="p3-stack">
        {seg}
        <StateCard title="Loading views&hellip;" testId="p3-stats-loading">Counting your views.</StateCard>
      </div>
    );
  }
  if (views.isError) {
    return (
      <div className="p3-stack">
        {seg}
        <StateCard title="We couldn&rsquo;t load your views" testId="p3-stats-error">
          <p>Check your connection, then try again.</p>
          <RetryButton onClick={() => void views.refetch()} />
        </StateCard>
      </div>
    );
  }

  const data = sliceStats(views.data, RANGE_DAYS[range]);
  const today = data.to || londonTodayKey();
  const total = viewsTotal(data);
  const allTotal = viewsTotal(views.data);
  const days = dailyTotals(data);
  const rows = byEventOf(data);
  const label = RANGES.find((r) => r[0] === range)![1];

  return (
    <div className="p3-stack" data-testid="p3-stats">
      {seg}
      <div className="p3-pair">
        <div className="p3-card p3-stat" data-testid="p3-stats-total">
          <div className="p3-stat-n">{total}</div>
          <div className="p3-stat-l">{L.views}, all your events</div>
        </div>
        <GoingTile />
      </div>
      {total === 0 && allTotal > 0 ? (
        <StateCard title={`No views ${range === 'd' ? 'today' : 'in the last 7 days'} yet`} testId="p3-stats-none-range">
          <p>You had {allTotal} {L.views} in the last 30 days.</p>
          <button type="button" className="p3-btn p3-btn-line" onClick={() => setRange('m')}>Show 30 days</button>
        </StateCard>
      ) : total === 0 ? (
        <StateCard title="No views yet" testId="p3-stats-none">
          {data.series.length
            ? 'Views show up as soon as dancers start opening your event. Share your link on WhatsApp or Instagram to get the first ones.'
            : 'You have no events to count yet. Views start once an event is on the calendar.'}
        </StateCard>
      ) : (
        <>
          {days.length > 1 && (
            <section aria-label="Views by day">
              <h2 className="p3-h2 p3-h2-row">
                <span>Views, {label.toLowerCase()}</span>
                <button type="button" className="p3-link" onClick={() => setTable((t) => !t)}>
                  {table ? 'Show the chart' : 'Show as a table'}
                </button>
              </h2>
              <div className="p3-card">
                {table ? (
                  <table className="p3-table" data-testid="p3-stats-table">
                    <thead>
                      <tr><th>Day</th><th className="p3-num">Views</th></tr>
                    </thead>
                    <tbody>
                      {[...days].reverse().map((d) => (
                        <tr key={d.day}><td>{fullDate(d.day, today)}</td><td className="p3-num">{d.count}</td></tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <Chart days={days} today={today} />
                )}
              </div>
            </section>
          )}
          <section aria-label="By event">
            <h2 className="p3-h2">By event</h2>
            <ul className="p3-card p3-list" data-testid="p3-stats-byevent">
              {rows.map((r) => (
                <li key={r.id} className="p3-row p3-row-col">
                  <div className="p3-h2-row">
                    <span className="p3-row-t">{r.name}</span>
                    <span className="p3-row-s p3-nowrap">{r.total} {L.views}</span>
                  </div>
                  <div className="p3-bar" aria-hidden="true"><i style={{ width: `${r.pct}%` }} /></div>
                  <P3SeriesGoing seriesId={r.id} testId={`p3-stats-going-${r.id}`} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

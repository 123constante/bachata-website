import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { EventWorkspace } from '../../events/eventModel';
import { weekdayName } from '../../events/eventModel';
import { fullDate, MONTH_NAMES, WEEKDAY_NAMES } from '../../shared/dateWords';
import { londonTodayKey, weekdayOfKey } from '@/lib/londonDate';
import { P3_PATHS } from '../shell/paths';
import { DATE_TAG_WORD, UPCOMING_PAGE, dateTagOf, upcomingOf } from './editorModel';
import { V2Toast, type V2ToastState } from './V2Toast';
import './v2.css';

type Tab = 'night' | 'every';

/** "26 Nov" for a chip's second line. */
const dayMonth = (date: string) => {
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${MONTH_NAMES[m - 1].slice(0, 3)}`;
};

/**
 * Editor v2 page frame (flag organiserEditorV2): back link, tabs, date chips (weekly only), title, scope line and
 * a slot per tab that later slices fill. The picked night lives in `?night=`, the tab in `?tab=every`.
 */
export function EditorV2({ ws, onMoreDates }: { ws: EventWorkspace; onMoreDates?: () => void }) {
  const [params, setParams] = useSearchParams();
  const [toast, setToast] = useState<V2ToastState | null>(null);
  const today = londonTodayKey();
  const weekly = ws.series.format !== 'one_off';
  const coming = upcomingOf(ws.dates, today);
  const chips = coming.slice(0, UPCOMING_PAGE);
  const nightId = params.get('night');
  const picked = (nightId && coming.find((d) => d.id === nightId)) || coming[0] || ws.dates[0] || null;
  const tab: Tab = weekly && params.get('tab') === 'every' ? 'every' : 'night';
  const day = weekly
    ? (picked ? weekdayName(picked.occurrence_date) : WEEKDAY_NAMES[weekdayOfKey(today)])
    : '';
  const dismiss = useCallback((seq: number) => setToast((t) => (t && t.seq === seq ? null : t)), []);

  const setTab = (t: Tab) => setParams((p) => {
    const n = new URLSearchParams(p);
    if (t === 'every') n.set('tab', 'every'); else n.delete('tab');
    return n;
  }, { replace: true, preventScrollReset: true });
  const pickNight = (id: string) => setParams((p) => {
    const n = new URLSearchParams(p);
    n.set('night', id);
    return n;
  }, { replace: true, preventScrollReset: true });

  const every = tab === 'every';
  const title = every ? `Every ${day}` : (picked ? fullDate(picked.occurrence_date).replace(/ \d{4}$/, '') : (ws.series.name ?? ''));
  const scope = every
    ? `Changes here are for every ${day}. A night you changed on its own keeps its change.`
    : 'Changes here are for this night only.';

  return (
    <div className="ev2 ev2-page v2-page" data-testid="ev2-page">
      <Link to={P3_PATHS.events} className="ev2-back" data-testid="ev2-back">&larr; Events</Link>
      {weekly && (
        <div className="ev2-tabs" role="tablist" aria-label="What you are changing">
          <button type="button" role="tab" aria-selected={!every} className="ev2-tab" data-testid="ev2-tab-night" onClick={() => setTab('night')}>This night</button>
          <button type="button" role="tab" aria-selected={every} className="ev2-tab" data-testid="ev2-tab-every" onClick={() => setTab('every')}>Every {day}</button>
        </div>
      )}
      {weekly && !every && (
        <div className="ev2-chips" data-testid="ev2-chips">
          {chips.map((d) => {
            const tag = dateTagOf(d, ws.series.lifecycle_status);
            const word = tag === 'cancelled' || tag === 'changed' ? DATE_TAG_WORD[tag] : null;
            const on = picked?.id === d.id;
            return (
              <button key={d.id} type="button" className={on ? 'ev2-chip ev2-chip-on' : 'ev2-chip'} aria-pressed={on} data-testid="ev2-chip" onClick={() => pickNight(d.id)}>
                <span className="ev2-chip-a">{WEEKDAY_NAMES[weekdayOfKey(d.occurrence_date)].slice(0, 3)}</span>
                <span className="ev2-chip-b">{dayMonth(d.occurrence_date)}</span>
                {word && <span className={`ev2-chip-tag ev2-chip-tag-${tag}`}>{word}</span>}
              </button>
            );
          })}
          <button type="button" className="ev2-chip ev2-chip-more" data-testid="ev2-more-dates" onClick={() => onMoreDates?.()}>
            <span className="ev2-chip-b">More dates</span>
          </button>
        </div>
      )}
      <h1 className="ev2-title" data-testid="ev2-title">{title}</h1>
      <p className="ev2-scope" data-testid="ev2-scope">{scope}</p>
      <div data-ev2-slot={every ? 'every' : 'night'} />
      <V2Toast toast={toast} onDone={dismiss} />
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { flags } from '@/lib/featureFlags';
import { dayWord } from '../model';
import { useP3Home } from '../data/useP3Data';
import { organiserOfSeries } from '../tickets/data';
import { homeClockOf } from '../dash/homeClock';
import { fetchDoorNight, usePastNights } from '../dash/pastNights';
import { captionOf, nightLinkOf, shareText } from '../dash/shareLinks';
import { whoCameLinkOf, whoIsInLinkOf } from '../sheets/sheetsModel';
import { P3NightGoing } from '../screens/P3Going';
import { P3_PATHS } from '../shell/paths';
import { useEventChoice } from '../v2/V2Shell';
import { useNoPageRedirect } from '../v2/V2Tabs';
import { R4Chevron } from './R4Shell';
import { r4HomeOf, type R4Door, type R4NextNight } from './r4Model';

function Row({ to, label, end, testId }: { to: string; label: string; end?: string; testId: string }) {
  return (
    <Link to={to} className="r4-row" data-testid={testId}>
      <span className="r4-row-t">{label}</span>
      {end && <span className="r4-row-end">{end}</span>}
      <span className="r4-mut"><R4Chevron /></span>
    </Link>
  );
}

/** Home through the day (flag organiserR4): before = scoreboard + Share, on the night = door, after = how it went. */
export function R4Home() {
  const r = useNoPageRedirect();
  const c = useEventChoice();
  const home = useP3Home();
  const navigate = useNavigate();
  const [now] = useState(() => Date.now());
  const [said, setSaid] = useState<string | null>(null);
  const { rows, today } = c;
  const nextRow = useMemo(
    () => rows.filter((x) => x.next && x.next.date >= today && x.next.status !== 'cancelled').sort((a, b) => (a.next!.date < b.next!.date ? -1 : 1))[0] ?? null,
    [rows, today],
  );
  const next: R4NextNight | null = nextRow ? {
    seriesId: nextRow.id, name: nextRow.name, place: nextRow.place, draft: nextRow.lifecycle === 'draft',
    when: `${dayWord(nextRow.next!.date, today, nextRow.nextStart)}, ${nextRow.nextTime}`,
    link: typeof window === 'undefined' ? null : nightLinkOf(window.location.origin, nextRow.publicEventRef),
  } : null;
  const series = useMemo(() => rows.map((x) => ({ id: x.id, name: x.name })), [rows]);
  const past = usePastNights(series, today, 1, !!today, true);
  const last = past.nights.find((n) => !n.cancelled) ?? null;
  const startIso = nextRow ? organiserOfSeries(home.data, nextRow.id)?.series.next_dates?.[0]?.materialised_start_utc ?? null : null;
  const clock = homeClockOf(startIso, nextRow?.next?.date ?? null, last?.date ?? null, today, now);
  const doorOn = flags.organiserTicketing && !!next && !next.draft;
  const doorRead = useQuery({
    queryKey: ['r4-door', next?.seriesId ?? null],
    queryFn: () => fetchDoorNight(next!.seriesId, null),
    enabled: doorOn,
    retry: false,
  });
  const door: R4Door | null = doorRead.data?.result === 'ok' ? { sold: doorRead.data.totalCount, cameIn: doorRead.data.inCount } : null;
  const m = r4HomeOf({ clock, next, door, last });

  if (r.to) return <Navigate to={r.to} replace />;
  if (r.loading || c.loading) return <div className="r4-stack" data-testid="r4-home-loading" aria-busy="true"><div className="r4-skel" /><div className="r4-skel" /></div>;

  const onPrimary = async () => {
    if (m.primary.disabled) return;
    if (m.primary.kind === 'new') { navigate(P3_PATHS.createFor(c.page?.id)); return; }
    if (m.primary.kind === 'door' && next) { navigate(P3_PATHS.eventDoor(next.seriesId)); return; }
    if (next?.link) {
      setSaid(null);
      const out = await shareText(next.name, captionOf(next.name, next.when, next.link), next.link);
      setSaid(out === 'copied' ? 'Link copied. Paste it wherever your group chats.' : null);
    }
  };
  const whoIn = m.face === 'night' && next ? whoIsInLinkOf({ seriesId: next.seriesId, draft: next.draft, cancelled: false }, 'home') : null;
  const whoCame = m.face === 'after' && last ? whoCameLinkOf(last, 'home') : null;
  const aboutId = m.face === 'after' ? last?.seriesId : next?.seriesId;

  return (
    <div className="r4-stack" data-testid="r4-home" data-face={m.face}>
      <div className="r4-title-block">
        <div className="r4-title-row">
          <h1 className="r4-h1" data-testid="r4-home-title">{m.title}</h1>
          {m.pill && <span className={`r4-pill r4-pill-${m.pill.tone}`} data-testid="r4-home-pill">{m.pill.word}</span>}
        </div>
        {m.sub && <p className="r4-sub">{m.sub}</p>}
      </div>

      {m.tiles.length > 0 && (
        <div className="r4-tiles" data-testid="r4-tiles">
          {m.tiles.map((t) => (
            <div key={t.key} className="r4-card r4-tile" data-testid={`r4-tile-${t.key}`}>
              <div className="r4-label">{t.label}</div>
              <div className="r4-num">{t.value}{t.of && <span className="r4-of"> {t.of}</span>}</div>
            </div>
          ))}
        </div>
      )}
      {m.lines.map((l) => <p key={l} className="r4-sub" data-testid="r4-home-line">{l}</p>)}

      {m.face !== 'after' && next && !next.draft && (
        <P3NightGoing seriesId={next.seriesId} seriesName={next.name} nightKey={{ date: nextRow!.next!.date }} testId="r4-home-going" />
      )}

      <div>
        <button type="button" className="r4-btn" onClick={() => void onPrimary()} disabled={m.primary.disabled} data-testid="r4-home-primary" data-kind={m.primary.kind}>
          {m.primary.label}
        </button>
        {m.primary.reason && <p className="r4-note" data-testid="r4-home-reason">{m.primary.reason}</p>}
        {said && <p className="r4-note" role="status">{said}</p>}
      </div>

      {(whoIn || whoCame || aboutId || flags.organiserDash) && (
        <div className="r4-card r4-list">
          {whoIn && <Row to={whoIn} label="Who is in" testId="r4-row-in" />}
          {whoCame && <Row to={whoCame} label="Who came" testId="r4-row-came" />}
          {aboutId && <Row to={P3_PATHS.event(aboutId)} label="Open this event" testId="r4-row-event" />}
          {flags.organiserDash && past.nights.length > 0 && <Row to={P3_PATHS.compare} label="Compare with other nights" testId="r4-row-compare" />}
        </div>
      )}
    </div>
  );
}

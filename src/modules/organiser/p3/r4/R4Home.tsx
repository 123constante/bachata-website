import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { flags } from '@/lib/featureFlags';
import { fetchIncomingAccessRequests, incomingAccessRequestsQueryKey } from '@/modules/organiser/shared/selfServeApi';
import { useTeamContext } from '../../team/useTeamContext';
import { todoSeriesIdsOf } from '../model/strip';
import type { P3Row } from '../data/home';
import { dayWord } from '../model';
import { useP3Home } from '../data/useP3Data';
import { organiserOfSeries } from '../tickets/data';
import { homeClockOf } from '../dash/homeClock';
import { fetchDoorNight, usePastNights } from '../dash/pastNights';
import { captionOf, nightLinkOf, shareText } from '../dash/shareLinks';
import { whoCameLinkOf, whoIsInLinkOf } from '../sheets/sheetsModel';
import { P3NightGoing } from '../screens/P3Going';
import { P3_PATHS } from '../shell/paths';
import { EVENT_PARAM } from '../v2/eventChoice';
import { useEventChoice } from '../v2/V2Shell';
import { useNoPageRedirect } from '../v2/V2Tabs';
import { R4Chevron } from './R4Shell';
import { fetchNightMoney, nightMoneyQueryKey } from './r4MoneyApi';
import { moneyQuietOf, nightMoneyOf, R4_MONEY_COPY } from './r4MoneyModel';
import { R4_EMPTY_HOME, r4AloneOf, r4HomeOf, r4WaitingOf, type R4Door, type R4NextNight, type R4WaitItem } from './r4Model';

function Row({ to, label, end, testId }: { to: string; label: string; end?: string; testId: string }) {
  return (
    <Link to={to} className="r4-row" data-testid={testId}>
      <span className="r4-row-t">{label}</span>
      {end && <span className="r4-row-end">{end}</span>}
      <span className="r4-mut"><R4Chevron /></span>
    </Link>
  );
}

const Plus = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
);

/** "Only you so far" (board R4EmptyHome): only once the team read says the caller is alone. */
function AloneRow() {
  const t = useTeamContext();
  const editor = t.viewerRole === 'owner' || t.viewerRole === 'manager';
  if (!r4AloneOf({ teamReady: !t.loading && !t.failed && !!t.organiser, members: t.members.length, editor })) return null;
  return (
    <div className="r4-card r4-list r4-mt-24">
      <Link to={P3_PATHS.youTeam} className="r4-row r4-row-tall" data-testid="r4-empty-alone">
        <span className="r4-row-body">
          <span className="r4-row-t">{R4_EMPTY_HOME.aloneTitle}</span>
          <span className="r4-row-line">{R4_EMPTY_HOME.aloneLine}</span>
        </span>
        <span className="r4-mut"><R4Chevron /></span>
      </Link>
    </div>
  );
}

/** Board R4EmptyHome: the page has no events at all. */
function EmptyHome({ pageId }: { pageId: string | null }) {
  return (
    <div className="r4-stack" data-testid="r4-home" data-face="none">
      <div className="r4-title-block">
        <h1 className="r4-h1" data-testid="r4-home-title">{R4_EMPTY_HOME.title}</h1>
        <p className="r4-sub">{R4_EMPTY_HOME.sub}</p>
      </div>
      <Link to={P3_PATHS.createFor(pageId)} className="r4-btn r4-btn-42 r4-btn-link" data-testid="r4-home-primary" data-kind="new">
        <Plus />{R4_EMPTY_HOME.add}
      </Link>
      <section className="r4-section r4-mt-24" aria-labelledby="r4-empty-next">
        <h2 id="r4-empty-next" className="r4-label r4-h2">{R4_EMPTY_HOME.nextLabel}</h2>
        <ol className="r4-card r4-list r4-steps" data-testid="r4-empty-steps">
          {R4_EMPTY_HOME.steps.map((s, i) => (
            <li key={s} className="r4-row r4-row-tall"><span className="r4-step-n" aria-hidden="true">{i + 1}</span><span className="r4-row-t">{s}</span></li>
          ))}
        </ol>
      </section>
      <AloneRow />
    </div>
  );
}

/** Board R4HomeBefore's "N things waiting for you": events that need something (the To do facts) and join requests. */
function WaitingList({ rows, pageId }: { rows: readonly P3Row[]; pageId: string }) {
  const home = useP3Home();
  const navigate = useNavigate();
  const requests = useQuery({
    queryKey: incomingAccessRequestsQueryKey(pageId),
    queryFn: () => fetchIncomingAccessRequests(pageId),
  });
  const todoIds = useMemo(() => todoSeriesIdsOf(home.data, pageId), [home.data, pageId]);
  // HomeOrganiser.role is owner | manager: every Home viewer may answer a join request.
  const m = r4WaitingOf({ rows, todoIds, requests: requests.data ?? null, editor: true });
  const go = (it: R4WaitItem) => {
    if (it.go === 'answer') navigate(`${P3_PATHS.youTeam}?answer=${encodeURIComponent(it.id)}`);
    else if (it.go === 'place') navigate(P3_PATHS.eventEdit(it.id));
    else if (it.go === 'dates') navigate(P3_PATHS.eventAll(it.id));
    else if (it.go === 'photo') navigate(P3_PATHS.eventDetails(it.id));
    else navigate(P3_PATHS.event(it.id));
  };
  if (m.items.length === 0 && !requests.isError) return null;
  return (
    <section className="r4-section" aria-labelledby={m.items.length > 0 ? 'r4-wait-h' : undefined} data-testid="r4-waiting">
      {m.items.length > 0 && <h2 id="r4-wait-h" className="r4-label r4-h2" data-testid="r4-waiting-heading">{m.heading}</h2>}
      {m.items.length > 0 && (
        <div className="r4-card r4-list">
          {m.items.map((it) => (
            <div key={it.key} className="r4-order" data-testid="r4-wait-item" data-go={it.go}>
              <div className="r4-grow">
                <div className="r4-row-t">{it.title}</div>
                <div className="r4-row-line">{it.detail}</div>
              </div>
              <button type="button" className="r4-btn r4-btn-34 r4-btn-quiet r4-btn-fit" onClick={() => go(it)} data-testid="r4-wait-go">{it.action}</button>
            </div>
          ))}
        </div>
      )}
      {m.more > 0 && <Link to={P3_PATHS.events} className="r4-in-link r4-accent" data-testid="r4-wait-more">{m.more} more on Events</Link>}
      {requests.isError && (
        <p className="r4-err" role="alert" data-testid="r4-wait-error">We could not load join requests. <button type="button" className="r4-linkbtn" onClick={() => void requests.refetch()}>Try again</button></p>
      )}
    </section>
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
  // Money for the night in focus: the last night after it, else the next one (one read per event, shared with One night and Compare).
  const { user } = useAuth();
  const afterFace = clock === 'after' && !!last;
  const focusId = afterFace ? last!.seriesId : next?.seriesId ?? null;
  const moneyRead = useQuery({
    queryKey: nightMoneyQueryKey(user?.id ?? null, focusId ?? ''),
    queryFn: () => fetchNightMoney(focusId!),
    enabled: flags.organiserTicketing && !!user?.id && !!focusId && (afterFace || !next?.draft),
    staleTime: 60_000,
    retry: 1,
  });
  const money = nightMoneyOf(moneyRead.data, afterFace ? { occurrenceId: last!.occurrenceId ?? null, date: last!.date } : { date: nextRow?.next?.date ?? null });
  const moneyQuiet = moneyQuietOf(money);
  const m = r4HomeOf({ clock, next, door, last, money });

  if (r.to) return <Navigate to={r.to} replace />;
  if (r.loading || c.loading) return <div className="r4-stack" data-testid="r4-home-loading" aria-busy="true"><div className="r4-skel" /><div className="r4-skel" /></div>;
  if (!c.error && c.page && rows.length === 0) return <EmptyHome pageId={c.page.id} />;

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
  // Compare ranks ONE event's nights (board R4Compare): the one this face is about, else the last night's.
  const compareId = aboutId ?? last?.seriesId ?? null;
  const compareTo = compareId ? `${P3_PATHS.compare}?${EVENT_PARAM}=${encodeURIComponent(compareId)}` : P3_PATHS.compare;

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
              {t.key === 'money' && moneyQuiet && <div className="r4-tile-quiet" data-testid="r4-home-money-quiet">{moneyQuiet}</div>}
            </div>
          ))}
        </div>
      )}
      {moneyRead.isError && (
        <p className="r4-err" role="alert" data-testid="r4-home-money-error">{R4_MONEY_COPY.error} <button type="button" className="r4-linkbtn" onClick={() => void moneyRead.refetch()}>{R4_MONEY_COPY.retry}</button></p>
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
          {flags.organiserDash && past.nights.length > 0 && <Row to={compareTo} label="Compare with other nights" testId="r4-row-compare" />}
        </div>
      )}
      {(m.face === 'before' || m.face === 'empty') && c.page && <WaitingList rows={rows} pageId={c.page.id} />}
    </div>
  );
}

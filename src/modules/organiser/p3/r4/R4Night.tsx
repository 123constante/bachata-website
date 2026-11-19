import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { KEPT_BACK_STATE, cameBackForKept, dropKept, keptDraft } from '../onboarding/keptDraft';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { flags } from '@/lib/featureFlags';
import { londonTodayKey } from '@/lib/londonDate';
import type { EventWorkspace } from '../../events/eventModel';
import { useSendOnce } from '../../shared/runCommands';
import { cancelPlan, eventPageOf } from '../data/eventPage';
import { repeatShapeOf } from '../data/dates';
import { repeatWords } from '../model/repeat';
import { fetchDoorNight } from '../dash/pastNights';
import { captionOf, nightLinkOf, shareText } from '../dash/shareLinks';
import { RaffleRow } from '../events/raffle/RaffleParts';
import { P3NightGoing } from '../screens/P3Going';
import { WorkspaceGate } from '../screens/EventPage';
import type { SendOnce } from '../screens/CancelEventSheet';
import { useToast } from '../screens/Toast';
import { P3_PATHS } from '../shell/paths';
import { V2_PATHS } from '../v2/paths';
import { EVENT_PARAM } from '../v2/eventChoice';
import { useEventChoice } from '../v2/V2Shell';
import { nightsOfChoice } from '../v2/V2Tabs';
import { R4CancelSheet } from './R4CancelSheet';
import { R4Chevron } from './R4Shell';
import { r4NightOf } from './r4NightModel';
import { fetchNightMoney, nightMoneyQueryKey } from './r4MoneyApi';
import { moneyQuietOf, moneyTileOf, nightMoneyOf, R4_MONEY_COPY } from './r4MoneyModel';

function Row({ to, label, sub, testId }: { to: string; label: string; sub?: string; testId: string }) {
  return (
    <Link to={to} className="r4-row r4-row-tall" data-testid={testId}>
      <span className="r4-row-body">
        <span className="r4-row-t">{label}</span>
        {sub && <span className="r4-row-line">{sub}</span>}
      </span>
      <span className="r4-mut"><R4Chevron /></span>
    </Link>
  );
}

function Night({ ws, place }: { ws: EventWorkspace; place: string | null }) {
  const c = useEventChoice();
  const navigate = useNavigate();
  const today = c.today || londonTodayKey();
  const id = ws.series.id;
  // A kept Details / Prices edit the gate refused: the checklist's "Back to your event" lands here under R4, so pass
  // it on to the screen that restores it, exactly as EventPage does (Details shows every field the draft carries).
  const { state: navState } = useLocation();
  const [kept] = useState(() => (cameBackForKept(navState) ? keptDraft(id) : null));
  useEffect(() => {
    if (!kept) return;
    if (kept.screen === 'repeat') dropKept(id);
    else navigate(kept.screen === 'details' ? P3_PATHS.eventDetails(id) : P3_PATHS.eventPrices(id), { replace: true, state: KEPT_BACK_STATE });
  }, [kept, id, navigate]);
  const row = useMemo(() => c.rows.find((r) => r.id === id) ?? null, [c.rows, id]);
  const shape = repeatShapeOf(ws);
  const v = eventPageOf(ws, today);
  const plan = cancelPlan(ws, today);
  const draft = row?.lifecycle === 'draft';
  const nightOn = !!row?.next && row.next.status !== 'cancelled' && !draft;
  const doorRead = useQuery({
    queryKey: ['r4-door', id],
    queryFn: () => fetchDoorNight(id, null),
    enabled: flags.organiserTicketing && nightOn,
    retry: false,
  });
  const door = doorRead.data?.result === 'ok' ? { sold: doorRead.data.totalCount, cameIn: doorRead.data.inCount } : null;
  const { user } = useAuth();
  const moneyRead = useQuery({
    queryKey: nightMoneyQueryKey(user?.id ?? null, id),
    queryFn: () => fetchNightMoney(id),
    enabled: flags.organiserTicketing && !!user?.id && !!row?.next && row.next.status !== 'cancelled',
    staleTime: 60_000,
    retry: 1,
  });
  const nightMoney = nightMoneyOf(moneyRead.data, { date: row?.next?.date ?? null });
  const moneyTile = moneyTileOf(nightMoney);
  const moneyQuiet = moneyQuietOf(nightMoney);
  const m = r4NightOf({
    row, name: ws.series.name, place,
    repeatWords: shape.from === 'once' ? null : repeatWords(shape, today),
    door, cancellable: !!plan,
  });
  const raffleNight = row ? nightsOfChoice({ event: row, today, page: c.page })[0] ?? null : null;
  const [cancel, setCancel] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const toast = useToast(id, ws.series.version);
  const once = useSendOnce(id);
  const sendOnce: SendOnce = (command, key) => once(command, ws.series.version, key);
  const link = typeof window === 'undefined' || !row ? null : nightLinkOf(window.location.origin, row.publicEventRef);
  const share = async () => {
    if (!link) return;
    setSaid(null);
    const out = await shareText(m.title, captionOf(m.title, m.when ?? '', link), link);
    setSaid(out === 'copied' ? 'Link copied. Paste it wherever your group chats.' : null);
  };
  const shareWhy = !link ? 'It gets a link once it is live.' : v.status.key === 'live' ? null : 'Only a live event can be shared.';

  return (
    <div className="r4-stack" data-testid="r4-night" data-id={id}>
      <Link to={P3_PATHS.events} className="r4-back" data-testid="r4-night-back">&larr; Events</Link>
      <div className="r4-title-block">
        <div className="r4-title-row">
          <h1 className="r4-h1" data-testid="r4-night-title">{m.title}</h1>
          {m.pill && <span className={`r4-pill r4-pill-${m.pill.tone}`} data-testid="r4-night-pill">{m.pill.word}</span>}
        </div>
        {m.when && <p className="r4-sub" data-testid="r4-night-when">{m.when}</p>}
        {m.repeat && <p className="r4-sub" data-testid="r4-night-repeat">{m.repeat}</p>}
      </div>

      {nightOn && row?.next && (
        <P3NightGoing seriesId={id} seriesName={m.title} nightKey={{ date: row.next.date }} testId="r4-night-going" />
      )}
      {(m.tiles.length > 0 || moneyTile) && (
        <div className="r4-tiles" data-testid="r4-night-tiles">
          {m.tiles.map((t) => (
            <div key={t.key} className="r4-card r4-tile" data-testid={`r4-night-tile-${t.key}`}>
              <div className="r4-label">{t.label}</div>
              <div className="r4-num">{t.value}</div>
            </div>
          ))}
          {moneyTile && (
            <div className="r4-card r4-tile" data-testid="r4-night-tile-money">
              <div className="r4-label">{moneyTile.label}</div>
              <div className="r4-num">{moneyTile.value}</div>
              {moneyQuiet && <div className="r4-tile-quiet" data-testid="r4-night-money-quiet">{moneyQuiet}</div>}
            </div>
          )}
        </div>
      )}
      {moneyRead.isError && (
        <p className="r4-err" role="alert" data-testid="r4-night-money-error">{R4_MONEY_COPY.error} <button type="button" className="r4-linkbtn" onClick={() => void moneyRead.refetch()}>{R4_MONEY_COPY.retry}</button></p>
      )}

      {raffleNight && (
        <section className="r4-section" aria-label="Raffle" data-testid="r4-night-raffle">
          <RaffleRow night={raffleNight} onOpen={() => navigate(P3_PATHS.eventRaffle(id))} />
        </section>
      )}

      <div className="r4-card r4-list" data-testid="r4-night-rows">
        {flags.organiserTicketing && <Row to={`${V2_PATHS.tickets}?${EVENT_PARAM}=${encodeURIComponent(id)}`} label="Tickets" testId="r4-night-tickets" />}
        <Row to={P3_PATHS.eventEdit(id)} label="Edit this night" sub="Name, date, place, price, repeats" testId="r4-night-edit" />
        <Row to={P3_PATHS.eventDetails(id)} label="Description and pictures" testId="r4-night-details" />
        <Row to={P3_PATHS.eventDates(id)} label="All dates" testId="r4-night-dates" />
        <Row to={P3_PATHS.eventAll(id)} label="More settings" sub="Prices, repeats, status, organisers" testId="r4-night-more" />
      </div>

      <div>
        <button type="button" className="r4-btn" onClick={() => void share()} disabled={!!shareWhy} data-testid="r4-night-share">Share this night</button>
        {shareWhy && <p className="r4-note" data-testid="r4-night-share-why">{shareWhy}</p>}
        {said && <p className="r4-note" role="status">{said}</p>}
      </div>

      <div>
        <button type="button" className="r4-btn r4-btn-line" onClick={() => setCancel(true)} disabled={!m.cancel.on} data-testid="r4-night-cancel">Cancel this night</button>
        {!m.cancel.on && <p className="r4-note" data-testid="r4-night-cancel-why">{m.cancel.why}</p>}
      </div>

      {cancel && (
        plan && <R4CancelSheet name={m.title} plan={plan} send={sendOnce}
          onClose={() => setCancel(false)}
          onDone={(d) => {
            setCancel(false);
            if (d.removed) navigate(P3_PATHS.events, { state: { p3Toast: d.text } });
            else toast.show(d);
          }} />
      )}
      {toast.node}
    </div>
  );
}

/** Board R4Night (flag organiserR4): one night in focus. Reads the event workspace, home_v1, the door list and the raffle read. */
export function R4Night() {
  return <WorkspaceGate>{(ws, place) => <Night ws={ws} place={place} />}</WorkspaceGate>;
}

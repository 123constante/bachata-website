import { useState } from 'react';
import { Link } from 'react-router-dom';
import { flags } from '@/lib/featureFlags';
import { londonTodayKey } from '@/lib/londonDate';
import type { EventWorkspace } from '../../events/eventModel';
import type { Night } from '../events/eventsModel';
import { ComingSoonRaffle, rowFor, useRaffleNights } from '../events/raffle/RaffleParts';
import { RaffleSheet } from '../events/raffle/RaffleSheet';
import { WorkspaceGate } from '../screens/EventPage';
import { P3_PATHS } from '../shell/paths';
import { useEventChoice } from './EventChoice';
import { nightsOfChoice } from './r4Nights';
import { shortDay } from './r4EventsModel';
import { RAFFLE_COPY, r4RaffleOf, type R4RaffleModel } from './r4RaffleModel';

function Check() {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>;
}

function Body({ m, onAction }: { m: Extract<R4RaffleModel, { kind: 'night' }>; onAction: () => void }) {
  return (
    <>
      <ol aria-label="Raffle steps" className="r4-track" data-testid="r4-raffle-track">
        {m.steps.map((s) => (
          <li key={s.word} aria-current={s.state === 'now' ? 'step' : undefined} className={`r4-step r4-step-${s.state}`} data-state={s.state}>
            <span className="r4-step-bar" />
            <span className="r4-step-w">{s.state === 'done' && <Check />}{s.word}</span>
          </li>
        ))}
      </ol>
      {(m.entered !== null || m.winner !== null) && (
        <div className="r4-tiles">
          {m.entered !== null && <div className="r4-card r4-tile" data-testid="r4-raffle-entered"><div className="r4-label">Entered</div><div className="r4-num">{m.entered}</div></div>}
          {m.winner !== null && <div className="r4-card r4-tile" data-testid="r4-raffle-winner"><div className="r4-label">Winner</div><div className="r4-num r4-num-name">{m.winner}</div></div>}
        </div>
      )}
      {m.locked && (
        <div className="r4-card r4-callout" data-testid="r4-raffle-locked">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#464646" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          <div className="r4-row-body"><span className="r4-row-t">{m.locked.title}</span><span className="r4-row-line">{m.locked.body}</span></div>
        </div>
      )}
      {m.story && (
        <div className="r4-card r4-callout" data-testid="r4-raffle-story">
          <div className="r4-row-body"><span className="r4-row-t">{m.story.title}</span><span className="r4-row-line">{m.story.body}</span></div>
        </div>
      )}
      {m.entered !== null && <p className="r4-sub" data-testid="r4-raffle-privacy">{RAFFLE_COPY.privacy}</p>}
      <div className="r4-pick">
        <button type="button" className="r4-btn r4-btn-42" disabled aria-describedby="r4-pick-help" data-testid="r4-raffle-pick">Pick the winner</button>
        <p id="r4-pick-help" className="r4-hint r4-center" data-testid="r4-raffle-pick-why">{m.pickWhy}</p>
      </div>
      {m.action && (
        <div>
          <button type="button" className="r4-btn r4-btn-42 r4-btn-quiet" disabled={!m.action.enabled} aria-describedby={m.action.why ? 'r4-raffle-why' : undefined}
            onClick={onAction} data-testid="r4-raffle-action" data-action={m.action.action}>{m.action.label}</button>
          {m.action.why && <p id="r4-raffle-why" className="r4-hint">{m.action.why}</p>}
        </div>
      )}
    </>
  );
}

function Live({ night }: { night: Night }) {
  const q = useRaffleNights(night.seriesId);
  const [sheet, setSheet] = useState(false);
  if (q.isPending) return <div className="r4-skel" data-testid="r4-raffle-loading" aria-busy="true" />;
  if (q.isError) {
    return (
      <div>
        <p className="r4-err" role="alert" data-testid="r4-raffle-error">We couldn&rsquo;t load the raffle. Nothing was changed.</p>
        <button type="button" className="r4-btn r4-btn-42 r4-btn-quiet" onClick={() => void q.refetch()}>Try again</button>
      </div>
    );
  }
  if (q.data.kind === 'refused') return <p className="r4-sub" data-testid="r4-raffle-noaccess">Raffles are managed by this page&rsquo;s team. Ask an owner.</p>;
  const n = rowFor(q.data.read, night);
  const m = r4RaffleOf(true, n, q.data.read);
  if (m.kind !== 'night') return <p className="r4-sub" data-testid="r4-raffle-none">This night has no raffle information yet.</p>;
  return (
    <>
      <Body m={m} onAction={() => setSheet(true)} />
      {/* Opening or closing stays a hard stop: the confirmation lives in RaffleSheet, the only caller of the write. */}
      {sheet && <RaffleSheet night={night} onClose={() => setSheet(false)} />}
    </>
  );
}

function Raffle({ ws }: { ws: EventWorkspace }) {
  const c = useEventChoice();
  const today = c.today || londonTodayKey();
  const id = ws.series.id;
  const row = c.rows.find((r) => r.id === id) ?? null;
  const night = row ? nightsOfChoice({ event: row, today, page: c.page })[0] ?? null : null;
  const name = ws.series.name.trim() || 'No name yet';
  return (
    <div className="r4-stack" data-testid="r4-raffle" data-id={id}>
      <div>
        <Link to={P3_PATHS.event(id)} className="r4-back" data-testid="r4-raffle-back">&larr; {name}</Link>
        <h1 className="r4-h1">Raffle</h1>
      </div>
      {night?.date && <p className="r4-sub" data-testid="r4-raffle-when">{name}, {shortDay(night.date)}</p>}
      {!flags.organiserRaffleLive ? <ComingSoonRaffle />
        : night ? <Live night={night} />
          : <p className="r4-sub" data-testid="r4-raffle-nonight">There is no night coming up, so there is no raffle to show.</p>}
    </div>
  );
}

/** Board R4Raffle (flag organiserR4): the raffle of the next night. Reads organiser_raffle_nights_v1 behind ORGANISER_RAFFLE_LIVE. */
export function R4Raffle() {
  return <WorkspaceGate>{(ws) => <Raffle ws={ws} />}</WorkspaceGate>;
}

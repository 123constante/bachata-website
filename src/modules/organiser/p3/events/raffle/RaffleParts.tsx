import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { flags } from '@/lib/featureFlags';
import { supportLinks } from '../../../shared/support';
import type { Night } from '../eventsModel';
import { useQueryClient } from '@tanstack/react-query';
import { fetchRaffleNights, raffleNightsQueryKey, setRaffleAudience, setRaffleSeries } from './raffleApi';
import { TRACK, chipWord, nightOnDate, stepOf, type RaffleAudience, type RaffleNight, type RaffleRead } from './raffleModel';

const TAP = { minHeight: 44, minWidth: 44 } as const;

/** "Message us": one link per configured support channel, never a dead one. With none configured it says so. */
export function MessageUs({ topic }: { topic: string }) {
  const s = supportLinks();
  const body = encodeURIComponent(topic);
  if (!s.whatsapp && !s.email) return <p className="p3-note" data-testid="raffle-msg-none">Contact the Bachata Calendar team to {topic.toLowerCase()}.</p>;
  return (
    <div className="p3-stack-s" data-testid="raffle-msg">
      {s.whatsapp && <a className="p3-btn p3-btn-line p3-btn-link" style={TAP} href={s.whatsapp} target="_blank" rel="noopener noreferrer" data-testid="raffle-msg-whatsapp">Message us on WhatsApp</a>}
      {s.email && <a className="p3-btn p3-btn-line p3-btn-link" style={TAP} href={`mailto:${s.email}?subject=${body}`} data-testid="raffle-msg-email">Message us by email</a>}
    </div>
  );
}

/** The 4-step track: Open, Entries, Closed, Winner. step -1 = none is current. */
export function Track({ step }: { step: number }) {
  return (
    <ol className="p3-note" style={{ display: 'flex', gap: 6, listStyle: 'none', padding: 0, margin: 0 }} aria-label="Where the raffle is" data-testid="raffle-track" data-step={step}>
      {TRACK.map((w, i) => (
        <li key={w} aria-current={i === step ? 'step' : undefined} data-testid="raffle-step" data-state={i < step ? 'done' : i === step ? 'now' : 'next'}
          style={{ flex: 1, textAlign: 'center', padding: '6px 2px', borderRadius: 8, fontWeight: i === step ? 700 : 400, border: '1px solid var(--line)', opacity: i > step ? 0.6 : 1 }}>
          {i < step ? '\u2713 ' : ''}{w}
        </li>
      ))}
    </ol>
  );
}

/** Before admin #1576 is applied: a card that says so, with a way to tell us. No RPC is called. */
export function ComingSoonRaffle() {
  const id = useId();
  const [asking, setAsking] = useState(false);
  return (
    <div className="p3-card p3-inset" data-testid="raffle-soon">
      <strong className="p3-row-t">Raffle &middot; Coming soon</strong>
      <p className="p3-note" id={id}>It will switch on per night, here. Want it sooner? Tell us.</p>
      {asking ? <MessageUs topic="Tell us you want the raffle" /> : (
        <button type="button" className="p3-btn p3-btn-line" style={TAP} aria-describedby={id} onClick={() => setAsking(true)} data-testid="raffle-soon-tell">Tell us</button>
      )}
    </div>
  );
}

/** The Raffle row of the night sheet: its chip, and a tap opens the Raffle sheet. Live only behind flags.organiserRaffleLive. */
export function RaffleRow({ night, onOpen }: { night: Night; onOpen: () => void }) {
  if (!flags.organiserRaffleLive) return <ComingSoonRaffle />;
  return <LiveRaffleRow night={night} onOpen={onOpen} />;
}

/** The series read, shared by the row and the sheet (one query key). */
export function useRaffleNights(seriesId: string) {
  return useQuery({ queryKey: raffleNightsQueryKey(seriesId), queryFn: () => fetchRaffleNights(seriesId), staleTime: 15_000 });
}

/** Top card of the Raffle page: one switch for the whole series. Optimistic; reverts with an inline error on failure. */
export function SeriesSwitchCard({ seriesId }: { seriesId: string }) {
  const q = useRaffleNights(seriesId);
  const qc = useQueryClient();
  const [pending, setPending] = useState<boolean | null>(null);
  const [error, setError] = useState(false);
  const [audPending, setAudPending] = useState<RaffleAudience | null>(null);
  const [audError, setAudError] = useState(false);
  if (q.isPending || q.isError || q.data.kind === 'refused') return null;
  const read = q.data.read;
  const on = pending ?? read.seriesEnabled;
  const locked = read.adminLocked;
  const disabled = locked || !read.canEdit || pending !== null;
  const flip = async () => {
    if (disabled) return;
    const next = !on;
    setPending(next);
    setError(false);
    try {
      if (!(await setRaffleSeries(seriesId, next))) throw new Error('refused');
      await qc.invalidateQueries({ queryKey: raffleNightsQueryKey(seriesId) });
    } catch {
      setError(true);
    } finally {
      setPending(null);
    }
  };
  const audience = audPending ?? read.audience;

  const audOff = !read.canEdit || read.audienceAdminSet;
  const pick = async (next: RaffleAudience) => {
    if (audOff || audPending !== null || next === audience) return;
    setAudPending(next);
    setAudError(false);
    try {
      const r = await setRaffleAudience(seriesId, next);
      if (!r.ok) throw new Error('refused');
      await qc.invalidateQueries({ queryKey: raffleNightsQueryKey(seriesId) });
    } catch {
      setAudError(true);
    } finally {
      setAudPending(null);
    }
  };
  return (
    <div className="p3-card p3-inset" data-testid="raffle-series-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div className="p3-grow">
          <strong className="p3-row-t">Raffle</strong>
          {locked && <span className="p3-tag" data-testid="raffle-series-chip" style={{ marginLeft: 8 }}>Switched off by admin</span>}
        </div>
        <button type="button" role="switch" aria-checked={on} aria-label={`Raffle: ${on ? 'On' : 'Off'}`} disabled={disabled} onClick={() => void flip()}
          data-testid="raffle-series-switch" style={{ ...TAP, display: 'flex', alignItems: 'center', gap: 8, opacity: locked ? 0.5 : 1 }}>
          <span>Raffle: {on ? 'On' : 'Off'}</span>
          <span style={{ display: 'block', width: 44, height: 26, borderRadius: 13, position: 'relative', background: on ? 'var(--p3-accent, #7c3aed)' : '#6b7280' }}>
            <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 10, background: '#fff' }} />
          </span>
        </button>
      </div>
      <p className="p3-note" data-testid="raffle-series-hint">Default for every night. Nights you set by hand stay as they are.</p>
      {flags.raffleAudience && on && (
        <div data-testid="raffle-audience">
          <strong className="p3-row-t" data-testid="raffle-audience-label">Who can win{read.audienceAdminSet ? ' (set by Bachata Calendar)' : ''}</strong>
          <div role="group" aria-label="Who can win" style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            {([['new_only', 'New people only'], ['anyone', 'Anyone']] as const).map(([val, label]) => {
              const sel = audience === val;
              return (
                <button key={val} type="button" aria-pressed={sel} disabled={audOff} onClick={() => void pick(val)} data-testid={`raffle-audience-${val}`}
                  style={{ ...TAP, flex: 1, opacity: audOff ? 0.5 : 1, border: '1px solid #d0d5dd', borderRadius: 8, background: 'transparent', color: 'inherit',
                    ...(sel ? { background: 'var(--p3-accent, #7c3aed)', color: '#fff', borderColor: 'var(--p3-accent, #7c3aed)' } : {}) }}>
                  {label}
                </button>
              );
            })}
          </div>
          <p className="p3-note" data-testid="raffle-audience-note">{audience === 'anyone' ? 'Anyone can win, including regulars.' : 'People who have been to your events before can’t win.'}</p>
          {audError && <p className="p3-error" role="alert" data-testid="raffle-audience-error">Could not change who can win. Try again.</p>}
        </div>
      )}
      {locked && <p className="p3-note" data-testid="raffle-series-locked">Locked. Message us to change this.</p>}
      {error && <p className="p3-error" role="alert" data-testid="raffle-series-error">Could not change the raffle. Try again.</p>}
    </div>
  );
}

export function rowFor(read: RaffleRead, night: Night): RaffleNight | null {
  return nightOnDate(read, night.date);
}

function LiveRaffleRow({ night, onOpen }: { night: Night; onOpen: () => void }) {
  const q = useRaffleNights(night.seriesId);
  const why = useId();
  if (q.isPending) return <div className="p3-card p3-inset" data-testid="raffle-loading" aria-busy="true"><strong className="p3-row-t">Raffle</strong><p className="p3-note">Loading&hellip;</p></div>;
  if (q.isError) {
    return (
      <div className="p3-card p3-inset" data-testid="raffle-error">
        <strong className="p3-row-t">Raffle</strong>
        <p className="p3-note" role="alert">We couldn&rsquo;t load the raffle. Nothing was changed.</p>
        <button type="button" className="p3-btn p3-btn-line" style={TAP} onClick={() => void q.refetch()} data-testid="raffle-retry">Try again</button>
      </div>
    );
  }
  if (q.data.kind === 'refused') {
    return <div className="p3-card p3-inset" data-testid="raffle-noaccess"><strong className="p3-row-t">Raffle</strong><p className="p3-note">Raffles are managed by this page&rsquo;s team. Ask an owner.</p></div>;
  }
  const n = rowFor(q.data.read, night);
  if (!n) return <div className="p3-card p3-inset" data-testid="raffle-nonight"><strong className="p3-row-t">Raffle</strong><p className="p3-note" id={why}>This night has no raffle information yet.</p></div>;
  return (
    <button type="button" className="p3-row p3-row-link" style={{ minHeight: 56, width: '100%', textAlign: 'left' }} onClick={onOpen} data-testid="raffle-row" data-chip={n.chip}>
      <span className="p3-grow"><span className="p3-row-t" style={{ display: 'block' }}>Raffle</span></span>
      <span className="p3-tag" data-testid="raffle-chip">{chipWord(n)}</span>
    </button>
  );
}

export { stepOf };

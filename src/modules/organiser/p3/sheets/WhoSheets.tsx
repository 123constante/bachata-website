import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { flags } from '@/lib/featureFlags';
import { useP3Home } from '../data/useP3Data';
import { organiserOfSeries } from '../tickets/data';
import { fetchRaffleNights, raffleNightsQueryKey } from '../events/raffle/raffleApi';
import { dayWord } from '../model';
import { P3_PATHS } from '../shell/paths';
import { P3PushedShell } from '../you/surface';
import { fetchDoorNight } from '../dash/pastNights';
import { isSignedOut } from '../door/data';
import { fromOf, sheetBackOf, whoCameOf, whoIsInOf, type SheetModel } from './sheetsModel';

/** Slice 3: the read-only sheets' routes. Pushed (no tab bar); back = where the sheet was opened from. */
type Back = { to: string; label: string };
const TAP = { minHeight: 44 } as const;

function useDoorNight(seriesId: string, occurrenceId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['p3-sheet-door', user?.id ?? null, seriesId, occurrenceId] as const,
    queryFn: () => fetchDoorNight(seriesId, occurrenceId),
    enabled: !!user?.id && !!seriesId,
    staleTime: 30_000,
    retry: (n: number, e: unknown) => !isSignedOut(e) && n < 1,
  });
}

function useSheetFrame(home: Back) {
  const { seriesId = '' } = useParams();
  const [params] = useSearchParams();
  const back = sheetBackOf(fromOf(params.get('from')), seriesId, home);
  const p3 = useP3Home();
  const name = organiserOfSeries(p3.data, seriesId)?.series.name ?? null;
  return { seriesId, back, name, today: p3.data?.today ?? '' };
}

/** Who is in: tonight's door (the server picks the night that has not ended). */
export function WhoIsInRoute({ home }: { home: Back }) {
  const f = useSheetFrame(home);
  const q = useDoorNight(f.seriesId, null);
  const doorTo = flags.organiserTicketing ? P3_PATHS.eventDoor(f.seriesId) : null;
  const model = q.data ? whoIsInOf(q.data, { doorOnScreen: !!doorTo }) : null;
  return (
    <P3PushedShell title="Who is in" back={f.back} testId="sheet-who-in">
      <SheetView model={model} name={f.name} sub={null} failed={q.isError} signedOut={isSignedOut(q.error)} onRetry={() => void q.refetch()} />
      {doorTo && model?.state === 'ok' && (
        <Link className="p3-btn p3-btn-line" style={{ ...TAP, display: 'inline-flex', alignItems: 'center' }} to={doorTo} data-testid="sheet-open-door">Open Door</Link>
      )}
    </P3PushedShell>
  );
}

/** Who came / did not come: one past night by its occurrence id. */
export function WhoCameRoute({ home }: { home: Back }) {
  const f = useSheetFrame(home);
  const { occurrenceId = '' } = useParams();
  const q = useDoorNight(f.seriesId, occurrenceId || null);
  // the night's date: the same cached read Compare nights / Home already made
  const nights = useQuery({ queryKey: raffleNightsQueryKey(f.seriesId), queryFn: () => fetchRaffleNights(f.seriesId), enabled: !!f.seriesId, staleTime: 60_000 });
  const night = nights.data?.kind === 'ok' ? nights.data.read.nights.find((x) => x.occurrenceId === occurrenceId) ?? null : null;
  const sub = night && f.today ? dayWord(night.date, f.today, null) : null;
  return (
    <P3PushedShell title="Who came" back={f.back} testId="sheet-who-came">
      <SheetView model={q.data ? whoCameOf(q.data) : null} name={f.name} sub={sub} failed={q.isError} signedOut={isSignedOut(q.error)} onRetry={() => void q.refetch()} />
    </P3PushedShell>
  );
}

/** Presentational, read only: no control here changes anything. */
export function SheetView({ model, name, sub, failed = false, signedOut = false, onRetry }: { model: SheetModel | null; name: string | null; sub: string | null; failed?: boolean; signedOut?: boolean; onRetry?: () => void }) {
  return (
    <div className="p3-stack" data-testid="sheet">
      {(name || sub) && <p className="p3-row-s" data-testid="sheet-night">{name}{name && sub ? ', ' : ''}{sub}</p>}
      {signedOut ? (
        <p className="p3-card" role="alert" data-testid="sheet-signed-out">You&rsquo;re signed out. Sign in again to see this list.</p>
      ) : failed ? (
        <div className="p3-card" role="alert" data-testid="sheet-error">
          <p>We couldn&rsquo;t load this list. Check your connection, then try again.</p>
          <button type="button" className="p3-btn p3-btn-line" style={TAP} onClick={onRetry} data-testid="sheet-retry">Try again</button>
        </div>
      ) : !model ? (
        <p className="p3-card" aria-busy="true" data-testid="sheet-loading">Loading the list&hellip;</p>
      ) : (
        <>
          {/* positive only: a zero headline is never drawn, the list's empty sentence says it instead */}
          {((model.big !== null && model.big > 0) || model.under) && (
            <section className="p3-card" data-testid="sheet-head">
              {model.big !== null && model.big > 0 && (
                <div><span style={{ fontSize: 32, fontWeight: 700, color: '#C2410C' }} data-testid="sheet-big">{model.big.toLocaleString('en-GB')}</span> <span className="p3-row-t">{model.bigWord}</span></div>
              )}
              {model.under && <div className="p3-row-s" data-testid="sheet-under">{model.under}</div>}
            </section>
          )}
          {model.note && <p className="p3-note" data-testid="sheet-note">{model.note}</p>}
          {model.lists.map((l) => (
            <section key={l.testId} className="p3-card" aria-label={l.title} data-testid={l.testId}>
              <div className="p3-row-t">{l.title}</div>
              {l.empty ? <p className="p3-note" data-testid={`${l.testId}-empty`}>{l.empty}</p> : l.people.length > 0 && (
                <ul className="p3-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4 }}>
                  {l.people.map((p) => (
                    <li key={p.key} className="p3-row-s" style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.type ?? undefined} data-testid="sheet-person">{p.name}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}

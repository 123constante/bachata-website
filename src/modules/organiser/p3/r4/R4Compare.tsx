import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { flags } from '@/lib/featureFlags';
import { fetchNightCount } from '../dash/pastNights';
import { fetchRaffleNights, raffleNightsQueryKey } from '../events/raffle/raffleApi';
import { P3_PATHS } from '../shell/paths';
import { useEventChoice } from '../v2/V2Shell';
import { R4Chevron } from './R4Shell';
import { pastToReadOf, r4CompareMoneyOf, r4CompareOf } from './r4CompareModel';
import { fetchNightMoney, nightMoneyQueryKey } from './r4MoneyApi';
import { R4_MONEY_COPY } from './r4MoneyModel';

function Back() {
  return <Link to={P3_PATHS.home} className="r4-back" data-testid="r4-compare-back">&larr; Home</Link>;
}

/** The board's People / Money switch. Money ranks by net (refunds taken off, booking fees left out). */
function BySwitch({ by, setBy }: { by: 'people' | 'money'; setBy: (b: 'people' | 'money') => void }) {
  return (
    <div className="r4-chips" role="group" aria-label="Rank nights by" data-testid="r4-compare-switch">
      <button type="button" className="r4-chip r4-chip-44" aria-pressed={by === 'people'} onClick={() => setBy('people')} data-testid="r4-compare-by-people">People</button>
      <button type="button" className="r4-chip r4-chip-44" aria-pressed={by === 'money'} onClick={() => setBy('money')} data-testid="r4-compare-by-money">Money</button>
    </div>
  );
}

/** Board R4Compare (flag organiserR4): the chosen event's past nights, ranked by people who came or by money in. Read only. */
export function R4Compare() {
  const c = useEventChoice();
  const { user } = useAuth();
  const ev = c.event;
  const today = c.today;
  const nightsRead = useQuery({
    queryKey: raffleNightsQueryKey(ev?.id ?? ''),
    queryFn: () => fetchRaffleNights(ev!.id),
    enabled: !!ev && !!user?.id,
    staleTime: 60_000,
  });
  const nights = useMemo(() => (nightsRead.data?.kind === 'ok' ? nightsRead.data.read.nights : []), [nightsRead.data]);
  const toRead = useMemo(() => (ev && today ? pastToReadOf(nights, today) : []), [ev, nights, today]);
  const counts = useQueries({
    queries: toRead.map((n) => ({
      // the same key as usePastNights, so Home's last-night count is shared
      queryKey: ['p3-dash-night-count', user?.id ?? null, ev?.id ?? '', n.occurrenceId] as const,
      queryFn: () => fetchNightCount(ev!.id, n.occurrenceId), enabled: !!ev && !!user?.id, staleTime: 60_000, retry: 1,
    })),
  });
  const countMap = useMemo(() => new Map(toRead.map((n, i) => [n.occurrenceId, counts[i]?.data])), [toRead, counts]);
  const [by, setBy] = useState<'people' | 'money'>('people');
  const moneyRead = useQuery({
    queryKey: nightMoneyQueryKey(user?.id ?? null, ev?.id ?? ''),
    queryFn: () => fetchNightMoney(ev!.id),
    enabled: flags.organiserTicketing && !!ev && !!user?.id,
    staleTime: 60_000,
    retry: 1,
  });
  // The switch shows only for a seat that has a money view; a failed money read still shows it, so Money can say so.
  const canMoney = flags.organiserTicketing && (moneyRead.data?.kind === 'ok' || moneyRead.isError);
  const mode = canMoney ? by : 'people';

  if (c.loading || (ev && nightsRead.isPending) || counts.some((q) => q.isPending)) {
    return <div className="r4-stack" data-testid="r4-compare-loading" aria-busy="true"><Back /><div className="r4-skel" /><div className="r4-skel" /></div>;
  }
  const failed = c.error || nightsRead.isError || counts.some((q) => q.isError);
  const nightsOk = !!ev && nightsRead.data?.kind === 'ok';
  const m = !nightsOk ? null
    : mode === 'money' ? (moneyRead.data?.kind === 'ok' ? r4CompareMoneyOf({ nights, today, money: moneyRead.data }) : null)
    : r4CompareOf({ nights, today, counts: countMap });
  const moneyFailed = mode === 'money' && moneyRead.isError;
  const name = ev ? ev.name.trim() || 'No name yet' : null;

  return (
    <div className="r4-stack" data-testid="r4-compare">
      <div>
        <Back />
        <h1 className="r4-h1" style={{ fontSize: 15, fontWeight: 500, letterSpacing: 0 }}>Compare nights</h1>
      </div>
      {failed ? (
        <div>
          <p className="r4-err" role="alert" data-testid="r4-compare-error">We couldn&rsquo;t load your nights. Nothing was changed.</p>
          <button type="button" className="r4-btn r4-btn-42 r4-btn-quiet" onClick={() => { c.retry(); void nightsRead.refetch(); counts.forEach((q) => void q.refetch()); }}>Try again</button>
        </div>
      ) : !ev ? (
        <p className="r4-sub" data-testid="r4-compare-noevent">You have no events yet. Add a night and, once it has happened, it shows here.</p>
      ) : moneyFailed ? (
        <div>
          {canMoney && <BySwitch by={mode} setBy={setBy} />}
          <p className="r4-err" role="alert" data-testid="r4-compare-money-error">{R4_MONEY_COPY.error}</p>
          <button type="button" className="r4-btn r4-btn-42 r4-btn-quiet" onClick={() => void moneyRead.refetch()} data-testid="r4-compare-money-retry">{R4_MONEY_COPY.retry}</button>
        </div>
      ) : mode === 'money' && moneyRead.isFetching && !m ? (
        <div className="r4-skel" data-testid="r4-compare-money-loading" aria-busy="true" />
      ) : !m ? (
        <p className="r4-sub" data-testid="r4-compare-noaccess">Only this page&rsquo;s team can see how its nights went.</p>
      ) : (
        <>
          <div className="r4-title-block">
            <h2 className="r4-h1" data-testid="r4-compare-name">{name}</h2>
            {m.sub && <p className="r4-sub" data-testid="r4-compare-sub">{m.sub}</p>}
          </div>
          {canMoney && <BySwitch by={mode} setBy={setBy} />}
          {m.empty ? (
            <p className="r4-card r4-sub" style={{ padding: 16 }} data-testid="r4-compare-empty">{m.empty}</p>
          ) : (
            <div className="r4-section">
              <div id="r4-rank-label" className="r4-label">{mode === 'money' ? 'Ranked by money in' : 'Ranked by people who came'}</div>
              <ol className="r4-card r4-list r4-ol" aria-labelledby="r4-rank-label" data-testid="r4-compare-list">
                {m.rows.map((r, i) => (
                  <li key={r.key} data-testid="r4-compare-row">
                    <Link to={P3_PATHS.whoCame(ev.id, r.occurrenceId, 'compare')} className="r4-row r4-row-tall" style={{ gap: 12 }}
                      aria-label={`${i + 1}. ${r.day}, ${r.line}. Who came`} data-testid="r4-compare-who">
                      <span className="r4-rank">{i + 1}</span>
                      <span className="r4-row-body">
                        <span className="r4-row-t">{r.day}</span>
                        <span className="r4-row-line">{r.line}</span>
                        {r.quiet && <span className="r4-row-line" data-testid="r4-compare-quiet">{r.quiet}</span>}
                      </span>
                      <span className="r4-mut"><R4Chevron /></span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <p className="r4-note" data-testid="r4-compare-foot">{m.foot}</p>
        </>
      )}
    </div>
  );
}

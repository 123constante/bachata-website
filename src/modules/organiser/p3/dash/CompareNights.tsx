import { useMemo } from 'react';
import { rowsOf } from '../data/home';
import { useP3Home } from '../data/useP3Data';
import { usePageScope } from '../screens/PageScope';
import { compareOf, type CompareModel } from './dashModel';
import { COMPARE_CAP, usePastNights } from './pastNights';

/** Compare nights (slice 2, round-4 screen 4): the page's recent past nights ranked by Who came, read only. */
export function CompareNights() {
  const home = useP3Home();
  const scope = usePageScope();
  const today = home.data?.today ?? '';
  const series = useMemo(() => (home.data && scope.pageId ? rowsOf(home.data, scope.pageId) : []).map((r) => ({ id: r.id, name: r.name })), [home.data, scope.pageId]);
  const past = usePastNights(series, today, COMPARE_CAP, true);
  const loading = !!home.isPending || past.loading;
  return <CompareView model={loading ? null : compareOf(past.nights)} failed={!!home.isError} />;
}

export function CompareView({ model, failed = false }: { model: CompareModel | null; failed?: boolean }) {
  return (
    <div className="p3-stack" data-testid="dash-compare">
      <h1 className="p3-hero-name" style={{ fontSize: 20 }}>Compare nights</h1>
      <p className="p3-note">Your recent nights (up to {COMPARE_CAP}), most people first. Counts come from tickets scanned at the door.</p>
      {failed ? (
        <p className="p3-card" role="alert" data-testid="dash-compare-error">We couldn&rsquo;t load your nights. Check your connection and open this again.</p>
      ) : !model ? (
        <p className="p3-card" aria-busy="true" data-testid="dash-compare-loading">Loading your nights&hellip;</p>
      ) : model.empty ? (
        <p className="p3-card" data-testid="dash-compare-empty">{model.empty}</p>
      ) : (
        <ol className="p3-card p3-list" data-testid="dash-compare-list">
          {model.rows.map((r, i) => (
            <li key={r.key} className="p3-todo" style={{ display: 'flex', gap: 12, alignItems: 'center', minHeight: 44 }} data-testid="dash-compare-row">
              <span style={{ fontSize: 14, fontWeight: 600, color: '#C2410C', width: 20 }}>{i + 1}</span>
              <span style={{ flex: 1 }}>
                <span className="p3-row-t" style={{ display: 'block' }}>{r.name}</span>
                <span className="p3-row-s">{r.when}</span>
              </span>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{r.value.toLocaleString('en-GB')} <span className="p3-row-s">{r.word}</span></span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { fmt, NUMBERS_LOAD_FAILED, stripCells, STRIP_EMPTY_HELP, viewsDetail, VIEWS_WEEK_LABEL, type Numbers } from '../../api/numbersModel';
import { useMyNumbers } from '../../api/useMyNumbers';
import { linkStyle } from '../nights/nightsStyles';

const PAGE_PATH = '/app/page';
const cell: CSSProperties = { minWidth: 0, textAlign: 'center', display: 'grid', gap: 2 };

/** The same tiles, from an already-mapped `Numbers` (tests render this table-driven). */
export const NumbersView = ({ n, hasPhoto }: { n: Numbers; hasPhoto: boolean }) => (
  <>
    <Link to={PAGE_PATH} data-testid="tile-views" className="da-card" style={{ display: 'grid', gap: 2, color: 'var(--da-text)', textDecoration: 'none', padding: 14 }}>
      <b style={{ fontSize: 14 }}>{VIEWS_WEEK_LABEL}</b>
      <span style={{ fontSize: 28, fontWeight: 800 }} data-testid="tile-views-count">{fmt(n.viewsWeek)}</span>
      <span className="da-muted" style={{ fontSize: 13 }} data-testid="tile-views-detail">{viewsDetail(n, hasPhoto)}</span>
    </Link>
    <div className="da-card" data-testid="stats-strip" style={{ padding: 12 }}>
      {n.allZero ? (
        <span className="da-muted" style={{ fontSize: 13 }} data-testid="stats-strip-empty">{STRIP_EMPTY_HELP}</span>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
          {stripCells(n).map((c) => (
            <div key={c.id} style={cell} data-testid={`stat-${c.id}`}>
              <span style={{ fontSize: 20, fontWeight: 800, overflowWrap: 'anywhere' }} data-testid={`stat-${c.id}-value`}>{fmt(c.value)}</span>
              <span className="da-muted" style={{ fontSize: 12 }}>{c.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  </>
);

/** Home's two number tiles: loading and error are words, never NaN or a blank. */
export const NumbersTiles = ({ hasPhoto }: { hasPhoto: boolean }) => {
  const q = useMyNumbers();
  if (q.isLoading) return <div className="da-card da-muted" role="status" data-testid="numbers-loading" style={{ fontSize: 14 }}>Loading your numbers&hellip;</div>;
  if (q.isError || !q.data) {
    return (
      <div className="da-card" role="status" data-testid="numbers-error">
        <span style={{ fontSize: 14 }}>{NUMBERS_LOAD_FAILED}</span>
        <div>
          <button type="button" className="da-tap" style={{ ...linkStyle, background: 'none', border: 0 }} onClick={() => void q.refetch()}>Try again</button>
        </div>
      </div>
    );
  }
  return <NumbersView n={q.data} hasPhoto={hasPhoto} />;
};

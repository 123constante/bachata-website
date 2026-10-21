import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { GOING_CHECKIN_ENABLED } from '@/lib/goingCheckin';
import { fmt, numbersCanRetry, numbersErrorCopy, stripCells, STRIP_EMPTY_HELP, viewsDetail, VIEWS_WEEK_LABEL, type Numbers } from '../../api/numbersModel';
import { useMyNumbers } from '../../api/useMyNumbers';
import { linkStyle } from '../nights/nightsStyles';

const PAGE_PATH = '/app/page';
/** Accent-tinted number tiles (D121): each cell takes the next accent. */
const TILES = ['da-tile-violet', 'da-tile-gold', 'da-tile-rose', 'da-tile-teal'];
const cell: CSSProperties = { minWidth: 0, textAlign: 'center', display: 'grid', gap: 2 };

/** The same tiles, from an already-mapped `Numbers` (tests render this table-driven). */
export const NumbersView = ({ n, hasPhoto }: { n: Numbers; hasPhoto: boolean }) => {
  // Going / Interested cells (and the "say you are going" hint) go with the check-in switch.
  const cells = stripCells(n).filter((c) => GOING_CHECKIN_ENABLED || (c.id !== 'going' && c.id !== 'interested'));
  const stripEmpty = GOING_CHECKIN_ENABLED ? n.allZero : cells.every((c) => c.value === 0);
  const showStrip = GOING_CHECKIN_ENABLED || !stripEmpty;
  return (
  <>
    <Link to={PAGE_PATH} data-testid="tile-views" className="da-card da-tile-teal" style={{ display: 'grid', gap: 2, color: 'var(--da-text)', textDecoration: 'none', padding: 14 }}>
      <b style={{ fontSize: 14 }}>{VIEWS_WEEK_LABEL}</b>
      <span className="da-num" style={{ fontSize: 28, fontWeight: 800 }} data-testid="tile-views-count">{fmt(n.viewsWeek)}</span>
      <span className="da-tint" style={{ fontSize: 13 }} data-testid="tile-views-detail">{viewsDetail(n, hasPhoto)}</span>
    </Link>
    {showStrip && (
    <div className="da-card" data-testid="stats-strip" style={{ padding: 12 }}>
      {stripEmpty ? (
        <span className="da-muted" style={{ fontSize: 13 }} data-testid="stats-strip-empty">{STRIP_EMPTY_HELP}</span>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))`, gap: 6 }}>
          {cells.map((c, i) => (
            <div key={c.id} className={`da-card ${TILES[i % TILES.length]}`} style={{ ...cell, padding: 8 }} data-testid={`stat-${c.id}`}>
              <span className="da-num" style={{ fontSize: 20, fontWeight: 800, overflowWrap: 'anywhere' }} data-testid={`stat-${c.id}-value`}>{fmt(c.value)}</span>
              <span className="da-tint" style={{ fontSize: 12 }}>{c.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
    )}
  </>
  );
};

/** Home's two number tiles: loading and error are words, never NaN or a blank. */
export const NumbersTiles = ({ hasPhoto }: { hasPhoto: boolean }) => {
  const q = useMyNumbers();
  if (q.isLoading) return <div className="da-card da-muted" role="status" data-testid="numbers-loading" style={{ fontSize: 14 }}>Loading your numbers&hellip;</div>;
  if (q.isError || !q.data) {
    return (
      <div className="da-card" role="status" data-testid="numbers-error">
        <span style={{ fontSize: 14 }}>{numbersErrorCopy(q.error)}</span>
        {numbersCanRetry(q.error) && (
          <div>
            <button type="button" className="da-tap" data-testid="numbers-retry" style={{ ...linkStyle, background: 'none', border: 0 }} onClick={() => void q.refetch()}>Try again</button>
          </div>
        )}
      </div>
    );
  }
  return <NumbersView n={q.data} hasPhoto={hasPhoto} />;
};

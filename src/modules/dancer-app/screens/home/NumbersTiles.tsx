import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/modules/organiser/ui';
import { TILE_CLASS } from '../blocks';
import { GOING_CHECKIN_ENABLED } from '@/lib/goingCheckin';
import { fmt, numbersCanRetry, numbersErrorCopy, stripCells, STRIP_EMPTY_HELP, viewsDetail, VIEWS_WEEK_LABEL, type Numbers, type StripGoing } from '../../api/numbersModel';
import { useMyNumbers } from '../../api/useMyNumbers';
import { linkStyle } from '../nights/nightsStyles';

const PAGE_PATH = '/app/page';
/** Accent-tinted number tiles (D121): each cell takes the next accent. */
const TILES = ['da-tile-violet', 'da-tile-gold', 'da-tile-rose', 'da-tile-teal'];
const cell: CSSProperties = { minWidth: 0, textAlign: 'center', display: 'grid', gap: 2 };

/**
 * The same tiles, from an already-mapped `Numbers` (tests render this table-driven).
 * `going` = the Going cell: the module's tag + useMyNights().goingCount over get_my_going_v1
 * (Home builds it from its going feed, homeGoing.tsx); null = no Going cell.
 * `goingOn` = the going switch (default: GOING_CHECKIN_ENABLED): the Going cell and the
 * "say you are going" hint show only while it is on.
 */
export const NumbersView = ({ n, hasPhoto, going = null, goingOn = GOING_CHECKIN_ENABLED }: { n: Numbers; hasPhoto: boolean; going?: StripGoing | null; goingOn?: boolean }) => {
  const cells = stripCells(n, goingOn ? going : null);
  const stripEmpty = cells.every((c) => c.value === 0);
  const showStrip = goingOn || !stripEmpty;
  return (
  <>
    <Link to={PAGE_PATH} data-testid="tile-views" className={`${TILE_CLASS} da-tile-teal grid gap-[2px]`}>
      <b style={{ fontSize: 14 }}>{VIEWS_WEEK_LABEL}</b>
      <span className="da-num" style={{ fontSize: 28, fontWeight: 800 }} data-testid="tile-views-count">{fmt(n.viewsWeek)}</span>
      <span className="da-tint" style={{ fontSize: 13 }} data-testid="tile-views-detail">{viewsDetail(n, hasPhoto)}</span>
    </Link>
    {showStrip && (
    <Card variant="padded" testId="stats-strip" className="p-[12px]">
      {stripEmpty ? (
        <span className="da-muted" style={{ fontSize: 13 }} data-testid="stats-strip-empty">{STRIP_EMPTY_HELP}</span>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))`, gap: 6 }}>
          {cells.map((c, i) => (
            <div key={c.id} className={`${TILE_CLASS} ${TILES[i % TILES.length]} p-[8px]`} style={cell} data-testid={`stat-${c.id}`}>
              <span className="da-num" style={{ fontSize: 20, fontWeight: 800, overflowWrap: 'anywhere' }} data-testid={`stat-${c.id}-value`}>{fmt(c.value)}</span>
              <span className="da-tint" style={{ fontSize: 12 }}>{c.label}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
    )}
  </>
  );
};

/**
 * Home's two number tiles: loading and error are words, never NaN or a blank. `going` /
 * `goingOn` come from Home's going feed (null / false while the switch is off).
 */
export const NumbersTiles = ({ hasPhoto, going, goingOn }: { hasPhoto: boolean; going: StripGoing | null; goingOn: boolean }) => {
  const q = useMyNumbers();
  if (q.isLoading) return <Card variant="padded" role="status" testId="numbers-loading" className="text-[14px] text-[var(--mut)]">Loading your numbers&hellip;</Card>;
  if (q.isError || !q.data) {
    return (
      <Card variant="padded" role="status" testId="numbers-error">
        <span style={{ fontSize: 14 }}>{numbersErrorCopy(q.error)}</span>
        {numbersCanRetry(q.error) && (
          <div>
            <button type="button" className="da-tap" data-testid="numbers-retry" style={{ ...linkStyle, background: 'none', border: 0 }} onClick={() => void q.refetch()}>Try again</button>
          </div>
        )}
      </Card>
    );
  }
  return <NumbersView n={q.data} hasPhoto={hasPhoto} going={going} goingOn={goingOn} />;
};

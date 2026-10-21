import { useMemo, useState, type ReactNode } from 'react';
import { filterWall, type WallFilter, type WallList, type WallPerson } from './model';
import { FOCUS_RING, SIZE, WALL } from './tokens';
import { WallTile } from './WallTile';

const FILTERS: { k: WallFilter; label: string }[] = [
  { k: 'all', label: 'All' },
  { k: 'dj', label: 'DJs' },
  { k: 'dancer', label: 'Dancers' },
  { k: 'teacher', label: 'Teachers' },
];

const COPY: Record<WallList, { title: string; none: string }> = {
  djs: { title: 'Meet the DJs behind the nights', none: 'No DJs' },
  dancers: { title: 'Meet the dancers behind the nights', none: 'No dancers' },
};

export function WallSkeleton() {
  return (
    <div style={{ background: WALL.page }} className="px-3 pb-6 pt-3" data-testid="wall-skeleton" aria-busy="true">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${SIZE.columns}, minmax(0, 1fr))`, gap: SIZE.gap }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{ aspectRatio: '1 / 1', borderRadius: SIZE.tileRadius, background: WALL.card }} />
        ))}
      </div>
    </div>
  );
}

/**
 * The face wall: friendly line, filter chips, four-column grid of one-link tiles.
 * `filtersWork` is false while role data is unknown (badges read failed): only "All" is offered then,
 * so a filter can never hide everyone because of a missing read.
 */
export function PeopleWall({
  list, people, showTeachers, filtersWork = true, emptyAll,
}: {
  list: WallList;
  people: readonly WallPerson[];
  showTeachers: boolean;
  filtersWork?: boolean;
  /** Shown when there is nobody at all (not for an empty filter). */
  emptyAll: ReactNode;
}) {
  const [filter, setFilter] = useState<WallFilter>('all');
  const shown = useMemo(() => filterWall(people, filter), [people, filter]);
  // Role filters need role data: a failed read, or a read that came back empty (no tile has a
  // single role tag), offers only "All", so a chip can never empty the wall for lack of data.
  const rolesKnown = filtersWork && people.some((p) => p.tags.length > 0);
  const filters = FILTERS.filter((f) => f.k === 'all' || (rolesKnown && (f.k !== 'teacher' || showTeachers)));
  const copy = COPY[list];
  return (
    <div style={{ background: WALL.page, color: WALL.text }} className="px-3 pb-6 pt-3" data-testid="wall-root" data-list={list}>
      <h1 className="text-[20px] font-extrabold leading-tight">{copy.title}</h1>
      <p className="mb-2 text-[13px]" style={{ color: WALL.muted }}>Tap a face to see who they are and where to find them next.</p>
      {filters.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Show">
          {filters.map((f) => {
            const on = f.k === filter;
            return (
              <button
                key={f.k}
                type="button"
                aria-pressed={on}
                data-testid="wall-filter"
                className={FOCUS_RING}
                onClick={() => setFilter(f.k)}
                style={{
                  minHeight: SIZE.filterHeight, display: 'inline-flex', alignItems: 'center', padding: '0 14px', borderRadius: 999,
                  fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                  background: on ? WALL.text : 'transparent', color: on ? WALL.page : WALL.text,
                  border: `1.5px solid ${on ? WALL.text : WALL.line}`,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      ) : null}
      {people.length === 0 ? (
        emptyAll
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-[14px]" data-testid="wall-empty-filter">
          {copy.none} match this filter.{' '}
          <button type="button" className={`font-bold underline ${FOCUS_RING}`} style={{ minHeight: 44 }} onClick={() => setFilter('all')}>Show everyone</button>
        </p>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: `repeat(${SIZE.columns}, minmax(0, 1fr))`, gap: SIZE.gap }} data-testid="wall-grid">
          {shown.map((p) => <WallTile key={p.id} person={p} list={list} />)}
        </div>
      )}
    </div>
  );
}

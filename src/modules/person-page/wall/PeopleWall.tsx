import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { filterWall, type WallFilter, type WallList, type WallPerson } from './model';
import { FOCUS_RING, SIZE, WALL, WALL_FADE } from './tokens';
import { WallTile } from './WallTile';

type Pill = { k: WallFilter; label: string };

// Owner order (2026-10-21): All, Dancers, DJs, Teachers, then the Organisers link.
const ROLE_PILLS: Pill[] = [
  { k: 'all', label: 'All' },
  { k: 'dancer', label: 'Dancers' },
  { k: 'dj', label: 'DJs' },
];
const TEACHERS_PILL: Pill = { k: 'teacher', label: 'Teachers' };
/**
 * The Organisers pill is a LINK to the real public organisers page, never a filter state.
 * = SITE_IA.organisers.path (pinned by wall.test). Not imported: importing siteIa here splits it into
 * its own chunk, one more first-load request on /event, /parties and /classes (perf-budget ratchets).
 */
export const ORGANISERS_HREF = '/organisers';

const NONE: Record<WallList, string> = { djs: 'No DJs', dancers: 'No dancers' };

/**
 * Which filter pills to offer. Role filters need role data (review R1): without it only All stays.
 * Teachers is always offered while teacher pages are closed (it opens the coming-soon sentence, never
 * filters); once they open it filters like the others, so it follows the role-data rule too.
 */
export function wallPills(rolesKnown: boolean, teacherPagesOpen: boolean): Pill[] {
  const roles = rolesKnown ? ROLE_PILLS : ROLE_PILLS.slice(0, 1);
  if (!teacherPagesOpen) return [...roles, TEACHERS_PILL];
  return rolesKnown ? [...roles, TEACHERS_PILL] : [];
}

const pillStyle = (on: boolean): CSSProperties => ({
  minHeight: SIZE.filterHeight, display: 'inline-flex', alignItems: 'center', padding: '0 14px', borderRadius: 999,
  fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', textDecoration: 'none',
  background: on ? WALL.text : 'transparent', color: on ? WALL.page : WALL.text,
  border: `1.5px solid ${on ? WALL.text : WALL.line}`,
});

export function WallSkeleton() {
  return (
    <div style={WALL_FADE} data-seam="soft" className="px-3 pb-6 pt-3" data-testid="wall-skeleton" aria-busy="true">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${SIZE.columns}, minmax(0, 1fr))`, gap: SIZE.gap }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{ aspectRatio: '1 / 1', borderRadius: SIZE.tileRadius, background: WALL.card }} />
        ))}
      </div>
    </div>
  );
}

/**
 * The face wall: filter pills, then a four-column grid of one-link tiles. The page's own hero sits
 * above it (owner, 2026-10-21), so the wall has no header line of its own.
 * `filtersWork` is false while role data is unknown (badges read failed): no role filter is offered then,
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
  // single role tag), offers no role filter, so a pill can never empty the wall for lack of data.
  const rolesKnown = filtersWork && people.some((p) => p.tags.length > 0);
  const pills = wallPills(rolesKnown, showTeachers);
  // Teacher pages closed: the Teachers pill shows a sentence and a way on, never faces.
  const teachersSoon = filter === 'teacher' && !showTeachers;
  const browse = pills.filter((p) => p.k === 'dj' || p.k === 'dancer').reverse();
  return (
    <div style={{ ...WALL_FADE, color: WALL.text }} data-seam="soft" className="px-3 pb-6 pt-3" data-testid="wall-root" data-list={list}>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Show" data-testid="wall-pills">
        {pills.map((f) => {
          const on = f.k === filter;
          return (
            <button
              key={f.k}
              type="button"
              aria-pressed={on}
              data-testid="wall-filter"
              className={FOCUS_RING}
              onClick={() => setFilter(f.k)}
              style={pillStyle(on)}
            >
              {f.label}
            </button>
          );
        })}
        <Link to={ORGANISERS_HREF} data-testid="wall-organisers" className={FOCUS_RING} style={pillStyle(false)}>
          Organisers
        </Link>
      </div>
      {teachersSoon ? (
        <div className="py-8 text-center text-[14px]" data-testid="wall-teachers-soon">
          <p>Teachers are coming soon. Meanwhile, browse DJs and dancers.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {(browse.length ? browse : ROLE_PILLS.slice(0, 1)).map((p) => (
              <button key={p.k} type="button" className={FOCUS_RING} style={pillStyle(false)} onClick={() => setFilter(p.k)}>
                {p.k === 'all' ? 'Show everyone' : p.k === 'dj' ? 'Browse DJs' : 'Browse dancers'}
              </button>
            ))}
          </div>
        </div>
      ) : people.length === 0 ? (
        emptyAll
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-[14px]" data-testid="wall-empty-filter">
          {NONE[list]} match this filter.{' '}
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

import type { OrganiserStat } from './organiserStats';

/**
 * The organiser page's proof strip (ACCEPTANCE S1). It renders exactly what
 * organiserStats() returned -- the first three stats that qualify -- and
 * nothing at all when none do. It never invents a value: no 0, no `--`, no
 * placeholder tile. The page decides WHICH nights feed the mapping (never a
 * failed feed's); this file only lays the answer out.
 *
 * Colours are the page's own tokens (cream on near-black, gold labels).
 */
const CREAM = '#F6F1EA';
const GOLD = '#E7BE6E';

export function OrganiserStatsStrip({ stats, onNextNight }: { stats: OrganiserStat[]; onNextNight?: () => void }) {
  if (stats.length === 0) return null;
  return (
    <div
      data-testid="org-stats"
      className="grid gap-3 px-3 py-3"
      style={{ position: 'relative', zIndex: 1, gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`, borderBottom: '1px solid rgba(246,241,234,0.08)' }}
    >
      {stats.map((s) => {
        const body = (
          <>
            <span data-stat-value style={{ display: 'block', fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 600, color: CREAM, lineHeight: 1.1, overflowWrap: 'anywhere' }}>{s.value}</span>
            <span data-stat-label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: GOLD, marginTop: 4 }}>{s.label}</span>
          </>
        );
        return s.key === 'next_night' && onNextNight ? (
          <button key={s.key} type="button" data-stat={s.key} onClick={onNextNight} className="min-w-0 text-center" style={{ minHeight: 44, padding: '2px 4px', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>{body}</button>
        ) : (
          <div key={s.key} data-stat={s.key} className="min-w-0 text-center" style={{ padding: '2px 4px' }} title={s.title}>{body}</div>
        );
      })}
    </div>
  );
}

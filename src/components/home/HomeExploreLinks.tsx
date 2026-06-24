import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import './HomeExploreLinks.css';

const WEEKDAYS: ReadonlyArray<{ label: string; slug: string; color: string; bg: string; bold?: boolean }> = [
  { label: 'Monday',    slug: 'monday',    color: '#a5b4fc', bg: 'rgba(129,140,248,.14)' },
  { label: 'Tuesday',   slug: 'tuesday',   color: '#e9d5ff', bg: 'rgba(192,132,252,.14)' },
  { label: 'Wednesday', slug: 'wednesday', color: '#a7f3d0', bg: 'rgba(52,211,153,.12)'  },
  { label: 'Thursday',  slug: 'thursday',  color: '#bae6fd', bg: 'rgba(56,189,248,.12)'  },
  { label: 'Friday',    slug: 'friday',    color: '#fed7aa', bg: 'rgba(251,146,60,.14)',  bold: true },
  { label: 'Saturday',  slug: 'saturday',  color: '#fbcfe8', bg: 'rgba(244,114,182,.14)', bold: true },
  { label: 'Sunday',    slug: 'sunday',    color: '#fecaca', bg: 'rgba(248,113,113,.14)', bold: true },
];

const EXPLORE: ReadonlyArray<{ label: string; to: string; color: string; border: string }> = [
  { label: 'On tonight',               to: '/tonight',              color: '#f87171', border: '#ef4444' },
  { label: 'Bachata parties',          to: '/parties',              color: '#fdba74', border: '#fb923c' },
  { label: 'Bachata classes',          to: '/classes',              color: '#6ee7b7', border: '#34d399' },
  { label: 'Learn bachata (beginners)', to: '/learn-bachata-london', color: '#7dd3fc', border: '#38bdf8' },
  { label: 'Festivals',                to: '/festivals',            color: '#d8b4fe', border: '#c084fc' },
  { label: 'London bachata guide',     to: '/london-bachata-guide', color: '#fcd34d', border: '#f59e0b' },
  { label: 'FAQ',                      to: '/faq',                  color: '#cbd5e1', border: '#94a3b8' },
];

export function HomeExploreLinks({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Explore bachata in London"
      className={cn('hel mt-5 border-t border-border pt-4', className)}
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="hel-heading">By night</h2>
          <ul className="mt-2 flex flex-col gap-0.5">
            {WEEKDAYS.map(({ label, slug, color, bg, bold }) => (
              <li key={slug}>
                <Link
                  to={`/bachata-london-${slug}`}
                  className="hel-day"
                  style={{ '--hel-day-color': color, '--hel-day-bg': bg, fontWeight: bold ? 700 : 500 } as React.CSSProperties}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="hel-heading">Explore</h2>
          <ul className="mt-2 flex flex-col gap-0.5">
            {EXPLORE.map(({ label, to, color, border }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="hel-explore"
                  style={{ '--hel-exp-color': color, '--hel-exp-border': border } as React.CSSProperties}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}

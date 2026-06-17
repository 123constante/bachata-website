import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const WEEKDAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const;

const EXPLORE: ReadonlyArray<readonly [string, string]> = [
  ['On tonight', '/tonight'],
  ['Bachata parties', '/parties'],
  ['Bachata classes', '/classes'],
  ['Learn bachata (beginners)', '/learn-bachata-london'],
  ['Festivals', '/festivals'],
  ['London bachata guide', '/london-bachata-guide'],
  ['FAQ', '/faq'],
];

/**
 * Crawlable internal-link cluster at the tail of the homepage feed / desktop
 * rail. Gives the highest-authority page real <a> links into the weekday +
 * content pages (the anchored event rows are the event-link layer). Renders a
 * couple of <h2>s so the homepage gains heading structure under its <h1>.
 */
export function HomeExploreLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Explore bachata in London" className={cn('mt-5 border-t border-border pt-4', className)}>
      <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Browse bachata by night
      </h2>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {WEEKDAYS.map((d) => (
          <li key={d}>
            <Link
              to={`/bachata-london-${d.toLowerCase()}`}
              className="block rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:border-primary hover:text-primary"
            >
              {d}
            </Link>
          </li>
        ))}
      </ul>
      <h2 className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Explore
      </h2>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
        {EXPLORE.map(([label, to]) => (
          <li key={to}>
            <Link to={to} className="text-sm font-medium text-primary hover:underline">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

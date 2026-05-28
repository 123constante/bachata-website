/**
 * Programmatic weekday landing page: /bachata-london-{monday|...|sunday}
 *
 * Targets long-tail queries like "bachata friday london". Pulls live events
 * for the next 4 weeks, filters to the URL weekday, renders a list.
 */
import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useSeo } from '@/lib/seo';
import { useCalendarEvents } from '@/hooks/useCalendarEventsRpc';
import { useCity } from '@/contexts/CityContext';

interface WeekdayMeta {
  slug: string;
  label: string;
  dow: number;
  intro: string;
  context: string;
}

const WEEKDAYS: Record<string, WeekdayMeta> = {
  monday: {
    slug: 'monday', label: 'Monday', dow: 1,
    intro: "Monday night bachata in London - the gentle entry to the week. Beginners' classes, low-pressure socials, and a handful of dedicated rooms that lead the week.",
    context: "Monday is the easiest night to walk into a bachata class with no experience - the rooms are smaller, the teachers have time, and the dancers are local regulars.",
  },
  tuesday: {
    slug: 'tuesday', label: 'Tuesday', dow: 2,
    intro: 'Tuesday bachata in London - mid-week classes pick up and the first big socials of the week run in central London.',
    context: 'Tuesdays in London bachata are class-led. The rooms are mostly schools running structured course blocks; turn up for the class and stay for the social that follows.',
  },
  wednesday: {
    slug: 'wednesday', label: 'Wednesday', dow: 3,
    intro: 'Wednesday bachata in London - the mid-week peak for socials. The biggest dedicated bachata rooms run on Wednesday.',
    context: "Wednesday is when London's bachata scene really opens up - multiple socials run in parallel across the city, with a mix of sensual and Dominican rooms.",
  },
  thursday: {
    slug: 'thursday', label: 'Thursday', dow: 4,
    intro: "Thursday bachata in London - the warm-up to the weekend. Several flagship socials run on Thursdays.",
    context: 'Thursdays carry pre-weekend energy. Expect bigger crowds, sets that lean party-side, and out-of-town teachers passing through on tour.',
  },
  friday: {
    slug: 'friday', label: 'Friday', dow: 5,
    intro: "Friday bachata in London - the weekend kicks off. The biggest parties, the longest nights, the most international dancers in the room.",
    context: "Friday is London bachata's flagship night. Multiple big-room parties run until 3am or later, often with two or three dance floors playing different styles.",
  },
  saturday: {
    slug: 'saturday', label: 'Saturday', dow: 6,
    intro: "Saturday bachata in London - the headline night. Festivals, congresses, special editions and the biggest weekly parties land on Saturdays.",
    context: "Saturday is festival night when a congress is in town, and a flagship-party night when one isn't. Plan ahead - the big rooms sell out.",
  },
  sunday: {
    slug: 'sunday', label: 'Sunday', dow: 0,
    intro: 'Sunday bachata in London - afternoon socials, recovery classes, and the long, slow tail of the weekend.',
    context: 'Sundays mix afternoon socials, weekend-festival closings, and Sunday-night recovery rooms. A relaxed way to close the week.',
  },
};

function isSameWeekday(iso: string | null | undefined, dow: number): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getDay() === dow;
}

const BachataWeekday = () => {
  const location = useLocation();
  // Routes are 7 explicit /bachata-london-{weekday} paths (React Router v6
  // doesn't allow partial dynamic segments). Derive weekday from the suffix.
  const weekdayMatch = location.pathname.match(/^\/bachata-london-([a-z]+)\/?$/i);
  const meta = weekdayMatch ? WEEKDAYS[weekdayMatch[1].toLowerCase()] : undefined;
  const { citySlug } = useCity();

  const rangeStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const rangeEnd = useMemo(() => {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + 28);
    return d;
  }, [rangeStart]);

  const { data: events = [] } = useCalendarEvents({
    rangeStart,
    rangeEnd,
    citySlug: citySlug ?? null,
    enabled: Boolean(meta && citySlug),
  });

  const matched = useMemo(() => {
    if (!meta) return [];
    return (events as ReadonlyArray<Record<string, unknown>>).filter((e) =>
      isSameWeekday(
        (e.startsAt as string | null | undefined) ??
          (e.start_time as string | null | undefined) ??
          (e.date as string | null | undefined),
        meta.dow,
      ),
    );
  }, [events, meta]);

  useSeo(
    meta
      ? {
          title: `Bachata in London on ${meta.label}`,
          description: meta.intro,
          canonical: `https://bachatacalendar.co.uk/bachata-london-${meta.slug}`,
          ogType: 'article',
        }
      : { title: 'Bachata in London', description: 'Bachata events in London by weekday.', noindex: true },
  );

  if (!meta) {
    return (
      <GlobalLayout breadcrumbs={buildBreadcrumbs('londonBachataGuide')}>
        <div className="mx-auto max-w-2xl px-4 py-12 text-center space-y-3">
          <h1 className="text-2xl font-bold">Weekday not found</h1>
          <p className="text-muted-foreground">
            Try{' '}
            <Link to="/london-bachata-guide" className="text-primary underline">
              the London bachata guide
            </Link>{' '}
            for the full weekly rhythm.
          </p>
        </div>
      </GlobalLayout>
    );
  }

  return (
    <GlobalLayout
      breadcrumbs={buildBreadcrumbs('bachataWeekday', {
        entityName: meta.label,
        entityId: meta.slug,
      })}
    >
      <article className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Bachata in London &mdash; {meta.label}
          </h1>
          <p className="text-base text-muted-foreground">{meta.intro}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">Why {meta.label}?</h2>
          <p className="leading-relaxed">{meta.context}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">
            What&rsquo;s on this {meta.label} ({matched.length} event{matched.length === 1 ? '' : 's'})
          </h2>
          {matched.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No bachata events listed for the next four {meta.label}s. Check the{' '}
              <Link to="/tonight" className="text-primary underline">Tonight page</Link>{' '}
              or the full{' '}
              <Link to="/parties" className="text-primary underline">parties listing</Link>.
            </p>
          ) : (
            <ul className="space-y-2">
              {matched.slice(0, 30).map((e) => {
                const id = (e.id as string | undefined) ?? (e.event_id as string | undefined) ?? '';
                const name = (e.name as string | undefined) ?? (e.title as string | undefined) ?? '';
                const venueName = (e.venueName as string | undefined) ?? (e.venue_name as string | undefined) ?? '';
                const when = (e.startsAt as string | undefined) ?? (e.start_time as string | undefined);
                return (
                  <li key={id} className="rounded border border-border/60 p-3 hover:bg-primary/5 transition">
                    <Link to={`/event/${id}`} className="block">
                      <div className="font-semibold text-base">{name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {venueName}
                        {when ? ` - ${new Date(when).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">Other weekdays</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.values(WEEKDAYS).filter((w) => w.slug !== meta.slug).map((w) => (
              <li key={w.slug}>
                <Link
                  to={`/bachata-london-${w.slug}`}
                  className="block rounded border border-border/60 px-3 py-2 text-center text-sm font-semibold hover:bg-primary/10 transition"
                >
                  {w.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </GlobalLayout>
  );
};

export default BachataWeekday;

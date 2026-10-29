/**
 * EmptyCityNote -- the ONE empty state for a city with nothing listed yet
 * ("Coming soon" + "Tell us", owner decision 2026-10-26). Home feed, Tonight,
 * Venues, Organisers, Dancers, DJs and search all render it, so the copy and
 * the action cannot drift between screens. "Tell us" opens ListingRequestForm
 * inline; its source_url (the page path, plus ?city= on a bare route) tells
 * the receiver which city.
 *
 * The form is LAZY: the note renders in the home feed's first load, and the
 * form (with the toast and the Supabase RPC path) cost the home route +20 KB
 * first-load JS and 5 chunks, over its budget. It loads on the "Tell us" tap.
 */
import { Suspense, useState, type ReactNode } from 'react';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import type { ListingSection } from '@/lib/featureFlags';
import type { PageCity } from '@/lib/pageCity';
import { listingSourceUrl } from '@/components/listingSourceUrl';

// Through ComingSoonGate, not the form's own module: see the re-export there.
const ListingRequestForm = lazyWithRetry(() =>
  import('@/components/ComingSoonGate').then((m) => ({ default: m.ListingRequestForm })),
);

export const EMPTY_CITY_TELL_US = 'Tell us';

export function emptyCityNoteText(cityName: string): string {
  return `Nothing listed in ${cityName} yet. Run a night or know a teacher?`;
}

// The list half of pageCity: whether a directory page shows this note, and the
// venues cut. Here, not in pageCity.ts (which rides lib-event-rules, in the first
// load of every route, /app included) and not in a module of their own (a chunk
// of its own on /venues, /dancers, /djs, /organisers): every page that reads them
// renders this note, so they ride its chunk. Moved 2026-10-27, /app bundle trim.

/**
 * A city-wide list (venues) cut to the page city by its city_name. London is
 * returned untouched -- the London page is byte-identical to before, its
 * three off-city venues included under "Elsewhere".
 */
export function rowsForCity<T extends { city_name?: string | null }>(rows: readonly T[], city: PageCity): readonly T[] {
  if (city.isLondon) return rows;
  const want = city.name.toLowerCase();
  return rows.filter((r) => (r.city_name ?? '').trim().toLowerCase() === want);
}

/**
 * Global directories (dancers, DJs, organisers) list everyone; true when the
 * page city is not London and no row is in it, so the page shows the
 * empty-city note above the everyone-list.
 */
export function cityHasNoRows<T>(rows: readonly T[], city: PageCity, cityOf: (row: T) => string | null | undefined): boolean {
  if (city.isLondon) return false;
  const want = city.name.toLowerCase();
  return !rows.some((r) => (cityOf(r) ?? '').trim().toLowerCase() === want);
}

/** The line under the note on a global directory. */
export const SHOWING_EVERYONE = 'Showing everyone for now.';

interface EmptyCityNoteProps {
  cityName: string;
  /** The page city's slug, so the tip's source_url names the city on a bare route. */
  citySlug?: string | null;
  /**
   * The listing_request_section the tip is filed under. The enum has no
   * event value, so a "run a night" tip goes in as organisers_directory.
   */
  section?: ListingSection;
  /** Overrides the sentence (search says "Nothing in <City> yet."). */
  text?: string;
  /** A second action beside "Tell us" (e.g. "Search all cities"). */
  extraAction?: ReactNode;
  /** A line under the sentence (e.g. "Showing everyone for now."). */
  footnote?: string;
  className?: string;
}

export default function EmptyCityNote({
  cityName,
  citySlug = null,
  section = 'organisers_directory',
  text,
  extraAction,
  footnote,
  className = '',
}: EmptyCityNoteProps) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`max-w-md mx-auto rounded-lg border border-primary/30 bg-surface/60 p-3 text-sm text-left ${className}`}
      data-testid="empty-city-note"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Coming soon</p>
      <p className="mt-1 text-foreground">{text ?? emptyCityNoteText(cityName)}</p>
      {footnote && <p className="mt-1 text-muted-foreground">{footnote}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{ minHeight: 44 }}
            className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            {EMPTY_CITY_TELL_US}
          </button>
        )}
        {extraAction}
      </div>
      {open && (
        <div className="mt-3 rounded-md bg-white p-3">
          <Suspense fallback={<p className="text-sm text-slate-600">Loading&hellip;</p>}>
            <ListingRequestForm
              section={section}
              getSourceUrl={() => listingSourceUrl(window.location.pathname, window.location.search, citySlug)}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}

// Festival Map -- "What's New"-tab brand hero: the Bachata Calendar logo, the
// "Every class, party & festival in one place" tagline (keyword colours keyed to
// the map's own category colours), and a live stat strip. Slimmer than the old
// landing hero since the homepage now leads with events, not this card. This
// week + venues come from the loaded map data (no extra query); teachers +
// organisers are live directory counts. Shared by the desktop list rail and the
// mobile sheet -- What's New tab only.

import type { UseMapListResult } from '../useMapList';
import { useDirectoryCounts } from '@/hooks/useDirectoryCounts';
import { CATEGORY_COLORS } from '../mapTypes';
import bcLogo from '@/assets/brand/bc-logo.png';

// Tagline keyword colours == the map category colours (class / party / festival),
// so the hero and the pins speak the same colour language.
const KW = { class: CATEGORY_COLORS.class, party: CATEGORY_COLORS.party, festival: CATEGORY_COLORS.fest } as const;

function Stat({ n, label }: { n: number | null; label: string }) {
  return (
    <div className="flex flex-col items-start rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5">
      {n == null ? (
        <span className="h-6 w-9 animate-pulse rounded bg-muted-foreground/20" aria-hidden />
      ) : (
        <span className="text-2xl font-black leading-none tracking-tight text-primary tabular-nums">{n}</span>
      )}
      <span className="mt-1 text-xs font-medium leading-tight text-foreground/70">{label}</span>
    </div>
  );
}

export function NewsBrandCard({ state }: { state: UseMapListResult }) {
  const s = state.stats;
  const { data: counts } = useDirectoryCounts();
  return (
    <section className="mb-3 rounded-2xl border border-border bg-card/40 p-3 text-center">
      <img
        src={bcLogo}
        alt="Bachata Calendar"
        width={80}
        height={80}
        className="mx-auto h-20 w-20 rounded-2xl"
      />
      <p className="mt-2 text-sm font-semibold text-foreground">
        Every <b style={{ color: KW.class }}>class</b>, <b style={{ color: KW.party }}>party</b> &amp;{' '}
        <b style={{ color: KW.festival }}>festival</b> in one place.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat n={s.thisWeek} label="Events this week" />
        <Stat n={s.venues} label="Venues" />
        <Stat n={counts?.teachers ?? null} label="Teachers" />
        <Stat n={counts?.organisers ?? null} label="Organisers" />
      </div>
    </section>
  );
}

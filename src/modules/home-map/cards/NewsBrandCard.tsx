// Festival Map -- News-tab brand hero: the Bachata Calendar logo, the
// "Every class, party & festival in one place" tagline (colour-keyed per
// Ricky's brand choice), and a live stat strip. Laid out as a 2x2 "breathing"
// grid. This week + venues are derived from the map data (no extra query);
// days-running is computed from the launch date (2025-04-25, pure arithmetic);
// organisers is a live directory count. Shared by the desktop list rail and
// the mobile sheet -- News tab only.

import type { UseMapListResult } from '../useMapList';
import { useDirectoryCounts } from '@/hooks/useDirectoryCounts';
import bcLogo from '@/assets/brand/bc-logo.png';

// Tagline keyword colours: class = yellow, party = blue, festival = red.
const KW = { class: '#F2C94C', party: '#4E9BF5', festival: '#E2415C' } as const;

function Stat({ n, label, live = false }: { n: number | null; label: string; live?: boolean }) {
  return (
    <div className="relative flex flex-col items-start rounded-2xl border border-border/60 bg-muted/40 px-3 py-3">
      {live && (
        <span
          className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-pulse"
          aria-hidden
        />
      )}
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
  const daysRunning = Math.floor((Date.now() - new Date('2025-04-25').getTime()) / 86400000);
  return (
    <section className="mb-3 rounded-2xl border border-border bg-card/40 p-4 text-center">
      <img
        src={bcLogo}
        alt="Bachata Calendar"
        width={104}
        height={104}
        className="mx-auto h-[104px] w-[104px] rounded-2xl"
      />
      <p className="mt-3 text-sm font-semibold text-foreground">Every <b style={{ color: KW.class }}>class</b>, <b style={{ color: KW.party }}>party</b> &amp; <b style={{ color: KW.festival }}>festival</b> in one place.</p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Stat n={s.thisWeek} label="Events this week" live />
        <Stat n={s.venues} label="Venues" />
        <Stat n={daysRunning} label="Days tracking the scene" />
        <Stat n={counts?.organisers ?? null} label="Organisers" />
      </div>
    </section>
  );
}

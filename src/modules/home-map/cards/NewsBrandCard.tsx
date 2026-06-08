// Festival Map -- News-tab brand hero: the Bachata Calendar logo, the
// "Every class, party & festival in one place" tagline (colour-keyed per
// Ricky's brand choice), and a live 4-stat strip derived from the map data
// already on the page (no extra query). Shared by the desktop list rail and the
// mobile sheet -- rendered on the News tab only.

import type { UseMapListResult } from '../useMapList';
import bcLogo from '@/assets/brand/bc-logo.png';

// Tagline keyword colours: class = yellow, party = blue, festival = red.
const KW = { class: '#F2C94C', party: '#4E9BF5', festival: '#E2415C' } as const;

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-muted/40 py-2.5">
      <span className="text-xl font-extrabold leading-none text-primary tabular-nums">{n}</span>
      <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

export function NewsBrandCard({ state }: { state: UseMapListResult }) {
  const s = state.stats;
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
      <div className="mt-4 grid grid-cols-4 gap-2">
        <Stat n={s.thisWeek} label="This week" />
        <Stat n={s.venues} label="Venues" />
        <Stat n={s.festivals} label="Festivals" />
        <Stat n={s.justAdded} label="Just added" />
      </div>
    </section>
  );
}

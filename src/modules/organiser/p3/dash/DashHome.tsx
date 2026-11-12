import { useMemo } from 'react';
import { useProfileProgress } from '../../shared/profileProgress';
import { dayWord } from '../model';
import type { P3Row } from '../data/home';
import { useP3Analytics } from '../data/useP3Data';
import type { HomeOrganiser } from '../../shared/selfServeApi';
import { buildDash, type DashNight, type ProfileStep } from './dashModel';
import { DashView } from './DashView';

const STEP_WORDS: Record<string, Omit<ProfileStep, 'key' | 'done'>> = {
  bio: { label: 'Bio', sentence: 'Tell dancers who you are.', button: 'Add a bio' },
  logo: { label: 'Logo', sentence: 'A logo helps people spot your page.', button: 'Add a logo' },
};

/** Night facts: opens are per SERIES (analytics v2 has no per-night read), so they sit on that series' next night only. */
function nightsOf(rows: readonly P3Row[], today: string, opensBySeries: ReadonlyMap<string, number>): DashNight[] {
  const out: DashNight[] = [];
  for (const r of rows) {
    for (const d of r.event.dates) {
      if (d.date < today) continue;
      const first = r.next?.date === d.date;
      out.push({
        key: `${r.id}:${d.date}`, date: d.date, name: r.name,
        when: `${dayWord(d.date, today, r.nextStart)}${first ? `, ${r.nextTime}` : ''}`,
        cancelled: d.status === 'cancelled', going: null,
        opens: first ? opensBySeries.get(r.id) ?? 0 : 0, taps: {}, ticketsSold: 0,
      });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Home for the organiser dashboard flag: reads the same hooks as the old Home, draws buildDash. */
export function DashHome({ rows, today, page, seriesIds }: { rows: readonly P3Row[]; today: string; page: HomeOrganiser; seriesIds: ReadonlySet<string> }) {
  const ids = useMemo(() => [...seriesIds], [seriesIds]);
  const analytics = useP3Analytics('m', ids);
  const progress = useProfileProgress(page.id);
  const nights = useMemo(() => {
    const opens = new Map<string, number>();
    if (analytics.data && !analytics.data.hidden && ids.length === 1) opens.set(ids[0], analytics.data.data.totals.views);
    return nightsOf(rows, today, opens);
  }, [rows, today, analytics.data, ids]);
  const steps: ProfileStep[] = (progress.data?.steps ?? [])
    .filter((s) => s.area === 'organiser' && STEP_WORDS[s.field])
    .map((s) => ({ key: s.field as ProfileStep['key'], done: s.done, ...STEP_WORDS[s.field] }));
  const model = buildDash({
    load: analytics.isError ? 'error' : 'ready', seat: page.role, nights,
    upcomingDates: rows.reduce((n, r) => n + r.upcoming, 0), pageLink: `${window.location.origin}/organisers/${page.id}`,
    profileSteps: steps, cityOrganisers: null, cityAverage: null, sellingViaUs: false, teamCount: Array.isArray(page.team) ? page.team.length : 1,
  });
  return <DashView model={model} pageName={page.name} onRetry={() => void analytics.refetch()} />;
}

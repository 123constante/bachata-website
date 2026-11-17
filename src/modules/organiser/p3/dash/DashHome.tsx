import { useCallback, useMemo, useState } from 'react';
import { useProfileProgress } from '../../shared/profileProgress';
import { dayWord } from '../model';
import type { P3Row } from '../data/home';
import { useP3Analytics, useP3Home } from '../data/useP3Data';
import { flags } from '@/lib/featureFlags';
import { organiserOfSeries } from '../tickets/data';
import { P3_PATHS } from '../shell/paths';
import { P3NightGoing } from '../screens/P3Going';
import { homeClockOf } from './homeClock';
import { usePastNights } from './pastNights';
import type { HomeOrganiser } from '../../shared/selfServeApi';
import { buildDash, type DashNight, type ProfileStep } from './dashModel';
import type { AnalyticsTotals } from '../data/analyticsV2';
import { DashView } from './DashView';
import { captionOf, nightLinkOf, pageLinkOf, shareText, type ShareOutcome } from './shareLinks';

const SAID: Record<ShareOutcome, string | null> = { shared: null, copied: 'Link copied. Paste it wherever your group chats.', whatsapp: null };

const STEP_WORDS: Record<string, Omit<ProfileStep, 'key' | 'done'>> = {
  bio: { label: 'Bio', sentence: 'Tell dancers who you are.', button: 'Add a bio' },
  logo: { label: 'Logo', sentence: 'A logo helps people spot your page.', button: 'Add a logo' },
};

/** Link taps by type from organiser_analytics_v2 zones (group_chat is the WhatsApp button). */
export function tapsOfTotals(t: AnalyticsTotals): DashNight['taps'] {
  const k = t.linkTaps;
  return { ticket: k.ticket ?? 0, share: k.share ?? 0, whatsapp: k.group_chat ?? 0, directions: k.directions ?? 0 };
}

/** Night facts: taps are per SERIES over the month window (no per-night read, GAP-4), so they sit on that series' next night only, and only when known. */
function nightsOf(rows: readonly P3Row[], today: string, tapsBySeries: ReadonlyMap<string, DashNight['taps']>, origin: string): DashNight[] {
  const out: DashNight[] = [];
  for (const r of rows) {
    for (const d of r.event.dates) {
      if (d.date < today) continue;
      const first = r.next?.date === d.date;
      out.push({
        key: `${r.id}:${d.date}`, date: d.date, name: r.name,
        when: `${dayWord(d.date, today, r.nextStart)}${first ? `, ${r.nextTime}` : ''}`,
        cancelled: d.status === 'cancelled', going: null, link: nightLinkOf(origin, r.publicEventRef),
        opens: null, taps: first && r.lifecycle !== 'draft' ? tapsBySeries.get(r.id) ?? {} : {}, ticketsSold: 0,
        seriesId: r.id, draft: r.lifecycle === 'draft',
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
    const taps = new Map<string, DashNight['taps']>();
    if (analytics.data && !analytics.data.hidden && ids.length === 1) taps.set(ids[0], tapsOfTotals(analytics.data.data.totals));
    return nightsOf(rows, today, taps, window.location.origin);
  }, [rows, today, analytics.data, ids]);
  const home = useP3Home();
  const series = useMemo(() => rows.map((r) => ({ id: r.id, name: r.name })), [rows]);
  const past = usePastNights(series, today, 1, true, true);
  const nextLive = nights.find((n) => !n.cancelled) ?? null;
  const nextStartIso = nextLive?.seriesId ? organiserOfSeries(home.data, nextLive.seriesId)?.series.next_dates?.[0]?.materialised_start_utc ?? null : null;
  const lastNight = past.nights.find((n) => !n.cancelled) ?? null;
  const clock = homeClockOf(nextStartIso, nextLive?.date ?? null, lastNight?.date ?? null, today, Date.now());
  const pageLink = pageLinkOf(window.location.origin, page.id);
  const [notice, setNotice] = useState<string | null>(null);
  const run = useCallback(async (title: string, text: string, url: string) => {
    setNotice(null);
    setNotice(SAID[await shareText(title, text, url)]);
  }, []);
  const steps: ProfileStep[] = (progress.data?.steps ?? [])
    .filter((s) => s.area === 'organiser' && STEP_WORDS[s.field])
    .map((s) => ({ key: s.field as ProfileStep['key'], done: s.done, ...STEP_WORDS[s.field] }));
  const model = buildDash({
    load: 'ready', seat: page.role, nights,
    upcomingDates: rows.reduce((n, r) => n + r.upcoming, 0), pageLink,
    profileSteps: steps, cityOrganisers: null, cityAverage: null, sellingViaUs: false, teamCount: Array.isArray(page.team) ? page.team.length : 1,
    clock, lastNight, canDoor: flags.organiserTicketing, hasPastNights: past.nights.length > 0,
  });
  const heroNight = model.hero?.night ?? null;
  const going = heroNight?.seriesId && !heroNight.draft
    ? <P3NightGoing seriesId={heroNight.seriesId} seriesName={heroNight.name} nightKey={{ date: heroNight.date }} testId="dash-hero-going" />
    : null;
  const onShareNight = (key: string) => {
    const n = nights.find((x) => x.key === key);
    if (n?.link) void run(n.name, captionOf(n.name, n.when, n.link), n.link);
  };
  return (
    <DashView model={model} pageName={page.name} pageLink={pageLink} notice={notice} onRetry={() => void analytics.refetch()} analyticsFailed={analytics.isError}
      onShareNight={onShareNight} going={going} doorTo={heroNight?.seriesId ? P3_PATHS.eventDoor(heroNight.seriesId) : null} compareTo={P3_PATHS.compare} onSharePage={() => void run(page.name, `${page.name} on Bachata Calendar`, pageLink)} />
  );
}

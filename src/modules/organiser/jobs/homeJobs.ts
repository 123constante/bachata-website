// Home's numbered jobs (plan 4.1, 4.3 #3, D37, D6): ONE mapping from the home
// payload to the list, and the SAME facts feed My events' chips (seriesChip),
// so a series never reads one way on Home and another on My events.

import { londonDateKey, londonDaysBetweenKeys, parseUtcIso } from '@/lib/londonDate';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { isListedSeries, type HomeSeriesFull } from '@/modules/organiser/shared/homeModel';
import { CANCELLED_WORD, isClosed, lifecycleTag } from '@/modules/organiser/shared/eventState';
import { seriesLife } from '@/modules/organiser/shared/lifeLabel';
import { FLYER_WORD } from '@/modules/organiser/shared/flyerLabel';
import type { HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';
import { parseTeam, type IncomingAccessRequest } from '@/modules/organiser/shared/teamModel';
import { goLiveLeft, thingsLeftText } from '@/modules/organiser/shared/goLiveKeys';
import type { GoLiveCheck } from '@/modules/organiser/shared/goLiveCheck';

export type JobKind = 'change'|'add'|'cancel'|'no_dates_left'|'join_request'|'stale_draft'|'go_live'|'no_cover'|'create_first_event'|'add_manager';

export interface Job { kind: JobKind; n: number; title: string; sub?: string; to: string; tone: 'gold'|'plain'|'problem' }

/** A draft is a Home problem once it is OLDER than this many days (D6). */
export const STALE_DRAFT_DAYS = 7;

type SeriesProblem = 'no_dates_left' | 'stale_draft' | 'no_cover';

/** Whole London days since the series was created; null when unknown. */
function draftAgeDays(series: HomeSeriesFull, today: string): number | null {
  const created = parseUtcIso(series.created_at);
  return created ? londonDaysBetweenKeys(londonDateKey(created), today) : null;
}

/**
 * The D6 problems of ONE series, in Home order. Paused, ended and archived
 * series have none (D6, R3-4). `upcoming_count` is scheduled-only (R3-3), so a
 * live series whose coming dates are all cancelled has no dates left.
 */
function seriesProblems(series: HomeSeriesFull, today: string): SeriesProblem[] {
  if (!isListedSeries(series)) return [];
  if (series.lifecycle_status === 'draft') {
    const age = draftAgeDays(series, today);
    return age !== null && age > STALE_DRAFT_DAYS ? ['stale_draft'] : [];
  }
  if (series.lifecycle_status !== 'live') return [];
  const problems: SeriesProblem[] = [];
  // F4 (owner default): a festival holds one date, so Add a date has every day
  // disabled for it; a festival with no coming date is finished, not a problem.
  if (series.upcoming_count <= 0 && series.format !== 'festival') problems.push('no_dates_left');
  if (!series.default_cover_image_url) problems.push('no_cover');
  return problems;
}

/** Not live yet: the chip for every draft, and the start of the stale-draft sub-line. */
const NOT_LIVE_YET = 'Not live yet';

/** A draft that is not a Home problem yet keeps the shared status word and its age ("Draft, 2 days"). */
function draftLabel(series: HomeSeriesFull, today: string): string {
  const age = draftAgeDays(series, today);
  const word = lifecycleTag('draft').label;
  if (!age || age < 1) return word;
  return `${word}, ${age} ${age === 1 ? 'day' : 'days'}`;
}

/** Whole days a draft has waited, in words ("started 9 days ago"); null under a day. */
function startedAgo(series: HomeSeriesFull, today: string): string | null {
  const age = draftAgeDays(series, today);
  return age && age >= 1 ? `started ${age} ${age === 1 ? 'day' : 'days'} ago` : null;
}

/**
 * D83: the words for each problem, ONE map. `chip` is the short My events tag;
 * `title(name)` is the Home row's action naming the event; `sub` says why in plain words.
 */
const PROBLEM_COPY: Record<SeriesProblem, {
  chip: string;
  title: (name: string) => string;
  sub: (series: HomeSeriesFull, today: string) => string;
}> = {
  no_dates_left: { chip: 'Needs dates', title: (n) => `Add dates: ${n}`, sub: () => 'No coming dates, so dancers see nothing' },
  no_cover: { chip: `Needs a ${FLYER_WORD}`, title: (n) => `Add a ${FLYER_WORD}: ${n}`, sub: () => `Events with a ${FLYER_WORD} get more clicks` },
  stale_draft: {
    chip: NOT_LIVE_YET,
    title: (n) => `Finish and go live: ${n}`,
    sub: (series, today) => [NOT_LIVE_YET, startedAgo(series, today)].filter(Boolean).join(', '),
  },
};

/** Every coming date is cancelled (dancers see the cancellation): what an open event's chip says first. */
const cancelledOnly = (series: HomeSeriesFull) =>
  !isClosed(series.lifecycle_status) && series.upcoming_count <= 0 && series.cancelled_upcoming_count > 0;

/**
 * My events' (and One event's) chip for a series: CANCELLED_WORD when every coming
 * date is cancelled (decision 3, INT-B N-9: it outranks every Home problem), else
 * its first Home problem, else its plain state in the shared words (lifecycleTag,
 * the date page's too; D22: Live is the one status mark).
 */
export function seriesChip(series: HomeSeriesFull, today: string): { label: string; tone: 'ok'|'bad'|'n' } {
  if (cancelledOnly(series)) return { label: CANCELLED_WORD, tone: 'bad' };
  const [first] = seriesProblems(series, today);
  if (first) return { label: PROBLEM_COPY[first].chip, tone: 'bad' };
  if (series.lifecycle_status === 'draft') return { label: draftLabel(series, today), tone: 'n' };
  return { label: lifecycleTag(series.lifecycle_status).label, tone: series.lifecycle_status === 'live' ? 'ok' : 'n' };
}

/**
 * The chip on My events and One event (W3 d31): a live series with nothing coming up reads
 * Finished / Nothing coming up from the ONE life mapping (lifeLabel), the words the Past section
 * uses; every other series keeps seriesChip. Home's job row keeps its own actionable words (PROBLEM_COPY).
 */
export function lifeChip(series: HomeSeriesFull, today: string): { label: string; tone: 'ok'|'bad'|'n' } {
  if (series.lifecycle_status === 'live' && series.upcoming_count <= 0 && !cancelledOnly(series)) {
    return { label: seriesLife(series, series.upcoming_count).tag.label, tone: 'n' };
  }
  return seriesChip(series, today);
}

const PROBLEM_TO: Record<SeriesProblem, (seriesId: string) => string> = {
  // C15: Add a date with the event pre-chosen.
  no_dates_left: (id) => ORG_PATHS.addEvent(id),
  stale_draft: (id) => ORG_PATHS.event(id),
  no_cover: (id) => ORG_PATHS.cover(id),
};

type Draft = Omit<Job, 'n'>;

/** A draft's go-live answer (series_go_live_check_v1), by series id; a series not here has not loaded (or failed). */
export type GoLiveChecks = Readonly<Record<string, GoLiveCheck | undefined>>;

export const READY_TO_GO_LIVE = 'Ready to go live';

/**
 * W2 walk fix 4: every draft gets ONE row that reads the event's Go live list (the
 * one mapping, goLiveKeys.goLiveLeft): "8 things left", never a lone "Add a date"
 * while the event lists 8. Until its check loads, a stale draft keeps its D6 words
 * and a fresh one says it is not live yet. The tap opens the event, whose card is the list.
 */
function goLiveRow(series: HomeSeriesFull, check: GoLiveCheck | undefined, today: string): Draft {
  const stale = seriesProblems(series, today).includes('stale_draft');
  const ago = startedAgo(series, today);
  const left = check ? goLiveLeft(check) : null;
  const sub = left === null
    ? (stale ? PROBLEM_COPY.stale_draft.sub(series, today) : NOT_LIVE_YET)
    : [left > 0 ? thingsLeftText(left) : READY_TO_GO_LIVE, stale ? ago : null].filter(Boolean).join(', ');
  return { kind: 'go_live', title: PROBLEM_COPY.stale_draft.title(series.name), sub, to: ORG_PATHS.event(series.id), tone: stale || (left ?? 0) > 0 ? 'problem' : 'plain' };
}

/** The first steps of a page with no events (C1b): each drops off once done. */
function firstSteps(home: HomeOrganiser): Draft[] {
  const steps: Draft[] = [{ kind: 'create_first_event', title: 'Create your first event', to: ORG_PATHS.newWhat, tone: 'gold' }];
  // No photo step (C15): the logo is a profile question, asked by Home's ONE "Complete your profile" button.
  // No WhatsApp step (C69): no organiser table has a WhatsApp column and My page has no such field (prod, 2026-10-17).
  if (parseTeam(home.team).length < 2) steps.push({ kind: 'add_manager', title: 'Add a manager', to: ORG_PATHS.teamAdd, tone: 'plain' });
  return steps;
}

/**
 * Home's numbered list for ONE page, in D37 order: Change and Cancel (only
 * when a live series has a coming scheduled date), Add (only when a live or
 * draft series exists; paused/ended are server-locked, D6), then the D6
 * problems by kind: no dates left, join requests, stale drafts, no cover. A
 * page where neither Change nor Add applies gets the first steps instead.
 */
export function homeJobs(home: HomeOrganiser, requests: IncomingAccessRequest[], today: string, checks: GoLiveChecks = {}): Job[] {
  const listed = home.series.filter(isListedSeries);
  const hasComingDate = listed.some((s) => s.lifecycle_status === 'live' && s.upcoming_count > 0);
  const canAdd = listed.some((s) => s.lifecycle_status === 'live' || s.lifecycle_status === 'draft');
  const drafts: Draft[] = [];
  if (!hasComingDate && !canAdd) {
    drafts.push(...firstSteps(home));
  } else {
    if (hasComingDate) drafts.push({ kind: 'change', title: 'Change a date', to: ORG_PATHS.change, tone: 'plain' });
    if (canAdd) drafts.push({ kind: 'add', title: 'Add a date', to: ORG_PATHS.add, tone: 'plain' });
    if (hasComingDate) drafts.push({ kind: 'cancel', title: 'Cancel a date', to: ORG_PATHS.cancel, tone: 'plain' });
  }
  const problems = listed.flatMap((s) => seriesProblems(s, today).map((problem) => ({ s, problem })));
  const rows = (problem: SeriesProblem) => problems
    .filter((p) => p.problem === problem)
    .map(({ s }): Draft => ({ kind: problem, title: PROBLEM_COPY[problem].title(s.name), sub: PROBLEM_COPY[problem].sub(s, today), to: PROBLEM_TO[problem](s.id), tone: 'problem' }));
  drafts.push(...rows('no_dates_left'));
  drafts.push(...requests.map((r): Draft => ({
    kind: 'join_request', title: 'Answer a request to join', ...(r.requesterEmail ? { sub: r.requesterEmail } : {}), to: ORG_PATHS.team, tone: 'problem',
  })));
  // Where the stale-draft rows were: one go-live row per draft, stale or not (fix 4).
  drafts.push(...listed.filter((s) => s.lifecycle_status === 'draft').map((s) => goLiveRow(s, checks[s.id], today)));
  drafts.push(...rows('no_cover'));
  return drafts.map((d, i) => ({ ...d, n: i + 1 }));
}

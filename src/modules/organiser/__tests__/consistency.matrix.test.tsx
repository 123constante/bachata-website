// @vitest-environment jsdom
/**
 * S8 consistency matrix (R1-PLAN 4.5): the facts every R1 screen must agree on, as one table.
 * Part 1 is source-level (copy, imports, the one-owner warnings); part 2 renders the write
 * screens. Each row was run against the merged tree before any fix (handover S8.md, "Red first").
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
/** The R1 screens (D22's list plus jobs/, which Home renders). */
const R1_DIRS = ['flows', 'home', 'events', 'team', 'page', 'more', 'switch', 'jobs'];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : walk(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
const rel = (p: string) => relative(ROOT, p).split('\\').join('/');
const ALL = walk(ROOT).map((p) => ({ file: rel(p), src: readFileSync(p, 'utf8') }));
const inDirs = (dirs: string[]) => ALL.filter((f) => dirs.some((d) => f.file.startsWith(`${d}/`)));
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

/** Visible copy: string literals and JSX text, comments removed; class lists and test ids skipped. */
const copyOf = (src: string): string[] => {
  const code = stripComments(src);
  const literals = [...code.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? '');
  const jsxText = [...code.matchAll(/>([^<>{}=;]*[A-Za-z][^<>{}=;]*)</g)].map((m) => m[1]);
  return [...literals, ...jsxText].filter((s) => /\s/.test(s.trim()) || /^[A-Z]/.test(s.trim())).filter((s) => !/\[var\(|^[a-z-]+(\s+[a-z0-9:[\]().%/-]+)+$/.test(s.trim()));
};

describe('copy names no control that is not on screen (no tab bar, no swipe, no menu, no Undo)', () => {
  const hits = inDirs(R1_DIRS).flatMap(({ file, src }) =>
    copyOf(src).filter((s) => /\b(tab|tabs|swipe|menu|undo)\b/i.test(s)).map((s) => `${file}: ${s.trim()}`),
  );
  it('no R1 screen copy says tab, swipe, menu or Undo', () => {
    expect(hits).toEqual([]);
  });
});

describe('the past-date refusal is one sentence everywhere (eventState.ts:75)', () => {
  const eventState = readFileSync(join(ROOT, 'shared/eventState.ts'), 'utf8');
  const canonical = /if \(past\) return '([^']+)'/.exec(eventState)?.[1];
  it('eventState.ts still owns the sentence', () => {
    expect(canonical).toMatch(/already happened/);
  });
  // A-S9: a LOOSE stem, so a reworded copy stays in the table and fails it (a mutant
  // "already passed" in selfServeErrors.ts survived the old exact-phrase filter), and the
  // owning files are pinned, so a rewording of the stem itself drops a file and fails too.
  const variants = ALL.flatMap(({ file, src }) =>
    copyOf(src).filter((s) => /so it can no longer be changed/.test(s)).map((s) => ({ file, s })),
  );
  it('the sentence lives in exactly these files', () => {
    expect([...new Set(variants.map((v) => v.file))].sort()).toEqual(['shared/eventState.ts', 'shared/selfServeErrors.ts']);
  });
  it.each(variants)('$file says it verbatim', ({ s }) => {
    expect(s).toBe(canonical);
  });
});

describe('each warning has exactly one owner screen (D14 copy, imported once)', () => {
  const ROWS = [
    { name: 'WARN_DATE', owner: 'flows/cancel/Confirm.tsx' },
    { name: 'handOverWarning', owner: 'flows/handover/Confirm.tsx' },
    { name: 'WARN_END', owner: 'flows/event/EndStep.tsx' },
  ];
  it.each(ROWS)('$name is imported only by $owner', ({ name, owner }) => {
    const importers = ALL.filter(({ file, src }) => file !== 'shared/copy.ts' && new RegExp(`import[^;]*\\b${name}\\b[^;]*from`).test(src)).map((f) => f.file);
    expect(importers).toEqual([owner]);
  });
});

describe('D22: no section labels or status tags on R1 screens', () => {
  // D22 keeps ONE status mark: the Live chip. The page screen draws it with StatusTag.
  const EXEMPT: Record<string, string> = { 'page/index.tsx': 'D22 (a Live chip stays)' };
  const hits = inDirs(['flows', 'home', 'events', 'team', 'page', 'more', 'switch'])
    .filter(({ file, src }) => !EXEMPT[file] && /import[^;]*\b(SectionLabel|StatusTag)\b[^;]*from/.test(src))
    .map((f) => f.file);
  it('no SectionLabel / StatusTag import under flows, home, events, team, page, more, switch', () => {
    expect(hits).toEqual([]);
  });
  it('the exempt Live chip says Live (the shared word) and nothing else', () => {
    const tags = [...readFileSync(join(ROOT, 'page/index.tsx'), 'utf8').matchAll(/<StatusTag[^>]*>([^<]*)<\/StatusTag>/g)].map((m) => m[1]);
    expect(tags).toEqual(["{lifecycleTag('live').label}"]);
  });
});

describe('everything is live (D4): no review machinery in the module', () => {
  it('no useSendForReview / ReviewCard / reviewModel import', () => {
    expect(ALL.filter(({ src }) => /import[^;]*\b(useSendForReview|ReviewCard|reviewModel)\b/.test(src)).map((f) => f.file)).toEqual([]);
  });
  it('no "Send for review" anywhere in the module source, comments included', () => {
    expect(ALL.filter(({ src }) => /send for review/i.test(src)).map((f) => f.file)).toEqual([]);
  });
});

describe('INT3: one name for a rule date taken off: "Take this date off" on Change, its confirm and the date page', () => {
  const FILES = ['flows/change/WhatChanges.tsx', 'flows/change/TakeOff.tsx', 'dates/index.tsx', 'dates/DateSheet.tsx'];
  it('no screen calls it a break week', () => {
    const hits = ALL.flatMap(({ file, src }) =>
      copyOf(src).filter((s) => /break this week|this week off|is a break/i.test(s)).map((s) => `${file}: ${s.trim()}`));
    expect(hits).toEqual([]);
  });
  it.each(FILES)('%s reads the shared TAKE_OFF words, not its own spelling', (file) => {
    const src = ALL.find((f) => f.file === file)!.src;
    expect(src).toMatch(/\bTAKE_OFF\b/);
    expect(copyOf(src).filter((s) => /^take (this date|it) off$/i.test(s.trim()))).toEqual([]);
  });
});

describe('INT3: Go live (P-SERIES) and Move a date (P-DATES) follow ONE A1 gate', () => {
  const USERS = ['events/lifecycleModel.ts', 'flows/change/Day.tsx', 'flows/change/WhatChanges.tsx', 'flows/new/model.ts'];
  it('only shared/a1Gate.ts defines A1_APPLIED', () => {
    expect(ALL.filter(({ src }) => /\bA1_APPLIED\s*[:=]/.test(stripComments(src))).map((f) => f.file)).toEqual(['shared/a1Gate.ts']);
  });
  it.each(USERS)('%s reads it from shared/a1Gate', (file) => {
    expect(ALL.find((f) => f.file === file)!.src).toMatch(/import \{[^}]*\bA1_APPLIED\b[^}]*\} from '@\/modules\/organiser\/shared\/a1Gate'/);
  });
});

describe('the add-a-page screen is "Add a page" everywhere (orchestrator naming decision)', () => {
  it('no screen says "Add an organiser" or "Add another organiser"', () => {
    expect(ALL.filter(({ src }) => /Add (an|another) organiser/.test(src)).map((f) => f.file)).toEqual([]);
  });
  it.each(['home/index.tsx', 'more/index.tsx', 'switch/index.tsx'])('%s names it "Add a page"', (file) => {
    expect(readFileSync(join(ROOT, file), 'utf8')).toContain('Add a page');
  });
});

// ---- G1 (F-INT-fix): status words, date words, a cancelled-only chip ------------------------
// Pure rows; modules are imported inside the rows so this block stays one hunk at the file end.

/** A listed series with no Home problem (cover set, coming dates, created on `today`). */
const g1Series = (lifecycle_status: string, today: string, over: Record<string, unknown> = {}) => ({
  id: 's-g1', name: 'Friday Social', slug: null, format: 'recurring', category: null, lifecycle_status,
  default_local_start_time: '20:00:00', default_cover_image_url: 'https://x/c.jpg', created_at: `${today}T09:00:00Z`,
  upcoming_count: 3, cancelled_upcoming_count: 0, next_dates: [], latest_decision: null, ...over,
});
/** A fixed calendar key, passed to the pure mappings as their `today` (never read off the clock). */
const G1_TODAY = '2026-10-20';
const G1_STATUSES = ['live', 'draft', 'paused', 'ended', 'archived', 'pending_review', 'rejected'];

describe('G1: one status word per lifecycle_status: My events chip == One event chip == date page word (B-B1, A-S3, B-S2)', () => {
  it.each(G1_STATUSES)('%s reads the same on every screen', async (status) => {
    const { seriesChip } = await import('@/modules/organiser/jobs/homeJobs');
    const { lifecycleTag, dateTag } = await import('@/modules/organiser/shared/eventState');
    const { LIFECYCLE_LABEL } = await import('@/modules/organiser/shared/selfServeApi');
    const word = lifecycleTag(status).label;
    // My events and One event both draw seriesChip; the date page draws dateTag.
    expect(seriesChip(g1Series(status, G1_TODAY), G1_TODAY).label).toBe(word);
    expect(dateTag(status, 'scheduled').label).toBe(word);
    expect(LIFECYCLE_LABEL[status]).toBe(word);
  });
  it('the cancelled word is one export: the date page tag and the One event row read it', async () => {
    const { dateTag, CANCELLED_WORD } = await import('@/modules/organiser/shared/eventState');
    expect(dateTag('live', 'cancelled').label).toBe(CANCELLED_WORD);
    expect(readFileSync(join(ROOT, 'events/EditorRows.tsx'), 'utf8')).toMatch(/\bCANCELLED_WORD\b/);
  });
  // The status-chip sites: none spells a status word itself (the words live in shared/eventState.ts).
  const CHIP_FILES = ['jobs/homeJobs.ts', 'page/index.tsx', 'switch/index.tsx', 'flows/add/WhichEvent.tsx', 'events/EditorRows.tsx'];
  it.each(CHIP_FILES)('%s spells no status word inline', (file) => {
    const words = copyOf(readFileSync(join(ROOT, file), 'utf8')).map((s) => s.trim())
      .filter((s) => /^(Live|Draft|Paused|Ended|Archived|In review|Changes needed|Cancelled)$/.test(s));
    expect(words).toEqual([]);
  });
});

describe('G1: one date reads the same on Home, One event, Details and Team: full weekday and month (B-S1)', () => {
  // 2026-10-23 is a Friday; 2027-01-08 a Friday in another year.
  const rows = async (key: string, today: string) => {
    const { shortDate: homeDate } = await import('@/modules/organiser/home/homeView');
    const { dayLabel } = await import('@/modules/organiser/shared/dateList');
    const { shortDate: rowDate } = await import('@/modules/organiser/events/eventModel');
    const { londonDateParts } = await import('@/modules/organiser/ui/londonDate');
    const { endedOnLabel } = await import('@/modules/organiser/shared/eventState');
    const { instantDateLabel } = await import('@/modules/organiser/shared/teamModel');
    return {
      'Home job line': homeDate(key, today),
      'flow date row (Change, Add, Cancel)': dayLabel(key),
      'One event date row': rowDate(key, today),
      'One event date chip (screen reader)': londonDateParts(key, today).label,
      'Details: ended on': endedOnLabel('ended', key, today)?.replace(/^Ended on /, ''),
      'Team: join request': instantDateLabel(`${key}T12:00:00Z`, new Date(`${today}T12:00:00Z`)),
    };
  };
  it('this year: every screen says "Friday 23 October"', async () => {
    const got = await rows('2026-10-23', G1_TODAY);
    expect(got).toEqual(Object.fromEntries(Object.keys(got).map((k) => [k, 'Friday 23 October'])));
  });
  it('another year: every screen adds the year (the flow rows, which never cross a year, excepted)', async () => {
    const got = await rows('2027-01-08', G1_TODAY);
    const { 'flow date row (Change, Add, Cancel)': flow, ...rest } = got;
    expect(flow).toBe('Friday 8 January');
    expect(rest).toEqual(Object.fromEntries(Object.keys(rest).map((k) => [k, 'Friday 8 January 2027'])));
  });
  it('no short weekday or month names anywhere in the module source', () => {
    // The date chip's month box ("Oct" over the day number) is a glyph, not copy; its label is full.
    const CHIP_BOX = 'ui/londonDate.ts';
    const hits = ALL.filter(({ file, src }) => /weekday: *'(short|narrow)'|'(Mon|Tue|Wed|Thu|Fri|Sat|Sun)'|'(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)'/.test(stripComments(src))
      || (file !== CHIP_BOX && /month: *'(short|narrow)'/.test(stripComments(src))))
      .map((f) => f.file);
    expect(hits).toEqual([]);
  });
});

describe('G1: a cancelled-only event says Cancelled on My events and One event, before any Home problem (B-N9, decision 3)', () => {
  const CASES = [
    { row: 'a one-off whose only date is cancelled, no cover', over: { format: 'one_off', default_cover_image_url: null } },
    { row: 'a festival whose only date is cancelled, no cover', over: { format: 'festival', default_cover_image_url: null } },
    { row: 'a weekly night whose coming dates are all cancelled', over: {} },
  ];
  it.each(CASES)('$row', async ({ over }) => {
    const { seriesChip } = await import('@/modules/organiser/jobs/homeJobs');
    const { CANCELLED_WORD } = await import('@/modules/organiser/shared/eventState');
    const chip = seriesChip(g1Series('live', G1_TODAY, { upcoming_count: 0, cancelled_upcoming_count: 1, ...over }), G1_TODAY);
    expect(chip).toEqual({ label: CANCELLED_WORD, tone: 'bad' });
  });
  it('a cancelled date beside a scheduled one is not cancelled-only: the cover problem still shows', async () => {
    const { seriesChip } = await import('@/modules/organiser/jobs/homeJobs');
    expect(seriesChip(g1Series('live', G1_TODAY, { upcoming_count: 1, cancelled_upcoming_count: 1, default_cover_image_url: null }), G1_TODAY).label).toBe('Needs a flyer');
  });
});

describe('G1: a long event name wraps to two lines on My events and on Home, never cut to one (B-S7)', () => {
  const TITLES = [
    { screen: 'My events row', file: 'events/EventList.tsx', el: /<span[^>]*>\{series\.name\}<\/span>/ },
    { screen: 'Home job title', file: 'home/index.tsx', el: /<span data-testid="home-job-title"[^>]*>/ },
  ];
  it.each(TITLES)('$screen: line-clamp-2, not truncate', ({ file, el }) => {
    const tag = el.exec(readFileSync(join(ROOT, file), 'utf8'))?.[0] ?? '';
    expect(tag).toMatch(/\bline-clamp-2\b/);
    expect(tag).not.toMatch(/\btruncate\b/);
  });
});

describe('G3: team copy is one mapping, says "page", and names only controls that exist (A-S4, A-S5, B-S3, B-S10, B-N1, B-N6, B-N7)', () => {
  /** Error and model copy too, not only rendered screens: every module string literal, plus the admin invite copy. */
  const ADMIN_INVITE = readFileSync(join(ROOT, '..', 'admin-organisers', 'inviteModel.ts'), 'utf8');
  const ERROR_COPY = [...ALL, { file: '../admin-organisers/inviteModel.ts', src: ADMIN_INVITE }];
  it.each([
    ['Make owner', /Make owner/],
    ['for review', /for review/i],
  ])('no string literal in the module (shared/, team/, edit-in-place/ models included) says "%s"', (_n, re) => {
    const hits = ERROR_COPY.flatMap(({ file, src }) => copyOf(src).filter((s) => re.test(s)).map((s) => `${file}: ${s.trim()}`));
    expect(hits).toEqual([]);
  });
  it('the owner_only refusal of an add is ONE string (selfServeErrors OWNER_ONLY_ADD) on Team and on the /page picker', async () => {
    const errs = await import('@/modules/organiser/shared/selfServeErrors');
    const { addErrorMessage } = await import('@/modules/organiser/team/teamErrors');
    const { addRefusalCopy } = await import('@/modules/organiser/edit-in-place/teamPickerModel');
    const one = (errs as Record<string, unknown>).OWNER_ONLY_ADD;
    expect(typeof one).toBe('string');
    const refusal = { message: 'owner_only', code: 'P0001' };
    expect([addErrorMessage(refusal, 'wall'), addErrorMessage(refusal, 'request'), addRefusalCopy(refusal)]).toEqual([one, one, one]);
  });
  it('the role help is ONE string (selfServeErrors ROLE_HELP) on Person and on the /page picker, with no review step', async () => {
    const errs = await import('@/modules/organiser/shared/selfServeErrors');
    const { ROLE_EXPLAINER } = await import('@/modules/organiser/team/Person');
    const { PICKER_COPY } = await import('@/modules/organiser/edit-in-place/teamPickerModel');
    const one = (errs as Record<string, unknown>).ROLE_HELP;
    expect(typeof one).toBe('string');
    expect([ROLE_EXPLAINER, PICKER_COPY.roleHelp]).toEqual([one, one]);
    expect(one).toMatch(/managers add people/i);
    expect(one).not.toMatch(/review/i);
  });
  it('team error copy says "page", never "organiser", and never tells a manager they can only leave (decisions 1, 2)', async () => {
    const { TEAM_COPY } = await import('@/modules/organiser/shared/selfServeErrors');
    const hits = Object.entries(TEAM_COPY).filter(([, v]) => /\borganiser\b/i.test(v) || /As a manager(?: or contributor)? you can (?:see the team and )?leave/.test(v));
    expect(hits).toEqual([]);
  });
  it('team screens say "page", never "organiser" or "Leave this team" (B-S3, B-S10); More owns "Leave this page"', () => {
    // JSX text that is really code (") : !organiser ? (") is not copy.
    const hits = inDirs(['team']).flatMap(({ file, src }) => copyOf(src).filter((s) => !/[!?]\s*\(|\)\s*:/.test(s) && /\borganiser\b|Leave this team/i.test(s)).map((s) => `${file}: ${s.trim()}`));
    expect(hits).toEqual([]);
    expect(readFileSync(join(ROOT, 'more/index.tsx'), 'utf8')).toContain('Leave this page');
  });
  it('every spinner in the module stops under reduced motion (B-N6)', () => {
    const hits = ALL.flatMap(({ file, src }) => [...src.matchAll(/className=["'`{][^>]*\banimate-spin\b[^>]*/g)].filter((m) => !/motion-reduce:animate-none/.test(m[0])).map(() => file));
    expect(hits).toEqual([]);
  });
  it('copy says Tap, never Press (B-N7)', () => {
    const hits = ALL.flatMap(({ file, src }) => copyOf(src).filter((s) => /\bPress\b/.test(s)).map((s) => `${file}: ${s.trim()}`));
    expect(hits).toEqual([]);
  });
  it('no non-test source in the module has raw Unicode punctuation outside comments (B-N8: \\u escapes or HTML entities)', () => {
    const hits = ALL.flatMap(({ file, src }) => (stripComments(src).match(/[\u2014\u2026\u2018\u2019\u201C\u201D]/g) ?? []).map((ch) => `${file}: U+${ch.codePointAt(0)?.toString(16).toUpperCase()}`));
    expect(hits).toEqual([]);
  });
});

describe('G2: one conflict view, one conflict detector, no raw punctuation on One event (A-S2, A-N1, B-N8)', () => {
  const code = (file: string) => stripComments(readFileSync(join(ROOT, file), 'utf8'));
  it('only flows/event/parts.tsx renders VERSION_CONFLICT as a view (EventConflict); no other *Conflict copy', () => {
    const views = ALL.filter(({ file }) => file.endsWith('.tsx')).filter(({ src }) => /\{VERSION_CONFLICT\}/.test(stripComments(src))).map(({ file }) => file);
    expect(views).toEqual(['flows/event/parts.tsx']);
    const copies = ALL.flatMap(({ file, src }) => [...stripComments(src).matchAll(/export function (\w*Conflict)\b/g)].map((m) => `${file}: ${m[1]}`));
    expect(copies).toEqual(['flows/event/parts.tsx: EventConflict']);
  });
  it('version_conflict is recognised in ONE place (selfServeErrors.isVersionConflict); no screen has its own regex', () => {
    const own = ALL.filter(({ file }) => file !== 'shared/selfServeErrors.ts')
      .filter(({ src }) => /\/\^?version_conflict\/i?\.test\(/.test(stripComments(src))).map(({ file }) => file);
    expect(own).toEqual([]);
    expect(code('flows/new/useNewSend.ts')).toMatch(/\bisVersionConflict\b/);
    expect(code('flows/fix/CoverFlow.tsx')).toMatch(/\bisVersionConflict\b/);
  });
  it('events/DatesTakenOff.tsx has no raw Unicode punctuation (B-N8)', () => {
    expect(readFileSync(join(ROOT, 'events/DatesTakenOff.tsx'), 'utf8').match(/[\u2014\u2026\u2018\u2019\u201C\u201D]/g) ?? []).toEqual([]);
  });
});

// =============================================================================
// programDayRollover.ts  (Website-side mirror of admin lib)
//
// DUPLICATED FROM: bachata-admin-11april/lib/programDayRollover.ts (Phase 1F).
// TODO (cross-repo cleanup): consolidate into a published @bachata/program-rollover
// workspace package once the monorepo lift lands. Until then, both copies MUST
// stay byte-for-byte identical for getDisplayDay logic. The CI script
// `scripts/check-day-rollover-consistency-v1.mjs` runs the canonical fixture
// set through THIS file's getDisplayDay and fails if any fixture drifts.
//
// Canonical day-rollover rule for the program editor and public render.
//
// Locked decision (admin workspace memory `project_program_editor_architecture_locked.md`):
// Sessions starting between 00:00 and 08:00 of "the day after" the event start
// belong to the PRIOR day's schedule (a late-night party that runs past midnight
// reads as part of the previous day for both grouping and sorting).
// =============================================================================

const DAY_MS = 24 * 60 * 60 * 1000;
const ROLLOVER_HOUR = 8; // sessions starting strictly before this hour roll back

/**
 * Parse an ISO timestamp ("YYYY-MM-DDTHH:MM[:SS][Z|+hh:mm]") into a UTC Date.
 *
 * Accepts the editor's tz-less "YYYY-MM-DDTHH:MM" form by treating it as
 * a wall-clock time at UTC. This matches how the rest of the editor reads
 * meta_data.program (extractHHMM does the same).
 */
function parseEventOrSessionIso(iso: string): Date {
    if (!iso) {
        return new Date(NaN);
    }
    // If the string already has a tz, Date handles it. Otherwise append Z so
    // we don't depend on the host's tz.
    const hasTz = /(Z|[+-]\d{2}:?\d{2})$/.test(iso);
    return new Date(hasTz ? iso : `${iso}Z`);
}

/**
 * Get the UTC midnight of a Date — used as the canonical "day" key.
 */
function utcMidnight(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Return the canonical display-day for a session within an event.
 *
 *   const day = getDisplayDay(session, event);
 *
 * If `session.start_time` lands between 00:00 and 08:00 (UTC, exclusive of
 * 08:00) on a date strictly after `event.start_time`'s date, the session
 * belongs to the PRIOR calendar day. Otherwise the session's own date is
 * returned.
 *
 * Returns a Date at UTC midnight of the resolved day. Returns an Invalid
 * Date when either input is unparseable.
 */
export function getDisplayDay(
    session: { start_time: string },
    event: { start_time: string }
): Date {
    const sessionDt = parseEventOrSessionIso(session.start_time);
    const eventDt   = parseEventOrSessionIso(event.start_time);
    if (Number.isNaN(sessionDt.getTime()) || Number.isNaN(eventDt.getTime())) {
        return new Date(NaN);
    }

    const sessionMid = utcMidnight(sessionDt);
    const eventMid   = utcMidnight(eventDt);

    // Only roll back when the session is on a calendar date strictly AFTER
    // the event start (so 19:00 on day-1 stays on day-1; only post-midnight
    // sessions fold back).
    if (sessionMid.getTime() > eventMid.getTime() && sessionDt.getUTCHours() < ROLLOVER_HOUR) {
        return new Date(sessionMid.getTime() - DAY_MS);
    }
    return sessionMid;
}

/**
 * Compare two sessions by their display day, then by their start time.
 */
export function compareSessionsByDisplayDayThenTime(
    a: { start_time: string },
    b: { start_time: string },
    event: { start_time: string }
): number {
    const dayA = getDisplayDay(a, event).getTime();
    const dayB = getDisplayDay(b, event).getTime();
    if (dayA !== dayB) return dayA - dayB;
    const ta = parseEventOrSessionIso(a.start_time).getTime();
    const tb = parseEventOrSessionIso(b.start_time).getTime();
    return ta - tb;
}

/**
 * Group an array of sessions into a Map keyed by display-day-midnight (epoch
 * ms), with sessions sorted by start_time within each group.
 */
export function groupSessionsByDisplayDay<T extends { start_time: string }>(
    sessions: T[],
    event: { start_time: string }
): Map<number, T[]> {
    const groups = new Map<number, T[]>();
    for (const s of sessions) {
        const key = getDisplayDay(s, event).getTime();
        if (Number.isNaN(key)) continue;
        const bucket = groups.get(key) ?? [];
        bucket.push(s);
        groups.set(key, bucket);
    }
    const ordered = new Map<number, T[]>();
    for (const k of [...groups.keys()].sort((a, b) => a - b)) {
        const arr = groups.get(k)!;
        arr.sort((a, b) => parseEventOrSessionIso(a.start_time).getTime()
                          - parseEventOrSessionIso(b.start_time).getTime());
        ordered.set(k, arr);
    }
    return ordered;
}

/**
 * Canonical fixture set. MUST match admin/lib/programDayRollover.ts byte-for-byte
 * (same labels, same expected days). The CI gate fails if either repo's util
 * disagrees with these expectations.
 */
export interface DayRolloverFixture {
    label: string;
    event: { start_time: string };
    session: { start_time: string };
    /** UTC midnight of the canonical display day, ISO format. */
    expectedDayIso: string;
}

export const DAY_ROLLOVER_FIXTURES: DayRolloverFixture[] = [
    {
        label: 'evening session same day',
        event:   { start_time: '2026-06-19T19:00:00Z' },
        session: { start_time: '2026-06-19T21:00:00Z' },
        expectedDayIso: '2026-06-19T00:00:00.000Z',
    },
    {
        label: 'late party past midnight folds back to prior day',
        event:   { start_time: '2026-06-19T19:00:00Z' },
        session: { start_time: '2026-06-20T02:30:00Z' },
        expectedDayIso: '2026-06-19T00:00:00.000Z',
    },
    {
        label: 'session at exactly 08:00 next day stays on next day',
        event:   { start_time: '2026-06-19T19:00:00Z' },
        session: { start_time: '2026-06-20T08:00:00Z' },
        expectedDayIso: '2026-06-20T00:00:00.000Z',
    },
    {
        label: 'session at 07:59 next day rolls back',
        event:   { start_time: '2026-06-19T19:00:00Z' },
        session: { start_time: '2026-06-20T07:59:00Z' },
        expectedDayIso: '2026-06-19T00:00:00.000Z',
    },
    {
        label: 'multi-day festival — day 2 evening',
        event:   { start_time: '2026-06-19T18:00:00Z' },
        session: { start_time: '2026-06-20T20:00:00Z' },
        expectedDayIso: '2026-06-20T00:00:00.000Z',
    },
    {
        label: 'multi-day festival — day 2 late party rolls back to day 2',
        event:   { start_time: '2026-06-19T18:00:00Z' },
        session: { start_time: '2026-06-21T03:00:00Z' },
        expectedDayIso: '2026-06-20T00:00:00.000Z',
    },
    {
        label: 'tz-less editor form (no Z) treated as UTC wall-clock',
        event:   { start_time: '2026-06-19T19:00' },
        session: { start_time: '2026-06-20T02:00' },
        expectedDayIso: '2026-06-19T00:00:00.000Z',
    },
    {
        label: 'midnight session (00:00 next day) rolls back',
        event:   { start_time: '2026-06-19T19:00:00Z' },
        session: { start_time: '2026-06-20T00:00:00Z' },
        expectedDayIso: '2026-06-19T00:00:00.000Z',
    },
];

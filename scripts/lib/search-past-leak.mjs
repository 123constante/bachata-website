/**
 * Pure helpers for the search_public_v5 upcoming-filter proof.
 *
 * Split out of check-search-public-v5.mjs so the predicate that decides
 * "this row breaks the upcoming filter" can be driven over fixtures by
 * tests/searchPastLeak.test.ts. The check itself is straight-line
 * top-level-await code against the live RPC; the live corpus cannot be
 * made to hold a leaked row on demand, and on 2026-09-04 it sat ONE row
 * either side of the truth (50 non-ended matches for "bachata" against
 * the RPC's own section cap of 50, with the single ended series as the
 * clipped 51st). A guard whose red flips on the corpus crossing a cap
 * can only be proven on fixtures.
 *
 * WHY THE is_ended SPLIT EXISTS. Arc P2 changed the contract deliberately:
 * search_public_v5 now EXEMPTS a series whose lifecycle_status is 'ended'
 * from `materialised_end_utc > now() - 6h`, anchors it on its LAST night
 * (necessarily in the past) and returns it with is_ended true, so the
 * public page can render a tombstone instead of the silence that used to
 * be indistinguishable from an organiser who had not listed next month.
 * A definitely-past row is therefore only a contract violation when it is
 * NOT flagged ended -- which is what these helpers separate.
 */

/**
 * Every event row search_public_v5 returns carries is_ended (the RPC builds
 * the section with to_jsonb() over a projection that selects it). Refuse a
 * payload that does not, rather than reading a missing key as "not ended":
 * that reading would be fail-closed today, but it would report a leaked
 * live event when the real defect was the flag going missing, and the
 * remediation those two want is not the same.
 */
export function assertEndedFlagPresent(events, label) {
  for (const ev of events) {
    if (typeof ev.is_ended !== 'boolean') {
      throw new Error(
        `${label}: event ${ev.id} (${ev.name}) carries no boolean is_ended ` +
          `(got ${JSON.stringify(ev.is_ended)}). search_public_v5 has returned ` +
          'is_ended on every event row since arc P2, and the upcoming-filter ' +
          'proof reads it to tell a deliberately surfaced ended series from a ' +
          'leaked live one. Without it the two are indistinguishable, so this ' +
          'refuses rather than guessing.',
      );
    }
  }
}

/**
 * Partition the DEFINITELY-past rows of an events payload.
 *
 *   leaked    -- past and NOT ended: the upcoming filter is not being applied.
 *   endedPast -- ended and surfaced anyway: past by timestamp, or carrying no
 *                anchor at all. Deliberate (arc P2), and the caller's 6c arm
 *                reads this list, so a row that belongs in it must not be
 *                dropped on the way.
 *
 * Rows at or after oldestAllowedStart are neither; they are simply upcoming
 * by the check's deliberately loose start-anchored proxy.
 */
export function partitionDefinitelyPast(events, oldestAllowedStart, label) {
  assertEndedFlagPresent(events, label);
  const leaked = [];
  const endedPast = [];
  for (const ev of events) {
    if (ev.start_time === null || ev.start_time === undefined) {
      // An ended series whose every remaining night was hand-cancelled has no
      // scheduled occurrence to anchor on, so the RPC surfaces it with
      // start_time null and is_ended true -- its own comment says so, and
      // calls it "the series whose name someone searches, getting exactly the
      // silence this phase is meant to end". It goes in endedPast rather than
      // being skipped: it is the row 6c most needs to round-trip, and skipping
      // it would exclude the highest-risk case from the only arm that proves
      // the exemption is not failing open. For a LIVE row a null start_time is
      // still a shape failure.
      if (ev.is_ended) {
        endedPast.push(ev);
        continue;
      }
      throw new Error(`${label}: event ${ev.id} (${ev.name}) has null start_time`);
    }
    const t = Date.parse(ev.start_time);
    if (Number.isNaN(t)) {
      throw new Error(
        `${label}: event ${ev.id} (${ev.name}) has unparseable start_time ${ev.start_time}`,
      );
    }
    if (t >= oldestAllowedStart) continue;
    (ev.is_ended ? endedPast : leaked).push(ev);
  }
  return { leaked, endedPast };
}

/**
 * Verdict for the ended-series round trip (check test 6c): a row the default
 * view surfaced as ended is searched again by its own name, and must come back
 * still flagged.
 *
 *   'ok'        -- came back flagged. The arc P2 promise holds.
 *   'unflagged' -- came back UNflagged: the same row is then an ordinary
 *                  past-event leak, and 6b's exemption was granted on a flag
 *                  the RPC no longer sets.
 *   'clipped'   -- absent, but the section came back FULL. An ended row sorts
 *                  behind every live match, so absence from a full section
 *                  cannot be told from the cap clipping it. Unproven, not
 *                  broken -- reporting it as broken would red the guard for a
 *                  series whose name is merely popular.
 *   'silent'    -- absent with room to spare, so nothing was clipped. This is
 *                  the silence arc P2 exists to end.
 *
 * Split out of the check so all four verdicts are drivable; the check itself
 * is top-level-await code against the live RPC, where 'clipped' and 'silent'
 * cannot be produced on demand.
 */
export function classifyEndedRoundTrip({ echoed, sectionLength, probeLimit }) {
  if (echoed) return echoed.is_ended === true ? 'ok' : 'unflagged';
  return sectionLength >= probeLimit ? 'clipped' : 'silent';
}

/** Compact "id (name) @ start" list for an error message. */
export function describeEvents(rows, max = 3) {
  return rows
    .slice(0, max)
    .map((e) => `${e.id} (${e.name}) @ ${e.start_time}`)
    .join('; ');
}

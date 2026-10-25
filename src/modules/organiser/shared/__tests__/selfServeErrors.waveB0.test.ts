/**
 * Wave B0: the stable refusal codes admin waves A1-A3 added (er-p4-a1-lockdown,
 * er-p4-a2-series-owner, er-p4-a3-occurrence-owner handovers) and the move_date
 * refusals each get ONE plain sentence. The messages are the server's own text
 * (admin migrations 20261220010000, 20261224080000, 20261226020000 and prod
 * _cmd_occurrence_move_date_p5), detail included, as PostgREST returns them.
 * Written against the unfixed map first: every row fell through to a catch-all.
 */
import { describe, expect, it } from 'vitest';
import { commandErrorMessage } from '../selfServeErrors';

const ROWS: Array<[string, string, RegExp]> = [
  // A1
  ['city_follows_venue (series)', 'permission_denied: city_follows_venue: series.upsert default_city_id must be the stored city or the city of the venue', /city comes from the venue/],
  ['city_follows_venue (date)', 'permission_denied: city_follows_venue: occurrence.set_override city_id must be blank or the city of the date\'s venue', /city comes from the venue/],
  ['city_follows_venue (this and later)', 'permission_denied: city_follows_venue: series.apply_forward_from city_id is sent only with venue_id', /city comes from the venue/],
  ['slug_admin_only', 'permission_denied: slug_admin_only: series.upsert slug is admin-only', /web address/],
  ['category_admin_only', 'permission_denied: category_admin_only: series.upsert category is admin-only', /kind of event cannot be set here/],
  // A2
  ['forward_from_past', 'permission_denied: forward_from_past: series.apply_forward_from from_date must be today or later', /start today or later/],
  ['format_festival_admin_only', 'permission_denied: format_festival_admin_only: a change to or from a festival is made by an admin', /festival/],
  ['format_needs_collapse', 'permission_denied: format_needs_collapse: a repeating event or course becomes a one-off through series.collapse_to_one_off (it keeps one date and cancels the rest)', /cannot become one date here/],
  ['format_course_needs_rule', 'permission_denied: format_course_needs_rule: a live or paused course needs a repeat rule first', /course needs its repeat pattern/],
  ['course_total_needs_course', 'permission_denied: course_total_needs_course: course_total_sessions is for a course', /only for a course/],
  ['collapse_needs_repeating', 'permission_denied: collapse_needs_repeating: series.collapse_to_one_off needs a recurring or course series', /already has one date/],
  ['collapse_survivor_past', 'permission_denied: collapse_survivor_past: the date kept must be today or later', /date you keep/],
  ['ended series', 'permission_denied: series.apply_forward_from on an ended series is admin-only', /has ended/],
  ['group chat link', 'permission_denied: series.set_group_chat url must be blank or an https link', /group chat link/],
  // A3
  ['occurrence_cancelled', 'permission_denied: occurrence_cancelled: occurrence.set_override title, music_styles, gallery and passes on a cancelled date are admin-only', /date is cancelled/],
  ['date title', 'permission_denied: occurrence.set_override title must be null or 1 to 80 characters', /up to 80 characters/],
  ['date title type', 'permission_denied: occurrence.set_override title must be a string or null', /up to 80 characters/],
  ['date music', 'permission_denied: occurrence.set_override music_styles must be null or at most 20 non-blank strings of at most 40 characters', /20 music styles/],
  ['date gallery', 'permission_denied: occurrence.set_override gallery must be null or at most 30 http(s) image URLs', /30 photos/],
  ['date prices', 'permission_denied: occurrence.set_override passes must be an array of prices', /Check the prices/],
  ['date price id', 'permission_denied: occurrence.set_override passes entry id must be a uuid', /Check the prices/],
  // move_date (the wave B0 callers)
  ['date_taken', 'invalid_transition: date_taken: this event already has a date on 2026-10-24', /already has a date on that day/],
  ['move a date that is not on', 'invalid_transition: move_date needs a scheduled date (this one is cancelled)', /cannot be moved/],
  ['move a festival day', 'invalid_payload: move_date is not supported for festivals', /Festival days/],
  ['move with no day', 'invalid_payload: to_date required (YYYY-MM-DD)', /^Choose a date\.$/],
];

const CATCH_ALLS = [
  'You cannot make that change here. Ask the Bachata Calendar team.',
  'Something went wrong. Please try again.',
];

describe('wave B0 refusal codes: one friendly sentence each', () => {
  it.each(ROWS)('%s', (_label, message, expected) => {
    const copy = commandErrorMessage({ code: 'P0001', message });
    expect(copy).toMatch(expected);
    expect(CATCH_ALLS).not.toContain(copy);
    // No raw code or server key ever reaches the screen.
    expect(copy).not.toMatch(/[a-z]+_[a-z_]+|permission_denied|invalid_|occurrence\.|series\./);
    // Never a dead end: every line says what to do next, or why nothing is needed.
    expect(copy).toMatch(/Ask|Check|Pick|Choose|Enter|Add|Give|Leave|Put|Reload|leave it empty|nothing to/);
  });

  it('the earlier rules still win where they did (past date, version conflict)', () => {
    expect(commandErrorMessage({ code: 'P0001', message: 'permission_denied: occurrence.set_override on a past date is admin-only' })).toMatch(/already happened/);
    expect(commandErrorMessage({ code: 'P0001', message: 'version_conflict: expected 3 got 4' })).not.toMatch(/city|cancelled/);
  });
});

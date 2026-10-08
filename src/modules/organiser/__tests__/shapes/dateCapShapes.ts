// The 30-date cap shapes (2026-10-08 read-only prod survey, counts only). Of the
// 54 series with a rule: 18 under 30 upcoming scheduled dates, NONE at exactly
// 30, 36 over 30 (34..60, open-ended rules, set before the cap); 1 draft over cap
// (the owner's 'ZZ TEST DELETE ME': weekly Wednesdays from Wed 30 Dec, 41 dates).
// Live one_offs with their one date next year: 3. Names are made up.
import { run, shape, weekly, type SeriesShape } from './shapes';

/** Wed 30 Dec 2026. */
const DEC30 = '2026-12-30';
/** Wed 14 Oct 2026, the next Wednesday after TODAY. */
const NEXT_WED = '2026-10-14';

export const CAP_SHAPES: SeriesShape[] = [
  shape({
    key: 'cap-draft-over-dec', about: 'draft / weekly Wed, end none / 41 upcoming from Wed 30 Dec (owner case)',
    lifecycle: 'draft', format: 'recurring', rule: weekly(3), startDate: DEC30, dates: run('cap-draft-over-dec', DEC30, 41),
  }),
  shape({
    key: 'cap-live-at', about: 'live / weekly Wed, end none / exactly 30 upcoming',
    lifecycle: 'live', format: 'recurring', rule: weekly(3), startDate: NEXT_WED, dates: run('cap-live-at', NEXT_WED, 30),
  }),
  shape({
    key: 'cap-live-under-open', about: 'live / weekly Wed, end none / 20 upcoming running into next year',
    lifecycle: 'live', format: 'recurring', rule: weekly(3), startDate: NEXT_WED, dates: run('cap-live-under-open', NEXT_WED, 20),
  }),
  shape({
    key: 'cap-live-cancelled', about: 'live / weekly Wed, end none / 32 upcoming, 3 cancelled (29 count toward the cap)',
    lifecycle: 'live', format: 'recurring', rule: weekly(3), startDate: NEXT_WED,
    dates: run('cap-live-cancelled', NEXT_WED, 32, 7, (i) => i === 1 || i === 5 || i === 9),
  }),
  shape({
    key: 'cap-draft-zero', about: 'draft / weekly Wed, end none / 0 dates',
    lifecycle: 'draft', format: 'recurring', rule: weekly(3), startDate: NEXT_WED, dates: [],
  }),
  shape({
    key: 'cap-live-one', about: 'live / weekly Wed, until the start / 1 date',
    lifecycle: 'live', format: 'recurring', rule: weekly(3, { kind: 'until_date', date: NEXT_WED }), startDate: NEXT_WED,
    dates: run('cap-live-one', NEXT_WED, 1),
  }),
  shape({
    key: 'cap-oneoff-next-year', about: 'live / one_off / its one date next year',
    lifecycle: 'live', format: 'one_off', dates: [{ id: 'cap-oneoff-next-year-1', date: '2027-01-15', status: 'scheduled' }],
  }),
  shape({
    key: 'cap-live-bound', about: 'live / weekly Wed, until 11 months ahead / 15 upcoming (the 12-month bound stops Extend)',
    lifecycle: 'live', format: 'recurring', rule: weekly(3, { kind: 'until_date', date: '2027-10-06' }), startDate: '2027-06-30',
    dates: run('cap-live-bound', '2027-06-30', 15),
  }),
];

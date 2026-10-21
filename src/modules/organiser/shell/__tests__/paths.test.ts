import { describe, expect, it } from 'vitest';
import { ORG_BASE, ORG_PATHS } from '../paths';

// The pinned table (plan 4.1 as amended by D44, 4.3 #2). Ids are encoded, so a
// test id with a space and a slash proves encodeURIComponent on every argument.
const S = 's 1';
const O = 'o/1';
const U = 'u 1';
const DAY = 'day 1';

function evaluate(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(ORG_PATHS)) {
    if (typeof value === 'string') out[key] = value;
    else if (key === 'newName') out[key] = (value as (f: string) => string)('recurring');
    else if (key === 'changeDetail') out[key] = (value as (a: string, b: string, f: string) => string)(S, O, 'note');
    else if (key === 'addDate') out[key] = (value as (a: string, b: string) => string)(S, DAY);
    else if (key === 'teamPerson' || key === 'handoverTo' || key === 'teamAddFor') out[key] = (value as (a: string) => string)(U);
    else out[key] = (value as (a: string, b: string) => string)(S, O);
  }
  return out;
}

describe('ORG_PATHS (v2)', () => {
  it('is the pinned table', () => {
    expect(ORG_BASE).toBe('/account/o');
    expect(evaluate()).toEqual({
      home: '/account/o',
      switch: '/account/o/switch',
      welcome: '/account/o/welcome?o=s%201',
      change: '/account/o/change',
      changeEvent: '/account/o/change/s%201',
      changeDate: '/account/o/change/s%201/o%2F1',
      changeTime: '/account/o/change/s%201/o%2F1/time',
      changeVenue: '/account/o/change/s%201/o%2F1/venue',
      dateLineup: '/account/o/change/s%201/o%2F1/lineup',
      changeDetail: '/account/o/change/s%201/o%2F1/note',
      changeOff: '/account/o/change/s%201/o%2F1/off',
      changeCopy: '/account/o/change/s%201/o%2F1/copy',
      changePick: '/account/o/change/s%201/pick',
      add: '/account/o/add',
      addEvent: '/account/o/add/s%201',
      addDate: '/account/o/add/s%201/day%201',
      cancel: '/account/o/cancel',
      cancelEvent: '/account/o/cancel/s%201',
      cancelDate: '/account/o/cancel/s%201/o%2F1',
      newWhat: '/account/o/new/what',
      newWhatFor: '/account/o/new/what?o=s%201',
      newName: '/account/o/new/name?format=recurring',
      newVenue: '/account/o/new/s%201/venue',
      newDate: '/account/o/new/s%201/date',
      newTime: '/account/o/new/s%201/time',
      newCover: '/account/o/new/s%201/cover',
      events: '/account/o/events',
      event: '/account/o/events/s%201',
      eventDetails: '/account/o/events/s%201/details',
      eventProgramme: '/account/o/events/s%201/programme',
      eventOrganisers: '/account/o/events/s%201/organisers',
      team: '/account/o/team',
      teamAdd: '/account/o/team/add',
      teamAddFor: '/account/o/team/add?q=u%201',
      teamPerson: '/account/o/team/u%201',
      handover: '/account/o/handover',
      handoverTo: '/account/o/handover/u%201',
      page: '/account/o/page',
      more: '/account/o/more',
      help: '/account/o/more/help',
      cover: '/account/o/cover/s%201',
      done: '/account/o/done',
      // Deprecated: main's keys on main's URLs, each redirected (replace) to the
      // R1 path by OrganiserRoutes (legacy.test.tsx proves the landing).
      newEvent: '/account/o/events/new',
      date: '/account/o/events/s%201/dates/o%2F1',
    });
  });

  it('every entry is a string or a function of ids, under ORG_BASE', () => {
    for (const value of Object.values(ORG_PATHS)) expect(['string', 'function']).toContain(typeof value);
    for (const path of Object.values(evaluate())) expect(path.startsWith(ORG_BASE)).toBe(true);
  });

  it('newWhatFor without a page is the bare New event path (A-N8: one page needs no ?o=)', () => {
    expect(ORG_PATHS.newWhatFor(null)).toBe(ORG_PATHS.newWhat);
    expect(ORG_PATHS.newWhatFor(undefined)).toBe(ORG_PATHS.newWhat);
  });

  it('newName carries the format in the query, one_off too', () => {
    expect(ORG_PATHS.newName('one_off')).toBe('/account/o/new/name?format=one_off');
  });
});

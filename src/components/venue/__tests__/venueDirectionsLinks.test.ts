import { describe, it, expect } from 'vitest';
import {
  buildDirectionLinks,
  directionsDestination,
} from '../venueDirectionsLinks';

const HOTEL = 'Holiday Inn Birmingham M6';
const ADDR = 'Chapel Lane, Great Barr, B43 7BG, GB';

describe('directionsDestination', () => {
  const cases: [string, string, string][] = [
    [HOTEL, ADDR, `${HOTEL}, ${ADDR}`],
    [HOTEL, HOTEL, HOTEL], // sheet falls back to the name when there is no address
    [HOTEL, '', HOTEL],
    ['', ADDR, ADDR],
    [HOTEL, `${HOTEL}, ${ADDR}`, `${HOTEL}, ${ADDR}`], // no doubled name
  ];
  it.each(cases)('%s + %s', (name, address, want) => {
    expect(directionsDestination(name, address)).toBe(want);
  });
});

describe('buildDirectionLinks', () => {
  it('puts the venue name in every address-based link', () => {
    const links = buildDirectionLinks({ name: HOTEL, address: ADDR });
    expect(links.map((l) => l.key)).toEqual([
      'google',
      'apple',
      'citymapper',
      'uber',
    ]);
    for (const l of links) expect(decodeURIComponent(l.url)).toContain(HOTEL);
  });

  const hrefCases: [string | null | undefined, boolean][] = [
    ['https://maps.app.goo.gl/abc', true],
    ['  https://www.google.com/maps/place/x ', true],
    [null, false],
    [undefined, false],
    ['', false],
    ['javascript:alert(1)', false],
  ];
  it.each(hrefCases)('saved link %s used=%s', (href, used) => {
    const google = buildDirectionLinks({
      name: HOTEL,
      address: ADDR,
      googleMapsHref: href,
    })[0];
    if (used) expect(google.url).toBe((href as string).trim());
    else expect(google.url).toContain('maps/dir/?api=1&destination=');
  });

  it('keeps the saved link on Google only', () => {
    const [, apple] = buildDirectionLinks({
      name: HOTEL,
      address: ADDR,
      googleMapsHref: 'https://maps.app.goo.gl/abc',
    });
    expect(apple.url).toContain('maps.apple.com');
  });
});

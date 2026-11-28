import { describe, expect, it } from 'vitest';
import { formatVenueAddress } from '../formatVenueAddress';

const cases: Array<[string, Parameters<typeof formatVenueAddress>[0], string | null]> = [
  ['Magdalen Hall', { address: 'Purbrook St', postcode: 'SE1 3DQ', cityName: 'London' }, 'Purbrook St, London SE1 3DQ'],
  ['Hackney Showroom', { address: '4 Murrain Rd, Finsbury Park', postcode: 'N4 2BN', cityName: 'London' }, '4 Murrain Rd, Finsbury Park, London N4 2BN'],
  ['The Table Battersea (field postcode wins)', { address: '35-37 Battersea Rise, London SW11 1HG', postcode: 'SW11 1EE', cityName: 'London' }, '35-37 Battersea Rise, London SW11 1EE'],
  ['Cocktail Club', { address: '9 Cabot Sq, Canary Wharf Estate', postcode: 'E14 4QS', cityName: 'London' }, '9 Cabot Sq, Canary Wharf Estate, London E14 4QS'],
  ['no address', { address: null, postcode: 'SE1 3DQ', cityName: 'London' }, 'London SE1 3DQ'],
  ['no postcode', { address: 'Purbrook St', postcode: null, cityName: 'London' }, 'Purbrook St, London'],
  ['lowercase postcode', { address: 'Purbrook St', postcode: 'se13dq', cityName: 'London' }, 'Purbrook St, London SE1 3DQ'],
  ['Spain, no postcode', { address: 'Calle Mayor 5', postcode: null, cityName: 'Madrid' }, 'Calle Mayor 5, Madrid'],
  ['no city', { address: 'Purbrook St', postcode: 'SE1 3DQ', cityName: null }, 'Purbrook St, SE1 3DQ'],
  ['all empty', { address: ' ', postcode: '', cityName: undefined }, null],
];

describe('formatVenueAddress', () => {
  it.each(cases)('%s', (_n, input, expected) => {
    expect(formatVenueAddress(input)).toBe(expected);
  });
});

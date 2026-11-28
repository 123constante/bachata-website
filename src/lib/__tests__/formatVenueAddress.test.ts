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
  ['postcode only in address is lifted', { address: '35-37 Battersea Rise, London SW11 1HG', postcode: null, cityName: 'London' }, '35-37 Battersea Rise, London SW11 1HG'],
  ['address is only a postcode', { address: 'sw11 1hg', postcode: null, cityName: 'London' }, 'London SW11 1HG'],
  ['city inside a street name stays', { address: 'Calle de Madrid', postcode: null, cityName: 'Madrid' }, 'Calle de Madrid, Madrid'],
  ['address equal to city', { address: 'Madrid', postcode: null, cityName: 'Madrid' }, 'Madrid'],
  ['repeat strip postcode then city', { address: 'x, SW11 1HG, London', postcode: 'SW11 1EE', cityName: 'London' }, 'x, London SW11 1EE'],
  ['trailing commas and spaces', { address: '  Purbrook St ,, ', postcode: 'SE1 3DQ', cityName: 'London' }, 'Purbrook St, London SE1 3DQ'],
  ['lowercase postcode inside address', { address: 'Purbrook St, se1 3dq', postcode: null, cityName: null }, 'Purbrook St, SE1 3DQ'],
  ['Barcelona trailing country', { address: 'Carrer del Pla de la Torre, 14, 08398 Santa Susanna, Barcelona, Spain', postcode: null, cityName: 'Barcelona', country: 'Spain' }, 'Carrer del Pla de la Torre, 14, 08398 Santa Susanna, Barcelona'],
  ['Istanbul trailing Turkiye', { address: 'Yenibosna Merkez, Bah\u00e7elievler/\u0130stanbul, T\u00fcrkiye', postcode: '34295', cityName: 'Istanbul', country: 'TR' }, 'Yenibosna Merkez, Bah\u00e7elievler/\u0130stanbul, Istanbul 34295'],
  ['Mallorca trailing country, city mid-address', { address: 'Playa de Muro, Illes Balears, Palma De Mallorca, Spain', postcode: '07458', cityName: 'Palma de Mallorca', country: 'ES' }, 'Playa de Muro, Illes Balears, Palma de Mallorca 07458'],
  ['Budapest no country in address', { address: 'The Aquincum Hotel Budapest', postcode: '1036', cityName: 'Budapest', country: 'HU' }, 'The Aquincum Hotel Budapest, Budapest 1036'],
  ['Tunis own country value', { address: 'Les Cotes de Carthage, BP 720, Tunisia', postcode: '2070', cityName: 'Tunis', country: 'Tunisia' }, 'Les Cotes de Carthage, BP 720, Tunis 2070'],
  ['city mid-address not appended', { address: 'Calle 1, Madrid, Centro', postcode: null, cityName: 'Madrid' }, 'Calle 1, Madrid, Centro'],
  ['all empty', { address: ' ', postcode: '', cityName: undefined }, null],
];

describe('formatVenueAddress', () => {
  it.each(cases)('%s', (_n, input, expected) => {
    expect(formatVenueAddress(input)).toBe(expected);
  });
});

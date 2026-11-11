import { describe, expect, it } from 'vitest';
import { seriesCityLabel, upcomingWording, venueCityLine } from '../nightsCardModel';

describe('city + cap wording (one shared mapping)', () => {
  it('venueCityLine', () => {
    expect(venueCityLine('Soho', 'Leeds')).toBe('Soho, Leeds');
    expect(venueCityLine(null, 'Leeds')).toBe('Leeds');
    expect(venueCityLine('Soho', null)).toBe('Soho');
    expect(venueCityLine(' ', undefined)).toBeNull();
  });
  it('seriesCityLabel', () => {
    expect(seriesCityLabel(['Leeds', 'Leeds'])).toBe('Leeds');
    expect(seriesCityLabel(['Leeds', 'York', 'Leeds'])).toBe('Leeds +1 city');
    expect(seriesCityLabel(['Leeds', 'York', 'Hull'])).toBe('Leeds +2 cities');
    expect(seriesCityLabel([null])).toBeNull();
  });
  it('upcomingWording', () => {
    expect(upcomingWording(13, 1)).toMatchObject({ capped: false, headingCount: '13 dates', capLine: null, seriesTag: null, showMoreLabel: 'Show all 13 dates' });
    expect(upcomingWording(1, 1).headingCount).toBe('1 date');
    expect(upcomingWording(20, 1)).toMatchObject({ capped: true, headingCount: null, seriesTag: 'next 20 dates', showMoreLabel: 'Show more nights', capLine: 'Showing the next 20 nights' });
    expect(upcomingWording(20, 5).seriesTag).toBeNull();
  });
});

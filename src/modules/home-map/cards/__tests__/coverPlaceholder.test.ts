import { describe, expect, it } from 'vitest';
import { isSitePlaceholderCover } from '../coverPlaceholder';

describe('isSitePlaceholderCover', () => {
  it('flags the site banner on the apex and www hosts', () => {
    expect(isSitePlaceholderCover('https://bachatacalendar.co.uk/og-image.jpg')).toBe(true);
    expect(isSitePlaceholderCover('https://www.bachatacalendar.co.uk/og-image.jpg')).toBe(true);
  });
  it('keeps real posters', () => {
    expect(isSitePlaceholderCover('https://media.bachatacalendar.co.uk/events/a.jpg')).toBe(false);
    expect(isSitePlaceholderCover('https://x.r2.dev/og-image.jpg')).toBe(false);
  });
  it('handles empty values', () => {
    expect(isSitePlaceholderCover(null)).toBe(false);
    expect(isSitePlaceholderCover('')).toBe(false);
  });
});

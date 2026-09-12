import { describe, expect, it } from 'vitest';
import { buildSeoForRoute } from '../src/lib/seo/buildSeoForRoute';

describe('buildSeoForRoute noindex policy', () => {
  it('noindexes search and practice-partner utility routes', () => {
    expect(buildSeoForRoute('search').noindex).toBe(true);
    expect(buildSeoForRoute('practicePartners').noindex).toBe(true);
    expect(buildSeoForRoute('allProfiles').noindex).toBe(true);
  });

  it('keeps resolved public detail pages indexable', () => {
    expect(buildSeoForRoute('dancer.detail', { entityName: 'Alex' }).noindex).toBe(false);
  });

  it('uses the active city in the discounts metadata', () => {
    const seo = buildSeoForRoute('discounts', { cityDisplay: 'Manchester' });
    expect(seo.title).toContain('Manchester');
    expect(seo.description).toContain('Manchester');
  });

  it('noindexes unresolved public detail pages', () => {
    expect(buildSeoForRoute('dancer.detail').noindex).toBe(true);
  });

  it('emits og:type=profile for dancer, dj and organiser detail pages', () => {
    expect(buildSeoForRoute('dancer.detail', { entityName: 'Alex' }).ogType).toBe('profile');
    expect(buildSeoForRoute('dj.detail', { entityName: 'DJ Alex' }).ogType).toBe('profile');
    expect(buildSeoForRoute('organiser.detail', { entityName: 'Org' }).ogType).toBe('profile');
  });
});

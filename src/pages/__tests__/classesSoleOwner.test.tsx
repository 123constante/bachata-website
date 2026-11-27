// @vitest-environment jsdom
// SEO option C (owner 2026-11-27): /classes is the ONE page that targets
// "bachata classes London". Homepage and /learn-bachata-london link to it with
// that exact anchor text, and neither claims the phrase in its own title/h1.
// /learn stays aimed at beginners. Keep-list for both linking pages.
import type { ReactNode } from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const learnMerged = vi.hoisted(() => ({ value: false }));
vi.mock('@/lib/seoLandingEvents', () => ({
  SEO_LANDING_WINDOWS: { guide: 7, learn: 28, weekday: 28 },
  useSeoLandingEvents: () => ({ data: [] }),
}));
vi.mock('@/lib/listImpressions', () => ({ useListImpressions: () => () => () => {} }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-11-27' }));
vi.mock('@/lib/featureFlags', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/featureFlags')>();
  return {
    ...mod,
    flags: new Proxy(mod.flags, {
      get: (t, k) => (k === 'learnMerged' ? learnMerged.value : Reflect.get(t, k)),
    }),
  };
});
vi.mock('@/pages/seo/BachataInLondon', () => ({ GuideSections: () => <div data-testid="guide" /> }));
vi.mock('@/pages/seo/Faq', () => ({ FAQS: [] }));
vi.mock('@/components/layout/GlobalLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import LearnBachataLondon, { SEO_INPUT } from '../seo/LearnBachataLondon';
import { FooterLinks } from '@/lib/contactLinks';
import { buildSeoForRoute } from '@/lib/seo/buildSeoForRoute';

const classesLinks = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('a[href="/classes"]')).map((a) => a.textContent);

afterEach(cleanup);

describe('/learn-bachata-london points at /classes for "bachata classes London"', () => {
  for (const merged of [false, true]) {
    it(`every /classes link uses the exact anchor (learnMerged=${merged})`, () => {
      learnMerged.value = merged;
      const { container } = render(
        <MemoryRouter>
          <LearnBachataLondon serverTodayKey="2026-11-27" />
        </MemoryRouter>,
      );
      // empty-state line + the note under the list + "Where to go next"
      expect(classesLinks(container)).toEqual([
        'bachata classes in London',
        'bachata classes in London',
        'bachata classes in London',
      ]);
      expect(container.textContent).not.toContain('Classes page');
      // Beginner-aimed heading, not the /classes phrase.
      const h1 = container.querySelector('h1')?.textContent ?? '';
      expect(h1).toContain('Beginner');
      expect(h1.toLowerCase()).not.toContain('bachata classes');
    });
  }

  it('title stays beginner-aimed', () => {
    expect(SEO_INPUT.title).toContain('Beginner');
    expect(SEO_INPUT.title.toLowerCase()).not.toContain('bachata classes');
  });
});

describe('homepage points at /classes for "bachata classes London"', () => {
  it('footer links block (rendered on the home feed) carries the exact anchor', () => {
    const { container } = render(
      <MemoryRouter>
        <FooterLinks label="Explore bachata in London" />
      </MemoryRouter>,
    );
    expect(classesLinks(container)).toEqual(['Bachata classes in London']);
  });

  it('home title does not duplicate the /classes title', () => {
    const ctx = { cityDisplay: 'London' };
    expect(buildSeoForRoute('home', ctx).title).not.toBe(buildSeoForRoute('classes', ctx).title);
    expect(buildSeoForRoute('classes', ctx).title).toBe('Bachata Classes in London');
  });
});

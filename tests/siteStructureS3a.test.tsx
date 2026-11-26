// @vitest-environment jsdom
// Site structure S3a: /learn-bachata-london absorbs the London Guide + FAQ behind flags.learnMerged.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const flagState = vi.hoisted(() => ({ learnMerged: true }));

vi.mock('@/lib/featureFlags', () => ({ flags: flagState }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/seo/LiveEventsSection', () => ({
  default: ({ heading }: { heading: string }) => <section><h2>{heading}</h2></section>,
}));

import LearnBachataLondon from '@/pages/seo/LearnBachataLondon';
import { FAQS } from '@/pages/seo/Faq';

const renderPage = () =>
  render(
    <MemoryRouter>
      <LearnBachataLondon />
    </MemoryRouter>,
  );

// Visible text only: the JSON-LD <script> legitimately repeats every question.
const visibleText = (el: HTMLElement) => {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('script').forEach((n) => n.remove());
  return clone.textContent ?? '';
};

const count = (hay: string, needle: string) => hay.split(needle).length - 1;

afterEach(cleanup);

describe('LearnBachataLondon, learnMerged ON', () => {
  it('shows every FAQ question exactly once', () => {
    flagState.learnMerged = true;
    const { container } = renderPage();
    const text = visibleText(container);
    for (const { q } of FAQS) expect(count(text, q), q).toBe(1);
  });

  it('has no duplicate h2/h3 text', () => {
    flagState.learnMerged = true;
    const { container } = renderPage();
    const heads = Array.from(container.querySelectorAll('h2, h3')).map((h) => h.textContent?.trim());
    expect(new Set(heads).size).toBe(heads.length);
  });

  it('emits exactly one FAQPage JSON-LD covering FAQS', () => {
    flagState.learnMerged = true;
    const { container } = renderPage();
    const faq = Array.from(container.querySelectorAll('script[type="application/ld+json"]'))
      .map((s) => s.textContent ?? '')
      .filter((t) => t.includes('"FAQPage"'));
    expect(faq).toHaveLength(1);
    expect(JSON.parse(faq[0]).mainEntity).toHaveLength(FAQS.length);
  });

  it('"Where to go next" no longer links to /faq or /london-bachata-guide', () => {
    flagState.learnMerged = true;
    const { container } = renderPage();
    const h = Array.from(container.querySelectorAll('h2')).find((x) => x.textContent === 'Where to go next');
    const section = h?.closest('section');
    expect(section).toBeTruthy();
    expect(section!.querySelector('a[href="/faq"]')).toBeNull();
    expect(section!.querySelector('a[href="/london-bachata-guide"]')).toBeNull();
    expect(section!.querySelector('a[href="/classes"]')).not.toBeNull();
    expect(section!.querySelector('a[href="/tonight"]')).not.toBeNull();
  });

  it('drops the duplicate question', () => {
    flagState.learnMerged = true;
    const { container } = renderPage();
    expect(visibleText(container)).not.toContain('Is bachata hard to learn?');
  });

  it('shows one live events list (the beginner classes one), not the guide week list too', () => {
    flagState.learnMerged = true;
    const { container } = renderPage();
    const text = visibleText(container);
    expect(text).toContain('Beginner classes this month');
    expect(text).not.toContain('Bachata events in London this week');
  });
});

describe('LearnBachataLondon, learnMerged OFF', () => {
  it('still renders the old beginner FAQ block', () => {
    flagState.learnMerged = false;
    const { container } = renderPage();
    expect(container.textContent).toContain('Common questions from beginners');
  });
});

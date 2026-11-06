// @vitest-environment jsdom
/**
 * Live QA 2026-11-05: the /city tabs measured 88x43.6 on a phone. Their
 * ::before lift (-10px top and bottom) assumed a 24px button, but the button
 * height came from rem padding + text-xs line-height, and the phone root font
 * is ~13.5px, so it rendered ~23.6px. The 44px tap area has to be built from
 * px only: an explicit px min-height plus the px ::before lift.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TabBar } from '../cards/controls';

afterEach(cleanup);

const px = (cls: string, re: RegExp): number | null => {
  const m = cls.match(re);
  return m ? Number(m[1]) : null;
};

describe('TabBar tap area', () => {
  it('every tab reaches 44px in px units alone (min-height + ::before lift), whatever the root font size', () => {
    render(<TabBar tab="all" setTab={() => {}} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBeGreaterThan(0);
    for (const t of tabs) {
      const minH = px(t.className, /(?:^|\s)min-h-\[(\d+)px\]/);
      const lift = px(t.className, /(?:^|\s)before:-inset-y-\[(\d+)px\]/);
      expect(minH, `${t.textContent}: explicit px min-height`).not.toBeNull();
      expect(lift, `${t.textContent}: px ::before lift`).not.toBeNull();
      expect((minH ?? 0) + 2 * (lift ?? 0), `${t.textContent}: tap height`).toBeGreaterThanOrEqual(44);
    }
  });
});

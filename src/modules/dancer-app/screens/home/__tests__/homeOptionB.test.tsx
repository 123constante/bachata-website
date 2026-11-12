// @vitest-environment jsdom
/**
 * Dancer Home, Option B (queue-website#1534): every shape x going state x what Home shows.
 * Pins: one focus card, profile step before night before find-events, positive-only counts,
 * Share disabled with a reason until the four steps are done, every state has an action.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, render, screen } from '@testing-library/react';
import { DANCER_SHAPES, DANCER_SHAPE_NAMES } from '../../../api/fixtures';
import type { MyDancerEdit } from '../../../api/types';
import { homeBView, SHARE_INCOMPLETE_REASON } from '../homeFocus';
import { HomeBError, HomeBLoading, HomeBView } from '../homeOptionB';
import { HIDDEN_SHARE_REASON } from '../../options/optionsModel';
import type { HeroNight } from '../homeParts';

afterEach(cleanup);

const NIGHT: HeroNight = { name: 'Bachata Sensual Social', inDays: 'in 2 days', place: 'The Loft, London', tag: 'Going', href: '/event/x' };
const shell = (ui: React.ReactElement) => <MemoryRouter>{ui}</MemoryRouter>;
const profiles = DANCER_SHAPE_NAMES.flatMap((n) => {
  const p = (DANCER_SHAPES[n] as { profile: MyDancerEdit | null }).profile;
  return p ? [[n, p] as const] : [];
});

describe('homeBView: pure mapping', () => {
  for (const [name, p] of profiles) {
    for (const went of [null, 0, 12]) {
      for (const night of [null, NIGHT]) {
        it(`${name}, went=${went}, night=${night ? 'yes' : 'no'}`, () => {
          const v = homeBView(p, { went, night, goingCount: night ? 3 : 0 });
          const complete = v.base.kind === 'complete';
          expect(v.focus.kind).toBe(!complete ? 'profile' : night ? 'night' : 'find');
          expect(v.share.enabled).toBe(complete && p.is_active);
          if (!v.share.enabled) expect(v.share.reason).toBe(complete ? HIDDEN_SHARE_REASON : SHARE_INCOMPLETE_REASON);
          expect(v.morePlans).toBe(complete && night ? 2 : null);
          expect(v.attended.kind).toBe(went === null ? 'hidden' : went > 0 ? 'count' : 'first');
          if (v.focus.kind === 'profile') expect(v.focus.done + (4 - v.focus.done)).toBe(4);
        });
      }
    }
  }
  it('one upcoming night is not "more plans"', () => {
    const p = profiles.find(([n]) => n === 'fourFieldComplete')![1];
    expect(homeBView(p, { went: 0, night: NIGHT, goingCount: 1 }).morePlans).toBeNull();
    expect(homeBView(p, { went: 0, night: NIGHT, goingCount: null }).morePlans).toBeNull();
  });
});

describe('HomeBView: screen x shape', () => {
  for (const [name, p] of profiles) {
    for (const went of [null, 0, 12]) {
      it(`${name}, went=${went}: one focus card, one CTA, no zero counts, share rule`, () => {
        render(shell(<HomeBView profile={p} went={went} night={null} goingCount={0} focusLoading={false} />));
        expect(screen.getAllByTestId('home-b-focus')).toHaveLength(1);
        expect(screen.getAllByTestId('home-b-cta')).toHaveLength(1);
        const complete = (screen.queryByTestId('home-b-progress') === null);
        const text = document.body.textContent ?? '';
        expect(text).not.toMatch(/\b0 (nights|more)/);
        if (!complete) {
          expect(text).toMatch(/\d of 4/);
          expect(screen.getByTestId('home-b-share-off').getAttribute('aria-disabled')).toBe('true');
          expect(screen.getByTestId('home-b-share-off').textContent).toContain(SHARE_INCOMPLETE_REASON);
        } else if (p.is_active) {
          expect(screen.getByTestId('home-b-share').getAttribute('href')).toBe('/app/page');
        } else {
          expect(screen.getByTestId('home-b-share-off').textContent).toContain(HIDDEN_SHARE_REASON);
        }
        if (went === 12) expect(screen.getByTestId('home-b-attended').textContent).toContain('12 nights attended');
        if (went === 0) expect(screen.getByTestId('home-b-first-night')).toBeTruthy();
        if (went === null) expect(screen.queryByTestId('home-b-attended') ?? screen.queryByTestId('home-b-first-night')).toBeNull();
        // copy never points at a control that is not on screen
        expect(text).not.toMatch(/button below/);
      });
    }
  }
  it('night focus shows the night, Open the night, and the more-plans row only above 0', () => {
    const p = profiles.find(([n]) => n === 'fourFieldComplete')![1];
    render(shell(<HomeBView profile={p} went={0} night={NIGHT} goingCount={3} focusLoading={false} />));
    expect(screen.getByTestId('home-b-focus').textContent).toContain('Bachata Sensual Social');
    expect(screen.getByTestId('home-b-cta').getAttribute('href')).toBe('/event/x');
    expect(screen.getByTestId('home-b-more-plans').textContent).toBe('2 more plans');
  });
  it('find focus (complete, nothing planned) links to Nights', () => {
    const p = profiles.find(([n]) => n === 'fourFieldComplete')![1];
    render(shell(<HomeBView profile={p} went={null} night={null} goingCount={0} focusLoading={false} />));
    expect(screen.getByTestId('home-b-cta').textContent).toBe('Find events this week');
    expect(screen.queryByTestId('home-b-more-plans')).toBeNull();
  });
  it('complete + going feed loading shows the loading card, not a wrong focus', () => {
    const p = profiles.find(([n]) => n === 'fourFieldComplete')![1];
    render(shell(<HomeBView profile={p} went={null} night={null} goingCount={null} focusLoading />));
    expect(screen.getByTestId('home-b-loading')).toBeTruthy();
    expect(screen.queryByTestId('home-b-cta')).toBeNull();
  });
  it('an unfinished profile never waits on the going feed', () => {
    const p = profiles.find(([n]) => n === 'noPhoto')![1];
    render(shell(<HomeBView profile={p} went={null} night={null} goingCount={null} focusLoading />));
    expect(screen.getByTestId('home-b-cta').textContent).toBe('Add your photo');
  });
});

describe('loading and error states each have an action', () => {
  it('loading says what to check', () => {
    render(<HomeBLoading />);
    expect(screen.getByTestId('home-b-loading').textContent).toMatch(/check your connection/);
  });
  it('error: Try again fires, Message us is present', () => {
    let n = 0;
    render(<HomeBError message="Oops" onRetry={() => { n += 1; }} />);
    screen.getByTestId('home-b-retry').click();
    expect(n).toBe(1);
    expect(screen.getByTestId('message-us')).toBeTruthy();
  });
});

describe('source hygiene', () => {
  it('no raw unicode punctuation in the new files', () => {
    for (const f of ['homeFocus.ts', 'homeOptionB.tsx']) {
      const src = readFileSync(`src/modules/dancer-app/screens/home/${f}`, 'utf8');
      expect(src).not.toMatch(/[–—‘’“”…·]/);
    }
  });
});

// @vitest-environment jsdom
/**
 * Dancer Home, Option A (admin #1534): every shape x what Home shows. Table-driven over
 * DANCER_SHAPES (prod-shaped fixtures). Pins: progress once, one CTA on the calm
 * first screen, no copy pointing at a missing control, D4 draws every claim status.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DANCER_SHAPES, DANCER_SHAPE_NAMES } from '../../../api/fixtures';
import { CLAIM_COPY, attendedView, homeView } from '../homeModel';
import { ClaimCard, HomeAView } from '../homeOptionA';
import { NEXT_STEP } from '../../../api/nextStep';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

afterEach(cleanup);

const shell = (ui: React.ReactElement) => (
  <QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>
);
const profileOf = (n: (typeof DANCER_SHAPE_NAMES)[number]) => (DANCER_SHAPES[n] as { profile: Parameters<typeof homeView>[0] }).profile;

describe('homeView: one reading per shape', () => {
  for (const name of DANCER_SHAPE_NAMES) {
    const shape = DANCER_SHAPES[name] as { profile?: Parameters<typeof homeView>[0] };
    if (!shape.profile) continue;
    it(`${name}: kind, next step and list agree with the server's missing steps`, () => {
      const p = shape.profile!;
      const v = homeView(p);
      const requiredLeft = v.checklist.filter((c) => !c.done);
      expect(v.doneCount).toBe(4 - requiredLeft.length);
      expect(v.kind).toBe(requiredLeft.length === 0 ? 'complete' : v.doneCount === 0 ? 'new' : 'unfinished');
      if (v.kind === 'complete') expect(v.next).toBeNull();
      else expect(v.next).toEqual(NEXT_STEP[requiredLeft[0].step]);
      expect(v.checklist.filter((c) => c.next)).toHaveLength(v.kind === 'complete' ? 0 : 1);
      expect(v.title).toBe(p.first_name?.trim() ? `Hi ${p.first_name.trim()}` : 'Welcome');
    });
  }
  it('attended: null is hidden (never a 0), 0 is the empty state, n is a count', () => {
    expect(attendedView(null)).toEqual({ kind: 'hidden' });
    expect(attendedView(0)).toEqual({ kind: 'empty' });
    expect(attendedView(12)).toEqual({ kind: 'count', n: 12 });
  });
});

describe('HomeAView: screen x shape', () => {
  for (const name of DANCER_SHAPE_NAMES) {
    const shape = DANCER_SHAPES[name] as { profile?: Parameters<typeof homeView>[0] };
    if (!shape.profile) continue;
    for (const went of [null, 0, 12]) {
      it(`${name}, went=${went}: one next-step button at most, progress once, no dead copy`, () => {
        const p = profileOf(name);
        const v = homeView(p);
        render(shell(<HomeAView profile={p} went={went} night={null} goingKnown />));
        if (v.kind === 'complete') {
          expect(screen.queryByTestId('home-next-step')).toBeNull();
          expect(screen.queryByText('Finish your profile')).toBeNull();
        } else {
          expect(screen.getAllByTestId('home-next-step')).toHaveLength(1);
          expect(screen.getByTestId('home-next-step').textContent).toBe(v.next!.label);
          expect(screen.getAllByText('Finish your profile')).toHaveLength(1);
          // progress once: no "x of 4" count anywhere
          expect(document.body.textContent).not.toMatch(/\d of 4/);
        }
        // D3 empty: exactly one find-a-night call to action
        if (v.kind === 'complete' && went === 0) {
          expect(screen.getAllByText(/Browse this week|Find a night/)).toHaveLength(1);
        }
        if (v.kind === 'complete' && went === 12) expect(screen.getByTestId('home-attended-n').textContent).toBe('12');
        if (v.kind === 'complete' && went === null) expect(document.body.textContent).not.toMatch(/Nights attended/);
        // copy never points at controls that are not on screen
        expect(document.body.textContent).not.toMatch(/button below|Share my page/);
        if (v.kind === 'new') expect(screen.getByTestId('home-numbers-note').tagName).toBe('P');
        // the preview row says what is missing
        if (v.kind !== 'complete') expect(screen.getByTestId('home-row-preview').textContent).toMatch(/Preview your page/);
        // no hardcoded demo names
        expect(document.body.textContent).not.toMatch(/Ricky|Ritmo/);
      });
    }
  }
});

describe('ClaimCard (D4): every status is drawn', () => {
  for (const status of Object.keys(CLAIM_COPY) as Array<keyof typeof CLAIM_COPY>) {
    it(`${status}: shows its words after the button re-runs the claim`, async () => {
      const run = vi.fn().mockResolvedValue({ status, profileId: status === 'linked' ? 'p1' : null });
      render(shell(<ClaimCard run={run} />));
      expect(screen.getByTestId('claim-button').textContent).toBe('Claim your page');
      fireEvent.click(screen.getByTestId('claim-button'));
      await waitFor(() => expect(screen.getByTestId('claim-title').textContent).toBe(CLAIM_COPY[status].title));
      expect(run).toHaveBeenCalledTimes(1);
      expect(screen.queryAllByTestId('message-us').length).toBe(CLAIM_COPY[status].message ? 1 : 0);
      // never points at a control that is not there
      expect(document.body.textContent).not.toMatch(/start a new profile|this is not me/i);
    });
  }
  it('claims nothing until tapped', () => {
    const run = vi.fn();
    render(shell(<ClaimCard run={run} />));
    expect(run).not.toHaveBeenCalled();
  });
});

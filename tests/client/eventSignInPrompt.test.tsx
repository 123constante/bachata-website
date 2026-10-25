// @vitest-environment jsdom
/**
 * New-dancer journey audit (2026-10-16), event page and its sign-in prompts:
 *  M10 RSVP buttons are 44px tall in px (rem renders ~16% small on phones).
 *  M11 the sign-in prompt and the level-rating sheet have a 44px close and 44px buttons.
 *  M12 one vocabulary on every surface (Sign in / Create account), from one mapping;
 *      the RSVP prompt's copy matches /privacy ("Your nights are private to you").
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/goingCheckin', () => ({ GOING_CHECKIN_ENABLED: true })); // these specs exercise the check-in surfaces
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { installJsdomPolyfills } from './jsdomPolyfills';
import { AuthPromptModal } from '@/components/AuthPromptModal';
import LevelRatingSignInSheet from '@/components/LevelRatingSignInSheet';
import { RsvpBlockPlaceholder } from '@/modules/event-page/bento/blocks/RsvpBlockPlaceholder';
import { AUTH_ACTION_LABELS } from '@/lib/auth-labels';

afterEach(cleanup);

const has44 = (el: Element) => /(^|\s)(min-)?h-\[44px\]/.test(el.getAttribute('class') ?? '');

const SURFACES: Array<[string, () => void]> = [
  [
    'event sign-in prompt',
    () => {
      render(
        <MemoryRouter>
          <AuthPromptModal open onOpenChange={vi.fn()} returnTo="/event/abc" />
        </MemoryRouter>,
      );
    },
  ],
  [
    'level-rating sign-in sheet',
    () => {
      render(
        <MemoryRouter>
          <LevelRatingSignInSheet open onOpenChange={vi.fn()} tappedLabel={null} returnTo="/event/abc" />
        </MemoryRouter>,
      );
    },
  ],
];

describe.each(SURFACES)('%s', (_name, mount) => {
  it('says Sign in / Create account, never Log In / Sign Up, at 44px', () => {
    installJsdomPolyfills();
    mount();
    for (const label of [AUTH_ACTION_LABELS.signin, AUTH_ACTION_LABELS.signup]) {
      const control = screen.getByText(label);
      expect(has44(control)).toBe(true);
    }
    expect(screen.queryByText(/^log ?in$/i)).toBeNull();
    expect(screen.queryByText(/^sign ?up$/i)).toBeNull();
  });

  it('has a 44px close button', () => {
    installJsdomPolyfills();
    mount();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('class')).toContain('[&>button:last-child]:h-[44px]');
    expect(dialog.getAttribute('class')).toContain('[&>button:last-child]:w-[44px]');
  });
});

describe('the going button', () => {
  // Going P2: one "I'm going" button, 48px in explicit px (at least 44).
  const atLeast44 = (el: Element) => /(^|\s)(min-)?h-\[(4[4-9]|[5-9]\d)px\]/.test(el.getAttribute('class') ?? '');
  it('is at least 44px tall in px', () => {
    render(<RsvpBlockPlaceholder />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(1);
    for (const b of buttons) expect(atLeast44(b)).toBe(true);
  });
});

describe('the one vocabulary', () => {
  it('is Sign in / Create account', () => {
    expect(AUTH_ACTION_LABELS).toEqual({ signin: 'Sign in', signup: 'Create account' });
  });
});

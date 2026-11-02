// @vitest-environment jsdom
// The About step's "First name" help line: present in every cell of
// {page name known, unknown} x {first name empty, filled, linked}, tied to the input, and it never
// mentions a control that is not on screen.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AboutStep } from '../AboutStep';
import type { JoinPreview } from '../joinModel';

vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => null }));
vi.mock('@/components/profile/AvatarUpload', () => ({ AvatarUpload: () => null }));
vi.mock('@/components/profile/DanceRolePicker', () => ({ DanceRolePicker: () => null }));
vi.mock('@/lib/saveMyDancerProfile', () => ({ saveMyDancerProfile: vi.fn() }));
afterEach(cleanup);

const preview = (organiserName: string, firstName: string | null): JoinPreview => ({
  status: 'open', organiserName, inviterFirstName: null, emailHint: null, person: null,
  prefill: firstName ? { firstName, cityId: null } : null,
});

const NAMES = [['page name known', 'Cumbaye'], ['page name unknown', '']] as const;
const STATES = [
  ['first name empty', null, false],
  ['first name filled', 'Ana', false],
  ['linked to an existing profile', null, true],
] as const;
// Controls this screen does not have.
const NOT_ON_SCREEN = /\b(button|tap|click|press|save|edit|change|menu|link)\b/i;

describe('About step: first name help line', () => {
  describe.each(NAMES)('%s', (_n, org) => {
    it.each(STATES)('%s', (_s, first, linked) => {
      render(
        <QueryClientProvider client={new QueryClient()}>
          <AboutStep completion={{ missing: ['first_name'], profileId: 'p1' }} preview={preview(org, first)} linked={linked} onSaved={async () => undefined} />
        </QueryClientProvider>,
      );
      const input = screen.getByTestId('join-about-first-name');
      const helpId = input.getAttribute('aria-describedby');
      expect(helpId).toBeTruthy();
      const help = document.getElementById(helpId!);
      expect(help).not.toBeNull();
      expect(help!.textContent).toContain('Your own first name, not the page name');
      expect(help!.textContent).not.toMatch(NOT_ON_SCREEN);
      if (org) expect(help!.textContent).toContain(`(${org})`);
      else expect(help!.textContent).not.toContain('(');
    });
  });
});

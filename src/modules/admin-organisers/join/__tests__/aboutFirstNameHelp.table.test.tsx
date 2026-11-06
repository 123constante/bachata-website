// @vitest-environment jsdom
// The About step's "First name" help line: present in every cell of
// {page name, a page named after a person} x {page invite, person-bound invite} x
// {first name empty, filled, linked}, tied to the input, the SAME words every time (review r1: it must
// never echo the page name or a person's name), and it never mentions a control that is not on screen.
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

const preview = (organiserName: string, firstName: string | null, bound: boolean): JoinPreview => ({
  status: 'open', organiserName, inviterFirstName: null, emailHint: null,
  person: bound ? { firstName: 'Maria', avatarUrl: null, city: null } : null,
  prefill: firstName ? { firstName, cityId: null } : null,
});

const NAMES = [['page name', 'Cumbaye'], ['page named after a person', 'Daniel Rivera']] as const;
const INVITES = [['page invite', false], ['person-bound invite', true]] as const;
const STATES = [
  ['first name empty', null, false],
  ['first name filled', 'Ana', false],
  ['linked to an existing profile', null, true],
] as const;
// Controls this screen does not have.
const NOT_ON_SCREEN = /\b(button|tap|click|press|save|edit|change|menu|link)\b/i;

describe('About step: first name help line', () => {
  describe.each(NAMES)('%s', (_n, org) => {
   describe.each(INVITES)('%s', (_i, bound) => {
    it.each(STATES)('%s', (_s, first, linked) => {
      render(
        <QueryClientProvider client={new QueryClient()}>
          <AboutStep completion={{ missing: ['first_name'], profileId: 'p1' }} preview={preview(org, first, bound)} linked={linked} onSaved={async () => undefined} />
        </QueryClientProvider>,
      );
      const input = screen.getByTestId('join-about-first-name');
      const helpId = input.getAttribute('aria-describedby');
      expect(helpId).toBeTruthy();
      const help = document.getElementById(helpId!);
      expect(help).not.toBeNull();
      expect(help!.textContent).toBe('Your own first name, not the page name.');
      expect(help!.textContent).not.toMatch(NOT_ON_SCREEN);
      expect(help!.textContent).not.toContain(org);
      expect(help!.textContent).not.toContain('Maria');
    });
   });
  });
});

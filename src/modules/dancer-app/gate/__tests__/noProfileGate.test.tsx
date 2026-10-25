// @vitest-environment jsdom
/**
 * Audit H6, both dancer-area gate states. An account with NO dancer profile stays on /finish-profile
 * (whose no-profile page has the real next step) in BOTH states: /app/welcome cannot create a profile
 * (my_dancer_edit_v1 raises no_profile), so sending it there would only move the dead end.
 * A half-finished stub with the gate open still goes into setup.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) => (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { makeProfile, CITY_LONDON } from '@/modules/dancer-app/api/fixtures';

afterEach(() => {
  cleanup();
  resetShell();
});

const OPEN = { open: true, allowed: true };
const CLOSED = { open: false, allowed: false };
const settle = async () => {
  await screen.findByTestId('today-finish-profile');
  await new Promise((r) => setTimeout(r, 30));
};

describe.each([
  ['gate open', OPEN],
  ['gate closed', CLOSED],
])('no dancer profile, %s', (_n, gate) => {
  it('stays on /finish-profile', async () => {
    const { location, backend } = renderInShell({ path: '/finish-profile?returnTo=%2F', backend: { profile: null, gate } });
    await settle();
    expect(location()).toBe('/finish-profile?returnTo=%2F');
    expect(backend.calls.some((c) => c.fn === 'saveMyDancerProfile')).toBe(false);
  });
});

it('half-finished stub, gate open: into setup at /app/welcome', async () => {
  const { location } = renderInShell({ path: '/finish-profile', backend: { profile: makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id }), gate: OPEN } });
  await waitFor(() => expect(location().startsWith('/app/welcome')).toBe(true));
});

it('half-finished stub, gate closed: today\u2019s page stays (fails closed)', async () => {
  const { location } = renderInShell({ path: '/finish-profile', backend: { profile: makeProfile({ first_name: 'Ana' }), gate: CLOSED } });
  await settle();
  expect(location()).toBe('/finish-profile');
});

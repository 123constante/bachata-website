// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, waitFor } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) => (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

import { myDancerEditKey, writeMyDancerEdit } from '@/modules/dancer-app/api/useMyDancerEdit';
import type { MyDancerEdit } from '@/modules/dancer-app/api/types';
import { FAKE_USER_ID } from '@/modules/dancer-app/api/fixtures';
import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';

afterEach(() => {
  cleanup();
  resetShell();
});

/**
 * The walk's 2026-10-15 find: onboarding finished the profile, but the dancer gate's
 * cached "incomplete" (['profile-completion', uid], 60 s stale time) bounced /account/o
 * back to /finish-profile. A save that changes completeness must drop that answer.
 */
const shape = (complete: boolean, pct: number) =>
  ({ profile_id: 'p1', complete, strength: { pct, next_step: null, missing: [] } }) as unknown as MyDancerEdit;

const setup = (complete: boolean) => {
  const qc = new QueryClient();
  qc.setQueryData(myDancerEditKey('u1'), shape(complete, complete ? 70 : 40));
  qc.setQueryData(['profile-completion', 'u1'], { status: complete ? 'complete' : 'incomplete' });
  return qc;
};

describe('writeMyDancerEdit keeps the dancer gate honest', () => {
  it('a save that finishes the profile drops the cached gate answer', () => {
    const qc = setup(false);
    writeMyDancerEdit(qc, 'u1', shape(true, 70));
    expect(qc.getQueryData(['profile-completion', 'u1'])).toBeUndefined();
  });

  it('a save that does not change completeness leaves it alone', () => {
    const qc = setup(true);
    writeMyDancerEdit(qc, 'u1', shape(true, 85));
    expect(qc.getQueryData(['profile-completion', 'u1'])).toEqual({ status: 'complete' });
  });
});

/**
 * Review F1: the profile finished with NO save in this tab (another tab or device), so the
 * gate's cache still says "incomplete" while my_dancer_edit says "done". Onboarding opened
 * from the gate's bounce (/app/welcome?returnTo=/account/o) must drop that answer before it
 * sends the person on, or /account/o bounces them straight back here.
 */
describe('onboarding already done on arrival, with a stale gate', () => {
  const gateKey = ['profile-completion', FAKE_USER_ID];

  it('a gated end (/account/o): the gate answer is gone before the redirect lands', async () => {
    const { queryClient, location } = renderInShell({ path: '/app/welcome?returnTo=/account/o', backend: { shape: 'completeAllExtras' } });
    queryClient.setQueryData(gateKey, { status: 'incomplete' });
    const seenAtEnd: unknown[] = [];
    await waitFor(() => {
      expect(location()).toBe('/account/o');
      seenAtEnd.push(queryClient.getQueryData(gateKey));
    });
    expect(seenAtEnd[0]).toBeUndefined();
  });

  it('Home is not gated: the cached answer is left alone', async () => {
    const { queryClient, location } = renderInShell({ path: '/app/welcome', backend: { shape: 'completeAllExtras' } });
    queryClient.setQueryData(gateKey, { status: 'complete' });
    await waitFor(() => expect(location()).toBe('/app/home'));
    expect(queryClient.getQueryData(gateKey)).toEqual({ status: 'complete' });
  });
});

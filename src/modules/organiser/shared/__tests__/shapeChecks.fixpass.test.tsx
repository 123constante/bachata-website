// @vitest-environment jsdom
/**
 * FIX-RELEASE-A-WEB #8 (test gap found by mutation): every shape check in the
 * three answer parsers has a row that goes red when the check is removed. A
 * bad answer is an ERROR (the screen's error path), never a guessed value:
 * `publish_ready: "false"` must not open the edit lock, `ready: "false"` must
 * not send Go live, and an unexpected set-public answer is not "unchanged".
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc, from: vi.fn() } }));
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => ({ isAdmin: false, isPending: false }) }));

import { parseProfileProgress, useProfileProgress } from '../profileProgress';
import { parseGoLiveCheck } from '../goLiveCheck';
import { parseSetPublic, setShownOnPublicTeam } from '../../team/publicTeamApi';
import { useEventLock } from '../../events/ProfileLock';
import { ProfileButton } from '../../home/ProfileButton';
import { markFinishLater } from '../../wizard/nudgeStore';

afterEach(cleanup);

const STEP = { area: 'dancer', field: 'city', required: true, done: false };
const GOOD = { percent: 40, required_left: 2, publish_ready: false, steps: [STEP], declined: ['teacher'] };
const without = (k: string) => Object.fromEntries(Object.entries(GOOD).filter(([key]) => key !== k));

describe('parseProfileProgress: each shape check', () => {
  it('the good answer parses (the rows below differ from it in ONE place)', () => {
    expect(parseProfileProgress(GOOD)).toEqual({ percent: 40, requiredLeft: 2, publishReady: false, steps: [STEP], declined: ['teacher'] });
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['a string', 'ok'],
    ['percent missing', without('percent')],
    ['percent "40"', { ...GOOD, percent: '40' }],
    ['required_left missing', without('required_left')],
    ['required_left "2"', { ...GOOD, required_left: '2' }],
    ['publish_ready missing', without('publish_ready')],
    ['publish_ready "false"', { ...GOOD, publish_ready: 'false' }],
    ['publish_ready 0', { ...GOOD, publish_ready: 0 }],
    ['steps missing', without('steps')],
    ['steps an object', { ...GOOD, steps: { 0: STEP } }],
    ['declined missing', without('declined')],
    ['declined a string', { ...GOOD, declined: 'teacher' }],
    ['a step with an unknown area', { ...GOOD, steps: [{ ...STEP, area: 'singer' }] }],
    ['a step with no field', { ...GOOD, steps: [{ ...STEP, field: undefined }] }],
    ['a step with required "true"', { ...GOOD, steps: [{ ...STEP, required: 'true' }] }],
    ['a step with done 1', { ...GOOD, steps: [{ ...STEP, done: 1 }] }],
    ['a null step', { ...GOOD, steps: [null] }],
  ])('%s -> progress_bad_shape', (_label, raw) => {
    expect(() => parseProfileProgress(raw)).toThrow('progress_bad_shape');
  });

  it('declined junk is dropped, never guessed (only teacher and dj stay)', () => {
    expect(parseProfileProgress({ ...GOOD, declined: ['teacher', 'singer', 7, null, 'dj'] }).declined).toEqual(['teacher', 'dj']);
  });
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;
}

describe('a bad progress answer on screen: the error path, never a lock or a guessed number', () => {
  const serve = (progress: unknown) => rpc.mockImplementation(async (fn: string) => (fn === 'my_profile_progress_v1' ? { data: progress, error: null } : { data: null, error: { message: 'nope' } }));

  it.each<[string, unknown]>([
    ['publish_ready "false"', 'false'],
    ['publish_ready 0', 0],
  ])('%s: the read is an error and the event lock stays off', async (_l, publishReady) => {
    serve({ ...GOOD, publish_ready: publishReady });
    const { result } = renderHook(() => ({ progress: useProfileProgress('org-1'), lock: useEventLock({ organiserIds: ['org-1'] } as never) }), { wrapper });
    await waitFor(() => expect(result.current.progress.isError).toBe(true));
    expect(result.current.progress.error?.message).toBe('progress_bad_shape');
    expect(result.current.lock).toEqual({ locked: false, reason: null });
  });

  it('publish_ready "false": Home draws nothing (a failed read), not a button with a guessed count', async () => {
    serve({ ...GOOD, publish_ready: 'false' });
    markFinishLater('u1', Date.now());
    render(<ProfileButton organiserId="org-1" userId="u1" />, { wrapper });
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('home-profile')).toBeNull();
  });
});

describe('parseGoLiveCheck: string booleans never send Go live', () => {
  const READY = { ready: true, event_missing: [], recommended: [], profile_rule_applies: true, profile_missing: [] };
  it('the good answer parses', () => expect(parseGoLiveCheck(READY).ready).toBe(true));
  it.each<[string, unknown]>([
    ['ready "false"', { ...READY, ready: 'false' }],
    ['ready "true"', { ...READY, ready: 'true' }],
    ['profile_rule_applies "false"', { ...READY, profile_rule_applies: 'false' }],
    ['event_missing missing', { ...READY, event_missing: undefined }],
  ])('%s -> go_live_bad_shape', (_l, raw) => {
    expect(() => parseGoLiveCheck(raw)).toThrow('go_live_bad_shape');
  });
});

describe('parseSetPublic: only the three statuses', () => {
  it.each(['hidden', 'public', 'unchanged'] as const)('{status:"%s"} parses', (status) => {
    expect(parseSetPublic({ status })).toBe(status);
  });

  it.each<[string, unknown]>([
    ['{}', {}],
    ['{status:"shown"}', { status: 'shown' }],
    ['null', null],
    ['a bare string', 'public'],
  ])('%s -> set_public_bad_shape', (_l, raw) => {
    expect(() => parseSetPublic(raw)).toThrow('set_public_bad_shape');
  });

  it('through the API: a bad answer throws (the switch shows its error), never "unchanged"', async () => {
    rpc.mockImplementation(async () => ({ data: { status: 'shown' }, error: null }));
    await expect(setShownOnPublicTeam('org-1', true)).rejects.toThrow('set_public_bad_shape');
  });
});

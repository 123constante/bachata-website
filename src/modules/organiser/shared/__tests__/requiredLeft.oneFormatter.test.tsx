// @vitest-environment jsdom
/**
 * FIX-RELEASE-A-WEB #4: ONE "N left" wording. Home's button, My page's required
 * line, the go-live lock reason, the Go live profile row and the wizard's
 * progress all read requiredLeftText(n), so the same number reads the same way
 * on every screen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc, from: vi.fn() } }));

import { parseProfileProgress, profileLock, requiredLeftText } from '../profileProgress';
import { profileRowLabel } from '../goLiveCheck';
import { ProfileButton } from '../../home/ProfileButton';
import { RequiredLine } from '../../page';
import { ProgressBar } from '../../wizard/LevelTrack';
import { markFinishLater } from '../../wizard/nudgeStore';

let progress: Record<string, unknown>;

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  try { window.localStorage.clear(); } catch { /* jsdom */ }
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => (fn === 'my_profile_progress_v1' ? { data: progress, error: null } : { data: null, error: { message: 'nope' } }));
});
afterEach(cleanup);

describe.each([
  [1, '1 answer left'],
  [2, '2 answers left'],
])('required_left %i -> "%s" on every surface', (n, text) => {
  beforeEach(() => { progress = { percent: 40, required_left: n, publish_ready: false, steps: [], declined: [] }; });

  it('the formatter', () => expect(requiredLeftText(n)).toBe(text));

  it('Home: the button\'s line', async () => {
    markFinishLater('u1', Date.now()); // no auto-open
    wrap(<ProfileButton organiserId="org-1" userId="u1" />);
    expect((await screen.findByTestId('home-profile-level')).textContent).toBe(`${text}. Needed before your events can go live.`);
  });

  it('My page: the required line', async () => {
    wrap(<RequiredLine organiserId="org-1" />);
    expect((await screen.findByTestId('page-required-line')).textContent).toBe(`Required to publish: ${text}`);
  });

  it('the go-live lock reason', () => {
    expect(profileLock(parseProfileProgress(progress), false).reason).toBe(`Finish your profiles first, ${text}`);
  });

  it('the Go live profile row', () => {
    expect(profileRowLabel(n)).toBe(`Finish your profile (${text})`);
  });

  it('the wizard: beside the progress bar', () => {
    wrap(<ProgressBar percent={40} requiredLeft={n} />);
    expect(screen.getByTestId('wizard-required-left').textContent).toBe(text);
  });
});

it('the wizard shows no count once nothing required is left', () => {
  wrap(<ProgressBar percent={70} requiredLeft={0} />);
  expect(screen.queryByTestId('wizard-required-left')).toBeNull();
});

// @vitest-environment jsdom
/** Auth funnel counter: onboarding_end ok is recorded once when the setup reaches its end card. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/trackAuthStep', () => ({ trackAuthStep: track }));
vi.mock('@/hooks/useAuth', async (importOriginal) => (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
vi.mock('@/lib/analytics', async (importOriginal) => ({ ...(await importOriginal<object>()), trackAnalyticsEvent: vi.fn() }));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';

beforeEach(() => track.mockReset());
afterEach(() => {
  cleanup();
  resetShell();
});

describe('onboarding_end', () => {
  it('records ok once on the end card, and not again when moving between end cards', async () => {
    renderInShell({ path: '/app/welcome', backend: { shape: 'fourFieldComplete' } });
    await screen.findByTestId('onboarding-in-card');
    expect(track.mock.calls).toEqual([[{ step: 'onboarding_end', outcome: 'ok' }]]);
    const q = (await screen.findAllByText('Two quick questions')).map((n) => n.closest('button')).find(Boolean);
    fireEvent.click(q as HTMLElement);
    for (let i = 0; i < 2; i++) {
      const s = (await screen.findAllByText('Skip')).map((n) => n.closest('button')).find(Boolean);
      fireEvent.click(s as HTMLElement);
    }
    await screen.findByTestId('onboarding-nice-card');
    expect(track.mock.calls).toHaveLength(1);
  });

  it('records nothing for a profile that is already complete (redirects before any card)', async () => {
    renderInShell({ path: '/app/welcome', backend: { shape: 'completeAllExtras' } });
    await new Promise((r) => setTimeout(r, 50));
    expect(track.mock.calls).toEqual([]);
  });

  it('records nothing while a required card is showing', async () => {
    renderInShell({ path: '/app/welcome', backend: { shape: 'emptyStub' } });
    await screen.findByTestId('onboarding-name');
    expect(track.mock.calls).toEqual([]);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { vi } from 'vitest';

const h = vi.hoisted(() => ({ flags: { raffleDoorTime: false } }));
vi.mock('@/lib/featureFlags', () => ({ flags: h.flags }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: vi.fn() }));
vi.mock('@/lib/seo', () => ({ useSeo: () => undefined }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));

import { DoorScreen, formatUsedAt, parseDoorResult } from '../RaffleDoor';

const NOW = new Date('2026-11-26T12:00:00Z');

describe('formatUsedAt', () => {
  it('today / yesterday / dated, London wall time', () => {
    expect(formatUsedAt('2026-11-26T20:00:00', NOW)).toBe('Used today at 20:00');
    expect(formatUsedAt('2026-11-25T20:00:00', NOW)).toBe('Used yesterday at 20:00');
    expect(formatUsedAt('2026-11-22T20:00:00', NOW)).toBe('Used Sun 22 Nov at 20:00');
  });
  it('converts a zoned value to London (BST)', () => {
    expect(formatUsedAt('2026-07-01T22:30:00Z', new Date('2026-07-02T10:00:00Z'))).toBe('Used yesterday at 23:30');
  });
  it('falls back for plain times and empty', () => {
    expect(formatUsedAt('21:40', NOW)).toBe('Used at 21:40');
    expect(formatUsedAt('', NOW)).toBe('Used already');
  });
});

describe('already admitted screen keep-list', () => {
  afterEach(() => cleanup());
  const view = {
    kind: 'result' as const,
    admittedByUs: false,
    result: parseDoorResult({ status: 'already_admitted', name: 'Aisha K.', event: 'Friday Social', date: '2026-11-28', admitted_at_local: '2026-11-26T20:00:00', photo_url: 'https://x.test/p.jpg' }),
  };
  for (const on of [false, true]) {
    it(`flag ${on ? 'on' : 'off'} keeps every line`, () => {
      h.flags.raffleDoorTime = on;
      render(<DoorScreen view={view} busy={false} onAdmit={() => undefined} onRetry={() => undefined} />);
      expect(screen.getByText('Already admitted')).toBeTruthy();
      expect(screen.getByText('Aisha K.')).toBeTruthy();
      expect(screen.getByText(/Friday Social/).textContent).toContain('Sat 28 Nov');
      expect(screen.getByTestId('door-photo')).toBeTruthy();
      expect(screen.getByTestId('door-photo-rule')).toBeTruthy();
      expect(screen.queryByText('Admit')).toBeNull();
      const used = screen.getByTestId('door-used-at').textContent;
      if (on) expect(used).toMatch(/^Used .* at 20:00\.$/);
      else expect(used).toBe('This prize was used at 2026-11-26T20:00:00.');
    });
  }
});

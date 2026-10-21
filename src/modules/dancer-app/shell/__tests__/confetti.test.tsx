// @vitest-environment jsdom
/** D121 confetti: fires on "You're in" and on strength crossing 70 / reaching 100; creates NOTHING under reduced motion. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, screen } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

import { renderInShell, resetShell } from '../renderInShell';
import { daConfetti } from '../confetti';
import { writeMyDancerEdit, myDancerEditKey, resetStrength70ForTests } from '../../api/useMyDancerEdit';
import { makeProfile, CITY_LONDON } from '../../api/fixtures';
import type { MyDancerEdit } from '../../api/types';

const motion = (reduce: boolean) =>
  vi.spyOn(window, 'matchMedia').mockImplementation(((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as never);

const pieces = () => document.querySelectorAll('.da-confetti i').length;
const withPct = (p: MyDancerEdit, pct: number): MyDancerEdit => ({ ...p, strength: { ...p.strength, pct } });

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); resetStrength70ForTests(); });
afterEach(() => { cleanup(); resetShell(); vi.useRealTimers(); vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('daConfetti', () => {
  it('creates 36 pieces and removes them after about a second', () => {
    motion(false);
    expect(daConfetti()).toBe(36);
    expect(pieces()).toBe(36);
    vi.advanceTimersByTime(1300);
    expect(pieces()).toBe(0);
  });
  it('creates nothing under reduced motion', () => {
    motion(true);
    expect(daConfetti()).toBe(0);
    expect(pieces()).toBe(0);
  });
});

describe('the triggers', () => {
  const base = makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id, dance_role: 'Leader' });
  const cache = (before: MyDancerEdit) => {
    const qc = new QueryClient();
    qc.setQueryData(myDancerEditKey('u1'), before);
    return qc;
  };
  it.each([
    [55, 80, true],
    [65, 70, true],
    [80, 100, true],
    [70, 75, false],
    [100, 100, false],
    [30, 55, false],
  ])('strength %i -> %i fires: %s', (from, to, fires) => {
    motion(false);
    writeMyDancerEdit(cache(withPct(base, from)), 'u1', withPct(base, to));
    expect(pieces() > 0).toBe(fires);
  });
  it('reduced motion: crossing 70 creates nothing', () => {
    motion(true);
    writeMyDancerEdit(cache(withPct(base, 55)), 'u1', withPct(base, 80));
    expect(pieces()).toBe(0);
  });
  it('"You\'re in" fires it once, and not under reduced motion', async () => {
    motion(false);
    renderInShell({ path: '/app/welcome', backend: { shape: 'fourFieldComplete' } });
    await screen.findByTestId('onboarding-in-card');
    expect(pieces()).toBe(36);
    cleanup(); resetShell(); document.body.innerHTML = '';
    motion(true);
    renderInShell({ path: '/app/welcome', backend: { shape: 'fourFieldComplete' } });
    await screen.findByTestId('onboarding-in-card');
    expect(pieces()).toBe(0);
  });
});

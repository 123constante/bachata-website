// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
afterEach(cleanup);

vi.mock('@/lib/featureFlags', async (orig) => {
  const m = await orig<typeof import('@/lib/featureFlags')>();
  return { ...m, flags: { ...m.flags, nameFixes: true } };
});

import { DancersSeeLine, dancersSee } from '../shared/DancersSeeLine';
import { ownPublicName } from '@/modules/dancer-app/api/publicName';

const prof = (o: Record<string, unknown>) =>
  ownPublicName({ display_name: null, first_name: null, surname: null, hide_surname_publicly: false, ...o } as never);

describe('Dancers see line', () => {
  it('typed DJ name wins', () => {
    render(<DancersSeeLine ownName="Ricky Ray" typedDjName="DJ Carlos De La Cruz" />);
    const t = screen.getByTestId('dancers-see').textContent!;
    expect(t).toContain('Dancers see DJ Carlos De La Cruz. On every line-up where you DJ.');
    expect(t).toContain('Leave it empty to use your own name.');
    expect(t).not.toContain('· DJ');
  });
  it.each(['', '   ', null])('blank %j falls back to own name', (v) => {
    expect(dancersSee('Ricky Ray', v)).toBe('Ricky Ray');
  });
  it('hide surname on, DJ name empty: first name only', () => {
    const own = prof({ first_name: 'Ricky', surname: 'Ray', hide_surname_publicly: true });
    render(<DancersSeeLine ownName={own} typedDjName="" />);
    const t = screen.getByTestId('dancers-see').textContent!;
    expect(t).toContain('Dancers see Ricky.');
    expect(t).not.toContain('Ray');
  });
  it('no name at all renders nothing', () => {
    expect(dancersSee(prof({}), '')).toBeNull();
  });
});

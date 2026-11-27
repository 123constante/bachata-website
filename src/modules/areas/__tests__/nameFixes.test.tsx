// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach } from 'vitest';
afterEach(cleanup);

vi.mock('@/lib/featureFlags', async (orig) => {
  const m = await orig<typeof import('@/lib/featureFlags')>();
  return { ...m, flags: { ...m.flags, nameFixes: true } };
});

import { DancersSeeLine, dancersSee } from '../shared/DancersSeeLine';

const own = { display_name: 'Ricky Ray' };

describe('Dancers see line', () => {
  it('typed DJ name wins', () => {
    render(<DancersSeeLine details={own} typedDjName="DJ Carlos De La Cruz" />);
    expect(screen.getByTestId('dancers-see').textContent).toContain('Dancers see DJ Carlos De La Cruz');
    expect(screen.getByTestId('dancers-see').textContent).toContain('own name, Ricky Ray.');
  });
  it.each(['', '   ', null])('blank %j falls back to own name', (v) => {
    expect(dancersSee(own, v).shown).toBe('Ricky Ray');
  });
  it('no own name: second sentence loses the name', () => {
    render(<DancersSeeLine details={{}} typedDjName="DJ Tony Spark" />);
    expect(screen.getByTestId('dancers-see').textContent).toContain('use your own name.');
  });
});

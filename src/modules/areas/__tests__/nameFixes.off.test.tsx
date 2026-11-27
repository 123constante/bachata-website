// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const state = vi.hoisted(() => ({ on: false }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const m = await orig<typeof import('@/lib/featureFlags')>();
  return { ...m, flags: new Proxy(m.flags, { get: (t, k) => (k === 'nameFixes' ? state.on : (t as never)[k]) }) };
});

import { DancersSeeLine } from '../shared/DancersSeeLine';
import { NAME_BOX_WIDE_PX, PersonChip } from '@/modules/event-page/bento/blocks/schedule/PersonChip';

afterEach(cleanup);

it('flag off: nothing rendered', () => {
  state.on = false;
  const { container } = render(<DancersSeeLine ownName="A" typedDjName="B" />);
  expect(container.innerHTML).toBe('');
});
it('wide box is 96px', () => expect(NAME_BOX_WIDE_PX).toBe(96));

describe('stacked PersonChip name box', () => {
  const nameBox = () => {
    const { container } = render(
      <MemoryRouter>
        <PersonChip person={{ id: 'p1', name: 'Cristian & Gabriella', type: 'dancer' } as never} size="md" layout="stacked" />
      </MemoryRouter>,
    );
    return Array.from(container.querySelectorAll<HTMLElement>('*')).find((e) => e.style.maxWidth && e.textContent === 'Cristian & Gabriella' && e.children.length === 0)!;
  };
  it('on: 96px', () => {
    state.on = true;
    expect(nameBox().style.maxWidth).toBe('96px');
  });
  it('off: avatarPx + 24', () => {
    state.on = false;
    const w = parseInt(nameBox().style.maxWidth, 10);
    expect(w).not.toBe(96);
    expect(w).toBeGreaterThan(24);
  });
});

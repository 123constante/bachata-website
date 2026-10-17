// @vitest-environment jsdom
/** Audit M28 on Edit: a city not in the list has a real way on (the picker's own request form is off). */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) => (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => <button type="button">City</button> }));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { ADD_CITY_MESSAGE, dancerMessageUsUrl } from '@/modules/dancer-app/api/messageUs';

afterEach(() => {
  cleanup();
  resetShell();
});

describe('Edit city', () => {
  it.each(['nameCityOnly', 'fourFieldComplete'] as const)('%s: Message us to add your city', async (shape) => {
    renderInShell({ path: '/app/me/edit', backend: { shape } });
    const link = await screen.findByRole('link', { name: 'Message us to add your city' });
    expect(link.getAttribute('href')).toBe(dancerMessageUsUrl(ADD_CITY_MESSAGE));
  });
});

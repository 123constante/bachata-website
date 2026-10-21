// @vitest-environment jsdom
/**
 * Review S7: the shared CityPicker and HideSurnameSwitch sit on Ember colours on Edit, not the
 * site's shadcn tokens. The shared components stay untouched: the picker gets className overrides,
 * the switch reads Ember values through shadcn variables mapped in theme/dancer-color.css.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, screen } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) => (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
vi.mock('@/components/ui/city-picker', () => ({
  CityPicker: ({ className }: { className?: string }) => <button type="button" data-testid="city-picker" className={className}>City</button>,
}));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';

class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;

afterEach(() => {
  cleanup();
  resetShell();
});

const css = readFileSync(path.resolve(__dirname, '../../../theme/dancer-color.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('S7 Edit: picker and switch on the Ember palette', () => {
  it('the city picker field is the Ember input: card-2 fill, Ember border, 16px text', async () => {
    renderInShell({ path: '/app/me/edit', backend: { shape: 'fourFieldComplete' } });
    const cls = (await screen.findByTestId('city-picker')).className;
    for (const c of ['bg-[var(--card2)]', 'text-[16px]', 'border-[var(--line-strong)]', 'text-[var(--fg)]', 'hover:bg-[var(--card2)]']) expect(cls).toContain(c);
  });
  it('the hide-surname switch maps the shadcn variables to Ember HSL values (light knob, ember track when on)', () => {
    const rule = css.match(/\[data-profile="dancer"\] \[data-testid="hide-surname-switch"\] \{([^}]*)\}/)?.[1] ?? '';
    const v = (name: string) => rule.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
    expect(v('--background')).toBe('220 12% 95%'); // --fg #f1f2f4: the knob
    expect(v('--primary')).toBe('18 86% 58%'); // --btn #f0703a: the track when on
    expect(v('--input')).toBe('217 7% 52%'); // --line-strong #7b828d: the track when off
    expect(v('--border')).toBe('218 8% 26%'); // --line #3d4148: the box edge
    expect(v('--muted-foreground')).toBe('218 10% 67%'); // --mut #a3a9b3
  });
});

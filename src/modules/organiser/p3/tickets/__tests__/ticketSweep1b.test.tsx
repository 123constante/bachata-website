// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { payingOrganiser, useStartOnboarding } from '../data';

const o = (id: string, role: 'owner' | 'manager') => ({ id, role, series: [] }) as never;
const home = (...orgs: unknown[]) => ({ organisers: orgs }) as never;

describe('payingOrganiser (S9)', () => {
  it('prefers the page asked for (?o=)', () => {
    expect(payingOrganiser(home(o('a', 'manager'), o('b', 'owner')), 'a')?.id).toBe('a');
  });
  it('falls back to the first owned page, not a managed one', () => {
    expect(payingOrganiser(home(o('a', 'manager'), o('b', 'owner')), null)?.id).toBe('b');
  });
  it('falls back to the first page when none is owned', () => {
    expect(payingOrganiser(home(o('a', 'manager')), null)?.id).toBe('a');
  });
});

describe('useStartOnboarding busy reset (S8)', () => {
  it('clears busy on a bfcache pageshow and on becoming visible', () => {
    const { result } = renderHook(() => useStartOnboarding('a'));
    expect(result.current.busy).toBe(false);
    act(() => { void result.current.go(); });
    expect(result.current.busy).toBe(true);
    act(() => { window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true })); });
    expect(result.current.busy).toBe(false);
    act(() => { void result.current.go(); });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(result.current.busy).toBe(false);
  });
});

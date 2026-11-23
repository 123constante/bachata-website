// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { SHAPES, type Shape } from './fixtures';
import { dataMock, load, show } from './harness';
import { HUB_COPY, hubSteps } from '../model';

vi.mock('../data', (orig) => dataMock(orig as never));

import { GetPaidScreen } from '../GetPaid';

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
const shape = (over: Partial<Shape>): Shape => ({ ...SHAPES.bare, ...over });
const GP = '/account/p3/you/get-paid';

describe('hubSteps', () => {
  it('not started: nothing ticked, long labels', () => {
    expect(hubSteps('none').map((s) => s.done)).toEqual([false, false, false]);
    expect(hubSteps('none')[1].label).toBe('2. Connect Stripe (about 5 minutes)');
  });
  it('half-finished: step 2 ticked', () => expect(hubSteps('started').map((s) => s.done)).toEqual([false, true, false]));
  it('connected: all ticked, short labels', () => {
    expect(hubSteps('connected').map((s) => [s.label, s.done])).toEqual([['1. Bank details and ID', true], ['2. Connect Stripe', true], ['3. Done', true]]);
  });
});

describe('Get paid hub (flag stripeNudgeV2)', () => {
  it('flag off: the old card, no hub', () => {
    load(shape({ stripe: 'none', role: 'owner' }));
    show(<GetPaidScreen />, GP);
    expect(screen.queryByTestId('tix-hub')).toBeNull();
    expect(screen.getByTestId('tix-getpaid-card')).toBeTruthy();
  });
  it.each([['none', HUB_COPY.connect], ['started', HUB_COPY.finish]] as const)('flag on, %s: 3 rows, one button, note', (stripe, label) => {
    vi.stubEnv('VITE_ENABLE_STRIPE_NUDGE_V2', 'true');
    load(shape({ stripe, role: 'owner' }));
    show(<GetPaidScreen />, GP);
    expect(screen.getByTestId('tix-hub')).toBeTruthy();
    expect(screen.queryByTestId('tix-getpaid-card')).toBeNull();
    expect(screen.getByTestId('tix-hub-go').textContent).toBe(label);
    expect(screen.getByTestId('tix-hub-note').textContent).toBe(HUB_COPY.note);
  });
  it('flag on, connected: banner, no connect button', () => {
    vi.stubEnv('VITE_ENABLE_STRIPE_NUDGE_V2', 'true');
    load(shape({ stripe: 'connected', role: 'owner' }));
    show(<GetPaidScreen />, GP);
    expect(screen.getByTestId('tix-hub-connected').textContent).toBe(HUB_COPY.connected);
    expect(screen.queryByTestId('tix-hub-go')).toBeNull();
  });
  it('flag on, non-owner not connected: still asked to ask the owner', () => {
    vi.stubEnv('VITE_ENABLE_STRIPE_NUDGE_V2', 'true');
    load(shape({ stripe: 'none', role: 'manager' }));
    show(<GetPaidScreen />, GP);
    expect(screen.queryByTestId('tix-hub')).toBeNull();
    expect(screen.getByTestId('tix-getpaid-why')).toBeTruthy();
  });
});

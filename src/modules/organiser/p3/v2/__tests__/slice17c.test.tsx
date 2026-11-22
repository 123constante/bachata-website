// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup } from '@testing-library/react';
import { priceLabel } from '../Facts';
import { doorPriceOf } from '../payMode';

afterEach(cleanup);

const PASS = [{ id: '11111111-1111-4111-8111-111111111111', name: 'Door', price: 10 }];
const everyLabel = (passes: unknown, link: string | null) =>
  priceLabel({ link, doorPrice: !link && doorPriceOf(passes) != null ? String(doorPriceOf(passes)) : null, ticketCount: 0, minPrice: null });

describe('slice 17c Every card Price fact follows the night card rule', () => {
  it('door price, no link: Pay at the door', () => {
    expect(everyLabel(PASS, null)).toMatchObject({ mode: 'door', m: '£10', s: 'Pay at the door' });
  });
  it('priced and linked: unchanged', () => {
    expect(everyLabel(PASS, 'https://x.co').mode).toBe('link');
  });
  it('no passes, no link: Add a ticket', () => {
    expect(everyLabel(null, null).mode).toBe('none');
  });
});

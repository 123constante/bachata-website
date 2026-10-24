/**
 * W2 walk fix 5: How to pay. Every stored shape x every save: what the editor
 * shows picked, and the ONE series.upsert it sends (none when untouched). Prod
 * 2026-10-24: payment_methods is set on 0 of 72 series, so null is the common shape.
 */
import { describe, expect, it } from 'vitest';
import type { EventWorkspace } from '../eventModel';
import { paymentChoices, paymentCommand, parsePayment, togglePayment, type PaymentMethod } from '../paymentModel';

const ws = (payment_methods: string | null, format: string | null = 'standard') =>
  ({ series: { name: 'Friday Social', format, payment_methods } }) as unknown as EventWorkspace;

describe('parsePayment: the stored list as codes, screen order', () => {
  it.each([
    [null, []],
    ['', []],
    ['door', ['door']],
    ['cash, door ,ticket_link', ['ticket_link', 'door', 'cash']],
    ['door,door,paypal', ['door']],
  ])('%j -> %j', (stored, want) => {
    expect(parsePayment(stored)).toEqual(want);
  });
});

describe('paymentCommand: one upsert, or none when nothing changed', () => {
  const cases: [string, EventWorkspace, PaymentMethod[], string | null][] = [
    ['null, untouched', ws(null), [], null],
    ['null -> door', ws(null), ['door'], 'door'],
    ['stored, untouched (any order picked)', ws('cash,door'), ['door', 'cash'], null],
    ['stored -> cleared', ws('door'), [], ''],
    ['festival null -> ticket link', ws(null, 'festival'), ['ticket_link'], 'ticket_link'],
    // A festival only offers its ticket link: a stored "door" it cannot show is dropped, never resent.
    ['festival with a stored door, ticket link kept', ws('ticket_link,door', 'festival'), ['ticket_link', 'door'], 'ticket_link'],
    ['festival with only a stored door', ws('door', 'festival'), ['door'], ''],
  ];
  it.each(cases)('%s', (_name, w, picked, sent) => {
    const cmd = paymentCommand(w, picked);
    if (sent === null) expect(cmd).toBeNull();
    else expect(cmd).toEqual({ kind: 'series.upsert', payload: { name: 'Friday Social', payment_methods: sent } });
  });
});

describe('choices and toggling', () => {
  it('a festival offers its ticket link only; any other event every method', () => {
    expect(paymentChoices(ws(null, 'festival'))).toEqual(['ticket_link']);
    expect(paymentChoices(ws(null))).toEqual(['ticket_link', 'door', 'bank_transfer', 'cash', 'free']);
  });
  it('toggle adds in screen order and takes off on a second tap', () => {
    expect(togglePayment(['cash'], 'door')).toEqual(['door', 'cash']);
    expect(togglePayment(['door', 'cash'], 'door')).toEqual(['cash']);
  });
});

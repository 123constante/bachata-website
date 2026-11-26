// @vitest-environment jsdom
// A card for an event on its own sub-address must leave by a plain page change,
// never through the router: a router trip runs /event/:id's loader, whose answer
// is a cross-host redirect, so the page leaves mid-navigation and Back reloads it
// (the "old page, then the right page" flash, owner phone 2026-11-26).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { goToEvent, isAbsoluteHref } from '../useMapList';

describe('goToEvent', () => {
  const assign = vi.fn();
  const realLocation = window.location;

  afterEach(() => {
    assign.mockReset();
    Object.defineProperty(window, 'location', { value: realLocation, configurable: true });
  });

  const stubLocation = () =>
    Object.defineProperty(window, 'location', { value: { ...realLocation, assign }, configurable: true });

  it('sends a sub-address link straight to the browser, not the router', () => {
    stubLocation();
    const navigate = vi.fn();
    goToEvent('https://wildbachata.bachatacalendar.co.uk/?occurrenceId=abc', navigate);
    expect(assign).toHaveBeenCalledWith('https://wildbachata.bachatacalendar.co.uk/?occurrenceId=abc');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps in-app links on the router', () => {
    stubLocation();
    const navigate = vi.fn();
    goToEvent('/event/abc?occurrenceId=def', navigate);
    expect(navigate).toHaveBeenCalledWith('/event/abc?occurrenceId=def');
    expect(assign).not.toHaveBeenCalled();
  });

  it.each([
    ['https://x.bachatacalendar.co.uk/', true],
    ['HTTP://x.bachatacalendar.co.uk/', true],
    ['/event/x', false],
    ['/festival/x', false],
  ])('isAbsoluteHref(%s) = %s', (href, want) => {
    expect(isAbsoluteHref(href)).toBe(want);
  });
});

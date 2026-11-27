// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { withHttps, LinkSheet } from '../PaySheets';
import { WaysInLinkSheet } from '../WaysIn';

// Prod 2026-11-27: `www.ticket.com` was sent bare and the server refused it ("Something went wrong").
describe('withHttps', () => {
  it.each([
    ['www.ticket.com', 'https://www.ticket.com'],
    ['  ticket.com/x  ', 'https://ticket.com/x'],
    ['//ticket.com', 'https://ticket.com'],
    ['https://a.com', 'https://a.com'],
    ['http://a.com', 'http://a.com'],
    ['HTTPS://A.com', 'HTTPS://A.com'],
  ])('%s -> %s', (raw, out) => expect(withHttps(raw)).toBe(out));
});

describe('link sheets send a full link', () => {
  it('WaysInLinkSheet adds https://', () => {
    const onDone = vi.fn();
    render(<WaysInLinkSheet link="" onDone={onDone} onRemove={() => {}} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/./, { selector: 'input#f-link-in' }), { target: { value: 'www.ticket.com' } });
    fireEvent.click(screen.getByTestId('link-done'));
    expect(onDone).toHaveBeenCalledWith('https://www.ticket.com');
  });
  it('LinkSheet adds https://', () => {
    const onDone = vi.fn();
    render(<LinkSheet link="" onDone={onDone} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/./, { selector: 'input#f-link-in' }), { target: { value: 'www.ticket.com' } });
    fireEvent.click(screen.getByTestId('link-done'));
    expect(onDone).toHaveBeenCalledWith('https://www.ticket.com');
  });
});

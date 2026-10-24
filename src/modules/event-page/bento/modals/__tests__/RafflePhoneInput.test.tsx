// @vitest-environment jsdom
/**
 * The raffle's phone field, pinned BEFORE PhoneInput was extracted from it
 * (invite journey W2): the raffle keeps emitting the same E.164 + validity, the
 * same picker, the same feedback test id. Written against the original
 * RafflePhoneInput and kept green after it became a thin wrapper.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { RafflePhoneInput } from '../RafflePhoneInput';

afterEach(cleanup);

function Harness({ initial = '', onEmit }: { initial?: string; onEmit: (e164: string, valid: boolean) => void }) {
  const [v, setV] = useState(initial);
  return (
    <RafflePhoneInput
      inputId="raffle-phone"
      value={v}
      onChange={(e164, valid) => { setV(e164); onEmit(e164, valid); }}
    />
  );
}

const digits = () => document.getElementById('raffle-phone') as HTMLInputElement;

describe('RafflePhoneInput (raffle contract)', () => {
  it('UK by default; a typed 07... number emits +44 without the trunk zero, valid', () => {
    const onEmit = vi.fn();
    render(<Harness onEmit={onEmit} />);
    expect(screen.getByRole('button', { expanded: false }).textContent).toContain('+44');
    fireEvent.change(digits(), { target: { value: '07700 900123' } });
    expect(onEmit).toHaveBeenLastCalledWith('+447700900123', true);
    expect(digits().value).toBe('7700900123');
    expect(digits().getAttribute('autocomplete')).toBe('tel-national');
    expect(digits().getAttribute('type')).toBe('tel');
  });

  it('a short number emits invalid, and says so only after blur', () => {
    const onEmit = vi.fn();
    render(<Harness onEmit={onEmit} />);
    fireEvent.change(digits(), { target: { value: '77009' } });
    expect(onEmit).toHaveBeenLastCalledWith('+4477009', false);
    expect(screen.queryByTestId('raffle-phone-feedback')).toBeNull();
    fireEvent.blur(digits());
    expect(screen.getByTestId('raffle-phone-feedback').textContent).toMatch(/short/i);
  });

  it('a too-long number is flagged straight away', () => {
    const onEmit = vi.fn();
    render(<Harness onEmit={onEmit} />);
    fireEvent.change(digits(), { target: { value: '77009001234567' } });
    expect(onEmit).toHaveBeenLastCalledWith('+4477009001234567', false);
    expect(screen.getByTestId('raffle-phone-feedback').textContent).toMatch(/too long/i);
  });

  it('a UK landline is a soft warning that still counts as valid', () => {
    const onEmit = vi.fn();
    render(<Harness onEmit={onEmit} />);
    fireEvent.change(digits(), { target: { value: '2071234567' } });
    expect(onEmit).toHaveBeenLastCalledWith('+442071234567', true);
    expect(screen.getByTestId('raffle-phone-feedback').textContent).toMatch(/start with 7/);
  });

  it('picking a country re-emits the digits under the new dial code, and sticks with no digits', () => {
    const onEmit = vi.fn();
    render(<Harness onEmit={onEmit} />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    fireEvent.change(screen.getByPlaceholderText('Search country or code...'), { target: { value: 'Spain' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /Spain/ }));
    expect(onEmit).toHaveBeenLastCalledWith('', false);
    expect(screen.getByRole('button', { expanded: false }).textContent).toContain('+34');
    fireEvent.change(digits(), { target: { value: '612345678' } });
    expect(onEmit).toHaveBeenLastCalledWith('+34612345678', true);
  });

  it('a stored E.164 value opens on its own country', () => {
    render(<Harness initial="+34612345678" onEmit={vi.fn()} />);
    expect(screen.getByRole('button', { expanded: false }).textContent).toContain('+34');
    expect(digits().value).toBe('612345678');
  });

  it('clearing the digits emits an empty value', () => {
    const onEmit = vi.fn();
    render(<Harness initial="+447700900123" onEmit={onEmit} />);
    fireEvent.change(digits(), { target: { value: '' } });
    expect(onEmit).toHaveBeenLastCalledWith('', false);
  });
});

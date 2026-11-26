import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import TicketQrCode from '../TicketQrCode';

afterEach(cleanup);

describe('TicketQrCode fill prop', () => {
  it('fill drops the 240px cap', () => {
    render(<TicketQrCode token="abc" fill />);
    const cls = screen.getByTestId('ticket-qr').getAttribute('class') ?? '';
    expect(cls).not.toContain('max-w-[240px]');
    expect(cls).toContain('w-full');
    expect(cls).toContain('h-full');
  });
  it('default keeps the capped, centred QR', () => {
    render(<TicketQrCode token="abc" />);
    const cls = screen.getByTestId('ticket-qr').getAttribute('class') ?? '';
    expect(cls).toContain('max-w-[240px]');
    expect(cls).toContain('mx-auto');
  });
});

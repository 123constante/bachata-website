import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const flagState = vi.hoisted(() => ({ on: false }));
vi.mock('@/lib/featureFlags', () => ({
  flags: new Proxy({}, { get: (_t, k) => (k === 'rafflePrivacyLine' ? flagState.on : false) }),
}));
vi.mock('@/lib/seo', () => ({ useSeo: () => {}, buildSeoForRoute: () => ({}) }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/pages/NotFound', () => ({ default: () => <div>not-found</div> }));

import Privacy from '@/pages/Privacy';
import PrivacyRaffleData from '@/pages/PrivacyRaffleData';
import { formatAgreedDate } from '@/pages/ExportGuestEntry';

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('raffle privacy line', () => {
  beforeEach(() => { flagState.on = false; });

  it('flag off: privacy keeps its sections, no raffle line, new page is not found', () => {
    wrap(<Privacy />);
    expect(screen.getByText('Your rights')).toBeTruthy();
    expect(screen.getByText('Download or delete your data')).toBeTruthy();
    expect(screen.queryByTestId('privacy-raffle-line')).toBeNull();
    wrap(<PrivacyRaffleData />);
    expect(screen.getByText('not-found')).toBeTruthy();
  });

  it('flag on: privacy keeps its sections and gains the line; new page has Email us', () => {
    flagState.on = true;
    wrap(<Privacy />);
    expect(screen.getByText('Your rights')).toBeTruthy();
    expect(screen.getByText('Download or delete your data')).toBeTruthy();
    expect(screen.getByText('Ask us here.').getAttribute('href')).toBe('/privacy/raffle-data');
    wrap(<PrivacyRaffleData />);
    const a = screen.getByText('Email us');
    expect(a.getAttribute('href')).toContain('subject=Raffle%20data%20request');
  });

  it('formats the agreed date', () => {
    expect(formatAgreedDate('2026-11-24T20:00:00.000Z')).toBe('24 Nov 2026');
  });
});

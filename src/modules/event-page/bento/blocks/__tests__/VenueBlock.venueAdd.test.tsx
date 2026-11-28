// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn() } }));

import { VenueBlock } from '../VenueBlock';

const location = {
  venueId: 'v1',
  venueName: 'The Table',
  address: '35-37 Battersea Rise',
  postcode: 'SW11 1HG',
  cityName: 'London',
  venueImageUrl: null,
  nearestStations: [],
} as never;

const renderBlock = () =>
  render(
    <MemoryRouter>
      <VenueBlock location={location} />
    </MemoryRouter>,
  );

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('VenueBlock venue-add flag', () => {
  it('flag off: street + postcode as before, no feedback control, tile alone', () => {
    vi.stubEnv('VITE_ENABLE_VENUE_ADD', 'false');
    const { container } = renderBlock();
    expect(screen.getByText('35-37 Battersea Rise, SW11 1HG')).toBeTruthy();
    expect(screen.queryByText('Something wrong?')).toBeNull();
    expect(container.firstElementChild?.className).toBe('flex h-full w-full flex-col gap-1');
  });

  it('flag on: one-line address, control is outside the tile link, signed out gets a sign-in prompt', () => {
    vi.stubEnv('VITE_ENABLE_VENUE_ADD', 'true');
    const { container } = renderBlock();
    expect(screen.getByText('35-37 Battersea Rise, London SW11 1HG')).toBeTruthy();
    const btn = screen.getByText('Something wrong?');
    expect(btn.closest('a')).toBeNull();
    expect(container.querySelector('a')).not.toBeNull();
    fireEvent.click(btn);
    expect(screen.getByText('Sign in to tell us what is wrong')).toBeTruthy();
    expect(document.querySelector('textarea')).toBeNull();
  });
});

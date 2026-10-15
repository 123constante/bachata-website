// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Avatar } from '@/modules/dancer-app/screens/me/ui';

// R1a: 2 prod dancer_profiles rows keep an avatar on a host outside app/csp.ts img-src, so the
// browser refuses the image. The avatar must fall back to the initial, never a broken-image icon.
afterEach(cleanup);

describe('dancer-app Avatar', () => {
  it('shows the photo when the URL loads', () => {
    render(<Avatar profile={{ avatar_url: 'https://pub-x.r2.dev/a.jpg', first_name: 'Ana', display_name: null }} size={52} />);
    expect(screen.getByTestId('me-photo')).toBeTruthy();
  });
  it('falls back to the initial when the image fails (legacy foreign host, CSP-blocked)', () => {
    render(<Avatar profile={{ avatar_url: 'https://legacy-cdn.example.net/old.jpg', first_name: 'Ana', display_name: null }} size={52} />);
    fireEvent.error(screen.getByTestId('me-photo'));
    expect(screen.queryByTestId('me-photo')).toBeNull();
    expect(screen.getByTestId('me-photo-placeholder').textContent).toBe('A');
  });
  it('no photo: the initial', () => {
    render(<Avatar profile={{ avatar_url: null, first_name: 'Ana', display_name: null }} size={52} />);
    expect(screen.getByTestId('me-photo-placeholder').textContent).toBe('A');
  });
});

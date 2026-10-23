// @vitest-environment jsdom
/** D84: /invite/* and /admin/organisers use the organiser area's plain background; the public site keeps its wash. */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GlobalLayout from '../GlobalLayout';
import { PLAIN_BACKGROUND_COLOR, PLAIN_BACKGROUND_ROUTES, isPlainBackgroundPath } from '../plainBackground';

afterEach(cleanup);

const bgAt = (path: string) => {
  render(<MemoryRouter initialEntries={[path]}><GlobalLayout showSubheader={false}><p>x</p></GlobalLayout></MemoryRouter>);
  return screen.getByTestId('layout-bg');
};

describe('D84 plain background routes', () => {
  it('names exactly the two route families', () => {
    expect([...PLAIN_BACKGROUND_ROUTES]).toEqual(['/invite', '/admin/organisers']);
  });

  it.each(['/invite', '/invite/abc123', '/admin/organisers'])('%s is plain: organiser surface, no doodles', (path) => {
    expect(isPlainBackgroundPath(path)).toBe(true);
    const bg = bgAt(path);
    expect(bg.getAttribute('data-bg')).toBe('plain');
    expect(bg.style.backgroundColor).not.toBe('');
    expect(PLAIN_BACKGROUND_COLOR).toBe('#0f0d0b');
    expect(document.querySelector('svg.lucide-star, [data-floating]')).toBeNull();
  });

  it.each(['/', '/parties', '/organisers', '/invites', '/admin/organisers-x'])('%s keeps the public wash', (path) => {
    expect(isPlainBackgroundPath(path)).toBe(false);
    expect(bgAt(path).getAttribute('data-bg')).not.toBe('plain');
  });
});

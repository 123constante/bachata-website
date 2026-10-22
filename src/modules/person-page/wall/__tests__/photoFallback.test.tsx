// @vitest-environment jsdom
/**
 * W2-D bundled fix: a wall tile whose photo URL is dead (real case: "Jxjx" on /dancers) shows the
 * initials tile, never a broken image, both when the error fires after hydration (onError) and when the
 * SSR'd <img> already failed before hydration attached onError (checked once after mount). React props
 * only: the site CSP blocks inline handlers.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WallTile } from '../WallTile';
import type { WallPerson } from '../model';

vi.mock('@/lib/profileViewEmit', () => ({ emitProfileView: vi.fn() }));

const person: WallPerson = {
  id: 'p1', name: 'Jxjx', photo: 'https://x.test/gone.jpg', flagCode: null, href: '/dancers/p1',
  tags: [], lead: 'dancer', dateLabel: null, profileType: 'dancer',
};
const mount = () => render(<MemoryRouter><WallTile person={person} list="dancers" /></MemoryRouter>);

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('wall tile photo fallback', () => {
  it('the error fires after mount: initials', () => {
    mount();
    act(() => { fireEvent.error(document.querySelector('img') as HTMLImageElement); });
    expect(screen.getByTestId('wall-face').getAttribute('data-face')).toBe('initials');
    expect(screen.getByTestId('wall-face').textContent).toBe('J');
  });
  it('the image already failed before hydration (complete, no pixels): initials after mount', () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);
    mount();
    expect(screen.getByTestId('wall-face').getAttribute('data-face')).toBe('initials');
    expect(document.querySelector('img')).toBeNull();
  });
  it('a photo that loaded stays', () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(320);
    mount();
    expect(screen.getByTestId('wall-face').getAttribute('data-face')).toBe('photo');
  });
});

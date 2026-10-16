// @vitest-environment jsdom
/**
 * Audit H4 / H11 / M29: the header picture, the switcher sheet row and the
 * dancer Me/Home avatar are ONE avatar. For every prod shape they show the same
 * face: the photo, the initial of a real name, or a person glyph -- never the
 * placeholder's "Y", never a broken-image icon, and the no-photo disc is
 * visible (>= 3:1) on the plum header and on the sheet.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { profileSides, type SidesFacts } from '@/lib/accountRouting';
import { DANCER_TOKENS, contrastRatio } from '@/modules/dancer-app/theme/tokens';

const sides = vi.hoisted(() => ({ facts: null as unknown as SidesFacts }));
vi.mock('../useProfileSides', () => ({
  useProfileSides: () => ({ facts: sides.facts, state: profileSides(sides.facts), openRequestCount: 0 }),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' }, signOut: async () => 'signed-out' }) }));

import { ProfileSwitcher } from '../ProfileSwitcher';
import { Avatar } from '@/modules/dancer-app/screens/me/ui';
import { AvatarUpload } from '@/components/profile/AvatarUpload';

afterEach(cleanup);

const PHOTO = 'https://legacy-cdn.example.net/old.jpg';
type Shape = { label: string; firstName: string | null; avatarUrl: string | null; broken: boolean; face: 'photo' | 'initial' | 'glyph'; letter: string };
const SHAPES: Shape[] = [
  { label: 'no photo, named', firstName: 'Ana', avatarUrl: null, broken: false, face: 'initial', letter: 'A' },
  { label: 'no photo, no name yet (empty stub)', firstName: null, avatarUrl: null, broken: false, face: 'glyph', letter: '' },
  { label: 'photo loads', firstName: 'Ana', avatarUrl: PHOTO, broken: false, face: 'photo', letter: '' },
  { label: 'broken photo, named', firstName: 'Ana', avatarUrl: PHOTO, broken: true, face: 'initial', letter: 'A' },
  { label: 'broken photo, no name', firstName: null, avatarUrl: PHOTO, broken: true, face: 'glyph', letter: '' },
];

const facts = (s: Shape): SidesFacts => ({ organisers: [], dancer: 'complete', areaAllowed: true, dancerFace: { firstName: s.firstName, avatarUrl: s.avatarUrl } });

/** Each surface returns the avatar's root element for a shape. */
const SURFACES: Array<[string, (s: Shape) => HTMLElement]> = [
  ['header picture', (s) => {
    sides.facts = facts(s);
    render(<MemoryRouter initialEntries={['/app/home']}><ProfileSwitcher where={{ area: 'dancer' }} /></MemoryRouter>);
    return screen.getByTestId('profile-switcher-button').firstElementChild as HTMLElement;
  }],
  ['switcher sheet row', (s) => {
    sides.facts = facts(s);
    render(<MemoryRouter initialEntries={['/app/home']}><ProfileSwitcher where={{ area: 'dancer' }} /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('profile-switcher-button'));
    return screen.getByTestId('profile-switcher-side-dancer').firstElementChild as HTMLElement;
  }],
  ['Me / Home avatar', (s) => {
    render(<Avatar profile={{ avatar_url: s.avatarUrl, first_name: s.firstName, display_name: null, surname: null, hide_surname_publicly: false }} size={52} />);
    return (screen.queryByTestId('me-photo') ?? screen.getByTestId('me-photo-placeholder')) as HTMLElement;
  }],
  // The Finish screen's photo field (it was a shadcn Avatar with a see-through bg-muted/50 fallback).
  ['Finish profile photo field', (s) => {
    render(<AvatarUpload value={s.avatarUrl} name={s.firstName} userId="persona-1" onChange={() => {}} />);
    return (screen.queryByTestId('avatar-upload-photo') ?? screen.getByTestId('avatar-upload-empty')) as HTMLElement;
  }],
];

const faceOf = (el: HTMLElement) => (el.tagName === 'IMG' ? 'photo' : el.querySelector('svg') ? 'glyph' : 'initial');

describe.each(SURFACES)('%s', (_surface, mount) => {
  it.each(SHAPES)('$label', (s) => {
    let el = mount(s);
    if (s.broken) {
      expect(el.tagName).toBe('IMG');
      const parent = el.parentElement as HTMLElement;
      fireEvent.error(el);
      el = parent.querySelector('[data-face]') as HTMLElement;
    }
    expect(el.getAttribute('data-face')).toBe(s.face);
    expect(faceOf(el)).toBe(s.face);
    if (s.face !== 'photo') expect(el.textContent).toBe(s.letter);
    // The no-photo disc on every surface: the avatar token (site fallback muted-foreground), never black or see-through.
    if (s.face !== 'photo') {
      expect(el.style.background).toBe('var(--da-avatar, hsl(var(--muted-foreground)))');
      expect(el.className).not.toMatch(/bg-(background|black|transparent)|bg-muted\/\d+/);
    }
  });
});

describe('the no-photo disc is visible', () => {
  it('--da-avatar is >= 3:1 on the header (--da-bg) and the sheet (--da-surface), and its letter is AA', () => {
    const disc = (DANCER_TOKENS as Record<string, string>)['--da-avatar'];
    expect(disc).toBeTruthy();
    expect(contrastRatio(disc, DANCER_TOKENS['--da-bg'])).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(disc, DANCER_TOKENS['--da-surface'])).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(DANCER_TOKENS['--da-text'], disc)).toBeGreaterThanOrEqual(4.5);
  });
});

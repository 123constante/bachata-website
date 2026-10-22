// @vitest-environment jsdom
/**
 * W1 review C7: PersonChip's profile-view telemetry logs the profile the LINK opens. Since W1
 * a lineup teacher who is also a DJ links /djs/:id, so logging the feed's 'teacher' no longer
 * matched the destination. Every accepted emitProfileView type (profileViewEmit.ts) x link.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const emit = vi.hoisted(() => vi.fn());
vi.mock('@/lib/profileViewEmit', () => ({ emitProfileView: emit }));

import { PersonChip } from '../schedule/PersonChip';

const ID = 'p-1';
const CASES: Array<[string, string, string | null, string]> = [
  // name, href, feed profileType, logged profileType
  ['teacher in the feed, links the DJ page', `/djs/${ID}`, 'teacher', 'dj'],
  ['teacher in the feed, links the dancer page', `/dancers/${ID}`, 'teacher', 'dancer'],
  ['dj in the feed, links the dancer page', `/dancers/${ID}`, 'dj', 'dancer'],
  ['dancer in the feed, links the DJ page', `/djs/${ID}`, 'dancer', 'dj'],
  ['teacher page (open)', `/teachers/${ID}`, 'teacher', 'teacher'],
  ['vendor', `/vendors/${ID}`, 'vendor', 'vendor'],
  ['organiser', `/organisers/${ID}`, 'organiser', 'organiser'],
  ['unknown link keeps the feed type', `/somewhere/${ID}`, 'videographer', 'videographer'],
];

afterEach(() => { cleanup(); emit.mockReset(); });

describe('PersonChip telemetry follows the link', () => {
  it.each(CASES)('%s', (_n, href, profileType, logged) => {
    const person = { id: ID, name: 'Ana', href, avatarUrl: null, role: 'Teacher', profileType, level: null };
    const { container } = render(<MemoryRouter><PersonChip person={person} context="schedule" eventId="e1" /></MemoryRouter>);
    fireEvent.click(container.querySelector('a')!);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ personId: ID, profileType: logged, eventId: 'e1' }));
    // Review round 1 F8: the data attribute names the same profile as the telemetry.
    expect(container.querySelector('a')!.getAttribute('data-profile-type')).toBe(logged);
  });
  it('an unlinked chip keeps the feed type (or unknown)', () => {
    const base = { id: ID, name: 'Ana', href: null, avatarUrl: null, role: 'Teacher', level: null };
    const { container } = render(<MemoryRouter><PersonChip person={{ ...base, profileType: 'teacher' }} context="schedule" /></MemoryRouter>);
    expect(container.querySelector('[data-person-id]')!.getAttribute('data-profile-type')).toBe('teacher');
    cleanup();
    const again = render(<MemoryRouter><PersonChip person={{ ...base, profileType: null }} context="schedule" /></MemoryRouter>);
    expect(again.container.querySelector('[data-person-id]')!.getAttribute('data-profile-type')).toBe('unknown');
  });
});

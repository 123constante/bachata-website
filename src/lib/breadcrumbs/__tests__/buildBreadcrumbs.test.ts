import { describe, expect, it } from 'vitest';
import {
  buildBreadcrumbs,
  resolveEventParent,
  type EventType,
} from '@/lib/breadcrumbs';

describe('resolveEventParent', () => {
  it('maps party-like types to parties', () => {
    expect(resolveEventParent('party')).toBe('parties');
    expect(resolveEventParent('social')).toBe('parties');
  });
  it('maps class-like types to classes', () => {
    expect(resolveEventParent('class')).toBe('classes');
    expect(resolveEventParent('workshop')).toBe('classes');
    expect(resolveEventParent('social_class')).toBe('classes');
    expect(resolveEventParent('masterclass')).toBe('classes');
  });
  it('maps festival-like types to festivals', () => {
    expect(resolveEventParent('festival')).toBe('festivals');
    expect(resolveEventParent('congress')).toBe('festivals');
  });
  it('falls back to parties for undefined / unknown', () => {
    expect(resolveEventParent(undefined)).toBe('parties');
    expect(resolveEventParent('not-a-real-type' as EventType)).toBe('parties');
  });
});

describe('buildBreadcrumbs — top-level listings', () => {
  it('parties → [Parties]', () => {
    expect(buildBreadcrumbs('parties')).toEqual([{ label: 'Parties' }]);
  });
  it('classes → [Classes]', () => {
    expect(buildBreadcrumbs('classes')).toEqual([{ label: 'Classes' }]);
  });
  it('experience → [Experience]', () => {
    expect(buildBreadcrumbs('experience')).toEqual([{ label: 'Experience' }]);
  });
  it('venues → [Venues]', () => {
    expect(buildBreadcrumbs('venues')).toEqual([{ label: 'Venues' }]);
  });
  it('cities → [Cities]', () => {
    expect(buildBreadcrumbs('cities')).toEqual([{ label: 'Cities' }]);
  });
  it('profile → [Profile]', () => {
    expect(buildBreadcrumbs('profile')).toEqual([{ label: 'Profile' }]);
  });
});

describe('buildBreadcrumbs — nested listings', () => {
  it('djs → [Parties (link), DJs]', () => {
    expect(buildBreadcrumbs('djs')).toEqual([
      { label: 'Parties', path: '/parties' },
      { label: 'DJs' },
    ]);
  });
  it('teachers → [Classes (link), Teachers]', () => {
    expect(buildBreadcrumbs('teachers')).toEqual([
      { label: 'Classes', path: '/classes' },
      { label: 'Teachers' },
    ]);
  });
  it('festivals → [Experience (link), Festivals]', () => {
    expect(buildBreadcrumbs('festivals')).toEqual([
      { label: 'Experience', path: '/experience' },
      { label: 'Festivals' },
    ]);
  });
  it('organisers → [Parties (link), Organisers]', () => {
    expect(buildBreadcrumbs('organisers')).toEqual([
      { label: 'Parties', path: '/parties' },
      { label: 'Organisers' },
    ]);
  });
});

describe('buildBreadcrumbs — entity detail routes (non-event)', () => {
  it('dancer.detail with name → [Dancers (link), name]', () => {
    expect(buildBreadcrumbs('dancer.detail', { entityName: 'Ana' })).toEqual([
      { label: 'Dancers', path: '/dancers' },
      { label: 'Ana' },
    ]);
  });
  it('dj.detail with name → [Parties (link), DJs (link), name]', () => {
    expect(buildBreadcrumbs('dj.detail', { entityName: 'DJ Maria' })).toEqual([
      { label: 'Parties', path: '/parties' },
      { label: 'DJs', path: '/djs' },
      { label: 'DJ Maria' },
    ]);
  });
  it('teacher.detail with name → [Classes, Teachers, name]', () => {
    expect(buildBreadcrumbs('teacher.detail', { entityName: 'Carla' })).toEqual([
      { label: 'Classes', path: '/classes' },
      { label: 'Teachers', path: '/teachers' },
      { label: 'Carla' },
    ]);
  });
  it('venue.detail with name → [Venues (link), name]', () => {
    expect(buildBreadcrumbs('venue.detail', { entityName: 'Velvet Room' })).toEqual([
      { label: 'Venues', path: '/venues' },
      { label: 'Velvet Room' },
    ]);
  });
  it('festival.detail with name → [Experience, Festivals, name]', () => {
    expect(buildBreadcrumbs('festival.detail', { entityName: 'BachataFest' })).toEqual([
      { label: 'Experience', path: '/experience' },
      { label: 'Festivals', path: '/festivals' },
      { label: 'BachataFest' },
    ]);
  });
});

describe('buildBreadcrumbs — entity detail routes (loading state)', () => {
  it('drops the entity crumb when loading and promotes parent to current page', () => {
    expect(
      buildBreadcrumbs('dancer.detail', { entityName: undefined, isLoading: true }),
    ).toEqual([{ label: 'Dancers' }]);
  });
  it('drops the entity crumb when loading on a deep chain', () => {
    expect(
      buildBreadcrumbs('dj.detail', { entityName: undefined, isLoading: true }),
    ).toEqual([
      { label: 'Parties', path: '/parties' },
      { label: 'DJs' },
    ]);
  });
  it('drops entity crumb when entityName missing even if isLoading is false', () => {
    // Treats "no entity name" as a loading-equivalent state — graceful
    // degradation. Avoids ever rendering the placeholder ('Dancer', 'DJ',
    // etc.) on a real page; the parent listing becomes the current page.
    expect(
      buildBreadcrumbs('dancer.detail', { entityName: undefined, isLoading: false }),
    ).toEqual([{ label: 'Dancers' }]);
  });
});

describe('buildBreadcrumbs — event.detail (type-aware parent)', () => {
  it('party event → [Parties (link), name]', () => {
    expect(
      buildBreadcrumbs('event.detail', {
        entityName: 'Salsa Night',
        eventType: 'party',
      }),
    ).toEqual([
      { label: 'Parties', path: '/parties' },
      { label: 'Salsa Night' },
    ]);
  });
  it('class event → [Classes (link), name]', () => {
    expect(
      buildBreadcrumbs('event.detail', {
        entityName: 'Footwork Workshop',
        eventType: 'class',
      }),
    ).toEqual([
      { label: 'Classes', path: '/classes' },
      { label: 'Footwork Workshop' },
    ]);
  });
  it('festival event → [Experience, Festivals (link), name]', () => {
    expect(
      buildBreadcrumbs('event.detail', {
        entityName: 'BachataFest 2026',
        eventType: 'festival',
      }),
    ).toEqual([
      { label: 'Experience', path: '/experience' },
      { label: 'Festivals', path: '/festivals' },
      { label: 'BachataFest 2026' },
    ]);
  });
  it('falls back to parties for unknown event type', () => {
    expect(
      buildBreadcrumbs('event.detail', {
        entityName: 'Mystery Event',
        eventType: undefined,
      }),
    ).toEqual([
      { label: 'Parties', path: '/parties' },
      { label: 'Mystery Event' },
    ]);
  });
  it('loading event → drops entity crumb, parent becomes current page', () => {
    expect(
      buildBreadcrumbs('event.detail', {
        entityName: undefined,
        eventType: 'party',
        isLoading: true,
      }),
    ).toEqual([{ label: 'Parties' }]);
  });
});

describe('buildBreadcrumbs — event.edit (entity intermediate crumb)', () => {
  it('produces [Parties (link), event name (link), Edit]', () => {
    expect(
      buildBreadcrumbs('event.edit', {
        entityName: 'Salsa Night',
        eventType: 'party',
        entityId: 'abc-123',
      }),
    ).toEqual([
      { label: 'Parties', path: '/parties' },
      { label: 'Salsa Night', path: '/event/abc-123' },
      { label: 'Edit' },
    ]);
  });
  it('class event edit → [Classes (link), name (link), Edit]', () => {
    expect(
      buildBreadcrumbs('event.edit', {
        entityName: 'Body Movement',
        eventType: 'class',
        entityId: 'xyz-789',
      }),
    ).toEqual([
      { label: 'Classes', path: '/classes' },
      { label: 'Body Movement', path: '/event/xyz-789' },
      { label: 'Edit' },
    ]);
  });
  it('without entityId, intermediate event crumb has no path (graceful)', () => {
    const result = buildBreadcrumbs('event.edit', {
      entityName: 'Salsa Night',
      eventType: 'party',
      entityId: undefined,
    });
    expect(result[1]).toEqual({ label: 'Salsa Night' });
  });
  it('without entityName, falls back to placeholder for intermediate crumb', () => {
    const result = buildBreadcrumbs('event.edit', {
      entityName: undefined,
      eventType: 'party',
      entityId: 'abc',
    });
    // Intermediate uses placeholder label "Event" when entityName missing
    expect(result[1]).toEqual({ label: 'Event', path: '/event/abc' });
  });
});

describe('buildBreadcrumbs — flow routes', () => {
  it('profile.edit → [Profile (link), Edit]', () => {
    expect(buildBreadcrumbs('profile.edit')).toEqual([
      { label: 'Profile', path: '/profile' },
      { label: 'Edit' },
    ]);
  });
  it('profile.createEvent → [Profile (link), Create event]', () => {
    expect(buildBreadcrumbs('profile.createEvent')).toEqual([
      { label: 'Profile', path: '/profile' },
      { label: 'Create event' },
    ]);
  });
  it('profile.createDancer → [Profile (link), Create dancer profile]', () => {
    expect(buildBreadcrumbs('profile.createDancer')).toEqual([
      { label: 'Profile', path: '/profile' },
      { label: 'Create dancer profile' },
    ]);
  });
});

describe('buildBreadcrumbs — invariants', () => {
  it('every output array has at least 1 item', () => {
    const sampleRoutes = [
      'parties', 'djs', 'profile', 'cities',
    ] as const;
    for (const r of sampleRoutes) {
      expect(buildBreadcrumbs(r).length).toBeGreaterThanOrEqual(1);
    }
  });
  it('the last crumb never has a path', () => {
    expect(buildBreadcrumbs('djs').at(-1)?.path).toBeUndefined();
    expect(
      buildBreadcrumbs('dj.detail', { entityName: 'X' }).at(-1)?.path,
    ).toBeUndefined();
    expect(
      buildBreadcrumbs('event.edit', { entityName: 'X', eventType: 'party', entityId: 'a' }).at(-1)?.path,
    ).toBeUndefined();
  });
  it('intermediate crumbs always have a path (when entityId given)', () => {
    const r = buildBreadcrumbs('event.edit', {
      entityName: 'X',
      eventType: 'party',
      entityId: 'a',
    });
    for (let i = 0; i < r.length - 1; i++) {
      expect(r[i].path).toBeTruthy();
    }
  });
});

import { describe, expect, it } from 'vitest';
import {
  OWNER_CANCEL_KEYS,
  OWNER_COMMAND_KINDS,
  OWNER_OVERRIDE_KEYS,
  OWNER_UPSERT_KEYS,
  addDateCommand,
  basicsPayload,
  cancelCommand,
  envelope,
  hasBasicsChanges,
  lifecycleCommand,
  overrideCommand,
  removeDateCommand,
  resetTimeCommand,
  setTimeCommand,
  skipDateCommand,
  uncancelCommand,
  unskipDateCommand,
  upsertCommand,
  type BasicsDraft,
  type OverridePatch,
} from '../seriesCommands';

// The server's owner allowlist, copied from the admin repo's
// supabase/migrations/20261108180000_p5_owner_allowlist_recurring_create_v1.sql
// (apply_aggregate_write_p5: v_owner_kinds, v_owner_upsert_keys,
// v_owner_override_keys, v_owner_cancel_keys; the newest redefinition as of
// 2026-10-04). The Website cannot read that file in CI, so the literal is
// pinned here: when the server list changes, this spec and the mirror change
// together.
const SERVER_OWNER_KINDS = [
  'series.upsert', 'series.add_date', 'series.remove_date', 'occurrence.set_time',
  'series.set_lifecycle', 'occurrence.cancel', 'occurrence.set_override', 'series.skip_date',
  'series.unskip_date', 'series.set_recurrence', 'series.stop_repeating', 'series.end_run',
];
const SERVER_UPSERT_KEYS = [
  'name', 'slug', 'default_venue_id', 'default_city_id', 'default_local_start_time',
  'default_duration_minutes', 'default_start_date', 'default_level', 'default_ticket_url',
  'default_description', 'default_cover_image_url', 'default_music_styles', 'default_gallery',
  'default_video_urls', 'timezone',
];
const SERVER_OVERRIDE_KEYS = ['venue_id', 'city_id', 'cancellation_reason_label', 'cover_image_url', 'ticket_url', 'description'];
const SERVER_CANCEL_KEYS = ['cancelled', 'reason'];

const base: BasicsDraft = {
  name: 'Tuesday Bachata Class',
  description: 'Friendly weekly class',
  venueId: 'venue-1',
  startTime: '19:00',
  durationMinutes: 150,
  level: 'beginner',
  ticketUrl: 'https://tickets.example/tue',
  coverImageUrl: '',
};

describe('the owner allowlist mirror', () => {
  it('matches the server constants exactly', () => {
    expect([...OWNER_COMMAND_KINDS].sort()).toEqual([...SERVER_OWNER_KINDS].sort());
    expect([...OWNER_UPSERT_KEYS].sort()).toEqual([...SERVER_UPSERT_KEYS].sort());
    expect([...OWNER_OVERRIDE_KEYS].sort()).toEqual([...SERVER_OVERRIDE_KEYS].sort());
    expect([...OWNER_CANCEL_KEYS].sort()).toEqual([...SERVER_CANCEL_KEYS].sort());
  });

  it('never sends an admin-only override key (the handler accepts them, the owner gate refuses)', () => {
    for (const key of ['lifecycle', 'title', 'level', 'music_styles', 'gallery', 'passes', 'promo_codes', 'featured', 'custom_local_start_time']) {
      expect(SERVER_OVERRIDE_KEYS).not.toContain(key);
    }
  });
});

describe('envelope', () => {
  it('carries target, version, a uuid idempotency key and the command', () => {
    const env = envelope('ser-1', 7, addDateCommand('2026-10-13'));
    expect(Object.keys(env).sort()).toEqual(['command', 'expected_version', 'idempotency_key', 'target_id']);
    expect(env.target_id).toBe('ser-1');
    expect(env.expected_version).toBe(7);
    expect(env.idempotency_key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(env.command).toEqual({ kind: 'series.add_date', payload: { date: '2026-10-13' } });
  });

  it('omits expected_version when the version is unknown', () => {
    expect('expected_version' in envelope('o-1', null, uncancelCommand())).toBe(false);
  });

  it('a fresh key per envelope (a retry of a NEW save must not replay an old one)', () => {
    expect(envelope('s', 1, lifecycleCommand('paused')).idempotency_key).not.toBe(envelope('s', 1, lifecycleCommand('paused')).idempotency_key);
  });
});

describe('basicsPayload', () => {
  it('sends the name plus only the fields that changed', () => {
    const payload = basicsPayload(base, { ...base, startTime: '19:30', ticketUrl: ' https://tickets.example/new ' });
    expect(payload).toEqual({
      name: 'Tuesday Bachata Class',
      default_local_start_time: '19:30',
      default_ticket_url: 'https://tickets.example/new',
    });
  });

  it('never emits a key outside the owner upsert allowlist, whatever changes', () => {
    const everything: BasicsDraft = {
      name: 'New name', description: 'New', venueId: 'venue-2', startTime: '20:00', durationMinutes: 90,
      level: 'advanced', ticketUrl: 'https://x.example', coverImageUrl: 'https://img.example/a.jpg',
    };
    const keys = Object.keys(basicsPayload(base, everything));
    expect(keys.filter((k) => !SERVER_UPSERT_KEYS.includes(k))).toEqual([]);
    expect(keys.sort()).toEqual([
      'default_cover_image_url', 'default_description', 'default_duration_minutes', 'default_level',
      'default_local_start_time', 'default_ticket_url', 'default_venue_id', 'name',
    ]);
    // No organiser, format, slug or timezone: an owner cannot move or reshape a series here.
    expect(keys).not.toContain('format');
    expect(keys).not.toContain('slug');
  });

  it('clears a text field with blank (the handler NULLIFs it) and sends duration as a number', () => {
    expect(basicsPayload(base, { ...base, level: '', durationMinutes: 120 })).toEqual({
      name: 'Tuesday Bachata Class', default_level: '', default_duration_minutes: 120,
    });
  });

  it('never clears the venue or the duration by omission', () => {
    expect(basicsPayload(base, { ...base, venueId: null, durationMinutes: null })).toEqual({ name: 'Tuesday Bachata Class' });
  });

  it('knows when there is nothing to save', () => {
    expect(hasBasicsChanges(base, { ...base })).toBe(false);
    expect(hasBasicsChanges(base, { ...base, name: 'Renamed' })).toBe(true);
    expect(hasBasicsChanges(base, { ...base, description: 'x' })).toBe(true);
  });

  it('wraps into a series.upsert command', () => {
    expect(upsertCommand({ name: 'X' })).toEqual({ kind: 'series.upsert', payload: { name: 'X' } });
  });
});

describe('date commands', () => {
  it('builds the exact payloads the owner gate checks', () => {
    expect(removeDateCommand('o-1')).toEqual({ kind: 'series.remove_date', payload: { occurrence_id: 'o-1' } });
    expect(skipDateCommand('o-1')).toEqual({ kind: 'series.skip_date', payload: { occurrence_id: 'o-1' } });
    expect(unskipDateCommand('2026-10-20')).toEqual({ kind: 'series.unskip_date', payload: { date: '2026-10-20' } });
    expect(lifecycleCommand('archived')).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'archived' } });
  });

  it('cancel names a reason; un-cancel sends only cancelled:false', () => {
    expect(cancelCommand('Venue closed')).toEqual({ kind: 'occurrence.cancel', payload: { cancelled: true, reason: 'Venue closed' } });
    expect(uncancelCommand()).toEqual({ kind: 'occurrence.cancel', payload: { cancelled: false } });
    for (const cmd of [cancelCommand('Other'), uncancelCommand()]) {
      expect(Object.keys(cmd.payload).filter((k) => !SERVER_CANCEL_KEYS.includes(k))).toEqual([]);
    }
  });

  it('set_time sends the typed wall-clock digits, never a converted instant', () => {
    expect(setTimeCommand('20:00', '22:30')).toEqual({ kind: 'occurrence.set_time', payload: { new_local_start: '20:00', new_local_end: '22:30' } });
    expect(setTimeCommand('20:00', '')).toEqual({ kind: 'occurrence.set_time', payload: { new_local_start: '20:00', new_local_end: null } });
    expect(resetTimeCommand()).toEqual({ kind: 'occurrence.set_time', payload: { reset: true } });
  });

  it('set_override keeps only owner keys, trims, and sends null for "back to the series"', () => {
    const patch = { ticket_url: ' https://t.example ', description: '', title: 'Hijack', lifecycle: 'cancelled' } as unknown as OverridePatch;
    const cmd = overrideCommand(patch);
    expect(cmd).toEqual({ kind: 'occurrence.set_override', payload: { ticket_url: 'https://t.example', description: null } });
    expect(Object.keys(cmd.payload).filter((k) => !SERVER_OVERRIDE_KEYS.includes(k))).toEqual([]);
    expect(overrideCommand({ venue_id: null })).toEqual({ kind: 'occurrence.set_override', payload: { venue_id: null } });
  });

  it('refuses to build an empty override (the server refuses {} for owners)', () => {
    expect(() => overrideCommand({})).toThrow();
    expect(() => overrideCommand({ title: 'x' } as unknown as OverridePatch)).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { R4_INVITED_COPY, agoWord, buildR4Invited, parseInvitesSent } from '../r4InvitedModel';

// Prod survey 2026-11-19 (organiser_invites, organiser_door_invites; counts only): 24 team invites, all
// member_role 'owner'; 1 open (email, no first name), 23 used/revoked/expired (14 with email, 3 of them
// with a first name, 9 with neither). 0 door invites. Row shapes below are what the server's B1 rule
// can return: email (admin caller or invite issued by a current manager), first name, NULL, door (NULL).
const NOW = new Date('2026-11-19T12:00:00Z');
const team = (label: string | null, role = 'owner', sent = '2026-11-17T11:00:00Z') => ({
  invite_id: `t-${label ?? 'null'}-${role}`, kind: 'team', role, invitee_label: label, sent_at: sent, expires_at: '2026-11-26T11:00:00Z', occurrence_id: null, occurrence_date: null,
});
const door = { invite_id: 'door:abcdef0123456789', kind: 'door_seat', role: 'door', invitee_label: null, sent_at: '2026-11-19T10:00:00Z', expires_at: '2026-11-21T12:00:00Z', occurrence_id: 'o1', occurrence_date: '2026-11-20' };

const build = (rows: unknown[]) => buildR4Invited({ editor: true, read: 'ready', data: parseInvitesSent({ ok: true, rows }), now: NOW });

describe('R4 Team Invited rows: every row shape the read can return', () => {
  it.each([
    ['team, email (manager-issued)', team('dancer@x.test'), 'dancer@x.test', 'Owner', 'Sent 2 days ago'],
    ['team, first name only', team('Ana', 'manager'), 'Ana', 'Manager', 'Sent 2 days ago'],
    ['team, NULL label', team(null, 'contributor'), R4_INVITED_COPY.nullLabel, 'Contributor', 'Sent 2 days ago'],
    ['door seat, NULL label always', door, R4_INVITED_COPY.nullLabel, 'Door, one night', 'Ends Saturday 21 November, 12pm'],
  ])('%s', (_n, row, label, role, when) => {
    const m = build([row]);
    expect(m.state).toBe('rows');
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0]).toMatchObject({ label, role, when });
  });

  it('a door row never shows a name, even if the server sent one', () => {
    const m = build([{ ...door, invitee_label: 'Made Up' }]);
    expect(m.rows[0].label).toBe(R4_INVITED_COPY.nullLabel);
  });

  it('blank label is the NULL label, never an empty row', () => {
    expect(build([team('   ')]).rows[0].label).toBe(R4_INVITED_COPY.nullLabel);
  });

  it('team and door together keep the server order', () => {
    expect(build([door, team('Ana')]).rows.map((r) => r.kind)).toEqual(['door_seat', 'team']);
  });

  it('empty: section hidden', () => {
    expect(build([])).toEqual({ state: 'hidden', rows: [] });
  });

  it('not authorised (ok:false): section hidden, never an error', () => {
    const m = buildR4Invited({ editor: true, read: 'ready', data: parseInvitesSent({ ok: false, reason: 'not_authorised', rows: [] }), now: NOW });
    expect(m.state).toBe('hidden');
  });

  it('read error: plain words with retry', () => {
    const m = buildR4Invited({ editor: true, read: 'error', now: NOW });
    expect(m.state).toBe('error');
    expect(R4_INVITED_COPY.error).toMatch(/^We could not load who you have invited\./);
    expect(R4_INVITED_COPY.retry).toBe('Try again');
  });

  it('loading or contributor viewer: hidden', () => {
    expect(buildR4Invited({ editor: true, read: 'loading', now: NOW }).state).toBe('hidden');
    expect(buildR4Invited({ editor: false, read: 'ready', data: { ok: true, rows: parseInvitesSent({ ok: true, rows: [team('Ana')] }).rows }, now: NOW }).state).toBe('hidden');
  });

  it('a bad shape is an error, never an empty list; unknown kinds are dropped', () => {
    expect(() => parseInvitesSent(null)).toThrow();
    expect(() => parseInvitesSent({ ok: true, rows: 'x' })).toThrow();
    expect(parseInvitesSent({ ok: true, rows: [{ invite_id: 'x', kind: 'other' }] }).rows).toEqual([]);
  });

  it('ago words', () => {
    expect(agoWord('2026-11-19T11:59:40Z', NOW)).toBe('just now');
    expect(agoWord('2026-11-19T11:59:00Z', NOW)).toBe('1 minute ago');
    expect(agoWord('2026-11-19T09:00:00Z', NOW)).toBe('3 hours ago');
    expect(agoWord('2026-11-18T12:00:00Z', NOW)).toBe('1 day ago');
    expect(agoWord(null, NOW)).toBeNull();
    expect(agoWord('nope', NOW)).toBeNull();
  });

  it('copy is plain ASCII (no mojibake-prone punctuation)', () => {
    for (const v of Object.values(R4_INVITED_COPY)) expect(v).not.toMatch(/[\u0080-￿]/);
  });
});

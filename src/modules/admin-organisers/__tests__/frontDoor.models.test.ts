import { describe, expect, it } from 'vitest';
import {
  CHIPS, NEEDS_REASONS, parseAddResult, parseFrontDoorList, parseNeedsYou, parseResolveResult, parseSendResult,
  type Chip, type FrontDoorRow, type InviteStatus,
} from '../frontDoorApi';
import { ADD_ERROR_TEXT, EMPTY_FORM, errorFor, outcomeFor, submitBlockedReason, RUN_BY_US_WHY } from '../addOrganiserModel';
import { CHIP_LABEL, chipCounts, filterRows, runByUsControl, runByUsMessage, sendControl, sendMessage } from '../frontDoorListModel';
import { REASON_LABEL, badgeText, canResolve, groupItems, resolveMessage } from '../needsYouModel';

const RAW = /^[a-z_]+$/;
const created = (o: Record<string, unknown> = {}) => parseAddResult({ success: true, organiser_id: 'o1', person_reused: false, invite_queued: true, run_by_us: false, already_exists: false, warnings: [], ...o });

describe('add organiser: result x email', () => {
  for (const email of [true, false]) {
    it(`created, email ${email}`, () => {
      const r = created({ invite_queued: email, run_by_us: !email });
      if (r.kind !== 'created') throw new Error('kind');
      const o = outcomeFor(r);
      expect(o.lines[0]).toBe(email ? 'Page is live. An invite is ready; nothing is sent until you tap Send.' : 'Page is live and run by us. No invite was prepared.');
      expect(o.organiserId).toBe('o1');
    });
  }
  it('person_reused adds a note', () => {
    const r = created({ person_reused: true, warnings: ['person_reused', 'email_has_login'] });
    if (r.kind !== 'created') throw new Error('kind');
    expect(outcomeFor(r).lines.join(' ')).toMatch(/existing person/);
    expect(outcomeFor(r).lines.join(' ')).toMatch(/already has a login/);
  });
  it('already_exists links to it', () => {
    const r = created({ already_exists: true });
    if (r.kind !== 'already_exists') throw new Error('kind');
    const o = outcomeFor(r);
    expect(o.title).toBe('This organiser is already added');
    expect(o.organiserId).toBe('o1');
  });
  for (const [code, field] of Object.entries({ ORGANISER_NAME_REQUIRED: 'organiser_name', CONTACT_NAME_REQUIRED: 'contact_name', EMAIL_INVALID: 'contact_email', CITY_REQUIRED: 'city_id', PERMISSION_DENIED: null, INVALID_PAYLOAD: null })) {
    it(`error ${code}`, () => {
      const r = parseAddResult({ success: false, code, errors: [{ code, field }] });
      expect(r).toEqual({ kind: 'error', code, field });
      const e = errorFor(code, field as never);
      expect(e.field).toBe(ADD_ERROR_TEXT[code].field);
      expect(e.text).not.toMatch(/^[A-Z_]+$/);
      expect(e.text.length).toBeGreaterThan(10);
    });
  }
  it('unknown code falls back to a sentence', () => {
    expect(errorFor('WAT', null).text).toMatch(/not added/);
    expect(parseAddResult(null)).toMatchObject({ kind: 'error', code: 'INVALID_PAYLOAD' });
  });
  it('untouched form is blocked, each missing field says which', () => {
    expect(submitBlockedReason(EMPTY_FORM)).toMatch(/Fill in/);
    expect(submitBlockedReason({ ...EMPTY_FORM, contactName: 'A B', cityId: 'c' })).toMatch(/organiser name/);
    expect(submitBlockedReason({ ...EMPTY_FORM, organiserName: 'X', cityId: 'c' })).toMatch(/contact/);
    expect(submitBlockedReason({ ...EMPTY_FORM, organiserName: 'X', contactName: 'A B' })).toMatch(/city/);
    expect(submitBlockedReason({ ...EMPTY_FORM, organiserName: 'X', contactName: 'A B', cityId: 'c' })).toBeNull();
    expect(RUN_BY_US_WHY).toMatch(/no email/);
  });
});

const INVITES: InviteStatus[] = ['none', 'queued', 'sent', 'failed', 'skipped'];
const row = (chip: Chip, inviteStatus: InviteStatus, inviteRequested = false): FrontDoorRow => ({ organiserId: 'o', name: 'N', chip, inviteStatus, inviteRequested, publishedCount: 0 });

describe('list: chip x invite state', () => {
  for (const chip of CHIPS) for (const st of INVITES) for (const req of [false, true]) {
    it(`${chip}/${st}/${req}`, () => {
      const c = sendControl(row(chip, st, req));
      expect(CHIP_LABEL[chip]).not.toMatch(RAW);
      // a disabled Send always says why; an enabled one never does
      if (c.disabledReason !== null) expect(c.disabledReason.length).toBeGreaterThan(10);
      const joined = chip === 'joined' || chip === 'live';
      if (joined || st === 'sent' || st === 'none') expect(c.disabledReason).not.toBeNull();
      if (!joined && (st === 'queued' || st === 'failed')) expect(c.disabledReason).toBeNull();
      const rb = runByUsControl(row(chip, st));
      expect(rb.disabledReason !== null).toBe(joined);
      expect(rb.on).toBe(chip === 'run_by_us');
    });
  }
  // #1033 walk: an Invited row said "Switch Run by us off" while its switch was already off.
  for (const chip of CHIPS) for (const st of INVITES) {
    it(`${chip}/${st}: copy naming the Run by us switch matches the switch`, () => {
      const rb = runByUsControl(row(chip, st));
      const reason = sendControl(row(chip, st)).disabledReason ?? '';
      if (/Switch Run by us off/.test(reason)) expect(rb.on && rb.disabledReason === null).toBe(true);
      if (/Switch Run by us on/.test(reason)) expect(!rb.on && rb.disabledReason === null).toBe(true);
    });
  }
  it('counts and filter', () => {
    const rows = [row('live', 'none'), row('invited', 'queued'), row('invited', 'sent')];
    expect(chipCounts(rows)).toEqual({ run_by_us: 0, invited: 2, joined: 0, live: 1 });
    expect(filterRows(rows, 'invited')).toHaveLength(2);
    expect(filterRows(rows, 'all')).toHaveLength(3);
    expect(filterRows([], 'live')).toEqual([]);
  });
  it('parser drops malformed rows and defaults', () => {
    const l = parseFrontDoorList({ items: [{ organiser_id: 'a', chip: 'live', name: 'A' }, { organiser_id: 'b', chip: 'nope' }, null, { chip: 'live' }] });
    expect(l).toHaveLength(1);
    expect(l[0].inviteStatus).toBe('none');
    expect(parseFrontDoorList(undefined)).toEqual([]);
  });
});

describe('send / run-by-us messages', () => {
  it('ok variants', () => {
    expect(sendMessage(parseSendResult({ success: true })).text).toBe('Invite will go out.');
    expect(sendMessage(parseSendResult({ success: true, already_requested: true })).text).toMatch(/Invite will go out/);
    expect(sendMessage(parseSendResult({ success: true, already_sent: true })).text).toMatch(/already sent/);
    expect(sendMessage(parseSendResult({ success: true, retried: true })).text).toMatch(/queued again/);
  });
  for (const code of ['NO_INVITE', 'ALREADY_JOINED', 'PERMISSION_DENIED', 'WAT']) {
    it(`send ${code}`, () => {
      const m = sendMessage(parseSendResult({ success: false, code }));
      expect(m.ok).toBe(false);
      expect(m.text).not.toMatch(/[A-Z]{4,}_/);
    });
  }
  it('network error and run by us', () => {
    expect(sendMessage({ kind: 'error', code: 'UNKNOWN' }).text).toMatch(/connection/);
    expect(runByUsMessage({ kind: 'ok', runByUs: true, changed: true }).text).toMatch(/run by us/i);
    expect(runByUsMessage({ kind: 'ok', runByUs: false, changed: true }).text).toMatch(/tap Send invite/);
    expect(runByUsMessage({ kind: 'error', code: 'ORGANISER_NOT_FOUND' }).ok).toBe(false);
  });
});

const items = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `i${i}`, reason: NEEDS_REASONS[i % 4], organiser_id: `o${i}`, label: `L${i}`, detail: i % 4 === 0 ? 'Ann (a@b.c) signed in' : null, next_actions: ['approve_full', 'decline'] }));
describe('needs you: reason x count', () => {
  for (const n of [0, 1, 50]) {
    it(`${n} items`, () => {
      const p = parseNeedsYou({ items: items(n) });
      expect(p).toHaveLength(n);
      const g = groupItems(p);
      expect(g.reduce((a, x) => a + x.items.length, 0)).toBe(n);
      expect(badgeText(n)).toBe(n === 0 ? null : String(n));
    });
  }
  it('badge caps and hides when unknown', () => {
    expect(badgeText(150)).toBe('99+');
    expect(badgeText(null)).toBeNull();
  });
  for (const r of NEEDS_REASONS) {
    it(`reason ${r}`, () => {
      expect(REASON_LABEL[r]).not.toMatch(RAW);
      expect(canResolve({ id: 'x', reason: r, organiserId: null, label: '', detail: null, since: null, nextActions: [] })).toBe(r === 'email_mismatch_claim');
    });
  }
  it('resolve codes become sentences, never approve_drafts_only', () => {
    expect(resolveMessage(parseResolveResult({ success: true }, 'approve_full')).text).toMatch(/Approved/);
    expect(resolveMessage(parseResolveResult({ success: true }, 'decline')).text).toBe('Declined.');
    for (const code of ['CLAIMANT_IS_ADMIN', 'DRAFTS_ONLY_NOT_WIRED', 'ITEM_NOT_FOUND', 'PERMISSION_DENIED', 'WAT']) {
      const m = resolveMessage(parseResolveResult({ success: false, code }, 'decline'));
      expect(m.ok).toBe(false);
      expect(m.text).not.toMatch(/[A-Z]{4,}_/);
    }
  });
});

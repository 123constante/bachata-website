import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACTION_LABEL,
  CAMERA_WORDS,
  DOOR_RESULTS,
  RESULT_TABLE,
  cameraDead,
  codeBoxBlock,
  counterText,
  createScanGate,
  londonClock,
  parseCode,
  personOf,
  type CheckIn,
} from '../model';
import { parseCheckIn, parseDoorList } from '../data';

const TOKEN = 'a3f0c1d2e4b5968778695a4b3c2d1e0f00112233445566778899aabbccddeeff';
const reply = (over: Partial<CheckIn> = {}): CheckIn => ({
  result: 'ok', ticket_type_name: 'Early bird', first_name: 'Maria', quantity: 2,
  checked_in_at: '2026-10-29T21:42:00Z', checked_in_by_first_name: 'Sam', in_count: 37, total_count: 120, ...over,
});

describe('the ONE result table', () => {
  it('has a row for every RPC result plus no_signal, and nothing else', () => {
    expect(Object.keys(RESULT_TABLE).sort()).toEqual([...DOOR_RESULTS].sort());
  });
  // [result, band, headline, actions, vibrates, keeps scanning]
  const MATRIX = [
    ['ok', 'ok', 'LET IN', ['scan'], true, true],
    ['already_in', 'warn', 'ALREADY IN', ['scan'], true, true],
    ['wrong_event', 'bad', 'NOT FOR THIS EVENT', ['scan'], true, true],
    ['not_valid', 'bad', 'NOT VALID', ['scan'], true, true],
    ['unknown_code', 'bad', 'CODE NOT RECOGNISED', ['type', 'scan'], true, true],
    ['not_allowed', 'grey', 'CANNOT CHECK TICKETS', ['none'], false, false],
    ['no_signal', 'grey', 'NO SIGNAL', ['list'], false, true],
  ] as const;
  it.each(MATRIX)('%s -> %s band, "%s"', (k, band, headline, actions, vibrates, keep) => {
    const row = RESULT_TABLE[k];
    expect(row.band).toBe(band);
    expect(row.headline).toBe(headline);
    expect(row.actions).toEqual(actions);
    expect(row.vibrate.length > 0).toBe(vibrates);
    expect(row.keepScanning).toBe(keep);
    for (const c of [null, reply({ result: k === 'no_signal' ? 'ok' : k })]) {
      expect(row.sub(c).length).toBeGreaterThan(0);
      expect(row.detail(c).length).toBeGreaterThan(0);
    }
    for (const a of row.actions) if (a !== 'none') expect(ACTION_LABEL[a]).toBeTruthy();
  });
  it('ok says how many the ORDER holds and lets ONE person in (one QR per ticket)', () => {
    expect(RESULT_TABLE.ok.sub(reply({ quantity: 2 }))).toBe('1 person \u00b7 ticket 1 of an order of 2');
    expect(RESULT_TABLE.ok.detail(reply({ quantity: 3 }))).toContain('other 2 tickets');
    expect(RESULT_TABLE.ok.sub(reply({ quantity: 1 }))).toBe('1 person \u2014 enjoy the night');
  });
  it('already_in says when (London) and by whom, or just when', () => {
    // 21:42 UTC on 29 Oct 2026 is 21:42 in London (GMT after 25 Oct)
    expect(RESULT_TABLE.already_in.sub(reply({ result: 'already_in' }))).toMatch(/^Scanned at 21:42( on 29 Oct)? by Sam$/);
    expect(RESULT_TABLE.already_in.sub(reply({ result: 'already_in', checked_in_by_first_name: null }))).toMatch(/^Scanned at 21:42( on 29 Oct)?$/);
    expect(RESULT_TABLE.already_in.sub(reply({ result: 'already_in', checked_in_at: null }))).toBe('Scanned earlier');
  });
  it('not_allowed names the team, never a role', () => {
    expect(RESULT_TABLE.not_allowed.sub(null)).toBe('You\u2019re not on this event\u2019s team');
  });
  it('the person line shows only first name, type and order size, and never for unknown / not allowed', () => {
    expect(personOf(reply())).toEqual({ name: 'Maria', meta: 'Early bird \u00b7 order of 2' });
    expect(personOf(reply({ first_name: null }))?.name).toBe('No name given');
    expect(personOf(reply({ result: 'unknown_code' }))).toBeNull();
    expect(personOf(reply({ result: 'not_allowed' }))).toBeNull();
    expect(personOf(null)).toBeNull();
  });
});

describe('londonClock', () => {
  const now = new Date('2026-07-01T20:00:00Z');
  it('is London time (BST in summer), with the day when not today', () => {
    expect(londonClock('2026-07-01T20:42:00Z', now)).toBe('21:42');
    expect(londonClock('2026-06-30T20:42:00Z', now)).toBe('21:42 on 30 Jun');
    expect(londonClock(null, now)).toBeNull();
    expect(londonClock('nope', now)).toBeNull();
  });
});

describe('counterText', () => {
  it.each([[37, 120, '37 of 120 in'], [0, 0, '0 of 0 in'], [null, 5, null], [3, undefined, null]] as const)('%s / %s', (i, t, out) => {
    expect(counterText(i, t)).toBe(out);
  });
});

describe('parseCode: what the QR or the code box can hold', () => {
  it.each([
    [TOKEN, TOKEN],
    [`  ${TOKEN.toUpperCase()}  `, TOKEN],
    [TOKEN.replace(/(.{8})/g, '$1 '), TOKEN],
    [`https://www.bachatacalendar.com/t/${TOKEN}`, TOKEN],
    [`https://x.test/ticket/${TOKEN}/`, TOKEN],
    [`https://x.test/ticket?t=${TOKEN}`, TOKEN],
    [`https://x.test/ticket?token=${TOKEN}&utm=1`, TOKEN],
    ['', null],
    ['   ', null],
    ['https://x.test/', null],
  ])('%j -> %j', (raw, out) => {
    expect(parseCode(raw)).toBe(out);
  });
});

describe('scan gate: the same code within 2.5 s does not re-fire', () => {
  it('blocks a repeat inside the window, lets a new code or a later repeat through', () => {
    let t = 0;
    const g = createScanGate(2500, () => t);
    expect(g.accept('a')).toBe(true);
    t = 2499; expect(g.accept('a')).toBe(false);
    expect(g.accept('b')).toBe(true);
    t = 2600; expect(g.accept('b')).toBe(false);
    t = 5100; expect(g.accept('b')).toBe(true);
    g.reset(); expect(g.accept('b')).toBe(true);
  });
});

describe('code box: disabled with a reason', () => {
  it.each([['', false, 'Type or paste the code first'], [TOKEN, true, 'Checking the last code\u2026'], [TOKEN, false, null]] as const)('%j busy=%s', (t, b, why) => {
    expect(codeBoxBlock(t, b)).toBe(why);
  });
});

describe('camera words', () => {
  it('say what to do when the camera is dead, and only those open the list', () => {
    for (const s of ['denied', 'none', 'failed'] as const) {
      expect(cameraDead(s)).toBe(true);
      expect(CAMERA_WORDS[s]).toMatch(/type the code/i);
    }
    for (const s of ['starting', 'on', 'off'] as const) expect(cameraDead(s)).toBe(false);
  });
});

describe('reply parsing', () => {
  it('an unknown result is never a let-in', () => {
    expect(parseCheckIn({ result: 'surprise' }).result).toBe('unknown_code');
    expect(parseCheckIn(null).result).toBe('unknown_code');
  });
  it('the list: rows, truncated, counts, not_allowed', () => {
    const l = parseDoorList({ result: 'ok', rows: [{ ticket_id: 't1', first_name: 'Maria', quantity_in_order: 2, ticket_type_name: 'Early', checked_in_at: null }], truncated: true, in_count: 0, total_count: 501 }, 1);
    expect(l).toEqual({ result: 'ok', rows: [{ ticketId: 't1', firstName: 'Maria', quantity: 2, typeName: 'Early', checkedInAt: null }], truncated: true, inCount: 0, totalCount: 501, loadedAt: 1 });
    expect(parseDoorList({ result: 'not_allowed', rows: [], truncated: false, in_count: null, total_count: null }).result).toBe('not_allowed');
  });
});

describe('source hygiene', () => {
  it('door .ts / .tsx files are ASCII (entities and \\u escapes, never raw punctuation)', () => {
    const dir = join(__dirname, '..');
    for (const f of readdirSync(dir).filter((n) => /\.(ts|tsx|css)$/.test(n))) {
      expect([...readFileSync(join(dir, f), 'utf8')].every((c) => c.charCodeAt(0) < 128), f).toBe(true);
    }
  });
  it('door.css uses p3 tokens for colour (no hex) and px, never rem', () => {
    const css = readFileSync(join(__dirname, '..', 'door.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\d(rem|em)\b/);
  });
});

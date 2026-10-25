import { describe, expect, it } from 'vitest';
import { PAST_DATE_NOTE, buildDraft, checkLink, failureView, outcomeOf, readButton, reasonFor } from '../pasteLinkModel';
import type { LinkReadResult, ParsedLinkEvent } from '../smartImportClient';

const TODAY = '2026-10-25';
const FULL: ParsedLinkEvent = { title: 'Friday Bachata', format: 'one_off', date_iso: '2026-11-06', venue_name: 'The Dance Hall', ticket_url: 'https://tickets.example/e', description: 'A warm night.' };
const PARTIAL: ParsedLinkEvent = { title: 'Friday Bachata', date_iso: '2026-11-06' };
const EMPTY: ParsedLinkEvent = { title: null, date_iso: null };

describe('checkLink', () => {
  it.each([
    ['', { ok: false, reason: 'empty' }],
    ['   ', { ok: false, reason: 'empty' }],
    ['http://example.com/e', { ok: false, reason: 'non_https' }],
    ['javascript:alert(1)', { ok: false, reason: 'non_https' }],
    ['not a link', { ok: false, reason: 'non_https' }],
    ['https://localhost/e', { ok: false, reason: 'non_https' }],
    [' https://example.com/e ', { ok: true, link: 'https://example.com/e' }],
  ])('%j', (input, want) => expect(checkLink(input)).toEqual(want));
});

describe('readButton', () => {
  it('is off with a reason when empty or reading, on otherwise', () => {
    expect(readButton('', false)).toEqual({ disabled: true, reason: 'Paste a link first.' });
    expect(readButton('https://a.b', true).disabled).toBe(true);
    expect(readButton('https://a.b', true).reason).toBeTruthy();
    expect(readButton('https://a.b', false)).toEqual({ disabled: false, reason: null });
  });
});

describe('date shapes', () => {
  it.each([
    ['future', { ...FULL, date_iso: '2026-11-06' }, ['2026-11-06'], false],
    ['today', { ...FULL, date_iso: TODAY }, [TODAY], false],
    ['past', { ...FULL, date_iso: '2026-01-01' }, [], true],
    ['none', { ...FULL, date_iso: null }, [], false],
    ['mixed series', { ...FULL, date_iso: '2026-01-01', recurrence: { custom_dates_iso: ['2026-01-08', '2026-11-13', '2026-11-13'] } }, ['2026-11-13'], false],
    ['garbage date', { ...FULL, date_iso: '06/11/2026' }, [], false],
  ])('%s', (_n, parsed, dates, passed) => {
    const d = buildDraft(parsed as ParsedLinkEvent, TODAY);
    expect(d.dates).toEqual(dates);
    expect(d.datePassed).toBe(passed);
  });
  it('a passed date is never copied and the note names what to do', () => {
    expect(PAST_DATE_NOTE).toBe('This date has passed, please set the date');
  });
});

describe('untrusted text', () => {
  it('rejects non-https ticket links and keeps markup as plain text', () => {
    for (const bad of ['http://t.example', 'javascript:alert(1)', 'data:text/html,x', '//t.example', 'ftp://t.example']) {
      expect(buildDraft({ ...FULL, ticket_url: bad }, TODAY).ticketUrl).toBe('');
    }
    const d = buildDraft({ ...FULL, title: '<img src=x onerror=alert(1)>', description: '<b>hi</b>\n\n<script>x</script>' }, TODAY);
    expect(d.title).toBe('<img src=x onerror=alert(1)>');
    expect(d.description).toBe('<b>hi</b> <script>x</script>');
  });
  it('caps lengths and survives wrong types', () => {
    const d = buildDraft({ title: 'x'.repeat(500), description: 'y'.repeat(5000), venue_name: 7 as unknown as string }, TODAY);
    expect(d.title).toHaveLength(120);
    expect(d.description).toHaveLength(600);
    expect(d.venue).toBe('');
  });
});

describe('outcomeOf: every result shape', () => {
  const ok = (parsed: ParsedLinkEvent): LinkReadResult => ({ ok: true, parsed });
  it.each([
    ['ok full', ok(FULL), 'draft', []],
    ['ok partial', ok(PARTIAL), 'draft', ['venue', 'ticket', 'description']],
    ['ok empty', ok(EMPTY), 'failed:empty', null],
    ['ok past date only', ok({ date_iso: '2026-01-01' }), 'draft', ['title', 'venue', 'ticket', 'description']],
    ['server empty', { ok: false, error: 'no_fields_extracted' }, 'failed:empty', null],
    ['unreadable', { ok: false, error: 'llm_unparseable' }, 'failed:unreadable', null],
    ['unknown code', { ok: false, error: 'anthropic_500: x' }, 'failed:unreadable', null],
    ['non-https (server)', { ok: false, error: 'invalid_event_link' }, 'failed:non_https', null],
    ['401', { ok: false, error: 'unauthenticated' }, 'failed:signed_out', null],
    ['403', { ok: false, error: 'not_allowed' }, 'failed:unreadable', null],
    ['429', { ok: false, error: 'daily_limit', notes: "You have used today's 20 link or flyer reads. Try again tomorrow." }, 'failed:daily_limit', null],
    ['network', { ok: false, error: 'network' }, 'failed:network', null],
    ['timeout', { ok: false, error: 'timeout' }, 'failed:timeout', null],
    ['cancelled', { ok: false, error: 'aborted' }, 'cancelled', null],
  ] as Array<[string, LinkReadResult, string, string[] | null]>)('%s', (_n, result, want, missing) => {
    const o = outcomeOf(result, TODAY);
    expect(o.kind === 'failed' ? `failed:${o.reason}` : o.kind).toBe(want);
    if (o.kind === 'draft' && missing) expect(o.draft.missing).toEqual(missing);
  });
});

describe('failure words', () => {
  const reasons = ['unreadable', 'empty', 'non_https', 'signed_out', 'daily_limit', 'network', 'timeout'] as const;
  it.each(reasons)('%s is a plain sentence that keeps the person moving', (r) => {
    const v = failureView(r);
    expect(v.byHand).toBe(true);
    if (r === 'daily_limit') expect(v.message).toBe("You have used today's link reads; add this one by hand or try tomorrow");
    else expect(v.message).toContain('We could not read that link'.replace('We', r === 'signed_out' ? 'we' : 'We'));
    if (r !== 'daily_limit') expect(v.message).toContain('You can add the event by hand'.replace('You', r === 'signed_out' ? 'You' : 'You'));
    expect(v.signIn).toBe(r === 'signed_out');
    expect(v.message).not.toMatch(/\b(error|undefined|null|JWT|401|429|\{)/i);
  });
  it('reasonFor maps every server code', () => {
    expect(reasonFor('daily_limit')).toBe('daily_limit');
    expect(reasonFor('llm_refused')).toBe('unreadable');
  });
});

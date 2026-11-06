import { describe, expect, it } from 'vitest';
import { LINK_PROBLEM, linkProblem, linkRenders, type LinkKind } from '../linkRules';
import { safeExternalHref } from '@/lib/url';

// One table: what the organiser sheet says about a link vs whether the public
// page can build a href from it. `ok` = the sheet accepts it for ticket/video.
const long = `https://example.com/${'a'.repeat(2048 - 20)}`;
const tooLong = `https://example.com/${'a'.repeat(2048)}`;
const ROWS: Array<{ name: string; v: string; ok: boolean }> = [
  { name: 'blank', v: '', ok: true },
  { name: 'valid https', v: 'https://example.com/tickets', ok: true },
  { name: 'valid http', v: 'http://example.com/tickets', ok: true },
  { name: 'bare host', v: 'ticket.example.com', ok: false },
  { name: 'port too big', v: 'https://example.com:99999', ok: false },
  { name: 'open bracket', v: 'https://[abc', ok: false },
  { name: 'angle bracket in host', v: 'https://exa<mple.com', ok: false },
  { name: 'userinfo only', v: 'https://user@', ok: false },
  { name: 'port not numeric', v: 'https://example.com:80a', ok: false },
  { name: '2048 chars', v: long, ok: true },
  { name: 'over 2048 chars', v: tooLong, ok: false },
  { name: 'contains a space', v: 'https://example.com/a b', ok: false },
  { name: 'httpx scheme', v: 'httpx://example.com', ok: false },
  { name: 'uppercase scheme', v: 'HTTPS://EXAMPLE.COM/x', ok: true },
  { name: 'trailing dot host', v: 'https://example.com./x', ok: true },
];

const ALL_KINDS: LinkKind[] = ['ticket', 'video', 'instagram', 'website', 'facebook', 'chat'];

describe('linkRenders', () => {
  it('is false for blank and true when safeExternalHref builds a URL', () => {
    expect(linkRenders('')).toBe(false);
    expect(linkRenders('  https://example.com  ')).toBe(true);
    expect(linkRenders('https://example.com:99999')).toBe(false);
  });
  it.each(ROWS)('agrees with safeExternalHref: $name', ({ v }) => {
    expect(linkRenders(v)).toBe(safeExternalHref(v) !== undefined);
  });
});

describe.each(['ticket', 'video'] as const)('%s link: exact verdict per row', (kind) => {
  it.each(ROWS)('$name', ({ v, ok }) => {
    expect(linkProblem(kind, v)).toBe(ok ? null : LINK_PROBLEM[kind]);
  });
});

// Kinds outside ticket/video are NOT fixed here (brief: report only). These rows
// are the known gaps found by the implication test; each must keep failing the
// implication until a follow-up fixes it, so the list cannot go stale silently.
const KNOWN_GAPS: Partial<Record<LinkKind, string[]>> = {
  website: ['port too big', 'open bracket', 'angle bracket in host', 'userinfo only', 'port not numeric', 'httpx scheme'],
  facebook: ['port too big', 'open bracket', 'angle bracket in host', 'userinfo only', 'port not numeric'],
  chat: ['port too big'],
};

describe.each(ALL_KINDS)('%s link: accepted implies the public page renders it', (kind) => {
  it.each(ROWS)('$name', ({ name, v }) => {
    const accepted = v.trim() !== '' && linkProblem(kind, v) === null;
    const renders = safeExternalHref(v) !== undefined;
    const gap = KNOWN_GAPS[kind]?.includes(name) ?? false;
    if (gap) {
      expect(accepted && !renders).toBe(true);
    } else if (accepted) {
      expect(renders).toBe(true);
    }
  });
});

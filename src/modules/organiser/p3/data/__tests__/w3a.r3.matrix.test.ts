import { describe, expect, it } from 'vitest';
import { parseEventWorkspace } from '../../../events/eventModel';
import { linkProblem } from '../../../shared/linkRules';
import { wsRaw } from '../../screens/__tests__/wsFixtures';
import { L } from '../../model/labels';
import { changedKeys } from '../../model/saveModel';
import { DETAILS_SPECS, chatProblem, detailsDraftOf, detailsPlan, toggleMusic } from '../details';

/*
 * Review round 3 on PR #1082 (docs/reviews/1082-r3.md), the pure half: each row was RED on
 * 70b1c75. The screen half (#2, #3, #5) is in screens/__tests__/w3a.r3.test.tsx.
 */

describe('r3 #4: the chat link carries the server group-chat host rule (apply_aggregate_write_p5 owner arm)', () => {
  it.each([
    ['no dotted host', 'https://chat/abc'],
    ['localhost', 'https://localhost/x'],
    ['userinfo before the host', 'https://me@chat.whatsapp.com/abc'],
    ['a trailing dot on the host', 'https://chat.whatsapp.com./abc'],
    ['an IPv6 host', 'https://[::1]/x'],
  ])('%s (%s): blocked with plain words', (_n, url) => {
    expect(chatProblem(url)).toBe(L.detailsChatBad);
    expect(linkProblem('chat', url)).toBeTruthy();
    expect(L.detailsChatBad).not.toMatch(/regex|host|permission/i);
  });
  it.each([
    ['https://chat.whatsapp.com/abc'],
    ['  https://chat.whatsapp.com/abc  '],
    ['https://Chat.WhatsApp.com/abc'],
    ['https://t.me:443/group'],
    ['https://chat.whatsapp.com'],
    [''],
  ])('%s still saves', (url) => {
    expect(chatProblem(url)).toBeNull();
  });
  it('http:// stays refused (the owner rule is https only)', () => {
    expect(chatProblem('http://chat.whatsapp.com/abc')).toBe(L.detailsChatBad);
  });
});

describe('r3 #7: Instagram is compared as sent', () => {
  const w = parseEventWorkspace(wsRaw({ instagram_url: 'https://www.instagram.com/ritmo' }, [], []));
  const base = detailsDraftOf(w);
  it('@ritmo against the stored https://www.instagram.com/ritmo is no change, nothing sent', () => {
    const draft = { ...base, instagram: '@ritmo' };
    expect(changedKeys(DETAILS_SPECS, base, draft)).toEqual([]);
    expect(detailsPlan(base, draft)).toEqual([]);
  });
  it('a different handle is still a change', () => {
    expect(changedKeys(DETAILS_SPECS, base, { ...base, instagram: '@other' })).toEqual(['instagram']);
  });
});

describe('r3 #8: music is compared in one canonical order', () => {
  // 3 of the 87 prod series with two or more styles are stored out of MUSIC_STYLES order (2026-10-27)
  const w = parseEventWorkspace(wsRaw({}, [], []));
  const base = { ...detailsDraftOf(w), music: ['Salsa', 'Bachata'] };
  it('a toggle on then off is no change, nothing sent', () => {
    const draft = { ...base, music: toggleMusic(toggleMusic(base.music, 'Kizomba'), 'Kizomba') };
    expect(changedKeys(DETAILS_SPECS, base, draft)).toEqual([]);
    expect(detailsPlan(base, draft)).toEqual([]);
  });
  it('a real toggle is still a change', () => {
    expect(changedKeys(DETAILS_SPECS, base, { ...base, music: toggleMusic(base.music, 'Salsa') })).toEqual(['music']);
  });
});

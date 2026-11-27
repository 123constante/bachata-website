// Ways in change 1 (2026-11-27): the R4 tab bar is fixed (64px) over the end of the
// scroller, so the editor page keeps that much room under its last card. With no room,
// the sticky Put it live bar sat over the flyer at the end of the page.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const v2 = readFileSync(resolve(__dirname, '../v2.css'), 'utf8');
const r4 = readFileSync(resolve(__dirname, '../../r4/r4.css'), 'utf8');

describe('editor v2 bottom room', () => {
  it('the R4 tab bar is fixed and 64px tall (the room below is sized to it)', () => {
    const rule = r4.match(/\.r4-tabs \{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('position: fixed');
    expect(rule).toContain('bottom: 0');
    expect(rule).toContain('height: 64px');
  });

  it('the editor page pads its scroller bottom by the tab bar height plus the home-indicator inset', () => {
    const rule = v2.match(/\.r4-look:has\(\.v2-page\) \.r4-main \{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('padding: 0 0 calc(var(--tabbar-h, 64px) + env(safe-area-inset-bottom, 0px))');
  });
});

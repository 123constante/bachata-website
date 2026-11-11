import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tsx = readFileSync('src/modules/organiser/p3/door/DoorScreen.tsx', 'utf8');
const css = readFileSync('src/modules/organiser/p3/door/door.css', 'utf8');

const rule = (sel: string) => {
  const m = css.match(new RegExp(`\\.p3-theme \\.${sel}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : '';
};

const controls = [
  { testid: 'door-act-recheck', tag: 'button' },
  { testid: 'door-notallowed-back', tag: 'Link' },
];

describe('refused door card controls centre their label alike', () => {
  for (const c of controls) {
    it(`${c.testid} carries p3-door-big`, () => {
      const line = tsx.split('\n').find((l) => l.includes(`data-testid="${c.testid}"`)) ?? '';
      expect(line).toContain('p3-door-big');
    });
  }
  it('p3-door-big centres label (flex) and keeps >= 44px, in px', () => {
    const r = rule('p3-door-big');
    expect(r).toMatch(/display:\s*inline-flex/);
    expect(r).toMatch(/align-items:\s*center/);
    expect(r).toMatch(/justify-content:\s*center/);
    const h = Number(/min-height:\s*(\d+)px/.exec(r)?.[1]);
    expect(h).toBeGreaterThanOrEqual(44);
  });
});

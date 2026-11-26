// Drift guard: the Website's go-live list must match the shared rule list.
// event-rules.json is a MIRROR of lib/event-rules.json in the admin repo. Change
// it there first, then copy it here byte for byte; never edit this copy.
// Website labels differ from admin words by design, so only codes, sections and
// sameAs are compared.
import { describe, expect, it } from 'vitest';
import rules from '../event-rules.json';
import { GO_LIVE_BLOCKERS, GO_LIVE_SECTIONS } from '../goLiveKeys';
import { goLiveFixHref } from '../goLiveCheck';

type RuleCode = { section: string; sameAs?: string };
const codes = rules.goLive.codes as Record<string, RuleCode>;
const sections = Object.keys(rules.goLive.sections);

describe('go-live rules mirror matches the Website list', () => {
  it.each(Object.keys(codes))('rule code %s is in GO_LIVE_BLOCKERS with the same section', (code) => {
    const def = GO_LIVE_BLOCKERS[code];
    expect(def, `Website has no entry for ${code}`).toBeDefined();
    expect(def.section).toBe(codes[code].section);
    if (codes[code].sameAs) expect(def.sameAs).toBe(codes[code].sameAs);
  });

  it.each(Object.keys(GO_LIVE_BLOCKERS))('Website code %s is in the shared rule list', (code) => {
    expect(Object.keys(codes)).toContain(code);
  });

  it.each(sections)('rule section %s is a Website section with a fix screen', (section) => {
    expect(GO_LIVE_SECTIONS).toContain(section);
    expect(goLiveFixHref(section, 's1')).not.toBeNull();
  });
});

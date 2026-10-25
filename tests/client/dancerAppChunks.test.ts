/**
 * D139 (slice B fix pass, review B1): the organiser Ember ui/ blocks the dancer app is built from ride in ONE
 * first-party chunk, and `cn` (src/lib/utils.ts) is pinned to lib-event-rules so that group cannot swallow it
 * (it did, measured: +1 first-load chunk on all eight budgeted routes).
 */
import { describe, expect, it } from 'vitest';
import { LIB_EVENT_RULES_MODULES, LIB_ORG_UI_MODULES, LIB_PHONE_MODULES, classifyChunk } from '../../vite.chunks';

describe('lib-org-ui (D139)', () => {
  it.each(LIB_ORG_UI_MODULES)('%s rides in lib-org-ui', (mod) => {
    expect(classifyChunk('/repo' + mod)).toBe('lib-org-ui');
  });

  it('holds exactly the blocks /app/* loaded as one-block chunks', () => {
    expect(LIB_ORG_UI_MODULES.map((m) => m.split('/').pop())).toEqual([
      'Card.tsx', 'Chip.tsx', 'Field.tsx', 'SearchField.tsx', 'Skeleton.tsx', 'States.tsx', 'SummaryRow.tsx', 'useKeyboardInset.ts',
      // invite W2: the Instagram field + rule and the phone rule, read statically by /app and the organiser screens
      'InstagramInput.tsx', 'instagramHandle.ts', 'phoneRules.ts',
    ]);
  });

  it('src/lib/utils.ts is pinned to lib-event-rules, never left for the group to take', () => {
    expect(LIB_EVENT_RULES_MODULES).toContain('/src/lib/utils.ts');
    expect(classifyChunk('/repo/src/lib/utils.ts')).toBe('lib-event-rules');
  });

  it('other organiser blocks and a node_modules copy are left to rollup', () => {
    expect(classifyChunk('/repo/src/modules/organiser/ui/SheetView.tsx')).toBeUndefined();
    expect(classifyChunk('/repo/node_modules/x/src/modules/organiser/ui/Card.tsx')).not.toBe('lib-org-ui');
  });
});

describe('lib-phone (invite W2)', () => {
  it.each(LIB_PHONE_MODULES)('%s rides in lib-phone', (mod) => {
    expect(classifyChunk('/repo' + mod)).toBe('lib-phone');
  });

  it('holds the phone field and its country list, never the rule /app reads statically', () => {
    expect(LIB_PHONE_MODULES.map((m) => m.split('/').pop())).toEqual(['PhoneInput.tsx', 'countryDialCodes.ts']);
    expect(classifyChunk('/repo/src/lib/phoneRules.ts')).toBe('lib-org-ui');
  });
});

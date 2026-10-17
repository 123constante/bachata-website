import { describe, expect, it } from 'vitest';
import { organiserStatus } from '../organiserStatus';
import { createBlock } from '../createModel';

const STATES = ['draft', 'live', 'paused', 'ended', 'archived'];

describe('organiserStatus: THE lifecycle -> copy mapping (D4: everything live)', () => {
  it('blocks New event for every state but live, and every block says what to do', () => {
    for (const s of STATES) {
      const block = organiserStatus('Ritmo', s).newEventBlock;
      if (s === 'live') expect(block).toBeNull();
      else expect(block).toMatch(/Ask the Bachata Calendar team\.$/);
    }
  });

  it.each([
    ['draft', 'Draft'], ['live', 'Live'], ['paused', 'Paused'], ['ended', 'Ended'], ['archived', 'Archived'],
  ])('%s label', (s, label) => expect(organiserStatus('Ritmo', s).label).toBe(label));

  it('never says "review" for any state, old ones included', () => {
    for (const s of [...STATES, 'pending_review', 'rejected']) {
      expect(JSON.stringify(organiserStatus('Ritmo', s))).not.toMatch(/review/i);
    }
  });

  it('an old pending_review or rejected row reads like a paused page', () => {
    expect(organiserStatus('Ritmo', 'pending_review')).toEqual(organiserStatus('Ritmo', 'paused'));
    expect(organiserStatus('Ritmo', 'rejected')).toEqual(organiserStatus('Ritmo', 'paused'));
  });

  it.each(STATES)('the New event block is a view of it, not a copy (%s)', (s) => {
    expect(createBlock({ name: 'Ritmo', lifecycle_status: s })).toBe(organiserStatus('Ritmo', s).newEventBlock);
  });
});

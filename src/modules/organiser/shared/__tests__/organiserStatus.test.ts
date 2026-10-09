import { describe, expect, it } from 'vitest';
import { organiserStatus } from '../organiserStatus';
import { createBlock } from '../createModel';
import { reviewStatus } from '../../profile/reviewModel';

const STATES = ['draft', 'pending_review', 'rejected', 'live', 'paused', 'ended', 'archived'];

describe('organiserStatus: THE lifecycle -> copy mapping', () => {
  it('offers "Send for review" for exactly the states submit_organiser_profile_v1 admits', () => {
    expect(STATES.filter((s) => organiserStatus('Ritmo', s).canSendForReview)).toEqual(['draft', 'rejected']);
  });

  it('blocks New event for every state but live, and every block says what to do', () => {
    for (const s of STATES) {
      const block = organiserStatus('Ritmo', s).newEventBlock;
      if (s === 'live') expect(block).toBeNull();
      else expect(block).toMatch(/Send it for review|once it is approved|Profile page|Ask the Bachata Calendar team/);
    }
  });

  it('every non-live state says what the person can do next', () => {
    for (const s of STATES.filter((x) => x !== 'live')) expect(organiserStatus('Ritmo', s).next).toBeTruthy();
  });

  it.each([
    ['draft', 'Draft: not visible to the public yet.'],
    ['pending_review', 'Waiting for review: not visible to the public yet.'],
    ['live', 'Live on the site.'],
  ])('%s line', (s, line) => expect(organiserStatus('Ritmo', s).line).toBe(line));

  it('pending_review explains the New event refusal as waiting for approval', () => {
    expect(organiserStatus('Ritmo', 'pending_review').newEventBlock).toMatch(/^Your organiser is waiting for approval\./);
  });

  it('a rejected organiser shows its reason, trimmed, and is offered the send again', () => {
    const s = organiserStatus('Ritmo', 'rejected', '  Add your Instagram ');
    expect(s.line).toBe('The team asked for changes: Add your Instagram');
    expect(s.sendLabel).toBe('Send for review again');
    expect(organiserStatus('Ritmo', 'rejected', null).line).toBe('The team asked for changes.');
  });

  it.each(STATES)('the Profile status and the New event block are views of it, not copies (%s)', (s) => {
    const shared = organiserStatus('Ritmo', s, 'why');
    expect(reviewStatus(s, 'why')).toEqual({ label: shared.label, tone: shared.tone, sentence: shared.line, canSend: shared.canSendForReview });
    expect(createBlock({ name: 'Ritmo', lifecycle_status: s })).toBe(shared.newEventBlock);
  });
});

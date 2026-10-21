// How one wizard answer is saved. Never a second writer: dancer answers go
// through saveWizardDancer (save_my_dancer_profile_v2 via dancerApi, diff-first), organiser
// answers through draftModel.saveDrafts (My page's ONE save). An answer equal
// to what is stored sends nothing.
import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { organiserEntityQueryKey, ownOrganiserEntityQueryKey } from '@/modules/profile/organiserPublicProfile';
import { ORGANISER_HOME_KEY } from '@/modules/organiser/shared/selfServeApi';
import { organiserContactSettingsQueryKey } from '@/modules/organiser/shared/ownershipApi';
import { profileProgressQueryKey } from '@/modules/organiser/shared/profileProgress';
import { saveDrafts, type Drafts } from '../edit-in-place/draftModel';
import { saveWizardDancer, type WizardDancer } from './dancerApi';
import type { WizardEntry, WizardSources } from './registry';
import { sameAnswer } from './wizardModel';

export type AnswerOutcome = { kind: 'saved' } | { kind: 'nothing' } | { kind: 'failed'; message: string };

export interface WizardWriters {
  saveDancer: (delta: Record<string, unknown>) => Promise<WizardDancer>;
  saveOrganiser: typeof saveDrafts;
}

export const REAL_WRITERS: WizardWriters = { saveDancer: saveWizardDancer, saveOrganiser: saveDrafts };

const NOT_LOADED = 'Your profile has not loaded yet, so nothing was saved. Wait a moment and try again.';

/**
 * Save one answer. `onDancerSaved` receives the server-returned dancer row
 * (the caller writes it into the shared cache). Never throws.
 */
export async function saveAnswer(
  entry: WizardEntry,
  value: unknown,
  ctx: { sources: WizardSources; organiserId: string | null; writers?: WizardWriters; onDancerSaved?: (next: WizardDancer) => void },
): Promise<AnswerOutcome> {
  const writers = ctx.writers ?? REAL_WRITERS;
  if (sameAnswer(value, entry.read(ctx.sources))) return { kind: 'nothing' };
  if (entry.area === 'dancer') {
    if (!ctx.sources.dancer) return { kind: 'failed', message: NOT_LOADED };
    try {
      const next = await writers.saveDancer(entry.toPatch(value));
      ctx.onDancerSaved?.(next);
      return { kind: 'saved' };
    } catch (e) {
      return { kind: 'failed', message: e instanceof Error && e.message ? e.message : 'Your answer was not saved. Try again.' };
    }
  }
  if (entry.area === 'organiser') {
    const base = ctx.sources.organiser;
    if (!base || !ctx.organiserId) return { kind: 'failed', message: NOT_LOADED };
    const outcome = await writers.saveOrganiser(supabase, ctx.organiserId, base, entry.toPatch(value) as Drafts);
    if (outcome.kind === 'saved') return { kind: 'saved' };
    if (outcome.kind === 'nothing') return { kind: 'nothing' };
    return { kind: 'failed', message: outcome.kind === 'refused' && outcome.fieldError ? outcome.fieldError : outcome.message };
  }
  return { kind: 'failed', message: 'This question cannot be answered here yet.' };
}

/** After a save: re-read progress everywhere (pinned file note) and the rows the answer changed. */
export function invalidateAfterAnswer(qc: QueryClient, area: string, organiserId: string | null, userId: string | undefined): void {
  void qc.invalidateQueries({ queryKey: profileProgressQueryKey(organiserId) });
  void qc.invalidateQueries({ queryKey: ['my-profile-progress'] });
  if (area === 'organiser' && organiserId) {
    void qc.invalidateQueries({ queryKey: ownOrganiserEntityQueryKey(organiserId) });
    void qc.invalidateQueries({ queryKey: organiserEntityQueryKey(organiserId) });
    void qc.invalidateQueries({ queryKey: organiserContactSettingsQueryKey(organiserId, userId) });
    void qc.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
  }
}


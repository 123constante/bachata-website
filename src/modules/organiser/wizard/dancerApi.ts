// The wizard's dancer answers. The dancer-app module is isolated (check:
// dancer-area-isolation), so the wizard calls the SAME two RPCs through its own
// string-named boundary: my_dancer_edit_v1 to read, save_my_dancer_profile_v2
// (diff-first: only the answered key) to write. Its cache key is its own; after
// a save the dancer app's entries are invalidated so they re-read.
import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type UntypedRpc = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as unknown as UntypedRpc).rpc(fn, args);

/** The stored values the wizard reads (save_my_dancer_profile_v2's own key names). */
export type WizardDancer = Record<string, unknown> & { other_roles: string[] };

/** The dance roles the server stores (dancer_profiles.dance_role). */
export const DANCE_ROLE_VALUES = ['Leader', 'Follower', 'Lead and Follow'] as const;

export const wizardDancerQueryKey = (userId: string) => ['wizard-dancer', userId] as const;

export function parseWizardDancer(raw: unknown): WizardDancer {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || typeof o.profile_id !== 'string') throw new Error('Your profile did not load. Try again.');
  const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return { ...o, languages: list(o.languages), favorite_styles: list(o.favorite_styles), achievements: list(o.achievements), other_roles: list(o.other_roles) };
}

/**
 * D76: the server counts an owner/manager seat as WhatsApp-eligible, so this is
 * rare. The step stays required; the wizard shows the team's contact links
 * under this copy (needsTeamHelp), so it is never a dead end.
 */
export const WHATSAPP_NOT_ALLOWED_COPY = 'We could not save your WhatsApp number yet. Message us and we will sort it out. Your number is kept.';
/** A save refusal only the Bachata Calendar team can clear: the wizard shows how to reach them. */
export const needsTeamHelp = (message: string | null): boolean => message === WHATSAPP_NOT_ALLOWED_COPY;

const COPY: Record<string, string> = {
  invalid_handle: 'Enter just the handle, like your.handle.',
  whatsapp_not_allowed: WHATSAPP_NOT_ALLOWED_COPY,
  rate_limited: 'That was a lot of saves in a short time. Wait a few minutes, then try again.',
  not_signed_in: 'You are signed out. Sign in again, then answer this question.',
};
const NETWORK = 'We could not reach the server. Check your connection and try again. Your answer is kept.';
const GENERIC = 'Your answer was not saved. Try again. Your answer is kept.';

export function dancerSaveMessage(message: string): string {
  if (/failed to fetch|network|load failed|timeout|aborted/i.test(message)) return NETWORK;
  const code = Object.keys(COPY).find((c) => new RegExp(`(^|[^a-z_])${c}([^a-z_]|$)`).test(message));
  return code ? COPY[code] : GENERIC;
}

export async function fetchWizardDancer(): Promise<WizardDancer> {
  const { data, error } = await rpc('my_dancer_edit_v1');
  if (error) throw new Error(error.message);
  return parseWizardDancer(data);
}

/** Send ONLY the answered key. Throws plain copy. */
export async function saveWizardDancer(delta: Record<string, unknown>): Promise<WizardDancer> {
  let res: { data: unknown; error: { message: string } | null };
  try {
    res = await rpc('save_my_dancer_profile_v2', { p_payload: delta });
  } catch (e) {
    throw new Error(dancerSaveMessage(e instanceof Error ? e.message : ''));
  }
  if (res.error) throw new Error(dancerSaveMessage(res.error.message));
  return parseWizardDancer(res.data);
}

/** After a dancer save: the wizard's row, and the dancer app's own reads (and its gate). */
export function afterDancerSave(qc: QueryClient, userId: string, next: WizardDancer): void {
  qc.setQueryData(wizardDancerQueryKey(userId), next);
  void qc.invalidateQueries({ queryKey: ['my-dancer-edit'] });
  void qc.invalidateQueries({ queryKey: ['profile-completion'] });
}

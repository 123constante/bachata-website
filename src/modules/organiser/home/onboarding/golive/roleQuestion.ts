// "Do you also teach or DJ?" on the way to Go live (invite journey W2). Pure
// rules; the screen is RoleQuestion.tsx. Asked once: only the roles the person
// has neither claimed nor declined (my_role_intent_v1), so an answer, Yes or
// No, writes person_roles / the decline and the question never repeats. A Yes
// opens the minimum the go-live check needs for that role (A1's agreed keys:
// dj `dj_name` + `dj_genres`, teacher `teaching_styles`), nothing more.
import type { Role } from '@/modules/areas/shared/fieldRegistry';
import { sameValue, type Details } from '@/modules/areas/shared/roleModel';
import type { RoleIntent } from '@/modules/areas/home/rolesApi';

export const ROLE_QUESTION_TITLE = 'Do you also teach or DJ?';
export const ROLE_QUESTION_HELP = 'A Yes adds a DJ or teacher page to your profile.';
export const ROLE_QUESTION_REASON_BOTH = 'Answer both questions to continue.';
export const ROLE_QUESTION_REASON_ONE = 'Answer the question to continue.';
export const ROLE_MINIMUM_REASON = 'Fill in the boxes under each Yes to continue.';
export const ROLE_SAVE_FAILED = 'Your answer was not saved. Try again. Your answers are kept.';

/** Teacher first, then DJ: the server's order for the new go-live entries (A1). */
export const ASKABLE: readonly Role[] = ['teacher', 'dj'];

export const DO_YOU: Record<Role, string> = { teacher: 'Do you teach?', dj: 'Do you DJ?' };

/** The minimum a Yes opens: the editor field key (the DJ go-live key `dj_genres` is the field `genres`). */
export interface MinimumField { key: string; label: string; kind: 'text' | 'list'; placeholder: string }
export const ROLE_MINIMUM: Record<Role, readonly MinimumField[]> = {
  teacher: [{ key: 'teaching_styles', label: 'Styles you teach', kind: 'list', placeholder: 'Sensual, Dominican' }],
  dj: [
    { key: 'dj_name', label: 'DJ name', kind: 'text', placeholder: 'DJ name' },
    { key: 'genres', label: 'Music you play', kind: 'list', placeholder: 'Bachata, Kizomba' },
  ],
};

/** The roles to ask: neither claimed nor declined. */
export function rolesToAsk(intent: RoleIntent): Role[] {
  return ASKABLE.filter((r) => !intent.roles.includes(r) && !intent.declined.includes(r));
}

export type RoleAnswer = { yes: boolean | null; fields: Record<string, string> };
export type RoleAnswers = Partial<Record<Role, RoleAnswer>>;

/** "Sensual, Dominican" -> ['Sensual', 'Dominican']: trimmed, no blanks, no repeats. */
export function listFromText(raw: string): string[] {
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const t = part.trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

const filled = (f: MinimumField, raw: string | undefined): boolean =>
  f.kind === 'list' ? listFromText(raw ?? '').length > 0 : (raw ?? '').trim() !== '';

/** Why Continue is off, or null when it can go. Every asked role answered; every Yes has its minimum. */
export function roleQuestionBlock(asked: readonly Role[], answers: RoleAnswers): string | null {
  if (asked.some((r) => answers[r]?.yes == null)) return asked.length > 1 ? ROLE_QUESTION_REASON_BOTH : ROLE_QUESTION_REASON_ONE;
  for (const r of asked) {
    const a = answers[r]!;
    if (a.yes && ROLE_MINIMUM[r].some((f) => !filled(f, a.fields[f.key]))) return ROLE_MINIMUM_REASON;
  }
  return null;
}

/**
 * What a Yes sends to save_my_role_v1: ONLY the minimum keys whose value differs
 * from what the server holds. A list keeps every item already saved and adds the
 * new ones; a name already saved the same is not sent. {} = send nothing.
 */
export function minimumPatch(role: Role, fields: Record<string, string>, current: Details): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const f of ROLE_MINIMUM[role]) {
    const before = current[f.key];
    if (f.kind === 'list') {
      const had = Array.isArray(before) ? (before as unknown[]).filter((x): x is string => typeof x === 'string') : [];
      const next = [...had, ...listFromText(fields[f.key] ?? '').filter((x) => !had.includes(x))];
      if (!sameValue(had, next)) patch[f.key] = next;
    } else {
      const next = (fields[f.key] ?? '').trim();
      if (next !== '' && next !== (typeof before === 'string' ? before : '')) patch[f.key] = next;
    }
  }
  return patch;
}

export interface RoleQuestionWriters {
  answerDoYou: (role: Role, yes: boolean) => Promise<number>;
  fetchDetails: (role: Role) => Promise<Details>;
  saveMyRole: (role: Role, patch: Record<string, unknown>) => Promise<unknown>;
}

/** Write every answer: the Yes/No first (person_roles / decline), then a Yes's minimum. Returns the writes sent. */
export async function saveRoleAnswers(asked: readonly Role[], answers: RoleAnswers, w: RoleQuestionWriters): Promise<number> {
  let writes = 0;
  for (const r of asked) {
    const a = answers[r];
    if (!a || a.yes == null) continue;
    writes += await w.answerDoYou(r, a.yes);
    if (!a.yes) continue;
    const patch = minimumPatch(r, a.fields, await w.fetchDetails(r));
    if (Object.keys(patch).length > 0) { await w.saveMyRole(r, patch); writes += 1; }
  }
  return writes;
}

// ---- "It's live" ------------------------------------------------------------------------------

export const ITS_LIVE_TITLE = "It's live";
export const itsLiveLine = (eventName: string): string => `${eventName} is live.`;

/** The role pages "It's live" offers: roles already claimed, plus a Yes given on the way here. Teacher first. */
export function offerRoles(intent: RoleIntent | null, answers: RoleAnswers): Role[] {
  return ASKABLE.filter((r) => intent?.roles.includes(r) || answers[r]?.yes === true);
}

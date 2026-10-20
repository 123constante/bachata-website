// Pure, client-free helpers for the new-page flow (C40 name, C40b city).
import { selfServeErrorCode } from '@/modules/organiser/shared/selfServeErrors';

/**
 * The 24 h cap (plan 4.11, A1b: 3 pages per login per 24 hours). The prod
 * function still raises `draft_limit_reached` until A1b lands; the others are
 * the codes A1b may raise for the same rule. Every one shows THIS reason, never
 * selfServeErrors' older "three organisers waiting" line (a live page never waits).
 */
export const CAP_CODES: ReadonlySet<string> = new Set(['draft_limit_reached', 'organiser_create_cap', 'organiser_cap_reached', 'create_cap_reached']);
export const CAP_REASON = 'You can create three pages in 24 hours. Try again tomorrow.';

export type CreateRefusal = 'name_taken' | 'cap' | 'other';

export function classifyRefusal(error: unknown): CreateRefusal {
  const code = selfServeErrorCode(error);
  if (code === 'organiser_name_taken') return 'name_taken';
  if (code && CAP_CODES.has(code)) return 'cap';
  return 'other';
}

/** The server compares names loosely (case, spacing); so does the lookup that names the page. */
export const nameKey = (name: string) =>
  name.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

export function findByName<T extends { name: string }>(rows: readonly T[], name: string): T | null {
  const key = nameKey(name);
  return rows.find((r) => nameKey(r.name) === key) ?? null;
}

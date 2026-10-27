import { CATEGORY_WORD_LABEL, NOT_SET_LABEL, categoryLabelFor, deriveCategories } from '@/lib/eventCategory';
import type { P3Kind, SessionFields } from './types';

/**
 * The shape of a series, worked out exactly as CONTRACT.md section 1 does
 * (format first, then the rule mode). This is the shape, NOT the kind word.
 */
export function kindOf(format: string | null | undefined, ruleMode: string | null | undefined): P3Kind {
  if (format === 'festival') return 'festival';
  if (format === 'course') return 'course';
  if (ruleMode === 'monthly') return 'monthly';
  if (ruleMode === 'custom') return 'custom';
  if (format === 'recurring') return 'weekly';
  return 'oneoff';
}

/**
 * The kind word (read-only, never a picker) from the stored category mirror.
 * The ONE mapping is src/lib/eventCategory.ts; this adds none.
 */
export function kindWordStored(format: string | null | undefined, storedCategory: string | null | undefined): string {
  return categoryLabelFor(format, storedCategory);
}

/** The kind word from the sessions themselves (the server derives the same from items). */
export function kindWordFromSessions(format: string | null | undefined, sessions: ReadonlyArray<Pick<SessionFields, 'kind'>>): string {
  const { word } = deriveCategories(format, [], sessions.map((s) => s.kind));
  return word ? CATEGORY_WORD_LABEL[word] : NOT_SET_LABEL;
}

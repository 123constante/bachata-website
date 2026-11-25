import { linkTarget } from './bioModel';

/** Dancer onboarding v8 profile percentage. Client-side only; NOT the server `profile.strength`. */
export type ProgressItem = 'photo' | 'years' | 'styles' | 'partner' | 'bio' | 'link';

/** Display order of the items (also the order of `missing`). */
export const PROGRESS_ITEMS: readonly ProgressItem[] = ['photo', 'years', 'styles', 'partner', 'bio', 'link'];

/** ONE constant: 100% is reachable only when every item is done. OWNER 2026-11-25: 6. */
export const PROGRESS_TOTAL = PROGRESS_ITEMS.length;

export type ProgressInput = {
  photo: boolean;
  startedYear: number | null;
  styles: readonly string[];
  /** YES or NO both count; null = not answered. */
  partnerAnswered: boolean;
  bio: string;
  /** Instagram or website text (either column). */
  link: string;
};

export type ProgressResult = {
  done: number;
  total: number;
  pct: number;
  missing: ProgressItem[];
  next: ProgressItem | null;
};

export const NEXT_LABEL: Record<ProgressItem, string> = {
  photo: 'add a photo',
  years: 'add your years dancing',
  styles: 'add your styles',
  partner: 'answer the partner question',
  bio: 'add a bio',
  link: 'add a link',
};

export const profileProgress = (i: ProgressInput): ProgressResult => {
  const doneBy: Record<ProgressItem, boolean> = {
    photo: i.photo,
    years: i.startedYear !== null,
    styles: i.styles.length > 0,
    partner: i.partnerAnswered,
    bio: i.bio.trim() !== '',
    link: linkTarget(i.link) !== null,
  };
  const missing = PROGRESS_ITEMS.filter((k) => !doneBy[k]);
  const done = PROGRESS_TOTAL - missing.length;
  return { done, total: PROGRESS_TOTAL, pct: Math.round((done / PROGRESS_TOTAL) * 100), missing, next: missing[0] ?? null };
};

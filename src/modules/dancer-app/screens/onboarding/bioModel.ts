import { instagramProfileLinkHandle } from '@/lib/instagramHandle';
import { isEmptyDelta } from '../../api/delta';
import type { DancerDelta, MyDancerEdit } from '../../api/types';
import { buildDelta, draftFromProfile, validateDraft } from '../me/model';

/** Dancer onboarding v3 bio + links screen: the pure part. It reuses the Edit screen's draft, validation and delta rules, so a save here is exactly an Edit save. */

const WEB_TLD = /\.(com|net|org|co|uk|io|me|app|fr|es|de|it|nl|pl|ro|ru|pt|br|ca|au)$/i;

/** One box, two columns: an Instagram handle or profile link goes to `instagram`, any other link to `website_url`. */
export const linkTarget = (raw: string): 'instagram' | 'website_url' | null => {
  const t = raw.trim();
  if (t === '') return null;
  if (instagramProfileLinkHandle(t) !== null || t.startsWith('@')) return 'instagram';
  if (/^https?:\/\//i.test(t) || t.includes('/') || /^www\./i.test(t) || WEB_TLD.test(t)) return 'website_url';
  return 'instagram';
};

const withScheme = (v: string): string => (/^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`);

/** The keys that changed, from the two boxes. Empty boxes (or an untouched bio) send nothing. */
/** What the link box shows on open: the saved Instagram, else the saved website, else empty. */
export const linkPrefill = (profile: Pick<MyDancerEdit, 'instagram' | 'website_url'>): string => {
  const ig = (profile.instagram ?? '').trim();
  if (ig !== '') return ig;
  return (profile.website_url ?? '').trim();
};

export const bioLinkDraft = (profile: MyDancerEdit, bio: string, link: string) => {
  const d = draftFromProfile(profile);
  d.bio = bio;
  // An untouched prefilled box is the saved value itself: send nothing for it.
  const target = link.trim() === linkPrefill(profile) ? null : linkTarget(link);
  if (target === 'instagram') d.instagram = link.trim();
  if (target === 'website_url') d.website_url = withScheme(link);
  return { draft: d, target };
};

export type BioLinkResult = { delta: DancerDelta; error: string | null; filled: { bio: boolean; link: boolean } };

export const bioLinkResult = (profile: MyDancerEdit, bio: string, link: string): BioLinkResult => {
  const { draft, target } = bioLinkDraft(profile, bio, link);
  const errors = validateDraft(draft, profile);
  const delta = buildDelta(profile, draft);
  const only: DancerDelta = {};
  for (const k of ['bio', 'instagram', 'website_url'] as const) if (k in delta) (only as Record<string, unknown>)[k] = delta[k];
  const field = target ?? 'instagram';
  const error = errors.bio ?? (target ? errors[field] : null) ?? null;
  return {
    delta: only,
    error,
    filled: { bio: typeof only.bio === 'string' && only.bio !== '', link: typeof only.instagram === 'string' || typeof only.website_url === 'string' },
  };
};

export const noBioDelta = (r: BioLinkResult): boolean => isEmptyDelta(r.delta);

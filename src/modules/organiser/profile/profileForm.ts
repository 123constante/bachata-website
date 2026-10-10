import type { OrganiserProfileEditForm } from '@/lib/organiserProfileUpdate';
import type { OrganiserPublicRecord } from '@/lib/organiserPublicCols';

/** The row fetchOrganiserEntity returns: the public columns plus its city. */
export type ProfileEntity = OrganiserPublicRecord & {
  cities?: { name: string | null; slug: string | null } | null;
};

const text = (v: unknown) => (typeof v === 'string' ? v : '');

/**
 * The edit form for one organiser, filled from its stored row. Every field the
 * RPC takes that the public row carries is filled, including the ones this
 * screen does not show (category, founded year): the server treats an unchanged
 * value as a no-op. The phone and the show-contact flag are private columns this
 * screen does not show, so they stay undefined and are left out of the patch.
 */
export function formFromEntity(entity: ProfileEntity): OrganiserProfileEditForm {
  const socials = (entity.socials ?? null) as { instagram?: unknown; website?: unknown; facebook?: unknown } | null;
  return {
    name: text(entity.name),
    avatar_url: text(entity.avatar_url),
    bio: text(entity.bio),
    instagram: text(entity.instagram) || text(socials?.instagram),
    facebook: text(socials?.facebook),
    website: text(entity.website) || text(socials?.website),
    organisation_category: text(entity.organisation_category),
    founded_year: entity.founded_year ? String(entity.founded_year) : '',
  };
}

/** "@ritmo", "ritmo" or "https://instagram.com/ritmo/" -> "ritmo"; '' when there is none. */
export function instagramHandle(value: string): string {
  const v = value.trim();
  if (!v) return '';
  const fromUrl = v.match(/instagram\.com\/([^/?#]+)/i);
  return (fromUrl ? fromUrl[1] : v).replace(/^@/, '');
}

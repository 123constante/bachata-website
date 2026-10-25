import { toast } from 'sonner';
import { SITE_ORIGIN } from '@/lib/seo';
import { rolePagePath, type PersonRole } from '../personRoles';

/**
 * The link Share hands out (people arc S5): the canonical URL of the world on screen, the same
 * `<origin>/<role page>/<slug>` the page's own canonical is, so a pasted link previews THAT role
 * and never carries a ?fbclid / #tab / preview host. No slug yet (still resolving): the page's
 * own path, query and hash dropped.
 */
export function shareUrlFor(current: PersonRole, slug: string | null | undefined, here: { pathname: string } | null): string {
  if (slug) return `${SITE_ORIGIN}${rolePagePath(current, slug)}`;
  return here ? `${SITE_ORIGIN}${here.pathname}` : SITE_ORIGIN;
}

/** navigator.share where there is one, else copy the link. The URL is worked out on tap only (SSR-safe). */
export async function sharePage(title: string, current: PersonRole, slug: string | null | undefined): Promise<void> {
  const url = shareUrlFor(current, slug, typeof window !== 'undefined' ? window.location : null);
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, url });
      return;
    } catch (err) {
      // The person closed the sheet: nothing to say. Any other failure falls through to copying the link.
      if ((err as { name?: string } | null)?.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Link copied');
  } catch {
    toast.error("Couldn't copy the link. Try again.");
  }
}

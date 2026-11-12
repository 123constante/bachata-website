/**
 * Share helpers for the organiser dashboard. Pure builders (testable) plus one runner.
 * Links are the real public routes: /organisers/:id and /event/:ref (publicEventRef, never a series id).
 */
export const pageLinkOf = (origin: string, pageId: string): string => `${origin}/organisers/${encodeURIComponent(pageId)}`;

/** null when the row has no safe public ref: the night's Share is then disabled with a reason. */
export const nightLinkOf = (origin: string, publicEventRef: string): string | null =>
  publicEventRef ? `${origin}/event/${encodeURIComponent(publicEventRef)}` : null;

export const captionOf = (name: string, when: string, link: string): string => `${name}, ${when}.\nDetails and who's going: ${link}`;

export const whatsappHref = (text: string): string => `https://wa.me/?text=${encodeURIComponent(text)}`;

export type ShareOutcome = 'shared' | 'copied' | 'whatsapp';

/** Native share sheet, then clipboard, then WhatsApp deep link (same order as the event page). */
export async function shareText(title: string, text: string, url: string): Promise<ShareOutcome> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch {
      /* cancelled or failed: fall through */
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(url);
      return 'copied';
    } catch {
      /* fall through */
    }
  }
  window.open(whatsappHref(`${text}\n${url}`), '_blank', 'noopener,noreferrer');
  return 'whatsapp';
}

// Some events carry the site's own social-share banner as their cover. It is not a
// poster: the CSP blocks it as an image on the apex host (broken thumbnail plus a
// console error), and a generic banner reads wrong as a poster anyway. Treat it as
// "no cover" so the card shows its normal gradient + monogram tile.
const SITE_PLACEHOLDER = /^https?:\/\/(www\.)?bachatacalendar\.co\.uk\/og-image\.jpe?g(\?.*)?$/i;

export function isSitePlaceholderCover(url: string | null | undefined): boolean {
  return !!url && SITE_PLACEHOLDER.test(url.trim());
}

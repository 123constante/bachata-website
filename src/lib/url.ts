/**
 * Returns a safe absolute URL for external hrefs, or undefined if the input is
 * falsy or cannot be parsed as an http/https URL.
 */
export function safeExternalHref(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.href;
    }
  } catch {
    // invalid URL
  }
  return undefined;
}

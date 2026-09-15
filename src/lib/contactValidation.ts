// Shared validation for user-supplied contact fields (contact_email,
// contact_phone / whatsapp / public_email) before they're turned into a
// clickable mailto:/tel:/wa.me href. Centralised here because per-page
// re-implementations (OrganiserProfile.tsx, VendorDetail.tsx,
// TeacherProfile.tsx) diverged and one hardening attempt on a single page
// burned 3 review rounds fixing local-only regressions.

// Deliberately excludes RFC5322 atext characters that are legal in a local
// part but dangerous once spliced raw into `mailto:${email}` (?, &, #, %
// can start a query string / header-injection sequence in some mail
// clients).
const EMAIL_RE =
  /^[A-Za-z0-9._+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function isValidEmail(value: string | null | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  return EMAIL_RE.test(trimmed);
}

// E.164 allows 7-15 digits. Counting digits after stripping punctuation
// (rather than restricting the input charset) is what lets legacy
// dot/slash/space-formatted numbers still validate.
export function normalizePhoneDigits(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return digits;
}

export function buildMailtoHref(value: string | null | undefined): string | null {
  return isValidEmail(value) ? `mailto:${value.trim()}` : null;
}

export function buildWhatsAppHref(value: string | null | undefined): string | null {
  const digits = normalizePhoneDigits(value);
  return digits ? `https://wa.me/${digits}` : null;
}

// tel: keeps the original formatting (browsers/dialers handle +, spaces,
// parens, dashes fine) -- only the digit count is used to decide validity.
export function buildTelHref(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return normalizePhoneDigits(trimmed) ? `tel:${trimmed}` : null;
}

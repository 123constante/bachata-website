// Support contact (D7): the owner sets both values in Vercel at phase 5; they
// are never written in the repo. A missing or malformed value is null, and the
// screen hides that row, so an empty state is never a dead link.

const WHATSAPP = /^https:\/\/(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)\//;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function read(value: unknown, shape: RegExp): string | null {
  const v = typeof value === 'string' ? value.trim() : '';
  return v && shape.test(v) ? v : null;
}

export function supportLinks(): { whatsapp: string | null; email: string | null } {
  return {
    whatsapp: read(import.meta.env.VITE_SUPPORT_WHATSAPP, WHATSAPP),
    email: read(import.meta.env.VITE_SUPPORT_EMAIL, EMAIL),
  };
}

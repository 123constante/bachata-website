// D36: the invite landing names WHO the invite is for only as a masked hint ("r...@ymail.com"),
// never the full address: a forwarded or overlooked link must not show anyone the invited
// person's email. Both organiser_invite_preview_v1 (email_hint) and the redeem refusal
// email_mismatch (invite_email_hint) go through safeEmailHint, which refuses anything that
// still reads as a whole address.

import { previewOrganiserInvite } from './adminApi';

/** A masked address: something before the @ is hidden by "..." or "*". A full address is null. */
export function safeEmailHint(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const hint = v.trim();
  const at = hint.lastIndexOf('@');
  if (at < 1 || at === hint.length - 1) return null;
  const local = hint.slice(0, at);
  return local.includes('...') || local.includes('*') ? hint : null;
}

export interface InvitePreview {
  emailHint: string;
}

/** organiser_invite_preview_v1 -> {email_hint, organiser_name}. No usable masked hint, no preview. */
export function parseInvitePreview(data: unknown): InvitePreview | null {
  if (!data || typeof data !== 'object') return null;
  const emailHint = safeEmailHint((data as { email_hint?: unknown }).email_hint);
  return emailHint ? { emailHint } : null;
}

/** Never throws: an error, a missing function (not yet on this database) or a bad shape is null. */
export async function fetchInvitePreview(token: string): Promise<InvitePreview | null> {
  try {
    const { data, error } = await previewOrganiserInvite(token);
    return error ? null : parseInvitePreview(data);
  } catch {
    return null;
  }
}

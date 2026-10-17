// Edit in place: the ONE mapping for the owner's contact details. The Contact
// card's Public / Hidden tag, the Contact details sheet's switches and their
// lines, its "We will save" line, AND the saved patch all read contactItems() /
// contactPatch() below; nothing else decides whether an item is public.
//
// Contract (admin PR #771): get_organiser_contact_settings_v1 returns
// show_phone_publicly and show_email_publicly (the RPC before it only the legacy
// show_contact_publicly: storedContactFromSettings treats both as that value).
// organiser_profile_update_p5_v1 takes the two split keys (booleans; an
// unchanged value is a no-op). The legacy show_contact_publicly SETS BOTH, so
// it is never sent. contact_email is admin-only (contact_email_admin_only), so
// it is shown read-only and never sent either.
//
// One rule makes "never Public for an empty value" hold everywhere: an EMPTY
// item's switch keeps the stored flag (it is disabled, with a reason), so it is
// never public and its flag never goes out in a patch.

import type { FieldKey } from './fieldRules';
import type { ContactSettings } from '@/modules/organiser/shared/ownershipApi';

export const CONTACT_FIELDS = ['contact_phone', 'show_phone_publicly', 'show_email_publicly'] as const satisfies readonly FieldKey[];
export type ContactField = (typeof CONTACT_FIELDS)[number];
export const isContactField = (k: string): k is ContactField => (CONTACT_FIELDS as readonly string[]).includes(k);

type ContactDrafts = Partial<Record<FieldKey, string>>;

/** What the server holds, read through get_organiser_contact_settings_v1. */
export interface StoredContact {
  phone: string | null;
  email: string | null;
  showPhone: boolean;
  showEmail: boolean;
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * The settings read as the mapping's input. Tolerates the legacy payload (only
 * show_contact_publicly) even when it did not come through fetchContactSettings.
 */
export function storedContactFromSettings(input: ContactSettings | Record<string, unknown>): StoredContact {
  const s = input as Record<string, unknown>;
  const legacy = s.show_contact_publicly === true;
  const pick = (k: 'show_phone_publicly' | 'show_email_publicly') => (k in s ? s[k] === true : legacy);
  return { phone: text(s.contact_phone), email: text(s.contact_email), showPhone: pick('show_phone_publicly'), showEmail: pick('show_email_publicly') };
}

export const CONTACT_COPY = {
  card: 'Contact',
  editRow: 'Edit contact details',
  title: 'Contact details',
  sub: 'How dancers can reach you. You choose what everyone sees.',
  on: 'Everyone can see this',
  off: 'Hidden: only you and admins see this',
  needPhone: 'Add a phone number first',
  needEmail: 'No email yet. Only an admin can add one',
  emailAdminOnly: 'Your email is set when the page is claimed. Only an admin can change it.',
  hint: 'Done adds it to your draft. Nothing goes live until you tap Save.',
  notAdded: 'Not added',
  loading: 'Loading your contact details\u2026',
  failed: 'Your contact details did not load, so they cannot be changed right now.',
  retry: 'Try again',
  noChange: 'No change: your contact details are already like this on your page.',
};

export type ContactTag = 'Public' | 'Hidden';

export interface ContactItem {
  kind: 'phone' | 'email';
  label: 'Phone' | 'Email';
  /** The full value (the sheet), or null when empty. */
  value: string | null;
  /** The owner card's masked value, or null when empty. */
  masked: string | null;
  empty: boolean;
  /** THE fact: visitors see this item after Save. Never true for an empty value. */
  isPublic: boolean;
  /** The card's tag; null for an empty value (the card says "Not added"). */
  tag: ContactTag | null;
  /** The line under the switch. */
  line: string;
  /** Why the switch is disabled, or null when it can be used. */
  disabledReason: string | null;
  /** This item differs from what is stored (value or switch). */
  drafted: boolean;
}

const BULLET = '•';

/** '07700 900123' -> '07** *** 123' (bullets), '+44 7700 900123' -> '+44** *** 123'. */
export function maskPhone(v: string): string {
  const digits = v.replace(/\D/g, '');
  const plus = v.trim().startsWith('+') ? '+' : '';
  if (digits.length < 6) return `${plus}${BULLET.repeat(Math.max(digits.length, 3))}`;
  return `${plus}${digits.slice(0, 2)}${BULLET.repeat(2)} ${BULLET.repeat(3)} ${digits.slice(-3)}`;
}

/** 'hello@example.com' -> 'hello@******.com' (bullets): the name stays, the domain is hidden, its ending kept. */
export function maskEmail(v: string): string {
  const t = v.trim();
  const at = t.lastIndexOf('@');
  if (at < 0) return BULLET.repeat(6);
  const domain = t.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return `${t.slice(0, at)}@${BULLET.repeat(6)}${dot >= 0 ? domain.slice(dot) : ''}`;
}

const flagDraft = (v: string | undefined): boolean | undefined => (v === 'true' ? true : v === 'false' ? false : undefined);

/** The phone and email as they will be after Save: the stored values with the drafts laid over. */
export function contactItems(stored: StoredContact, drafts: ContactDrafts): { phone: ContactItem; email: ContactItem } {
  const phoneDraft = drafts.contact_phone;
  const phone = phoneDraft !== undefined ? text(phoneDraft) : stored.phone;
  const item = (kind: 'phone' | 'email', value: string | null, storedValue: string | null, storedFlag: boolean, draftFlag: boolean | undefined): ContactItem => {
    const empty = !value;
    // An empty item keeps the stored flag: its switch is disabled, so a draft cannot move it.
    const flag = empty ? storedFlag : draftFlag ?? storedFlag;
    const isPublic = !empty && flag;
    const disabledReason = empty ? (kind === 'phone' ? CONTACT_COPY.needPhone : CONTACT_COPY.needEmail) : null;
    return {
      kind,
      label: kind === 'phone' ? 'Phone' : 'Email',
      value,
      masked: value ? (kind === 'phone' ? maskPhone(value) : maskEmail(value)) : null,
      empty,
      isPublic,
      tag: empty ? null : isPublic ? 'Public' : 'Hidden',
      line: disabledReason ?? (isPublic ? CONTACT_COPY.on : CONTACT_COPY.off),
      disabledReason,
      drafted: value !== storedValue || flag !== storedFlag,
    };
  };
  return {
    phone: item('phone', phone, stored.phone, stored.showPhone, flagDraft(drafts.show_phone_publicly)),
    email: item('email', stored.email, stored.email, stored.showEmail, flagDraft(drafts.show_email_publicly)),
  };
}

/** The sheet's "We will save" line: 'phone +44 7700 900123 (public), email hello@example.com (hidden)'. */
export function contactWillSave(items: { phone: ContactItem; email: ContactItem }): string {
  const part = (i: ContactItem) => (i.empty ? `no ${i.kind}` : `${i.kind} ${i.value} (${i.isPublic ? 'public' : 'hidden'})`);
  return `${part(items.phone)}, ${part(items.email)}`;
}

/**
 * The contact part of the ONE save: ONLY the keys whose value differs from what
 * is stored, read off the same contactItems() the card and the sheet show.
 * Never show_contact_publicly, never contact_email.
 */
export function contactPatch(stored: StoredContact, drafts: ContactDrafts): Partial<Record<ContactField, string | boolean | null>> {
  const { phone, email } = contactItems(stored, drafts);
  const out: Partial<Record<ContactField, string | boolean | null>> = {};
  if (phone.value !== stored.phone) out.contact_phone = phone.value;
  const phoneFlag = phone.empty ? stored.showPhone : phone.isPublic;
  if (phoneFlag !== stored.showPhone) out.show_phone_publicly = phoneFlag;
  const emailFlag = email.empty ? stored.showEmail : email.isPublic;
  if (emailFlag !== stored.showEmail) out.show_email_publicly = emailFlag;
  return out;
}

/** The sheet's Done: the drafts for exactly the contact keys that change something. */
export function contactDraftsFor(stored: StoredContact, local: { phone: string; showPhone: boolean; showEmail: boolean }): ContactDrafts {
  const patch = contactPatch(stored, { contact_phone: local.phone, show_phone_publicly: String(local.showPhone), show_email_publicly: String(local.showEmail) });
  const out: ContactDrafts = {};
  if ('contact_phone' in patch) out.contact_phone = local.phone.trim();
  if ('show_phone_publicly' in patch) out.show_phone_publicly = String(patch.show_phone_publicly);
  if ('show_email_publicly' in patch) out.show_email_publicly = String(patch.show_email_publicly);
  return out;
}

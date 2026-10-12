/**
 * The Contact card, the Contact details sheet, its "We will save" line and the
 * saved patch read ONE fact per item from ONE mapping (contactModel.contactItems).
 * Table-driven over every stored shape: phone {empty, set} x email {empty, set}
 * x show_phone_publicly {on, off} x show_email_publicly {on, off}, each with no
 * draft, the phone switch flipped, the email switch flipped and the phone
 * cleared; plus the legacy settings payload (only show_contact_publicly, the
 * RPC before admin #771) and a failed read.
 *
 * Contract (admin PR #771): organiser_profile_update_p5_v1 takes
 * show_phone_publicly / show_email_publicly (boolean, unchanged = no-op); the
 * legacy show_contact_publicly SETS BOTH, so the Website never sends it.
 * contact_email is admin-only (contact_email_admin_only), so it is never sent.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ProfileEntity } from '@/modules/organiser/profile/profileForm';
import {
  CONTACT_COPY,
  contactItems,
  contactWillSave,
  maskEmail,
  maskPhone,
  storedContactFromSettings,
  type StoredContact,
} from '../contactModel';
import { buildSavePatch, prunedDrafts, saveDrafts, type Drafts } from '../draftModel';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const ENTITY = {
  id: '22222222-2222-4222-8222-222222222222', name: 'Ritmo Latino', avatar_url: null, bio: null, socials: {},
  city_id: '11111111-1111-4111-8111-111111111111', instagram: null, website: null, organisation_category: null,
  founded_year: null, cities: { name: 'London', slug: 'london-gb' },
} as ProfileEntity;

const PHONE = '+44 7700 900123';
const EMAIL = 'hello@example.com';

type Shape = { name: string; stored: StoredContact };
const SHAPES: Shape[] = [];
for (const phone of [null, PHONE]) {
  for (const email of [null, EMAIL]) {
    for (const showPhone of [true, false]) {
      for (const showEmail of [true, false]) {
        SHAPES.push({
          name: `phone ${phone ? 'set' : 'empty'} ${showPhone ? 'on' : 'off'}, email ${email ? 'set' : 'empty'} ${showEmail ? 'on' : 'off'}`,
          stored: { phone, email, showPhone, showEmail },
        });
      }
    }
  }
}

const base = (stored: StoredContact) => ({ ...ENTITY, contact: stored });
const CONTACT_PATCH_KEYS = ['contact_phone', 'show_phone_publicly', 'show_email_publicly'];
const contactPart = (p: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(p).filter(([k]) => CONTACT_PATCH_KEYS.includes(k)));

/** What the patch makes public, read back the way the server would store it. */
function afterSave(stored: StoredContact, drafts: Drafts) {
  const p = buildSavePatch(base(stored), drafts);
  const phone = 'contact_phone' in p ? (p.contact_phone as string | null) : stored.phone;
  const showPhone = 'show_phone_publicly' in p ? (p.show_phone_publicly as boolean) : stored.showPhone;
  const showEmail = 'show_email_publicly' in p ? (p.show_email_publicly as boolean) : stored.showEmail;
  return { phonePublic: !!phone && showPhone, emailPublic: !!stored.email && showEmail };
}

const DRAFT_CASES: Array<{ name: string; drafts: (s: StoredContact) => Drafts }> = [
  { name: 'untouched', drafts: () => ({}) },
  { name: 'phone switch flipped', drafts: (s) => ({ show_phone_publicly: String(!s.showPhone) }) },
  { name: 'email switch flipped', drafts: (s) => ({ show_email_publicly: String(!s.showEmail) }) },
  { name: 'phone cleared', drafts: () => ({ contact_phone: '' }) },
  { name: 'phone changed', drafts: () => ({ contact_phone: '07700 900456' }) },
];

describe.each(SHAPES)('$name', ({ stored }) => {
  it.each(DRAFT_CASES)('$name: card tag, switch, preview line and saved patch agree', ({ drafts: make }) => {
    const drafts = make(stored);
    const items = contactItems(stored, drafts);
    const saved = afterSave(stored, prunedDrafts(base(stored), drafts));
    for (const item of [items.phone, items.email]) {
      const savedPublic = item.kind === 'phone' ? saved.phonePublic : saved.emailPublic;
      // The ONE fact: is this item public after Save?
      expect(item.isPublic, `${item.kind}: the mapping vs the saved patch`).toBe(savedPublic);
      // The card's tag.
      if (item.empty) expect(item.tag).toBeNull();
      else expect(item.tag).toBe(item.isPublic ? 'Public' : 'Hidden');
      // The sheet's switch: never "on" for an empty value, disabled WITH a reason.
      if (item.empty) {
        expect(item.isPublic).toBe(false);
        expect(item.disabledReason).toBe(item.kind === 'phone' ? CONTACT_COPY.needPhone : CONTACT_COPY.needEmail);
        expect(item.line).toBe(item.disabledReason);
      } else {
        expect(item.disabledReason).toBeNull();
        expect(item.line).toBe(item.isPublic ? CONTACT_COPY.on : CONTACT_COPY.off);
      }
    }
    // The preview line says the same, item by item.
    const line = contactWillSave(items);
    expect(line).toContain(items.phone.empty ? 'no phone' : `phone ${items.phone.value} (${items.phone.isPublic ? 'public' : 'hidden'})`);
    expect(line).toContain(items.email.empty ? 'no email' : `email ${items.email.value} (${items.email.isPublic ? 'public' : 'hidden'})`);
    // Never 'Public' for something empty anywhere.
    if (items.phone.empty) expect(line).not.toMatch(/phone[^,]*\(public\)/);
  });

  it.each(DRAFT_CASES)('$name: the patch carries ONLY the changed contact keys, never the legacy or admin-only ones', ({ name, drafts: make }) => {
    const drafts = prunedDrafts(base(stored), make(stored));
    const p = buildSavePatch(base(stored), drafts);
    expect(p).not.toHaveProperty('show_contact_publicly');
    expect(p).not.toHaveProperty('contact_email');
    const c = contactPart(p);
    if (name === 'untouched') expect(c).toEqual({});
    if (name === 'phone switch flipped') expect(c).toEqual(stored.phone ? { show_phone_publicly: !stored.showPhone } : {});
    if (name === 'email switch flipped') expect(c).toEqual(stored.email ? { show_email_publicly: !stored.showEmail } : {});
    if (name === 'phone cleared') expect(c).toEqual(stored.phone ? { contact_phone: null } : {});
    if (name === 'phone changed') expect(c).toEqual({ contact_phone: '07700 900456' });
  });

  it('saving the untouched record sends NOTHING', async () => {
    const rpc = vi.fn();
    expect(await saveDrafts({ rpc } as never, ENTITY.id, base(stored), {})).toEqual({ kind: 'nothing' });
    // Switches flipped twice (back to stored) are no draft either.
    const back = { show_phone_publicly: String(stored.showPhone), show_email_publicly: String(stored.showEmail), contact_phone: stored.phone ?? '' };
    expect(prunedDrafts(base(stored), back)).toEqual({});
    expect(await saveDrafts({ rpc } as never, ENTITY.id, base(stored), back)).toEqual({ kind: 'nothing' });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('the settings payload', () => {
  it('reads both new flags', () => {
    expect(storedContactFromSettings({ contact_phone: PHONE, contact_email: EMAIL, show_phone_publicly: true, show_email_publicly: false, show_contact_publicly: true, claim_email: null }))
      .toEqual({ phone: PHONE, email: EMAIL, showPhone: true, showEmail: false });
  });

  it.each([true, false])('legacy payload (old RPC: only show_contact_publicly = %s) does not crash: both flags take that value', (v) => {
    const stored = storedContactFromSettings({ contact_phone: PHONE, contact_email: EMAIL, show_contact_publicly: v, claim_email: null });
    expect(stored).toEqual({ phone: PHONE, email: EMAIL, showPhone: v, showEmail: v });
    const items = contactItems(stored, {});
    expect(items.phone.isPublic).toBe(v);
    expect(items.email.isPublic).toBe(v);
    // Flipping the phone sends the new key only, never the legacy one.
    const p = buildSavePatch(base(stored), { show_phone_publicly: String(!v) });
    expect(contactPart(p)).toEqual({ show_phone_publicly: !v });
    expect(p).not.toHaveProperty('show_contact_publicly');
  });

  it('a payload with neither flag reads both as hidden (never a guess of public)', () => {
    expect(storedContactFromSettings({ contact_phone: PHONE, contact_email: null })).toEqual({ phone: PHONE, email: null, showPhone: false, showEmail: false });
  });

  it('contact not loaded: the patch never carries a contact key, whatever is drafted', () => {
    const p = buildSavePatch({ ...ENTITY, contact: null }, { contact_phone: '07700 900456', show_phone_publicly: 'true' });
    for (const k of [...CONTACT_PATCH_KEYS, 'show_contact_publicly', 'contact_email']) expect(p).not.toHaveProperty(k);
  });
});

describe('masked values for the owner view', () => {
  it.each([
    ['07700 900123', '07•• ••• 123'],
    ['+44 7700 900123', '+44•• ••• 123'],
  ])('phone %s -> %s', (v, out) => expect(maskPhone(v)).toBe(out));
  it.each([
    ['hello@example.com', 'hello@••••••.com'],
    ['a.b@mail.co.uk', 'a.b@••••••.uk'],
  ])('email %s -> %s', (v, out) => expect(maskEmail(v)).toBe(out));
  it('the card shows the masked value, the sheet the full one', () => {
    const items = contactItems({ phone: '07700 900123', email: EMAIL, showPhone: true, showEmail: false }, {});
    expect(items.phone.masked).toBe('07•• ••• 123');
    expect(items.phone.value).toBe('07700 900123');
    expect(items.email.masked).toBe('hello@••••••.com');
  });
  it('the preview line the mockup shows', () => {
    const items = contactItems({ phone: PHONE, email: EMAIL, showPhone: true, showEmail: false }, {});
    expect(contactWillSave(items)).toBe('phone +44 7700 900123 (public), email hello@example.com (hidden)');
  });
});

// @vitest-environment jsdom
/**
 * The Contact card and the ONE "Contact details" sheet (mockup "Contact sheet",
 * screen 2), end to end through the owner layer, over every stored shape:
 * phone {empty, set} x email {empty, set} x each switch {on, off}, plus the legacy
 * settings payload (only show_contact_publicly) and a failed read. The switches
 * are real controls (role=switch, aria-checked, a name); their state is part of
 * the draft: Cancel discards, Done drafts, Save sends ONLY the changed keys, and
 * an untouched record sends nothing. Never show_contact_publicly, never contact_email.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ProfileEntity } from '@/modules/organiser/profile/profileForm';
import type { ContactSettings } from '@/modules/organiser/shared/ownershipApi';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn() } }));

import EditInPlaceLayer from '../EditInPlaceLayer';
import type { EipBridge } from '../bridge';
import { CONTACT_COPY } from '../contactModel';
import { PHONE_FIELD_TOKENS } from '../sheetStyles';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ID = '22222222-2222-4222-8222-222222222222';
const ENTITY = {
  id: ID, name: 'Ritmo Latino', avatar_url: 'https://cdn.example/r.jpg', bio: 'Hi', socials: {}, city_id: '11111111-1111-4111-8111-111111111111',
  instagram: '@ritmo', website: null, organisation_category: 'Dance School', founded_year: 2019, cities: { name: 'London', slug: 'london-gb' },
} as ProfileEntity;

const PHONE = '+44 7700 900123';
const EMAIL = 'hello@example.com';
const settings = (o: Partial<ContactSettings> & Record<string, unknown>): ContactSettings =>
  ({ contact_phone: PHONE, contact_email: EMAIL, show_phone_publicly: true, show_email_publicly: false, claim_email: null, ...o }) as ContactSettings;

function Harness({ rpc, fetchContact }: { rpc: ReturnType<typeof vi.fn>; fetchContact: () => Promise<ContactSettings> }) {
  const [eip, setEip] = useState<EipBridge | null>(null);
  return (
    <div>
      {eip?.slot('contact')}
      <EditInPlaceLayer organiserId={ID} entity={ENTITY} onBridge={setEip} client={{ rpc } as never} fetchContact={fetchContact} />
    </div>
  );
}

function setup(s: ContactSettings | Error) {
  const storedPhone = s instanceof Error ? null : s.contact_phone;
  // The RPC's profile carries contact_phone (not the flags), as admin #771 returns it.
  const rpc = vi.fn(async (_n: string, args: { p_patch: Record<string, unknown> }) => ({
    data: { changed_keys: Object.keys(args.p_patch), profile: { ...ENTITY, contact_phone: 'contact_phone' in args.p_patch ? args.p_patch.contact_phone : storedPhone } },
    error: null,
  }));
  const fetchContact = vi.fn(async () => { if (s instanceof Error) throw s; return s; });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/o', element: <Harness rpc={rpc} fetchContact={fetchContact} /> }], { initialEntries: ['/o'] });
  render(<QueryClientProvider client={qc}><RouterProvider router={router} /></QueryClientProvider>);
  return { rpc, fetchContact };
}

const card = () => screen.findByTestId('eip-contact');
const editRow = async () => {
  const c = await card();
  const b = within(c).getByRole('button', { name: 'Edit contact details' });
  await waitFor(() => expect((b as HTMLButtonElement).disabled).toBe(false));
  return b;
};
async function openSheet() {
  fireEvent.click(await editRow());
  return screen.findByRole('dialog', { name: 'Contact details' });
}
const sw = (dialog: HTMLElement, kind: 'Phone' | 'Email') => within(dialog).getByRole('switch', { name: `${kind} on your page` });
const patches = (rpc: ReturnType<typeof vi.fn>) => rpc.mock.calls.map((c) => (c[1] as { p_patch: Record<string, unknown> }).p_patch);

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const SHAPES: Array<{ phone: string | null; email: string | null; showPhone: boolean; showEmail: boolean }> = [];
for (const phone of [null, PHONE]) for (const email of [null, EMAIL]) for (const showPhone of [true, false]) for (const showEmail of [true, false]) SHAPES.push({ phone, email, showPhone, showEmail });

describe.each(SHAPES)('stored phone=$phone ($showPhone) email=$email ($showEmail)', (shape) => {
  it('card tag, sheet switch, line and preview agree; never Public for an empty value', async () => {
    setup(settings({ contact_phone: shape.phone, contact_email: shape.email, show_phone_publicly: shape.showPhone, show_email_publicly: shape.showEmail }));
    const c = await card();
    await waitFor(() => expect(within(c).queryByText(/Loading/)).toBeNull());
    const phoneRow = within(c).getByTestId('eip-contact-phone');
    const emailRow = within(c).getByTestId('eip-contact-email');
    const phonePublic = !!shape.phone && shape.showPhone;
    const emailPublic = !!shape.email && shape.showEmail;
    expect(phoneRow.textContent).toContain(shape.phone ? (phonePublic ? 'Public' : 'Hidden') : 'Not added');
    expect(emailRow.textContent).toContain(shape.email ? (emailPublic ? 'Public' : 'Hidden') : 'Not added');
    if (!shape.phone) expect(phoneRow.textContent).not.toMatch(/Public|Hidden/);
    if (!shape.email) expect(emailRow.textContent).not.toMatch(/Public|Hidden/);
    const d = await openSheet();
    for (const [kind, empty, pub, need] of [['Phone', !shape.phone, phonePublic, CONTACT_COPY.needPhone], ['Email', !shape.email, emailPublic, CONTACT_COPY.needEmail]] as const) {
      const s = sw(d, kind);
      expect(s.getAttribute('aria-checked')).toBe(String(pub));
      expect((s as HTMLButtonElement).disabled).toBe(empty);
      const line = document.getElementById(s.getAttribute('aria-describedby')!.split(' ')[0])!;
      expect(line.textContent).toBe(empty ? need : pub ? CONTACT_COPY.on : CONTACT_COPY.off);
    }
    const preview = within(d).getByTestId('eip-will-save').textContent!;
    expect(preview).toContain(shape.phone ? `phone ${shape.phone} (${phonePublic ? 'public' : 'hidden'})` : 'no phone');
    expect(preview).toContain(shape.email ? `email ${shape.email} (${emailPublic ? 'public' : 'hidden'})` : 'no email');
  });

  it('Done on an untouched sheet drafts nothing, and Save is never offered', async () => {
    const { rpc } = setup(settings({ contact_phone: shape.phone, contact_email: shape.email, show_phone_publicly: shape.showPhone, show_email_publicly: shape.showEmail }));
    const d = await openSheet();
    fireEvent.click(within(d).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByTestId('eip-bar')).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('the Contact details sheet', () => {
  it('says what it is for, and what Done does', async () => {
    setup(settings({}));
    const d = await openSheet();
    expect(d.textContent).toContain(CONTACT_COPY.sub);
    expect(d.textContent).toContain(CONTACT_COPY.hint);
    // The ONE phone field: country first (the stored +44 number opens on +44), then the national digits.
    expect((within(d).getByLabelText('Phone') as HTMLInputElement).value).toBe('7700900123');
    expect((within(d).getByLabelText('Phone') as HTMLInputElement).type).toBe('tel');
    expect(within(d).getByRole('button', { name: /^Country: .* \+44$/ })).toBeTruthy();
    const email = within(d).getByLabelText('Email') as HTMLInputElement;
    expect(email.type).toBe('email');
    expect(email.value).toBe(EMAIL);
    // The server refuses a non-admin email change (contact_email_admin_only): read-only, with the reason.
    expect(email.readOnly).toBe(true);
    expect(d.textContent).toContain(CONTACT_COPY.emailAdminOnly);
    // Inputs are 16px: no zoom on iOS.
    // The phone box is the shared PhoneInput: 16px by its class, not an inline style.
    expect(within(d).getByLabelText('Phone').className).toContain('text-[16px]');
    // Switches keep a 44px tap target.
    expect(sw(d, 'Phone').style.minHeight).toBe('44px');
    expect(sw(d, 'Phone').style.minWidth).toBe('44px');
  });

  it('flip the phone switch, Cancel: nothing is drafted and the card is unchanged', async () => {
    setup(settings({}));
    let d = await openSheet();
    fireEvent.click(sw(d, 'Phone'));
    expect(sw(d, 'Phone').getAttribute('aria-checked')).toBe('false');
    expect(within(d).getByTestId('eip-will-save').textContent).toContain(`phone ${PHONE} (hidden)`);
    fireEvent.click(within(d).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByTestId('eip-bar')).toBeNull();
    expect(within(await card()).getByTestId('eip-contact-phone').textContent).toContain('Public');
    d = await openSheet();
    expect(sw(d, 'Phone').getAttribute('aria-checked')).toBe('true');
  });

  it('flip the email switch, Done, Save: ONE call with ONLY show_email_publicly', async () => {
    const { rpc } = setup(settings({}));
    const d = await openSheet();
    fireEvent.click(sw(d, 'Email'));
    expect(within(d).getByTestId('eip-will-save').textContent).toBe(`We will save: phone ${PHONE} (public), email ${EMAIL} (public)`);
    fireEvent.click(within(d).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('eip-bar-count').textContent).toBe('1 change not saved');
    const emailRow = within(await card()).getByTestId('eip-contact-email');
    expect(emailRow.textContent).toContain('Public');
    expect(emailRow.textContent).toContain('unsaved');
    fireEvent.click(within(screen.getByTestId('eip-bar')).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    const p = patches(rpc)[0];
    expect(p.show_email_publicly).toBe(true);
    for (const k of ['show_phone_publicly', 'contact_phone', 'show_contact_publicly', 'contact_email']) expect(p).not.toHaveProperty(k);
    await waitFor(() => expect(screen.queryByTestId('eip-bar')).toBeNull());
  });

  it('a new phone and a hidden phone go out together, nothing else contact-wise', async () => {
    const { rpc } = setup(settings({}));
    const d = await openSheet();
    fireEvent.change(within(d).getByLabelText('Phone'), { target: { value: ' 07700 900456 ' } });
    fireEvent.click(sw(d, 'Phone'));
    fireEvent.click(within(d).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('eip-bar-count').textContent).toBe('2 changes not saved');
    fireEvent.click(within(screen.getByTestId('eip-bar')).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    const p = patches(rpc)[0];
    // Saved as E.164: the UK trunk zero dropped, no spaces (invite journey W2).
    expect(p).toMatchObject({ contact_phone: '+447700900456', show_phone_publicly: false });
    for (const k of ['show_email_publicly', 'show_contact_publicly', 'contact_email']) expect(p).not.toHaveProperty(k);
  });

  it('a legacy number saved without its country is shown as it is, never blocks Done, and is never re-sent', async () => {
    const { rpc } = setup(settings({ contact_phone: '2345678' }));
    const d = await openSheet();
    expect(within(d).getByTestId('phone-legacy-value').textContent).toBe('2345678');
    expect(within(d).queryByRole('alert')).toBeNull();
    const done = within(d).getByRole('button', { name: 'Done' }) as HTMLButtonElement;
    expect(done.disabled).toBe(false);
    fireEvent.click(sw(d, 'Email'));
    fireEvent.click(done);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(within(screen.getByTestId('eip-bar')).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(patches(rpc)[0]).not.toHaveProperty('contact_phone');
  });

  it('changing a legacy number: Change opens the picker; a short number blocks Done and the field says what is missing (one message)', async () => {
    setup(settings({ contact_phone: '2345678' }));
    const d = await openSheet();
    fireEvent.click(within(d).getByTestId('phone-legacy-change'));
    fireEvent.change(within(d).getByLabelText('Phone'), { target: { value: '7700 9' } });
    const done = within(d).getByRole('button', { name: 'Done' }) as HTMLButtonElement;
    expect(done.disabled).toBe(true);
    expect(within(d).getByTestId('eip-phone-feedback').textContent).toBe('Looks short. United Kingdom numbers have 10 digits after +44.');
    expect(within(d).queryByRole('alert')).toBeNull();
  });

  it('the phone field carries the organiser tokens itself (the public page has no theme.css), equal to .org-theme', async () => {
    const css = readFileSync(resolve(__dirname, '../../theme.css'), 'utf8');
    const block = css.slice(css.indexOf('.org-theme {'), css.indexOf('}', css.indexOf('.org-theme {')));
    for (const [k, v] of Object.entries(PHONE_FIELD_TOKENS)) expect(block, k).toMatch(new RegExp(`${k}:\\s*${v};`));
    setup(settings({}));
    const d = await openSheet();
    expect(within(d).getByTestId('eip-contact-phone').style.getPropertyValue('--danger')).toBe(PHONE_FIELD_TOKENS['--danger']);
  });

  it('an empty phone: the switch is disabled WITH the reason; typing a phone enables it', async () => {
    setup(settings({ contact_phone: null, show_phone_publicly: true }));
    const d = await openSheet();
    expect((sw(d, 'Phone') as HTMLButtonElement).disabled).toBe(true);
    expect(sw(d, 'Phone').getAttribute('aria-checked')).toBe('false');
    expect(d.textContent).toContain(CONTACT_COPY.needPhone);
    fireEvent.change(within(d).getByLabelText('Phone'), { target: { value: '07700 900123' } });
    expect((sw(d, 'Phone') as HTMLButtonElement).disabled).toBe(false);
    expect(sw(d, 'Phone').getAttribute('aria-checked')).toBe('true');
  });

  it('typing digit by digit into an empty phone keeps the box (never the "Saved before" legacy box)', async () => {
    setup(settings({ contact_phone: null }));
    const d = await openSheet();
    const user = userEvent.setup();
    await user.type(within(d).getByLabelText('Phone'), '7');
    expect(within(d).queryByTestId('phone-legacy')).toBeNull();
    await user.type(within(d).getByLabelText('Phone'), '700900123');
    expect((within(d).getByLabelText('Phone') as HTMLInputElement).value).toBe('7700900123');
    expect((within(d).getByRole('button', { name: 'Done' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('typing a new number over a stored one, digit by digit, keeps the box', async () => {
    setup(settings({}));
    const d = await openSheet();
    const user = userEvent.setup();
    await user.clear(within(d).getByLabelText('Phone'));
    await user.type(within(d).getByLabelText('Phone'), '77');
    expect(within(d).queryByTestId('phone-legacy')).toBeNull();
    expect((within(d).getByLabelText('Phone') as HTMLInputElement).value).toBe('77');
  });

  it('clearing the phone turns its switch off and disabled, and the preview never says public', async () => {
    setup(settings({}));
    const d = await openSheet();
    fireEvent.change(within(d).getByLabelText('Phone'), { target: { value: '' } });
    expect((sw(d, 'Phone') as HTMLButtonElement).disabled).toBe(true);
    expect(sw(d, 'Phone').getAttribute('aria-checked')).toBe('false');
    expect(within(d).getByTestId('eip-will-save').textContent).toContain('no phone');
  });

  it('a phone that is not a phone number: the reason shows and Done is disabled', async () => {
    setup(settings({}));
    const d = await openSheet();
    fireEvent.change(within(d).getByLabelText('Phone'), { target: { value: '12' } });
    // The reason is the field's own line, shown at once because Done is off (one message, W2d).
    expect(within(d).getByTestId('eip-phone-feedback').textContent).toBe('Looks short. United Kingdom numbers have 10 digits after +44.');
    expect((within(d).getByRole('button', { name: 'Done' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Escape closes it and focus goes back to the edit row', async () => {
    setup(settings({}));
    const row = await editRow();
    fireEvent.click(row);
    const d = await screen.findByRole('dialog', { name: 'Contact details' });
    await waitFor(() => expect(document.activeElement).toBe(within(d).getByLabelText('Phone')));
    fireEvent.keyDown(d, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(row));
  });

  it.each([true, false])('legacy settings (only show_contact_publicly = %s): no crash, both items read that value', async (v) => {
    setup({ contact_phone: PHONE, contact_email: EMAIL, show_contact_publicly: v, claim_email: null } as unknown as ContactSettings);
    const c = await card();
    await waitFor(() => expect(within(c).getByTestId('eip-contact-phone').textContent).toContain(v ? 'Public' : 'Hidden'));
    expect(within(c).getByTestId('eip-contact-email').textContent).toContain(v ? 'Public' : 'Hidden');
  });

  it('a failed read: the edit row is disabled with the reason, and Try again reads again', async () => {
    const { fetchContact } = setup(new Error('permission_denied'));
    const c = await card();
    await waitFor(() => expect(c.textContent).toContain(CONTACT_COPY.failed));
    expect((within(c).getByRole('button', { name: 'Edit contact details' }) as HTMLButtonElement).disabled).toBe(true);
    const calls = fetchContact.mock.calls.length;
    fireEvent.click(within(c).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(fetchContact.mock.calls.length).toBeGreaterThan(calls));
  });
});

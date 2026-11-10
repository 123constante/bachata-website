// @vitest-environment jsdom
/** Ask to join (onboarding sheet): the note is required, REQUEST_NOTE_MIN characters, one rule with the public claim card. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const api = vi.hoisted(() => ({ request: vi.fn(), claim: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn(), auth: {} } }));
vi.mock('@/modules/organiser/shared/selfServeApi', () => ({
  claimOrganiser: api.claim,
  requestOrganiserAccess: api.request,
}));

import { REQUEST_NOTE_MIN } from '@/modules/organiser/shared/components/PublicClaimCard';
import { OrganiserSheet } from '../OrganiserSheet';

const candidate = { id: 'org-1', name: 'Ritmo', slug: null, avatar_url: null, city_id: null, hint: 'managed' as const };

function mount() {
  return render(
    <MemoryRouter>
      <OrganiserSheet task={{ kind: 'request', org: candidate, hint: 'managed' }} onTaskChange={vi.fn()} email="me@x.example" mailboxProven onClaimed={vi.fn()} onRequested={vi.fn()} onCreated={vi.fn()} onFindPage={vi.fn()} onHome={vi.fn()} />
    </MemoryRouter>,
  );
}

const CASES: Array<[string, string, boolean]> = [
  ['empty', '', false],
  ['spaces only', '  ', false],
  ['two characters', 'ab', false],
  ['three characters', 'abc', true],
  ['three padded with spaces', '  abc  ', true],
  ['500 characters', 'a'.repeat(500), true],
  ['501 characters (cut to 500 by the field)', 'a'.repeat(501), true],
];

describe('onboarding Ask to join: the note is required', () => {
  beforeEach(() => { api.request.mockResolvedValue({ request_id: 'r', status: 'open' }); });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('the minimum is the public card\'s number', () => expect(REQUEST_NOTE_MIN).toBe(3));

  it.each(CASES)('%s', async (_n, value, ok) => {
    mount();
    const note = screen.getByTestId('onboarding-request-note') as HTMLTextAreaElement;
    if (value) fireEvent.change(note, { target: { value } });
    const send = screen.getByTestId('onboarding-request-send') as HTMLButtonElement;
    expect(send.disabled).toBe(!ok);
    expect(!!screen.queryByTestId('onboarding-request-note-required')).toBe(!ok);
    if (!ok) expect(screen.getByTestId('onboarding-request-note-required').textContent).toBe('Add a few words about who you are (at least 3 characters) to send your request.');
    expect(screen.getByText('Who are you?')).toBeTruthy();
    const sent = note.value;
    fireEvent.click(send);
    // Enter inside the field must not send either.
    fireEvent.submit(note);
    await waitFor(() => expect(api.request).toHaveBeenCalledTimes(ok ? 1 : 0));
    if (ok) expect(api.request).toHaveBeenCalledWith('org-1', sent);
  });
});

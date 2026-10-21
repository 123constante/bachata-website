// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => h.rpc(...a) } }));

import { RequestAccess } from '../RequestAccess';
import { TRY_LATER_COPY } from '@/modules/admin-organisers/inviteModel';

afterEach(() => { cleanup(); h.rpc.mockReset(); });

const submit = async (answer: unknown) => {
  h.rpc.mockResolvedValue({ data: answer, error: null });
  render(<RequestAccess initialEmail="ana@example.com" />);
  fireEvent.click(screen.getByTestId('request-access-open'));
  fireEvent.change(screen.getByLabelText('What events do you run?'), { target: { value: 'Friday socials' } });
  fireEvent.click(screen.getByTestId('request-access-send'));
};

describe('RequestAccess (invite-only wall, flow 3)', () => {
  it('sends email + note and confirms without promising a time', async () => {
    await submit({ ok: true });
    expect((await screen.findByTestId('request-access-done')).textContent).toBe('Request sent. We will email you when you are in.');
    expect(h.rpc).toHaveBeenCalledWith('request_signup_access_v1', { p_email: 'ana@example.com', p_note: 'Friday socials' });
  });
  it.each([
    [{ ok: false, reason: 'rate_limited' }, TRY_LATER_COPY],
    [{ ok: false, reason: 'invalid_email' }, 'Check the email address.'],
    [{ ok: false, reason: 'invalid_note' }, 'Keep the note under 300 characters.'],
  ])('%j shows a short line and keeps the form', async (answer, text) => {
    await submit(answer);
    expect((await screen.findByTestId('request-access-error')).textContent).toBe(text);
    expect(screen.getByTestId('request-access-send')).toBeTruthy();
  });
});

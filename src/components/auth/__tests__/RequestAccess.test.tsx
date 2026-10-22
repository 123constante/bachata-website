// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { cleanup, fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => h.rpc(...a) } }));

import { RequestAccess } from '../RequestAccess';
import { TRY_LATER_COPY } from '@/modules/admin-organisers/inviteModel';

afterEach(() => { cleanup(); h.rpc.mockReset(); });

// 3c's way out is a link to the home page, so the screen lives inside a router.
const render = (ui: ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

const submit = async (answer: unknown) => {
  h.rpc.mockResolvedValue({ data: answer, error: null });
  render(<RequestAccess initialEmail="ana@example.com" />);
  fireEvent.click(screen.getByTestId('request-access-open'));
  fireEvent.change(screen.getByLabelText('What events do you run?'), { target: { value: 'Friday socials' } });
  fireEvent.click(screen.getByTestId('request-access-send'));
};

describe('RequestAccess (invite-only wall, flow 3)', () => {
  it('opens as its own screen and Back returns to the wall button', () => {
    render(<RequestAccess />);
    expect(screen.queryByTestId('request-access-screen')).toBeNull();
    fireEvent.click(screen.getByTestId('request-access-open'));
    expect(screen.getByTestId('request-access-screen')).toBeTruthy();
    fireEvent.click(screen.getByTestId('request-access-back'));
    expect(screen.queryByTestId('request-access-screen')).toBeNull();
    expect(screen.getByTestId('request-access-open')).toBeTruthy();
  });
  it('sends email + note and confirms without promising a time', async () => {
    await submit({ ok: true });
    expect((await screen.findByTestId('request-access-done')).textContent).toBe('We will email you when you are in.');
    expect(h.rpc).toHaveBeenCalledWith('request_signup_access_v1', { p_email: 'ana@example.com', p_note: 'Friday socials' });
    // Mockup 3c: its own title and the way back home.
    expect(screen.getByTestId('request-access-title').textContent).toBe('Request sent');
    expect(screen.getByTestId('request-access-home').textContent).toBe('Back to Bachata Calendar');
    expect(screen.getByTestId('request-access-home').getAttribute('href')).toBe('/');
  });
  it('mockup 3b: title, line and the Request access button', () => {
    render(<RequestAccess initialEmail="ana@example.com" />);
    fireEvent.click(screen.getByTestId('request-access-open'));
    expect(screen.getByTestId('request-access-title').textContent).toBe('Sign-up is invite-only for now');
    expect(screen.getByTestId('request-access-line').textContent).toBe('Tell us about your events and we will get back to you.');
    expect(screen.getByTestId('request-access-send').textContent).toBe('Request access');
    expect(screen.queryByTestId('request-access-why')).toBeNull();
  });
  it('F9: with no email the button is disabled AND says why; typing one enables it', () => {
    render(<RequestAccess />);
    fireEvent.click(screen.getByTestId('request-access-open'));
    const send = screen.getByTestId('request-access-send') as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    const why = screen.getByTestId('request-access-why');
    expect(why.textContent).toBe('Add your email to send the request.');
    expect(send.getAttribute('aria-describedby')).toBe(why.id);
    fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'ana@example.com' } });
    expect(send.disabled).toBe(false);
    expect(screen.queryByTestId('request-access-why')).toBeNull();
  });
  it('F9: no raw Unicode punctuation in the source (CLAUDE.md: entities or escapes)', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(__dirname, '..', 'RequestAccess.tsx'), 'utf8');
    expect(src).not.toMatch(/[\u2013\u2014\u2018\u2019\u201c\u201d\u2026]/);
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

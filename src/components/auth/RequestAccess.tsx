import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { accessResultCopy } from '@/modules/admin-organisers/inviteModel';
import { requestSignupAccess } from '@/modules/admin-organisers/inviteRedeemApi';

export const ACCESS_NOTE_MAX = 300;
/** Approved mockup wording (invite-flows-mockups.html 3b / 3c). */
export const ACCESS_FORM_TITLE = 'Sign-up is invite-only for now';
export const ACCESS_FORM_LINE = 'Tell us about your events and we will get back to you.';
export const ACCESS_SENT_TITLE = 'Request sent';

/**
 * Flow 3b/3c: the invite-only wall's way forward. The button opens its own full screen (mockup 3b). Email + a line about their events goes to
 * request_signup_access_v1; the answer never says whether the email is already listed.
 */
export function RequestAccess({ initialEmail = '' }: { initialEmail?: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const emailId = useId();
  const noteId = useId();

  if (!open) {
    return (
      <Button type="button" variant="secondary" className="w-full min-h-[44px] rounded-full" onClick={() => setOpen(true)} data-testid="request-access-open">
        Request access
      </Button>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const { data, error } = await requestSignupAccess(email.trim(), note.trim());
      setResult(accessResultCopy(data, error));
    } catch {
      setResult(accessResultCopy(null, new Error('network')));
    } finally {
      setBusy(false);
    }
  };

  // Portal: the wall sits inside an animated (transformed) card, which would trap a fixed overlay.
  // Mockup 3b (the form) and 3c (sent): the title and the way out differ, the frame is shared.
  const screen = (title: string, body: React.ReactNode, back: React.ReactNode) => createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-background px-4 pt-8 pb-8" data-testid="request-access-screen">
      <div className="mx-auto w-full max-w-md space-y-3">
        <h1 className="text-lg font-semibold" data-testid="request-access-title">{title}</h1>
        {body}
        {back}
      </div>
    </div>,
    document.body,
  );

  if (result?.ok) {
    return screen(
      ACCESS_SENT_TITLE,
      <p className="text-sm text-muted-foreground" role="status" data-testid="request-access-done">{result.text}</p>,
      <Link to="/" className="inline-flex w-full min-h-[44px] items-center justify-center rounded-full border border-border px-4 text-sm font-medium" data-testid="request-access-home">
        Back to Bachata Calendar
      </Link>,
    );
  }

  const noEmail = email.trim() === '';
  return screen(
    ACCESS_FORM_TITLE,
    <form onSubmit={(e) => void submit(e)} className="space-y-2 text-left" data-testid="request-access-form">
      <p className="text-sm text-muted-foreground" data-testid="request-access-line">{ACCESS_FORM_LINE}</p>
      <Label htmlFor={emailId} className="text-sm">Your email</Label>
      <Input id={emailId} type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-[44px] text-[16px]" />
      <Label htmlFor={noteId} className="text-sm">What events do you run?</Label>
      <textarea
        id={noteId}
        value={note}
        maxLength={ACCESS_NOTE_MAX}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-[16px]"
      />
      <Button type="submit" className="w-full min-h-[44px] rounded-full" disabled={busy || noEmail} aria-describedby={noEmail ? `${emailId}-why` : undefined} data-testid="request-access-send">
        {busy ? 'Sending\u2026' : 'Request access'}
      </Button>
      {/* A control that cannot work says why. */}
      {noEmail && !busy && <p id={`${emailId}-why`} className="text-sm text-muted-foreground" data-testid="request-access-why">Add your email to send the request.</p>}
      {result && !result.ok && <p className="text-sm text-destructive" role="alert" data-testid="request-access-error">{result.text}</p>}
    </form>,
    <Button type="button" variant="ghost" className="w-full min-h-[44px]" onClick={() => setOpen(false)} data-testid="request-access-back">
      Back
    </Button>,
  );
}

import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { accessResultCopy } from '@/modules/admin-organisers/inviteModel';
import { requestSignupAccess } from '@/modules/admin-organisers/inviteRedeemApi';

export const ACCESS_NOTE_MAX = 300;

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
  const screen = (body: React.ReactNode) => createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-background px-4 pt-8 pb-8" data-testid="request-access-screen">
      <div className="mx-auto w-full max-w-md space-y-3">
        <h1 className="text-lg font-semibold">Request access</h1>
        {body}
        <Button type="button" variant="ghost" className="w-full min-h-[44px]" onClick={() => setOpen(false)} data-testid="request-access-back">
          Back
        </Button>
      </div>
    </div>,
    document.body,
  );

  if (result?.ok) {
    return screen(<p className="text-sm font-medium" role="status" data-testid="request-access-done">{result.text}</p>);
  }

  return screen(
    <form onSubmit={(e) => void submit(e)} className="space-y-2 text-left" data-testid="request-access-form">
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
      <Button type="submit" className="w-full min-h-[44px] rounded-full" disabled={busy || email.trim() === ''} data-testid="request-access-send">
        {busy ? 'Sending…' : 'Send request'}
      </Button>
      {result && !result.ok && <p className="text-sm text-destructive" role="alert" data-testid="request-access-error">{result.text}</p>}
    </form>,
  );
}

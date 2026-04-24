// =============================================================================
// RaffleEntryDialog — public raffle entry form.
// Bottom-sheet-style modal (mobile-first via shadcn/radix Dialog).
// Calls public.submit_raffle_entry via the anon Supabase client.
//
// Handles all 9 structured reason codes documented on the RPC.
// On success: confetti, vibrate, modal auto-closes after 2s, parent is told.
// =============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { triggerMicroConfetti } from '@/lib/confetti';
import { getRaffleSessionId } from '@/lib/raffleSession';
import { RafflePhoneInput, isValidE164 } from './RafflePhoneInput';
import { Sparkles } from 'lucide-react';

interface RaffleEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  consentVersion: string | null;
  onSubmitted: () => void;
}

type SubmitResponse =
  | { ok: true; entry_id: string }
  | { ok: false; reason: string };

// Map structured backend reason codes to user-facing strings.
function messageForReason(reason: string): { text: string; toast: 'error' | 'success' } {
  switch (reason) {
    case 'name_required':
      return { text: 'Please enter your first name', toast: 'error' };
    case 'name_too_long':
      return { text: 'Name is too long (max 80 characters)', toast: 'error' };
    case 'phone_invalid':
      return { text: 'Please enter a valid phone number with country code', toast: 'error' };
    case 'consent_required':
      return { text: 'You must agree to the privacy terms', toast: 'error' };
    case 'event_not_found':
      return { text: 'Sorry, this event is no longer available', toast: 'error' };
    case 'raffle_not_enabled':
      return { text: 'Raffle is not active for this event', toast: 'error' };
    case 'cutoff_passed':
      return { text: 'Entries have closed for this raffle', toast: 'error' };
    case 'already_entered':
      return { text: "You've already entered this raffle 🎉", toast: 'success' };
    case 'already_won_this_event':
      return { text: "You've already won this raffle! Come back next week 🎉", toast: 'success' };
    default:
      return { text: 'Could not submit entry. Please try again.', toast: 'error' };
  }
}

function tryVibrate(pattern: number[] | number) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch { /* no-op */ }
}

export const RaffleEntryDialog: React.FC<RaffleEntryDialogProps> = ({
  open,
  onOpenChange,
  eventId,
  consentVersion,
  onSubmitted,
}) => {
  const [firstName, setFirstName] = useState('');
  const [phoneE164, setPhoneE164] = useState('');
  const [phoneValid, setPhoneValid] = useState(false);
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [ackState, setAckState] = useState<{ title: string; body: string; emoji: string } | null>(null);

  // Reset form on close so reopens start clean. Keep the sessionId (it's a
  // persistent dedup token), don't rotate it here.
  useEffect(() => {
    if (!open) {
      const t = window.setTimeout(() => {
        setFirstName('');
        setPhoneE164('');
        setPhoneValid(false);
        setConsent(false);
        setHoneypot('');
        setSubmitting(false);
        setSucceeded(false);
        setAckState(null);
      }, 200);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const canSubmit = useMemo(
    () =>
      !submitting &&
      !succeeded &&
      firstName.trim().length > 0 &&
      firstName.trim().length <= 80 &&
      phoneValid &&
      consent,
    [submitting, succeeded, firstName, phoneValid, consent],
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    const sessionId = getRaffleSessionId();

    const { data, error } = await supabase.rpc('submit_raffle_entry', {
      p_event_id: eventId,
      p_first_name: firstName.trim(),
      p_phone_e164: phoneE164,
      p_consent_version: consentVersion ?? 'v1',
      p_honeypot: honeypot || null,
      p_session_id: sessionId,
    });

    if (error) {
      setSubmitting(false);
      toast.error('Network error. Please check your connection and try again.');
      return;
    }

    const payload = data as SubmitResponse;
    if (!payload?.ok) {
      setSubmitting(false);
      const reason = (payload as { reason: string })?.reason ?? '';
      // 'already_entered' and 'already_won_this_event' need user acknowledgement
      // — swap the modal into a centered info state instead of a disappearing
      // toast. Parent is told (onSubmitted) so the chest flips to its
      // "Entered" state once the user dismisses.
      if (reason === 'already_entered') {
        setAckState({
          title: "You're already in!",
          body: "You've entered this raffle already. We'll call you if you win — good luck!",
          emoji: '🎉',
        });
        onSubmitted();
        return;
      }
      if (reason === 'already_won_this_event') {
        setAckState({
          title: "You've already won this one!",
          body: "You’ve already won this raffle. Come back next week for another chance — thanks for dancing with us.",
          emoji: '🏆',
        });
        onSubmitted();
        return;
      }
      // Everything else stays as a plain error toast.
      const { text: errText } = messageForReason(reason);
      toast.error(errText);
      return;
    }

    // Real success — celebrate.
    setSucceeded(true);
    tryVibrate([100, 50, 100]);
    // Aim the confetti at the modal centre — rough but fine on all viewports.
    triggerMicroConfetti(window.innerWidth / 2, window.innerHeight / 2, {
      particleCount: 80,
      spread: 70,
      colors: ['#B38A4E', '#F5D563', '#D8CCB0', '#ffd700', '#ff9500'],
    });
    toast.success("You're in! Good luck 🎉");
    onSubmitted();
    // Auto-close after 2s so the user sees the confirmation state.
    window.setTimeout(() => onOpenChange(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="mx-auto max-w-[430px] p-0 border-[rgba(197,148,10,0.3)] bg-[#1A2E2A] text-[#D8CCB0]">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="flex items-center gap-2 text-[#F5D563]">
            <Sparkles className="w-4 h-4" aria-hidden />
            Enter the raffle
          </DialogTitle>
          <DialogDescription className="text-[#A59474]">
            One entry per person. The winner is drawn after the event.
          </DialogDescription>
        </DialogHeader>

        {ackState ? (
          <div className="px-5 pb-5 pt-4 text-center space-y-3">
            <div className="text-4xl" aria-hidden>{ackState.emoji}</div>
            <div className="text-lg font-semibold text-[#F5D563]">{ackState.title}</div>
            <div className="text-sm text-[#D8CCB0] leading-relaxed max-w-sm mx-auto">{ackState.body}</div>
            <div className="pt-2">
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="bg-[#B38A4E] hover:bg-[#c99a54] text-[#1A2E2A] font-semibold min-w-[120px]"
              >
                Got it
              </Button>
            </div>
          </div>
        ) : succeeded ? (
          <div className="px-4 pb-5 pt-2 text-center">
            <div className="text-2xl mb-1" aria-hidden>🎉</div>
            <div className="text-base font-semibold text-[#F5D563]">You're entered!</div>
            <div className="text-xs text-[#A59474] mt-1">We'll call the winner by phone after the draw.</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-4 pb-4 pt-2 space-y-3">
            {/* Honeypot — CSS-hidden off-screen, not display:none (bots fill display:none correctly). */}
            <div
              aria-hidden
              style={{ position: 'absolute', left: '-9999px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }}
            >
              <label htmlFor="raffle-website-url">Website</label>
              <input
                id="raffle-website-url"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="raffle-first-name" className="block text-xs mb-1 text-[#D8CCB0]">
                First name <span className="text-rose-400">*</span>
              </label>
              <Input
                id="raffle-first-name"
                type="text"
                autoComplete="given-name"
                maxLength={80}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={submitting}
                className="bg-black/25 border border-[rgba(197,148,10,0.3)] text-white placeholder:text-[#6f6757] focus-visible:border-[rgba(245,213,99,0.55)] focus-visible:ring-[rgba(245,213,99,0.25)]"
                placeholder="Maria"
                required
              />
            </div>

            <div>
              <label htmlFor="raffle-phone" className="block text-xs mb-1 text-[#D8CCB0]">
                Phone <span className="text-rose-400">*</span>
                <span className="text-[#A59474] ml-1">(we'll call the winner)</span>
              </label>
              <RafflePhoneInput
                inputId="raffle-phone"
                value={phoneE164}
                onChange={(e164, valid) => { setPhoneE164(e164); setPhoneValid(valid); }}
                disabled={submitting}
              />
            </div>

            <label className="flex items-start gap-2 text-[11px] leading-snug text-[#D8CCB0] select-none cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                disabled={submitting}
                className="mt-0.5 accent-[#B38A4E]"
                required
              />
              <span>
                I agree my first name and phone number will be stored for raffle entry.{' '}
                <a href="/privacy" target="_blank" rel="noreferrer" className="underline text-[#F5D563] hover:text-[#ffd700]">See privacy policy</a>.
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="text-[#A59474] hover:text-[#D8CCB0]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="bg-[#B38A4E] hover:bg-[#c99a54] text-[#1A2E2A] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Entering…' : 'Enter raffle'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

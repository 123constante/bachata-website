// =============================================================================
// RaffleEntryDialog — public raffle entry form.
// Bottom-sheet-style modal (mobile-first via shadcn/radix Dialog).
// Calls public.submit_raffle_entry via the anon Supabase client.
//
// 2026-06-12 — WhatsApp verification. Winners are contacted ONLY on WhatsApp,
// so after a successful entry we send a WhatsApp confirmation (the
// raffle-send-confirmation edge fn) and poll while Meta's delivery webhook
// settles:
//   verified → "You're in — check WhatsApp!" (confetti)
//   failed   → back to the form with a recoverable "no WhatsApp on that
//              number" banner; the entry is NOT marked entered, the user
//              corrects the number and resubmits
//   skipped/timeout/infra-dark → neutral success (legacy behaviour) — the
//              raffle never breaks because WhatsApp is down
//
// onSubmitted() (which sets the per-event "entered" sessionStorage flag in the
// parent tiles) fires ONLY on ack/verified/neutral — never on a failed
// verification, so the lever stays available for the retry.
// =============================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { triggerMicroConfetti } from '@/lib/confetti';
import { getRaffleSessionId } from '@/lib/raffleSession';
import { sendWaConfirmation, pollWaVerifyStatus } from '@/lib/raffleWaVerify';
import { RafflePhoneInput } from './RafflePhoneInput';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
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

type Phase =
  | 'form'              // input form (also re-entered after a WhatsApp failure)
  | 'submitting'        // submit_raffle_entry in flight
  | 'confirming'        // entry created; sending WhatsApp confirmation + polling
  | 'success_verified'  // webhook confirmed delivery — number has WhatsApp
  | 'success_neutral'   // skipped / timeout / infra dark — entered, unconfirmed
  | 'ack';              // already_entered / already_won info state

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
    case 'rate_limited':
      return { text: 'Too many entries from this device — try again in a few minutes.', toast: 'error' };
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
  const [phoneE164, setPhoneE164] = useState('');
  const [phoneValid, setPhoneValid] = useState(false);
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [waFailed, setWaFailed] = useState(false);
  const [neutralVariant, setNeutralVariant] = useState<'sent_unconfirmed' | 'no_claim'>('no_claim');
  const [ackState, setAckState] = useState<{ title: string; body: string; emoji: string } | null>(null);

  // Invalidates in-flight confirmation work when the dialog closes/reopens —
  // a stale poll must never flip state under a new attempt.
  const generationRef = useRef(0);
  const phaseRef = useRef<Phase>('form');
  phaseRef.current = phase;

  // Reset form on close so reopens start clean. Keep the sessionId (it's a
  // persistent dedup token), don't rotate it here.
  useEffect(() => {
    if (!open) {
      generationRef.current += 1;
      const t = window.setTimeout(() => {
        setPhoneE164('');
        setPhoneValid(false);
        setConsent(false);
        setHoneypot('');
        setPhase('form');
        setWaFailed(false);
        setNeutralVariant('no_claim');
        setAckState(null);
      }, 200);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const canSubmit = useMemo(
    () => phase === 'form' && phoneValid && consent,
    [phase, phoneValid, consent],
  );

  const celebrate = (kind: 'verified' | 'neutral') => {
    tryVibrate([100, 50, 100]);
    triggerMicroConfetti(window.innerWidth / 2, window.innerHeight / 2, {
      particleCount: 80,
      spread: 70,
      colors: ['#B38A4E', '#F5D563', '#D8CCB0', '#ffd700', '#ff9500'],
    });
    toast.success(kind === 'verified' ? "You're in — check WhatsApp! 🎉" : "You're in! Good luck 🎉");
    onSubmitted();
    window.setTimeout(() => onOpenChange(false), 2500);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;

    setPhase('submitting');
    setWaFailed(false);
    const sessionId = getRaffleSessionId();
    const generation = generationRef.current;

    const { data, error } = await supabase.rpc('submit_raffle_entry', {
      p_event_id: eventId,
      p_first_name: '—',
      p_phone_e164: phoneE164,
      p_consent_version: consentVersion ?? 'v1',
      p_honeypot: honeypot || null,
      p_session_id: sessionId,
    });
    if (generation !== generationRef.current) return; // dialog closed mid-flight

    if (error) {
      setPhase('form');
      toast.error('Network error. Please check your connection and try again.');
      return;
    }

    const payload = data as SubmitResponse;
    if (!payload?.ok) {
      const reason = (payload as { reason: string })?.reason ?? '';
      // 'already_entered' and 'already_won_this_event' need user acknowledgement
      // — swap the modal into a centered info state instead of a disappearing
      // toast. Parent is told (onSubmitted) so the chest flips to its
      // "Entered" state once the user dismisses.
      if (reason === 'already_entered') {
        setPhase('ack');
        setAckState({
          title: "You're already in!",
          body: "You've entered this raffle already. We'll message you on WhatsApp if you win — good luck!",
          emoji: '🎉',
        });
        onSubmitted();
        return;
      }
      if (reason === 'already_won_this_event') {
        setPhase('ack');
        setAckState({
          title: "You've already won this one!",
          body: "You’ve already won this raffle. Come back next week for another chance — thanks for dancing with us.",
          emoji: '🏆',
        });
        onSubmitted();
        return;
      }
      // Everything else stays as a plain error toast.
      setPhase('form');
      const { text: errText } = messageForReason(reason);
      toast.error(errText);
      return;
    }

    // Entry created — now send the WhatsApp confirmation and wait for the
    // verdict. onSubmitted() is deliberately NOT called yet: a failed
    // verification must leave the lever available for a corrected retry.
    setPhase('confirming');
    const sendOutcome = await sendWaConfirmation(payload.entry_id, sessionId);
    if (generation !== generationRef.current) return;

    if (sendOutcome === 'failed') {
      setPhase('form');
      setWaFailed(true);
      return;
    }
    if (sendOutcome !== 'sent') {
      // skipped / unavailable — infra dark, legacy neutral success.
      setNeutralVariant('no_claim');
      setPhase('success_neutral');
      celebrate('neutral');
      return;
    }

    const verdict = await pollWaVerifyStatus(payload.entry_id, sessionId);
    if (generation !== generationRef.current) return;

    if (verdict === 'verified') {
      setPhase('success_verified');
      celebrate('verified');
    } else if (verdict === 'failed') {
      setPhase('form');
      setWaFailed(true);
    } else {
      // timeout / skipped / unavailable — confirmation dispatched, receipt slow.
      setNeutralVariant('sent_unconfirmed');
      setPhase('success_neutral');
      celebrate('neutral');
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (phase === 'submitting') return; // entry creation in flight — hold on
    if (!v && phase === 'confirming') {
      // Closing while we wait on the webhook: optimistically count them in —
      // never trap the user in a modal. (A later failed verdict still excludes
      // the entry from draws server-side.)
      onSubmitted();
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="mx-auto max-w-[430px] p-0 border-[rgba(197,148,10,0.3)] bg-[#1A2E2A] text-[#D8CCB0]">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="flex items-center gap-2 text-[#F5D563]">
            <Sparkles className="w-4 h-4" aria-hidden />
            Enter the raffle
          </DialogTitle>
          <DialogDescription className="text-[#A59474]">
            One entry per person. The winner is messaged on WhatsApp after the draw.
          </DialogDescription>
        </DialogHeader>

        {phase === 'ack' && ackState ? (
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
        ) : phase === 'confirming' ? (
          <div className="px-4 pb-6 pt-3 text-center space-y-2">
            <WhatsAppIcon className="w-8 h-8 mx-auto text-[#25D366] motion-safe:animate-pulse" />
            <div className="text-base font-semibold text-[#F5D563]">Sending your WhatsApp confirmation…</div>
            <div className="text-xs text-[#A59474]">Usually takes a few seconds.</div>
          </div>
        ) : phase === 'success_verified' ? (
          <div className="px-4 pb-5 pt-2 text-center">
            <div className="text-2xl mb-1" aria-hidden>🎉</div>
            <div className="text-base font-semibold text-[#F5D563]">You're in — check WhatsApp!</div>
            <div className="text-xs text-[#A59474] mt-1">
              We've sent your entry confirmation. Winners are messaged on WhatsApp after the draw.
            </div>
          </div>
        ) : phase === 'success_neutral' ? (
          <div className="px-4 pb-5 pt-2 text-center">
            <div className="text-2xl mb-1" aria-hidden>🎉</div>
            <div className="text-base font-semibold text-[#F5D563]">You're in! Good luck</div>
            <div className="text-xs text-[#A59474] mt-1">
              {neutralVariant === 'sent_unconfirmed'
                ? "We've sent you a WhatsApp confirmation — it may take a minute to arrive."
                : 'Winners are messaged on WhatsApp after the draw.'}
            </div>
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

            {waFailed && (
              <div
                data-testid="raffle-wa-failed"
                className="rounded-md border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-[12px] leading-snug text-rose-200"
              >
                That number doesn't seem to have WhatsApp. Check it and try again —
                winners can only be contacted on WhatsApp.
              </div>
            )}

            <div className="flex items-start gap-2 rounded-md border border-[rgba(197,148,10,0.3)] bg-black/25 px-3 py-2">
              <WhatsAppIcon className="w-4 h-4 text-[#25D366] shrink-0 mt-0.5" />
              <div className="text-[11px] leading-snug text-[#D8CCB0]">
                <span className="font-semibold text-[#F5D563]">Winners are contacted on WhatsApp only.</span>{' '}
                Make sure this number has WhatsApp.
              </div>
            </div>

            <div>
              <label htmlFor="raffle-phone" className="block text-xs mb-1 text-[#D8CCB0]">
                Phone <span className="text-rose-400">*</span>
                <span className="text-[#A59474] ml-1">(must have WhatsApp)</span>
              </label>
              <RafflePhoneInput
                inputId="raffle-phone"
                value={phoneE164}
                onChange={(e164, valid) => { setPhoneE164(e164); setPhoneValid(valid); }}
                disabled={phase !== 'form'}
              />
            </div>

            <label className="flex items-start gap-2 text-[11px] leading-snug text-[#D8CCB0] select-none cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                disabled={phase !== 'form'}
                className="mt-0.5 accent-[#B38A4E]"
                required
              />
              <span>
                I agree my phone number will be stored for raffle entry.{' '}
                <a href="/privacy" target="_blank" rel="noreferrer" className="underline text-[#F5D563] hover:text-[#ffd700]">See privacy policy</a>.
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={phase !== 'form'}
                className="text-[#A59474] hover:text-[#D8CCB0]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="bg-[#B38A4E] hover:bg-[#c99a54] text-[#1A2E2A] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {phase === 'submitting' ? 'Entering…' : waFailed ? 'Try again' : 'Enter raffle'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

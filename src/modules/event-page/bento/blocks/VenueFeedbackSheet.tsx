import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const MAX = 2000;
const LINK_CLASS = 'inline-flex min-h-[44px] items-center text-left text-[12px] underline';

/**
 * "Something wrong?" control, rendered OUTSIDE the tile link. Signed out: a short
 * sign-in prompt (no text box, so nothing typed can be lost). Signed in: the sheet.
 * Typed text is never cleared on failure.
 */
export const VenueFeedbackSheet = ({ venueId }: { venueId: string }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(false);
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error' | 'signin'>('idle');

  const goSignIn = () =>
    navigate(`/auth?mode=signin&returnTo=${encodeURIComponent(`${loc.pathname}${loc.search}`)}`);

  const send = async () => {
    const body = text.trim();
    if (!body || state === 'sending') return;
    setState('sending');
    try {
      const { error } = await supabase.rpc('submit_feedback_v1', {
        p_body: body,
        p_kind: 'venue',
        p_page: `venue:${venueId}`,
      });
      if (error) throw error;
      setText('');
      setState('sent');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String((e as { message?: unknown } | null)?.message ?? '');
      setState(msg.includes('not_signed_in') ? 'signin' : 'error');
    }
  };

  const muted = { color: 'hsl(var(--bento-fg-muted))' } as const;

  if (!user) {
    return (
      <div className="px-2.5">
        {prompt ? (
          <p className="flex flex-wrap items-center gap-x-2 text-[12px]" style={muted}>
            <span>Sign in to tell us what is wrong</span>
            <button type="button" className={LINK_CLASS} onClick={goSignIn}>
              Sign in
            </button>
          </p>
        ) : (
          <button type="button" className={LINK_CLASS} style={muted} onClick={() => setPrompt(true)}>
            Something wrong?
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="px-2.5">
      <button
        type="button"
        className={LINK_CLASS}
        style={muted}
        onClick={() => {
          setState('idle');
          setOpen(true);
        }}
      >
        Something wrong?
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm p-3">
          <DialogHeader>
            <DialogTitle className="text-sm">Something wrong with this venue?</DialogTitle>
          </DialogHeader>
          {state === 'sent' ? (
            <p className="text-sm">Thanks &mdash; we will take a look.</p>
          ) : (
            <>
              <textarea
                className="min-h-[96px] w-full rounded-md border border-white/20 bg-transparent p-2 text-sm"
                maxLength={MAX}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Wrong address, floor, parking&hellip; tell us what to fix"
                aria-label="What is wrong?"
              />
              {state === 'error' && <p className="text-sm text-red-400">Could not send. Try again later.</p>}
              {state === 'signin' && (
                <p className="text-sm text-red-400">
                  Sign in to tell us what is wrong.{' '}
                  <button type="button" className="min-h-[44px] underline" onClick={goSignIn}>
                    Sign in
                  </button>
                </p>
              )}
              <button
                type="button"
                className="min-h-[44px] rounded-md bg-white/10 px-3 text-sm font-semibold disabled:opacity-50"
                disabled={!text.trim() || state === 'sending'}
                onClick={send}
              >
                {state === 'sending' ? 'Sending\u2026' : 'Send'}
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

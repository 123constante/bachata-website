import { useState } from 'react';
import { rpcLoose } from '@/integrations/supabase/rpcLoose';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const MAX = 2000;

/** "Something wrong?" link + small sheet. Typed text is never cleared on failure. */
export const VenueFeedbackSheet = ({ venueId }: { venueId: string }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const send = async () => {
    const body = text.trim();
    if (!body || state === 'sending') return;
    setState('sending');
    try {
      const { error } = await rpcLoose('submit_feedback_v1', {
        p_body: body,
        p_kind: 'venue',
        p_page: `venue:${venueId}`,
      });
      if (error) throw error;
      setText('');
      setState('sent');
    } catch {
      setState('error');
    }
  };

  return (
    <span onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="mt-1 min-h-[44px] self-start text-left text-[11px] underline"
        style={{ color: 'hsl(var(--bento-fg-muted))' }}
        onClick={(e) => {
          e.preventDefault();
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
              <button
                type="button"
                className="min-h-[44px] rounded-md bg-white/10 px-3 text-sm font-semibold disabled:opacity-50"
                disabled={!text.trim() || state === 'sending'}
                onClick={send}
              >
                {state === 'sending' ? 'Sending…' : 'Send'}
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </span>
  );
};

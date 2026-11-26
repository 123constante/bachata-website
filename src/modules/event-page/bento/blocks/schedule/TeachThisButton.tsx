import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { flags } from '@/lib/featureFlags';
import { useAuth } from '@/hooks/useAuth';
import {
  codeOf, myTeachRequests, myTeachRequestsKey, requestTeach, withdrawTeach,
} from '@/modules/class-teach/teachRequestsApi';

type Phase = 'idle' | 'busy' | 'pending' | 'hidden' | 'no_profile' | 'error';

const LINE = 'text-[13px] leading-snug';
const MUTED = { color: 'hsl(var(--bento-fg) / 0.7)' } as const;

/** "I'm teaching this": a signed-in teacher asks to be put on ONE class of ONE night. Only a request. */
export const TeachThisButton = ({ session, occurrenceId, occurrenceCancelled }: {
  session: { id: string; type: string; addedOnly?: boolean };
  occurrenceId?: string | null;
  occurrenceCancelled?: boolean;
}) => {
  const { user } = useAuth();
  const show = flags.teachRequests && Boolean(occurrenceId) && Boolean(user)
    && (session.type === 'class' || session.type === 'workshop') && !occurrenceCancelled;
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: myTeachRequestsKey(occurrenceId ?? ''),
    queryFn: () => myTeachRequests(occurrenceId as string),
    enabled: show,
    staleTime: 60_000,
  });
  const [phase, setPhase] = useState<Phase>('idle');
  const [requestId, setRequestId] = useState<string | null>(null);

  if (!show || !occurrenceId) return null;
  const mine = (q.data ?? []).find((r) => (session.addedOnly ? r.added_session_id === session.id : r.program_item_id === session.id));
  if (mine?.status === 'declined' || phase === 'hidden') return null;
  if (q.isLoading) return null;

  const send = async () => {
    if (phase === 'busy') return;
    setPhase('busy');
    try {
      const r = await requestTeach({
        occurrenceId,
        itemId: session.addedOnly ? null : session.id,
        addedId: session.addedOnly ? session.id : null,
      });
      if (r.status === 'pending') { setRequestId(r.request_id); setPhase('pending'); } else setPhase('hidden');
    } catch (e) {
      setPhase(codeOf(e) === 'no_teacher_profile' ? 'no_profile' : 'error');
    }
  };
  const undo = async () => {
    const id = requestId ?? mine?.request_id;
    if (!id || phase === 'busy') return;
    setPhase('busy');
    try {
      await withdrawTeach(id);
      setRequestId(null);
      await qc.invalidateQueries({ queryKey: myTeachRequestsKey(occurrenceId) });
      setPhase('idle');
    } catch { setPhase('pending'); }
  };

  const showPending = phase === 'pending' || (mine?.status === 'pending' && phase === 'idle');
  if (showPending) {
    return (
      <div className={LINE} style={{ marginTop: '8px', ...MUTED }} data-testid={`teach-pending-${session.id}`}>
        Request sent. The organiser will confirm.{' '}
        <button type="button" onClick={undo} className="underline" style={{ minHeight: '44px' }}>Undo</button>
      </div>
    );
  }
  if (phase === 'no_profile') {
    return (
      <div className={LINE} style={{ marginTop: '8px', ...MUTED }}>
        Add teaching to your profile first.{' '}
        <Link to="/app/me" className="underline">Add teaching</Link>
      </div>
    );
  }
  return (
    <div style={{ marginTop: '8px', textAlign: 'left' }}>
      <button
        type="button"
        onClick={send}
        disabled={phase === 'busy'}
        className="rounded-md border px-3 text-[13px] font-medium disabled:opacity-60"
        style={{ minHeight: '44px', borderColor: 'hsl(var(--bento-fg) / 0.3)' }}
      >
        I&rsquo;m teaching this
      </button>
      {phase === 'error' && <div className={LINE} style={MUTED}>Couldn&rsquo;t send. Try again.</div>}
    </div>
  );
};

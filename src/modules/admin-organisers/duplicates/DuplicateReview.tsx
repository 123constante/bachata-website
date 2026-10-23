import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DUPLICATES_KEY, dismissPair, joinPeople, previewJoin } from './duplicatesApi';
import { DUP_COPY, joinRefusalText, pairSentence } from './duplicatesCopy';
import type { DuplicatePair } from './duplicatesModel';

const BTN = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50';
const BTN_PRIMARY = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50';

/** same -> changes (dry run) -> confirm (second tap) -> joined. Only `confirm`'s Yes sends the real run. */
export type ReviewStep = 'same' | 'changes' | 'confirm' | 'joined';

const refusedCode = (out: { ok: boolean; code?: string } | undefined): string | null => (out && !out.ok ? out.code ?? 'error' : null);

function Card({ tag, name, fact, keep }: { tag: string; name: string; fact: string; keep: boolean }) {
  return (
    <div className={`min-w-0 space-y-1 rounded-lg border p-3 ${keep ? 'border-emerald-500/60' : 'border-border'}`} data-testid={keep ? 'dup-keep' : 'dup-fold'}>
      <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${keep ? 'bg-emerald-500/15 text-emerald-300' : 'bg-muted text-muted-foreground'}`}>{tag}</span>
      <p className="break-words text-sm font-semibold">{name}</p>
      <p className="text-xs text-muted-foreground">{fact}</p>
    </div>
  );
}

/** "Same person?" -> "What will change" -> second confirm -> "Joined", for one pair. */
export function DuplicateReview({ pair, onClose }: { pair: DuplicatePair; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<ReviewStep>('same');
  const heading = useRef<HTMLHeadingElement>(null);
  // Focus moves to the new step's heading (PLAN.md section 3).
  useEffect(() => { heading.current?.focus(); }, [step]);

  const preview = useQuery({
    queryKey: ['admin-duplicate-preview', pair.keepId, pair.foldId],
    queryFn: () => previewJoin(pair),
    enabled: step === 'changes' || step === 'confirm',
    staleTime: 0,
    retry: false,
  });
  const join = useMutation({
    mutationFn: () => joinPeople(pair),
    onSuccess: (out) => {
      if (out.ok) {
        setStep('joined');
        void queryClient.invalidateQueries({ queryKey: DUPLICATES_KEY });
        // The folded profile is gone: no cached team list or search may still offer it for an invite.
        void queryClient.invalidateQueries({ queryKey: ['admin-invite-page-team'] });
        void queryClient.invalidateQueries({ queryKey: ['admin-invite-person-search'] });
      }
    },
  });
  const dismiss = useMutation({
    mutationFn: () => dismissPair(pair),
    onSuccess: (out) => {
      if (out.ok) {
        void queryClient.invalidateQueries({ queryKey: DUPLICATES_KEY });
        onClose();
      }
    },
  });
  const dismissRefusal = refusedCode(dismiss.data) ?? (dismiss.isError ? 'error' : null);
  const joinRefusal = refusedCode(join.data) ?? (join.isError ? 'error' : null);

  const dry = preview.data;
  const changes = dry?.kind === 'changes' ? dry.changes : null;
  const dryRefusal = dry?.kind === 'refused' ? dry.code : preview.isError ? 'error' : null;
  const joinBlocked = !changes ? DUP_COPY.changesLoading : changes.length === 0 ? DUP_COPY.changesEmpty : null;

  if (step === 'joined') {
    return (
      <div className="space-y-2" data-testid="dup-joined">
        <h3 ref={heading} tabIndex={-1} className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm font-medium outline-none">{DUP_COPY.joined(pair)}</h3>
        <button type="button" className={BTN} onClick={onClose} data-testid="dup-close">{DUP_COPY.close}</button>
      </div>
    );
  }

  if (step === 'same') {
    return (
      <div className="space-y-3" data-testid="dup-same">
        <h3 ref={heading} tabIndex={-1} className="text-base font-semibold outline-none">{DUP_COPY.sameTitle}</h3>
        <p className="text-sm text-muted-foreground">{pairSentence(pair)}</p>
        <div className="grid grid-cols-2 gap-2">
          <Card tag={DUP_COPY.keep} name={pair.keepName} fact={DUP_COPY.keepFact} keep />
          <Card tag={DUP_COPY.fold} name={pair.foldName} fact={DUP_COPY.foldFact} keep={false} />
        </div>
        <p className="text-sm text-muted-foreground">{DUP_COPY.sameLead(pair)}</p>
        <button type="button" className={`${BTN_PRIMARY} w-full`} onClick={() => setStep('changes')} data-testid="dup-show-changes">{DUP_COPY.showChanges}</button>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={BTN} disabled={dismiss.isPending} onClick={() => dismiss.mutate()} aria-describedby="dup-not-same-note" data-testid="dup-not-same">{dismiss.isPending ? DUP_COPY.dismissing : DUP_COPY.notSame}</button>
          <button type="button" className={BTN} onClick={onClose} data-testid="dup-back">{DUP_COPY.back}</button>
        </div>
        <p id="dup-not-same-note" className="text-xs text-muted-foreground">{DUP_COPY.notSameNote}</p>
        <div aria-live="polite">{dismissRefusal && <p role="alert" className="text-sm text-destructive" data-testid="dup-dismiss-error">{joinRefusalText(dismissRefusal)}</p>}</div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="dup-changes">
      <h3 ref={heading} tabIndex={-1} className="text-base font-semibold outline-none">{DUP_COPY.changesTitle}</h3>
      <div aria-live="polite" className="space-y-2">
        {preview.isPending && <p className="text-sm text-muted-foreground" data-testid="dup-changes-loading">{DUP_COPY.changesLoading}</p>}
        {dryRefusal && <p role="alert" className="text-sm text-destructive" data-testid="dup-dry-refused">{joinRefusalText(dryRefusal)}</p>}
        {changes && changes.length > 0 && (
          <ol className="list-decimal space-y-1 pl-5 text-sm" data-testid="dup-change-list">{changes.map((c, i) => <li key={`${c.kind}-${i}`}>{c.text}</li>)}</ol>
        )}
      </div>
      {step === 'confirm' && !dryRefusal ? (
        <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3" data-testid="dup-confirm">
          <p className="text-sm font-semibold">{DUP_COPY.confirmTitle}</p>
          <p className="text-xs text-muted-foreground">{DUP_COPY.confirmNote}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN_PRIMARY} disabled={join.isPending || !!joinBlocked} onClick={() => join.mutate()} data-testid="dup-confirm-yes">{join.isPending ? DUP_COPY.joining : DUP_COPY.confirmYes}</button>
            <button type="button" className={BTN} disabled={join.isPending} onClick={() => { join.reset(); setStep('changes'); }} data-testid="dup-confirm-cancel">{DUP_COPY.cancel}</button>
          </div>
          <div aria-live="polite">{joinRefusal && <p role="alert" className="text-sm text-destructive" data-testid="dup-join-error">{joinRefusalText(joinRefusal)}</p>}</div>
        </div>
      ) : (
        <>
          <button type="button" className={`${BTN_PRIMARY} w-full`} disabled={!!joinBlocked || !!dryRefusal} aria-describedby={joinBlocked && changes ? 'dup-join-blocked' : undefined} onClick={() => setStep('confirm')} data-testid="dup-join">{DUP_COPY.joinOne}</button>
          {changes && changes.length === 0 && <p id="dup-join-blocked" className="text-xs text-muted-foreground" data-testid="dup-join-blocked">{DUP_COPY.changesEmpty}</p>}
          <button type="button" className={BTN} onClick={() => setStep('same')} data-testid="dup-back">{DUP_COPY.back}</button>
        </>
      )}
    </div>
  );
}

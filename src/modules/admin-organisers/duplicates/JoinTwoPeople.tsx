import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DuplicateReview } from './DuplicateReview';
import { JOIN_TWO_COPY as C } from './joinTwoCopy';
import { joinSearchKey, pairFrom, searchJoinCandidates, type JoinCandidate } from './joinSearchApi';

const BTN = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50';
const BTN_PRIMARY = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50';

function PersonFacts({ p }: { p: JoinCandidate }) {
  const facts = [p.hasLogin ? C.hasLogin : C.noLogin, ...(p.archived ? [C.archived] : []), ...(p.roles.length ? [p.roles.join(', ')] : [])];
  return (
    <>
      <span className="block break-words text-sm font-semibold">{p.name ?? C.noName}</span>
      <span className="block text-xs text-muted-foreground">{facts.join(' · ')}</span>
    </>
  );
}

function Slot({ slot, label, chosen, otherId, onChoose }: { slot: 'keep' | 'fold'; label: string; chosen: JoinCandidate | null; otherId: string | null; onChoose: (p: JoinCandidate | null) => void }) {
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const search = useQuery({ queryKey: joinSearchKey(debounced), queryFn: () => searchJoinCandidates(debounced), enabled: !chosen && debounced.length >= 2, retry: false });
  const inputId = `join-${slot}-input`;

  if (chosen) {
    return (
      <div className="min-w-0 space-y-1 rounded-lg border border-border p-3" data-testid={`join-${slot}-chosen`}>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <PersonFacts p={chosen} />
        <button type="button" className={BTN} onClick={() => { setText(''); setDebounced(''); onChoose(null); }} data-testid={`join-${slot}-change`}>{C.change}</button>
      </div>
    );
  }
  const results = search.data ?? [];
  return (
    <div className="min-w-0 space-y-1" data-testid={`join-${slot}-search`}>
      <label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">{label}</label>
      <input id={inputId} type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={C.placeholder} autoComplete="off" className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-base" data-testid={`join-${slot}-input`} />
      <div aria-live="polite" className="space-y-1">
        {debounced.length >= 2 && search.isFetching && <p className="text-xs text-muted-foreground" data-testid={`join-${slot}-loading`}>{C.searching}</p>}
        {search.isError && (
          <div role="alert" className="space-y-1" data-testid={`join-${slot}-error`}>
            <p className="text-sm text-destructive">{C.searchFailed}</p>
            <button type="button" className={BTN} onClick={() => void search.refetch()}>{C.retry}</button>
          </div>
        )}
        {!search.isFetching && !search.isError && debounced.length >= 2 && search.data && results.length === 0 && <p className="text-xs text-muted-foreground" data-testid={`join-${slot}-empty`}>{C.noResults}</p>}
        {results.length > 0 && (
          <ul className="space-y-1">
            {results.map((p) => {
              const taken = p.id === otherId;
              return (
                <li key={p.id}>
                  <button type="button" disabled={taken} onClick={() => onChoose(p)} className={`${BTN} w-full justify-start text-left`} data-testid={`join-${slot}-result`}>
                    <span className="min-w-0"><PersonFacts p={p} />{taken && <span className="block text-xs text-muted-foreground">{C.alreadyOther}</span>}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** "Join two people": pick any two, see the dry run in the existing review panel, join only from its second confirm. */
export function JoinTwoPeople() {
  const [keep, setKeep] = useState<JoinCandidate | null>(null);
  const [fold, setFold] = useState<JoinCandidate | null>(null);
  const [reviewing, setReviewing] = useState<ReturnType<typeof pairFrom>>(null);
  const pair = pairFrom(keep, fold);

  if (reviewing) {
    return (
      <section className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3" data-testid="join-two-review">
        <DuplicateReview key={`${reviewing.keepId}:${reviewing.foldId}`} pair={reviewing} startAt="changes" onClose={() => setReviewing(null)} onJoined={() => { setKeep(null); setFold(null); }} />
      </section>
    );
  }
  const reason = !keep || !fold ? C.needTwo : keep.id === fold.id ? C.needDifferent : null;
  return (
    <section className="space-y-3 rounded-lg border border-border p-3" data-testid="join-two">
      <div>
        <h2 className="text-sm font-semibold">{C.title}</h2>
        <p className="text-xs text-muted-foreground">{C.lead}</p>
      </div>
      <div className="space-y-2">
        <Slot slot="keep" label={C.keepLabel} chosen={keep} otherId={fold?.id ?? null} onChoose={setKeep} />
        <button type="button" className={BTN} disabled={!keep && !fold} onClick={() => { setKeep(fold); setFold(keep); }} data-testid="join-swap">{C.swap}</button>
        <Slot slot="fold" label={C.foldLabel} chosen={fold} otherId={keep?.id ?? null} onChoose={setFold} />
      </div>
      <button type="button" className={`${BTN_PRIMARY} w-full`} disabled={!pair} onClick={() => setReviewing(pair)} aria-describedby={reason ? 'join-two-reason' : undefined} data-testid="join-see">{C.see}</button>
      {reason && <p id="join-two-reason" className="text-xs text-muted-foreground" data-testid="join-reason">{reason}</p>}
    </section>
  );
}

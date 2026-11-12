import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Sheet } from '../../screens/Sheet';
import type { Night } from '../eventsModel';
import { raffleNightsQueryKey, setRaffleNight } from './raffleApi';
import { FINAL_REFUSALS, confirmOf, drawnLine, entriesWord, gate, refusedLine, stepOf, story, type RaffleNight, type RaffleRead } from './raffleModel';
import { MessageUs, Track, rowFor, useRaffleNights } from './RaffleParts';

const TAP = { minHeight: 44, minWidth: 44 } as const;

type Phase = { kind: 'view' } | { kind: 'confirm'; action: 'open' | 'close' } | { kind: 'busy' } | { kind: 'failed'; action: 'open' | 'close'; text: string; again: boolean } | { kind: 'message' };

/** The Raffle sheet of one night (Option B): the 4-step track, the status story, the facts, and the ONE button. */
export function RaffleSheet({ night, onClose }: { night: Night; onClose: () => void }) {
  const q = useRaffleNights(night.seriesId);
  const title = `Raffle, ${night.dayLabel}`;
  if (q.isPending) return <Sheet title={title} onClose={onClose}><p className="p3-note" data-testid="raffle-sheet-loading">Loading the raffle&hellip;</p></Sheet>;
  if (q.isError || q.data.kind === 'refused') {
    return (
      <Sheet title={title} onClose={onClose}>
        <p className="p3-note" role="alert" data-testid="raffle-sheet-error">{q.isError ? 'We couldn’t load the raffle. Nothing was changed, and every raffle stays as it was.' : 'Raffles are managed by this page’s team. Ask an owner.'}</p>
        {q.isError && <button type="button" className="p3-btn p3-btn-line" style={TAP} onClick={() => void q.refetch()} data-testid="raffle-sheet-retry">Try again</button>}
      </Sheet>
    );
  }
  const n = rowFor(q.data.read, night);
  if (!n) return <Sheet title={title} onClose={onClose}><p className="p3-note" data-testid="raffle-sheet-none">This night has no raffle information yet. Nothing has changed.</p></Sheet>;
  return <RaffleBody night={night} n={n} read={q.data.read} title={title} onClose={onClose} />;
}

function RaffleBody({ night, n, read, title, onClose }: { night: Night; n: RaffleNight; read: RaffleRead; title: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>({ kind: 'view' });
  const g = gate(n, read);
  const s = story(n);

  const refresh = () => qc.invalidateQueries({ queryKey: raffleNightsQueryKey(night.seriesId) });
  // Only ever reached from the confirmation sheet's own button: opening or closing a raffle is a hard stop.
  const send = async (action: 'open' | 'close') => {
    setPhase({ kind: 'busy' });
    try {
      const r = await setRaffleNight(n.occurrenceId, action === 'open');
      if (r.kind === 'ok') { await refresh(); setPhase({ kind: 'view' }); return; }
      void refresh();
      setPhase({ kind: 'failed', action, text: refusedLine(r.reason), again: !FINAL_REFUSALS.has(r.reason) });
    } catch {
      setPhase({ kind: 'failed', action, text: 'Nothing changed. We could not reach the server, so the night is as it was.', again: true });
    }
  };

  if (phase.kind === 'confirm' || phase.kind === 'busy') {
    const action = phase.kind === 'confirm' ? phase.action : g.action === 'close' ? 'close' : 'open';
    const c = confirmOf(action, n);
    const busy = phase.kind === 'busy';
    return (
      <Sheet title={c.title} onClose={onClose} locked={busy}>
        <div className="p3-stack-s" data-testid="raffle-confirm">
          {c.body.map((t) => <p key={t} className="p3-note">{t}</p>)}
          <button type="button" className={`p3-btn ${c.danger ? 'p3-btn-danger' : ''}`} style={TAP} disabled={busy} onClick={() => void send(action)} data-testid="raffle-confirm-go">{busy ? <>Working&hellip;</> : c.go}</button>
          <button type="button" className="p3-btn p3-btn-line" style={TAP} disabled={busy} onClick={() => setPhase({ kind: 'view' })} data-testid="raffle-confirm-keep">{c.keep}</button>
        </div>
      </Sheet>
    );
  }

  const step = stepOf(n);
  const close = n.winner ? drawnLine(n.winner.drawnAt) : null;
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="p3-stack-s" data-testid="raffle-sheet" data-chip={n.chip}>
        {step >= 0 && <Track step={step} />}
        <div className="p3-card p3-inset" data-testid="raffle-story">
          <strong className="p3-row-t">{s.title}</strong>
          <p className="p3-note">{s.body}</p>
        </div>
        {n.chip === 'drawn' && (
          <dl className="p3-card p3-inset" data-testid="raffle-facts" style={{ margin: 0 }}>
            <div><dt className="p3-row-s">Entered</dt><dd className="p3-row-t" style={{ margin: 0 }} data-testid="raffle-fact-entered">{n.winner?.entriesAtDraw != null ? entriesWord(n.winner.entriesAtDraw) : n.entries > 0 ? entriesWord(n.entries) : 'Not recorded'}</dd></div>
            <div><dt className="p3-row-s">Winner</dt><dd className="p3-row-t" style={{ margin: 0, overflowWrap: 'anywhere' }} data-testid="raffle-fact-winner">{n.winner?.firstName ?? 'Name not shown'}</dd></div>
            <div><dt className="p3-row-s">Drawn</dt><dd className="p3-row-t" style={{ margin: 0 }} data-testid="raffle-fact-drawn">{close ?? 'Time not recorded'}</dd></div>
          </dl>
        )}
        {!read.canEdit && read.viewOnlyReason && <p className="p3-note p3-card p3-inset" data-testid="raffle-viewonly">View only: {read.viewOnlyReason}.</p>}
        {phase.kind === 'failed' && (
          <p className="p3-error" role="alert" data-testid="raffle-failed">{phase.text}</p>
        )}
        {g.action === 'message' && phase.kind !== 'message'
          ? <button type="button" className="p3-btn" style={TAP} onClick={() => setPhase({ kind: 'message' })} data-testid="raffle-button" data-action="message">{g.label}</button>
          : g.action === 'message'
            ? <MessageUs topic={`Cancel the raffle on ${night.dayLabel}`} />
            : (n.chip === 'open' || n.chip === 'closed') && (
              <>
                <button type="button" className="p3-btn" style={TAP} disabled={!g.enabled} aria-describedby={g.why ? 'raffle-why' : undefined}
                  onClick={() => setPhase({ kind: 'confirm', action: g.action === 'close' ? 'close' : 'open' })} data-testid="raffle-button" data-action={g.action}>
                  {phase.kind === 'failed' && phase.again ? 'Try again' : g.label}
                </button>
                {g.why && <p className="p3-note" id="raffle-why" data-testid="raffle-why">{g.why}</p>}
              </>
            )}
        {g.action === 'none' && g.why && n.chip !== 'drawn' && n.chip !== 'past' && <p className="p3-note" data-testid="raffle-why">{g.why}</p>}
      </div>
    </Sheet>
  );
}

import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLondonToday } from '@/hooks/useLondonToday';
import { GhostButton, PrimaryButton } from '@/modules/organiser/ui';
import { readEventLink } from './smartImportClient';
import {
  BY_HAND_LABEL, CANCEL_LABEL, CHECK_NOTE, LINK_LABEL, PAST_DATE_NOTE, READ_LABEL, SIGN_IN_LABEL, USE_LABEL,
  checkLink, failureView, outcomeOf, readButton, type FailReason, type LinkDraft,
} from './pasteLinkModel';

type View = { kind: 'idle' } | { kind: 'reading' } | { kind: 'draft'; draft: LinkDraft } | { kind: 'failed'; reason: FailReason };

const NOT_FOUND: Record<LinkDraft['missing'][number], string> = {
  title: 'No name found',
  date: 'No date found',
  venue: 'No venue found',
  ticket: 'No ticket link found',
  description: 'No description found',
};

/** What was read, as plain TEXT (never HTML). The same block is reused on the next step. */
export function LinkDraftSummary({ draft }: { draft: LinkDraft }) {
  const row = (label: string, value: string, testId: string) => (
    <div className="flex flex-col" data-testid={testId}>
      <dt className="text-[13px] text-[var(--mut)]">{label}</dt>
      <dd className="break-words text-[15px] text-[var(--fg)]">{value}</dd>
    </div>
  );
  const dateText = draft.dates.length
    ? draft.dates.join(', ')
    : draft.datePassed ? PAST_DATE_NOTE : NOT_FOUND.date;
  return (
    <div className="flex flex-col gap-[8px] rounded-[12px] bg-[var(--card2)] p-[12px]" data-testid="org-paste-draft">
      <p className="text-[14px] font-bold text-[var(--fg)]" data-testid="org-paste-check">{CHECK_NOTE}</p>
      <dl className="flex flex-col gap-[8px]">
        {row('Name', draft.title || NOT_FOUND.title, 'org-paste-title')}
        {row('Date', dateText, 'org-paste-date')}
        {row('Venue or city', draft.venue || NOT_FOUND.venue, 'org-paste-venue')}
        {row('Ticket link', draft.ticketUrl || NOT_FOUND.ticket, 'org-paste-ticket')}
        {row('Description', draft.description || NOT_FOUND.description, 'org-paste-description')}
      </dl>
    </div>
  );
}

/**
 * "Paste a link" at the top of New event. Reading never saves anything: a
 * good read shows a draft to check, and only the existing steps save it.
 */
export function PasteLink({ onUse, onByHand }: { onUse: (draft: LinkDraft) => void; onByHand: () => void }) {
  const today = useLondonToday();
  const [link, setLink] = useState('');
  const [view, setView] = useState<View>({ kind: 'idle' });
  const inFlight = useRef<AbortController | null>(null);
  const noteId = useId();
  const reading = view.kind === 'reading';
  const btn = readButton(link, reading);

  // Leaving the page cancels a read still in flight.
  useEffect(() => () => inFlight.current?.abort(), []);

  const read = async () => {
    // Double-tap: the ref guards the gap before the disabled state renders.
    if (inFlight.current) return;
    const checked = checkLink(link);
    if (!checked.ok) {
      if ('reason' in checked && checked.reason === 'non_https') setView({ kind: 'failed', reason: 'non_https' });
      return;
    }
    const controller = new AbortController();
    inFlight.current = controller;
    setView({ kind: 'reading' });
    const result = await readEventLink(checked.link, { signal: controller.signal });
    if (inFlight.current !== controller) return;
    inFlight.current = null;
    const outcome = outcomeOf(result, today);
    if (outcome.kind === 'draft') setView({ kind: 'draft', draft: outcome.draft });
    else if (outcome.kind === 'failed') setView({ kind: 'failed', reason: outcome.reason });
    else setView({ kind: 'idle' });
  };

  const cancel = () => {
    inFlight.current?.abort();
    inFlight.current = null;
    setView({ kind: 'idle' });
  };

  const byHand = () => {
    setView({ kind: 'idle' });
    onByHand();
  };

  const failure = view.kind === 'failed' ? failureView(view.reason) : null;
  return (
    <section className="flex flex-col gap-[8px] rounded-[12px] border border-[var(--card2)] p-[12px]" data-testid="org-paste">
      <label htmlFor={noteId} className="text-[15px] font-semibold text-[var(--fg)]">{LINK_LABEL}</label>
      <input
        id={noteId}
        type="url"
        inputMode="url"
        autoComplete="off"
        value={link}
        disabled={reading}
        aria-describedby={btn.reason ? noteId + '-why' : undefined}
        onChange={(e) => { setLink(e.target.value); if (view.kind === 'failed') setView({ kind: 'idle' }); }}
        data-testid="org-paste-input"
        className="h-[52px] w-full min-w-0 rounded-[12px] bg-[var(--card2)] px-[16px] text-[16px] text-[var(--fg)]"
      />
      {reading ? (
        <div className="flex flex-col gap-[8px]" role="status" data-testid="org-paste-reading">
          <p className="text-[14px] text-[var(--mut)]">Reading your link. This can take a minute.</p>
          <GhostButton size="sm" onClick={cancel} testId="org-paste-cancel">{CANCEL_LABEL}</GhostButton>
        </div>
      ) : (
        <PrimaryButton size="sm" disabled={btn.disabled} onClick={() => void read()} testId="org-paste-read">{READ_LABEL}</PrimaryButton>
      )}
      {btn.reason && !reading && <p id={noteId + '-why'} className="text-[14px] text-[var(--mut)]" data-testid="org-paste-why">{btn.reason}</p>}
      {failure && (
        <div className="flex flex-col gap-[8px]" data-testid="org-paste-failed">
          <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="org-paste-failed-message">{failure.message}</p>
          {failure.signIn && (
            <Link to="/auth" className="inline-flex min-h-[44px] items-center text-[14px] underline text-[var(--fg)]" data-testid="org-paste-signin">{SIGN_IN_LABEL}</Link>
          )}
          <GhostButton size="sm" onClick={byHand} testId="org-paste-byhand">{BY_HAND_LABEL}</GhostButton>
        </div>
      )}
      {view.kind === 'draft' && (
        <div className="flex flex-col gap-[8px]">
          <LinkDraftSummary draft={view.draft} />
          <PrimaryButton size="sm" onClick={() => onUse(view.draft)} testId="org-paste-use">{USE_LABEL}</PrimaryButton>
          <GhostButton size="sm" onClick={byHand} testId="org-paste-byhand">{BY_HAND_LABEL}</GhostButton>
        </div>
      )}
    </section>
  );
}

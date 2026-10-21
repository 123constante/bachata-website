import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Field, FIELD_CLASS, PrimaryButton } from '../../ui';
import { FestivalNights } from './FestivalNights';
import { MAX_DAYS, MIN_DAYS, festivalProblem, moveStart, newFestival, setDays, todayKey, ticketProblem, type FestivalDraft } from './festivalModel';

export interface FestivalCreateProps {
  /** Called with the finished draft. The create screen (C7) turns it into the server write. */
  onCreate: (draft: FestivalDraft) => void;
  busy?: boolean;
  /** Default: today in London. */
  today?: string;
  initial?: FestivalDraft;
}

/** Why Create is off, or null. Past days are refused here; an edit of a live festival may keep its date. */
export function createProblem(d: FestivalDraft, today: string): string | null {
  if (d.startDate && d.startDate < today) return 'Pick a day from today';
  return festivalProblem(d);
}

/** The create entry for the New event "Festival" format: start date, days, ticket link, every night's hours. */
export function FestivalCreate({ onCreate, busy = false, today = todayKey(), initial }: FestivalCreateProps) {
  const [draft, setDraft] = useState<FestivalDraft>(() => initial ?? newFestival('', 3));
  const problem = createProblem(draft, today);
  const link = ticketProblem(draft.ticketUrl);
  const days = draft.nights.length;
  return (
    <div className="space-y-[16px]" data-testid="festival-create">
      <Field label="First day" htmlFor="festival-start">
        <input id="festival-start" type="date" min={today} className={`${FIELD_CLASS} h-[48px]`} value={draft.startDate} data-testid="festival-start"
          onChange={(e) => setDraft(moveStart(draft, e.target.value))} />
      </Field>
      <div className="flex items-center justify-between gap-[12px]">
        <span className="text-[16px] font-semibold text-[var(--fg)]">Days</span>
        <div className="flex items-center gap-[8px]">
          <button type="button" aria-label="Fewer days" disabled={days <= MIN_DAYS} className="flex h-[44px] w-[44px] items-center justify-center rounded-[var(--r-ctl,12px)] border border-[var(--line-strong)] disabled:opacity-60" onClick={() => setDraft(setDays(draft, days - 1))}>
            <Minus aria-hidden="true" className="h-[18px] w-[18px]" />
          </button>
          <span className="w-[32px] text-center text-[18px] font-bold text-[var(--fg)]" data-testid="festival-days">{days}</span>
          <button type="button" aria-label="More days" disabled={days >= MAX_DAYS} className="flex h-[44px] w-[44px] items-center justify-center rounded-[var(--r-ctl,12px)] border border-[var(--line-strong)] disabled:opacity-60" onClick={() => setDraft(setDays(draft, days + 1))}>
            <Plus aria-hidden="true" className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
      <Field label="Ticket link" htmlFor="festival-ticket" error={link}>
        <input id="festival-ticket" type="url" inputMode="url" placeholder="https://" className={`${FIELD_CLASS} h-[48px]`} value={draft.ticketUrl} data-testid="festival-ticket"
          onChange={(e) => setDraft({ ...draft, ticketUrl: e.target.value })} />
      </Field>
      {draft.startDate && <FestivalNights draft={draft} onChange={setDraft} />}
      <div className="space-y-[6px]">
        {problem && <p className="text-center text-[13px] text-[var(--mut)]" data-testid="festival-reason">{problem}</p>}
        <PrimaryButton disabled={problem !== null} loading={busy} onClick={() => onCreate(draft)} testId="festival-create-go">Create festival</PrimaryButton>
      </div>
    </div>
  );
}

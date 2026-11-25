import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { londonTodayKey } from '@/lib/londonDate';
import type { FirstEventInput } from './selfSignupModel';

const BTN = 'inline-flex w-full min-h-[48px] items-center justify-center rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground disabled:opacity-50';
const GHOST = 'inline-flex w-full min-h-[44px] items-center justify-center rounded-xl border border-border px-4 text-[14px] font-medium';

interface Props {
  initial: FirstEventInput;
  error?: string | null;
  onContinue: (e: FirstEventInput) => void;
  onSkip: () => void;
  onBack: (e: FirstEventInput) => void;
}

/** First event: name + date only. Times are added later from the page. */
export default function FirstEventStep({ initial, error, onContinue, onSkip, onBack }: Props) {
  const [name, setName] = useState(initial.name);
  const [date, setDate] = useState(initial.date);
  const ok = name.trim().length >= 2 && !!date;
  return (
    <>
      <h1 className="text-[22px] font-bold leading-tight">Your first event</h1>
      <p className="text-[14px] text-muted-foreground">Name and date. Add the times from your page.</p>
      {error && <p className="text-[14px]" role="alert" data-testid="signup-event-error">{error}</p>}
      <label className="text-[14px] font-medium" htmlFor="signup-event-name">Event name</label>
      <Input id="signup-event-name" value={name} onChange={(e) => setName(e.target.value)} className="min-h-[48px] text-[16px]" data-testid="signup-event-name" />
      <label className="text-[14px] font-medium" htmlFor="signup-event-date">Date</label>
      <Input id="signup-event-date" type="date" min={londonTodayKey()} value={date} onChange={(e) => setDate(e.target.value)} className="min-h-[48px] text-[16px]" data-testid="signup-event-date" />
      <button type="button" className={BTN} disabled={!ok} onClick={() => onContinue({ name, date })} data-testid="signup-event-continue">Continue</button>
      <button type="button" className={GHOST} onClick={onSkip} data-testid="signup-event-skip">Skip for now</button>
      <button type="button" className={GHOST} onClick={() => onBack({ name, date })} data-testid="signup-event-back">Back</button>
    </>
  );
}

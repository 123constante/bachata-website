import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MIN_REASON_LENGTH, checkReason, typeNoun, type DecisionError, type QueueItem } from './ambassadorModel';

export const BTN = 'inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-[10px] border px-3.5 py-2 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-60';
export const BTN_PLAIN = `${BTN} border-border bg-secondary text-foreground`;
export const BTN_OK = `${BTN} border-primary bg-primary text-primary-foreground`;
export const BTN_NO = `${BTN} border-destructive bg-transparent text-destructive`;

interface ShellProps {
  title: string;
  label: string;
  busy: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function SheetShell({ title, label, busy, onClose, children }: ShellProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70" data-testid="decision-overlay">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="flex w-full max-w-[430px] flex-col gap-2.5 rounded-t-2xl border border-b-0 border-border bg-card px-3 pt-3.5 pb-[calc(14px+env(safe-area-inset-bottom))]"
      >
        <h2 className="m-0 text-[16px] font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

interface SheetProps {
  item: QueueItem;
  busy: boolean;
  error: DecisionError | null;
  /** Where "Sign in" goes when the session has ended; back to this screen afterwards. */
  signInHref: string;
  onCancel: () => void;
}

function DecisionErrorLine({ error, signInHref }: { error: DecisionError; signInHref: string }) {
  return (
    <p role="alert" className="m-0 text-[13px] text-destructive" data-testid="decision-error">
      {error.message}
      {error.kind === 'auth' && (
        <>
          {' '}
          <Link to={signInHref} className="inline-flex min-h-[44px] items-center font-semibold text-primary underline">Sign in</Link>
        </>
      )}
    </p>
  );
}

export function ApproveSheet({ item, busy, error, signInHref, onCancel, onConfirm }: SheetProps & { onConfirm: () => void }) {
  return (
    <SheetShell title={`Approve this ${item.targetType}?`} label="Approve" busy={busy} onClose={onCancel}>
      <p className="m-0 text-[15px] font-semibold [overflow-wrap:anywhere]">{item.name}</p>
      <p className="m-0 text-[14px] text-muted-foreground">
        It goes live on the public {item.cityName || 'city'} pages straight away.
      </p>
      {error && <DecisionErrorLine error={error} signInHref={signInHref} />}
      <div className="flex gap-2">
        <button type="button" autoFocus className={cn(BTN_PLAIN, 'flex-1')} disabled={busy} onClick={onCancel}>Cancel</button>
        <button type="button" className={cn(BTN_OK, 'flex-1')} disabled={busy} data-testid="approve-confirm" onClick={onConfirm}>
          {busy ? 'Approving…' : error ? 'Try again' : 'Yes, approve'}
        </button>
      </div>
    </SheetShell>
  );
}

export function RejectSheet({ item, busy, error, signInHref, onCancel, onSubmit }: SheetProps & { onSubmit: (reason: string) => void }) {
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const check = checkReason(text);
  const showInvalid = tried && !check.ok;
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const submit = () => {
    if (!check.ok) {
      setTried(true);
      return;
    }
    onSubmit(text.trim());
  };
  return (
    <SheetShell title={`Reject this ${item.targetType}?`} label="Reject" busy={busy} onClose={onCancel}>
      <p className="m-0 text-[15px] font-semibold [overflow-wrap:anywhere]">{item.name}</p>
      <label htmlFor="reject-reason" className="text-[12px] text-muted-foreground">Reason (required). The organiser will see this.</label>
      <textarea
        id="reject-reason"
        ref={ref}
        value={text}
        disabled={busy}
        aria-invalid={showInvalid}
        aria-describedby="reject-reason-error"
        placeholder="e.g. The flyer shows a different venue from the one entered."
        onChange={(e) => {
          setText(e.target.value);
          setTried(false);
        }}
        className={cn('min-h-[96px] w-full resize-y rounded-[10px] border bg-background p-2.5 text-[14px] text-foreground', showInvalid ? 'border-destructive' : 'border-input')}
      />
      <div id="reject-reason-error" role="alert" className="text-[13px] text-destructive" data-testid="reject-reason-error">
        {showInvalid ? check.message : ''}
      </div>
      {error && <DecisionErrorLine error={error} signInHref={signInHref} />}
      <div className="flex justify-between text-[12px] text-muted-foreground">
        <span>At least {MIN_REASON_LENGTH} characters</span>
        <span>{check.length}</span>
      </div>
      <div className="flex gap-2">
        <button type="button" className={cn(BTN_PLAIN, 'flex-1')} disabled={busy} onClick={onCancel}>Cancel</button>
        <button type="button" className={cn(BTN_NO, 'flex-1')} disabled={busy} data-testid="reject-submit" onClick={submit}>
          {busy ? 'Sending…' : error ? 'Try again' : 'Reject and send reason'}
        </button>
      </div>
    </SheetShell>
  );
}

export const partyNote = (item: Pick<QueueItem, 'targetType'>) =>
  `You are part of this ${typeNoun(item.targetType)}, so an admin has to decide it. Approve and Reject are off here. Nothing for you to do.`;

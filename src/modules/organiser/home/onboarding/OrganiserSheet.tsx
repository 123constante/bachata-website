import { useId, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { finishProfileHref } from '@/lib/profileCompletion';
import { claimOrganiser, requestOrganiserAccess, type ClaimCandidate } from '@/modules/organiser/shared/selfServeApi';
import { selfServeErrorCopy, type SelfServeErrorCopy } from '@/modules/organiser/shared/selfServeErrors';
import { EmailCodeProof } from '../../shared/components/EmailCodeProof';
import { Field, FIELD_CLASS, PrimaryButton, SheetView, useOpenerRef, useShake } from '../../ui';
import { NewPageFlow, type NewPageStep } from '../../flows/newpage';

export type SheetTask =
  | { kind: 'claim'; org: ClaimCandidate }
  | { kind: 'request'; org: ClaimCandidate }
  | { kind: 'create'; name: string };

interface Props {
  task: SheetTask | null;
  onTaskChange: (task: SheetTask | null) => void;
  email: string;
  mailboxProven: boolean;
  /** A claim went through: the line that says so. */
  onClaimed: (confirmation: string) => void;
  /** Ask to join was sent: the caller shows the Done screen. */
  onRequested: (org: ClaimCandidate) => void;
  /** The new page exists and is live: the caller lands on Home. */
  onCreated: (page: { name: string; organiserId: string | null }) => void;
  /** The create refusal that has no page to ask to join: back to the search with the name. */
  onFindPage: (name: string) => void;
  onHome: () => void;
}

/**
 * The one sheet behind every door action: claim (the shared email-code proof
 * when the session has not proved the mailbox), ask to join, or create (name,
 * then city). Views swap inside it; nothing nests.
 */
export function OrganiserSheet({ task, onTaskChange, email, mailboxProven, onClaimed, onRequested, onCreated, onFindPage, onHome }: Props) {
  const [step, setStep] = useState<NewPageStep>('name');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<SelfServeErrorCopy | null>(null);
  const [note, setNote] = useState('');
  const [name, setName] = useState('');
  const { shake, shakeProps } = useShake();
  const opener = useOpenerRef(!!task);
  const ids = useId();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  const kind = task?.kind ?? null;
  const orgId = task && task.kind !== 'create' ? task.org.id : null;
  const prefill = task?.kind === 'create' ? task.name : '';

  // A new task starts on its first view; create keeps what was typed, else takes the searched name.
  const taskKey = `${kind ?? ''}:${orgId ?? ''}:${prefill}`;
  const [seenTask, setSeenTask] = useState(taskKey);
  if (seenTask !== taskKey) {
    setSeenTask(taskKey);
    setStep('name');
    if (kind === 'create' && !name.trim()) setName(prefill);
  }

  const close = () => {
    onTaskChange(null);
    setFailure(null);
  };

  const run = async (action: () => Promise<unknown>, success: () => void) => {
    setBusy(true);
    setFailure(null);
    try {
      await action();
      setNote('');
      success();
    } catch (error) {
      const copy = selfServeErrorCopy(error);
      // The server refused an unfinished dancer profile: dancer first, then organiser.
      // The gated Finish screen says why and brings them back here.
      if (copy.next === 'finish_profile') {
        navigate(finishProfileHref(`${pathname}${search}`));
        return;
      }
      setFailure(copy);
      shake();
      // A refusal meaning "you cannot claim this" turns the claim into a request for the same organiser.
      if (copy.next === 'request_access' && task?.kind === 'claim') onTaskChange({ kind: 'request', org: task.org });
    } finally {
      setBusy(false);
    }
  };

  const claim = (org: ClaimCandidate) => run(() => claimOrganiser(org.id), () => onClaimed(`${org.name} is yours. You can now manage it.`));
  const request = (org: ClaimCandidate) => run(() => requestOrganiserAccess(org.id, note), () => onRequested(org));

  const error = failure && (
    <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="onboarding-sheet-error">
      {failure.message}
    </p>
  );

  let title = '';
  let body: ReactNode = null;
  let footer: ReactNode = undefined;

  if (task?.kind === 'claim') {
    title = `Claim ${task.org.name}`;
    body = (
      <div {...shakeProps} className={cn('space-y-[12px]', shakeProps.className)}>
        {error}
        {mailboxProven ? (
          <p className="text-[15px] text-[var(--fg)]">
            You&rsquo;re signed in as <strong className="break-all">{email}</strong>, the contact email on this listing.
          </p>
        ) : (
          <EmailCodeProof email={email} onProven={() => void claim(task.org)} />
        )}
      </div>
    );
    if (mailboxProven) {
      footer = (
        <PrimaryButton onClick={() => void claim(task.org)} loading={busy} loadingLabel="Claiming" testId="onboarding-claim-confirm">
          Yes, claim it
        </PrimaryButton>
      );
    }
  } else if (task?.kind === 'request') {
    title = `Ask to join ${task.org.name}`;
    body = (
      <div {...shakeProps} className={cn('space-y-[12px]', shakeProps.className)}>
        {error}
        <Field label="Who are you? (optional)" htmlFor={`${ids}-note`}>
          <textarea
            id={`${ids}-note`}
            data-sheet-autofocus
            value={note}
            maxLength={500}
            rows={3}
            onChange={(e) => setNote(e.target.value)}
            placeholder="I run the Tuesday classes with Ana"
            className={`${FIELD_CLASS} min-h-[88px] py-[12px]`}
            data-testid="onboarding-request-note"
          />
        </Field>
      </div>
    );
    footer = (
      <PrimaryButton onClick={() => void request(task.org)} loading={busy} loadingLabel="Sending" testId="onboarding-request-send">
        Ask to join
      </PrimaryButton>
    );
  } else if (task?.kind === 'create') {
    title = step === 'city' ? 'City' : 'New page';
    body = (
      <NewPageFlow
        step={step}
        onStep={setStep}
        name={name}
        onName={setName}
        onCreated={(page) => {
          setName('');
          onCreated(page);
        }}
        onAskToJoin={(org) => onTaskChange({ kind: 'request', org })}
        onFindPage={(found) => {
          setName('');
          onFindPage(found);
        }}
        onHome={() => {
          close();
          onHome();
        }}
      />
    );
  }

  return (
    <SheetView
      open={!!task}
      returnFocusRef={opener}
      onOpenChange={(o) => {
        if (!o) close();
      }}
      title={title || 'Organiser'}
      viewKey={`${kind ?? 'none'}:${orgId ?? ''}:${step}`}
      onBack={kind === 'create' && step === 'city' ? () => setStep('name') : undefined}
      fullHeight={kind === 'create'}
      footer={footer}
      testId="onboarding-sheet"
    >
      {body}
    </SheetView>
  );
}

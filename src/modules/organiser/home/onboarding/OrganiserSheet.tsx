import { useId, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { DANCER_GATE_REASON } from '@/lib/accountRouting';
import { NO_PROFILE_CONTACT_LABEL, NO_PROFILE_CONTACT_URL, NO_PROFILE_TEXT, finishProfileHref, stillToAddText, type ProfileField } from '@/lib/profileCompletion';
import { claimOrganiser, requestOrganiserAccess, type ClaimCandidate } from '@/modules/organiser/shared/selfServeApi';
import { selfServeErrorCopy, type SelfServeErrorCopy } from '@/modules/organiser/shared/selfServeErrors';
import { EmailCodeProof } from '../../shared/components/EmailCodeProof';
import { Field, FIELD_CLASS, GhostButton, PrimaryButton, SheetView, useOpenerRef, useShake } from '../../ui';
import { NewPageFlow, type NewPageStep } from '../../flows/newpage';
import { newPageSheetTitle, type NewPageRefusalKind } from '../../flows/newpage/model';
import type { ClaimHint } from '../../shared/claimHint';
import { NOT_THIS_ONE, claimScreen } from './claimStates';
import { GATE_OFF_REASON, GATE_RETURN_TEXT } from './profileGate';

/** Claim, ask to join and your own page carry the database's hint: it words the screen (6a-6e). */
export type DoorTask =
  | { kind: 'yours'; org: ClaimCandidate }
  | { kind: 'claim'; org: ClaimCandidate }
  | { kind: 'request'; org: ClaimCandidate; hint?: ClaimHint | null }
  | { kind: 'create'; name: string };

/**
 * P3 W4b (no-city B): the tap met an unfinished profile, so the sheet says what is missing
 * BEFORE any typing. `then` is the task that was tapped; nothing of it is sent from here.
 * `finishLabel` comes from the shared ratingGate ("Finish your profile").
 */
export type GateTask = {
  kind: 'gate';
  gate: 'finish' | 'no_row';
  missing: readonly ProfileField[];
  finishLabel: string;
  then: DoorTask;
};

export type SheetTask = DoorTask | GateTask;

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
  /** The login, so the new page's city step can offer the sign-up city. */
  userId?: string;
}

/**
 * The one sheet behind every door action: claim (the shared email-code proof
 * when the session has not proved the mailbox), ask to join, or create (name,
 * then city). Views swap inside it; nothing nests.
 */
export function OrganiserSheet({ task, onTaskChange, email, mailboxProven, onClaimed, onRequested, onCreated, onFindPage, onHome, userId }: Props) {
  const [step, setStep] = useState<NewPageStep>('name');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<SelfServeErrorCopy | null>(null);
  const [note, setNote] = useState('');
  const [name, setName] = useState('');
  const [refusalKind, setRefusalKind] = useState<NewPageRefusalKind | null>(null);
  const { shake, shakeProps } = useShake();
  const opener = useOpenerRef(!!task);
  const ids = useId();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  const kind = task?.kind ?? null;
  const door = task?.kind === 'gate' ? task.then : task;
  const orgId = door && door.kind !== 'create' ? door.org.id : null;
  const prefill = task?.kind === 'create' ? task.name : '';

  // A new task starts on its first view; create keeps what was typed, else takes the searched name.
  const taskKey = `${kind ?? ''}:${orgId ?? ''}:${prefill}`;
  const [seenTask, setSeenTask] = useState(taskKey);
  if (seenTask !== taskKey) {
    setSeenTask(taskKey);
    setStep('name');
    setRefusalKind(null);
    if (kind === 'create' && !name.trim()) setName(prefill);
  }

  const close = () => {
    onTaskChange(null);
    setFailure(null);
    setRefusalKind(null);
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
      // A refusal meaning "you cannot claim this" turns the claim into a request for the same organiser,
      // worded as an unknown hint: the claim's "your email matches" line is no longer true.
      if (copy.next === 'request_access' && task?.kind === 'claim') onTaskChange({ kind: 'request', org: task.org, hint: null });
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

  // 6a-6e: the one line under the title, from the shared mapping.
  const screen = door && door.kind !== 'create'
    ? claimScreen(door.kind === 'yours' ? 'yours' : door.kind === 'claim' ? 'email_matches' : door.hint ?? null, door.org.name)
    : null;
  // The header truncates (page names reach 34 characters on prod), so the sentence that
  // decides ("... already has an owner") wraps in the body; the header names the page.
  const sub = screen && (
    <div className="space-y-[4px]">
      <h3 className="break-words text-[17px] font-bold text-[var(--fg)]" data-testid="onboarding-claim-title">{screen.title}</h3>
      <p className="text-[15px] text-[var(--fg)]" data-testid="onboarding-claim-sub">{screen.sub}</p>
    </div>
  );
  const notThisOne = screen?.notThisOne && (
    <GhostButton onClick={close} disabled={busy} testId="onboarding-not-this-one">{NOT_THIS_ONE}</GhostButton>
  );
  const twoButtons = (primary: ReactNode) => (
    <div className="flex flex-col gap-[8px]">
      {primary}
      {notThisOne}
    </div>
  );

  if (task?.kind === 'gate') {
    const offId = `${ids}-gate-off`;
    title = task.then.kind === 'create' ? newPageSheetTitle('name', null) : task.then.org.name;
    body = (
      <div className="space-y-[12px]" data-testid="onboarding-gate" data-gate={task.gate}>
        <p className="text-[15px] font-semibold text-[var(--fg)]">{DANCER_GATE_REASON}</p>
        {task.gate === 'finish' ? (
          <>
            <p className="text-[14px] text-[var(--mut)]" data-testid="onboarding-gate-missing">{stillToAddText(task.missing)}</p>
            <PrimaryButton
              onClick={() => navigate(finishProfileHref(`${pathname}${search}`))}
              testId="onboarding-gate-finish"
              data-sheet-autofocus
            >
              {task.finishLabel}
            </PrimaryButton>
            {screen && task.then.kind !== 'yours' && (
              <div>
                <PrimaryButton disabled aria-describedby={offId} testId="onboarding-gate-off">{screen.primaryLabel}</PrimaryButton>
                <p id={offId} className="mt-[4px] text-[14px] text-[var(--mut)]">{GATE_OFF_REASON}</p>
              </div>
            )}
            <p className="text-[14px] text-[var(--mut)]" data-testid="onboarding-gate-return">{GATE_RETURN_TEXT}</p>
          </>
        ) : (
          <>
            {/* No dancer row (2 of 42 prod accounts): Finish profile has no form for it yet. */}
            <p className="text-[14px] text-[var(--mut)]">{NO_PROFILE_TEXT}</p>
            <a
              href={NO_PROFILE_CONTACT_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="onboarding-gate-contact"
              className="flex min-h-[48px] w-full items-center justify-center rounded-[var(--r-ctl,12px)] bg-[var(--btn)] px-[20px] text-[16px] font-bold text-[var(--btnfg)]"
            >
              {NO_PROFILE_CONTACT_LABEL}
            </a>
          </>
        )}
      </div>
    );
  } else if (task?.kind === 'yours' && screen) {
    title = task.org.name;
    body = sub;
    footer = (
      <PrimaryButton
        onClick={() => {
          close();
          onHome();
        }}
        testId="onboarding-yours-home"
      >
        {screen.primaryLabel}
      </PrimaryButton>
    );
  } else if (task?.kind === 'claim' && screen) {
    title = task.org.name;
    body = (
      <div {...shakeProps} className={cn('space-y-[12px]', shakeProps.className)}>
        {sub}
        {error}
        {/* Needs a proven mailbox: the code step comes first when the session has not proved it. */}
        {!mailboxProven && <EmailCodeProof email={email} onProven={() => void claim(task.org)} />}
      </div>
    );
    footer = mailboxProven
      ? twoButtons(
          <PrimaryButton onClick={() => void claim(task.org)} loading={busy} loadingLabel="Claiming" testId="onboarding-claim-confirm">
            {screen.primaryLabel}
          </PrimaryButton>,
        )
      : notThisOne || undefined;
  } else if (task?.kind === 'request' && screen) {
    title = task.org.name;
    body = (
      <div {...shakeProps} className={cn('space-y-[12px]', shakeProps.className)}>
        {sub}
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
    footer = twoButtons(
      <PrimaryButton onClick={() => void request(task.org)} loading={busy} loadingLabel="Sending" testId="onboarding-request-send">
        {screen.primaryLabel}
      </PrimaryButton>,
    );
  } else if (task?.kind === 'create') {
    title = newPageSheetTitle(step, refusalKind);
    body = (
      <NewPageFlow
        step={step}
        onStep={setStep}
        onRefusalChange={setRefusalKind}
        name={name}
        onName={setName}
        email={email || null}
        userId={userId}
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
      onBack={kind === 'create' && step === 'city' && !refusalKind ? () => setStep('name') : undefined}
      fullHeight={door?.kind === 'create'}
      footer={footer}
      testId="onboarding-sheet"
    >
      {body}
    </SheetView>
  );
}

// Presentational pieces of the join journey. No data fetching here: JoinPage decides the step and hands
// each screen its facts and handlers. Every tap target is 44px or more (explicit px: the phone html
// font-size is about 13.5px, so rem sizes render small). Words come from joinCopy only.
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { OTP_CODE_LENGTH } from '@/lib/auth-otp-routing';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { acceptedInviteLanding } from '@/modules/organiser/p3/shell/paths';
import { reasonScreen, type ReasonScreen } from '../inviteModel';
import { JOIN_COPY } from './joinCopy';
import type { DeadReason, JoinPreview, JoinStep, JoinStop } from './joinModel';

export const BTN = 'inline-flex w-full min-h-[48px] items-center justify-center rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground disabled:opacity-50';
export const GHOST = 'inline-flex w-full min-h-[44px] items-center justify-center rounded-xl border border-border px-4 text-[14px] font-medium';
export const LINKISH = 'inline-flex min-h-[44px] items-center justify-center self-start text-[14px] font-medium text-primary underline underline-offset-4';
export const FIELD = 'min-h-[48px] w-full rounded-xl border border-border bg-background px-3 text-[16px]';
export const WHY = 'min-h-[1em] text-center text-[13px] text-muted-foreground';

/** The one wrapper every step renders: the state machine's visible row. Focus lands on the heading when the step changes. */
export function StepFrame({ step, stop, children }: { step: JoinStep; stop?: JoinStop['kind'] | null; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const heading = ref.current?.querySelector<HTMLElement>('h1, h2');
    if (heading && !heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: false });
  }, [step, stop]);
  return (
    <div ref={ref} className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-6 pt-3" data-testid="join-step" data-step={step} data-stop={stop ?? undefined}>
      {children}
    </div>
  );
}

export const Heading = ({ children }: { children: ReactNode }) => <h1 className="text-[22px] font-bold leading-tight outline-none">{children}</h1>;
export const Lead = ({ children, testId }: { children: ReactNode; testId?: string }) => <p className="text-[14px] text-muted-foreground" data-testid={testId}>{children}</p>;

/** Errors live in one polite live region per screen. Always mounted so the announcement happens when text appears. */
export const ErrorLine = ({ id, children }: { id: string; children: ReactNode }) => (
  <p id={id} role="alert" aria-live="polite" className="min-h-[1em] text-[13px] text-destructive" data-testid={`${id}`}>{children}</p>
);

export function Strip({ preview }: { preview: JoinPreview }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-[13px]" data-testid="join-strip">
      <span aria-hidden="true" className="grid h-7 w-7 flex-none place-items-center rounded-full bg-primary/20 text-[12px] font-bold">{(preview.inviterFirstName ?? preview.organiserName).slice(0, 1)}</span>
      <span>{JOIN_COPY.strip(preview.inviterFirstName, preview.organiserName)}</span>
    </div>
  );
}

export function Progress({ n, total, label }: { n: number; total: number; label: string }) {
  return (
    <div className="flex flex-col gap-1" data-testid="join-progress" role="group" aria-label={`Step ${n} of ${total}: ${label}`}>
      <div className="flex justify-between text-[12px] text-muted-foreground"><span>{label}</span><span data-testid="join-progress-count">Step {n} of {total}</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary motion-safe:transition-[width]" style={{ width: `${Math.round((n / total) * 100)}%` }} /></div>
    </div>
  );
}

/** Person-bound invite: "Hi Papacito" (linking prototype). First name, photo and city only, never an email. */
export function PersonCard({ preview }: { preview: JoinPreview }) {
  const first = preview.person?.firstName ?? 'there';
  const avatar = preview.person?.avatarUrl ?? null;
  const city = preview.person?.city ?? null;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3" data-testid="join-person-card">
      <div className="flex items-center gap-3">
        {avatar ? (
          <img src={avatar} alt="" width={56} height={56} loading="lazy" className="h-14 w-14 flex-none rounded-full object-cover" />
        ) : (
          <span aria-hidden="true" className="grid h-14 w-14 flex-none place-items-center rounded-full bg-primary/20 text-[22px] font-bold">{first.slice(0, 1)}</span>
        )}
        <div className="min-w-0">
          <p className="text-[17px] font-bold" data-testid="join-person-hi">{JOIN_COPY.person.hi(first)}</p>
          {city && <p className="text-[13px] text-muted-foreground">{city}</p>}
          <span className="mt-1 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-300" data-testid="join-person-tag">{JOIN_COPY.person.tag}</span>
        </div>
      </div>
      <p className="text-[13px] text-muted-foreground">{JOIN_COPY.person.body}</p>
    </div>
  );
}

export function OrgCard({ preview }: { preview: JoinPreview }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3" data-testid="join-org-card">
      <span aria-hidden="true" className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-primary/20 text-[18px] font-bold">{preview.organiserName.slice(0, 1)}</span>
      <div className="min-w-0">
        <p className="text-[16px] font-bold">{preview.organiserName}</p>
        <p className="text-[13px] text-muted-foreground">{JOIN_COPY.join.card(preview.organiserName)}</p>
      </div>
    </div>
  );
}

export function Checking() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" data-testid="invite-checking">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-16 w-full" />
      <p className="text-[13px] text-muted-foreground" role="status">{JOIN_COPY.checking}</p>
    </div>
  );
}

export function EmailStep({ initial, busy, error, onSend }: { initial: string; busy: boolean; error: string | null; onSend: (typed: string) => void }) {
  const [typed, setTyped] = useState(initial);
  const canSend = typed.trim() !== '' && !busy;
  return (
    <form className="flex flex-col gap-2" noValidate onSubmit={(e) => { e.preventDefault(); onSend(typed); }} data-testid="join-email-form">
      <label htmlFor="join-email" className="text-[14px] font-semibold">{JOIN_COPY.email.label}<span className="block text-[13px] font-normal text-muted-foreground">{JOIN_COPY.email.hint}</span></label>
      <input id="join-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} className={FIELD} value={typed} onChange={(e) => setTyped(e.target.value)} aria-invalid={error ? true : undefined} aria-describedby={error ? 'join-email-error' : 'join-email-why'} data-testid="join-email-input" />
      <ErrorLine id="join-email-error">{error}</ErrorLine>
      <button type="submit" className={BTN} disabled={!canSend} data-testid="join-send">{busy ? JOIN_COPY.email.sending : JOIN_COPY.email.button}</button>
      <p id="join-email-why" className={WHY} data-testid="join-why">{typed.trim() === '' ? JOIN_COPY.email.why : ''}</p>
    </form>
  );
}

const GROUP = OTP_CODE_LENGTH / 2;

export function CodeStep({ email, verifying, error, notice, cooldown, onVerify, onResend, onChangeEmail }: {
  email: string; verifying: boolean; error: string | null; notice: string | null; cooldown: number;
  onVerify: (code: string) => void; onResend: () => void; onChangeEmail: () => void;
}) {
  const [code, setCode] = useState('');
  return (
    <div className="flex flex-col gap-2" data-testid="join-code-form">
      <Lead testId="join-sent-to">{JOIN_COPY.code.sentTo(email)}</Lead>
      <label htmlFor="join-code" className="text-[14px] font-semibold">{JOIN_COPY.code.label}</label>
      <div className="flex justify-center">
        <InputOTP id="join-code" maxLength={OTP_CODE_LENGTH} value={code} onChange={(v) => setCode(v.replace(/\D/g, ''))} onComplete={(v) => onVerify(v)} disabled={verifying} autoFocus autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]*" aria-label={JOIN_COPY.code.label} aria-describedby="join-code-error" containerClassName="gap-1" data-testid="join-code">
          {[0, 1].map((group) => (
            <Fragment key={group}>
              {group === 1 && <div role="separator" aria-hidden="true" className="mx-1 h-0.5 w-2 rounded bg-muted-foreground/50" />}
              <InputOTPGroup className="gap-1">
                {Array.from({ length: GROUP }, (_, i) => <InputOTPSlot key={i} index={group * GROUP + i} className="h-12 w-8 rounded-md border bg-card text-[16px]" />)}
              </InputOTPGroup>
            </Fragment>
          ))}
        </InputOTP>
      </div>
      <ErrorLine id="join-code-error">{error}</ErrorLine>
      {verifying && <p className="text-[13px] text-muted-foreground" role="status">{JOIN_COPY.code.verifying}</p>}
      {notice && <p className="text-[13px] text-foreground" role="status" data-testid="join-code-notice">{notice}</p>}
      <button type="button" className={GHOST} disabled={verifying || cooldown > 0} onClick={onResend} data-testid="join-resend">{cooldown > 0 ? JOIN_COPY.code.resendIn(cooldown) : JOIN_COPY.code.resend}</button>
      <button type="button" className={LINKISH} disabled={verifying} onClick={onChangeEmail} data-testid="join-change-email">{JOIN_COPY.code.change}</button>
    </div>
  );
}

export function JoinStepScreen({ preview, busy, signOutError, onJoin, onNotYou }: { preview: JoinPreview; busy: boolean; signOutError: string | null; onJoin: () => void; onNotYou: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <OrgCard preview={preview} />
      <button type="button" className={BTN} disabled={busy} onClick={onJoin} data-testid="invite-join">{busy ? JOIN_COPY.join.joining : JOIN_COPY.join.button(preview.organiserName)}</button>
      <button type="button" className={LINKISH} disabled={busy} onClick={onNotYou} data-testid="invite-not-you">{JOIN_COPY.join.notYou}</button>
      <ErrorLine id="join-signout-error">{signOutError}</ErrorLine>
    </div>
  );
}

export function DoneScreen({ org, flags, organiserId }: { org: string; flags: { organiserP3: boolean; organiserSelfServe: boolean }; organiserId: string | null }) {
  const selfServe = flags.organiserSelfServe;
  // The ONE landing helper; without an id (or with the area off) the plain home links stay.
  const to = selfServe ? (organiserId ? acceptedInviteLanding(organiserId, flags) : ORG_PATHS.home) : '/';
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-[14px]" role="status" data-testid="join-done">{JOIN_COPY.done.heading(org)}</div>
      <Lead>{selfServe ? JOIN_COPY.done.body : JOIN_COPY.done.bodyOff}</Lead>
      <Link to={to} className={BTN} data-testid="join-done-home">{selfServe ? JOIN_COPY.done.button : JOIN_COPY.done.buttonOff}</Link>
    </div>
  );
}

export function WrongAccountScreen({ signedInAs, hint, busy, error, onSwitch }: { signedInAs: string; hint: string; busy: boolean; error: string | null; onSwitch: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <Heading>{JOIN_COPY.wrongAccount.heading}</Heading>
      <Lead testId="invite-email-hint">{JOIN_COPY.wrongAccount.body(signedInAs, hint)}</Lead>
      <button type="button" className={BTN} disabled={busy} onClick={onSwitch} data-testid="invite-switch-account">{JOIN_COPY.wrongAccount.button}</button>
      <ErrorLine id="join-signout-error">{error}</ErrorLine>
      <Link to="/" className={GHOST} data-testid="invite-home">{JOIN_COPY.home}</Link>
    </div>
  );
}

/** A finished-with link (used / expired / revoked / invalid): why, and "Ask <inviter> for a new one" where that helps. */
export function DeadScreen({ reason, preview, newLink }: { reason: DeadReason; preview: JoinPreview | null; newLink: ReactNode }) {
  const screen = reasonScreen(reason, { organiserName: preview?.organiserName, inviterFirstName: preview?.inviterFirstName, emailHint: preview?.emailHint });
  return (
    <div className="flex flex-col gap-2" data-testid="invite-card">
      <Heading>{screen.title}</Heading>
      {screen.body && <Lead testId="invite-body">{screen.body}</Lead>}
      {screen.offerNewLink && newLink}
      <Link to="/" className={GHOST} data-testid="invite-home">{JOIN_COPY.home}</Link>
    </div>
  );
}

export function NoProfileScreen() {
  return (
    <div className="flex flex-col gap-2">
      <Heading>{JOIN_COPY.noProfile.heading}</Heading>
      <Lead>{JOIN_COPY.noProfile.body}</Lead>
      <a href={JOIN_COPY.noProfile.helpUrl} target="_blank" rel="noopener noreferrer" className={BTN}>{JOIN_COPY.noProfile.help}</a>
      <Link to="/" className={GHOST} data-testid="invite-home">{JOIN_COPY.home}</Link>
    </div>
  );
}

/**
 * A redeem refusal's next action, straight from the shared mapping (reasonScreen), never decided here:
 * the WhatsApp help link, Try again (disabled with its reason when a retry now would only fail again),
 * then the home link.
 */
function ReasonActions({ reason, busy, onRetry, home }: { reason: ReasonScreen; busy: boolean; onRetry: () => void; home: ReactNode }) {
  const blocked = reason.retryBlocked ?? null;
  return (
    <>
      {reason.help && <a href={JOIN_COPY.help.url} target="_blank" rel="noopener noreferrer" className={BTN} data-testid="join-help">{JOIN_COPY.help.label}</a>}
      {reason.action === 'retry' && (
        <>
          <button type="button" className={BTN} disabled={busy || blocked !== null} aria-describedby={blocked ? 'join-retry-why' : undefined} onClick={onRetry} data-testid="join-retry">{JOIN_COPY.network.button}</button>
          {blocked && <p id="join-retry-why" className={WHY} data-testid="join-retry-why">{blocked}</p>}
        </>
      )}
      {home}
    </>
  );
}

/** Refusals and failures, each with what to do next. `onRetry` re-runs the action that failed; `onSwitch` signs out and continues. */
export function StopScreen({ stop, preview, signedInAs, busy, error, onRetry, onSwitch, onDismiss }: {
  stop: JoinStop; preview: JoinPreview | null; signedInAs: string; busy: boolean; error: string | null;
  onRetry: () => void; onSwitch: () => void; onDismiss: () => void;
}) {
  const inviter = preview?.inviterFirstName ?? null;
  const home = <Link to="/" className={GHOST} data-testid="invite-home">{JOIN_COPY.home}</Link>;
  switch (stop.kind) {
    case 'blocked_domain':
      return (
        <div className="flex flex-col gap-2">
          <Heading>{JOIN_COPY.blockedDomain.heading}</Heading>
          <Lead>{JOIN_COPY.blockedDomain.body}</Lead>
          <a href={JOIN_COPY.blockedDomain.helpUrl} target="_blank" rel="noopener noreferrer" className={BTN} data-testid="join-help">{JOIN_COPY.blockedDomain.help}</a>
          <button type="button" className={GHOST} onClick={onDismiss} data-testid="join-dismiss">{JOIN_COPY.blockedDomain.button}</button>
        </div>
      );
    case 'rate_limited': {
      // A code-send limit is "wait a minute", and Try again only returns to the email box (it sends nothing).
      if (stop.from === 'code') {
        return (
          <div className="flex flex-col gap-2">
            <Heading>{JOIN_COPY.rateLimited.heading}</Heading>
            <Lead>{JOIN_COPY.rateLimited.bodyCode}</Lead>
            <button type="button" className={BTN} disabled={busy} onClick={onRetry} data-testid="join-retry">{JOIN_COPY.rateLimited.button}</button>
            {home}
          </div>
        );
      }
      // The redeem limit is an hour (login audit L6): the shared mapping disables Try again and says why.
      const screen = reasonScreen('rate_limited');
      return (
        <div className="flex flex-col gap-2">
          <Heading>{screen.title}</Heading>
          <Lead>{screen.body}</Lead>
          <ReasonActions reason={screen} busy={busy} onRetry={onRetry} home={home} />
        </div>
      );
    }
    case 'network':
      return (
        <div className="flex flex-col gap-2">
          <Heading>{JOIN_COPY.network.heading}</Heading>
          <Lead>{JOIN_COPY.network.body}</Lead>
          <button type="button" className={BTN} disabled={busy} onClick={onRetry} data-testid="join-retry">{JOIN_COPY.network.button}</button>
          {home}
        </div>
      );
    case 'email_unproven':
      return (
        <div className="flex flex-col gap-2">
          <Heading>{JOIN_COPY.emailUnproven.heading}</Heading>
          <Lead>{JOIN_COPY.emailUnproven.body}</Lead>
          <button type="button" className={BTN} disabled={busy} onClick={onSwitch} data-testid="invite-switch-account">{JOIN_COPY.emailUnproven.button}</button>
          <ErrorLine id="join-signout-error">{error}</ErrorLine>
          {home}
        </div>
      );
    case 'not_linked':
      return (
        <div className="flex flex-col gap-2">
          <span className="self-start rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-300" data-testid="join-not-linked-tag">{JOIN_COPY.notLinked.tag}</span>
          <Heading>{JOIN_COPY.notLinked.heading}</Heading>
          <Lead testId="join-not-linked-body">{JOIN_COPY.notLinked.body(inviter)}</Lead>
          <p className="rounded-xl border border-border p-3 text-[13px] text-muted-foreground">{JOIN_COPY.notLinked.note}</p>
          <button type="button" className={GHOST} disabled={busy} onClick={onSwitch} data-testid="invite-switch-account">{JOIN_COPY.notLinked.button}</button>
          <ErrorLine id="join-signout-error">{error}</ErrorLine>
        </div>
      );
    case 'wrong_account':
      return <WrongAccountScreen signedInAs={signedInAs} hint={stop.emailHint ?? preview?.emailHint ?? 'another email'} busy={busy} error={error} onSwitch={onSwitch} />;
    case 'already_bound':
      return (
        <div className="flex flex-col gap-2">
          <Heading>{JOIN_COPY.alreadyBound.heading}</Heading>
          <Lead>{JOIN_COPY.alreadyBound.body(inviter)}</Lead>
          {home}
        </div>
      );
    case 'refused': {
      const screen = reasonScreen(stop.reason, { organiserName: preview?.organiserName, inviterFirstName: inviter, emailHint: stop.emailHint });
      return (
        <div className="flex flex-col gap-2" data-testid="invite-card">
          <Heading>{screen.title}</Heading>
          {screen.body && <Lead testId="invite-body">{screen.body}</Lead>}
          <ReasonActions reason={screen} busy={busy} onRetry={onRetry} home={home} />
        </div>
      );
    }
  }
}


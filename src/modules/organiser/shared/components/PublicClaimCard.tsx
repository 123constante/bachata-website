import { useContext, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmailCodeProof } from './EmailCodeProof';
import { flags } from '@/lib/featureFlags';
import { organiserAreaHome, p3AreaLive } from '@/lib/organiserAreaHome';
import { claimOrganiser, requestOrganiserAccess } from '../selfServeApi';
import { selfServeErrorCode, selfServeErrorCopy, type SelfServeErrorCopy } from '../selfServeErrors';
import { claimIntentStep, hasClaimIntent, signInHref, signInToClaimHref, withClaimIntent, withoutClaimIntent } from '../publicClaim';
import { MANAGED_BADGE_TEXT, type OwnershipFacts } from '../ownership';
import type { ClaimHint } from '../claimHint';
import { ProfileGateContext } from '@/hooks/useAuth';
import { dancerGate } from '@/lib/accountRouting';
import { finishProfileHref } from '@/lib/profileCompletion';

/**
 * Lever 2 W7, mockup 06-A: ownership on the PUBLIC organiser page.
 *
 * ManagedBadge sits in the hero once the organiser is claimed. PublicClaimCard
 * is the "Is this you?" card for an unclaimed organiser: sign in when signed
 * out; otherwise the W1 claim (email match, mailbox proven) or request-access
 * flow through the D4 RPCs, with W1's refusal copy. The card decides nothing
 * itself: ownershipFacts (ownership.ts) decides what shows, from
 * organiser_ownership_v1 and organiser_claim_hints_v1, and claim_organiser_v1 is
 * the authority. Dark site theme (OrganiserProfile.tsx tokens), not .dashboard-bright.
 *
 * Mount it with `key={organiser.id}`: the panel, note and outcome belong to
 * ONE organiser and must not survive a navigation to another one.
 *
 * One intent (owner decision 2026-10-11): "Sign in to claim" returns here with
 * ?claim=1 (publicClaim.ts). Back signed in, the card consumes the marker ONCE
 * per mount and, only when ownershipFacts says 'claim', runs the same claim()
 * the "Yes, claim it" button runs -- or opens the claim panel at the email-code
 * step when the mailbox is not proven. Any other kind just drops the marker.
 */

const GOLD = '#E7BE6E';
const CREAM = '#F6F1EA';
const MUTE = 'rgba(246,241,234,0.62)';

export function ManagedBadge({ size }: { size: 'sm' | 'md' }) {
  return (
    <span
      data-testid="managed-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'sm' ? 4 : 5,
        fontSize: 12,
        fontWeight: 700,
        color: GOLD,
        padding: size === 'sm' ? '2px 8px' : '3px 10px',
        borderRadius: 100,
        border: '1px solid rgba(231,190,110,0.5)',
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true">&#10003;</span> {MANAGED_BADGE_TEXT}
    </span>
  );
}

/**
 * claimed / requested: the RPC accepted. stale: the RPC refused in a way that
 * proves the page's cached row is out of date (someone else claimed it, or it
 * is no longer live), so the page should refetch the organiser.
 */
export type PublicClaimOutcome = 'claimed' | 'requested' | 'stale';

const STALE_CODES = new Set(['organiser_already_claimed', 'organiser_not_found', 'not_live']);

interface Props {
  /** The page's single ownership decision (ownershipFacts); the card never re-derives it. */
  facts: OwnershipFacts;
  /** The database's claim hint, only to word the request panel. */
  hint: ClaimHint | null;
  organiser: { id: string; name: string } | null | undefined;
  user: { id: string; email?: string | null } | null | undefined;
  mailboxProven: boolean;
  /** The public page's own path, so sign-in comes back here. */
  returnTo: string;
  /** After a claim, a request, or a refusal that dates the cached row: the page refetches what changed. */
  onChanged: (outcome: PublicClaimOutcome) => void;
}

type Panel = 'closed' | 'claim' | 'request';

const card: CSSProperties = {
  background: 'rgba(231,190,110,0.08)',
  border: '1px solid rgba(231,190,110,0.35)',
  borderRadius: 14,
  color: CREAM,
};
const primary: CSSProperties = { background: GOLD, color: '#1b1408' };
/**
 * The ghost buttons' own hover (bg-accent, a bright yellow) under their inline
 * cream text read at about 1.3:1; a faint light wash keeps the text readable.
 */
const GHOST_HOVER = 'min-h-[44px] hover:bg-white/10';

export function PublicClaimCard({ facts, hint, organiser, user, mailboxProven, returnTo, onChanged }: Props) {
  const [panel, setPanel] = useState<Panel>('closed');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<SelfServeErrorCopy | null>(null);
  const [note, setNote] = useState('');
  const [done, setDone] = useState<PublicClaimOutcome | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const doneRef = useRef<HTMLElement>(null);
  // Read once, from the ADDRESS BAR (not the router's location, which keeps the
  // marker after the history.replaceState below, so a remount would re-arm it).
  // The ref (not state) is the once-guard: StrictMode's second effect run, a
  // re-render and the refetch after the claim all find it spent.
  const [intent] = useState(() => typeof window !== 'undefined' && hasClaimIntent(window.location.search));
  const intentSpent = useRef(false);
  const [autoRunning, setAutoRunning] = useState(false);
  // A panel the intent opened (or its refusal turned into the request panel) was
  // not asked for by a tap here: focus stays put, so no keyboard pops up on arrival.
  const quietFocus = useRef(false);
  // Dancer first, then organiser (owner decision 2026-10-11): a claim or a request
  // is organiser onboarding. The completion AppChrome already publishes (no second
  // read); 'loading' / signed out go ahead and the server refuses if it must.
  const profileGate = useContext(ProfileGateContext);
  const navigate = useNavigate();
  // Back here after finishing, with the claim intent: the card picks the claim up
  // again (and the Finish screen knows from it that it was gated, so no Skip).
  const finishFirst = () => navigate(finishProfileHref(withClaimIntent(returnTo)));

  // The button that opened a panel (or sent it) unmounts, so focus would fall to the
  // page: move it into the open panel, and onto the outcome once one shows.
  useEffect(() => {
    if (panel === 'closed' || quietFocus.current) return;
    sectionRef.current?.querySelector<HTMLElement>('[data-panel] :is(textarea, button):not([disabled])')?.focus();
  }, [panel]);
  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  const run = async (action: () => Promise<unknown>, outcome: PublicClaimOutcome) => {
    if (profileGate && profileGate !== 'loading' && dancerGate(profileGate.status) === 'gate') {
      finishFirst();
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await action();
      setDone(outcome);
      onChanged(outcome);
    } catch (error) {
      const copy = selfServeErrorCopy(error);
      if (copy.next === 'finish_profile') {
        finishFirst();
        return;
      }
      setFailure(copy);
      // A refusal that means "you can't claim this" turns the claim panel
      // into the request panel for the same organiser (W1's behaviour).
      if (copy.next === 'request_access') setPanel('request');
      if (STALE_CODES.has(selfServeErrorCode(error) ?? '')) onChanged('stale');
    } finally {
      setBusy(false);
    }
  };

  const claim = (id: string) => run(() => claimOrganiser(id), 'claimed');
  const { kind } = facts;
  // The session can end while a panel is open (sign-out in another tab): the
  // panels are signed-in UI, so they follow the user, not the panel state alone.
  const signedIn = !!user;
  const organiserId = organiser?.id;

  const intentStep = claimIntentStep({
    armed: intent && !intentSpent.current && !!organiserId,
    signedIn,
    kind,
    hintKnown: hint != null,
    mailboxProven,
  });
  useEffect(() => {
    if (intentStep === 'none' || intentStep === 'wait' || intentSpent.current || !organiserId) return;
    intentSpent.current = true;
    if (typeof window !== 'undefined') {
      const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const clean = withoutClaimIntent(here);
      // history, not navigate(): a router navigation would re-run the route loader.
      if (clean !== here) window.history.replaceState(window.history.state, '', clean);
    }
    if (intentStep === 'drop') return;
    quietFocus.current = true;
    setPanel('claim');
    if (intentStep === 'prove') return;
    setAutoRunning(true);
    void claim(organiserId).finally(() => setAutoRunning(false));
    // claim is a fresh closure each render; the step is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentStep, organiserId]);
  // From the first render, so "Claim this page" never flashes before the effect
  // runs: the busy state when the claim will run, the email-code step when it waits for proof.
  const autoBusy = autoRunning || intentStep === 'claim';
  const claimPanelOpen = panel === 'claim' || intentStep === 'prove';

  // A finished claim or request stays on screen even though the refetched
  // organiser now reads as managed (the card would otherwise vanish mid-read).
  if (done && organiser) {
    return (
      <section ref={doneRef} tabIndex={-1} className="mx-4 my-3 p-3 text-sm md:mx-12 outline-none" style={{ ...card, borderColor: 'rgba(30,158,106,0.5)', background: 'rgba(30,158,106,0.08)' }} data-testid="public-claim-done" role="status">
        {done === 'claimed' ? (
          <div className="flex flex-wrap items-center gap-2">
            <span><strong>&#10003; This is your page.</strong> <span style={{ color: MUTE }}>You can now add and change your events.</span></span>
            <Link to={organiserAreaHome(flags, p3AreaLive(flags) ? organiser.id : null)} className="ml-auto inline-flex min-h-[44px] items-center rounded-full px-4 text-xs font-bold" style={primary} data-testid="public-claim-go">
              Go to my events &rarr;
            </Link>
          </div>
        ) : (
          <span><strong>Request sent.</strong> <span style={{ color: MUTE }}>We&rsquo;ll check and add you to {organiser.name}.</span></span>
        )}
      </section>
    );
  }

  if (!organiser) return null;
  // Mid-flow, a refusal can make the refetched facts read 'managed'/'hidden' while a
  // panel is open: the open panel stays until closed (below). Otherwise only the
  // "Is this you?" shapes render a card.
  if (!facts.showIsThisYou && panel === 'closed') return null;

  const email = user?.email ?? '';
  const signIn = signInHref(returnTo);
  const signInToClaim = signInToClaimHref(returnTo);
  // Arrived with the intent: the email-code step's emailed link keeps it too.
  const proofReturnTo = intent ? withClaimIntent(returnTo) : returnTo;
  // ...and so does the "Sign in" a refused claim offers (authentication_required).
  const signInAgain = intent ? signInToClaim : signIn;

  const request = () => run(() => requestOrganiserAccess(organiser.id, note), 'requested');

  return (
    <section ref={sectionRef} className="mx-4 my-3 p-3 space-y-2 text-sm md:mx-12" style={card} data-testid="public-claim-card">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-bold">Is this you?</p>
          <p className="text-xs" style={{ color: MUTE }}>
            If you run {organiser.name}, claim this page to manage your classes and parties yourself.
          </p>
        </div>
        {!signedIn ? (
          <Link to={signInToClaim} className="inline-flex min-h-[44px] items-center rounded-full px-4 text-xs font-bold" style={primary} data-testid="public-claim-signin">
            Sign in to claim
          </Link>
        ) : autoBusy ? (
          <Button size="sm" disabled className="rounded-full font-bold min-h-[44px]" style={primary} data-testid="public-claim-auto-busy">
            <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Claiming&hellip;
          </Button>
        ) : panel === 'closed' && !claimPanelOpen ? (
          <Button size="sm" className="rounded-full font-bold min-h-[44px]" style={primary} onClick={() => { quietFocus.current = false; setPanel(kind === 'claim' ? 'claim' : 'request'); setFailure(null); }} data-testid="public-claim-open">
            {kind === 'claim' ? 'Claim this page' : 'Ask to join'}
          </Button>
        ) : null}
      </div>

      {/* Above the panel: when a refused claim turns into a request, the reason reads first. */}
      {signedIn && panel !== 'closed' && failure && (
        <p className="text-xs text-destructive" role="alert" data-testid="public-claim-error">
          {failure.message}
          {failure.next === 'sign_in' && (
            <>
              {' '}
              <Link to={signInAgain} className="underline tap-link-inline" style={{ color: GOLD }} data-testid="public-claim-signin">
                Sign in
              </Link>
            </>
          )}
        </p>
      )}

      {signedIn && claimPanelOpen && !autoBusy && (
        <div className="space-y-2" data-testid="public-claim-panel" data-panel>
          <p className="text-xs" style={{ color: MUTE }}>
            You&rsquo;re signed in as <strong style={{ color: CREAM }}>{email}</strong>. That matches the contact email on this
            page, so you can claim it now.
          </p>
          {mailboxProven ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => void claim(organiser.id)} className="rounded-full font-bold min-h-[44px]" style={primary} data-testid="public-claim-confirm">
                {busy && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />} Yes, claim it
              </Button>
              <Button size="sm" variant="ghost" className={`${GHOST_HOVER} min-h-[44px]`} style={{ color: MUTE }} onClick={() => setPanel('closed')}>
                Not me
              </Button>
            </div>
          ) : (
            <div data-testid="public-claim-proof">
              <EmailCodeProof email={email} returnTo={proofReturnTo} onProven={() => void claim(organiser.id)} />
            </div>
          )}
        </div>
      )}

      {signedIn && panel === 'request' && (
        <div className="space-y-2" data-testid="public-request-panel" data-panel>
          {/* A refusal that opened this panel already says why, just above. */}
          {failure?.next !== 'request_access' && (
          <p className="text-xs" style={{ color: MUTE }}>
            You&rsquo;re signed in as <strong style={{ color: CREAM }}>{email}</strong>.{' '}
            {hint === 'email_differs'
              ? 'This page lists a different contact email.'
              : hint === 'no_email'
                ? 'This page lists no contact email to check against.'
                : 'We can\u2019t match your email to this page.'}{' '}
            Tell us who you are and the Bachata Calendar team will check.
          </p>
          )}
          <Label htmlFor={`public-request-note-${organiser.id}`} className="text-xs" style={{ color: MUTE }}>
            Who are you? (optional)
          </Label>
          <Textarea
            id={`public-request-note-${organiser.id}`}
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[64px] text-[16px]"
            style={{ background: '#120e14', color: CREAM, borderColor: 'rgba(246,241,234,0.12)' }}
            placeholder="e.g. I run the Tuesday classes with Ana"
            data-testid="public-request-note"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => void request()} className="rounded-full font-bold min-h-[44px]" style={primary} data-testid="public-request-send">
              {busy && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />} Request access
            </Button>
            <Button size="sm" variant="ghost" className={`${GHOST_HOVER} min-h-[44px]`} style={{ color: MUTE }} onClick={() => setPanel('closed')}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {signedIn && panel === 'claim' && mailboxProven && failure?.next === 'reauth' && (
        <div data-testid="public-claim-proof">
          <EmailCodeProof email={email} returnTo={proofReturnTo} onProven={() => { setFailure(null); void claim(organiser.id); }} />
        </div>
      )}
    </section>
  );
}

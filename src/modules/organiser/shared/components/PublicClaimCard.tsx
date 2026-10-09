import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmailCodeProof } from './EmailCodeProof';
import { ORG_PATHS } from '../../shell/paths';
import { claimOrganiser, requestOrganiserAccess } from '../selfServeApi';
import { selfServeErrorCode, selfServeErrorCopy, type SelfServeErrorCopy } from '../selfServeErrors';
import { publicClaimKind, signInHref, type PublicClaimOrganiser, type PublicClaimUser } from '../publicClaim';

/**
 * Lever 2 W7, mockup 06-A: ownership on the PUBLIC organiser page.
 *
 * ManagedBadge sits in the hero once the organiser is claimed. PublicClaimCard
 * is the "Is this you?" card for an unclaimed organiser: sign in when signed
 * out; otherwise the W1 claim (email match, mailbox proven) or request-access
 * flow through the D4 RPCs, with W1's refusal copy. The card decides nothing
 * itself: publicClaimKind reads the page's own columns and the RPC is the
 * authority. Dark site theme (OrganiserProfile.tsx tokens), not .dashboard-bright.
 *
 * Mount it with `key={organiser.id}`: the panel, note and outcome belong to
 * ONE organiser and must not survive a navigation to another one.
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
      <span aria-hidden="true">&#10003;</span> Managed by the organiser
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
  enabled: boolean;
  organiser: PublicClaimOrganiser | null | undefined;
  user: PublicClaimUser | null | undefined;
  mailboxProven: boolean;
  /** The public page's own path, so sign-in comes back here. */
  returnTo: string;
  /** After a claim, a request, or a refusal that dates the cached row: the page refetches what changed. */
  onChanged: (outcome: PublicClaimOutcome) => void;
}

type Panel = 'closed' | 'claim' | 'request';

/** Appended to the sign-in return path so the card knows the visitor came to claim. */
const CLAIM_INTENT_HASH = '#claim';

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

export function PublicClaimCard({ enabled, organiser, user, mailboxProven, returnTo, onChanged }: Props) {
  const kind = publicClaimKind(enabled, organiser, user);
  // Coming back from "Sign in to claim": the visitor already said what they
  // want, so the panel starts open instead of asking for a second tap. Any
  // later choice of the visitor's own (open, cancel) ends that automatic open.
  const [cameToClaim, setCameToClaim] = useState(
    () => typeof window !== 'undefined' && window.location.hash === CLAIM_INTENT_HASH,
  );
  const [chosenPanel, setChosenPanel] = useState<Panel>('closed');
  const panel: Panel =
    chosenPanel === 'closed' && cameToClaim && user && (kind === 'claim' || kind === 'request') ? kind : chosenPanel;
  const setPanel = (next: Panel) => {
    setCameToClaim(false);
    setChosenPanel(next);
  };
  // A refresh must not reopen it: the marker leaves the address once read.
  useEffect(() => {
    if (cameToClaim && window.location.hash === CLAIM_INTENT_HASH) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [cameToClaim]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<SelfServeErrorCopy | null>(null);
  const [note, setNote] = useState('');
  const [done, setDone] = useState<PublicClaimOutcome | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const doneRef = useRef<HTMLElement>(null);

  // The button that opened a panel (or sent it) unmounts, so focus would fall to the
  // page: move it into the open panel, and onto the outcome once one shows.
  useEffect(() => {
    if (panel === 'closed') return;
    sectionRef.current?.querySelector<HTMLElement>('[data-panel] :is(textarea, button):not([disabled])')?.focus();
  }, [panel]);
  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);


  // A finished claim or request stays on screen even though the refetched
  // organiser now reads as managed (the card would otherwise vanish mid-read).
  if (done && organiser) {
    return (
      <section ref={doneRef} tabIndex={-1} className="mx-4 my-3 p-3 text-sm md:mx-12 outline-none" style={{ ...card, borderColor: 'rgba(30,158,106,0.5)', background: 'rgba(30,158,106,0.08)' }} data-testid="public-claim-done" role="status">
        {done === 'claimed' ? (
          <div className="flex flex-wrap items-center gap-2">
            <span><strong>&#10003; This is your page.</strong> <span style={{ color: MUTE }}>You can now add and change your events.</span></span>
            <Link to={ORG_PATHS.home} className="ml-auto inline-flex min-h-[44px] items-center rounded-full px-4 text-xs font-bold" style={primary} data-testid="public-claim-go">
              Go to my events &rarr;
            </Link>
          </div>
        ) : (
          <span><strong>Request sent.</strong> <span style={{ color: MUTE }}>We&rsquo;ll check and add you to {organiser.name}.</span></span>
        )}
      </section>
    );
  }

  if (kind === 'hidden' || !organiser) return null;
  // A managed organiser shows only the badge -- unless the visitor is mid-flow
  // (a refusal just turned the claim panel into the request panel and the
  // refetched row now reads as managed): the open panel stays until closed.
  if (kind === 'managed' && panel === 'closed') return null;

  // The session can end while a panel is open (sign-out in another tab): the
  // panels are signed-in UI, so they follow the user, not the panel state alone.
  const signedIn = !!user;
  const email = user?.email ?? '';
  const signIn = signInHref(`${returnTo}${CLAIM_INTENT_HASH}`);

  const run = async (action: () => Promise<unknown>, outcome: PublicClaimOutcome) => {
    setBusy(true);
    setFailure(null);
    try {
      await action();
      setDone(outcome);
      onChanged(outcome);
    } catch (error) {
      const copy = selfServeErrorCopy(error);
      setFailure(copy);
      // A refusal that means "you can't claim this" turns the claim panel
      // into the request panel for the same organiser (W1's behaviour).
      if (copy.next === 'request_access') setPanel('request');
      if (STALE_CODES.has(selfServeErrorCode(error) ?? '')) onChanged('stale');
    } finally {
      setBusy(false);
    }
  };

  const claim = () => run(() => claimOrganiser(organiser.id), 'claimed');
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
          <Link to={signIn} className="inline-flex min-h-[44px] items-center rounded-full px-4 text-xs font-bold" style={primary} data-testid="public-claim-signin">
            Sign in to claim
          </Link>
        ) : panel === 'closed' ? (
          <Button size="sm" className="rounded-full font-bold min-h-[44px]" style={primary} onClick={() => { setPanel(kind === 'claim' ? 'claim' : 'request'); setFailure(null); }} data-testid="public-claim-open">
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
              <Link to={signIn} className="underline tap-link-inline" style={{ color: GOLD }} data-testid="public-claim-signin">
                Sign in
              </Link>
            </>
          )}
        </p>
      )}

      {signedIn && panel === 'claim' && (
        <div className="space-y-2" data-testid="public-claim-panel" data-panel>
          <p className="text-xs" style={{ color: MUTE }}>
            You&rsquo;re signed in as <strong style={{ color: CREAM }}>{email}</strong>. That matches the contact email on this
            page, so you can claim it now.
          </p>
          {mailboxProven ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => void claim()} className="rounded-full font-bold min-h-[44px]" style={primary} data-testid="public-claim-confirm">
                {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Yes, claim it
              </Button>
              <Button size="sm" variant="ghost" className={`${GHOST_HOVER} min-h-[44px]`} style={{ color: MUTE }} onClick={() => setPanel('closed')}>
                Not me
              </Button>
            </div>
          ) : (
            <div data-testid="public-claim-proof">
              <EmailCodeProof email={email} returnTo={returnTo} onProven={() => void claim()} />
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
            {organiser.contactEmail?.trim()
              ? 'This page lists a different contact email.'
              : 'This page lists no contact email to check against.'}{' '}
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
              {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Request access
            </Button>
            <Button size="sm" variant="ghost" className={`${GHOST_HOVER} min-h-[44px]`} style={{ color: MUTE }} onClick={() => setPanel('closed')}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {signedIn && panel === 'claim' && mailboxProven && failure?.next === 'reauth' && (
        <div data-testid="public-claim-proof">
          <EmailCodeProof email={email} returnTo={returnTo} onProven={() => { setFailure(null); void claim(); }} />
        </div>
      )}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { flags } from '@/lib/featureFlags';
import { newOrganiserLanding } from '@/lib/auth-otp-routing';
import { fetchMyDancerEdit, saveMyBuyerRoles } from '../../api/rpc';
import { toDancerError } from '../../api/errors';
import { BUYER_ROLES, type BuyerRole, type MyDancerEdit } from '../../api/types';

/**
 * Buyer onboarding B (flag VITE_ENABLE_BUYER_ONBOARDING, OFF by default): the "Finish your
 * profile" card on /account/my-tickets. Step 1 is "What are you?": Dancer / Organiser / Teacher /
 * DJ, multi-pick, skippable (Skip sends nothing), resumable (what is saved comes back ticked).
 * Organiser picked = a second card linking to the EXISTING organiser start (no new screen).
 * Saves through set_my_buyer_roles_v1 (api/rpc saveMyBuyerRoles); errors are api/errors copy.
 */

export const ROLE_LABEL: Record<BuyerRole, string> = { dancer: 'Dancer', organiser: 'Organiser', teacher: 'Teacher', dj: 'DJ' };

export const FINISH_COPY = {
  title: 'Finish your profile',
  step: 'What are you?',
  help: 'Pick all that fit. Only the organisers you buy tickets from see this.',
  save: 'Save',
  saving: 'Saving',
  skip: 'Skip for now',
  cancel: 'Cancel',
  needPick: 'Pick at least one, or skip for now.',
  change: 'Change',
  organiserTitle: 'Set up your organiser page',
  organiserBody: 'Find your page or create a new one, then add your events.',
  organiserLink: 'Set up your page',
} as const;

/** "Dancer, Organiser" in the stored order. */
export const rolesLine = (roles: readonly BuyerRole[]): string => BUYER_ROLES.filter((r) => roles.includes(r)).map((r) => ROLE_LABEL[r]).join(', ');

/** The organiser card shows for an organiser pick, unless the person already organises (has an organiser profile type). */
export const showOrganiserCard = (p: Pick<MyDancerEdit, 'buyer_roles' | 'other_roles'>): boolean =>
  p.buyer_roles.includes('organiser') && !p.other_roles.includes('organising');

const surface = {
  background: 'hsl(var(--bento-surface-raised))',
  color: 'hsl(var(--bento-fg))',
  border: '1px solid var(--bento-hairline)',
} as const;
const muted = { color: 'hsl(var(--bento-fg-muted))' } as const;
const accent = 'hsl(var(--bento-accent))';

export default function FinishProfileCard({ p3Live = flags.organiserP3 && flags.organiserSelfServe }: { p3Live?: boolean }) {
  const [person, setPerson] = useState<MyDancerEdit | null>(null);
  const [editing, setEditing] = useState(false);
  const [pick, setPick] = useState<BuyerRole[]>([]);
  const [skipped, setSkipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    // A failed read hides the card: it is optional, and My tickets must still work.
    fetchMyDancerEdit().then(
      (p) => { if (!live) return; setPerson(p); setPick(p.buyer_roles); setEditing(p.buyer_roles.length === 0); },
      () => undefined,
    );
    return () => { live = false; };
  }, []);

  if (!person || skipped) return null;
  const saved = person.buyer_roles;
  const nothing = pick.length === 0 && saved.length === 0;

  const toggle = (r: BuyerRole) => {
    setError(null);
    setPick((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : BUYER_ROLES.filter((x) => x === r || cur.includes(x))));
  };
  const save = async () => {
    if (busy || nothing) return;
    setBusy(true);
    setError(null);
    try {
      const stored = await saveMyBuyerRoles(pick, saved);
      setPerson({ ...person, buyer_roles: stored });
      setPick(stored);
      setEditing(stored.length === 0);
    } catch (err) {
      setError(toDancerError(err).message);
    } finally {
      setBusy(false);
    }
  };
  const skip = () => {
    // Skip sends nothing: the step comes back on the next visit, with what is saved ticked.
    if (saved.length > 0) { setPick(saved); setEditing(false); setError(null); } else setSkipped(true);
  };

  return (
    <div className="mb-3 space-y-2" data-testid="finish-profile">
      <section className="rounded-md p-3 text-[14px]" style={surface} aria-labelledby="finish-profile-title" data-testid="finish-profile-card" data-view={editing ? 'ask' : 'done'}>
        <h2 id="finish-profile-title" className="text-[15px] font-semibold">{FINISH_COPY.title}</h2>
        {editing ? (
          <>
            <p id="finish-roles-q" className="mt-1 text-[14px] font-medium">{FINISH_COPY.step}</p>
            <p className="text-[13px]" style={muted}>{FINISH_COPY.help}</p>
            <div role="group" aria-labelledby="finish-roles-q" className="mt-2 grid grid-cols-4 gap-2">
              {BUYER_ROLES.map((r) => {
                const on = pick.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(r)}
                    disabled={busy}
                    className="min-h-[44px] rounded-md px-1 text-[14px] font-medium"
                    style={on ? { background: accent, color: 'hsl(var(--bento-surface))', border: `1px solid ${accent}` } : { border: '1px solid var(--bento-hairline)' }}
                    data-testid={`finish-role-${r}`}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                );
              })}
            </div>
            {error && <p className="mt-2 text-[13px] font-medium" role="alert" data-testid="finish-error">{error}</p>}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={skip}
                disabled={busy}
                className="min-h-[44px] rounded-md px-3 text-[14px] underline"
                style={{ border: '1px solid var(--bento-hairline)' }}
                data-testid="finish-skip"
              >
                {saved.length > 0 ? FINISH_COPY.cancel : FINISH_COPY.skip}
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy || nothing}
                aria-describedby={nothing ? 'finish-need-pick' : undefined}
                className="min-h-[44px] rounded-md px-3 text-[14px] font-semibold disabled:opacity-50"
                style={{ background: accent, color: 'hsl(var(--bento-surface))' }}
                data-testid="finish-save"
              >
                {busy ? FINISH_COPY.saving : FINISH_COPY.save}
              </button>
            </div>
            {nothing && <p id="finish-need-pick" className="mt-1 text-[12px]" style={muted} data-testid="finish-need-pick">{FINISH_COPY.needPick}</p>}
          </>
        ) : (
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-[13px]" data-testid="finish-roles-line">
              <span style={muted}>{FINISH_COPY.step} </span>{rolesLine(saved)}
            </p>
            <button type="button" onClick={() => { setPick(saved); setEditing(true); }} className="min-h-[44px] shrink-0 px-2 text-[14px] underline" data-testid="finish-change">
              {FINISH_COPY.change}
            </button>
          </div>
        )}
      </section>
      {!editing && showOrganiserCard(person) && (
        <section className="rounded-md p-3 text-[14px]" style={surface} aria-labelledby="finish-organiser-title" data-testid="finish-organiser-card">
          <h2 id="finish-organiser-title" className="text-[15px] font-semibold">{FINISH_COPY.organiserTitle}</h2>
          <p className="mt-1 text-[13px]" style={muted}>{FINISH_COPY.organiserBody}</p>
          <Link to={newOrganiserLanding(p3Live)} className="mt-1 inline-flex min-h-[44px] items-center text-[14px] font-medium underline" data-testid="finish-organiser-link">
            {FINISH_COPY.organiserLink}
          </Link>
        </section>
      )}
    </div>
  );
}

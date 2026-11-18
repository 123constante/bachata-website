import { useState } from 'react';
import { saveMyBuyerRoles } from '../api/rpc';
import { toDancerError } from '../api/errors';
import { usePutMyDancerEdit } from '../api/useMyDancerEdit';
import { BUYER_ROLES, type BuyerRole, type MyDancerEdit } from '../api/types';

/** The chip words, in the server's order. */
export const BUYER_ROLE_LABEL: Record<BuyerRole, string> = { dancer: 'Dancer', organiser: 'Organiser', teacher: 'Teacher', dj: 'DJ' };

export const ROLE_STEP_COPY = {
  sub: 'Pick all that fit, or skip. Only organisers you buy tickets from can see this.',
  save: 'Save',
  saving: 'Saving\u2026',
  skip: 'Skip',
} as const;

/**
 * Buyer onboarding B (flag ON): the FIRST step of the "What are you?" sheet. Multi-pick,
 * skippable, resumable (opens with what the person saved last time). Save goes through
 * set_my_buyer_roles_v1; the same set as before sends nothing. Errors are api/errors.ts copy.
 */
export function RoleStep({ person, onDone }: { person: MyDancerEdit; onDone: (roles: BuyerRole[]) => void }) {
  const put = usePutMyDancerEdit();
  const [picked, setPicked] = useState<BuyerRole[]>(person.buyer_roles);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (r: BuyerRole) => setPicked((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await saveMyBuyerRoles(picked, person);
      if (next !== person) put(next);
      onDone(next.buyer_roles);
    } catch (err) {
      setError(toDancerError(err).message);
      setBusy(false);
    }
  };
  return (
    <>
      <p className="dt-sheet-sub">{ROLE_STEP_COPY.sub}</p>
      <div className="dt-chips dt-chips-4" role="group" aria-labelledby="dt-sheet-title">
        {BUYER_ROLES.map((r) => (
          <button
            key={r}
            type="button"
            className="dt-chip"
            aria-pressed={picked.includes(r)}
            onClick={() => toggle(r)}
            disabled={busy}
            data-testid={`role-pick-${r}`}
          >
            {BUYER_ROLE_LABEL[r]}
          </button>
        ))}
      </div>
      {error && (
        <p className="dt-sheet-error" role="alert" data-testid="role-step-error">
          {error}
        </p>
      )}
      <div className="dt-sheet-actions">
        <button type="button" className="dt-btn" onClick={() => void save()} disabled={busy} data-testid="role-step-save">
          {busy ? ROLE_STEP_COPY.saving : ROLE_STEP_COPY.save}
        </button>
        <button type="button" className="dt-btn dt-btn-quiet" onClick={() => onDone(person.buyer_roles)} disabled={busy} data-testid="role-step-skip">
          {ROLE_STEP_COPY.skip}
        </button>
      </div>
    </>
  );
}

import { PARTNER_DETAILS_MAX, PARTNER_HINT, PARTNER_KINDS_V3, PARTNER_ROLES_V3, PARTNER_YEARS_V3, partnerCanSave, partnerContinue, partnerMissing, type DraftV3, type PartnerDraftV3 } from '../modelV3';

/** Neon Night (D1) look for the partner step and its "Your ideal partner" sheet. State lives in OnboardingV3; this is look + the Brief A rules only. */

type Props = {
  draft: PartnerDraftV3;
  sheet: boolean;
  busy: boolean;
  error: string | null;
  onAnswer: (a: 'yes' | 'no') => void;
  onChange: (next: PartnerDraftV3) => void;
  onOpenSheet: () => void;
  /** Sheet Save: the caller closes the sheet and saves + advances. */
  onSave: () => void;
  onContinue: () => void;
};

const Row = ({ icon, title, on, onClick, testId }: { icon: string; title: string; on: boolean; onClick: () => void; testId: string }) => (
  <button type="button" role="radio" aria-checked={on} className={on ? 'opt on' : 'opt'} data-testid={testId} onClick={onClick}>
    <span className="ic" aria-hidden="true">
      {icon}
    </span>
    <span>{title}</span>
  </button>
);

const Chip = ({ label, on, multi, onClick, testId }: { label: string; on: boolean; multi?: boolean; onClick: () => void; testId: string }) => (
  <button type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={on} className={on ? 'chip on' : 'chip'} data-testid={testId} onClick={onClick}>
    {label}
  </button>
);

export const NeonPartner = ({ draft, sheet, busy, error, onAnswer, onChange, onOpenSheet, onSave, onContinue }: Props) => {
  const shape = { partnerRole: draft.role, partnerKinds: draft.kinds, partnerYears: draft.years };
  const missing = partnerMissing(shape);
  const go = () => {
    const next = partnerContinue({ lookingForPartner: draft.answer === null ? null : draft.answer === 'yes', ...shape } as unknown as DraftV3);
    if (next === 'reopen-sheet') onOpenSheet();
    else if (next === 'advance') onContinue();
  };
  return (
    <>
      <h2 className="q">Looking for a dance partner?</h2>
      <p className="sub" data-testid="onboarding-sub">
        Say yes and we show you to dancers who want a partner.
      </p>
      <div role="radiogroup" aria-label="Looking for a dance partner">
        <Row testId="onboarding-partner-yes" icon={'\u{1F91D}'} title="Yes, I am" on={draft.answer === 'yes'} onClick={() => onAnswer('yes')} />
        <Row testId="onboarding-partner-no" icon={'\u{1F642}'} title="No, just social dancing" on={draft.answer === 'no'} onClick={() => onAnswer('no')} />
      </div>
      {error ? (
        <p role="alert" className="small" data-testid="onboarding-error">
          {error}
        </p>
      ) : null}
      <button type="button" className="cta" data-testid="onboarding-continue" disabled={draft.answer === null || busy} onClick={go}>
        {busy ? 'Saving…' : 'Continue'}
      </button>
      {sheet ? (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Your ideal partner" data-testid="partner-sheet">
          <div className="grab" aria-hidden="true" />
          <h3>Your ideal partner</h3>
          <div className="sec">
            <h4>What kind</h4>
            <div role="group" aria-label="What kind" className="chips">
              {PARTNER_KINDS_V3.map((k) => (
                <Chip key={k.value} multi testId={`partner-kind-${k.value}`} label={k.label} on={draft.kinds.includes(k.value)} onClick={() => onChange({ ...draft, kinds: draft.kinds.includes(k.value) ? draft.kinds.filter((x) => x !== k.value) : [...draft.kinds, k.value] })} />
              ))}
            </div>
          </div>
          <div className="sec">
            <h4>Their role</h4>
            <div role="radiogroup" aria-label="Their role" className="chips">
              {PARTNER_ROLES_V3.map((r) => (
                <Chip key={r.value} testId={`partner-role-${r.label}`} label={r.label} on={draft.role === r.value} onClick={() => onChange({ ...draft, role: r.value })} />
              ))}
            </div>
          </div>
          <div className="sec">
            <h4>Years dancing</h4>
            <div role="radiogroup" aria-label="Years dancing" className="chips">
              {PARTNER_YEARS_V3.map((y) => (
                <Chip key={y.id} testId={`partner-years-${y.id}`} label={y.label} on={draft.years === y.id} onClick={() => onChange({ ...draft, years: y.id })} />
              ))}
            </div>
          </div>
          <input
            type="text"
            aria-label="A line to potential partners"
            placeholder="A line to potential partners"
            maxLength={PARTNER_DETAILS_MAX}
            value={draft.details}
            onChange={(e) => onChange({ ...draft, details: e.target.value })}
            data-testid="partner-details"
            className="note"
          />
          {missing.length > 0 ? (
            <p className="small" style={{ margin: '6px 0 4px' }} data-testid="partner-hint">
              {PARTNER_HINT(missing)}
            </p>
          ) : null}
          <button type="button" className="cta" style={{ marginTop: 4, padding: 14 }} data-testid="partner-sheet-save" disabled={!partnerCanSave(shape) || busy} onClick={onSave}>
            Save
          </button>
        </div>
      ) : null}
    </>
  );
};

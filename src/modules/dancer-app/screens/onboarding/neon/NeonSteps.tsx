import type { ReactNode } from 'react';
import { BUYER_ROLES, type BuyerRole } from '../../../api/types';
import { YEAR_BANDS_V3, type YearBandV3 } from '../modelV3';
import { useLazy } from '../useLazy';

/** Neon Night (D1) look for Roles, Styles, Years. Same props and handlers as RolesCardV3/StylesCardV3/YearsCardV3 (stepsV3.tsx): look only, no logic copied. */

type NeonStep = { busy: boolean; error: string | null; onContinue: () => void };

const Tick = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5 9-10" />
  </svg>
);

const Head = ({ title, sub }: { title: ReactNode; sub: string }) => (
  <>
    <h2 className="q">{title}</h2>
    <p className="sub" data-testid="onboarding-sub">
      {sub}
    </p>
  </>
);

const Foot = ({ busy, error, disabled, reason, onContinue }: NeonStep & { disabled: boolean; reason: string; onContinue: () => void }) => (
  <>
    {error ? (
      <p role="alert" className="small" data-testid="onboarding-error">
        {error}
      </p>
    ) : null}
    {disabled ? (
      <p className="small" data-testid="onboarding-reason">
        {reason}
      </p>
    ) : null}
    <button type="button" className="cta" data-testid="onboarding-continue" disabled={disabled || busy} onClick={onContinue}>
      {busy ? 'Saving\u2026' : 'Continue'}
    </button>
  </>
);

const Opt = ({ icon, title, sub, on, multi, onClick, testId }: { icon: string; title: string; sub?: string; on: boolean; multi?: boolean; onClick: () => void; testId: string }) => (
  <button type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={on} className={on ? 'opt on' : 'opt'} data-testid={testId} onClick={onClick}>
    <span className="ic" aria-hidden="true">
      {icon}
    </span>
    <span>
      {title}
      {sub ? <small>{sub}</small> : null}
    </span>
    <span className="ck" aria-hidden="true" data-testid={on ? `${testId}-tick` : undefined}>
      {on ? <Tick /> : null}
    </span>
  </button>
);

/** 💃 🎟️ 🎓 🎧 */
const ROLE_NEON: Record<BuyerRole, { icon: string; title: string; sub: string }> = {
  dancer: { icon: '\u{1F483}', title: 'Dancer', sub: 'Find nights and partners' },
  organiser: { icon: '\u{1F39F}️', title: 'Organiser', sub: 'Run events and classes' },
  teacher: { icon: '\u{1F393}', title: 'Teacher', sub: 'Share your classes' },
  dj: { icon: '\u{1F3A7}', title: 'DJ', sub: 'Play at nights' },
};

export const RolesNeon = ({ picked, onToggle, ...foot }: NeonStep & { picked: readonly BuyerRole[]; onToggle: (r: BuyerRole) => void }) => (
  <>
    <Head title={<>Who&rsquo;s hitting the floor?</>} sub="Pick all that fit. Change anytime." />
    <div role="group" aria-label="Who you are">
      {BUYER_ROLES.map((r) => (
        <Opt key={r} multi testId={`onboarding-role-${r}`} {...ROLE_NEON[r]} on={picked.includes(r)} onClick={() => onToggle(r)} />
      ))}
    </div>
    <Foot {...foot} disabled={picked.length === 0} reason="Pick at least one to continue." />
  </>
);

export const StylesNeon = ({ picked, onToggle, ...foot }: NeonStep & { picked: readonly string[]; onToggle: (s: string) => void }) => {
  // Live vocabulary (FAVORITE_STYLE_OPTIONS), not the mockup's placeholder six.
  const styles = useLazy(() => import('@/components/profile/dancerConstants'))?.FAVORITE_STYLE_OPTIONS ?? [];
  return (
    <>
      <Head title="Which styles do you dance?" sub="Pick at least one." />
      <div role="group" aria-label="Styles you dance" className="chips">
        {styles.map((s) => (
          <button key={s} type="button" role="checkbox" aria-checked={picked.includes(s)} className={picked.includes(s) ? 'chip on' : 'chip'} onClick={() => onToggle(s)}>
            {s}
          </button>
        ))}
      </div>
      <Foot {...foot} disabled={picked.length === 0} reason="Pick at least one style to continue." />
    </>
  );
};

export const YearsNeon = ({ band, onPick, ...foot }: NeonStep & { band: YearBandV3 | null; onPick: (b: YearBandV3) => void }) => (
  <>
    <Head title="How long have you danced?" sub="Required. We store the year you started." />
    <div role="radiogroup" aria-label="How long you have danced">
      {YEAR_BANDS_V3.map((b) => (
        <Opt key={b.id} testId={`onboarding-years-${b.id}`} icon={'\u{1F4C5}'} title={b.label} on={band === b.id} onClick={() => onPick(b.id)} />
      ))}
    </div>
    <Foot {...foot} disabled={!band} reason="Pick one to continue." />
  </>
);

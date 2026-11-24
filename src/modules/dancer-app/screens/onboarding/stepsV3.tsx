import type { ComponentType } from 'react';
import { CalendarDays, Check, GraduationCap, Headphones, PartyPopper, Ticket } from 'lucide-react';
import { BUYER_ROLES, type BuyerRole } from '../../api/types';
import { YEAR_BANDS_V3, type YearBandV3 } from './modelV3';
import { useLazy } from './useLazy';
import { Chip, ErrorLine, PrimaryButton, Question, Reason, WRAP } from './ui';

/** Dancer onboarding v3 cards (prototype v8 screens i==1, i==11, i==10). State lives in the shell so Back keeps what was typed. */

type CardV3 = { busy: boolean; error: string | null; onContinue: () => void };

const Sub = ({ children }: { children: string }) => (
  <p data-testid="onboarding-sub" className={`${WRAP} mx-0 mb-[12px] mt-0 text-[14px] text-[var(--mut)]`}>
    {children}
  </p>
);

/** One full-width answer row: icon, title, one-line sub, tick when on. Checkbox for several answers, radio for one. */
const Row = ({
  icon: Icon,
  title,
  sub,
  selected,
  multi,
  onClick,
  testId,
}: {
  icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  title: string;
  sub?: string;
  selected: boolean;
  multi?: boolean;
  onClick: () => void;
  testId: string;
}) => (
  <button
    type="button"
    role={multi ? 'checkbox' : 'radio'}
    aria-checked={selected}
    onClick={onClick}
    data-testid={testId}
    className={`${WRAP} flex min-h-[56px] w-full cursor-pointer items-center gap-[12px] rounded-[var(--r-ctl,12px)] border px-[14px] text-left ${
      selected ? 'da-vote-on' : 'border-[var(--line-strong)] bg-[var(--card2)] text-[var(--fg)]'
    }`}
  >
    <Icon size={22} aria-hidden />
    <span className="grid min-w-0 flex-1">
      <span className="text-[16px] font-semibold">{title}</span>
      {sub ? <span className="text-[14px] opacity-80">{sub}</span> : null}
    </span>
    {selected ? <Check size={20} aria-hidden data-testid={`${testId}-tick`} /> : null}
  </button>
);

const ROLE_ROWS: Record<BuyerRole, { icon: ComponentType<{ size?: number }>; title: string; sub: string }> = {
  dancer: { icon: PartyPopper, title: 'Dancer', sub: 'Find nights and partners' },
  organiser: { icon: Ticket, title: 'Organiser', sub: 'Run events and classes' },
  teacher: { icon: GraduationCap, title: 'Teacher', sub: 'Share your classes' },
  dj: { icon: Headphones, title: 'DJ', sub: 'Play at nights' },
};

export const RolesCardV3 = ({ picked, onToggle, busy, error, onContinue }: CardV3 & { picked: readonly BuyerRole[]; onToggle: (r: BuyerRole) => void }) => (
  <>
    <Question>Who&rsquo;s hitting the floor?</Question>
    <Sub>Pick all that fit. Change anytime.</Sub>
    <div role="group" aria-label="Who you are" className="mb-[12px] grid gap-[8px]">
      {BUYER_ROLES.map((r) => (
        <Row key={r} multi testId={`onboarding-role-${r}`} {...ROLE_ROWS[r]} selected={picked.includes(r)} onClick={() => onToggle(r)} />
      ))}
    </div>
    <ErrorLine message={error} />
    <PrimaryButton busy={busy} disabled={picked.length === 0} onClick={onContinue}>
      Continue
    </PrimaryButton>
    {picked.length === 0 ? <Reason>Pick at least one to continue.</Reason> : null}
  </>
);

export const StylesCardV3 = ({ picked, onToggle, busy, error, onContinue }: CardV3 & { picked: readonly string[]; onToggle: (s: string) => void }) => {
  // The live vocabulary (dancerConstants), loaded on demand like StylesCard.
  const styles = useLazy(() => import('@/components/profile/dancerConstants'))?.FAVORITE_STYLE_OPTIONS ?? [];
  return (
    <>
      <Question>Which styles do you dance?</Question>
      <Sub>Pick at least one.</Sub>
      <div role="group" aria-label="Styles you dance" className="mb-[12px] grid gap-[8px]">
        {styles.map((s) => (
          <Chip key={s} multi label={s} selected={picked.includes(s)} onClick={() => onToggle(s)} />
        ))}
      </div>
      <ErrorLine message={error} />
      <PrimaryButton busy={busy} disabled={picked.length === 0} onClick={onContinue}>
        Continue
      </PrimaryButton>
      {picked.length === 0 ? <Reason>Pick at least one style to continue.</Reason> : null}
    </>
  );
};

export const YearsCardV3 = ({ band, onPick, busy, error, onContinue }: CardV3 & { band: YearBandV3 | null; onPick: (b: YearBandV3) => void }) => (
  <>
    <Question>How long have you danced?</Question>
    <Sub>Required. We store the year you started.</Sub>
    <div role="radiogroup" aria-label="How long you have danced" className="mb-[12px] grid gap-[8px]">
      {YEAR_BANDS_V3.map((b) => (
        <Row key={b.id} testId={`onboarding-years-${b.id}`} icon={CalendarDays} title={b.label} selected={band === b.id} onClick={() => onPick(b.id)} />
      ))}
    </div>
    <ErrorLine message={error} />
    <PrimaryButton busy={busy} disabled={!band} onClick={onContinue}>
      Continue
    </PrimaryButton>
    {!band ? <Reason>Pick one to continue.</Reason> : null}
  </>
);

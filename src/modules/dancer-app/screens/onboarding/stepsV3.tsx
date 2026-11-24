import type { ComponentType } from 'react';
import { Camera, CalendarDays, Check, GraduationCap, Handshake, Headphones, PartyPopper, Smile, Ticket } from 'lucide-react';
import { PersonAvatar } from '@/components/account/profiles/PersonAvatar';
import { BUYER_ROLES, type BuyerRole } from '../../api/types';
import { PARTNER_DETAILS_MAX, PARTNER_KINDS_V3, PARTNER_ROLES_V3, PARTNER_YEARS_V3, YEAR_BANDS_V3, type PartnerDraftV3, type YearBandV3 } from './modelV3';
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

/** Pill chip for the partner sheet (single or multi pick). */
const SheetChip = ({ label, selected, onClick, testId }: { label: string; selected: boolean; onClick: () => void; testId: string }) => (
  <button
    type="button"
    aria-pressed={selected}
    data-testid={testId}
    onClick={onClick}
    className={`min-h-[44px] cursor-pointer rounded-full border px-[14px] text-[15px] font-semibold ${selected ? 'da-vote-on' : 'border-[var(--line-strong)] bg-[var(--card2)] text-[var(--fg)]'}`}
  >
    {label}
  </button>
);

export const PartnerCardV3 = ({ draft, onAnswer, busy, error, onContinue }: CardV3 & { draft: PartnerDraftV3; onAnswer: (a: 'yes' | 'no') => void }) => {
  const blocked = draft.answer === null || (draft.answer === 'yes' && !draft.role);
  return (
    <>
      <Question>Looking for a dance partner?</Question>
      <Sub>Say yes and we show you to dancers who want a partner.</Sub>
      <div role="radiogroup" aria-label="Looking for a dance partner" className="mb-[12px] grid gap-[8px]">
        <Row testId="onboarding-partner-yes" icon={Handshake} title="Yes, I am" selected={draft.answer === 'yes'} onClick={() => onAnswer('yes')} />
        <Row testId="onboarding-partner-no" icon={Smile} title="No, just social dancing" selected={draft.answer === 'no'} onClick={() => onAnswer('no')} />
      </div>
      <ErrorLine message={error} />
      <PrimaryButton busy={busy} disabled={blocked} onClick={onContinue}>
        Continue
      </PrimaryButton>
      {draft.answer === null ? <Reason>Pick one to continue.</Reason> : null}
      {draft.answer === 'yes' && !draft.role ? <Reason>Pick the role you are looking for to continue.</Reason> : null}
    </>
  );
};

export const PartnerSheetV3 = ({
  draft,
  onChange,
  onClose,
}: {
  draft: PartnerDraftV3;
  onChange: (next: PartnerDraftV3) => void;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 z-50 flex items-end bg-black/60" data-testid="partner-sheet-backdrop" onClick={onClose}>
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Your ideal partner"
      data-testid="partner-sheet"
      onClick={(e) => e.stopPropagation()}
      className="mx-auto max-h-[85vh] w-full max-w-[520px] overflow-y-auto rounded-t-[20px] bg-[var(--card)] p-[16px] text-[var(--fg)]"
    >
      <button type="button" aria-label="Close" data-testid="partner-sheet-handle" onClick={onClose} className="mx-auto mb-[12px] block min-h-[24px] w-full cursor-pointer border-0 bg-transparent p-0">
        <span className="mx-auto block h-[5px] w-[40px] rounded-full bg-[var(--line-strong)]" />
      </button>
      <h2 className={`${WRAP} m-0 mb-[12px] text-[20px] font-bold`}>Your ideal partner</h2>
      <p className="m-0 mb-[6px] text-[14px] font-semibold text-[var(--mut)]">What kind</p>
      <div role="group" aria-label="What kind" className="mb-[12px] flex flex-wrap gap-[8px]">
        {PARTNER_KINDS_V3.map((k) => (
          <SheetChip
            key={k.value}
            testId={`partner-kind-${k.value}`}
            label={k.label}
            selected={draft.kinds.includes(k.value)}
            onClick={() => onChange({ ...draft, kinds: draft.kinds.includes(k.value) ? draft.kinds.filter((x) => x !== k.value) : [...draft.kinds, k.value] })}
          />
        ))}
      </div>
      <p className="m-0 mb-[6px] text-[14px] font-semibold text-[var(--mut)]">Their role</p>
      <div role="group" aria-label="Their role" className="mb-[12px] flex flex-wrap gap-[8px]">
        {PARTNER_ROLES_V3.map((r) => (
          <SheetChip key={r.value} testId={`partner-role-${r.label}`} label={r.label} selected={draft.role === r.value} onClick={() => onChange({ ...draft, role: r.value })} />
        ))}
      </div>
      <p className="m-0 mb-[6px] text-[14px] font-semibold text-[var(--mut)]">Years dancing</p>
      <div role="group" aria-label="Years dancing" className="mb-[12px] flex flex-wrap gap-[8px]">
        {PARTNER_YEARS_V3.map((y) => (
          <SheetChip key={y.id} testId={`partner-years-${y.id}`} label={y.label} selected={draft.years === y.id} onClick={() => onChange({ ...draft, years: y.id })} />
        ))}
      </div>
      <input
        type="text"
        aria-label="A line to potential partners"
        placeholder="A line to potential partners"
        maxLength={PARTNER_DETAILS_MAX}
        value={draft.details}
        onChange={(e) => onChange({ ...draft, details: e.target.value })}
        data-testid="partner-details"
        className="mb-[12px] min-h-[48px] w-full rounded-[var(--r-ctl,12px)] border border-[var(--line-strong)] bg-[var(--card2)] px-[14px] text-[16px] text-[var(--fg)]"
      />
      <PrimaryButton testId="partner-sheet-save" onClick={onClose}>
        Save
      </PrimaryButton>
    </div>
  </div>
);

export const PhotoCardV3 = ({ photoUrl, onPickPhoto, busy, error, onContinue }: CardV3 & { photoUrl: string | null; onPickPhoto: () => void }) => (
  <>
    <Question>Show us your face</Question>
    <Sub>A photo is required. Partners and organisers need to know who you are.</Sub>
    <button
      type="button"
      data-testid="onboarding-photo-tile"
      onClick={onPickPhoto}
      className="mb-[12px] flex min-h-[220px] w-full cursor-pointer flex-col items-center justify-center gap-[8px] overflow-hidden rounded-[var(--r-ctl,12px)] border border-dashed border-[var(--line-strong)] bg-[var(--card2)] p-0 text-[var(--fg)]"
    >
      {photoUrl ? <PersonAvatar photoUrl={photoUrl} name="You" size={160} alt="Your photo" /> : <Camera size={36} aria-hidden />}
      <span className="px-[12px] pb-[8px] text-[15px] font-semibold">{photoUrl ? 'Photo added. Tap to change' : 'Tap to add a photo'}</span>
    </button>
    <ErrorLine message={error} />
    <PrimaryButton busy={busy} disabled={!photoUrl} onClick={onContinue}>
      Continue
    </PrimaryButton>
    {!photoUrl ? <Reason>Add a photo to continue.</Reason> : null}
  </>
);

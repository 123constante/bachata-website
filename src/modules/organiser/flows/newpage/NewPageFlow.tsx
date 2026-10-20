import { useId, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, Mail, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { finishProfileHref } from '@/lib/profileCompletion';
import { createOrganiserProfile, searchClaimableOrganisers, type ClaimCandidate } from '@/modules/organiser/shared/selfServeApi';
import { selfServeErrorCopy } from '@/modules/organiser/shared/selfServeErrors';
import { supportLinks } from '@/modules/organiser/shared/support';
import { Card, Field, FIELD_CLASS, PrimaryButton, SearchField, SkeletonRows, SummaryRow, useShake } from '../../ui';
import { searchCities } from '../../home/onboarding/citySearch';
import { CAP_REASON, classifyRefusal, findByName } from './model';

export type NewPageStep = 'name' | 'city';

type Refusal =
  | { kind: 'name_taken'; name: string; page: ClaimCandidate | null }
  | { kind: 'cap' }
  | { kind: 'invite'; message: string }
  | { kind: 'other'; message: string };

interface Props {
  step: NewPageStep;
  onStep: (step: NewPageStep) => void;
  name: string;
  onName: (name: string) => void;
  /** The page exists and is live: the caller lands on Home. */
  onCreated: (page: { name: string; organiserId: string | null }) => void;
  /** `organiser_name_taken`: the page that already has this name. */
  onAskToJoin: (page: ClaimCandidate) => void;
  /** `organiser_name_taken` and the page could not be found by name: back to the search with the name. */
  onFindPage: (name: string) => void;
  onHome: () => void;
}

/**
 * C40 the page's name, C40b its city. Choosing the city IS the create: ONE
 * create_organiser_profile_v1 call (the page is live on creation, so nothing
 * here speaks of a draft or a review). A refusal replaces the step with its
 * reason and ONE action.
 */
export function NewPageFlow({ step, onStep, name, onName, onCreated, onAskToJoin, onFindPage, onHome }: Props) {
  const [cityQuery, setCityQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const { shake, shakeProps } = useShake();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const nameId = useId();
  const named = name.trim().length > 0;

  const cities = useQuery({
    queryKey: ['org-city-search', cityQuery.trim()],
    queryFn: () => searchCities(cityQuery),
    enabled: step === 'city' && !refusal && cityQuery.trim().length >= 2,
    staleTime: 300_000,
  });

  const create = async (cityId: string) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setRefusal(null);
    try {
      const made = await createOrganiserProfile({ name, cityId, contactEmail: '', instagram: '', website: '' });
      onCreated({ name: name.trim(), organiserId: made.organiserId });
    } catch (error) {
      const kind = classifyRefusal(error);
      if (kind === 'name_taken') {
        let page: ClaimCandidate | null = null;
        try {
          page = findByName(await searchClaimableOrganisers(name), name);
        } catch {
          page = null;
        }
        setRefusal({ kind, name: page?.name ?? name.trim(), page });
      } else if (kind === 'cap') {
        setRefusal({ kind });
      } else {
        const copy = selfServeErrorCopy(error);
        // An unfinished dancer profile: the gated Finish screen says why and brings them back.
        if (copy.next === 'finish_profile') {
          navigate(finishProfileHref(`${pathname}${search}`));
          return;
        }
        // Invite-only: a retry cannot work, so the screen offers the support rows instead.
        if (copy.next === 'contact_support') setRefusal({ kind: 'invite', message: copy.message });
        else setRefusal({ kind, message: copy.message });
      }
      shake();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  if (refusal) {
    return (
      <div className={cn('space-y-[16px]', shakeProps.className)} onAnimationEnd={shakeProps.onAnimationEnd} role="alert" data-testid="onboarding-create-refusal">
        {refusal.kind === 'name_taken' && (
          <>
            <p className="text-[15px] text-[var(--fg)]">{refusal.name} is already listed.</p>
            {refusal.page ? (
              <PrimaryButton onClick={() => onAskToJoin(refusal.page!)} testId="onboarding-create-ask">
                Ask to join {refusal.page.name}
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={() => onFindPage(name.trim())} testId="onboarding-create-find">
                Find your page
              </PrimaryButton>
            )}
          </>
        )}
        {refusal.kind === 'cap' && (
          <>
            <p className="text-[15px] text-[var(--fg)]">{CAP_REASON}</p>
            <PrimaryButton onClick={onHome} testId="onboarding-create-home">Back to Home</PrimaryButton>
          </>
        )}
        {refusal.kind === 'invite' && <InviteRequired message={refusal.message} onHome={onHome} />}
        {refusal.kind === 'other' && (
          <>
            <p className="text-[15px] text-[var(--danger)]">{refusal.message}</p>
            <PrimaryButton onClick={() => setRefusal(null)} testId="onboarding-create-retry">Try again</PrimaryButton>
          </>
        )}
      </div>
    );
  }

  if (step === 'name') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (named) onStep('city');
        }}
        className="space-y-[16px]"
        data-testid="onboarding-create-form"
      >
        <Field label="Page name" htmlFor={nameId}>
          <input
            id={nameId}
            data-sheet-autofocus
            value={name}
            maxLength={80}
            onChange={(e) => onName(e.target.value)}
            className={`${FIELD_CLASS} h-[48px]`}
            data-testid="onboarding-create-name"
          />
        </Field>
        <PrimaryButton type="submit" disabled={!named} testId="onboarding-create-next">Next</PrimaryButton>
      </form>
    );
  }

  return (
    <div className="space-y-[12px]" data-testid="onboarding-create-city-step">
      <Card>
        <SummaryRow label="Page name" value={name.trim()} affordance="pencil" onPress={() => onStep('name')} testId="onboarding-create-name-row" />
      </Card>
      <SearchField value={cityQuery} onChange={setCityQuery} aria-label="Search cities" placeholder="Search cities" autoFocusInSheet testId="onboarding-city-search" />
      {busy ? (
        <SkeletonRows count={1} label="Creating your page" />
      ) : cities.isFetching && !cities.data ? (
        <SkeletonRows count={3} label="Searching cities" />
      ) : cities.isError ? (
        <p role="alert" className="text-[14px] text-[var(--danger)]">The city search did not work. Check your connection, then try again.</p>
      ) : cities.data && cities.data.length === 0 ? (
        <p className="text-[14px] text-[var(--mut)]">No city matches. Check the spelling.</p>
      ) : cities.data ? (
        <Card>
          {cities.data.map((c) => (
            <button
              key={c.id}
              type="button"
              className="flex min-h-[52px] w-full items-center gap-[12px] px-[16px] text-left text-[15px] text-[var(--fg)]"
              onClick={() => void create(c.id)}
              data-testid="onboarding-city-option"
            >
              <span className="min-w-0 flex-1 truncate">{c.label}</span>
              <Check aria-hidden="true" className="invisible h-[18px] w-[18px]" />
            </button>
          ))}
        </Card>
      ) : null}
    </div>
  );
}

const SUPPORT_ROW = 'flex min-h-[48px] w-full items-center gap-[12px] rounded-[12px] border border-[var(--line)] px-[16px] text-[15px] text-[var(--fg)]';

/** `organiser_invite_required`: why, the support rows that exist (never a dead link), and Home. No retry. */
function InviteRequired({ message, onHome }: { message: string; onHome: () => void }) {
  const support = supportLinks();
  return (
    <>
      <p className="text-[15px] text-[var(--fg)]" data-testid="onboarding-create-invite">{message}</p>
      {support.whatsapp && (
        <a href={support.whatsapp} target="_blank" rel="noopener noreferrer" className={SUPPORT_ROW} data-testid="onboarding-create-support-whatsapp">
          <MessageCircle aria-hidden="true" className="h-[16px] w-[16px] shrink-0 text-[var(--mut)]" />
          WhatsApp us
        </a>
      )}
      {support.email && (
        <a href={`mailto:${support.email}`} className={SUPPORT_ROW} data-testid="onboarding-create-support-email">
          <Mail aria-hidden="true" className="h-[16px] w-[16px] shrink-0 text-[var(--mut)]" />
          Email us
        </a>
      )}
      {!support.whatsapp && !support.email && (
        <p className="text-[14px] text-[var(--mut)]" data-testid="onboarding-create-support-none">
          Our contact details are not available here yet. Try again a little later.
        </p>
      )}
      <PrimaryButton onClick={onHome} testId="onboarding-create-home">Back to Home</PrimaryButton>
    </>
  );
}

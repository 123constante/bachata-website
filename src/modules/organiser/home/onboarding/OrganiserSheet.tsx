import { useId, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  claimOrganiser,
  createOrganiserProfile,
  requestOrganiserAccess,
  type ClaimCandidate,
} from '@/modules/organiser/shared/selfServeApi';
import { selfServeErrorCopy, type SelfServeErrorCopy } from '@/modules/organiser/shared/selfServeErrors';
import { Card, Field, FIELD_CLASS, PrimaryButton, SearchField, SheetView, SkeletonRows, SummaryRow, useShake } from '../../ui';
import { EmailCode } from './EmailCode';
import { searchCities, type CityResult } from './citySearch';
import { instagramProblem, websiteProblem } from './onboardingModel';

export type SheetTask =
  | { kind: 'claim'; org: ClaimCandidate }
  | { kind: 'request'; org: ClaimCandidate }
  | { kind: 'create'; name: string };

interface Props {
  task: SheetTask | null;
  onTaskChange: (task: SheetTask | null) => void;
  email: string;
  mailboxProven: boolean;
  onDone: (confirmation: string) => void;
}



/**
 * The one sheet behind every onboarding action: claim (with the email-code
 * proof when the session has not proved the mailbox), ask to join, or create
 * (with a city view). Views swap inside it; nothing nests.
 */
export function OrganiserSheet({ task, onTaskChange, email, mailboxProven, onDone }: Props) {
  const [view, setView] = useState<'main' | 'city'>('main');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<SelfServeErrorCopy | null>(null);
  const [note, setNote] = useState('');
  const [form, setForm] = useState({ name: '', city: null as CityResult | null, useMyEmail: true, instagram: '', website: '' });
  const [touched, setTouched] = useState({ instagram: false, website: false });
  const [cityQuery, setCityQuery] = useState('');
  const { shake, shakeProps } = useShake();
  const ids = useId();

  const kind = task?.kind ?? null;
  const orgId = task && task.kind !== 'create' ? task.org.id : null;
  const prefill = task?.kind === 'create' ? task.name : '';

  // A new task starts on its main view; create keeps what was typed, else takes the searched name.
  const taskKey = `${kind ?? ''}:${orgId ?? ''}:${prefill}`;
  const [seenTask, setSeenTask] = useState(taskKey);
  if (seenTask !== taskKey) {
    setSeenTask(taskKey);
    setView('main');
    if (kind === 'create' && !form.name.trim()) setForm({ ...form, name: prefill });
  }

  const cities = useQuery({
    queryKey: ['org-city-search', cityQuery.trim()],
    queryFn: () => searchCities(cityQuery),
    enabled: view === 'city' && cityQuery.trim().length >= 2,
    staleTime: 300_000,
  });

  const close = () => {
    onTaskChange(null);
    setFailure(null);
  };

  const run = async <T,>(action: () => Promise<T>, success: string) => {
    setBusy(true);
    setFailure(null);
    try {
      await action();
      setNote('');
      if (kind === 'create') setForm({ name: '', city: null, useMyEmail: true, instagram: '', website: '' });
      onDone(success);
    } catch (error) {
      const copy = selfServeErrorCopy(error);
      setFailure(copy);
      shake();
      // A refusal meaning "you cannot claim this" turns the claim into a request for the same organiser.
      if (copy.next === 'request_access' && task?.kind === 'claim') onTaskChange({ kind: 'request', org: task.org });
    } finally {
      setBusy(false);
    }
  };

  const claim = (org: ClaimCandidate) => run(() => claimOrganiser(org.id), `${org.name} is yours. You can now manage it.`);
  const request = (org: ClaimCandidate) =>
    run(() => requestOrganiserAccess(org.id, note), `Request sent. The team will check and add you to ${org.name}.`);
  const create = () =>
    run(
      () =>
        createOrganiserProfile({
          name: form.name,
          cityId: form.city?.id ?? '',
          contactEmail: form.useMyEmail ? email : '',
          instagram: form.instagram,
          website: form.website,
        }),
      `${form.name.trim()} is saved as a draft. It is not public until the team approves it.`,
    );

  const instagramError = touched.instagram ? instagramProblem(form.instagram) : null;
  const websiteError = touched.website ? websiteProblem(form.website) : null;
  const createMissing = [!form.name.trim() && 'the organiser name', !form.city && 'the city'].filter(Boolean) as string[];
  const createBlocked = createMissing.length > 0 || !!instagramProblem(form.instagram) || !!websiteProblem(form.website);
  const needsCreateProof = kind === 'create' && failure?.next === 'reauth';

  const error = failure && (
    <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="onboarding-sheet-error">
      {failure.message}
    </p>
  );

  let title = '';
  let body: ReactNode = null;
  let footer: ReactNode = undefined;

  if (task?.kind === 'claim') {
    title = `Claim ${task.org.name}`;
    body = (
      <div {...shakeProps} className={cn('space-y-[12px]', shakeProps.className)}>
        {error}
        {mailboxProven ? (
          <p className="text-[15px] text-[var(--fg)]">
            You&rsquo;re signed in as <strong className="break-all">{email}</strong>, the contact email on this listing. Claim it and you can
            manage its events straight away.
          </p>
        ) : (
          <EmailCode email={email} onProven={() => void claim(task.org)} />
        )}
      </div>
    );
    if (mailboxProven) {
      footer = (
        <PrimaryButton onClick={() => void claim(task.org)} loading={busy} loadingLabel="Claiming" testId="onboarding-claim-confirm">
          Yes, claim it
        </PrimaryButton>
      );
    }
  } else if (task?.kind === 'request') {
    title = `Ask to join ${task.org.name}`;
    body = (
      <div {...shakeProps} className={cn('space-y-[12px]', shakeProps.className)}>
        {error}
        <p className="text-[15px] text-[var(--fg)]">The team checks who you are and adds you, usually within a day.</p>
        <Field label="Tell the team who you are (optional)" htmlFor={`${ids}-note`}>
          <textarea
            id={`${ids}-note`}
            data-sheet-autofocus
            value={note}
            maxLength={500}
            rows={3}
            onChange={(e) => setNote(e.target.value)}
            placeholder="For example: I run the Tuesday classes with Ana"
            className={`${FIELD_CLASS} min-h-[88px] py-[12px]`}
            data-testid="onboarding-request-note"
          />
        </Field>
      </div>
    );
    footer = (
      <PrimaryButton onClick={() => void request(task.org)} loading={busy} loadingLabel="Sending" testId="onboarding-request-send">
        Send request
      </PrimaryButton>
    );
  } else if (task?.kind === 'create' && view === 'city') {
    title = 'City';
    body = (
      <div className="space-y-[12px]">
        <SearchField value={cityQuery} onChange={setCityQuery} aria-label="Search cities" placeholder="Search cities" autoFocusInSheet testId="onboarding-city-search" />
        {cities.isFetching && !cities.data ? (
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
                onClick={() => {
                  setForm((f) => ({ ...f, city: c }));
                  setView('main');
                }}
                data-testid="onboarding-city-option"
              >
                <span className="min-w-0 flex-1 truncate">{c.label}</span>
                {form.city?.id === c.id && <Check aria-hidden="true" className="h-[18px] w-[18px] text-[var(--gold)]" />}
              </button>
            ))}
          </Card>
        ) : null}
      </div>
    );
  } else if (task?.kind === 'create') {
    title = 'New organiser';
    body = (
      <form
        id={`${ids}-create`}
        onSubmit={(e) => {
          e.preventDefault();
          if (!createBlocked && !busy) void create();
        }}
        data-testid="onboarding-create-form"
        {...shakeProps}
        className={cn('space-y-[16px]', shakeProps.className)}
      >
        {error}
        {needsCreateProof && (
          <EmailCode
            email={email}
            onProven={() => {
              setFailure(null);
              void create();
            }}
          />
        )}
        <Field label="Organiser name" htmlFor={`${ids}-name`}>
          <input
            id={`${ids}-name`}
            data-sheet-autofocus
            value={form.name}
            maxLength={80}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={`${FIELD_CLASS} h-[48px]`}
            data-testid="onboarding-create-name"
          />
        </Field>
        <Card>
          <SummaryRow
            icon={<MapPin />}
            label="City"
            value={form.city?.label ?? 'Choose'}
            onPress={() => setView('city')}
            testId="onboarding-create-city"
          />
        </Card>
        <Field
          label="Instagram (optional)"
          htmlFor={`${ids}-ig`}
          help="A handle like @yourhandle, or a full https:// link."
          error={instagramError}
        >
          <input
            id={`${ids}-ig`}
            value={form.instagram}
            placeholder="@yourhandle"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={!!instagramError}
            onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))}
            onBlur={() => setTouched((t) => ({ ...t, instagram: true }))}
            className={`${FIELD_CLASS} h-[48px]`}
            data-testid="onboarding-create-instagram"
          />
        </Field>
        <Field label="Website (optional)" htmlFor={`${ids}-web`} help="Starts with https://" error={websiteError}>
          <input
            id={`${ids}-web`}
            type="url"
            value={form.website}
            placeholder="https://"
            aria-invalid={!!websiteError}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            onBlur={() => setTouched((t) => ({ ...t, website: true }))}
            className={`${FIELD_CLASS} h-[48px]`}
            data-testid="onboarding-create-website"
          />
        </Field>
        <label className="flex min-h-[44px] items-center gap-[12px] text-[14px] text-[var(--fg)]">
          <input
            type="checkbox"
            className="h-[24px] w-[24px] shrink-0 accent-[var(--gold)]"
            checked={form.useMyEmail}
            onChange={(e) => setForm((f) => ({ ...f, useMyEmail: e.target.checked }))}
            data-testid="onboarding-create-use-email"
          />
          <span className="min-w-0 break-words">Show {email || 'my email'} as the contact email</span>
        </label>
        {createMissing.length > 0 && (
          <p className="text-[13px] text-[var(--mut)]" data-testid="onboarding-create-missing">
            To create it, add {createMissing.join(' and ')}.
          </p>
        )}
      </form>
    );
    if (!needsCreateProof) {
      footer = (
        <PrimaryButton
          type="submit"
          form={`${ids}-create`}
          disabled={createBlocked}
          loading={busy}
          loadingLabel="Creating"
          testId="onboarding-create-submit"
        >
          Create organiser
        </PrimaryButton>
      );
    }
  }

  return (
    <SheetView
      open={!!task}
      onOpenChange={(o) => {
        if (!o) close();
      }}
      title={title || 'Organiser'}
      viewKey={`${kind ?? 'none'}:${orgId ?? ''}:${view}`}
      onBack={view === 'city' ? () => setView('main') : undefined}
      fullHeight={kind === 'create'}
      footer={footer}
      testId="onboarding-sheet"
    >
      {body}
    </SheetView>
  );
}

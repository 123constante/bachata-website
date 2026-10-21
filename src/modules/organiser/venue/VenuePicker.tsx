import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus } from 'lucide-react';
import { useVenueOptions, venueOptionsQueryKey, type VenueOption } from '../shared/publicVenues';
import { ErrorState, Field, FIELD_CLASS, GhostButton, PrimaryButton, SearchField, useDebounced } from '../ui';
import { createVenueDraft, draftVenueOption, similarVenues, VenueApiError, type CreatedVenue, type SimilarVenue } from './venueApi';
import { lookupPostcode, mapPinUrl, normalisePostcode, POSTCODE_MESSAGES, type PostcodeFailure, type PostcodeFound, type PostcodeResult } from './postcode';
import { searchVenues } from './venueSearch';

export interface VenuePickerDeps {
  lookup: (postcode: string) => Promise<PostcodeResult>;
  similar: (name: string, postcode: string) => Promise<SimilarVenue[]>;
  create: (name: string, place: PostcodeFound) => Promise<CreatedVenue>;
}
const realDeps: VenuePickerDeps = { lookup: lookupPostcode, similar: similarVenues, create: createVenueDraft };

export interface VenuePickerProps {
  /** Venues to search; defaults to the organiser venue list. */
  options?: readonly VenueOption[];
  onPick: (venue: VenueOption) => void;
  deps?: VenuePickerDeps;
}

type Step = 'search' | 'details' | 'similar' | 'confirm';

const SAVE_ERRORS: Record<VenueApiError['kind'], string> = {
  rate_limited: 'You can add 5 venues a day. Try again tomorrow, or pick an existing venue.',
  unavailable: 'Adding a venue is not available yet. Pick an existing venue for now.',
  refused: 'That venue could not be added. Pick an existing venue, or ask the Bachata Calendar team.',
  failed: 'We could not add that venue. Check your connection and try again.',
};

/** Search venues; "+ Add a new venue" (2+ letters) opens name + postcode, the similar-venue check, then Add venue. */
export function VenuePicker({ options, onPick, deps = realDeps }: VenuePickerProps) {
  const loaded = useVenueOptions();
  const loadedData = loaded.data;
  const all = useMemo(() => options ?? loadedData ?? [], [options, loadedData]);
  const [step, setStep] = useState<Step>('search');
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [postcode, setPostcode] = useState('');
  const [place, setPlace] = useState<PostcodeFound | null>(null);
  const [failure, setFailure] = useState<PostcodeFailure | null>(null);
  const [similar, setSimilar] = useState<SimilarVenue[]>([]);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstStep = useRef(true);

  // Each step unmounts the button that opened it: move focus to the new step's first field or heading.
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    if (step === 'details') nameRef.current?.focus();
    else if (step === 'similar' || step === 'confirm') headingRef.current?.focus();
    else searchRef.current?.focus();
  }, [step]);

  // Details and Dates name the venue from this cache: a venue picked from outside it goes in at once.
  const remember = (venue: VenueOption) => {
    const cached = queryClient.getQueryData<VenueOption[]>(venueOptionsQueryKey);
    if (!cached) void queryClient.invalidateQueries({ queryKey: venueOptionsQueryKey });
    else if (!cached.some((o) => o.id === venue.id)) queryClient.setQueryData<VenueOption[]>(venueOptionsQueryKey, [...cached, venue]);
  };

  const settled = useDebounced(query, options ? 0 : 250);
  const search = useMemo(() => searchVenues(all, settled), [all, settled]);
  // Editing the postcode invalidates an earlier lookup.
  const editPostcode = (value: string) => {
    setPostcode(value);
    setPlace(null);
    setFailure(null);
  };

  const startAdd = () => {
    setName(query.trim());
    setStep('details');
  };

  const findPostcode = async () => {
    setBusy(true);
    setFailure(null);
    const res = await deps.lookup(postcode);
    setBusy(false);
    if ('found' in res) setPlace(res.found);
    else setFailure(res.failure);
  };

  const checkSimilar = async () => {
    if (!place) return;
    setBusy(true);
    let rows: SimilarVenue[] = [];
    try {
      rows = await deps.similar(name, place.postcode);
    } catch {
      rows = []; // the check is advice; the server still refuses an exact duplicate
    }
    setBusy(false);
    setSimilar(rows);
    setStep(rows.length ? 'similar' : 'confirm');
  };

  const pickSimilar = (v: SimilarVenue) => {
    const venue = { id: v.venueId, name: v.name, neighbourhood: null, city_name: null, address: null, postcode: v.postcode };
    remember(venue);
    onPick(venue);
  };

  const add = async () => {
    if (!place) return;
    setBusy(true);
    setSaveError(null);
    try {
      const made = await deps.create(name, place);
      const known = made.existing ? all.find((v) => v.id === made.venueId) : undefined;
      // existing:true carries no name: the similar check returned the stored one, so the typed casing never shows.
      const stored = made.existing ? similar.find((v) => v.venueId === made.venueId)?.name : undefined;
      const venue = known ?? draftVenueOption(made.venueId, stored ?? name, place);
      remember(venue);
      onPick(venue);
    } catch (e) {
      setSaveError(SAVE_ERRORS[e instanceof VenueApiError ? e.kind : 'failed']);
    } finally {
      setBusy(false);
    }
  };

  if (step === 'search') {
    return (
      <div className="space-y-[12px]" data-testid="venue-picker">
        <SearchField ref={searchRef} value={query} onChange={setQuery} aria-label="Search venues" placeholder="Venue name or postcode" testId="venue-search" autoFocusInSheet />
        {loaded.isError && !options && <ErrorState quiet title="Venues did not load" onRetry={() => void loaded.refetch()} testId="venue-load-error" />}
        {search.shape === 'none' && (
          <p className="text-[14px] text-[var(--mut)]" data-testid="venue-none">No venue matches &ldquo;{query.trim()}&rdquo;.</p>
        )}
        {search.results.length > 0 && (
          <ul className="space-y-[8px]" data-testid="venue-results" data-shape={search.shape}>
            {search.results.map((v) => (
              <li key={v.id}>
                <button type="button" onClick={() => onPick(v)} className="flex min-h-[56px] w-full items-center gap-[12px] rounded-[12px] bg-[var(--card2)] px-[12px] text-left">
                  <MapPin aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-semibold text-[var(--fg)]">{v.name}</span>
                    <span className="block truncate text-[13px] text-[var(--mut)]">{[v.neighbourhood ?? v.city_name, v.postcode].filter(Boolean).join(' \u00b7 ')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {search.canAdd && (
          <GhostButton onClick={startAdd} testId="venue-add-new">
            <Plus aria-hidden="true" className="h-[18px] w-[18px]" />
            Add a new venue
          </GhostButton>
        )}
      </div>
    );
  }

  if (step === 'details') {
    const shaped = normalisePostcode(postcode) !== null;
    return (
      <div className="space-y-[12px]" data-testid="venue-details">
        <Field label="Venue name" htmlFor="venue-name">
          <input id="venue-name" ref={nameRef} className={`${FIELD_CLASS} h-[48px]`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Postcode" htmlFor="venue-postcode" error={failure === 'bad' ? POSTCODE_MESSAGES.bad : failure === 'not_found' ? POSTCODE_MESSAGES.not_found : null}>
          <input id="venue-postcode" className={`${FIELD_CLASS} h-[48px] uppercase`} value={postcode} onChange={(e) => editPostcode(e.target.value)} autoComplete="postal-code" />
        </Field>
        {failure === 'offline' && <ErrorState quiet title="Postcode lookup failed" body={POSTCODE_MESSAGES.offline} onRetry={() => void findPostcode()} retrying={busy} testId="postcode-offline" />}
        {place ? (
          <div className="space-y-[8px]" data-testid="postcode-found">
            <p className="text-[14px] text-[var(--fg)]">{[place.address, place.postcode].filter(Boolean).join(', ')}</p>
            <iframe title="Map pin" src={mapPinUrl(place.lat, place.lng)} loading="lazy" className="h-[140px] w-full rounded-[12px] border-0" />
            <PrimaryButton onClick={() => void checkSimilar()} loading={busy} loadingLabel="Checking" disabled={name.trim().length < 2} testId="venue-next">Next</PrimaryButton>
            {name.trim().length < 2 && <p className="text-[13px] text-[var(--mut)]">Venue name needed</p>}
          </div>
        ) : (
          <PrimaryButton onClick={() => void findPostcode()} loading={busy} loadingLabel="Looking up" disabled={!shaped} testId="postcode-find">Look up postcode</PrimaryButton>
        )}
        {!place && !shaped && <p className="text-[13px] text-[var(--mut)]">Full UK postcode needed</p>}
        <GhostButton onClick={() => setStep('search')}>Back to search</GhostButton>
      </div>
    );
  }

  if (step === 'similar') {
    return (
      <div className="space-y-[12px]" data-testid="venue-similar">
        <h3 ref={headingRef} tabIndex={-1} className="text-[16px] font-semibold text-[var(--fg)] outline-none">Is it one of these?</h3>
        <ul className="space-y-[8px]">
          {similar.map((v) => (
            <li key={v.venueId}>
              <button type="button" onClick={() => pickSimilar(v)} className="flex min-h-[56px] w-full flex-col justify-center rounded-[12px] bg-[var(--card2)] px-[12px] text-left" data-testid="similar-venue">
                <span className="text-[16px] font-semibold text-[var(--fg)]">{v.name}</span>
                {v.postcode && <span className="text-[13px] text-[var(--mut)]">{v.postcode}</span>}
              </button>
            </li>
          ))}
        </ul>
        <GhostButton onClick={() => setStep('confirm')} testId="similar-none">No, it&rsquo;s a new venue</GhostButton>
        <GhostButton onClick={() => setStep('details')}>Back</GhostButton>
      </div>
    );
  }

  return (
    <div className="space-y-[12px]" data-testid="venue-confirm">
      <h3 ref={headingRef} tabIndex={-1} className="text-[16px] font-semibold text-[var(--fg)] outline-none">{name.trim()}</h3>
      {place && <p className="text-[14px] text-[var(--mut)]">{[place.address, place.postcode].filter(Boolean).join(', ')}</p>}
      {saveError && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="venue-save-error">{saveError}</p>}
      <PrimaryButton onClick={() => void add()} loading={busy} loadingLabel="Adding" testId="venue-add">Add venue</PrimaryButton>
      <GhostButton onClick={() => setStep('details')}>Back</GhostButton>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus } from 'lucide-react';
import { useVenueOptions, venueOptionsQueryKey, type VenueOption } from '../shared/publicVenues';
import { ErrorState, Field, FIELD_CLASS, GhostButton, PrimaryButton, SearchField, useDebounced } from '../ui';
import { createVenueDraft, draftVenueOption, similarVenues, VenueApiError, type CreatedVenue, type SimilarVenue } from './venueApi';
import { lookupPostcode, mapPinUrl, normalisePostcode, POSTCODE_MESSAGES, type PostcodeFound, type PostcodeResult } from './postcode';
import { addVenueBlock, currentLookup, MIN_NAME_LETTERS, similarKey, type LookupAnswer, type SimilarAnswer } from './addVenue';
import { MIN_ADD_LETTERS, searchVenues } from './venueSearch';

export interface VenuePickerDeps {
  lookup: (postcode: string) => Promise<PostcodeResult>;
  similar: (name: string, postcode: string) => Promise<SimilarVenue[]>;
  create: (name: string, place: PostcodeFound) => Promise<CreatedVenue>;
}
/** Prototype v7 name field `maxlength`. */
const MAX_NAME = 60;
const SIMILAR_DEBOUNCE_MS = 250;
const realDeps: VenuePickerDeps = { lookup: lookupPostcode, similar: similarVenues, create: createVenueDraft };

/**
 * How a venue was picked from the add sheet. `existing`: "Add venue" matched a listed venue (same
 * name + postcode) and picked it instead of creating one: the caller says ALREADY_LISTED. A tapped
 * look-alike sends `existing: false`; a pick from the search list sends no info.
 */
export interface VenuePickInfo {
  existing: boolean;
}

export interface VenuePickerProps {
  /** Venues to search; defaults to the organiser venue list. */
  options?: readonly VenueOption[];
  onPick: (venue: VenueOption, info?: VenuePickInfo) => void;
  deps?: VenuePickerDeps;
}

const SAVE_ERRORS: Record<VenueApiError['kind'], string> = {
  rate_limited: 'You can add 5 venues a day. Try again tomorrow, or pick an existing venue.',
  unavailable: 'Adding a venue is not available yet. Pick an existing venue for now.',
  refused: 'That venue could not be added. Pick an existing venue, or ask the Bachata Calendar team.',
  failed: 'We could not add that venue. Check your connection and try again.',
};

/**
 * Search venues; "+ Add a new venue" (2+ letters) opens ONE sheet (prototype v7): name +
 * postcode, the postcode looked up as soon as it is whole, look-alikes inline, one "Add venue".
 */
export function VenuePicker({ options, onPick, deps = realDeps }: VenuePickerProps) {
  const loaded = useVenueOptions();
  const loadedData = loaded.data;
  const all = useMemo(() => options ?? loadedData ?? [], [options, loadedData]);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [postcode, setPostcode] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [lookup, setLookup] = useState<LookupAnswer | null>(null);
  const [similar, setSimilar] = useState<SimilarAnswer | null>(null);
  // The look-alike key "No, it's a new venue" answered: a new name or postcode asks again.
  const [sureKey, setSureKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const firstView = useRef(true);

  // Switching view unmounts the button that opened it: move focus to the new view's first field.
  useEffect(() => {
    if (firstView.current) {
      firstView.current = false;
      return;
    }
    (adding ? nameRef : searchRef).current?.focus();
  }, [adding]);

  // Details and Dates name the venue from this cache: a venue picked from outside it goes in at once.
  const remember = (venue: VenueOption) => {
    const cached = queryClient.getQueryData<VenueOption[]>(venueOptionsQueryKey);
    if (!cached) void queryClient.invalidateQueries({ queryKey: venueOptionsQueryKey });
    else if (!cached.some((o) => o.id === venue.id)) queryClient.setQueryData<VenueOption[]>(venueOptionsQueryKey, [...cached, venue]);
  };

  const delay = options ? 0 : 250;
  const settled = useDebounced(query, delay);
  const search = useMemo(() => searchVenues(all, settled), [all, settled]);

  // The postcode is looked up as soon as it is whole; an answer for an older postcode is dropped.
  const shaped = adding ? normalisePostcode(postcode) : null;
  // Read deps through a ref: a caller passing them inline must not re-run the calls on every render.
  const depsRef = useRef(deps);
  useEffect(() => {
    depsRef.current = deps;
  });
  useEffect(() => {
    if (!shaped) return;
    let live = true;
    depsRef.current
      .lookup(shaped)
      .catch((): PostcodeResult => ({ ok: false, failure: 'offline' }))
      .then((res) => {
        if (live) setLookup({ postcode: shaped, attempt, found: 'found' in res ? res.found : null, failure: 'found' in res ? null : res.failure });
      });
    return () => {
      live = false;
    };
  }, [shaped, attempt]);

  const answer = currentLookup({ postcode, attempt, lookup });
  const place = answer?.found ?? null;
  // Look-alikes are asked once the name settles; Add waits for the answer to the name on screen.
  // Fixed, not tied to `options`: the look-alike check is a network call whatever list is searched.
  const settledName = useDebounced(name, SIMILAR_DEBOUNCE_MS);
  const askKey = similarKey(settledName, place);
  const askName = settledName.trim();
  const askPostcode = place?.postcode ?? '';
  useEffect(() => {
    if (!askKey) return;
    let live = true;
    depsRef.current
      .similar(askName, askPostcode)
      .catch(() => [] as SimilarVenue[]) // the check is advice; the server still refuses an exact duplicate
      .then((rows) => {
        if (live) setSimilar({ key: askKey, rows });
      });
    return () => {
      live = false;
    };
  }, [askKey, askName, askPostcode]);

  const lookalikes = similar && similar.key === askKey ? similar.rows : [];
  // "No" answers the list ON SCREEN (askKey). Add also needs that list to be for the name typed now.
  const sure = sureKey !== null && sureKey === similarKey(name, place);
  const block = addVenueBlock({ name, postcode, attempt, lookup, similar, sure });

  const startAdd = () => {
    setName(query.trim().slice(0, MAX_NAME));
    setPostcode('');
    setAttempt(0);
    setLookup(null);
    setSimilar(null);
    setSureKey(null);
    setSaveError(null);
    setAdding(true);
  };

  const pickSimilar = (v: SimilarVenue) => {
    const venue = { id: v.venueId, name: v.name, neighbourhood: null, city_name: null, address: null, postcode: v.postcode };
    remember(venue);
    onPick(venue, { existing: false });
  };

  const add = async () => {
    if (!place || block) return;
    setBusy(true);
    setSaveError(null);
    try {
      const made = await deps.create(name, place);
      const known = made.existing ? all.find((v) => v.id === made.venueId) : undefined;
      // existing:true carries no name: the similar check returned the stored one, so the typed casing never shows.
      const stored = made.existing ? lookalikes.find((v) => v.venueId === made.venueId)?.name : undefined;
      const venue = known ?? draftVenueOption(made.venueId, stored ?? name, place);
      remember(venue);
      onPick(venue, { existing: made.existing });
    } catch (e) {
      setSaveError(SAVE_ERRORS[e instanceof VenueApiError ? e.kind : 'failed']);
    } finally {
      setBusy(false);
    }
  };

  if (!adding) {
    const typed = query.trim();
    return (
      <div className="space-y-[12px]" data-testid="venue-picker">
        <SearchField ref={searchRef} value={query} onChange={setQuery} aria-label="Search venues" placeholder="Venue name or postcode" testId="venue-search" autoFocusInSheet />
        {loaded.isError && !options && <ErrorState quiet title="Venues did not load" onRetry={() => void loaded.refetch()} testId="venue-load-error" />}
        {search.shape === 'none' && (
          <p className="text-[14px] text-[var(--mut)]" data-testid="venue-none">
            No venue matches &ldquo;{typed}&rdquo;.{!search.canAdd && ` Type ${MIN_ADD_LETTERS}+ letters to add a venue.`}
          </p>
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

  const failure = answer?.failure ?? null;
  const asking = lookalikes.length > 0 && sureKey !== askKey;
  const trimmed = name.trim();
  return (
    <div className="space-y-[12px]" data-testid="venue-add-sheet">
      <Field label="Venue name" htmlFor="venue-name">
        <input id="venue-name" ref={nameRef} className={`${FIELD_CLASS} h-[48px]`} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} maxLength={MAX_NAME} autoComplete="off" />
      </Field>
      <Field label="Postcode" htmlFor="venue-postcode" error={failure === 'not_found' ? POSTCODE_MESSAGES.not_found : null}>
        <input id="venue-postcode" className={`${FIELD_CLASS} h-[48px] uppercase`} value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="SW12 9HD" disabled={busy} maxLength={10} autoComplete="postal-code" />
      </Field>
      {failure === 'offline' && <ErrorState quiet title="Postcode lookup failed" body={POSTCODE_MESSAGES.offline} onRetry={() => setAttempt((n) => n + 1)} testId="postcode-offline" />}
      {asking && (
        <div className="space-y-[8px]" data-testid="venue-similar" role="group" aria-labelledby="venue-similar-title">
          <p id="venue-similar-title" className="text-[14px] font-semibold text-[var(--fg)]">Is it one of these?</p>
          <ul className="space-y-[8px]">
            {lookalikes.map((v) => (
              <li key={v.venueId}>
                <button type="button" onClick={() => pickSimilar(v)} disabled={busy} className="flex min-h-[56px] w-full flex-col justify-center rounded-[12px] bg-[var(--card2)] px-[12px] text-left" data-testid="similar-venue">
                  <span className="text-[16px] font-semibold text-[var(--fg)]">{v.name}</span>
                  {v.postcode && <span className="text-[13px] text-[var(--mut)]">{v.postcode}</span>}
                </button>
              </li>
            ))}
          </ul>
          <GhostButton onClick={() => setSureKey(askKey)} disabled={busy} testId="similar-none">No, it&rsquo;s a new venue</GhostButton>
        </div>
      )}
      {place && !asking && (
        <div className="space-y-[8px]" data-testid="postcode-found">
          <iframe title="Map pin" src={mapPinUrl(place.lat, place.lng)} loading="lazy" className="h-[140px] w-full rounded-[12px] border-0" />
          <p className="text-[14px] text-[var(--fg)]">
            {trimmed.length >= MIN_NAME_LETTERS && <><b>{trimmed}</b>{' '}</>}
            <span className="text-[var(--mut)]">{[place.area, place.postcode].filter(Boolean).join(', ')}</span>
          </p>
        </div>
      )}
      {saveError && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="venue-save-error">{saveError}</p>}
      <PrimaryButton onClick={() => void add()} loading={busy} loadingLabel="Adding" disabled={!!block} aria-describedby={block ? 'venue-add-reason' : undefined} testId="venue-add">Add venue</PrimaryButton>
      <p id="venue-add-reason" aria-live="polite" className={block ? 'text-[13px] text-[var(--mut)]' : 'sr-only'} data-testid="venue-add-reason">{block ?? ''}</p>
      <GhostButton onClick={() => setAdding(false)} disabled={busy} testId="venue-back">Back to search</GhostButton>
    </div>
  );
}

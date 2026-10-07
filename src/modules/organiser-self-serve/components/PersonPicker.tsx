import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { PEOPLE_SEARCH_MIN, searchPeople, searchPeopleQueryKey, type PersonResult } from '../selfServeApi';
import type { PeopleRole } from '../programmeModel';

/** Typing settles for this long before the search runs. */
export const PEOPLE_SEARCH_DEBOUNCE_MS = 250;

const ROLE_TITLE: Record<PeopleRole, string> = { teaching: 'Add teacher', djing: 'Add DJ' };
const ROLE_PLURAL: Record<PeopleRole, string> = { teaching: 'teachers', djing: 'DJs' };

/** Where a search result stands against the session's draft line-up. */
export type OnSession = 'on' | 'removed' | null;

/**
 * The search VIEW of the line-up sheet: when "Add teacher" / "Add DJ" is tapped
 * the whole sheet becomes this (never a popover), with the input at the top so
 * the keyboard cannot cover it and the results scrolling below. The role is
 * fixed by the button that opened it. organiser_search_people_v1 runs once the
 * typing settles (250ms) on at least 2 characters. Someone already on the
 * session is shown but cannot be picked; someone taken off in this draft can be
 * put back from here. Back (or Escape, handled by the sheet) returns to the list.
 */
export function PersonSearchView({ role, sessionName, statusOf, onPick, onRestore, onBack }: {
  role: PeopleRole;
  sessionName: string;
  statusOf: (profileId: string) => OnSession;
  onPick: (person: PersonResult) => void;
  onRestore: (profileId: string) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim()), PEOPLE_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const enabled = term.length >= PEOPLE_SEARCH_MIN;
  const results = useQuery({
    queryKey: searchPeopleQueryKey(role, term),
    queryFn: () => searchPeople(term, role),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
  // Still typing, or the settled term is being fetched: placeholders in the final layout, not stale rows.
  const settling = query.trim() !== term && query.trim().length >= PEOPLE_SEARCH_MIN;
  const loading = (enabled && (results.isLoading || results.isFetching)) || settling;
  const inputId = `person-search-${role}`;
  const rows = results.data ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="person-picker">
      <div className="flex shrink-0 items-center gap-1 px-2 pr-14 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="person-picker-back"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back<span className="sr-only"> to the line-up</span>
        </button>
        <SheetTitle className="min-w-0 truncate text-base">{ROLE_TITLE[role]}</SheetTitle>
      </div>
      <SheetDescription className="sr-only">Search for {ROLE_PLURAL[role]} by name. Tap a name to add them to {sessionName}.</SheetDescription>

      <div className="shrink-0 px-4 pb-2 pt-1">
        <label htmlFor={inputId} className="sr-only">Search {ROLE_PLURAL[role]} by name</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            ref={inputRef}
            id={inputId}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${ROLE_PLURAL[role]} by name`}
            autoComplete="off"
            maxLength={100}
            className="min-h-[44px] rounded-lg pl-9 text-[16px] md:text-[16px]"
            aria-describedby={`${inputId}-status`}
            data-testid="person-picker-input"
          />
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        aria-busy={loading}
        data-testid="person-picker-results"
      >
        <div id={`${inputId}-status`} role="status" className="text-sm text-muted-foreground">
          {query.trim().length < PEOPLE_SEARCH_MIN ? (
            <p className="py-2" data-testid="person-picker-hint">Type at least 2 letters of their name.</p>
          ) : loading ? (
            <span className="sr-only">Searching&hellip;</span>
          ) : results.isError ? (
            <p className="py-2" data-testid="person-picker-error">The search did not work. Check your connection and try again.</p>
          ) : rows.length === 0 ? (
            <p className="py-2" data-testid="person-picker-empty">No {ROLE_PLURAL[role]} found with that name.</p>
          ) : (
            <span className="sr-only">{rows.length === 1 ? '1 result' : `${rows.length} results`}</span>
          )}
        </div>
        {loading ? (
          <ul aria-hidden="true" className="overflow-hidden rounded-2xl border border-muted-foreground/60 bg-card" data-testid="person-picker-loading">
            {[0, 1, 2].map((i) => (
              <li key={i} className={cn('flex min-h-[56px] items-center gap-3 px-3', i > 0 && 'border-t border-border')} data-testid="person-picker-skeleton">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full motion-reduce:animate-none" />
                <Skeleton className="h-4 flex-1 rounded-lg motion-reduce:animate-none" />
              </li>
            ))}
          </ul>
        ) : !results.isError && rows.length > 0 && query.trim().length >= PEOPLE_SEARCH_MIN ? (
          <ul className="overflow-hidden rounded-2xl border border-muted-foreground/60 bg-card" aria-label={`${ROLE_PLURAL[role]} found`}>
            {rows.map((person, i) => {
              const status = statusOf(person.id);
              return (
                <li key={person.id} className={cn(i > 0 && 'border-t border-border')}>
                  <button
                    type="button"
                    disabled={status === 'on'}
                    aria-describedby={status === 'on' ? `${inputId}-on-${person.id}` : undefined}
                    onClick={() => (status === 'removed' ? onRestore(person.id) : onPick(person))}
                    className={cn(
                      'flex min-h-[56px] w-full items-center gap-3 px-3 py-1.5 text-left text-sm transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none',
                      status === 'on' ? 'cursor-not-allowed' : 'hover:bg-muted active:bg-muted',
                    )}
                    data-testid="person-picker-result"
                  >
                    <PersonAvatar name={person.name} muted={status === 'on'} />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate font-medium', status === 'on' && 'text-muted-foreground')}>{person.name}</span>
                      {person.place && <span className="block truncate text-xs text-muted-foreground">{person.place}</span>}
                    </span>
                    {status === 'on' && (
                      <span id={`${inputId}-on-${person.id}`} className="shrink-0 text-xs text-muted-foreground" data-testid="person-picker-on-session">On this session</span>
                    )}
                    {status === 'removed' && (
                      <span className="shrink-0 text-xs text-muted-foreground" data-testid="person-picker-put-back">Put back</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/** A round initial: the line-up and the search show people the same way. */
export function PersonAvatar({ name, muted = false }: { name: string; muted?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold',
        muted ? 'text-muted-foreground' : 'text-foreground',
      )}
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

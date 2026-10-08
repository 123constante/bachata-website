import { useEffect, useRef, useState, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { PEOPLE_SEARCH_MIN, searchPeople, searchPeopleQueryKey, type PersonResult } from '@/modules/organiser/shared/selfServeApi';
import { PEOPLE_ROLE_LABEL, type PeopleRole } from '@/modules/organiser/shared/programmeModel';

/** Typing settles for this long before the search runs. */
export const PEOPLE_SEARCH_DEBOUNCE_MS = 250;

/**
 * The search that opens under "Add teacher" / "Add DJ" inside the line-up sheet.
 * The role is fixed by the button that opened it; one input, searched once the
 * typing settles and holds at least 2 characters (organiser_search_people_v1
 * refuses less). Someone already on the session is shown but cannot be picked.
 * Escape (handled by the sheet, so the sheet itself stays open) or a tap outside
 * closes it.
 */
export function PersonPicker({ role, isOnSession, onPick, onClose, openerRef }: {
  role: PeopleRole;
  isOnSession: (profileId: string) => boolean;
  onPick: (person: PersonResult) => void;
  onClose: () => void;
  /** The button that opened the picker: a tap on it is not "outside" (it toggles). */
  openerRef: RefObject<HTMLElement>;
}) {
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim()), PEOPLE_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target || boxRef.current?.contains(target) || openerRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('pointerdown', down);
    return () => document.removeEventListener('pointerdown', down);
  }, [onClose, openerRef]);

  const enabled = term.length >= PEOPLE_SEARCH_MIN;
  const results = useQuery({
    queryKey: searchPeopleQueryKey(role, term),
    queryFn: () => searchPeople(term, role),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
  // Still typing, or the settled term is being fetched: show the placeholders, not stale rows.
  const settling = query.trim() !== term && query.trim().length >= PEOPLE_SEARCH_MIN;
  const loading = (enabled && (results.isLoading || results.isFetching)) || settling;
  const label = PEOPLE_ROLE_LABEL[role];
  const inputId = `person-picker-${role}`;

  return (
    <div
      ref={boxRef}
      className="absolute inset-x-0 top-full z-10 mt-2 rounded-md border border-border bg-background p-3 shadow-lg"
      data-testid="person-picker"
    >
      <label htmlFor={inputId} className="sr-only">Search for a {label.toLowerCase()} by name</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          ref={inputRef}
          id={inputId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${label === 'DJ' ? 'DJs' : 'teachers'} by name`}
          autoComplete="off"
          maxLength={100}
          className="min-h-[44px] pl-9 text-[16px] md:text-[16px]"
          data-testid="person-picker-input"
        />
      </div>
      <div className="mt-2 max-h-64 overflow-y-auto" aria-busy={loading}>
        {query.trim().length < PEOPLE_SEARCH_MIN ? (
          <p className="p-2 text-sm text-muted-foreground" data-testid="person-picker-hint">Type at least 2 letters of their name.</p>
        ) : loading ? (
          <ul aria-hidden="true" className="space-y-1" data-testid="person-picker-loading">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex min-h-[44px] items-center gap-3 p-2" data-testid="person-picker-skeleton">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full motion-reduce:animate-none" />
                <Skeleton className="h-4 flex-1 motion-reduce:animate-none" />
              </li>
            ))}
          </ul>
        ) : results.isError ? (
          <p className="p-2 text-sm text-muted-foreground" role="status" data-testid="person-picker-error">The search did not work. Check your connection and try again.</p>
        ) : (results.data ?? []).length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground" role="status" data-testid="person-picker-empty">
            No {label === 'DJ' ? 'DJs' : 'teachers'} found with that name.
          </p>
        ) : (
          <ul className="space-y-1" aria-label={`${label} search results`}>
            {(results.data ?? []).map((person) => {
              const on = isOnSession(person.id);
              return (
                <li key={person.id}>
                  <button
                    type="button"
                    disabled={on}
                    onClick={() => onPick(person)}
                    className={cn(
                      'flex min-h-[44px] w-full items-center gap-3 rounded-md p-2 text-left text-sm transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      on ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted',
                    )}
                    data-testid="person-picker-result"
                  >
                    <PersonAvatar name={person.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{person.name}</span>
                      {person.place && <span className="block truncate text-xs text-muted-foreground">{person.place}</span>}
                    </span>
                    {on && <span className="shrink-0 text-xs text-muted-foreground" data-testid="person-picker-on-session">On this session</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** A round initial: the line-up and the search show people the same way. */
export function PersonAvatar({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

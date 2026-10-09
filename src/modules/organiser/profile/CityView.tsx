import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { searchCities, type CityResult } from '../home/onboarding/citySearch';
import { Card, SearchField, SkeletonRows } from '../ui';

/**
 * The city search, as a VIEW of the Profile page's one field sheet (F1). Same
 * read as the shared CityPicker and the create screen (search_cities via W1's
 * citySearch); the picker itself is a popover, banned here. Typing waits 250ms.
 */
export function CityView({ selectedId, onPick }: { selectedId: string | null; onPick: (city: CityResult) => void }) {
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);
  const cities = useQuery({
    queryKey: ['org-city-search', term],
    queryFn: () => searchCities(term),
    enabled: term.length >= 2,
  });

  let results = null;
  if (term.length < 2) results = <p className="text-[14px] text-[var(--mut)]">Type at least two letters of your city.</p>;
  else if (cities.isFetching && !cities.data) results = <SkeletonRows count={3} label="Searching cities" />;
  else if (cities.isError) results = <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="profile-city-error">The city search did not work. Check your connection, then try again.</p>;
  else if (cities.data && cities.data.length === 0) results = <p className="text-[14px] text-[var(--mut)]" data-testid="profile-city-none">No city matches. Check the spelling.</p>;
  else if (cities.data) {
    results = (
      <Card>
        {cities.data.map((c) => (
          <button
            key={c.id}
            type="button"
            className="flex min-h-[52px] w-full items-center gap-[12px] px-[16px] text-left text-[15px] text-[var(--fg)]"
            onClick={() => onPick(c)}
            data-testid="profile-city-option"
          >
            <span className="min-w-0 flex-1 truncate">{c.label}</span>
            {selectedId === c.id && <Check aria-hidden="true" className="h-[18px] w-[18px] text-[var(--gold)]" />}
          </button>
        ))}
      </Card>
    );
  }

  return (
    <div className="space-y-[12px] p-[16px]">
      <SearchField value={query} onChange={setQuery} aria-label="Search cities" placeholder="Search cities" autoFocusInSheet testId="profile-city-search" />
      {results}
    </div>
  );
}

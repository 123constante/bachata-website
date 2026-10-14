// Edit in place: the City sheet's body. A pick from the city list, never free
// text. The search box is at the TOP and the list scrolls INSIDE the sheet
// (FieldSheet makes the sheet a column for this field), so with the phone
// keyboard up the box stays in view and the rows scroll under it. Rows are 44px.
//
// The list is the organiser area's own city search (search_cities, at least two
// letters: src/modules/organiser/home/onboarding/citySearch.ts, the read the
// organiser Profile's CityView makes, same cache key). That view is styled for
// the organiser area, so this body draws the rows for the public page's sheet.
// A pick is confirmed against the cities table by resolveCanonicalCity, and
// "We will save" shows THAT name.
import { useEffect, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CityLookups } from './cityCheck';
import { CREAM, GOLD } from './parts';

const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontSize: 16, color: CREAM, cursor: 'pointer' };

export default function CitySheetBody({ value, currentName, onPick, searchCities, inputStyle, inputRef, describedBy, labelledBy }: {
  value: string;
  /** The ticked city's name, shown first while the search has not found it. */
  currentName: string | null;
  onPick: (id: string) => void;
  searchCities: CityLookups['searchCities'];
  inputStyle: CSSProperties;
  inputRef: (el: HTMLInputElement | null) => void;
  describedBy?: string;
  labelledBy: string;
}) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);
  const searching = debounced.length >= 2;
  const results = useQuery({
    queryKey: ['org-city-search', debounced],
    queryFn: () => searchCities(debounced),
    enabled: searching,
    staleTime: 5 * 60 * 1000,
  });
  // Before a search: the ticked city, so the sheet opens showing what is stored.
  const shown = searching ? results.data ?? [] : value && currentName ? [{ id: value, label: currentName }] : [];

  return (
    <>
      <input
        type="search"
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
        placeholder="Search for your city"
        aria-label="Search for your city"
        aria-describedby={describedBy}
        enterKeyHint="search"
        autoCapitalize="words"
        autoCorrect="off"
        spellCheck={false}
        className="org-eip-input" style={{ ...inputStyle, flexShrink: 0 }}
      />
      {/* A div, not a fieldset: Chromium will not shrink a fieldset as a flex
          item, so the whole sheet scrolled instead of the list (phone suite). */}
      <div
        role="radiogroup"
        data-testid="eip-city-list"
        aria-labelledby={labelledBy}
        style={{ margin: '8px 0 0', minWidth: 0, flex: '1 1 auto', minHeight: 88, overflowY: 'auto', overscrollBehavior: 'contain' }}
      >
        {!searching && <p style={{ margin: '8px 0', fontSize: 14, color: 'rgba(246,241,234,0.7)' }}>Type at least two letters of your city.</p>}
        {searching && results.isPending && <p role="status" style={{ margin: '8px 0', fontSize: 14, color: 'rgba(246,241,234,0.7)' }}>Searching&hellip;</p>}
        {searching && results.isError && <p role="alert" style={{ margin: '8px 0', fontSize: 14, color: '#FF8A70' }}>The city search did not work. Check your connection, then try again.</p>}
        {searching && results.isSuccess && shown.length === 0 && (
          <p style={{ margin: '8px 0', fontSize: 14, color: 'rgba(246,241,234,0.7)' }}>
            No city matches &ldquo;{debounced}&rdquo;. Check the spelling, or search for the nearest big city.
          </p>
        )}
        {shown.map((c) => (
          <label key={c.id} style={row}>
            <input
              type="radio"
              name={`${labelledBy}-city`}
              value={c.id}
              checked={value === c.id}
              onChange={() => onPick(c.id)}
              style={{ width: 20, height: 20, flexShrink: 0, accentColor: GOLD }}
            />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
          </label>
        ))}
      </div>
    </>
  );
}

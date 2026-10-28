import { useMemo, useState } from 'react';
import { Chip, FIELD_CLASS } from '@/modules/organiser/ui';
import { LANGUAGES, filterLanguages, groupByInitial, selectedLanguages, toggleLanguage } from './languages';

/**
 * Languages: searchable tick list (full ISO 639-1 list), ticked ones as chips above it. The value in and out is
 * the comma text the save path has always taken. Lazy-loaded by EditScreen with its list. Sizes in px (html is ~13.5px on phones).
 */
export default function LanguagePicker({ id, value, onChange }: { id: string; value: string; onChange: (text: string) => void }) {
  const [query, setQuery] = useState('');
  const ticks = useMemo(() => selectedLanguages(value), [value]);
  const tickKeys = useMemo(() => new Set(ticks.map((t) => t.toLowerCase())), [ticks]);
  const groups = useMemo(() => groupByInitial(filterLanguages(query, LANGUAGES)), [query]);
  return (
    <div className="grid gap-[8px]" data-testid={`${id}-picker`}>
      {ticks.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-[8px] p-0" data-testid={`${id}-chips`}>
          {ticks.map((t) => (
            <li key={t}>
              <Chip selected onToggle={() => onChange(toggleLanguage(value, t))} onRemove={() => onChange(toggleLanguage(value, t))} removeLabel={`Remove ${t}`}>
                {t}
              </Chip>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        type="search"
        value={query}
        placeholder="Search languages"
        autoComplete="off"
        aria-label="Search languages"
        onChange={(e) => setQuery(e.target.value)}
        className={`${FIELD_CLASS} min-h-[48px]`}
      />
      <div className="max-h-[320px] overflow-y-auto rounded-[var(--r-chip,8px)] border border-[var(--line-strong)] bg-[var(--card2)]" data-testid={`${id}-list`}>
        {groups.length === 0 ? (
          <p className="m-0 p-[12px] text-[14px] text-[var(--mut)]" data-testid={`${id}-empty`}>
            No language matches &ldquo;{query.trim()}&rdquo;. Check the spelling, or clear the search to see the full list.
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.letter} role="group" aria-label={g.letter}>
              <div className="sticky top-0 bg-[var(--card)] px-[12px] py-[4px] text-[13px] font-semibold text-[var(--mut)]">{g.letter}</div>
              {g.names.map((n) => (
                <label key={n} className="flex min-h-[44px] cursor-pointer items-center gap-[12px] px-[12px] text-[15px] text-[var(--fg)]">
                  <input type="checkbox" className="h-[22px] w-[22px] shrink-0" checked={tickKeys.has(n.toLowerCase())} onChange={() => onChange(toggleLanguage(value, n))} />
                  {n}
                </label>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

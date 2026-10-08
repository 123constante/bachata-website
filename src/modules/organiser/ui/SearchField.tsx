import { forwardRef } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  'aria-label': string;
  placeholder?: string;
  testId?: string;
  /** Focus this field when its SheetView view opens. */
  autoFocusInSheet?: boolean;
}

/** Search input: card2, radius 12, 48px, visible 3:1 border, clear button. */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onChange, placeholder, testId, autoFocusInSheet, ...aria },
  ref,
) {
  return (
    <div className="relative">
      <Search aria-hidden="true" className="pointer-events-none absolute left-[12px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--mut)]" />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={aria['aria-label']}
        placeholder={placeholder}
        data-testid={testId}
        data-sheet-autofocus={autoFocusInSheet || undefined}
        enterKeyHint="search"
        autoComplete="off"
        className="h-[48px] w-full rounded-[12px] border border-[var(--line-strong)] bg-[var(--card2)] pl-[40px] pr-[44px] text-[16px] text-[var(--fg)] outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-0 top-0 flex h-[48px] w-[44px] items-center justify-center text-[var(--mut)]"
        >
          <X aria-hidden="true" className="h-[18px] w-[18px]" />
        </button>
      )}
    </div>
  );
});

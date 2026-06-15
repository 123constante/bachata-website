// =============================================================================
// RafflePhoneInput — country-code picker + digits field.
// Outputs an E.164 string on every change (e.g. "+447700900123").
// No external dep; full world country list (src/lib/countryDialCodes.ts) with
// dance-audience countries pinned at the top; type-to-search filters the list.
//
// Bug fix 2026-06-12: selected country is now held in local state so it
// persists even when the digits field is empty (previously the component was
// fully controlled by the E.164 value, so picking a country with no digits
// emitted '' -> parent stored '' -> prefix match fell back to GB on re-render).
// =============================================================================

import React, { useMemo, useRef, useState } from 'react';
import { COUNTRIES, PINNED, type DialCountry } from '@/lib/countryDialCodes';
import {
  checkLocalDigits,
  isValidE164,
  normalizeLocalDigits,
  type PhoneCheck,
} from '@/lib/phoneRules';

export interface RafflePhoneInputProps {
  value: string;
  onChange: (e164: string, isValid: boolean) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  inputId?: string;
}

const DEFAULT_CODE = 'GB';

function findByPrefix(e164: string): DialCountry | undefined {
  // Longest-dial-first to avoid +1 matching before +1-area-code entries
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  return sorted.find((c) => e164.startsWith(c.dial));
}

function feedbackFor(country: DialCountry, check: PhoneCheck, touched: boolean): {
  text: string;
  tone: 'error' | 'warn';
} | null {
  switch (check.status) {
    case 'short':
      if (!touched) return null;
      return { text: `Looks short &mdash; ${country.name} numbers have ${check.expected}`, tone: 'error' };
    case 'long':
      return { text: `That&rsquo;s too long for a ${country.name} number (${check.expected})`, tone: 'error' };
    case 'warn':
      return { text: check.message, tone: 'warn' };
    default:
      return null;
  }
}

function FlagImg({ code, className }: { code: string; className?: string }) {
  return (
    <img
      src={`https://flagcdn.com/w20/${code.toLowerCase()}.png`}
      width={20}
      height={15}
      alt=""
      loading="lazy"
      className={`inline-block rounded-[2px] ${className ?? ''}`}
    />
  );
}

export const RafflePhoneInput: React.FC<RafflePhoneInputProps> = ({
  value,
  onChange,
  disabled,
  autoFocus,
  inputId,
}) => {
  // Country held in state -- not derived from value -- so selection sticks when digits are empty.
  const [countryCode, setCountryCode] = useState<string>(() => {
    const match = findByPrefix(value);
    return match?.code ?? DEFAULT_CODE;
  });

  const country = useMemo(
    () => COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES.find((c) => c.code === DEFAULT_CODE)!,
    [countryCode],
  );

  // Local digits = value minus the current dial prefix (or empty if mismatch).
  const localDigits = useMemo(() => {
    return value.startsWith(country.dial) ? value.slice(country.dial.length) : '';
  }, [value, country.dial]);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [touched, setTouched] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const check = useMemo(
    () => checkLocalDigits(country.code, country.dial, localDigits),
    [country, localDigits],
  );
  const feedback = feedbackFor(country, check, touched);

  // Ordered list: pinned section first, then rest alphabetical.
  const { pinned, rest } = useMemo(() => {
    const pinnedSet = new Set(PINNED);
    const p = PINNED.map((code) => COUNTRIES.find((c) => c.code === code)!).filter(Boolean);
    const r = COUNTRIES.filter((c) => !pinnedSet.has(c.code)).sort((a, b) => a.name.localeCompare(b.name));
    return { pinned: p, rest: r };
  }, []);

  const q = search.toLowerCase();
  const filterFn = (c: DialCountry) =>
    !q || c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q);
  const filteredPinned = pinned.filter(filterFn);
  const filteredRest = rest.filter(filterFn);

  const emit = (next: DialCountry, nextDigits: string) => {
    const cleaned = normalizeLocalDigits(next.code, nextDigits.replace(/[^0-9]/g, ''));
    const e164 = cleaned.length > 0 ? `${next.dial}${cleaned}` : '';
    const nextCheck = checkLocalDigits(next.code, next.dial, cleaned);
    const valid = (nextCheck.status === 'ok' || nextCheck.status === 'warn') && isValidE164(e164);
    onChange(e164, valid);
  };

  const handleOpen = () => {
    setOpen(true);
    setSearch('');
    // Defer focus so the input is mounted
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  const handleSelectCountry = (code: string) => {
    const next = COUNTRIES.find((c) => c.code === code) ?? country;
    setCountryCode(next.code);
    setOpen(false);
    setSearch('');
    emit(next, localDigits);
  };

  const handleDigitsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    emit(country, e.target.value);
  };

  return (
    <div>
      <div className="flex items-stretch gap-1.5">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={open ? () => setOpen(false) : handleOpen}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            className="h-full min-w-[5rem] rounded-md border border-[rgba(197,148,10,0.3)] bg-black/25 px-2 text-left text-sm text-[#D8CCB0] hover:border-[rgba(245,213,99,0.55)] focus:border-[rgba(245,213,99,0.55)] focus:outline-none disabled:opacity-50"
          >
            <FlagImg code={country.code} className="mr-1" />
            <span className="font-mono text-[11px] text-[#D8CCB0]">{country.dial}</span>
            <span className="ml-1 text-[9px] text-[#A59474]" aria-hidden>&#9660;</span>
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
              <div
                className="absolute top-full left-0 mt-1 z-50 w-72 rounded-md border border-[rgba(197,148,10,0.3)] bg-[#1A2E2A] shadow-2xl flex flex-col"
                style={{ maxHeight: '18rem' }}
              >
                {/* Search box */}
                <div className="p-1.5 border-b border-[rgba(197,148,10,0.2)]">
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
                    placeholder="Search country or code..."
                    className="w-full rounded px-2 py-1 text-xs bg-black/30 border border-[rgba(197,148,10,0.25)] text-[#D8CCB0] placeholder:text-[#6f6757] focus:outline-none focus:border-[rgba(245,213,99,0.55)]"
                  />
                </div>

                {/* Country list */}
                <ul role="listbox" className="overflow-auto flex-1 text-sm">
                  {filteredPinned.length > 0 && (
                    <>
                      {filteredPinned.map((c) => (
                        <CountryRow
                          key={c.code}
                          c={c}
                          selected={c.code === countryCode}
                          onSelect={handleSelectCountry}
                        />
                      ))}
                      {filteredRest.length > 0 && (
                        <li className="border-t border-[rgba(197,148,10,0.2)] my-0.5" aria-hidden />
                      )}
                    </>
                  )}
                  {filteredRest.map((c) => (
                    <CountryRow
                      key={c.code}
                      c={c}
                      selected={c.code === countryCode}
                      onSelect={handleSelectCountry}
                    />
                  ))}
                  {filteredPinned.length === 0 && filteredRest.length === 0 && (
                    <li className="px-3 py-2 text-xs text-[#6f6757]">No results</li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>

        <input
          id={inputId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          autoFocus={autoFocus}
          disabled={disabled}
          value={localDigits}
          onChange={handleDigitsChange}
          onBlur={() => setTouched(true)}
          placeholder="7700 900123"
          className="flex-1 min-w-0 h-10 rounded-md border border-[rgba(197,148,10,0.3)] bg-black/25 px-3 text-sm text-white placeholder:text-[#6f6757] focus:border-[rgba(245,213,99,0.55)] focus:outline-none focus:ring-1 focus:ring-[rgba(245,213,99,0.25)] disabled:opacity-50"
        />
      </div>

      {feedback && (
        <div
          data-testid="raffle-phone-feedback"
          className={`mt-1 text-[11px] ${feedback.tone === 'error' ? 'text-rose-400' : 'text-amber-300'}`}
        >
          {feedback.text}
        </div>
      )}
    </div>
  );
};

const CountryRow: React.FC<{
  c: DialCountry;
  selected: boolean;
  onSelect: (code: string) => void;
}> = ({ c, selected, onSelect }) => (
  <li>
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onMouseDown={(e) => { e.preventDefault(); onSelect(c.code); }}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-black/30 ${
        selected ? 'bg-black/25 text-[#F5D563]' : 'text-[#D8CCB0]'
      }`}
    >
      <img
        src={`https://flagcdn.com/w20/${c.code.toLowerCase()}.png`}
        width={20}
        height={15}
        alt=""
        loading="lazy"
        className="rounded-[2px] shrink-0"
      />
      <span className="flex-1 truncate text-xs">{c.name}</span>
      <span className="font-mono text-[11px] text-[#A59474]">{c.dial}</span>
    </button>
  </li>
);

export { isValidE164 };

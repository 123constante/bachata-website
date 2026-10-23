// =============================================================================
// PhoneInput -- country-code picker + digits field, the ONE phone field.
// Extracted from the raffle's RafflePhoneInput (invite journey W2), which is now
// a thin wrapper around it. Outputs an E.164 string on every change (e.g.
// "+447700900123"); the rule is src/lib/phoneRules.ts (no libphonenumber).
// Full world country list (src/lib/countryDialCodes.ts) with dance-audience
// countries pinned at the top; type-to-search filters the list.
//
// Bug fix 2026-06-12 (kept): the selected country is held in local state so it
// persists even when the digits field is empty.
//
// A stored value that is not E.164 (a legacy number saved without its '+') is
// shown as it is, with a Change button, until the person edits it: nothing is
// emitted, so an untouched legacy value is never re-sent or blocked. "Legacy" is
// decided from the STORED value (the `stored` prop, else the value at mount),
// never from the live draft: a half-typed "+447" is not E.164 either, and
// reading the draft turned the box into "Saved before" after one digit (#977 W2d).
// =============================================================================

import React, { useId, useMemo, useRef, useState } from 'react';
import { COUNTRIES, PINNED, type DialCountry } from '@/lib/countryDialCodes';
import {
  checkLocalDigits,
  isValidE164,
  normalizeLocalDigits,
  normalizePhoneE164,
  type PhoneCheck,
} from '@/lib/phoneRules';
import { cn } from '@/lib/utils';

export type PhoneInputTone = 'app' | 'raffle';

export interface PhoneInputProps {
  /** What the field holds: the stored value at first, then each E.164 the field emitted. */
  value: string;
  /** The value as saved. Only this can be "legacy"; omitted = the value at mount. */
  stored?: string | null;
  onChange: (e164: string, isValid: boolean) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  inputId?: string;
  /** 'app' = the account / organiser look (48px, theme tokens); 'raffle' = the raffle dialog's gold look. */
  tone?: PhoneInputTone;
  feedbackTestId?: string;
  /** A refusal from the server or the form, shown under the field as an alert. */
  error?: string | null;
  /** False when the caller renders `error` itself under the id `<inputId>-error` (the field still points at it). */
  renderError?: boolean;
  /** Show a stored value that is not E.164 as it is, until changed (default true). */
  allowLegacy?: boolean;
  /** Show the grouped number once it is valid (default: app tone). */
  showConfirm?: boolean;
  placeholder?: string;
  /** Show the "looks short" line now, without waiting for the box to be left (the form tried to go on). */
  showShort?: boolean;
}

const DEFAULT_CODE = 'GB';

const BY_DIAL_LENGTH = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

/** Longest-dial-first, so +1 never matches before a longer +1-area-code entry. */
export function findByPrefix(e164: string): DialCountry | undefined {
  return BY_DIAL_LENGTH.find((c) => e164.startsWith(c.dial));
}

/** A stored value the picker cannot open: not E.164 after dropping spaces, or no known dial code. */
export function isLegacyPhone(value: string): boolean {
  if (value.trim() === '') return false;
  const r = normalizePhoneE164(value);
  return !r.ok || !r.value || !findByPrefix(r.value);
}

/** How a valid number reads back: "+44 7700 900123" for the UK, else groups of three. */
export function groupedPhone(country: Pick<DialCountry, 'code' | 'dial'>, digits: string): string {
  if (country.code === 'GB') return `${country.dial} ${digits.slice(0, 4)} ${digits.slice(4)}`.trim();
  return `${country.dial} ${digits.replace(/(\d{3})(?=\d)/g, '$1 ')}`;
}

/** The feedback line: plain words, what to change. Short only after the field is left. */
export function phoneFeedback(country: Pick<DialCountry, 'name' | 'dial'>, check: PhoneCheck, touched: boolean): {
  text: string;
  tone: 'error' | 'warn';
} | null {
  switch (check.status) {
    case 'short':
      if (!touched) return null;
      return { text: `Looks short. ${country.name} numbers have ${check.expected} after ${country.dial}.`, tone: 'error' };
    case 'long':
      return { text: `That is too long for a ${country.name} number (${check.expected}).`, tone: 'error' };
    case 'warn':
      return { text: check.message, tone: 'warn' };
    default:
      return null;
  }
}

const TONE = {
  app: {
    button: 'min-h-[48px] min-w-[5.5rem] rounded-[var(--r-ctl,12px)] border border-[var(--line-strong)] bg-[var(--card2)] px-[10px] text-left text-[15px] text-[var(--fg)] focus-visible:border-[var(--gold)] focus-visible:outline-none disabled:opacity-50',
    dial: 'font-mono text-[14px] text-[var(--fg)]',
    caret: 'ml-1 text-[10px] text-[var(--mut)]',
    menu: 'border border-[var(--line-strong)] bg-[var(--card)]',
    search: 'min-h-[44px] w-full rounded-[8px] border border-[var(--line)] bg-[var(--card2)] px-[10px] text-[16px] text-[var(--fg)] placeholder:text-[var(--ph)] focus:outline-none focus:border-[var(--gold)]',
    divider: 'border-[var(--line)]',
    row: 'min-h-[44px] text-[var(--fg)] hover:bg-[var(--card2)]',
    rowOn: 'bg-[var(--card2)] font-semibold',
    rowDial: 'font-mono text-[13px] text-[var(--mut)]',
    empty: 'text-[13px] text-[var(--mut)]',
    input: 'h-[48px] flex-1 min-w-0 rounded-[var(--r-ctl,12px)] border border-[var(--line-strong)] bg-[var(--card2)] px-[12px] text-[16px] text-[var(--fg)] placeholder:text-[var(--ph)] focus-visible:border-[var(--gold)] focus-visible:outline-none disabled:opacity-50',
    error: 'text-[13px] text-[var(--danger)]',
    warn: 'text-[13px] text-[var(--warn-fg)]',
    ok: 'text-[13px] text-[var(--ok-fg)]',
    mut: 'text-[13px] text-[var(--mut)]',
  },
  raffle: {
    button: 'h-full min-w-[5rem] rounded-md border border-[rgba(197,148,10,0.3)] bg-black/25 px-2 text-left text-sm text-[#D8CCB0] hover:border-[rgba(245,213,99,0.55)] focus:border-[rgba(245,213,99,0.55)] focus:outline-none disabled:opacity-50',
    dial: 'font-mono text-[11px] text-[#D8CCB0]',
    caret: 'ml-1 text-[9px] text-[#A59474]',
    menu: 'border border-[rgba(197,148,10,0.3)] bg-[#1A2E2A]',
    search: 'w-full rounded px-2 py-1 text-xs bg-black/30 border border-[rgba(197,148,10,0.25)] text-[#D8CCB0] placeholder:text-[#6f6757] focus:outline-none focus:border-[rgba(245,213,99,0.55)]',
    divider: 'border-[rgba(197,148,10,0.2)]',
    row: 'min-h-[44px] py-1.5 text-[#D8CCB0] hover:bg-black/30',
    rowOn: 'bg-black/25 text-[#F5D563]',
    rowDial: 'font-mono text-[11px] text-[#A59474]',
    empty: 'text-xs text-[#6f6757]',
    input: 'flex-1 min-w-0 h-[44px] rounded-md border border-[rgba(197,148,10,0.3)] bg-black/25 px-3 text-sm text-white placeholder:text-[#6f6757] focus:border-[rgba(245,213,99,0.55)] focus:outline-none focus:ring-1 focus:ring-[rgba(245,213,99,0.25)] disabled:opacity-50',
    error: 'text-[11px] text-rose-400',
    warn: 'text-[11px] text-amber-300',
    ok: 'text-[11px] text-emerald-300',
    mut: 'text-[11px] text-[#A59474]',
  },
} as const;

function FlagImg({ code, className }: { code: string; className?: string }) {
  // A flag that does not load (weak signal, blocked CDN) is hidden: the dial code already names the country.
  return (
    <img
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
      src={`https://flagcdn.com/w20/${code.toLowerCase()}.png`}
      width={20}
      height={15}
      alt=""
      loading="lazy"
      className={`inline-block rounded-[2px] ${className ?? ''}`}
    />
  );
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  stored,
  onChange,
  disabled,
  autoFocus,
  inputId,
  tone = 'app',
  feedbackTestId = 'phone-feedback',
  error = null,
  renderError = true,
  allowLegacy = true,
  showConfirm,
  placeholder = '7700 900123',
  showShort = false,
}) => {
  const t = TONE[tone];
  const fallbackId = useId();
  const id = inputId ?? fallbackId;
  const confirm = showConfirm ?? tone === 'app';

  // The picker reads the value with spaces, dashes and brackets dropped ("+44 7700 900123" opens as +44).
  const parsed = useMemo(() => {
    const r = normalizePhoneE164(value);
    return r.ok && r.value ? r.value : value;
  }, [value]);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [valueAtMount] = useState(value);
  const saved = stored === undefined ? valueAtMount : (stored ?? '');
  const legacy = allowLegacy && !legacyOpen && value === saved && isLegacyPhone(saved);

  // Country held in state -- not derived from value -- so selection sticks when digits are empty.
  const [countryCode, setCountryCode] = useState<string>(() => findByPrefix(parsed)?.code ?? DEFAULT_CODE);

  const country = useMemo(
    () => COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES.find((c) => c.code === DEFAULT_CODE)!,
    [countryCode],
  );

  // Local digits = value minus the current dial prefix (or empty if mismatch).
  const localDigits = useMemo(
    () => (parsed.startsWith(country.dial) ? parsed.slice(country.dial.length) : ''),
    [parsed, country.dial],
  );

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [touched, setTouched] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const check = useMemo(
    () => checkLocalDigits(country.code, country.dial, localDigits),
    [country, localDigits],
  );
  const feedback = phoneFeedback(country, check, touched || showShort);
  const valid = (check.status === 'ok' || check.status === 'warn') && isValidE164(`${country.dial}${localDigits}`);

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
    onChange(e164, (nextCheck.status === 'ok' || nextCheck.status === 'warn') && isValidE164(e164));
  };

  // A full international number typed or pasted into the digits box ("+44 7700 900123", "0044...")
  // picks its own country, instead of being read as national digits after the current dial code.
  const handleDigitsChange = (text: string) => {
    const intl = text.trim().match(/^(\+|00)(.*)$/);
    if (intl) {
      const e164 = `+${intl[2].replace(/[^0-9]/g, '')}`;
      const match = findByPrefix(e164);
      if (match) {
        setCountryCode(match.code);
        emit(match, e164.slice(match.dial.length));
        return;
      }
    }
    emit(country, text);
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

  const feedbackId = `${id}-feedback`;
  const errorId = `${id}-error`;

  if (legacy) {
    return (
      <div className="space-y-[6px]" data-testid="phone-legacy">
        <div className={cn('flex items-center justify-between gap-[10px] rounded-[12px] border p-[12px]', tone === 'app' ? 'border-[var(--line)]' : t.divider)}>
          <p className={cn('m-0 min-w-0 break-words', tone === 'app' ? 'text-[15px] text-[var(--fg)]' : 'text-sm text-[#D8CCB0]')}>
            Saved before: <b data-testid="phone-legacy-value">{value}</b>
            <span className={cn('block', t.mut)}>No country on this one. It still works; pick the country when you change it.</span>
          </p>
          <button
            type="button"
            data-testid="phone-legacy-change"
            disabled={disabled}
            onClick={() => { setLegacyOpen(true); setTimeout(() => buttonRef.current?.focus(), 0); }}
            className={cn('shrink-0 rounded-[12px] border px-[16px] font-semibold', tone === 'app' ? 'min-h-[44px] border-[var(--line-strong)] text-[15px] text-[var(--fg)]' : 'min-h-[36px] text-sm text-[#D8CCB0]')}
          >
            Change
          </button>
        </div>
        {error && renderError && <p id={errorId} role="alert" data-testid={`${feedbackTestId}-error`} className={cn('m-0', t.error)}>{error}</p>}
      </div>
    );
  }

  const describedBy = [feedback || (confirm && valid) ? feedbackId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <div className="flex items-stretch gap-1.5">
        <div className="relative shrink-0">
          <button
            ref={buttonRef}
            type="button"
            onClick={open ? () => setOpen(false) : handleOpen}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={`Country: ${country.name} ${country.dial}`}
            className={t.button}
          >
            <FlagImg code={country.code} className="mr-1" />
            <span className={t.dial}>{country.dial}</span>
            <span className={t.caret} aria-hidden>&#9660;</span>
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
              <div
                className={cn('absolute top-full left-0 mt-1 z-50 w-72 max-w-[calc(100vw-32px)] rounded-md shadow-2xl flex flex-col', t.menu)}
                style={{ maxHeight: '18rem' }}
              >
                {/* Search box */}
                <div className={cn('p-1.5 border-b', t.divider)}>
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    aria-label="Search country or code"
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
                    placeholder="Search country or code..."
                    className={t.search}
                  />
                </div>

                {/* Country list */}
                <ul role="listbox" aria-label="Countries" className="overflow-auto flex-1 text-sm">
                  {filteredPinned.length > 0 && (
                    <>
                      {filteredPinned.map((c) => (
                        <CountryRow key={c.code} c={c} tone={tone} selected={c.code === countryCode} onSelect={handleSelectCountry} />
                      ))}
                      {filteredRest.length > 0 && <li className={cn('border-t my-0.5', t.divider)} aria-hidden />}
                    </>
                  )}
                  {filteredRest.map((c) => (
                    <CountryRow key={c.code} c={c} tone={tone} selected={c.code === countryCode} onSelect={handleSelectCountry} />
                  ))}
                  {filteredPinned.length === 0 && filteredRest.length === 0 && (
                    <li className={cn('px-3 py-2', t.empty)}>No results</li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>

        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          autoFocus={autoFocus}
          disabled={disabled}
          value={localDigits}
          onChange={(e) => handleDigitsChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          aria-invalid={error || feedback?.tone === 'error' ? true : undefined}
          aria-describedby={describedBy}
          className={t.input}
        />
      </div>

      <div aria-live="polite">
        {feedback ? (
          <div id={feedbackId} data-testid={feedbackTestId} className={cn('mt-1', feedback.tone === 'error' ? t.error : t.warn)}>
            {feedback.text}
          </div>
        ) : confirm && valid ? (
          <div id={feedbackId} data-testid={`${feedbackTestId}-ok`} className={cn('mt-1', t.ok)}>
            <span aria-hidden="true">&#10003; </span>{groupedPhone(country, localDigits)}
          </div>
        ) : null}
      </div>
      {error && renderError && <p id={errorId} role="alert" data-testid={`${feedbackTestId}-error`} className={cn('mt-1 mb-0', t.error)}>{error}</p>}
    </div>
  );
};

const CountryRow: React.FC<{
  c: DialCountry;
  tone: PhoneInputTone;
  selected: boolean;
  onSelect: (code: string) => void;
}> = ({ c, tone, selected, onSelect }) => {
  const t = TONE[tone];
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onMouseDown={(e) => { e.preventDefault(); onSelect(c.code); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(c.code); } }}
        className={cn('w-full flex items-center gap-2 px-2.5 text-left', t.row, selected && t.rowOn)}
      >
        <FlagImg code={c.code} className="shrink-0" />
        <span className="flex-1 truncate text-xs">{c.name}</span>
        <span className={t.rowDial}>{c.dial}</span>
      </button>
    </li>
  );
};

export { isValidE164 };

// =============================================================================
// RafflePhoneInput — lightweight country-code picker + digits.
// Outputs an E.164 string on every change (e.g. "+447700900123").
// No external dep; small curated country list prioritised for the bachata
// audience (UK first, then EU + the main Latin/English markets).
//
// 2026-06-12: per-country digit-length validation (src/lib/phoneRules.ts) with
// inline feedback — winners are contacted on WhatsApp, so a typo'd number
// means an unreachable winner. Trunk zeros people habitually type
// ("07700 900123") are stripped before assembling E.164.
// =============================================================================

import React, { useMemo, useState } from 'react';
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

interface Country {
  code: string;   // ISO 3166-1 alpha-2
  name: string;
  dial: string;   // e.g. "+44"
  flag: string;   // emoji flag
}

// Curated list — the regions we actually get bachata dancers from.
const COUNTRIES: Country[] = [
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'ES', name: 'Spain',          dial: '+34', flag: '🇪🇸' },
  { code: 'FR', name: 'France',         dial: '+33', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy',          dial: '+39', flag: '🇮🇹' },
  { code: 'DE', name: 'Germany',        dial: '+49', flag: '🇩🇪' },
  { code: 'IE', name: 'Ireland',        dial: '+353', flag: '🇮🇪' },
  { code: 'PT', name: 'Portugal',       dial: '+351', flag: '🇵🇹' },
  { code: 'NL', name: 'Netherlands',    dial: '+31', flag: '🇳🇱' },
  { code: 'BE', name: 'Belgium',        dial: '+32', flag: '🇧🇪' },
  { code: 'CH', name: 'Switzerland',    dial: '+41', flag: '🇨🇭' },
  { code: 'AT', name: 'Austria',        dial: '+43', flag: '🇦🇹' },
  { code: 'SE', name: 'Sweden',         dial: '+46', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway',         dial: '+47', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark',        dial: '+45', flag: '🇩🇰' },
  { code: 'FI', name: 'Finland',        dial: '+358', flag: '🇫🇮' },
  { code: 'PL', name: 'Poland',         dial: '+48', flag: '🇵🇱' },
  { code: 'CZ', name: 'Czechia',        dial: '+420', flag: '🇨🇿' },
  { code: 'US', name: 'United States',  dial: '+1',  flag: '🇺🇸' },
  { code: 'CA', name: 'Canada',         dial: '+1',  flag: '🇨🇦' },
  { code: 'MX', name: 'Mexico',         dial: '+52', flag: '🇲🇽' },
  { code: 'DO', name: 'Dominican Rep.', dial: '+1',  flag: '🇩🇴' },
  { code: 'CO', name: 'Colombia',       dial: '+57', flag: '🇨🇴' },
  { code: 'AR', name: 'Argentina',      dial: '+54', flag: '🇦🇷' },
  { code: 'BR', name: 'Brazil',         dial: '+55', flag: '🇧🇷' },
  { code: 'CL', name: 'Chile',          dial: '+56', flag: '🇨🇱' },
  { code: 'PE', name: 'Peru',           dial: '+51', flag: '🇵🇪' },
  { code: 'VE', name: 'Venezuela',      dial: '+58', flag: '🇻🇪' },
  { code: 'AU', name: 'Australia',      dial: '+61', flag: '🇦🇺' },
  { code: 'NZ', name: 'New Zealand',    dial: '+64', flag: '🇳🇿' },
  { code: 'JP', name: 'Japan',          dial: '+81', flag: '🇯🇵' },
];

const DEFAULT_COUNTRY_CODE = 'GB';

function feedbackFor(country: Country, check: PhoneCheck, touched: boolean): {
  text: string;
  tone: 'error' | 'warn';
} | null {
  switch (check.status) {
    case 'short':
      // Don't nag while they're still typing — only after blur.
      if (!touched) return null;
      return { text: `Looks short — ${country.name} numbers have ${check.expected}`, tone: 'error' };
    case 'long':
      // Too long is always wrong — say so immediately.
      return { text: `That's too long for a ${country.name} number (${check.expected})`, tone: 'error' };
    case 'warn':
      return { text: check.message, tone: 'warn' };
    default:
      return null;
  }
}

export const RafflePhoneInput: React.FC<RafflePhoneInputProps> = ({
  value,
  onChange,
  disabled,
  autoFocus,
  inputId,
}) => {
  // Derive country + local-digits from current value, fall back to defaults.
  const { country, localDigits } = useMemo(() => {
    const match = COUNTRIES.find((c) => value.startsWith(c.dial));
    if (match) {
      return { country: match, localDigits: value.slice(match.dial.length) };
    }
    return { country: COUNTRIES.find((c) => c.code === DEFAULT_COUNTRY_CODE)!, localDigits: '' };
  }, [value]);

  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);

  const check = useMemo(
    () => checkLocalDigits(country.code, country.dial, localDigits),
    [country, localDigits],
  );
  const feedback = feedbackFor(country, check, touched);

  const emit = (next: Country, nextDigits: string) => {
    const cleaned = normalizeLocalDigits(next.code, nextDigits.replace(/[^0-9]/g, ''));
    const e164 = cleaned.length > 0 ? `${next.dial}${cleaned}` : '';
    const nextCheck = checkLocalDigits(next.code, next.dial, cleaned);
    // 'warn' still counts as valid — never block a real number on a heuristic.
    const valid = (nextCheck.status === 'ok' || nextCheck.status === 'warn') && isValidE164(e164);
    onChange(e164, valid);
  };

  const handleSelectCountry = (code: string) => {
    const next = COUNTRIES.find((c) => c.code === code) ?? country;
    setOpen(false);
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
            onClick={() => setOpen((v) => !v)}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            className="h-full min-w-[5rem] rounded-md border border-[rgba(197,148,10,0.3)] bg-black/25 px-2 text-left text-sm text-[#D8CCB0] hover:border-[rgba(245,213,99,0.55)] focus:border-[rgba(245,213,99,0.55)] focus:outline-none disabled:opacity-50"
          >
            <span className="text-base mr-1" aria-hidden>{country.flag}</span>
            <span className="font-mono text-[11px] text-[#D8CCB0]">{country.dial}</span>
            <span className="ml-1 text-[9px] text-[#A59474]" aria-hidden>▾</span>
          </button>
          {open && (
            <>
              {/* Click-outside backstop — rendered before the list so list wins pointer priority */}
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
              <ul
                role="listbox"
                className="absolute top-full left-0 mt-1 z-50 max-h-64 w-64 overflow-auto rounded-md border border-[rgba(197,148,10,0.3)] bg-[#1A2E2A] shadow-2xl text-sm"
              >
                {COUNTRIES.map((c) => (
                  <li key={c.code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={c.code === country.code}
                      onClick={() => handleSelectCountry(c.code)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-black/30 ${
                        c.code === country.code ? 'bg-black/25 text-[#F5D563]' : 'text-[#D8CCB0]'
                      }`}
                    >
                      <span className="text-base" aria-hidden>{c.flag}</span>
                      <span className="flex-1 truncate text-xs">{c.name}</span>
                      <span className="font-mono text-[11px] text-[#A59474]">{c.dial}</span>
                    </button>
                  </li>
                ))}
              </ul>
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

export { isValidE164 };

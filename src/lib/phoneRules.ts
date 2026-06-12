// =============================================================================
// phoneRules — pragmatic per-country phone validation for the raffle entry
// form. No libphonenumber (bundle size): national digit-length ranges for the
// curated country list in RafflePhoneInput, with a loose E.164 fallback for
// anything unlisted. Winners are contacted on WhatsApp, so catching a typo'd
// number at the form beats a failed verification later.
//
// `len` ranges are NATIONAL digits typed after the dial code, WITHOUT the
// trunk zero. Countries where people habitually type the leading 0 (e.g.
// "07700 900123" in the UK) have trunkZero=true and the 0 is stripped before
// assembling E.164 — previously that kept the 0 and stored +4407… numbers.
// Only confident entries get tight ranges; everything else stays loose.
// =============================================================================

export interface CountryPhoneRule {
  /** Inclusive national-digit length range (after dial code, no trunk zero). */
  min: number;
  max: number;
  /** Strip one leading 0 from typed digits (trunk prefix not part of E.164). */
  trunkZero: boolean;
}

export const PHONE_RULES: Record<string, CountryPhoneRule> = {
  GB: { min: 10, max: 10, trunkZero: true },
  ES: { min: 9, max: 9, trunkZero: false },
  FR: { min: 9, max: 9, trunkZero: true },
  IT: { min: 9, max: 11, trunkZero: false }, // landlines keep the 0 — never strip
  DE: { min: 9, max: 11, trunkZero: true },
  IE: { min: 9, max: 9, trunkZero: true },
  PT: { min: 9, max: 9, trunkZero: false },
  NL: { min: 9, max: 9, trunkZero: true },
  BE: { min: 8, max: 9, trunkZero: true },
  CH: { min: 9, max: 9, trunkZero: true },
  AT: { min: 9, max: 13, trunkZero: true }, // highly variable — loose
  SE: { min: 7, max: 9, trunkZero: true },
  NO: { min: 8, max: 8, trunkZero: false },
  DK: { min: 8, max: 8, trunkZero: false },
  FI: { min: 8, max: 10, trunkZero: true },
  PL: { min: 9, max: 9, trunkZero: false },
  CZ: { min: 9, max: 9, trunkZero: false },
  US: { min: 10, max: 10, trunkZero: false },
  CA: { min: 10, max: 10, trunkZero: false },
  MX: { min: 10, max: 10, trunkZero: false },
  DO: { min: 10, max: 10, trunkZero: false },
  CO: { min: 10, max: 10, trunkZero: false },
  AR: { min: 10, max: 11, trunkZero: true }, // mobiles dialled with extra 9 from abroad
  BR: { min: 10, max: 11, trunkZero: true },
  CL: { min: 9, max: 9, trunkZero: false },
  PE: { min: 9, max: 9, trunkZero: false },
  VE: { min: 10, max: 10, trunkZero: true },
  AU: { min: 9, max: 9, trunkZero: true },
  NZ: { min: 8, max: 10, trunkZero: true },
  JP: { min: 9, max: 10, trunkZero: true },
};

/** E.164: leading '+', 8–15 digits total. (Moved from RafflePhoneInput.) */
export function isValidE164(e164: string): boolean {
  return /^\+\d{8,15}$/.test(e164);
}

/** Strip exactly one leading trunk zero where the country uses one. */
export function normalizeLocalDigits(isoCode: string, digits: string): string {
  const rule = PHONE_RULES[isoCode];
  if (rule?.trunkZero && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export type PhoneCheck =
  | { status: 'empty' }
  | { status: 'short'; expected: string }
  | { status: 'long'; expected: string }
  | { status: 'warn'; message: string } // non-blocking — counts as valid
  | { status: 'ok' };

function expectedLabel(rule: CountryPhoneRule): string {
  return rule.min === rule.max ? `${rule.min} digits` : `${rule.min}–${rule.max} digits`;
}

/**
 * Validate national digits for a country. `digits` should already be
 * normalized (trunk zero stripped). Unknown ISO codes fall back to the global
 * E.164 8–15 total-length rule. 'ok' and 'warn' both count as submittable.
 */
export function checkLocalDigits(isoCode: string, dial: string, digits: string): PhoneCheck {
  if (digits.length === 0) return { status: 'empty' };

  const dialDigits = dial.replace(/\D/g, '').length;
  const rule = PHONE_RULES[isoCode] ?? {
    min: Math.max(1, 8 - dialDigits),
    max: 15 - dialDigits,
    trunkZero: false,
  };
  // The assembled E.164 must also fit the global 15-digit cap.
  const max = Math.min(rule.max, 15 - dialDigits);
  const expected = expectedLabel({ ...rule, max });

  if (digits.length < rule.min) return { status: 'short', expected };
  if (digits.length > max) return { status: 'long', expected };

  // UK mobiles start with 7 — landlines exist but can't have WhatsApp.
  // Soft warning only: never block a real number on a heuristic.
  if (isoCode === 'GB' && !digits.startsWith('7')) {
    return { status: 'warn', message: 'UK mobiles start with 7 — make sure this number has WhatsApp' };
  }

  return { status: 'ok' };
}

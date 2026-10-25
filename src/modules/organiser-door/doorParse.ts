// BOUNDARY PARSERS for the S5 door's two RPC answers: the only file that reads the server's snake_case keys
// (organiser_id etc.) and maps them to camelCase. Pure; never throws. Contract: admin docs/db-contracts.md.
export type StartCode =
  | 'CREATED' | 'ALREADY_EXISTS' | 'DOOR_CLOSED' | 'NOT_ON_LIST' | 'EMAIL_DOMAIN_NOT_ALLOWED' | 'EMAIL_NOT_VERIFIED'
  | 'ALREADY_HAS_PAGE' | 'NAME_REQUIRED' | 'CITY_REQUIRED' | 'CITY_NOT_FOUND' | 'NOT_SIGNED_IN' | 'INVALID_PAYLOAD'
  | 'PROFILE_INCOMPLETE' | 'NAME_TAKEN' | 'NAME_TOO_LONG' | 'NAME_INVALID' | 'DAILY_LIMIT';

export const START_CODES: readonly StartCode[] = [
  'CREATED', 'ALREADY_EXISTS', 'DOOR_CLOSED', 'NOT_ON_LIST', 'EMAIL_DOMAIN_NOT_ALLOWED', 'EMAIL_NOT_VERIFIED',
  'ALREADY_HAS_PAGE', 'NAME_REQUIRED', 'CITY_REQUIRED', 'CITY_NOT_FOUND', 'NOT_SIGNED_IN', 'INVALID_PAYLOAD',
  'PROFILE_INCOMPLETE', 'NAME_TAKEN', 'NAME_TOO_LONG', 'NAME_INVALID', 'DAILY_LIMIT',
];

export type StartOutcome = {
  /** 'unknown' = a transport failure or a code this client does not know: said kindly, with Try again. */
  code: StartCode | 'unknown';
  organiserId: string | null;
  missing: string[];
};

/** The server's jsonb (or a transport error) -> StartOutcome. Warnings (POSSIBLE_DUPLICATE, LOOKALIKE_UNKNOWN) are dropped on purpose. */
export function parseStartResult(data: unknown, error: unknown): StartOutcome {
  const unknown: StartOutcome = { code: 'unknown', organiserId: null, missing: [] };
  if (error || !data || typeof data !== 'object') return unknown;
  const d = data as Record<string, unknown>;
  const code = typeof d.code === 'string' ? d.code : '';
  if (!(START_CODES as readonly string[]).includes(code)) return unknown;
  return {
    code: code as StartCode,
    organiserId: typeof d.organiser_id === 'string' ? d.organiser_id : null,
    missing: Array.isArray(d.missing) ? d.missing.filter((m): m is string => typeof m === 'string') : [],
  };
}

export type Lookalike = { organiserId: string; name: string; city: string | null; slug: string | null; logoUrl: string | null };
export type LookalikeState =
  | { kind: 'idle' }
  | { kind: 'none' }
  | { kind: 'some'; items: Lookalike[] }
  | { kind: 'rate_limited' }
  | { kind: 'error' };

export const LOOKALIKE_MAX = 5;

export function parseLookalikes(data: unknown, error: unknown): LookalikeState {
  if (error || !data || typeof data !== 'object') return { kind: 'error' };
  const d = data as Record<string, unknown>;
  if (d.code === 'RATE_LIMITED') return { kind: 'rate_limited' };
  if (d.code !== 'OK' && d.success !== true) return { kind: 'error' };
  const items = (Array.isArray(d.items) ? d.items : [])
    .map((row): Lookalike | null => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      if (typeof r.organiser_id !== 'string' || typeof r.name !== 'string') return null;
      return {
        organiserId: r.organiser_id, name: r.name,
        city: typeof r.city === 'string' ? r.city : null,
        slug: typeof r.slug === 'string' ? r.slug : null,
        logoUrl: typeof r.logo_url === 'string' ? r.logo_url : null,
      };
    })
    .filter((x): x is Lookalike => x !== null)
    .slice(0, LOOKALIKE_MAX);
  return items.length > 0 ? { kind: 'some', items } : { kind: 'none' };
}


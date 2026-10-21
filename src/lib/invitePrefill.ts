// The sender's pre-fill (first name, city) for an invited person, carried from the redeem
// landing to the dancer questions (/finish-profile). sessionStorage, this tab only; cleared
// once the profile is saved. Never trusted: the form still validates whatever it shows.

const KEY = 'invite_prefill_v1';

export interface StoredInvitePrefill { firstName: string | null; cityId: string | null }

export function rememberInvitePrefill(p: StoredInvitePrefill | null): void {
  if (!p) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage blocked: the questions simply start empty */
  }
}

export function readInvitePrefill(): StoredInvitePrefill | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Partial<StoredInvitePrefill> | null;
    if (!raw || typeof raw !== 'object') return null;
    const firstName = typeof raw.firstName === 'string' && raw.firstName ? raw.firstName : null;
    const cityId = typeof raw.cityId === 'string' && raw.cityId ? raw.cityId : null;
    return firstName || cityId ? { firstName, cityId } : null;
  } catch {
    return null;
  }
}

export function clearInvitePrefill(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing stored */
  }
}

// The sender's pre-fill (first name, city) for an invited person, carried from the redeem
// landing to the dancer questions (/finish-profile). THE one store for it (Arc 1 F4): only a
// BOUND link redeemed in a proven-mailbox session carries one, and that redeem runs before
// DancerProfileGate, so the questions it answers are not asked. sessionStorage, this tab only.
// It belongs to the person who redeemed it: a read by anyone else drops it, sign-out clears it
// (lib/personScopedStorage), and saving the profile clears it. Never trusted: the questions
// still validate whatever they show.

const KEY = 'invite_prefill_v1';

export interface StoredInvitePrefill { firstName: string | null; cityId: string | null }

/** Replaces whatever is stored; null (no prefill, or not a bound link) clears it, so an old invite's never lingers. */
export function rememberInvitePrefill(p: StoredInvitePrefill | null, userId: string): void {
  if (!p || !userId || !(p.firstName || p.cityId)) {
    clearInvitePrefill();
    return;
  }
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...p, userId }));
  } catch {
    /* storage blocked: the questions simply start empty */
  }
}

/** The prefill for this signed-in person; null (and the store cleared) when it was someone else's. */
export function readInvitePrefill(userId: string | null | undefined): StoredInvitePrefill | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as (Partial<StoredInvitePrefill> & { userId?: unknown }) | null;
    if (!raw || typeof raw !== 'object') return null;
    // No user yet (auth still resolving) is not a different person: leave the store for them.
    if (!userId) return null;
    if (raw.userId !== userId) {
      clearInvitePrefill();
      return null;
    }
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

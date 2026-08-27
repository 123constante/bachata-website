import { describe, expect, it } from 'vitest';
import {
  GUEST_LIST_REASON_MESSAGES,
  SUBMIT_GUEST_LIST_REASONS,
  UNKNOWN_REASON_MESSAGE,
  guestListReasonMessage,
  isKnownGuestListReason,
} from '../guestListReasons';

/**
 * Reason-code parity, Website half.
 *
 * The sibling half lives in the admin repo (tests/guestListReasonParity.test.ts) and reads
 * the server's own reasons out of the committed rpc-body fixture for submit_guest_list_entry.
 * That is the half that notices the SERVER growing a reason. This half guarantees the two
 * properties a client can prove about itself:
 *
 *   1. the map is EXHAUSTIVE over the union it declares, and
 *   2. the lookup is TOTAL — an unknown reason still produces a visible message.
 *
 * (2) is the one that matters. Before P6 the submit hook switched over six reasons with no
 * `default:`, so any reason it did not name rolled the dancer's optimistic pill back in
 * silence. A test that only checked the six known cases would have passed the whole time.
 */

// Pinned deliberately rather than derived from the type: a literal list is what makes
// "someone added a reason and forgot the message" a test failure instead of a type that
// quietly widened. Transcribed from the installed body of public.submit_guest_list_entry
// on 2026-08-27 (migration 20260827210000).
const SERVER_REASONS = [
  'name_required',
  'name_too_long',
  'event_not_found',
  'guest_list_not_enabled',
  'cutoff_passed',
  'capacity_full',
  'duplicate_name',
  'rate_limited',
] as const;

describe('guest list reason map', () => {
  it('declares exactly the server reason union', () => {
    expect([...SUBMIT_GUEST_LIST_REASONS].sort()).toEqual([...SERVER_REASONS].sort());
  });

  it('has a message for every declared reason', () => {
    for (const reason of SUBMIT_GUEST_LIST_REASONS) {
      const message = GUEST_LIST_REASON_MESSAGES[reason];
      expect(message, `no message for ${reason}`).toBeDefined();
      expect(message.title.length, `empty title for ${reason}`).toBeGreaterThan(0);
    }
  });

  it('leaves no reason without a route to the dancer', () => {
    // Every reason either shows a toast or is explicitly claimed by a component. A reason
    // that is neither is the silent-rollback bug wearing a different hat.
    for (const reason of SUBMIT_GUEST_LIST_REASONS) {
      const m = GUEST_LIST_REASON_MESSAGES[reason];
      expect(m.handledByCaller || m.title.length > 0).toBe(true);
    }
    // duplicate_name is the only one a component is allowed to claim, because it renders the
    // collision card instead. If a second reason ever claims this, it needs its own UI.
    const claimed = SUBMIT_GUEST_LIST_REASONS.filter(
      (r) => GUEST_LIST_REASON_MESSAGES[r].handledByCaller,
    );
    expect(claimed).toEqual(['duplicate_name']);
  });

  it('is TOTAL — an unknown reason still gets a message', () => {
    // The regression this file exists for: a server that grows a ninth reason before this
    // build learns about it must still tell the dancer something.
    for (const unknown of ['some_future_reason', '', 'RATE_LIMITED', 'null']) {
      expect(guestListReasonMessage(unknown)).toBe(UNKNOWN_REASON_MESSAGE);
    }
    expect(guestListReasonMessage(null)).toBe(UNKNOWN_REASON_MESSAGE);
    expect(guestListReasonMessage(undefined)).toBe(UNKNOWN_REASON_MESSAGE);
    expect(UNKNOWN_REASON_MESSAGE.title.length).toBeGreaterThan(0);
    expect(UNKNOWN_REASON_MESSAGE.handledByCaller).toBe(false);
  });

  it('resolves known reasons to their own message, not the fallback', () => {
    for (const reason of SUBMIT_GUEST_LIST_REASONS) {
      expect(guestListReasonMessage(reason)).toBe(GUEST_LIST_REASON_MESSAGES[reason]);
      expect(guestListReasonMessage(reason)).not.toBe(UNKNOWN_REASON_MESSAGE);
      expect(isKnownGuestListReason(reason)).toBe(true);
    }
    expect(isKnownGuestListReason('some_future_reason')).toBe(false);
    // Object.prototype keys must not read as known reasons.
    expect(isKnownGuestListReason('constructor')).toBe(false);
    expect(isKnownGuestListReason('toString')).toBe(false);
  });

  it('refetches the list exactly where the rejection implies our cache is stale', () => {
    // capacity_full and cutoff_passed mean the world moved under us; name_too_long does not.
    expect(GUEST_LIST_REASON_MESSAGES.capacity_full.invalidates).toBe(true);
    expect(GUEST_LIST_REASON_MESSAGES.cutoff_passed.invalidates).toBe(true);
    expect(GUEST_LIST_REASON_MESSAGES.guest_list_not_enabled.invalidates).toBe(true);
    expect(GUEST_LIST_REASON_MESSAGES.name_too_long.invalidates).toBe(false);
    expect(GUEST_LIST_REASON_MESSAGES.name_required.invalidates).toBe(false);
    // rate_limited is a client-side throttle, not a stale cache — refetching would just
    // spend another request on a connection we have already been told to slow down.
    expect(GUEST_LIST_REASON_MESSAGES.rate_limited.invalidates).toBe(false);
  });
});

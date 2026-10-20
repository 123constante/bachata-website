// The event as a whole (P-SERIES, PARITY-GAP C28a/C28b/C30b/C38; People arc
// A-WEB1a): which lifecycle rows One event shows, and what Go live lists. The
// go-live RULE is the server's (series_go_live_check_v1, shared/goLiveCheck):
// this file only lays out its answer, in its order. Pure.

import { A1_APPLIED } from '@/modules/organiser/shared/a1Gate';
import { publicEventPath } from '@/modules/organiser/shared/editorGuards';
import {
  goLiveFixHref,
  goLiveLabel,
  profileFieldsLeft,
  profileRowLabel,
  showsProfileRow,
  withReturnTo,
  type GoLiveCheck,
} from '@/modules/organiser/shared/goLiveCheck';
import { PROFILE_WIZARD_PATH } from '@/modules/organiser/shared/profileProgress';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import type { EventWorkspace } from './eventModel';

/** Going live from a draft waits on the admin A1 migration; plain words, no jargon. */
export const A1_REASON = 'Needs the next platform update';
export const SEE_LIVE_DRAFT_REASON = 'Dancers can see it once it is live.';
/** PAR-B B1: a draft with nothing missing, waiting only on A1. The ONE ready sentence. */
export const GO_LIVE_READY = 'Your event is ready. Go live switches on here after the next platform update.';
/** The heading over the server's list. */
export const STILL_NEEDED = 'Still needed to go live';

/** One line of the Go live list: the label from the one map, and the screen that fixes it (null: no screen, no link). */
export interface GoLiveLine { code: string; label: string; href: string | null; recommended: boolean }

export interface GoLiveList {
  /** Blocking items, in the server's order. */
  missing: GoLiveLine[];
  /** Never blocking (the ticket link). */
  recommended: GoLiveLine[];
  /** The ONE profile row, when the profile rule applies and something is left. */
  profile: { label: string; href: string } | null;
}

/**
 * The server's answer as the card's lines. `linked` false (the edit lock is on)
 * leaves the event items without links: they would point at locked controls.
 */
export function goLiveList(check: GoLiveCheck, seriesId: string, linked = true): GoLiveList {
  const line = (recommended: boolean) => ({ code, section }: { code: string; section: string }): GoLiveLine =>
    ({ code, label: goLiveLabel(code), href: linked ? goLiveFixHref(section, seriesId) : null, recommended });
  return {
    missing: check.eventMissing.map(line(false)),
    recommended: check.recommended.map(line(true)),
    profile: showsProfileRow(check)
      ? { label: profileRowLabel(profileFieldsLeft(check)), href: withReturnTo(profileFixPath(check), ORG_PATHS.event(seriesId)) }
      : null,
  };
}

/**
 * The wizard ON the page the server says is incomplete: the first organiser
 * entry of profile_missing with fields left, as `?o=<id>` (the page choice
 * useOrganiserChoice reads; an id the person holds no seat on is ignored
 * there). Without it a multi-page owner, or a 2-organiser series, fixed the
 * page that happened to be selected and Go live stayed blocked.
 */
export function profileFixPath(check: GoLiveCheck): string {
  const page = check.profileMissing.find((p) => p.area === 'organiser' && p.organiserId && p.fields.length > 0)?.organiserId;
  return page ? `${PROFILE_WIZARD_PATH}?o=${encodeURIComponent(page)}` : PROFILE_WIZARD_PATH;
}

/** Where one tap on Go live goes when the event is not ready: the FIRST missing item with a screen, else the profile. */
export function firstFix(list: GoLiveList): string | null {
  return list.missing.find((l) => l.href)?.href ?? list.profile?.href ?? null;
}

/** True when the list holds something that blocks (a recommended item never does). */
export const blocks = (list: GoLiveList) => list.missing.length > 0 || list.profile !== null;

/**
 * What Go live does now. `check` undefined (loading, or the read failed): the
 * button sends and the server decides; a readable refusal then shows the list.
 */
export type GoLiveState =
  | { kind: 'locked'; reason: string }
  | { kind: 'a1'; reason: string }
  | { kind: 'send' }
  | { kind: 'fix'; to: string };

export function goLiveState(check: GoLiveCheck | undefined, seriesId: string, lock: { locked: boolean; reason: string | null }, a1 = A1_APPLIED): GoLiveState {
  if (lock.locked) return { kind: 'locked', reason: lock.reason ?? '' };
  const list = check ? goLiveList(check, seriesId) : null;
  const notReady = !!check && (!check.ready || blocks(list!));
  if (!a1) return { kind: 'a1', reason: check && !notReady ? GO_LIVE_READY : `${A1_REASON}.` };
  // Nothing missing has a screen here (a code this site does not know yet): send, and the refusal shows the list.
  const to = notReady ? firstFix(list!) : null;
  return to ? { kind: 'fix', to } : { kind: 'send' };
}

export type LifecycleRow = { reason: string | null } | null;

export interface LifecycleRows {
  goLive: LifecycleRow;
  discard: LifecycleRow;
  /** The public page: `href` when it can be opened, else the reason. */
  seeLive: { href: string | null; reason: string | null } | null;
}

/**
 * Draft: Go live (what it does comes from goLiveState), Discard (set_lifecycle
 * archived, draft -> archived is an owner transition on prod) and See it live
 * off. Rejected: Go live too (the server gates draft | rejected -> live for the
 * owner, series_go_live_check_v1 decides), See it live off, no Discard (only
 * draft -> archived is known to be allowed). Live: See it live. Paused, ended,
 * archived, pending review: none of the three.
 */
export function lifecycleRows(ws: EventWorkspace, _today?: string): LifecycleRows {
  const status = ws.series.lifecycle_status;
  if (status === 'draft') {
    return { goLive: { reason: null }, discard: { reason: null }, seeLive: { href: null, reason: SEE_LIVE_DRAFT_REASON } };
  }
  if (status === 'rejected') {
    return { goLive: { reason: null }, discard: null, seeLive: { href: null, reason: SEE_LIVE_DRAFT_REASON } };
  }
  if (status === 'live') return { goLive: null, discard: null, seeLive: { href: publicEventPath(ws.series), reason: null } };
  return { goLive: null, discard: null, seeLive: null };
}

// The rebuilt event page (ER-C8). Pure: no React, no network. One place for every
// fact the page shows more than once (the update button, the scope line, the draft
// checklist, the pay nudge, which actions a status offers) and for the commands a
// save sends. Rules come from shared/eventRules.ts; sessions from sessions/sessionsModel.

import {
  lifecycleCommand,
  upsertCommand,
  type OwnerCommand,
} from '@/modules/organiser/shared/seriesCommands';
import {
  blockers,
  formatPaymentMethods,
  parsePaymentMethods,
  sessionKindRules,
  sessionKinds,
  validSessionPair,
  type PaymentCode,
  type RuleSeries,
  type RuleSession,
  type SessionKind,
} from '@/modules/organiser/shared/eventRules';
import { type SessionDraft, newSession, type LevelKey } from '@/modules/organiser/sessions/sessionsModel';
import {
  addPerson,
  addRoleFor,
  addSession,
  allItems,
  differingDates,
  profileTypeOf,
  programCommand,
  removeSession,
  sortSessions,
  updateItem,
  type PItem,
  type PTree,
} from './programmeSeriesModel';
import {
  savePlan,
  stopRepeatingCommand,
  wsComing,
  readIsFull,
  type EventDraft,
  type EventWorkspace,
} from './eventModel';

export type PageStatus = 'draft' | 'live' | 'paused' | 'ended' | 'archived';

/** Ended and archived events cannot change; the page says so and offers nothing. */
export const isClosed = (status: string): boolean => status === 'ended' || status === 'archived';
export const ENDED_LINE = 'Ended events cannot be changed.';

// ---- how it is paid ---------------------------------------------------------

/**
 * The payment codes an event holds. `payment_methods` when the read returns it; a
 * stored ticket link counts as `ticket_link` until the owner picks (51 prod events).
 */
export function paymentOf(ws: EventWorkspace): PaymentCode[] {
  const stored = parsePaymentMethods(ws.paymentMethods);
  if (stored.length) return stored;
  return ws.series.default_ticket_url?.trim() ? ['ticket_link'] : [];
}

export const PAY_NUDGE = 'Add how to pay';
export const PAY_NUDGE_SUB = 'Your page shows no payment line until you add it';

/** The nudge for a live event with no way to pay (16 prod events); null otherwise. */
export const payNudge = (ws: EventWorkspace): string | null =>
  ws.series.lifecycle_status === 'live' && paymentOf(ws).length === 0 ? PAY_NUDGE : null;

// ---- sessions <-> the stored programme --------------------------------------

const kindOfType = (type: string | null): SessionKind | null => {
  if (type === 'show') return 'showcase';
  return sessionKinds.find((k) => sessionKindRules(k)?.storedType === type) ?? null;
};

const levelKeys = (levels: string[]): LevelKey[] => levels as LevelKey[];

/** One stored session as the C4 card edits it; null for a type that is not one of the six kinds. */
export function itemToDraft(it: PItem): SessionDraft | null {
  const kind = kindOfType(it.type);
  if (!kind) return null;
  const base = newSession(kind, it.start || '20:00', it.key);
  return {
    ...base,
    name: it.title || base.name,
    start: it.start,
    end: it.end,
    levels: levelKeys(it.levels),
    people: it.people.map((p) => ({ id: p.profileId, name: p.name })),
  };
}

/** The sessions a series shows, in time order (what the page lists). */
export function sessionsOf(tree: PTree): SessionDraft[] {
  return allItems(sortSessions(tree)).map(itemToDraft).filter((s): s is SessionDraft => s !== null);
}

const sameDraft = (a: SessionDraft, b: SessionDraft) =>
  a.kind === b.kind && a.name === b.name && a.start === b.start && a.end === b.end
  && a.levels.join() === b.levels.join() && a.people.map((p) => p.id).join() === b.people.map((p) => p.id).join();

/**
 * The tree after the page's session list is applied to the stored one. A session
 * that did not change is the stored item untouched (so an untouched Save sends
 * nothing); a changed one patches its item; a new one is added; a missing one goes.
 */
export function applySessions(original: PTree, drafts: SessionDraft[]): PTree {
  let tree = original;
  const before = new Map(allItems(original).map((it) => [it.key, it]));
  const keep = new Set(drafts.map((d) => d.id));
  for (const it of before.values()) if (!keep.has(it.key)) tree = removeSession(tree, it.key);
  for (const d of drafts) {
    const rules = sessionKindRules(d.kind);
    if (!rules) continue;
    const stored = before.get(d.id);
    const patch = (it: PItem): Partial<PItem> => ({
      type: rules.storedType,
      title: d.name.trim() === rules.label ? '' : d.name.trim(),
      start: d.start,
      end: d.end,
      levels: rules.levelAllowed ? d.levels : [],
      people: peopleFor(it, d, rules.storedType),
    });
    if (stored) {
      const was = itemToDraft(stored);
      if (was && sameDraft(was, d)) continue;
      tree = updateItem(tree, stored.key, patch(stored));
    } else {
      const added = addSession(tree, rules.section, rules.storedType);
      tree = updateItem(added.tree, added.key, patch(allItems(added.tree).find((it) => it.key === added.key) as PItem));
    }
  }
  return tree;
}

function peopleFor(it: PItem, d: SessionDraft, type: string): PItem['people'] {
  const role = addRoleFor(type);
  let next = it;
  const have = new Set(it.people.map((p) => p.profileId));
  for (const p of d.people) {
    if (have.has(p.id) || !role) continue;
    next = addPerson(next, { id: p.id, name: p.name, profileType: profileTypeOf(role), role });
  }
  const want = new Set(d.people.map((p) => p.id));
  return next.people.filter((p) => want.has(p.profileId));
}

// ---- the page's draft and what is pending -----------------------------------

export interface PageDraft {
  fields: EventDraft;
  payment: PaymentCode[];
  sessions: SessionDraft[];
}

const sameList = (a: readonly string[], b: readonly string[]) => [...a].sort().join() === [...b].sort().join();

/** Which parts differ; empty when nothing is pending (the Edit bar stays quiet, no Update button). */
export type PendingPart = 'fields' | 'payment' | 'sessions';
export function pendingParts(base: PageDraft, draft: PageDraft, tree: PTree, changedFields: (a: EventDraft, b: EventDraft) => string[]): PendingPart[] {
  const parts: PendingPart[] = [];
  if (changedFields(base.fields, draft.fields).length) parts.push('fields');
  if (!sameList(base.payment, draft.payment)) parts.push('payment');
  if (programCommand(applySessions(tree, draft.sessions), tree)) parts.push('sessions');
  return parts;
}

/** Live: "Update live event". Paused (and a draft being edited): "Save changes". */
export const updateLabel = (status: string): string => (status === 'live' ? 'Update live event' : 'Save changes');

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export interface Scope { updated: number; keeping: number; capped: boolean }

/** How many coming dates a series change reaches, and how many keep their own changes. */
export function scopeOf(ws: EventWorkspace, today: string): Scope {
  const coming = wsComing(ws, today);
  const own = differingDates(ws.dates, today).filter((d) => d.lifecycle_status === 'scheduled').length;
  return { updated: Math.max(coming.length - own, 0), keeping: own, capped: readIsFull(ws, today) };
}

/**
 * The line under the Update button: "Updates 12 coming dates. 2 dates with their own
 * changes keep them." A one-date event says it updates that date. null when no date
 * is coming (a paused or new event: the change simply saves).
 */
export function scopeLine(ws: EventWorkspace, today: string): string | null {
  const s = scopeOf(ws, today);
  if (s.capped) return 'Updates your coming dates.';
  if (s.updated === 0 && s.keeping === 0) return null;
  const head = ws.series.format === 'one_off' ? 'Updates this date.' : `Updates ${plural(s.updated, 'coming date', 'coming dates')}.`;
  const tail = s.keeping ? ` ${plural(s.keeping, 'date', 'dates')} with ${s.keeping === 1 ? 'its' : 'their'} own changes ${s.keeping === 1 ? 'keeps it' : 'keep them'}.` : '';
  return head + tail;
}

export const LEAVE_TITLE = 'Update before you leave?';
export const LEAVE_LINE = 'Your changes are not live yet.';
/** Leaving the page with something pending asks first; nothing pending never does. */
export const shouldPromptLeave = (pending: readonly PendingPart[], busy: boolean): boolean => pending.length > 0 && !busy;

/**
 * The commands a save sends, in order (each against the version the one before
 * returned). Only what changed: an untouched page returns []. A closed event takes none.
 */
export function pageCommands(base: PageDraft, draft: PageDraft, ws: EventWorkspace, today: string, tree: PTree, cityId?: string | null): OwnerCommand[] {
  if (isClosed(ws.series.lifecycle_status)) return [];
  const cmds = savePlan(base.fields, draft.fields, ws, today, cityId);
  if (!sameList(base.payment, draft.payment)) {
    const value = formatPaymentMethods(draft.payment) || null;
    const at = cmds.findIndex((c) => c.kind === 'series.upsert');
    if (at >= 0) cmds[at] = { ...cmds[at], payload: { ...cmds[at].payload, payment_methods: value } };
    else cmds.unshift(upsertCommand({ name: ws.series.name, payment_methods: value }));
  }
  const program = programCommand(applySessions(tree, draft.sessions), tree);
  if (program) cmds.push(program);
  return cmds;
}

// ---- draft: what is still missing -------------------------------------------

export type CheckKey = 'venue' | 'date' | 'session' | 'flyer' | 'pay';
export interface CheckItem { key: CheckKey; done: boolean; done_label: string; fix: string }

const FIX: Record<CheckKey, { done: string; fix: string }> = {
  venue: { done: 'Venue', fix: 'Pick a venue' },
  date: { done: 'Date', fix: 'Pick a date' },
  session: { done: 'Session', fix: 'Add a session' },
  flyer: { done: 'Flyer', fix: 'Add a flyer' },
  pay: { done: 'How to pay', fix: 'Add how to pay' },
};

const ruleSessions = (tree: PTree): RuleSession[] =>
  allItems(tree).map((it) => ({ kind: it.type, start: it.start || null, end: it.end || null }));

export function ruleSeries(ws: EventWorkspace, today: string, tree: PTree): RuleSeries {
  const first = wsComing(ws, today)[0];
  return {
    name: ws.series.name,
    format: ws.series.format,
    venueId: ws.series.default_venue_id,
    payment: paymentOf(ws),
    firstDate: first ? { date: first.occurrence_date, sessions: ruleSessions(tree) } : null,
    today,
  };
}

/** The draft's checklist, in the order a person fixes it; the first undone item is the Publish blocker. */
export function draftChecklist(ws: EventWorkspace, today: string, tree: PTree): CheckItem[] {
  const codes = new Set(blockers(ruleSeries(ws, today, tree)).map((b) => b.code));
  const sessions = ruleSessions(tree);
  const done: Record<CheckKey, boolean> = {
    venue: !codes.has('venue'),
    date: !codes.has('date') && !codes.has('dateInPast'),
    session: sessions.length > 0 && sessions.every((s) => validSessionPair(s.start, s.end).valid) && !codes.has('session') && !codes.has('sessionTimes'),
    flyer: !!ws.series.default_cover_image_url,
    pay: !codes.has('payment') && !codes.has('paymentNotAllowed'),
  };
  return (Object.keys(FIX) as CheckKey[]).map((key) => ({ key, done: done[key], done_label: FIX[key].done, fix: FIX[key].fix }));
}

/** Publish is off with the first thing missing as its reason; null when it can be pressed. */
export function publishBlocker(items: CheckItem[]): CheckItem | null {
  return items.find((i) => !i.done) ?? null;
}

// ---- actions a status offers ------------------------------------------------

export type PageAction = 'pause' | 'end' | 'stop' | 'delete';

/**
 * The quiet actions under the page. A live event can only be paused or ended, never
 * deleted; only a draft is deleted. End, Stop repeating and Delete draft are the owner
 * team's: anyone else on the event only sees Pause. (Leave this event waits on the
 * organiser-invites slice, so no control for it is drawn here.)
 */
export function pageActions(status: string, format: string | null, repeats: boolean, owner: boolean): PageAction[] {
  if (isClosed(status)) return [];
  const stop: PageAction = repeats && format !== 'course' ? 'stop' : 'end';
  if (!owner) return status === 'live' ? ['pause'] : [];
  if (status === 'draft') return ['delete'];
  if (status === 'live') return ['pause', stop];
  if (status === 'paused') return ['end'];
  return [];
}

export const DELETE_DRAFT = lifecycleCommand('archived');

/** "Stop repeating" asks for the last night: the coming dates to pick from (soonest first). */
export const lastNightChoices = (ws: EventWorkspace, today: string) => wsComing(ws, today);

/** Stop repeating after `lastNight`: every coming date up to and including it stays. */
export function stopAfterCommand(ws: EventWorkspace, today: string, lastNight: string): OwnerCommand {
  return stopRepeatingCommand(wsComing(ws, today).filter((d) => d.occurrence_date <= lastNight).map((d) => d.id));
}

export const STOP_REASON = 'Pick the last night';

/** "+ Add a date" is always there on an open event (one-off: only while it has none coming). */
export const canAddDate = (status: string): boolean => status === 'live' || status === 'paused' || status === 'draft';

// ---- the states -------------------------------------------------------------

export type PageState = 'loading' | 'not-found' | 'no-access' | 'error' | 'ready';
export const UPDATE_FAILED = 'The update did not go through. Your changes are still here.';
export const UPDATE_RETRY = 'Try again';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { flags } from '@/lib/featureFlags';
import { FLYER_PROBLEM_COPY, FlyerError, checkFlyerFile, reencodeFlyer, type EncodedFlyer } from '../../shared/flyerModel';
import { parseFlyerRead, type FlyerRead } from './flyerReadShape';
import { applySessionChoices, type DraftFieldKey, type FlyerDraftResult, type NoteLine, type SessionChoice } from './flyerToDraft';
import { blankCreate, buildableKind, withFirstDate, type CreateDraft, type CreateKind } from './model';

/**
 * useFlyerRead: one flyer photo -> the event-flyer-read function -> a typed result. The photo is
 * checked (checkFlyerFile) and ALWAYS re-encoded (reencodeFlyer: about 1 MB, never over 2 MB, so a
 * phone photo fits the function's 5 MB) before it is sent, with the signed-in person's own token
 * (never the anon key). One read at a time. Nothing is saved here.
 */

/** Start from a flyer shows only with all three flags on; off, the kind step is exactly as before. */
export const flyerReaderOn = (): boolean => flags.organiserFlyerReader && flags.organiserP3 && flags.organiserSelfServe;

/** "Monday 09:00" in London, or null when the time is not one. */
export function resetWords(iso: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(t);
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? '';
  return `${get('weekday')} ${get('hour')}:${get('minute')}`;
}

export const FLYER_FUNCTION = 'event-flyer-read';
export const FLYER_REFUSALS = ['daily_limit', 'attempts_limit', 'switched_off', 'not_organiser', 'unauthorised', 'bad_image', 'read_failed'] as const;
export type FlyerRefusal = (typeof FLYER_REFUSALS)[number];

export type FlyerReadResult =
  | { kind: 'read'; read: FlyerRead }
  | { kind: 'refused'; reason: FlyerRefusal; resetsAt: string | null }
  /** The photo itself: wrong type, too big, not a picture (FLYER_PROBLEM_COPY). */
  | { kind: 'problem'; message: string }
  | { kind: 'offline' }
  | { kind: 'error' };

export interface FlyerReadDeps {
  reencode: (file: Blob) => Promise<EncodedFlyer>;
  token: () => Promise<string | null>;
  /** Posts the body with the token; status null = the network failed. */
  post: (body: FlyerPost, token: string, signal: AbortSignal) => Promise<{ status: number | null; body: unknown }>;
  online: () => boolean;
}

export interface FlyerPost { image: string; media_type: string; today: string }

const isRefusal = (v: unknown): v is FlyerRefusal => typeof v === 'string' && (FLYER_REFUSALS as readonly string[]).includes(v);

/** The function's answer -> a result. A refusal word wins; 401 with none is unauthorised. */
export function classifyFlyerAnswer(status: number | null, body: unknown, online: boolean): FlyerReadResult {
  if (status === null) return online ? { kind: 'error' } : { kind: 'offline' };
  const b = (body ?? {}) as Record<string, unknown>;
  const word = [b.error, b.reason, b.code].find(isRefusal);
  if (word) return { kind: 'refused', reason: word, resetsAt: typeof b.resets_at === 'string' ? b.resets_at : null };
  if (status === 401) return { kind: 'refused', reason: 'unauthorised', resetsAt: null };
  if (status < 200 || status >= 300) return { kind: 'error' };
  const read = parseFlyerRead(b.read !== undefined ? b.read : body);
  return read ? { kind: 'read', read } : { kind: 'refused', reason: 'read_failed', resetsAt: null };
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export const browserFlyerDeps: FlyerReadDeps = {
  reencode: (file) => reencodeFlyer(file),
  token: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
  post: async (body, token, signal) => {
    try {
      const { data, error } = await supabase.functions.invoke(FLYER_FUNCTION, { body, headers: { Authorization: `Bearer ${token}` }, signal } as never);
      if (!error) return { status: 200, body: data };
      const ctx = (error as { context?: unknown }).context;
      if (ctx instanceof Response) return { status: ctx.status, body: await ctx.json().catch(() => null) };
      return { status: null, body: null };
    } catch {
      return { status: null, body: null };
    }
  },
  online: () => typeof navigator === 'undefined' || navigator.onLine !== false,
};

export async function readFlyer(file: File, today: string, signal: AbortSignal, deps: FlyerReadDeps = browserFlyerDeps): Promise<FlyerReadResult> {
  const problem = checkFlyerFile(file);
  if (problem) return { kind: 'problem', message: FLYER_PROBLEM_COPY[problem] };
  if (!deps.online()) return { kind: 'offline' };
  let encoded: EncodedFlyer;
  try {
    encoded = await deps.reencode(file);
  } catch (e) {
    return { kind: 'problem', message: FLYER_PROBLEM_COPY[e instanceof FlyerError ? e.problem : 'not_image'] };
  }
  const token = await deps.token().catch(() => null);
  // never the anon key: no signed-in session is a refusal, not a request
  if (!token) return { kind: 'refused', reason: 'unauthorised', resetsAt: null };
  const out = await deps.post({ image: await toBase64(encoded.blob), media_type: encoded.mime, today }, token, signal);
  return classifyFlyerAnswer(out.status, out.body, deps.online());
}

export type FlyerReadState = { s: 'idle' } | { s: 'reading' } | { s: 'done'; result: FlyerReadResult; file: File };

export function useFlyerRead(today: string, deps: FlyerReadDeps = browserFlyerDeps) {
  const [state, setState] = useState<FlyerReadState>({ s: 'idle' });
  const run = useRef<AbortController | null>(null);
  useEffect(() => () => run.current?.abort(), []);
  const start = useCallback(async (file: File) => {
    if (run.current) return; // one read at a time
    const ctl = new AbortController();
    run.current = ctl;
    setState({ s: 'reading' });
    const result = await readFlyer(file, today, ctl.signal, deps).catch((): FlyerReadResult => ({ kind: 'error' }));
    if (run.current !== ctl) return; // cancelled: the answer is dropped
    run.current = null;
    setState({ s: 'done', result, file });
  }, [today, deps]);
  const cancel = useCallback(() => {
    run.current?.abort();
    run.current = null;
    setState({ s: 'idle' });
  }, []);
  return { state, start, cancel, reading: state.s === 'reading' };
}

// ---- the hand-off to the form ------------------------------------------------------------

/** What the form needs besides the draft. Kept in memory only: a reload starts the form without it. */
export interface FlyerHandoff {
  seriesId: string;
  file: File;
  doubtful: DraftFieldKey[];
  venueSaid: string | null;
  sessionChoices: SessionChoice[];
  notes: NoteLine[];
  /** The sessions before any tick (the kind's starters): ticks are applied on these. */
  baseSessions: CreateDraft['sessions'];
  /** The draft as the reader filled it, to see what the organiser changed. */
  initial: CreateDraft;
  filled: DraftFieldKey[];
}

const FALLBACK: Partial<Record<CreateKind, (d: CreateDraft) => CreateKind>> = {
  course: () => 'weekly',
  festival: (d) => (d.extraDates.length ? 'other_dates' : 'one_date'),
};
const KIND_WORD: Partial<Record<CreateKind, string>> = { weekly: 'Weekly', other_dates: 'Other dates', one_date: 'One date' };

/** A kind this flow cannot build yet (course, festival) becomes the nearest one it can, with a note. */
function buildable(r: FlyerDraftResult): FlyerDraftResult {
  const d = r.draft;
  if (buildableKind(d.kind)) return r;
  const to = (FALLBACK[d.kind] ?? (() => 'one_date' as CreateKind))(d);
  let nd = { ...blankCreate(to, d.seriesId), name: d.name, venue: d.venue, prices: d.prices, ticketUrl: d.ticketUrl };
  if (d.firstDate) nd = withFirstDate(nd, d.firstDate);
  if (buildableKind(to)?.when === 'dates') nd = { ...nd, extraDates: d.extraDates };
  const was = d.kind === 'course' ? 'Courses' : 'Festivals';
  return { ...r, draft: nd, notes: [...r.notes, { code: 'kind_fallback', text: `${was} cannot be made here yet, so this starts as ${KIND_WORD[to] ?? 'One date'}.` }] };
}

const sessSig = (d: CreateDraft) => JSON.stringify(d.sessions.map((s) => [s.type, s.title, s.start, s.end]));
/** One comparable value per field the reader can fill. */
export function fieldSig(d: CreateDraft, k: DraftFieldKey): string {
  switch (k) {
    case 'name': return d.name.trim();
    case 'venue': return d.venue?.id ?? '';
    case 'firstDate': return d.firstDate;
    case 'extraDates': return d.extraDates.join(',');
    case 'sessions': return sessSig(d);
    case 'prices': return JSON.stringify(d.prices.map((p) => [p.name, p.price, p.currency]));
    case 'ticketUrl': return d.ticketUrl.trim();
  }
}
const KEYS: readonly DraftFieldKey[] = ['name', 'venue', 'firstDate', 'extraDates', 'sessions', 'prices', 'ticketUrl'];

/** flyerToDraft's result -> the starting draft (ticked sessions in, ticket link shown) and the form's hand-off. */
export function flyerHandoff(result: FlyerDraftResult, file: File): { draft: CreateDraft; handoff: FlyerHandoff } {
  const r = buildable(result);
  const baseSessions = r.draft.sessions;
  let draft = applySessionChoices(r.draft, r.sessionChoices);
  // the ticket link field shows only with "ticket link" as a way to pay (sheets.tsx PriceSheet)
  if (draft.ticketUrl && !draft.pay.includes('ticket_link')) draft = { ...draft, pay: [...draft.pay, 'ticket_link'] };
  const blank = blankCreate(draft.kind, draft.seriesId);
  const filled = KEYS.filter((k) => fieldSig(draft, k) !== fieldSig(blank, k));
  return {
    draft,
    handoff: { seriesId: draft.seriesId, file, doubtful: r.doubtful, venueSaid: r.venueSaid, sessionChoices: r.sessionChoices, notes: r.notes, baseSessions, initial: draft, filled },
  };
}

/** The filled fields the organiser changed before saving: field names only, never flyer text. */
export const changedFields = (h: FlyerHandoff, d: CreateDraft): DraftFieldKey[] => h.filled.filter((k) => fieldSig(d, k) !== fieldSig(h.initial, k));

/** Measure, do not ask: what the reader filled and what the organiser changed, as field names only. */
export function recordFlyerSave(h: FlyerHandoff, d: CreateDraft): void {
  trackAnalyticsEvent('flyer_read_saved', {
    flyer_read_filled: [...h.filled],
    flyer_read_changed: changedFields(h, d),
  });
}

let pending: FlyerHandoff | null = null;
export const keepFlyerHandoff = (h: FlyerHandoff) => { pending = h; };
/** The hand-off for this draft, or null (another draft, or a reload). */
export const flyerHandoffFor = (seriesId: string): FlyerHandoff | null => (pending && pending.seriesId === seriesId ? pending : null);
/** Forgets the flyer (the file was never uploaded: nothing to delete). */
export const forgetFlyerHandoff = () => { pending = null; };

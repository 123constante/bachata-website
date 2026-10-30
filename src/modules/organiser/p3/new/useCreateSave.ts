import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ORGANISER_HOME_KEY, fetchSeriesWorkspace, runSeriesCommand, type HomeOrganiser } from '../../shared/selfServeApi';
import { envelope, newIdempotencyKey } from '../../shared/seriesCommands';
import { commandErrorMessage, isOnboardingRefusal } from '../../shared/selfServeErrors';
import { resolveCreateCityId } from '../../shared/createCity';
import { uploadEventPicture } from '../../events/media';
import { profileQuestionsLeft } from '../../home/onboarding/golive/profileLeft';
import { repeatFailure } from '../model/repeat';
import { removeCommand } from '../data/eventPage';
import { P3_PATHS } from '../shell/paths';
import { DRAFT_STORE_KEY, RESULT_COPY, savePlan, type CreateDraft, type StepKey } from './model';

/**
 * Runs the save plan (model.savePlan), one series_command_p5 per step, each against the version
 * the previous one returned (the create against none: it names a row that does not exist yet).
 * Every step keeps ONE idempotency key for the life of the screen, so Try again after a lost
 * reply replays instead of writing twice, and a step that landed is never sent again.
 *
 * Once the create has landed the draft exists: a later failure says what did not save, and offers
 * Try again (the remaining steps), Open the draft and Discard it (archived, removeCommand).
 */

export type SaveState =
  | { s: 'idle' }
  | { s: 'busy'; at: StepKey }
  /** Nothing exists on the server (the photo or the create failed). */
  | { s: 'failed'; message: string; onboarding: boolean }
  /** The draft exists; these steps did not land. */
  | { s: 'partial'; message: string; left: StepKey[] }
  /** The draft is saved; going live waits on the profile questions (P3's Review). */
  | { s: 'details' }
  | { s: 'discarding' }
  | { s: 'discardFailed' };

export function forgetStoredDraft() {
  try { window.sessionStorage.removeItem(DRAFT_STORE_KEY); } catch { /* storage off: nothing kept */ }
}

/** Review 1 F1: once the create lands, the kept draft says so, so a remount opens that draft instead of creating it again. */
function rememberCreated(draft: CreateDraft) {
  try { window.sessionStorage.setItem(DRAFT_STORE_KEY, JSON.stringify({ ...draft, created: true })); } catch { /* storage off */ }
}

/** The URL param that names a draft whose create landed (review 2 R2-2): only this screen, opened again, goes to it. */
export const LANDED_PARAM = 'sid';

export function useCreateSave({ draft, cover, organiser, today, onCreated }: {
  draft: CreateDraft; cover: File | null; organiser: HomeOrganiser | null; today: string;
  /** The create landed: the screen keeps `created` in its draft (review 2 R2-1). */
  onCreated?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const keys = useRef(new Map<string, string>());
  const done = useRef(new Set<StepKey>());
  const version = useRef<number | null>(null);
  const coverUrl = useRef<string | null>(null);
  const cityId = useRef<string | null | undefined>(undefined);
  // review 1: one save at a time (F4), the Go live a retry repeats (F3), the version to read again after a failure (F6)
  const inFlight = useRef(false);
  const lastGoLive = useRef(false);
  const stale = useRef(false);
  const [state, setState] = useState<SaveState>({ s: 'idle' });
  const [coverUploaded, setCoverUploaded] = useState(false);
  const seriesId = draft.seriesId;
  const created = () => done.current.has('create');

  const keyFor = (sig: string) => {
    let key = keys.current.get(sig);
    if (!key) { key = newIdempotencyKey(); keys.current.set(sig, key); }
    return key;
  };

  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY }); };

  /** The series' version as the server has it now (a lost reply, a reply without new_version, a retry). Only THIS series counts (R2-3). */
  const reread = async () => {
    const ws = await fetchSeriesWorkspace(seriesId);
    if (!ws?.series?.id || ws.series.id !== seriesId) throw new Error('series not found');
    version.current = ws.series.version;
  };

  /** The create landed: mark it in storage, in the screen's draft and in this screen's URL (a reload opens the draft, R2-2). */
  const landed = () => {
    done.current.add('create');
    rememberCreated(draft);
    onCreated?.();
    const q = new URLSearchParams(location.search);
    q.set(LANDED_PARAM, seriesId);
    navigate(`${location.pathname}?${q.toString()}`, { replace: true });
  };

  const run = async (goLive: boolean): Promise<void> => {
    if (!organiser || inFlight.current) return;
    const hasCover = !!cover || !!coverUrl.current;
    const base = { organiserId: organiser.id, today, hasCover, goLive };
    const probe = savePlan(draft, { ...base, coverUrl: coverUrl.current, cityId: cityId.current ?? null });
    if (!probe.length) {
      // Untouched, blocked, or Go live off: nothing is sent. A draft that exists is finished on its page (R2-5).
      if (created()) {
        forgetStoredDraft();
        navigate(P3_PATHS.event(seriesId), { replace: true, state: { p3Toast: RESULT_COPY.finishThere } });
      }
      return;
    }
    inFlight.current = true;
    lastGoLive.current = goLive;
    // R2-4: until a step runs, a failure is about the first step not saved yet (never "the photo" by default)
    let left: StepKey[] = probe.filter((p) => !done.current.has(p.key)).map((p) => p.key);
    let at: StepKey = left[0] ?? 'cover';
    let plan: ReturnType<typeof savePlan> = probe;
    setState({ s: 'busy', at });
    try {
      if (created() && stale.current) {
        await reread();
        stale.current = false;
      }
      if (hasCover && !coverUrl.current && cover) {
        at = 'cover';
        coverUrl.current = await uploadEventPicture(seriesId, cover);
        setCoverUploaded(true);
      }
      done.current.add('cover');
      if (cityId.current === undefined) {
        try {
          cityId.current = await resolveCreateCityId({ venueCityName: draft.venue?.cityName ?? null, organiserCityId: organiser.city_id ?? null });
        } catch {
          cityId.current = organiser.city_id ?? null;
        }
      }
      plan = savePlan(draft, { ...base, coverUrl: coverUrl.current, cityId: cityId.current ?? null });
      left = plan.filter((p) => !done.current.has(p.key)).map((p) => p.key);
      for (const step of plan) {
        if (done.current.has(step.key) || !step.command) continue;
        at = step.key;
        if (step.key === 'live' && (await profileQuestionsLeft(seriesId))) {
          refresh();
          setState({ s: 'details' });
          return;
        }
        setState({ s: 'busy', at });
        const key = keyFor(`${step.key}|${JSON.stringify(step.command)}`);
        const res = await runSeriesCommand(envelope(seriesId, step.key === 'create' ? null : version.current, step.command, key));
        if (step.key === 'create') landed();
        done.current.add(step.key);
        left = left.filter((k) => k !== step.key);
        if (typeof res?.new_version === 'number') version.current = res.new_version;
        else await reread();
      }
      forgetStoredDraft();
      refresh();
      navigate(P3_PATHS.event(seriesId), { replace: true, state: { p3Toast: goLive ? RESULT_COPY.live : RESULT_COPY.savedDraft } });
    } catch (e) {
      const message = at === 'cover' ? (e instanceof Error ? e.message : commandErrorMessage(e)) : at === 'repeat' ? repeatFailure(e) : commandErrorMessage(e);
      // F2: the create may have landed with its reply lost. If the row is there, it is a draft that needs finishing.
      if (at === 'create' && !created() && !isOnboardingRefusal(e)) {
        try {
          await reread();
          landed();
          left = plan.filter((p) => !done.current.has(p.key)).map((p) => p.key);
        } catch { /* no row: nothing was saved */ }
      }
      if (!created()) setState({ s: 'failed', message, onboarding: isOnboardingRefusal(e) });
      else {
        stale.current = true;
        refresh();
        setState({ s: 'partial', message, left: left.length ? left : [at] });
      }
    } finally {
      inFlight.current = false;
    }
  };

  /** Try again after a partial save: the same request, Go live included when it was asked (F3). */
  const retry = () => run(lastGoLive.current);

  /** The draft is archived (draft -> archived is an owner move); hard delete is the team's. */
  const discard = async (): Promise<void> => {
    if (!created() || inFlight.current) return;
    inFlight.current = true;
    setState({ s: 'discarding' });
    try {
      // F6: after a failure the version may have moved; read it, and go on with ours when the read fails
      if (stale.current) await reread().catch(() => undefined);
      const command = removeCommand();
      const res = await runSeriesCommand(envelope(seriesId, version.current, command, keyFor(`discard|${JSON.stringify(command)}`)));
      if (typeof res?.new_version === 'number') version.current = res.new_version;
      forgetStoredDraft();
      refresh();
      navigate(P3_PATHS.events, { replace: true, state: { p3Toast: RESULT_COPY.discarded } });
    } catch {
      stale.current = true;
      setState({ s: 'discardFailed' });
    } finally {
      inFlight.current = false;
    }
  };

  /** A new photo picked before the create: the next save uploads it instead of the old one. */
  const forgetCover = () => {
    if (created()) return;
    coverUrl.current = null;
    done.current.delete('cover');
    setCoverUploaded(false);
  };

  return { state, run, retry, discard, forgetCover, coverUploaded };
}

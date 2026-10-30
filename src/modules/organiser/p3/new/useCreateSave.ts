import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

export function useCreateSave({ draft, cover, organiser, today }: { draft: CreateDraft; cover: File | null; organiser: HomeOrganiser | null; today: string }) {
  const navigate = useNavigate();
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

  /** The series' version as the server has it now (a lost reply, a reply without new_version, a retry). */
  const reread = async () => { version.current = (await fetchSeriesWorkspace(seriesId)).series.version; };

  const run = async (goLive: boolean): Promise<void> => {
    if (!organiser || inFlight.current) return;
    const hasCover = !!cover || !!coverUrl.current;
    const base = { organiserId: organiser.id, today, hasCover, goLive };
    // Untouched, blocked, or Go live off: nothing is sent.
    if (!savePlan(draft, { ...base, coverUrl: coverUrl.current, cityId: null }).length) return;
    inFlight.current = true;
    lastGoLive.current = goLive;
    let at: StepKey = 'cover';
    let left: StepKey[] = [];
    let plan: ReturnType<typeof savePlan> = [];
    setState({ s: 'busy', at });
    try {
      if (created() && stale.current) {
        await reread();
        stale.current = false;
      }
      if (hasCover && !coverUrl.current && cover) {
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
        done.current.add(step.key);
        if (step.key === 'create') rememberCreated(draft);
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
          done.current.add('create');
          rememberCreated(draft);
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

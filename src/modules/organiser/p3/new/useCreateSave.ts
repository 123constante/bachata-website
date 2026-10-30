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

export function useCreateSave({ draft, cover, organiser, today }: { draft: CreateDraft; cover: File | null; organiser: HomeOrganiser | null; today: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const keys = useRef(new Map<string, string>());
  const done = useRef(new Set<StepKey>());
  const version = useRef<number | null>(null);
  const coverUrl = useRef<string | null>(null);
  const cityId = useRef<string | null | undefined>(undefined);
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

  const run = async (goLive: boolean): Promise<void> => {
    if (!organiser || state.s === 'busy' || state.s === 'discarding') return;
    const hasCover = !!cover || !!coverUrl.current;
    const base = { organiserId: organiser.id, today, hasCover, goLive };
    // Untouched, blocked, or Go live off: nothing is sent.
    if (!savePlan(draft, { ...base, coverUrl: coverUrl.current, cityId: null }).length) return;
    let at: StepKey = 'cover';
    let left: StepKey[] = [];
    try {
      if (hasCover && !coverUrl.current && cover) {
        setState({ s: 'busy', at });
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
      const plan = savePlan(draft, { ...base, coverUrl: coverUrl.current, cityId: cityId.current ?? null });
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
        if (typeof res?.new_version === 'number') version.current = res.new_version;
        else if (step.key === 'create' || version.current == null) version.current = (await fetchSeriesWorkspace(seriesId)).series.version;
        done.current.add(step.key);
        left = left.filter((k) => k !== step.key);
      }
      forgetStoredDraft();
      refresh();
      navigate(P3_PATHS.event(seriesId), { replace: true, state: { p3Toast: goLive ? RESULT_COPY.live : RESULT_COPY.savedDraft } });
    } catch (e) {
      const message = at === 'cover' ? (e instanceof Error ? e.message : commandErrorMessage(e)) : at === 'repeat' ? repeatFailure(e) : commandErrorMessage(e);
      if (!created()) setState({ s: 'failed', message, onboarding: isOnboardingRefusal(e) });
      else {
        refresh();
        setState({ s: 'partial', message, left: left.length ? left : [at] });
      }
    }
  };

  /** The draft is archived (draft -> archived is an owner move); hard delete is the team's. */
  const discard = async (): Promise<void> => {
    if (!created() || state.s === 'discarding') return;
    setState({ s: 'discarding' });
    try {
      const command = removeCommand();
      const res = await runSeriesCommand(envelope(seriesId, version.current, command, keyFor(`discard|${JSON.stringify(command)}`)));
      if (typeof res?.new_version === 'number') version.current = res.new_version;
      forgetStoredDraft();
      refresh();
      navigate(P3_PATHS.events, { replace: true, state: { p3Toast: RESULT_COPY.discarded } });
    } catch {
      setState({ s: 'discardFailed' });
    }
  };

  /** A new photo picked before the create: the next save uploads it instead of the old one. */
  const forgetCover = () => {
    if (created()) return;
    coverUrl.current = null;
    done.current.delete('cover');
    setCoverUploaded(false);
  };

  return { state, run, discard, forgetCover, coverUploaded };
}

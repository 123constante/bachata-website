import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { eventWorkspaceQueryKey } from '@/modules/organiser/events/eventsApi';
import {
  ORGANISER_HOME_KEY,
  dateDetailQueryKey,
  fetchDateDetail,
  fetchOccurrenceProgramme,
  fetchSeriesWorkspace,
  occurrenceProgrammeQueryKey,
  saveOccurrenceProgramme,
  seriesWorkspaceQueryKey,
} from '@/modules/organiser/shared/selfServeApi';
import {
  buildPayload,
  isDirty,
  toDraft,
  validateProgramme,
  type DraftSession,
  type Programme,
} from '@/modules/organiser/shared/programmeModel';
import { moveDateCommand, overrideCommand, type OwnerCommand } from '@/modules/organiser/shared/seriesCommands';
import {
  OFFLINE_SAVE_MESSAGE,
  commandErrorMessage,
  isServerRefusal,
  programmeErrorCopy,
} from '@/modules/organiser/shared/selfServeErrors';
import { useOwnerCommand } from '@/modules/organiser/shared/useOwnerCommand';
import { useVenueOptions } from '@/modules/organiser/shared/publicVenues';
import { venueOverridePatch } from './venueOverride';
import { copyRowsFrom } from './dateChanges';

/** The save could not be confirmed (no server answer). */
export const NETWORK_COPY = OFFLINE_SAVE_MESSAGE;

export interface SaveOutcome {
  ok: boolean;
  /** Plain-English message for a failure (shown with the shake). */
  message?: string;
  changed?: boolean;
}

/**
 * Everything the date page edits, in one place: the programme (sessions and
 * their people) read from organiser_get_occurrence_programme_v1, the date's
 * own state (event_view_p5: cancelled, venue override) and the series
 * (admin_event_workspace_p5: name, lifecycle, version, usual venue).
 *
 * The draft is seeded from the reader and NOTHING else. After every save, and
 * after a refusal that says the screen is out of date, the programme is read
 * again from the server and the draft starts over from it: the writer
 * re-creates a changed date-only session under a NEW id, so a draft rebuilt
 * from cached ids (or from the save result, which carries no line-up) would
 * lose that session's people (PR #653 audit finding c).
 */
export function useDateEditor(seriesId: string, occurrenceId: string) {
  const queryClient = useQueryClient();
  const command = useOwnerCommand(seriesId);
  const venues = useVenueOptions();

  const programme = useQuery({
    queryKey: occurrenceProgrammeQueryKey(occurrenceId),
    queryFn: () => fetchOccurrenceProgramme(occurrenceId),
    enabled: !!occurrenceId,
    refetchOnWindowFocus: false,
  });
  const detail = useQuery({
    queryKey: dateDetailQueryKey(occurrenceId),
    queryFn: () => fetchDateDetail(occurrenceId),
    enabled: !!occurrenceId,
  });
  const workspace = useQuery({
    queryKey: seriesWorkspaceQueryKey(seriesId),
    queryFn: () => fetchSeriesWorkspace(seriesId),
    enabled: !!seriesId,
  });

  const [base, setBase] = useState<Programme | null>(null);
  const [rows, setRows] = useState<DraftSession[]>([]);
  /** undefined: untouched; null: back to the usual venue; else the venue id picked for this date. */
  const [venueDraft, setVenueDraft] = useState<string | null | undefined>(undefined);
  /** A one-off moved to another day (saved with the rest by Save this date); null: not moving. */
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const seed = useCallback((p: Programme) => {
    setBase(p);
    setRows(toDraft(p.sessions, p.sessionPeople));
  }, []);

  // First read only (seeded while rendering, React's adjust-state-on-data pattern).
  // Later reads are seeded explicitly by resync().
  if (!base && programme.data) {
    setBase(programme.data);
    setRows(toDraft(programme.data.sessions, programme.data.sessionPeople));
  }

  /** The reader again, straight from the server; the draft starts over from it. */
  const resync = useCallback(async () => {
    setSyncFailed(false);
    try {
      const fresh = await queryClient.fetchQuery({
        queryKey: occurrenceProgrammeQueryKey(occurrenceId),
        queryFn: () => fetchOccurrenceProgramme(occurrenceId),
        staleTime: 0,
      });
      if (mounted.current) seed(fresh);
      return true;
    } catch {
      if (mounted.current) setSyncFailed(true);
      return false;
    }
  }, [occurrenceId, queryClient, seed]);

  const d = detail.data;
  const series = workspace.data?.series ?? null;
  const storedOverride = d?.venueOverride ?? null;
  const venueChanged = venueDraft !== undefined && venueDraft !== storedOverride;
  /** The venue this date shows: the draft, else its own, else the series' usual one. */
  const venueId = venueDraft !== undefined ? venueDraft ?? series?.default_venue_id ?? null : d?.venueId ?? series?.default_venue_id ?? null;

  const programmeDirty = base ? isDirty(rows, base.sessions.length) : false;
  const moveChanged = moveTo !== null && moveTo !== (base?.occurrenceDate ?? d?.date ?? null);
  const dirty = programmeDirty || venueChanged || moveChanged;
  const validation = useMemo(() => validateProgramme(rows), [rows]);

  const pickVenue = (id: string | null) => {
    // Picking the usual venue is the same as no override.
    const next = id && series && id === series.default_venue_id ? null : id;
    setVenueDraft(next === storedOverride ? undefined : next);
  };

  const invalidateAround = () => {
    void queryClient.invalidateQueries({ queryKey: dateDetailQueryKey(occurrenceId) });
    void queryClient.invalidateQueries({ queryKey: seriesWorkspaceQueryKey(seriesId) });
    // The event page reads this date's session count.
    void queryClient.invalidateQueries({ queryKey: eventWorkspaceQueryKey(seriesId) });
    void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
  };

  const save = async (): Promise<SaveOutcome> => {
    if (!base || saving) return { ok: false };
    if (!validation.ok) {
      return { ok: false, message: validation.rows[0]?.message ?? validation.programme[0] ?? 'Check the sessions and try again.' };
    }
    setSaving(true);
    let dateVersion = d?.version ?? null;
    let programmeVersion = base.version;
    let changed = false;
    try {
      if (moveChanged && moveTo) {
        try {
          await command.mutateAsync({ targetId: occurrenceId, version: dateVersion, command: moveDateCommand(moveTo) });
          setMoveTo(null);
          changed = true;
          // The programme version moved with the date: read both again before the sessions go.
          const fresh = await detail.refetch();
          dateVersion = fresh.data?.version ?? dateVersion;
          if (programmeDirty) {
            const again = await queryClient.fetchQuery({
              queryKey: occurrenceProgrammeQueryKey(occurrenceId),
              queryFn: () => fetchOccurrenceProgramme(occurrenceId),
              staleTime: 0,
            });
            programmeVersion = again.version;
          }
        } catch (err) {
          return { ok: false, message: commandErrorMessage(err) };
        }
      }
      if (venueChanged) {
        try {
          // The city follows the venue (G7): sent with it, cleared with it.
          const patch = await venueOverridePatch(venueDraft ?? null, venues.data);
          await command.mutateAsync({
            targetId: occurrenceId,
            version: dateVersion,
            command: overrideCommand(patch),
          });
          setVenueDraft(undefined);
        } catch (err) {
          return { ok: false, message: commandErrorMessage(err) };
        }
      }
      changed = changed || venueChanged;
      if (programmeDirty) {
        try {
          const result = await saveOccurrenceProgramme(occurrenceId, programmeVersion, buildPayload(rows));
          changed = changed || result.changed;
        } catch (err) {
          if (!isServerRefusal(err)) return { ok: false, message: NETWORK_COPY };
          const copy = programmeErrorCopy(err);
          if (copy.reload) await resync();
          return { ok: false, message: copy.message };
        }
      }
      // Never trust local ids after a write: read the programme again.
      await resync();
      invalidateAround();
      return { ok: true, changed };
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  /** Copy changes from another date: its sessions and venue become this date's draft (nothing is sent until Save this date). */
  const copyFrom = async (sourceId: string): Promise<boolean> => {
    try {
      const [src, srcDetail] = await Promise.all([
        queryClient.fetchQuery({ queryKey: occurrenceProgrammeQueryKey(sourceId), queryFn: () => fetchOccurrenceProgramme(sourceId), staleTime: 0 }),
        queryClient.fetchQuery({ queryKey: dateDetailQueryKey(sourceId), queryFn: () => fetchDateDetail(sourceId), staleTime: 0 }),
      ]);
      setRows((cur) => copyRowsFrom(cur, toDraft(src.sessions, src.sessionPeople)));
      pickVenue(srcDetail.venueOverride);
      return true;
    } catch {
      return false;
    }
  };

  /** A break or a cancellation: one owner command, then fresh reads of everything it touched. */
  const runCommand = async (kind: 'series' | 'occurrence', cmd: OwnerCommand): Promise<SaveOutcome> => {
    try {
      await command.mutateAsync({
        targetId: kind === 'series' ? seriesId : occurrenceId,
        version: kind === 'series' ? series?.version ?? null : d?.version ?? null,
        command: cmd,
      });
      // A cancel or a break changes what the event editor lists (its own cache
      // entry, which useOwnerCommand does not reload): without this, going back
      // through the in-app link shows the date as still upcoming until a reload.
      void queryClient.invalidateQueries({ queryKey: eventWorkspaceQueryKey(seriesId) });
      if (kind === 'occurrence') {
        await Promise.all([resync(), detail.refetch()]);
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, message: commandErrorMessage(err) };
    }
  };

  return {
    programme,
    detail,
    workspace,
    base,
    rows,
    setRows,
    venueId,
    venueChanged,
    pickVenue,
    moveTo,
    setMoveTo,
    moveChanged,
    copyFrom,
    dirty,
    validation,
    saving,
    commandBusy: command.isPending,
    syncFailed,
    resync,
    save,
    runCommand,
  };
}

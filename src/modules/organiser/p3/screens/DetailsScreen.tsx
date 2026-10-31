import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PROFILE_WIZARD_PATH } from '../../shared/profileProgress';
import { eventLock } from '../../shared/eventState';
import { VenueList } from './VenueList';
import { useVenueOptions, venueName, type VenueOption } from '../../shared/publicVenues';
import { commandErrorMessage } from '../../shared/selfServeErrors';
import { FLYER_ACCEPT, FLYER_PROBLEM_COPY, FlyerError, checkFlyerBytes, checkFlyerFile, reencodeFlyer } from '../../shared/flyerModel';
import { uploadEventPicture } from '../../events/media';
import { uploadFlyer } from '../../shared/flyerUploadApi';
import { MAX_GALLERY, MUSIC_STYLES, type EventWorkspace } from '../../events/eventModel';
import { L, kindWordStored } from '../model';
import {
  DETAILS_SPECS, cityForVenue, detailsBlocker, detailsDraftOf, detailsLandedKeys, detailsPlan, detailsProblems, toggleMusic, type DetailsField,
} from '../data/details';
import { trayLines } from '../model/saveModel';
import { P3_PATHS } from '../shell/paths';
import { EditTray, GuardedBack, useBackToEvent, useEditForm, useEditLock, useSaveRun } from './EditTray';
import { WorkspaceGate } from './EventPage';
import { Sheet } from './Sheet';
import { OnBody } from './RepeatSheet';


function Field({ id, label, hint, problem, children }: { id: string; label: string; hint?: string; problem?: string | null; children: ReactNode }) {
  return (
    <div className="p3-stack-s" data-testid={`p3-field-${id}`}>
      <label className="p3-field" htmlFor={`p3-d-${id}`}>{label}</label>
      {children}
      {problem ? <p className="p3-error" role="alert" data-testid={`p3-problem-${id}`}>{problem}</p> : hint ? <p className="p3-note">{hint}</p> : null}
    </div>
  );
}

function Details({ ws }: { ws: EventWorkspace }) {
  const form = useEditForm(ws, detailsDraftOf, DETAILS_SPECS);
  const save = useSaveRun(ws.series.id);
  const back = useBackToEvent(ws.series.id, form.dirty);
  const lock = useEditLock(ws);
  const venues = useVenueOptions();
  const [picking, setPicking] = useState(false);
  const [pictures, setPictures] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<DetailsField, boolean>>>({});
  const [photo, setPhoto] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const { draft, set } = form;
  const city = useVenueCity(form.changed.includes('venueId') ? draft.venueId : null, venues.data);
  const problems = detailsProblems(form.base, draft);
  const blocker = detailsBlocker(form.base, draft) ?? city.problem;
  const plan = detailsPlan(form.base, draft, city.id);
  const lines = trayLines(form.lines, plan, blocker);
  // a field's problem shows once it was touched or changed (a stored bad link shows too: it says what to fix)
  const shown = (f: DetailsField) => (touched[f] || form.changed.includes(f) || f === 'ticket' ? problems[f] ?? null : null);
  const touch = (f: DetailsField) => setTouched((t) => ({ ...t, [f]: true }));
  const off = !!lock || save.busy;

  const onSave = async () => {
    const res = await save.run(plan, form.version, (v, command) => form.landed(v, detailsLandedKeys(command)));
    if (res.ok) { form.saved(res.version); back(L.detailsSaved); }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const quick = checkFlyerFile(file);
    if (quick) { setPhoto({ busy: false, error: FLYER_PROBLEM_COPY[quick] }); return; }
    setPhoto({ busy: true, error: null });
    try {
      const bad = await checkFlyerBytes(file);
      if (bad) throw new FlyerError(bad);
      const url = await uploadFlyer(ws.series.id, await reencodeFlyer(file));
      set({ cover: url });
      setPhoto({ busy: false, error: null });
    } catch (e) {
      setPhoto({ busy: false, error: e instanceof FlyerError ? FLYER_PROBLEM_COPY[e.problem] : commandErrorMessage(e) });
    }
  };

  const festival = ws.series.format === 'festival';
  const place = venueName(venues.data, draft.venueId);
  return (
    <div className="p3-stack p3-edit" data-testid="p3-details">
      <GuardedBack to={P3_PATHS.event(ws.series.id)}>{L.back}</GuardedBack>
      <p className="p3-row-s">{ws.series.name}</p>
      <h2 className="p3-name">{L.detailsTitle}</h2>
      {lock && (
        <div className="p3-warn" data-testid="p3-details-lock">
          <p className="p3-plain">{lock}</p>
          {!eventLock(ws.series.lifecycle_status) && <a className="p3-link" href={PROFILE_WIZARD_PATH}>Complete your profile</a>}
        </div>
      )}
      <Field id="name" label={L.detailsName} problem={touched.name || form.changed.includes('name') ? problems.name : null}>
        <input id="p3-d-name" className="p3-in" value={draft.name} disabled={off} autoComplete="off"
          onChange={(e) => set({ name: e.target.value })} onBlur={() => touch('name')} data-testid="p3-d-name" />
      </Field>
      <Field id="description" label={L.detailsAbout} hint={L.detailsAboutHint} problem={problems.description}>
        <textarea id="p3-d-description" className="p3-in" rows={6} value={draft.description} disabled={off}
          onChange={(e) => set({ description: e.target.value })} data-testid="p3-d-description" />
      </Field>
      <span className="p3-field">{L.music}</span>
      <div className="p3-chips" role="group" aria-label={L.music} data-testid="p3-d-music">
        {[...MUSIC_STYLES, ...draft.music.filter((m) => !MUSIC_STYLES.includes(m))].map((m) => (
          <button key={m} type="button" aria-pressed={draft.music.includes(m)} disabled={off}
            onClick={() => set({ music: toggleMusic(draft.music, m) })}>{m}</button>
        ))}
      </div>
      <div className="p3-stack-s" data-testid="p3-field-venueId">
        <span className="p3-field">{L.detailsWhere}</span>
        <div className="p3-card p3-tight">
          <p className="p3-row-t" data-testid="p3-d-place">{place ?? (draft.venueId ? L.detailsPlaceLoading : L.notSet)}</p>
          <p className="p3-note">{L.detailsCityNote}</p>
        </div>
        <button type="button" className="p3-btn p3-btn-line" disabled={off} onClick={() => setPicking(true)} data-testid="p3-d-pick-place">{L.detailsPickPlace}</button>
        {problems.venueId && <p className="p3-error" role="alert">{problems.venueId}</p>}
        {city.failed && (
          <div className="p3-warn" data-testid="p3-d-city-fail">
            <p className="p3-plain">{L.detailsCityFail}</p>
            <button type="button" className="p3-link" onClick={city.retry} data-testid="p3-d-city-retry">{L.detailsCityRetry}</button>
          </div>
        )}
      </div>
      <Field id="ticket" label={L.ticket} problem={shown('ticket')}>
        <input id="p3-d-ticket" className="p3-in" inputMode="url" value={draft.ticket} disabled={off} placeholder="https://"
          onChange={(e) => set({ ticket: e.target.value })} onBlur={() => touch('ticket')} data-testid="p3-d-ticket" />
      </Field>
      <div className="p3-stack-s" data-testid="p3-field-cover">
        <span className="p3-field">{L.detailsCover}</span>
        {draft.cover ? <img className="p3-cover" src={draft.cover} alt="" loading="lazy" decoding="async" /> : <p className="p3-note">{L.detailsCoverNone}</p>}
        <label className="p3-btn p3-btn-line p3-file" htmlFor="p3-d-cover" data-testid="p3-d-cover-btn">
          {draft.cover ? L.detailsCoverChange : L.detailsCoverAdd}
          <input id="p3-d-cover" type="file" accept={FLYER_ACCEPT} disabled={off || photo.busy}
            onChange={(e) => void upload(e.target.files?.[0])} data-testid="p3-d-cover" />
        </label>
        {photo.busy && <p className="p3-note">{L.detailsUploading}</p>}
        {photo.error && <p className="p3-error" role="alert">{photo.error}</p>}
      </div>
      <div className="p3-stack-s" data-testid="p3-field-gallery">
        <span className="p3-field">{L.detailsPictures}</span>
        <div className="p3-card p3-tight">
          <p className="p3-row-t" data-testid="p3-d-pictures-count">{L.detailsPicturesCount(draft.gallery.length)}</p>
          {festival && <p className="p3-note" data-testid="p3-d-pictures-festival">{L.detailsPicturesFestival}</p>}
          {!festival && draft.gallery.length === 0 && <p className="p3-note">{L.detailsPicturesEmpty}</p>}
        </div>
        <button type="button" className="p3-btn p3-btn-line" style={{ minHeight: 44 }} disabled={off || festival} onClick={() => setPictures(true)} data-testid="p3-d-pictures-open">
          {draft.gallery.length ? L.detailsPicturesEdit : L.detailsPicturesAdd}
        </button>
        {problems.gallery && <p className="p3-error" role="alert">{problems.gallery}</p>}
      </div>
      <Field id="instagram" label={L.instagram} hint={L.detailsInstagramHint} problem={shown('instagram')}>
        <input id="p3-d-instagram" className="p3-in" value={draft.instagram} disabled={off} autoComplete="off"
          onChange={(e) => set({ instagram: e.target.value })} onBlur={() => touch('instagram')} data-testid="p3-d-instagram" />
      </Field>
      <Field id="videos" label={L.detailsVideos} hint={L.detailsVideosHint} problem={shown('videos')}>
        <textarea id="p3-d-videos" className="p3-in p3-in-short" rows={3} value={draft.videos} disabled={off}
          onChange={(e) => set({ videos: e.target.value })} onBlur={() => touch('videos')} data-testid="p3-d-videos" />
      </Field>
      <Field id="chat" label={L.detailsChat} hint={L.detailsChatHint} problem={shown('chat')}>
        <input id="p3-d-chat" className="p3-in" inputMode="url" value={draft.chat} disabled={off} placeholder="https://chat.whatsapp.com/&hellip;"
          onChange={(e) => set({ chat: e.target.value })} onBlur={() => touch('chat')} data-testid="p3-d-chat" />
      </Field>
      <div className="p3-card p3-tight" data-testid="p3-d-kind">
        <p className="p3-row-s">{L.detailsKind}</p>
        <p className="p3-row-t">{kindWordStored(ws.series.format, ws.series.category)}</p>
        <p className="p3-note">{L.detailsKindHint}</p>
      </div>
      <EditTray lines={lines} elsewhere={form.elsewhere} problem={blocker} lock={lock} busy={save.busy} error={save.error}
        onSave={() => void onSave()} onUndo={() => { form.undo(); save.clearError(); setPhoto({ busy: false, error: null }); }} onRestart={() => { form.restart(); save.forget(); }} />
      {pictures && (
        <OnBody>
          <PicturesSheet seriesId={ws.series.id} gallery={draft.gallery} busy={off} onChange={(gallery) => set({ gallery })} onClose={() => setPictures(false)} />
        </OnBody>
      )}
      {picking && (
        <Sheet title={L.detailsPlaceSheet} onClose={() => setPicking(false)}>
          <VenueList venues={venues} testId="p3-d-venues">
            {(list) => list.map((v) => (
              <button key={v.id} type="button" className="p3-choice" aria-pressed={v.id === draft.venueId}
                onClick={() => { set({ venueId: v.id }); setPicking(false); }}>
                <span className="p3-row-t">{v.name}</span>
                <span className="p3-row-s">{[v.neighbourhood, v.city_name].filter(Boolean).join(', ')}</span>
              </button>
            ))}
          </VenueList>
        </Sheet>
      )}
    </div>
  );
}

/** The series pictures: the date sheet's picker and the same upload path; edits the draft, the ONE save sends them. */
function PicturesSheet({ seriesId, gallery, busy, onChange, onClose }: { seriesId: string; gallery: string[]; busy: boolean; onChange: (g: string[]) => void; onClose: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const latest = useRef(gallery);
  useEffect(() => { latest.current = gallery; });
  const add = async (files: File[]) => {
    setUploading(true);
    setError(null);
    try {
      for (const f of files.slice(0, Math.max(0, MAX_GALLERY - latest.current.length))) {
        const url = await uploadEventPicture(seriesId, f);
        latest.current = [...latest.current, url];
        onChange(latest.current);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : commandErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };
  return (
    <Sheet title={L.detailsPictures} onClose={onClose} locked={uploading}>
      <p className="p3-note">{L.detailsPicturesHint}</p>
      {gallery.length === 0 && <p className="p3-note" data-testid="p3-pictures-empty">{L.detailsPicturesEmpty}</p>}
      <div role="list" className="p3-photos" data-testid="p3-pictures">
        {gallery.map((url, i) => (
          <div role="listitem" key={`${url}-${i}`} className="p3-photo" data-testid="p3-picture">
            <img src={url} alt="" loading="lazy" />
            <button type="button" className="p3-photo-x" aria-label={`${L.detailsPicturesRemove} ${i + 1}`} disabled={busy || uploading}
              onClick={() => { latest.current = gallery.filter((_, j) => j !== i); onChange(latest.current); }} data-testid="p3-picture-remove">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
        ))}
      </div>
      <input ref={file} type="file" accept={FLYER_ACCEPT} multiple className="p3-sr" tabIndex={-1} aria-hidden="true"
        onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ''; if (f.length) void add(f); }} data-testid="p3-pictures-file" />
      {gallery.length < MAX_GALLERY
        ? <button type="button" className="p3-btn p3-btn-line" style={{ minHeight: 44 }} disabled={busy || uploading} onClick={() => file.current?.click()} data-testid="p3-pictures-add">
            {uploading ? L.detailsUploading : L.detailsPicturesAdd}
          </button>
        : <p className="p3-note" data-testid="p3-pictures-max">{L.detailsPicturesMax(MAX_GALLERY)}</p>}
      {error && <p className="p3-error" role="alert" data-testid="p3-pictures-error">{error}</p>}
      <div className="p3-sheet-foot">
        <button type="button" className="p3-btn" style={{ minHeight: 44 }} disabled={uploading} onClick={onClose} data-testid="p3-pictures-done">{L.detailsPicturesDone}</button>
      </div>
    </Sheet>
  );
}

/**
 * The city of a newly picked place, looked up as soon as it is picked. While it is being found,
 * or when the lookup failed, `problem` holds the save (never a save that leaves the old place's
 * city behind); a failed lookup can be tried again (PR #1082 r1 #3).
 */
const CITY_LOOKUP_MS = 10_000;

function useVenueCity(venueId: string | null, venues: VenueOption[] | undefined) {
  const [found, setFound] = useState<{ venueId: string; id: string | null; failed: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  // the latest list, without making a new list (each read of the venue query) a new lookup
  const list = useRef(venues);
  useEffect(() => { list.current = venues; });
  const ready = !!venues;
  useEffect(() => {
    if (!venueId || !ready) return undefined;
    let live = true;
    // a lookup that never settles turns into the failed state, with Try again (PR #1082 r2 #7)
    const slow = setTimeout(() => { if (live) setFound({ venueId, id: null, failed: true }); }, CITY_LOOKUP_MS);
    cityForVenue(venueId, list.current).then(
      (id) => { clearTimeout(slow); if (live) setFound({ venueId, id, failed: false }); },
      () => { clearTimeout(slow); if (live) setFound({ venueId, id: null, failed: true }); },
    );
    return () => { live = false; clearTimeout(slow); };
  }, [venueId, ready, attempt]);
  const mine = venueId && found?.venueId === venueId ? found : null;
  const failed = !!mine?.failed;
  const problem = !venueId ? null : !mine ? L.detailsCityBusy : failed ? L.detailsCityFail : null;
  const retry = () => { setFound(null); setAttempt((n) => n + 1); };
  return { id: mine && !failed ? mine.id : null, failed, problem, retry };
}

/** C3 "Name and details" (P3 W3a): every field of the event, one save for all dates. */
export function DetailsScreen() {
  return <WorkspaceGate>{(ws) => <Details key={ws.series.id} ws={ws} />}</WorkspaceGate>;
}

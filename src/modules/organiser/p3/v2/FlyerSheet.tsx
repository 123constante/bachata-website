import { useRef, useState } from 'react';
import { MAX_GALLERY } from '../../events/eventModel';
import { uploadEventPicture } from '../../events/media';
import { FLYER_ACCEPT } from '../../shared/flyerModel';
import { parseVenueVideoUrl } from '@/lib/parseVenueVideoUrl';
import { V2Sheet } from './V2Sheet';
import { PhotoSheet } from './PhotoSheet';
import { savedLabel, type SheetMode } from './WhereSheet';
import { V2 } from './copy';

const F = V2.flyerPhotos;

/** A gallery item is a video when it is a YouTube / Vimeo link or a direct video file (a stored picture is not). */
export function isVideoUrl(url: string): boolean {
  const v = parseVenueVideoUrl(url);
  if (!v) return false;
  return v.kind !== 'direct' || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

/** "4 photos, 1 video": photos first, only the non-zero parts. */
export function countWord(urls: string[]): string {
  const v = urls.filter(isVideoUrl).length;
  const p = urls.length - v;
  return [p ? `${p} ${p === 1 ? 'photo' : 'photos'}` : '', v ? `${v} ${v === 1 ? 'video' : 'videos'}` : ''].filter(Boolean).join(', ');
}

/**
 * SH-FLY: flyer + gallery. Controlled; `onFlyer(url|null)` and `onGallery(next, label)` are the caller's writes
 * (night override today; series defaults in slices 10 / 11, NOT built here). Resolves { ok } like OnSave.
 */
export function FlyerSheet({ seriesId, flyer, gallery, mode, dateWords, dayName, changed, onFlyer, onGallery, onBackToUsual, onClose }: {
  seriesId: string; flyer: string | null; gallery: string[]; mode: SheetMode; dateWords: string; dayName: string; changed?: boolean;
  onFlyer: (url: string | null, label: string) => void | Promise<unknown>;
  onGallery: (next: string[], label: string) => void | Promise<unknown>;
  onBackToUsual?: () => void | Promise<unknown>; onClose: () => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [linkErr, setLinkErr] = useState<string | null>(null);
  const flyerIn = useRef<HTMLInputElement>(null);
  const photosIn = useRef<HTMLInputElement>(null);
  const night = mode === 'night';
  const full = gallery.length >= MAX_GALLERY;
  const label = savedLabel(mode, dateWords);

  const chooseFlyer = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true); setErr(null);
    try { await onFlyer(await uploadEventPicture(seriesId, file), label); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const addPhotos = async (files: FileList | null) => {
    const picked = Array.from(files ?? []).slice(0, Math.max(0, MAX_GALLERY - gallery.length));
    if (!picked.length) return;
    setBusy(true); setErr(null);
    try {
      const urls: string[] = [];
      for (const f of picked) urls.push(await uploadEventPicture(seriesId, f));
      await onGallery([...gallery, ...urls], label);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const addVideo = async () => {
    const v = link.trim();
    if (!v) return;
    if (!/^https?:\/\/\S+$/i.test(v)) { setLinkErr(F.badLink); return; }
    setLinkErr(null);
    await onGallery([...gallery, v], label);
    setLink('');
  };
  const remove = async (i: number) => {
    const video = isVideoUrl(gallery[i]);
    setOpen(null);
    await onGallery(gallery.filter((_, k) => k !== i), video ? F.videoRemoved : F.photoRemoved);
  };

  if (open !== null && gallery[open] !== undefined) {
    return <PhotoSheet url={gallery[open]} video={isVideoUrl(gallery[open])} onRemove={() => remove(open)} onBack={() => setOpen(null)} onClose={onClose} />;
  }
  const count = countWord(gallery);
  return (
    <V2Sheet open title={V2.flyerAndPhotos} onClose={onClose}>
      <div className="grp" data-mode={mode}>
        <div className={flyer ? 'flyer f1' : 'flyer none'} data-testid="flyer-preview"
          style={{ borderRadius: 8, aspectRatio: '4 / 3', ...(flyer ? { backgroundImage: `url(${flyer})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}) }}>
          {!flyer && <span>{V2.noFlyer}</span>}
        </div>
        {!flyer && <p className="hint" data-testid="flyer-required">{F.required}</p>}
        <button type="button" className="btn sec" data-testid="flyer-choose" disabled={busy} onClick={() => flyerIn.current?.click()}>{busy ? F.uploading : F.choose}</button>
        <input ref={flyerIn} type="file" accept={FLYER_ACCEPT} hidden data-testid="flyer-file" onChange={(e) => { void chooseFlyer(e.target.files); e.target.value = ''; }} />

        {night && changed && onBackToUsual && <button type="button" className="btn sec" data-testid="flyer-back" onClick={() => { void onBackToUsual(); onClose(); }}>{F.backToUsual}</button>}
        <div className="lab">{night ? F.labNight : F.lab}{count ? ` · ${count}` : ''}</div>
        <p className="txt">{night ? F.textNight : mode === 'oneOff' ? F.textOneOff : F.textEvery(dayName)}</p>
        {gallery.length ? (
          <>
            <div className="ggrid" data-testid="gallery-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {gallery.map((u, i) => {
                const video = isVideoUrl(u);
                return (
                  <button key={`${i}-${u}`} type="button" data-testid="gallery-tile" aria-label={F.tile(video ? F.video : F.photo, i + 1)} onClick={() => setOpen(i)}
                    style={{ aspectRatio: '1', borderRadius: 8, border: 0, padding: 0, color: '#FFFFFF', fontSize: 24, cursor: 'pointer', background: video ? 'linear-gradient(#14161C,#565B69)' : '#E9E9E9' }}>
                    {video ? <span className="gplay" aria-hidden="true">&#9654;</span> : <img src={u} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, display: 'block' }} />}
                  </button>
                );
              })}
            </div>
            <p className="hint">{F.hint}</p>
          </>
        ) : <p className="hint">{F.empty}</p>}
        {full && <p className="hint" data-testid="gallery-full">{F.atLimit}</p>}
        <button type="button" className="btn sec" data-testid="gallery-add" disabled={busy || full} onClick={() => photosIn.current?.click()}>{busy ? F.uploading : F.addPhotos}</button>
        <input ref={photosIn} type="file" accept={FLYER_ACCEPT} multiple hidden data-testid="gallery-file" onChange={(e) => { void addPhotos(e.target.files); e.target.value = ''; }} />
        {err && <p className="hint" role="alert" data-testid="flyer-error" style={{ color: '#B42318' }}>{err}</p>}
        <label className="flab" htmlFor="fl-video">{F.videoField}</label>
        <input id="fl-video" type="url" className="fld" placeholder={F.videoPlaceholder} value={link} disabled={full} onChange={(e) => { setLink(e.target.value); setLinkErr(null); }} />
        {linkErr && <p className="hint" role="alert" style={{ color: '#B42318' }}>{linkErr}</p>}
        <button type="button" className="btn sec" data-testid="video-add" disabled={busy || full} onClick={() => void addVideo()}>{F.addVideo}</button>
      </div>
    </V2Sheet>
  );
}

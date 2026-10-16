import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, PointerEvent, WheelEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { uploadErrorMessage, validateImageFile } from '@/lib/upload-validation';
import { DancerApiError } from '../../api/errors';
import {
  OUTPUT_QUALITY,
  OUTPUT_SIZE,
  clampView,
  initialView,
  panView,
  renderCrop,
  zoomView,
  MAX_ZOOM,
  type View,
} from './cropModel';
import { DecodeError, type DecodedPhoto } from './decodeImage';
import { photoScreenDeps, returnPathFor } from './photoScreenDeps';
import { PhotoFlowError, replacePhoto } from './photoFlow';
import { useMyDancerEdit, usePutMyDancerEdit } from '../../api/useMyDancerEdit';

const BOX = 300; // CSS px of the square crop box
const NUDGE = 12; // box px per arrow key press

type Phase = 'pick' | 'crop' | 'preview' | 'saving';

const btn = (primary: boolean) =>
  ({
    minHeight: 48,
    minWidth: 44,
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    width: '100%',
    cursor: 'pointer',
    border: primary ? 'none' : '1px solid var(--da-border)',
    background: primary ? 'var(--da-accent)' : 'transparent',
    color: primary ? 'var(--da-on-accent)' : 'var(--da-text)',
  }) as const;

const note = { fontSize: 14, margin: '8px 0 0', lineHeight: 1.4 } as const;

const toBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not prepare the photo'))), 'image/jpeg', OUTPUT_QUALITY),
  );

const GuideOverlay = () => (
  <svg viewBox="0 0 100 100" aria-hidden="true" data-testid="photo-guide" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
    <ellipse cx="50" cy="38" rx="17" ry="22" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="3 2.5" opacity="0.9" />
    <path d="M12 96 C14 74 30 66 50 66 C70 66 86 74 88 96" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="3 2.5" opacity="0.9" />
  </svg>
);

const PhotoScreen = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // The shared cache write: it also fires profile_strength_70 when this photo takes the person across 70 (review S5).
  const putProfile = usePutMyDancerEdit();
  const profileQuery = useMyDancerEdit();
  const returnTo = returnPathFor(params.get('return'));

  const [phase, setPhase] = useState<Phase>('pick');
  const [decoded, setDecoded] = useState<DecodedPhoto | null>(null);
  const [view, setView] = useState<View>({ cx: 0, cy: 0, zoom: 1 });
  const [refusal, setRefusal] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  const uploadedUrl = useRef<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  // Draw the crop box. Same renderCrop the final 1024px output uses, at box size.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (phase !== 'crop' || !decoded || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderCrop(ctx, decoded.source, decoded.rawW, decoded.rawH, decoded.orientation, view, canvas.width);
  }, [phase, decoded, view]);

  const startOver = useCallback(() => {
    uploadedUrl.current = null;
    setDecoded(null);
    setBlob(null);
    setPreviewUrl(null);
    setFailure(null);
    setPhase('pick');
  }, []);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setRefusal(null);
    setFailure(null);
    const check = validateImageFile(file);
    if (check.ok === false) {
      setRefusal(check.message);
      return;
    }
    try {
      const photo = await photoScreenDeps.decode(file);
      uploadedUrl.current = null;
      setDecoded(photo);
      setView(initialView(photo.w, photo.h));
      setPhase('crop');
    } catch (err) {
      setRefusal(err instanceof DecodeError ? err.message : 'We could not open that photo. Choose a JPG, PNG or WebP photo instead.');
    }
  };

  const nudge = (dx: number, dy: number) => decoded && setView((v) => panView(decoded.w, decoded.h, v, dx, dy, BOX));
  const zoomTo = (zoom: number, px?: number, py?: number) => decoded && setView((v) => zoomView(decoded.w, decoded.h, v, zoom, BOX, px, py));

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom };
    }
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const last = pointers.current.get(e.pointerId);
    if (!last || !decoded) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current.dist > 0) zoomTo(pinch.current.zoom * (dist / pinch.current.dist));
      return;
    }
    nudge(e.clientX - last.x, e.clientY - last.y);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const onWheel = (e: WheelEvent<HTMLDivElement>) => zoomTo(view.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = NUDGE;
    const map: Record<string, () => void> = {
      ArrowLeft: () => nudge(step, 0),
      ArrowRight: () => nudge(-step, 0),
      ArrowUp: () => nudge(0, step),
      ArrowDown: () => nudge(0, -step),
      '+': () => zoomTo(view.zoom * 1.1),
      '=': () => zoomTo(view.zoom * 1.1),
      '-': () => zoomTo(view.zoom / 1.1),
    };
    const run = map[e.key];
    if (run) {
      e.preventDefault();
      run();
    }
  };

  const makePreview = async () => {
    if (!decoded) return;
    setFailure(null);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no canvas');
      renderCrop(ctx, decoded.source, decoded.rawW, decoded.rawH, decoded.orientation, clampView(decoded.w, decoded.h, view), OUTPUT_SIZE);
      const out = await toBlob(canvas);
      uploadedUrl.current = null;
      setBlob(out);
      setPreviewUrl(URL.createObjectURL(out));
      setPhase('preview');
    } catch {
      setFailure('We could not prepare that photo. Take another, or choose a different one from your photos.');
    }
  };

  const current = profileQuery.data;
  const canUse = online && Boolean(current) && phase !== 'saving';

  const save = async () => {
    if (!blob || !current) return;
    setFailure(null);
    setPhase('saving');
    try {
      const { profile } = await replacePhoto({ blob, current, uploadedUrl: uploadedUrl.current }, photoScreenDeps.flow);
      putProfile(profile);
      navigate(returnTo, { replace: true });
    } catch (err) {
      const stage = err instanceof PhotoFlowError ? err.stage : 'upload';
      if (err instanceof PhotoFlowError && err.uploadedUrl) uploadedUrl.current = err.uploadedUrl;
      const cause = err instanceof PhotoFlowError ? err.cause : err;
      setFailure(
        stage === 'save' && cause instanceof DancerApiError
          ? cause.message
          : stage === 'save'
            ? 'Your photo uploaded but we could not save it to your profile. Check your connection and try again.'
            : uploadErrorMessage(cause),
      );
      setPhase('preview');
    }
  };

  const inputStyle = useMemo(() => ({ display: 'none' }) as const, []);

  return (
    <section className="da-card" data-testid="dancer-screen-photo" aria-labelledby="photo-title" style={{ padding: 14 }}>
      <h1 id="photo-title" style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
        Your photo
      </h1>

      {profileQuery.isError && (
        <div role="alert" style={note}>
          <p style={{ margin: 0, color: 'var(--da-danger)' }}>We could not load your profile, so we cannot save a photo yet. Check your connection and try again.</p>
          <button type="button" className="da-tap" style={{ ...btn(false), marginTop: 8 }} onClick={() => void profileQuery.refetch()}>
            Try again
          </button>
        </div>
      )}
      {profileQuery.isLoading && <p className="da-muted" style={note}>Loading&hellip;</p>}

      {!online && (
        <p role="status" data-testid="photo-offline" style={{ ...note, color: 'var(--da-danger)' }}>
          You are offline. You can still pick and crop a photo; saving needs a connection.
        </p>
      )}

      {phase === 'pick' && (
        <div data-testid="photo-pick">
          <p className="da-muted" style={note}>
            Head and shoulders, facing the camera. This is how people find you.
          </p>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            <label className="da-tap" style={{ ...btn(true), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Take photo
              <input type="file" accept="image/*" capture="user" onChange={onFile} style={inputStyle} data-testid="photo-input-camera" aria-label="Take photo" />
            </label>
            <label className="da-tap" style={{ ...btn(false), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Choose from my photos
              <input type="file" accept="image/*" onChange={onFile} style={inputStyle} data-testid="photo-input-library" aria-label="Choose from my photos" />
            </label>
          </div>
          <p className="da-muted" style={note}>
            If your camera does not open, allow camera access for this site in your browser settings, or choose from your photos instead.
          </p>
          {refusal && (
            <p role="alert" data-testid="photo-refusal" style={{ ...note, color: 'var(--da-danger)' }}>
              {refusal} Pick another photo to carry on.
            </p>
          )}
          {current?.avatar_url && (
            <p className="da-muted" style={note}>
              Your current photo stays until you save a new one.
            </p>
          )}
        </div>
      )}

      {phase === 'crop' && decoded && (
        <div data-testid="photo-crop">
          <p className="da-muted" style={note}>
            Drag to position, pinch or use the slider to zoom. Keep your head and shoulders inside the outline.
          </p>
          <div
            role="application"
            tabIndex={0}
            aria-label="Photo crop. Arrow keys move the photo, plus and minus zoom."
            data-testid="photo-crop-box"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            onKeyDown={onKey}
            style={{ position: 'relative', width: BOX, maxWidth: '100%', aspectRatio: '1 / 1', margin: '12px auto 0', borderRadius: 12, overflow: 'hidden', touchAction: 'none', background: '#000' }}
          >
            <canvas ref={canvasRef} width={600} height={600} style={{ width: '100%', height: '100%', display: 'block' }} />
            <GuideOverlay />
          </div>
          <label style={{ display: 'block', marginTop: 12, fontSize: 14 }}>
            Zoom
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={view.zoom}
              onChange={(e) => zoomTo(Number(e.target.value))}
              style={{ width: '100%', minHeight: 44 }}
              data-testid="photo-zoom"
            />
          </label>
          {failure && <p role="alert" style={{ ...note, color: 'var(--da-danger)' }}>{failure}</p>}
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            <button type="button" className="da-tap" style={btn(true)} onClick={() => void makePreview()} data-testid="photo-crop-done">
              Next
            </button>
            <button type="button" className="da-tap" style={btn(false)} onClick={startOver}>
              Choose a different photo
            </button>
          </div>
        </div>
      )}

      {(phase === 'preview' || phase === 'saving') && previewUrl && (
        <div data-testid="photo-preview">
          <div style={{ width: '50%', aspectRatio: '1 / 1', margin: '12px auto 0', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
            <img src={previewUrl} alt="Your new photo" loading="eager" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
          <p style={{ ...note, textAlign: 'center', border: '1px solid var(--da-border)', borderRadius: 12, padding: '10px 12px', color: 'var(--da-text)' }}>
            This is how people will see you.
          </p>
          {failure && (
            <p role="alert" data-testid="photo-failure" style={{ ...note, color: 'var(--da-danger)' }}>
              {failure}
            </p>
          )}
          {!online && (
            <p className="da-muted" style={note}>
              Use this photo is off until you are back online.
            </p>
          )}
          {profileQuery.isError && (
            <p className="da-muted" style={note}>
              Use this photo is off until your profile has loaded. Press Try again above.
            </p>
          )}
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            <button type="button" className="da-tap" style={{ ...btn(true), opacity: canUse ? 1 : 0.55 }} disabled={!canUse} onClick={() => void save()} data-testid="photo-use">
              {phase === 'saving' ? 'Saving\u2026' : failure ? 'Try again' : 'Use this photo'}
            </button>
            <button type="button" className="da-tap" style={btn(false)} disabled={phase === 'saving'} onClick={startOver} data-testid="photo-another">
              Take another
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default PhotoScreen;

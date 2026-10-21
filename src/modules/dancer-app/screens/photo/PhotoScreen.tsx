import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, PointerEvent, WheelEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { showShellToast } from '../../shell/shellToast';

import { validateImageFile } from '@/lib/upload-validation';
import { APP_WELCOME_PATH } from '@/lib/accountRouting';
import { photoUploadFailureMessage } from './uploadFailure';
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
import { Card, GhostButton, PrimaryButton } from '@/modules/organiser/ui';
import { LINK_GHOST, LINK_PRIMARY } from '../blocks';

const BOX = 300; // CSS px of the square crop box
const NUDGE = 12; // box px per arrow key press

type Phase = 'pick' | 'crop' | 'preview' | 'saving';

const NOTE = 'mx-0 mb-0 mt-[8px] text-[14px] leading-[1.4]';
const NOTE_MUTED = `${NOTE} text-[var(--mut)]`;
const NOTE_DANGER = `${NOTE} text-[var(--danger)]`;

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
  // Audit L11: reached with ?return= (setup, Edit) the shell's tabs may be hidden (sign-up focus mode),
  // so pick and crop carry their own way back. Without it, the tabs are the way back.
  const hasReturn = params.get('return') !== null;
  const backLabel = returnTo.split('?')[0] === APP_WELCOME_PATH ? 'Back to setup' : 'Back';

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
      showShellToast('Saved');
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
            : photoUploadFailureMessage(cause),
      );
      setPhase('preview');
    }
  };

  const inputStyle = useMemo(() => ({ display: 'none' }) as const, []);
  const backLink = hasReturn ? (
    <Link to={returnTo} replace className={LINK_GHOST} data-testid="photo-back">
      {backLabel}
    </Link>
  ) : null;

  return (
    <Card variant="padded" data-testid="dancer-screen-photo" aria-labelledby="photo-title" className="p-[14px]">
      <h1 id="photo-title" className="m-0 text-[20px] font-extrabold">
        Your photo
      </h1>

      {profileQuery.isError && (
        <div role="alert" className={NOTE}>
          <p className="m-0 text-[var(--danger)]">We could not load your profile, so we cannot save a photo yet. Check your connection and try again.</p>
          <GhostButton className="mt-[8px]" onClick={() => void profileQuery.refetch()}>
            Try again
          </GhostButton>
        </div>
      )}
      {profileQuery.isLoading && <p className={NOTE_MUTED}>Loading&hellip;</p>}

      {!online && (
        <p role="status" data-testid="photo-offline" className={NOTE_DANGER}>
          You are offline. You can still pick and crop a photo; saving needs a connection.
        </p>
      )}

      {phase === 'pick' && (
        <div data-testid="photo-pick">
          <p className={NOTE_MUTED}>
            Head and shoulders, facing the camera. This is how people find you.
          </p>
          <div className="mt-[12px] grid gap-[8px]">
            <label className={`${LINK_PRIMARY} cursor-pointer`}>
              Take photo
              <input type="file" accept="image/*" capture="user" onChange={onFile} style={inputStyle} data-testid="photo-input-camera" aria-label="Take photo" />
            </label>
            <label className={`${LINK_GHOST} cursor-pointer`}>
              Choose from my photos
              <input type="file" accept="image/*" onChange={onFile} style={inputStyle} data-testid="photo-input-library" aria-label="Choose from my photos" />
            </label>
            {backLink}
          </div>
          <p className={NOTE_MUTED}>
            If your camera does not open, allow camera access for this site in your browser settings, or choose from your photos instead.
          </p>
          {refusal && (
            <p role="alert" data-testid="photo-refusal" className={NOTE_DANGER}>
              {refusal} Pick another photo to carry on.
            </p>
          )}
          {current?.avatar_url && (
            <p className={NOTE_MUTED}>
              Your current photo stays until you save a new one.
            </p>
          )}
        </div>
      )}

      {phase === 'crop' && decoded && (
        <div data-testid="photo-crop">
          <p className={NOTE_MUTED}>
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
          {failure && <p role="alert" className={NOTE_DANGER}>{failure}</p>}
          <div className="mt-[12px] grid gap-[8px]">
            <PrimaryButton onClick={() => void makePreview()} testId="photo-crop-done">
              Next
            </PrimaryButton>
            <GhostButton onClick={startOver}>
              Choose a different photo
            </GhostButton>
            {backLink}
          </div>
        </div>
      )}

      {(phase === 'preview' || phase === 'saving') && previewUrl && (
        <div data-testid="photo-preview">
          <div style={{ width: '50%', aspectRatio: '1 / 1', margin: '12px auto 0', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
            <img src={previewUrl} alt="Your new photo" loading="eager" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
          <p className={`${NOTE} rounded-[12px] border border-[var(--line)] px-[12px] py-[10px] text-center text-[var(--fg)]`}>
            This is how people will see you.
          </p>
          {failure && (
            <p role="alert" data-testid="photo-failure" className={NOTE_DANGER}>
              {failure}
            </p>
          )}
          {!online && (
            <p className={NOTE_MUTED}>
              Use this photo is off until you are back online.
            </p>
          )}
          {profileQuery.isError && (
            <p className={NOTE_MUTED}>
              Use this photo is off until your profile has loaded. Press Try again above.
            </p>
          )}
          <div className="mt-[12px] grid gap-[8px]">
            <PrimaryButton disabled={!canUse} onClick={() => void save()} testId="photo-use">
              {phase === 'saving' ? 'Saving\u2026' : failure ? 'Try again' : 'Use this photo'}
            </PrimaryButton>
            <GhostButton disabled={phase === 'saving'} onClick={startOver} testId="photo-another">
              Take another
            </GhostButton>
          </div>
        </div>
      )}
    </Card>
  );
};

export default PhotoScreen;

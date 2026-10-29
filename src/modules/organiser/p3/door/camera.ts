import { useEffect, useRef, useState, type RefObject } from 'react';
import type { CameraState } from './model';

/*
 * The camera and the QR reader. BarcodeDetector (Android Chrome) where it reads qr_code; else
 * jsQR, imported ONLY here and only when it is needed, so no other screen ever loads it.
 * The camera stops when the tab is hidden or the screen goes, and starts again on return.
 */

export type Detect = (video: HTMLVideoElement) => Promise<string | null>;

interface BarcodeDetectorLike { detect(src: CanvasImageSource): Promise<Array<{ rawValue: string }>> }
interface BarcodeDetectorCtor {
  new (o: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

export async function makeDetector(): Promise<Detect> {
  const BD = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (BD) {
    try {
      const formats = (await BD.getSupportedFormats?.()) ?? ['qr_code'];
      if (formats.includes('qr_code')) {
        const d = new BD({ formats: ['qr_code'] });
        return async (v) => (await d.detect(v))[0]?.rawValue ?? null;
      }
    } catch {
      // fall through to jsQR
    }
  }
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return async (v) => {
    if (!ctx || !v.videoWidth) return null;
    // a 640px-wide frame is plenty for a ticket held at arm's length, and keeps a slow phone quick
    const scale = Math.min(1, 640 / v.videoWidth);
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
  };
}

export function cameraErrorState(e: unknown): CameraState {
  const name = (e as { name?: string } | null)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'none';
  return 'failed';
}

export interface ScannerDeps {
  getStream: () => Promise<MediaStream>;
  makeDetector: () => Promise<Detect>;
  /** ms between reads */
  every: number;
}

export const browserDeps: ScannerDeps = {
  getStream: () => {
    if (!navigator.mediaDevices?.getUserMedia) return Promise.reject(Object.assign(new Error('no camera'), { name: 'NotFoundError' }));
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  },
  makeDetector,
  every: 250,
};

/**
 * Reads codes from the camera while `enabled`; hands each one to onCode (the caller gates
 * repeats). Returns the camera's state for the screen to show.
 */
export function useScanner(video: RefObject<HTMLVideoElement>, enabled: boolean, onCode: (raw: string) => void, deps: ScannerDeps = browserDeps): CameraState {
  const [state, setState] = useState<CameraState>(enabled ? 'starting' : 'off');
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.visibilityState === 'hidden');
  const cb = useRef(onCode);
  cb.current = onCode;

  useEffect(() => {
    const on = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  useEffect(() => {
    // a dead camera keeps saying why while it is off; anything else just says paused
    if (!enabled || hidden) { setState((s) => (s === 'denied' || s === 'none' || s === 'failed' ? s : 'off')); return; }
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setState('starting');
    (async () => {
      try {
        stream = await deps.getStream();
        if (stopped) return;
        const v = video.current;
        if (v) {
          v.srcObject = stream;
          // autoplay refusals are harmless here: the video is muted and playsInline
          try { await v.play(); } catch { /* keep reading */ }
        }
        const detect = await deps.makeDetector();
        if (stopped) return;
        setState('on');
        const tick = async () => {
          if (stopped) return;
          const el = video.current;
          try {
            const raw = el ? await detect(el) : null;
            if (raw && !stopped) cb.current(raw);
          } catch {
            // one unreadable frame is not an error; try the next
          }
          if (!stopped) timer = setTimeout(tick, deps.every);
        };
        void tick();
      } catch (e) {
        if (!stopped) setState(cameraErrorState(e));
      }
    })();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      if (video.current) video.current.srcObject = null;
    };
  }, [enabled, hidden, deps, video]);

  return state;
}

/** Vibrate when the phone can; a no-op elsewhere (iPhone Safari has no vibrate). */
export function buzz(pattern: number[]) {
  if (!pattern.length) return;
  const nav = navigator as Navigator & { vibrate?: (p: number[]) => boolean };
  if (typeof nav.vibrate === 'function') {
    try { nav.vibrate(pattern); } catch { /* not allowed here */ }
  }
}

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { CameraPermission, CameraState } from './model';

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
  /** Read the camera permission WITHOUT asking. Left out = start the camera straight away (as before). */
  permission?: () => Promise<CameraPermission>;
  /** Tell me when the permission changes (a change made in settings); returns the unsubscribe. */
  watchPermission?: (cb: (p: CameraPermission) => void) => () => void;
}

type PermStatus = { state: string; addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void };
const queryCamera = async (): Promise<PermStatus | null> => {
  try {
    const q = navigator.permissions?.query;
    if (!q) return null;
    return (await navigator.permissions.query({ name: 'camera' as PermissionName })) as PermStatus;
  } catch {
    return null; // iOS Safari rejects the 'camera' name: unknown
  }
};
const asPerm = (st: PermStatus | null): CameraPermission =>
  st?.state === 'granted' || st?.state === 'prompt' || st?.state === 'denied' ? st.state : 'unknown';

export const browserDeps: ScannerDeps = {
  getStream: () => {
    if (!navigator.mediaDevices?.getUserMedia) return Promise.reject(Object.assign(new Error('no camera'), { name: 'NotFoundError' }));
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  },
  makeDetector,
  every: 250,
  permission: async () => asPerm(await queryCamera()),
  watchPermission: (cb) => {
    let off = () => {};
    let dead = false;
    void queryCamera().then((st) => {
      if (dead || !st?.addEventListener) return;
      const f = () => cb(asPerm(st));
      st.addEventListener('change', f);
      off = () => st.removeEventListener?.('change', f);
    });
    return () => { dead = true; off(); };
  },
};

/**
 * One camera run: open the stream, attach it to the video, read a frame every `deps.every` ms
 * and hand each code to onCode. Returns the stop function (tracks stopped, timer cleared).
 * A plain function, so the hook below only starts and stops it.
 */
export function runScanner(getVideo: () => HTMLVideoElement | null, deps: ScannerDeps, onCode: (raw: string) => void, onState: (s: CameraState) => void, tapped = true): () => void {
  let stopped = false;
  let stream: MediaStream | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attached: HTMLVideoElement | null = null;
  onState('starting');
  (async () => {
    try {
      // Read the permission BEFORE asking. Until the person taps Start camera, never call getUserMedia
      // when the answer is not already "granted" (a denied one is remembered by the browser).
      if (!tapped && deps.permission) {
        const p = await deps.permission();
        if (stopped) return;
        if (p === 'denied') { onState('denied'); return; }
        if (p !== 'granted') { onState('ask'); return; }
      }
      stream = await deps.getStream();
      if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
      attached = getVideo();
      if (attached) {
        attached.srcObject = stream;
        // autoplay refusals are harmless here: the video is muted and playsInline
        try { await attached.play(); } catch { /* keep reading */ }
      }
      const detect = await deps.makeDetector();
      if (stopped) return;
      onState('on');
      const tick = async () => {
        if (stopped) return;
        const el = getVideo();
        try {
          const raw = el ? await detect(el) : null;
          if (raw && !stopped) onCode(raw);
        } catch {
          // one unreadable frame is not an error; try the next
        }
        if (!stopped) timer = setTimeout(tick, deps.every);
      };
      void tick();
    } catch (e) {
      if (!stopped) onState(cameraErrorState(e));
    }
  })();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    stream?.getTracks().forEach((t) => t.stop());
    if (attached) attached.srcObject = null;
  };
}

/**
 * Reads codes from the camera while `enabled` and the tab is visible; hands each one to onCode
 * (the caller gates repeats). Returns the camera's state for the screen to show: a dead camera
 * keeps saying why while it is off; anything else off just says paused.
 */
export function useScanner(video: RefObject<HTMLVideoElement>, enabled: boolean, onCode: (raw: string) => void, deps: ScannerDeps = browserDeps): { state: CameraState; start: () => void; denials: number } {
  const [raw, setRaw] = useState<CameraState>('starting');
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.visibilityState === 'hidden');
  // each tap on Start camera / Try the camera again bumps this and runs the camera once more
  const [tries, setTries] = useState(0);
  // how many times the browser has said no: the second one is "Still blocked"
  const [denials, setDenials] = useState(0);
  const note = useCallback((s: CameraState) => { setRaw(s); if (s === 'denied') setDenials((n) => n + 1); }, []);
  const cb = useRef(onCode);
  useEffect(() => { cb.current = onCode; }, [onCode]);

  useEffect(() => {
    const on = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  const running = enabled && !hidden;
  useEffect(() => {
    if (!running) return undefined;
    return runScanner(() => video.current, deps, (c) => cb.current(c), note, tries > 0);
  }, [running, deps, video, tries, note]);

  // a change made in the browser settings is picked up without a reload
  useEffect(() => {
    if (!running || !deps.watchPermission) return undefined;
    return deps.watchPermission((p) => { if (p === 'granted') setTries((n) => n + 1); });
  }, [running, deps]);

  const start = useCallback(() => setTries((n) => n + 1), []);
  const state: CameraState = running ? raw : raw === 'denied' || raw === 'none' || raw === 'failed' || raw === 'ask' ? raw : 'off';
  return { state, start, denials };
}

/** Vibrate when the phone can; a no-op elsewhere (iPhone Safari has no vibrate). */
export function buzz(pattern: number[]) {
  if (!pattern.length) return;
  const nav = navigator as Navigator & { vibrate?: (p: number[]) => boolean };
  if (typeof nav.vibrate === 'function') {
    try { nav.vibrate(pattern); } catch { /* not allowed here */ }
  }
}

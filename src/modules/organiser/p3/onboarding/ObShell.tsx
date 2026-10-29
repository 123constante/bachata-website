import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import '../theme/p3.css';
import './onboarding.css';
import { useVisualViewportShell } from './obEnv';

export interface ObShellProps {
  /** The screen id: a new id is a new screen (slide in, title focused). */
  screen: string;
  dir: 'fwd' | 'back';
  /** 0-100, the share of the path done INCLUDING this screen (owner change 2). */
  percent: number;
  onBack: () => void;
  backLabel: string;
  /** Esc: closes an open sheet first (the caller knows), else Back. */
  onEscape: () => void;
  theme: 'light' | 'dark';
  children: ReactNode;
  foot: ReactNode;
}

/** The onboarding frame: top strip (Back, bar, percentage), one question, one primary button. */
export function ObShell({ screen, dir, percent, onBack, backLabel, onEscape, theme, children, foot }: ObShellProps) {
  const ref = useRef<HTMLDivElement>(null);
  useVisualViewportShell(ref);
  const esc = useRef(onEscape);
  useEffect(() => {
    esc.current = onEscape;
  }, [onEscape]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        esc.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const first = useRef(true);
  useLayoutEffect(() => {
    // The title takes focus on every new screen (not the first paint: a field there may autofocus).
    if (first.current) {
      first.current = false;
      return;
    }
    ref.current?.querySelector<HTMLElement>('.p3-ob-t')?.focus({ preventScroll: true });
  }, [screen]);
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div ref={ref} className="p3-theme p3-ob" data-theme={theme} data-testid="p3-ob-shell" data-screen={screen}>
      <div className="p3-ob-scr" key={screen} data-dir={dir} data-testid="p3-ob-screen">
        <div className="p3-ob-top">
          <button type="button" className="p3-ob-back" aria-label={backLabel} onClick={onBack} data-testid="p3-ob-back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="p3-ob-prog">
            <div
              className="p3-ob-bar"
              role="progressbar"
              aria-label="Progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-valuetext={`${pct}%`}
              data-testid="p3-ob-progress"
            >
              <i style={{ width: `${pct}%` }} />
            </div>
            <span className="p3-ob-pct" aria-hidden="true" data-testid="p3-ob-pct">{pct}%</span>
          </div>
        </div>
        <div className="p3-ob-main">{children}</div>
        <div className="p3-ob-foot">{foot}</div>
      </div>
    </div>
  );
}

/** A picker sheet, portalled to body (overlay rule), scrolling inside. Focus moves in without scrolling the page. */
export function ObSheet({ title, onClose, theme, children, testId }: { title: string; onClose: () => void; theme: 'light' | 'dark'; children: ReactNode; testId: string }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    return () => back?.focus?.({ preventScroll: true });
  }, []);
  return createPortal(
    <div className="p3-theme p3-ob-layer" data-theme={theme} data-kind="sheet" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="p3-ob-sheet" role="dialog" aria-modal="true" aria-label={title} data-testid={testId}>
        <div className="p3-ob-sheet-h">
          <h2>{title}</h2>
          <button ref={closeRef} type="button" className="p3-ob-close" aria-label="Close" onClick={onClose} data-testid={`${testId}-close`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="p3-ob-sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** A short message (e.g. why Continue is off, at 320 with the keyboard up), portalled to body. */
export function ObToast({ text, theme, onDone }: { text: string; theme: 'light' | 'dark'; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [text, onDone]);
  return createPortal(
    <div className="p3-theme p3-ob-layer" data-theme={theme} data-kind="toast">
      <div className="p3-ob-toast" role="status" data-testid="p3-ob-toast">{text}</div>
    </div>,
    document.body,
  );
}

/**
 * Owner change 3: a real flag image (emoji flags are letters on Windows). flagcdn.com is already
 * CSP-allowlisted (CityBlock, CityCard) and has the four home nations (gb-eng, gb-sct, gb-wls,
 * gb-nir). Lazy and in this route's own chunk: zero bytes on /app's first load.
 */
export function flagEmoji(code: string): string {
  const c = code.trim().toLowerCase();
  const cp = String.fromCodePoint;
  if (/^[a-z]{2}$/.test(c)) return [...c].map((ch) => cp(0x1f1e6 + ch.charCodeAt(0) - 97)).join('');
  if (/^gb-[a-z]{3}$/.test(c)) return cp(0x1f3f4) + [...`gb${c.slice(3)}`].map((ch) => cp(0xe0000 + ch.charCodeAt(0))).join('') + cp(0xe007f);
  return '';
}

export function Flag({ code }: { code: string }) {
  const [failed, setFailed] = useState(false);
  const c = code.trim().toLowerCase();
  if (!/^[a-z]{2}(-[a-z]{3})?$/.test(c)) return <span className="p3-ob-flag" data-failed="true" aria-hidden="true" />;
  // The image failed (CDN blocked / offline): show the emoji flag instead, never an empty box.
  if (failed) return <span className="p3-ob-flag" data-emoji="true" aria-hidden="true">{flagEmoji(c)}</span>;
  return (
    <img
      className="p3-ob-flag"
      src={`https://flagcdn.com/${c}.svg`}
      alt=""
      aria-hidden="true"
      width={24}
      height={18}
      loading="lazy"
      decoding="async"
      data-failed={failed ? 'true' : undefined}
      onError={() => setFailed(true)}
    />
  );
}

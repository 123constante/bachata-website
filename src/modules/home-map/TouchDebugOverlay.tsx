import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import {
  isTouchDebugEnabled,
  installTouchProbe,
  subscribeTouchLog,
  getTouchLog,
  clearTouchLog,
  tlog,
  type TouchLogEntry,
} from '@/lib/touchDebug';

/**
 * TEMPORARY diagnostic overlay for the festival-map popup dead-tap on iOS
 * Safari. Renders an on-screen log of the pointer/touch/click sequence so the
 * break can be observed on a real iPhone. Returns null (and installs nothing)
 * unless touchdebug is enabled, so it is safe to ship. Self-portals to
 * document.body, so a single mount covers both home layouts.
 *
 * REVERT once the root cause is confirmed on-device.
 */
export default function TouchDebugOverlay() {
  const enabled = isTouchDebugEnabled();
  const [, force] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    tlog(`UA ${navigator.userAgent}`);
    const uninstall = installTouchProbe();
    const unsub = subscribeTouchLog(() => force((n) => n + 1));
    return () => {
      unsub();
      uninstall();
    };
  }, [enabled]);

  const onCopy = useCallback(() => {
    const text = getTouchLog()
      .map((e: TouchLogEntry) => `${e.t.toFixed(0)} ${e.msg}`)
      .join('\n');
    try {
      void navigator.clipboard?.writeText(text);
    } catch {
      /* clipboard may be unavailable */
    }
  }, []);

  if (!enabled) return null;

  const log = getTouchLog();

  return createPortal(
    <div
      data-testid="touchdebug-overlay"
      className={cn(
        'fixed top-[64px] left-1 right-1 z-[9999] rounded-md shadow-lg',
        'bg-black/85 text-green-300 font-mono text-[10px] leading-tight',
        'pointer-events-auto select-text',
      )}
    >
      <div className="flex items-center gap-2 px-2 py-1 border-b border-white/15 text-white">
        <span className="font-bold">touchdebug</span>
        <span className="opacity-70">{log.length}</span>
        <button type="button" className="ml-auto px-1 underline" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? 'show' : 'hide'}
        </button>
        <button type="button" className="px-1 underline" onClick={onCopy}>
          copy
        </button>
        <button type="button" className="px-1 underline" onClick={() => clearTouchLog()}>
          clear
        </button>
      </div>
      {!collapsed && (
        <div className="max-h-[35vh] overflow-auto px-2 py-1 space-y-0.5">
          {log.length === 0 ? (
            <div className="opacity-60">tap a pin, then the popup...</div>
          ) : (
            [...log].reverse().map((e, i) => (
              <div key={log.length - i}>
                <span className="opacity-50">{e.t.toFixed(0)}</span> {e.msg}
              </div>
            ))
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}

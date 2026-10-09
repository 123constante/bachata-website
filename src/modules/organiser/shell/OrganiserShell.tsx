import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useKeyboardInset } from '../ui/useKeyboardInset';
import { TabBar } from './TabBar';
import '../theme.css';

export interface OrganiserShellProps {
  /** Simple top bar: a title (h1) and an optional back link. */
  title?: ReactNode;
  back?: { to: string; label?: string };
  /** Right side of the simple top bar (one small action). */
  topBarEnd?: ReactNode;
  /** Replaces the simple top bar entirely. */
  topBar?: ReactNode;
  /** Single-column content (phone-width column, centred on wide screens). */
  children?: ReactNode;
  /**
   * Two-column mode. >= 900px: `list` (300px, right border) beside `detail`.
   * Phone: `detail` when given, else `list` (they are separate routes).
   */
  list?: ReactNode;
  detail?: ReactNode;
  /** Wide screens only: shown in the detail column when `detail` is absent. */
  detailPlaceholder?: ReactNode;
  /** Sticky bottom action bar (e.g. PreviewBar). Sits above the tab bar, never over it. */
  actionBar?: ReactNode;
  hideTabs?: boolean;
  testId?: string;
}

/**
 * The organiser area frame: a fixed full-viewport layer (100dvh) over the
 * public chrome, laid out as a flex column -- top bar, scrolling content,
 * action bar, tab bar -- so nothing can overlap anything. Safe-area aware.
 * When the on-screen keyboard is up the frame shrinks above it and the tab
 * bar hides, so the action bar stays reachable.
 */
export function OrganiserShell({
  title,
  back,
  topBarEnd,
  topBar,
  children,
  list,
  detail,
  detailPlaceholder,
  actionBar,
  hideTabs = false,
  testId = 'org-shell',
}: OrganiserShellProps) {
  const { inset } = useKeyboardInset();
  const keyboardUp = inset > 0;
  const mainRef = useRef<HTMLDivElement>(null);
  // The frame shrinks above the keyboard, which can leave the focused field
  // under it: bring the field back into the visible part of the content.
  useEffect(() => {
    if (!keyboardUp) return;
    const el = document.activeElement;
    if (el instanceof HTMLElement && mainRef.current?.contains(el)) el.scrollIntoView?.({ block: 'nearest' });
  }, [keyboardUp, inset]);
  const split = list !== undefined || detail !== undefined;
  return (
    <div
      data-testid={testId}
      className="org-theme fixed inset-x-0 top-0 z-[60] flex flex-col"
      style={keyboardUp ? { bottom: inset } : { height: '100dvh' }}
    >
      <header className="shrink-0 border-b border-[var(--line)] bg-[var(--bg)]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        {topBar ?? (
          <div className="mx-auto flex h-[52px] max-w-[1280px] items-center gap-[4px] px-[8px]">
            {back ? (
              <Link
                to={back.to}
                data-testid="org-back"
                className="flex h-[44px] min-w-[44px] items-center gap-[2px] rounded-[12px] px-[8px] text-[15px] font-semibold text-[var(--gold)]"
              >
                <ChevronLeft aria-hidden="true" className="h-[20px] w-[20px]" />
                {back.label ?? 'Back'}
              </Link>
            ) : (
              <span className="w-[8px]" aria-hidden="true" />
            )}
            <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold">{title}</h1>
            {topBarEnd}
          </div>
        )}
      </header>
      {/* A div, not a second <main>: the site layout already has the page's one main landmark (id=main-content). */}
      <div ref={mainRef} data-testid="org-content" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {split ? (
          <div className="org-split" data-has-detail={detail !== undefined}>
            <div className="org-split-list" data-testid="org-list">
              <div className="px-[16px] py-[16px]">{list}</div>
            </div>
            <div className="org-split-detail" data-testid="org-detail">
              <div className="mx-auto max-w-[640px] px-[16px] py-[16px]">{detail ?? detailPlaceholder}</div>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[640px] px-[16px] py-[16px]">{children}</div>
        )}
      </div>
      {actionBar && (
        <div
          data-testid="org-actionbar"
          className={cn('shrink-0 border-t border-[var(--line)] bg-[var(--bg)]')}
          style={{ paddingBottom: hideTabs || keyboardUp ? 'env(safe-area-inset-bottom)' : undefined }}
        >
          <div className="mx-auto max-w-[640px]">{actionBar}</div>
        </div>
      )}
      {!hideTabs && !keyboardUp && <TabBar />}
    </div>
  );
}

import { createContext, useContext, useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronLeft, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useKeyboardInset } from './useKeyboardInset';

/** Set inside a SheetView so a second one inside it is caught at once. */
const InSheet = createContext(false);

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export const NESTED_SHEET_ERROR =
  'SheetView inside SheetView: nested dialogs are banned in the organiser area. Swap views inside the one sheet (viewKey + onBack) instead.';

export interface SheetViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Header title for the CURRENT view. */
  title: string;
  /** Screen-reader description (optional). */
  description?: string;
  /**
   * Identity of the current view ('list', 'search', ...). Changing it swaps
   * the body in place, scrolls it to the top and moves focus to the element
   * marked data-sheet-autofocus (else the title). One sheet, no nesting.
   */
  viewKey?: string;
  /** Shows a Back button and makes Escape go back instead of closing. */
  onBack?: () => void;
  backLabel?: string;
  closeLabel?: string;
  /** 85dvh tall (capped to the visible viewport above the keyboard). */
  fullHeight?: boolean;
  /** Sticky footer: stays above the on-screen keyboard (hidden while typing on screens under 360px visible). */
  footer?: ReactNode;
  children: ReactNode;
  /**
   * Where focus goes on close. Default: whatever had focus when the sheet
   * opened (the opener). Pass the opener's ref where taps do not focus
   * buttons (iOS Safari).
   */
  returnFocusRef?: RefObject<HTMLElement>;
  testId?: string;
}

/**
 * The organiser bottom sheet. Built on the Radix Dialog that
 * src/components/ui/sheet.tsx uses: focus trap, focus returns to the opener,
 * Escape closes only the top layer. Slides up over 0.3s; instant under
 * reduced motion. A SheetView rendered inside another throws in development.
 */
export function SheetView({
  open,
  onOpenChange,
  title,
  description,
  viewKey,
  onBack,
  backLabel = 'Back',
  closeLabel = 'Close',
  fullHeight = false,
  footer,
  children,
  returnFocusRef,
  testId = 'org-sheet',
}: SheetViewProps) {
  const nested = useContext(InSheet);
  if (nested) {
    if (import.meta.env.DEV) throw new Error(NESTED_SHEET_ERROR);
    console.error(NESTED_SHEET_ERROR);
  }
  const { inset, height } = useKeyboardInset(open);
  const contentRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const firstView = useRef(true);
  // Radix only returns focus to a Dialog.Trigger; this sheet is controlled, so
  // remember the opener ourselves. A layout effect runs before Radix's focus
  // scope moves focus into the sheet, so activeElement is still the opener.
  const opener = useRef<HTMLElement | null>(null);
  useIsoLayoutEffect(() => {
    if (open) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [open]);

  useEffect(() => {
    if (firstView.current) {
      firstView.current = false;
      return;
    }
    if (!open) return;
    bodyRef.current?.scrollTo?.({ top: 0 });
    const target = contentRef.current?.querySelector<HTMLElement>('[data-sheet-autofocus]');
    (target ?? titleRef.current)?.focus();
  }, [viewKey, open]);

  const cap = height !== null ? `${Math.max(0, height - 12)}px` : '100dvh';
  // Keyboard up on a short screen (e.g. 390x500 landscape-ish): the grabber
  // and the sticky footer step aside so the field and first result stay in
  // view. The footer comes back the moment the keyboard closes.
  const cramped = inset > 0 && height !== null && height < 360;
  const size = fullHeight ? { height: `min(85dvh, ${cap})` } : { maxHeight: `min(85dvh, ${cap})` };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="org-sheet-overlay fixed inset-0 z-[70] bg-black/60 duration-300 ease-in-out data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        />
        <Dialog.Content
          ref={contentRef}
          data-testid={testId}
          data-view={viewKey}
          {...(description ? {} : { 'aria-describedby': undefined })}
          onOpenAutoFocus={(e) => {
            const target = contentRef.current?.querySelector<HTMLElement>('[data-sheet-autofocus]');
            if (target) {
              e.preventDefault();
              target.focus();
            }
          }}
          onCloseAutoFocus={(e) => {
            const back = returnFocusRef?.current ?? opener.current;
            if (back && back.isConnected && back !== document.body) {
              e.preventDefault();
              back.focus();
            }
          }}
          onEscapeKeyDown={(e) => {
            if (onBack) {
              e.preventDefault();
              onBack();
            }
          }}
          style={{ bottom: inset, background: 'var(--sheet)', animationTimingFunction: 'ease-in-out', ...size }}
          className={cn(
            'org-theme org-sheet fixed inset-x-0 z-[71] mx-auto flex w-full max-w-[640px] flex-col rounded-t-[24px] shadow-[0_-12px_40px_rgba(0,0,0,.55)] outline-none',
            'duration-300 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom',
          )}
        >
          {!cramped && <div aria-hidden="true" className="mx-auto mt-[8px] h-[4px] w-[40px] shrink-0 rounded-full bg-[var(--line-strong)]" />}
          <div className="flex shrink-0 items-center gap-[4px] px-[8px] pb-[4px] pt-[4px]">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                data-testid={`${testId}-back`}
                className="flex h-[44px] min-w-[44px] items-center gap-[2px] rounded-[12px] px-[8px] text-[15px] font-semibold text-[var(--gold)]"
              >
                <ChevronLeft aria-hidden="true" className="h-[20px] w-[20px]" />
                {backLabel}
              </button>
            ) : (
              <span className="w-[44px]" aria-hidden="true" />
            )}
            <Dialog.Title
              ref={titleRef}
              tabIndex={-1}
              data-testid={`${testId}-title`}
              className="min-w-0 flex-1 truncate text-center text-[16px] font-bold text-[var(--fg)] outline-none"
            >
              {title}
            </Dialog.Title>
            <Dialog.Close
              aria-label={closeLabel}
              data-testid={`${testId}-close`}
              className="flex h-[44px] w-[44px] items-center justify-center rounded-full text-[var(--fg)]"
            >
              <X aria-hidden="true" className="h-[20px] w-[20px]" />
            </Dialog.Close>
          </div>
          {description ? (
            <Dialog.Description className="sr-only">{description}</Dialog.Description>
          ) : null}
          <div ref={bodyRef} data-testid={`${testId}-body`} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[16px] pb-[16px] pt-[8px]">
            <InSheet.Provider value={true}>{children}</InSheet.Provider>
          </div>
          {footer && !cramped && (
            <div
              data-testid={`${testId}-footer`}
              className="shrink-0 border-t border-[var(--line)] px-[16px] pt-[12px]"
              style={{ paddingBottom: inset > 0 ? 12 : 'max(12px, env(safe-area-inset-bottom))' }}
            >
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

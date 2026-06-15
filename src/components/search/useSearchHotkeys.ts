import { useEffect } from 'react';

// Global search hotkeys: Cmd/Ctrl+K always opens the overlay; a bare "/" opens
// it too, unless the user is typing in a field (input/textarea/select/
// contenteditable). Mirrors the Raycast / Linear command-palette convention.
// `enabled` is false when search v5 is flagged off, so we never hijack the
// browser's own Cmd+K / "/" in that case.
function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function useSearchHotkeys(onOpen: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        onOpen();
        return;
      }
      if (e.key === '/' && !meta && !e.altKey && !isEditableTarget(e.target)) {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpen, enabled]);
}

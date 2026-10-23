import { useEffect, useSyncExternalStore } from 'react';

/**
 * The shell's own toast (D119 "Saved"). Module-level so it outlives the screen that raised it: a photo save
 * navigates back to its return= target and the toast has to still be there. Rendered once, by DancerAppShell.
 */
const TOAST_MS = 2600;
let message: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const showShellToast = (text: string): void => {
  message = text;
  emit();
  clearTimeout(timer);
  timer = setTimeout(() => {
    message = null;
    emit();
  }, TOAST_MS);
};

export const resetShellToast = (): void => {
  clearTimeout(timer);
  message = null;
  emit();
};

export const ShellToast = () => {
  const text = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => message,
    () => null,
  );
  useEffect(() => resetShellToast, []);
  if (!text) return null;
  return (
    <div className="da-toast" role="status" data-testid="da-toast">
      {text}
    </div>
  );
};

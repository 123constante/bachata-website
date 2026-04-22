const STORAGE_KEY = 'bcal_viewer_session';

export function getViewerSession(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    sessionStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return '';
  }
}

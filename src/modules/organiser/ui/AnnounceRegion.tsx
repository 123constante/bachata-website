/** Visually hidden aria-live="polite" region. Render once per screen. */
export function AnnounceRegion({ message, testId = 'org-announce' }: { message: string; testId?: string }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" data-testid={testId} className="sr-only">
      {message}
    </div>
  );
}

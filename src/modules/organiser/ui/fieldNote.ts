/** The id of a Field's error line: the control points aria-describedby at it (B-S9). */
export const fieldNoteId = ({ testId, htmlFor }: { testId?: string; htmlFor?: string }): string | undefined =>
  testId ? `${testId}-error` : htmlFor ? `${htmlFor}-help` : undefined;

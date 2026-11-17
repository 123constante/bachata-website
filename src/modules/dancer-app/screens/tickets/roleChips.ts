export type RoleId = 'dancer' | 'dj' | 'teacher' | 'organiser' | 'videographer' | 'venue';

export const ROLE_CHIPS: readonly { id: RoleId; label: string }[] = [
  { id: 'dancer', label: 'Dancer' },
  { id: 'dj', label: 'DJ' },
  { id: 'teacher', label: 'Teacher' },
  { id: 'organiser', label: 'Organiser' },
  { id: 'videographer', label: 'Videographer' },
  { id: 'venue', label: 'Venue' },
];

/** Shown under the chips for a role with no flow to hand off to today. */
export const ROLE_SOON = 'is coming soon. We will add it here as soon as it opens.';

/**
 * Where a chip hands off: the EXISTING flows, never a copy of them. A chip is a link, so an
 * untouched sheet sends nothing. null = parked ("coming soon"). Dancer is parked for a person
 * the dancer-area gate does not admit (view-only): /app/welcome would only bounce them to
 * /account.
 */
export function roleTarget(role: RoleId, opts: { viewOnly: boolean; welcomeHref: string; organiserHref: string; teacherHref: string; djHref: string }): string | null {
  switch (role) {
    case 'dancer':
      return opts.viewOnly ? null : opts.welcomeHref;
    case 'organiser':
      return opts.organiserHref;
    case 'teacher':
      return opts.teacherHref;
    case 'dj':
      return opts.djHref;
    default:
      return null;
  }
}


// search_public_v7 people helpers: ONE mapping for the role line, the
// screen-reader label and the telemetry kind, shared by the header omnibox,
// the full-screen overlay and the /search page (never three copies).
export type PersonRole = 'teacher' | 'dj' | 'dancer';

export const ROLE_ORDER: PersonRole[] = ['teacher', 'dj', 'dancer'];
const ROLE_LABEL: Record<PersonRole, string> = { teacher: 'Teacher', dj: 'DJ', dancer: 'Dancer' };

/** Known roles only, in the fixed order Teacher, DJ, Dancer, de-duplicated. */
export function orderedRoles(roles: readonly string[] | null | undefined): PersonRole[] {
  const have = new Set(roles ?? []);
  return ROLE_ORDER.filter((r) => have.has(r));
}

/** "Teacher · DJ · Dancer" (middle dot), or '' when there is no role. */
export function roleLine(roles: readonly string[] | null | undefined): string {
  return orderedRoles(roles).map((r) => ROLE_LABEL[r]).join(' · ');
}

/** "Carlos Mendez, Teacher, DJ, Dancer" for aria-label. */
export function personAriaLabel(name: string, roles: readonly string[] | null | undefined): string {
  const labels = orderedRoles(roles).map((r) => ROLE_LABEL[r]);
  return labels.length ? `${name}, ${labels.join(', ')}` : name;
}

/** Old entity kind logged to record_search_result_click_v1 (no new entity_type). */
export function telemetryKindFor(primary: string | null | undefined, roles?: readonly string[] | null): PersonRole {
  if (primary === 'teacher' || primary === 'dj' || primary === 'dancer') return primary;
  return orderedRoles(roles)[0] ?? 'dancer';
}

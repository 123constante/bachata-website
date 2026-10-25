import { L } from './labels';
import type { P3Person, RoleKey } from './types';

/** A pair or a group ("Marco & Elena", "Daniel y Tom", "Pao Pao Army") takes the plural noun. */
export function isGroup(name: string): boolean {
  return /&| y | and |Army|Crew|Company/.test(name);
}

/** The role as a noun after a name: "teachers" for "Marco & Elena", "DJ" for "DJ Kizzy". */
export function roleNoun(name: string, role: RoleKey): string {
  const w = L.roleNoun[role] ?? L.roleNoun.teach;
  return w[isGroup(name) ? 1 : 0];
}

/** "Marco & Elena, teachers \u00b7 DJ Kizzy, DJ" */
export function peopleText(people: ReadonlyArray<P3Person>): string {
  return people.map((p) => `${p.name}, ${roleNoun(p.name, p.role)}`).join(' \u00b7 ');
}

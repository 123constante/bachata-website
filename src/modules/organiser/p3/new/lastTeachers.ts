import { addRoleFor } from '../../dates/dateModel';
import { parseTree } from '../../events/programmeSeriesModel';
import { fetchEventWorkspace } from '../../shared/runCommands';
import type { SessForm } from '../data/sessions';
import type { P3Row } from '../data/home';
import { PEOPLE_PER_SESSION_MAX } from './model';

export type TeachPerson = { profileId: string; name: string; role: 'teaching' };

/** The teaching people of each teaching session of a workspace's programme, in programme order (sessions with none are skipped). */
export function teachersOfWorkspace(ws: { program: unknown } | null | undefined): TeachPerson[][] {
  const out: TeachPerson[][] = [];
  for (const day of parseTree(ws?.program).days) {
    for (const sec of day.sections) {
      for (const it of sec.items) {
        if (addRoleFor(it.type) !== 'teaching') continue;
        const people = it.people
          .filter((p) => p.role === 'teaching')
          .map((p): TeachPerson => ({ profileId: p.profileId, name: p.name, role: 'teaching' }));
        if (people.length) out.push(people);
      }
    }
  }
  return out;
}

/** The i-th teaching form with no people gets source[i] (else the last source), capped. Others untouched. */
export function prefillTeachers(forms: SessForm[], source: TeachPerson[][]): { forms: SessForm[]; filled: boolean } {
  if (!source.length) return { forms, filled: false };
  let n = 0;
  let filled = false;
  const next = forms.map((s) => {
    if (addRoleFor(s.type) !== 'teaching') return s;
    const i = n++;
    if (s.people?.length) return s;
    const people = (source[i] ?? source[source.length - 1]).slice(0, PEOPLE_PER_SESSION_MAX);
    if (!people.length) return s;
    filled = true;
    return { ...s, people };
  });
  return { forms: next, filled };
}

/** The latest event's teachers: the first of the first 3 rows (next date first) whose programme has a teaching person. Failed read = null. */
export async function latestTeachers(rows: readonly P3Row[]): Promise<{ from: string; people: TeachPerson[][] } | null> {
  const ordered = [...rows.filter((r) => r.next), ...rows.filter((r) => !r.next)].slice(0, 3);
  for (const r of ordered) {
    try {
      const people = teachersOfWorkspace(await fetchEventWorkspace(r.id));
      if (people.length) return { from: r.name, people };
    } catch { /* silent: no prefill */ }
  }
  return null;
}

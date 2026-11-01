// PROTOTYPE (search v7 mockups). REAL people from prod, read-only; nothing here is invented
// except ORGANISER_FIXTURE (get_public_person_organisers_v1 may not be applied yet).
export type FixtureKey = 'roger' | 'gatica' | 'threerole' | 'djonly';
export type Arrangement = 'stamps' | 'stacked' | 'tabs';

export const FIXTURES: Record<FixtureKey, { id: string; slug: string; withTeacher: boolean; organiser: boolean }> = {
  // Roger Cracco: DJ + Dancing (the teacher role is hidden while the teacher pages are closed).
  roger: { id: '005a7329-90a3-4d81-8854-296a4a6db673', slug: 'roger-cracco', withTeacher: false, organiser: true },
  // Gatica: prod says Teacher + Dancer (NOT a DJ); teacher hidden, so today it is Dancing only.
  gatica: { id: '017dee9f-c30a-45e3-b2b9-01dab3cb8062', slug: 'gatica', withTeacher: false, organiser: false },
  // A different real person who holds teacher + DJ + dancer rows; the teacher role is shown here.
  threerole: { id: '04ca2889-870a-4891-9a97-cb6231020d73', slug: '04ca2889-870a-4891-9a97-cb6231020d73', withTeacher: true, organiser: true },
  // A real person whose only public role is DJ.
  djonly: { id: '59150b2d-0963-4cea-80fd-76c2d48ab23c', slug: '59150b2d-0963-4cea-80fd-76c2d48ab23c', withTeacher: false, organiser: false },
};

export const ARRANGEMENTS: Arrangement[] = ['stamps', 'stacked', 'tabs'];

/** FIXTURE, not data: the organiser line until the organiser read is applied on prod. */
export const ORGANISER_FIXTURE = { name: 'Sample Bachata Nights', href: '/organisers' };

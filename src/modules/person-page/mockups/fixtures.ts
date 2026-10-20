// PROTOTYPE (search v7 mockups). REAL people from prod, read-only; nothing here is invented
// except ORGANISER_FIXTURE (get_public_person_organisers_v1 may not be applied yet).
export type FixtureKey = 'chiwei' | 'roger' | 'gatica' | 'threerole' | 'djonly' | 'pierre' | 'javier' | 'tcher';
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
  // S8 thin people (picked by a read-only SELECT, see docs/handover/s8-mockups.md).
  // Teacher-only, no photo: Pierre Henry. Dancer-only, no bio/description, has a photo: Javier.
  pierre: { id: '0dd8819b-1aa1-4c6e-9747-f09b2c177a0c', slug: '0dd8819b-1aa1-4c6e-9747-f09b2c177a0c', withTeacher: true, organiser: false },
  // Teacher-only with a working get_public_teacher_detail_v1 row (Pierre's read is empty); has a photo on prod.
  tcher: { id: '57ef6bdc-e03a-4072-8fde-7a021f538147', slug: '57ef6bdc-e03a-4072-8fde-7a021f538147', withTeacher: true, organiser: false },
  // S11: dancer-only, has favourite songs (2) in dancing_role_details.
  chiwei: { id: '797fab23-340a-4fd8-9feb-081c95ef7532', slug: '797fab23-340a-4fd8-9feb-081c95ef7532', withTeacher: false, organiser: false },
  javier: { id: '26ef26e9-ace4-4eef-9722-b6ea54e9699b', slug: '26ef26e9-ace4-4eef-9722-b6ea54e9699b', withTeacher: false, organiser: false },
};

export const ARRANGEMENTS: Arrangement[] = ['stamps', 'stacked', 'tabs'];

/** FIXTURE, not data: the organiser line until the organiser read is applied on prod. */
export const ORGANISER_FIXTURE = { name: 'Sample Bachata Nights', href: '/organisers' };

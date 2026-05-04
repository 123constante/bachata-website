/**
 * F.2.d — Schedule Storybook fixtures.
 *
 * All fixtures are pure TS objects with no Supabase dependency.
 * They exercise the 8 canonical story scenarios for ScheduleGrid + SessionCell.
 */

import type { Person, ScheduleSession } from '@/modules/event-page/sections/EventScheduleGrid';

// ─── Reusable person stubs ────────────────────────────────────────────────────

const makePerson = (
  id: string,
  name: string,
  img: number,
  role: 'Teacher' | 'DJ' = 'Teacher',
): Person => ({
  id,
  name,
  href: `/profile/${id}`,
  avatarUrl: `https://i.pravatar.cc/64?img=${img}`,
  role,
  profileType: role === 'DJ' ? 'dj' : 'teacher',
  level: null,
});

const CARLOS   = makePerson('carlos',   'Carlos Cinta',      1);
const MARINA   = makePerson('marina',   'Marina Koval',      2);
const TOMMY    = makePerson('tommy',    'Tommy Vega',        3);
const INES     = makePerson('ines',     'Inés Paredes',      4);
const DAMARYS  = makePerson('damarys',  'Damarys Moreno',    5);
const CARLTON  = makePerson('carlton',  'Carlton Gibson',    6);
const ROMEO    = makePerson('romeo',    'Romeo García',      7);
const DJayMR   = makePerson('dj-mr',    'DJ MR',             8, 'DJ');
const DJaySOL  = makePerson('dj-sol',  'DJ Sol',            9, 'DJ');
const SARA     = makePerson('sara',     'Sara Ruiz',        10);
const FELIX    = makePerson('felix',    'Félix Okonkwo',    11);
const LYDIA    = makePerson('lydia',    'Lydia Chen',       12);
const ENZO     = makePerson('enzo',     'Enzo Ricci',       13);
const PRIYA    = makePerson('priya',    'Priya Nair',       14);
const KWAME    = makePerson('kwame',    'Kwame Asante',     15);

// ─── Story 1 — Single room / 1 person ────────────────────────────────────────

export const story1Sessions: ScheduleSession[] = [
  {
    id: 's1',
    title: 'Bachata Sensual Foundations',
    type: 'class',
    day: '2025-06-07',
    startMins: 11 * 60,
    endMins: 12 * 60,
    levels: ['beginner'],
    room: null,
    people: [CARLOS],
  },
];
export const story1Rooms: string[] = [];

// ─── Story 2 — Single room / 3 people ────────────────────────────────────────

export const story2Sessions: ScheduleSession[] = [
  {
    id: 's2',
    title: 'Sensual Flow Partner Work',
    type: 'class',
    day: '2025-06-07',
    startMins: 12 * 60,
    endMins: 13 * 60,
    levels: ['intermediate'],
    room: null,
    people: [CARLOS, MARINA, TOMMY],
  },
];
export const story2Rooms: string[] = [];

// ─── Story 3 — Single room / 7 people (chip-overlap "+1" overflow) ────────────

export const story3Sessions: ScheduleSession[] = [
  {
    id: 's3',
    title: 'Festival All-Stars Showcase',
    type: 'class',
    day: '2025-06-07',
    startMins: 14 * 60,
    endMins: 15 * 60,
    levels: ['open_level'],
    room: null,
    people: [CARLOS, MARINA, TOMMY, INES, DAMARYS, CARLTON, ROMEO],
  },
];
export const story3Rooms: string[] = [];

// ─── Story 4 — 2 rooms / single level per session ────────────────────────────

export const story4Sessions: ScheduleSession[] = [
  {
    id: 's4a',
    title: 'Bachata Dominicana',
    type: 'class',
    day: '2025-06-07',
    startMins: 11 * 60,
    endMins: 12 * 60,
    levels: ['beginner'],
    room: 'Latin Room',
    people: [CARLOS, MARINA],
  },
  {
    id: 's4b',
    title: 'Son Cubano',
    type: 'class',
    day: '2025-06-07',
    startMins: 11 * 60,
    endMins: 12 * 60,
    levels: ['beginner'],
    room: 'Cuban Room',
    people: [INES, ROMEO],
  },
  {
    id: 's4c',
    title: 'Sensual Technique',
    type: 'class',
    day: '2025-06-07',
    startMins: 12 * 60,
    endMins: 13 * 60,
    levels: ['intermediate'],
    room: 'Latin Room',
    people: [TOMMY, DAMARYS],
  },
  {
    id: 's4d',
    title: 'Rueda de Casino',
    type: 'class',
    day: '2025-06-07',
    startMins: 12 * 60,
    endMins: 13 * 60,
    levels: ['intermediate'],
    room: 'Cuban Room',
    people: [CARLTON, FELIX],
  },
];
export const story4Rooms: string[] = ['Latin Room', 'Cuban Room'];

// ─── Story 5 — 2 rooms / per-level bindings (Phase C) ────────────────────────
// Carlton teaches Beginners; Damarys teaches Intermediates in the same slot.

const CARLTON_BEG: Person = { ...CARLTON, level: 'beginner' };
const DAMARYS_INT: Person = { ...DAMARYS, level: 'intermediate' };

export const story5Sessions: ScheduleSession[] = [
  {
    id: 's5a',
    title: 'Cuban Motion Deep Dive',
    type: 'class',
    day: '2025-06-07',
    startMins: 11 * 60,
    endMins: 12 * 60,
    levels: ['beginner', 'intermediate'],
    room: 'Cuban Room',
    people: [CARLTON_BEG, DAMARYS_INT],
  },
  {
    id: 's5b',
    title: 'Sensual Flow',
    type: 'class',
    day: '2025-06-07',
    startMins: 11 * 60,
    endMins: 12 * 60,
    levels: ['intermediate'],
    room: 'Latin Room',
    people: [CARLOS, MARINA],
  },
  {
    id: 's5c',
    title: 'Body Movement',
    type: 'class',
    day: '2025-06-07',
    startMins: 12 * 60,
    endMins: 13 * 60,
    levels: ['beginner', 'intermediate'],
    room: 'Cuban Room',
    people: [
      { ...ROMEO,  level: 'beginner' },
      { ...SARA,   level: 'intermediate' },
    ],
  },
  {
    id: 's5d',
    title: 'Styling Workshop',
    type: 'class',
    day: '2025-06-07',
    startMins: 12 * 60,
    endMins: 13 * 60,
    levels: ['open_level'],
    room: 'Latin Room',
    people: [INES],
  },
];
export const story5Rooms: string[] = ['Cuban Room', 'Latin Room'];

// ─── Story 6 — 3 rooms / mixed kinds (class + masterclass + party) ────────────

export const story6Sessions: ScheduleSession[] = [
  // Saturday classes block
  {
    id: 's6a',
    title: 'Bachata Sensual',
    type: 'class',
    day: '2025-06-07',
    startMins: 10 * 60,
    endMins: 11 * 60,
    levels: ['beginner'],
    room: 'Room A',
    people: [CARLOS, MARINA],
  },
  {
    id: 's6b',
    title: 'Dominican Technique',
    type: 'class',
    day: '2025-06-07',
    startMins: 10 * 60,
    endMins: 11 * 60,
    levels: ['intermediate'],
    room: 'Room B',
    people: [TOMMY, INES],
  },
  {
    id: 's6c',
    title: 'Footwork Lab',
    type: 'masterclass',
    day: '2025-06-07',
    startMins: 10 * 60,
    endMins: 11 * 60,
    levels: ['advanced'],
    room: 'Room C',
    people: [DAMARYS, CARLTON],
  },
  // Afternoon — different sessions
  {
    id: 's6d',
    title: 'Styling & Shines',
    type: 'class',
    day: '2025-06-07',
    startMins: 11 * 60,
    endMins: 12 * 60,
    levels: ['intermediate'],
    room: 'Room A',
    people: [ROMEO],
  },
  {
    id: 's6e',
    title: 'Afro Fusion',
    type: 'class',
    day: '2025-06-07',
    startMins: 11 * 60,
    endMins: 12 * 60,
    levels: ['open_level'],
    room: 'Room B',
    people: [FELIX, SARA],
  },
  // Party in Room C
  {
    id: 's6f',
    title: 'Saturday Night Social',
    type: 'party',
    day: '2025-06-07',
    startMins: 22 * 60,
    endMins: 24 * 60 + 30,
    levels: [],
    room: 'Room C',
    people: [DJayMR, DJaySOL],
  },
];
export const story6Rooms: string[] = ['Room A', 'Room B', 'Room C'];

// ─── Story 7 — Festival Day 1: 2 rooms, 4 time slots ─────────────────────────

export const story7Sessions: ScheduleSession[] = [
  {
    id: 'f7-1a',
    title: 'Bachata Sensual Level 1',
    type: 'class',
    day: '2025-08-01',
    startMins: 10 * 60,
    endMins: 11 * 60,
    levels: ['beginner'],
    room: 'Dance Hall 1',
    people: [CARLOS, MARINA],
  },
  {
    id: 'f7-1b',
    title: 'Cuban Salsa Intro',
    type: 'class',
    day: '2025-08-01',
    startMins: 10 * 60,
    endMins: 11 * 60,
    levels: ['beginner'],
    room: 'Dance Hall 2',
    people: [INES, ROMEO],
  },
  {
    id: 'f7-2a',
    title: 'Sensual Technique',
    type: 'class',
    day: '2025-08-01',
    startMins: 11 * 60 + 30,
    endMins: 12 * 60 + 30,
    levels: ['intermediate'],
    room: 'Dance Hall 1',
    people: [TOMMY],
  },
  {
    id: 'f7-2b',
    title: 'Timba Footwork',
    type: 'class',
    day: '2025-08-01',
    startMins: 11 * 60 + 30,
    endMins: 12 * 60 + 30,
    levels: ['intermediate', 'advanced'],
    room: 'Dance Hall 2',
    people: [DAMARYS, CARLTON],
  },
  {
    id: 'f7-3a',
    title: 'Flow & Connection',
    type: 'masterclass',
    day: '2025-08-01',
    startMins: 14 * 60,
    endMins: 15 * 60,
    levels: ['advanced'],
    room: 'Dance Hall 1',
    people: [CARLOS, INES],
  },
  {
    id: 'f7-3b',
    title: 'Open Styling',
    type: 'class',
    day: '2025-08-01',
    startMins: 14 * 60,
    endMins: 15 * 60,
    levels: ['open_level'],
    room: 'Dance Hall 2',
    people: [MARINA, ROMEO],
  },
  {
    id: 'f7-party',
    title: 'Festival Party Night',
    type: 'party',
    day: '2025-08-01',
    startMins: 21 * 60,
    endMins: 24 * 60 + 30,
    levels: [],
    room: 'Dance Hall 1',
    people: [DJayMR, DJaySOL],
  },
];
export const story7Rooms: string[] = ['Dance Hall 1', 'Dance Hall 2'];

// ─── Story 8 — Festival Day 2: 3 rooms + per-level bindings ──────────────────

export const story8Sessions: ScheduleSession[] = [
  {
    id: 'f8-1a',
    title: 'Multi-Level Bachata',
    type: 'class',
    day: '2025-08-02',
    startMins: 10 * 60,
    endMins: 11 * 60,
    levels: ['beginner', 'intermediate', 'advanced'],
    room: 'Main Stage',
    people: [
      { ...LYDIA,  level: 'beginner' },
      { ...ENZO,   level: 'intermediate' },
      { ...PRIYA,  level: 'advanced' },
    ],
  },
  {
    id: 'f8-1b',
    title: 'Cuban Motion',
    type: 'class',
    day: '2025-08-02',
    startMins: 10 * 60,
    endMins: 11 * 60,
    levels: ['beginner'],
    room: 'Studio B',
    people: [INES, ROMEO],
  },
  {
    id: 'f8-1c',
    title: 'Afro House Workshop',
    type: 'masterclass',
    day: '2025-08-02',
    startMins: 10 * 60,
    endMins: 11 * 60,
    levels: ['advanced'],
    room: 'Studio C',
    people: [KWAME, FELIX],
  },
  {
    id: 'f8-2a',
    title: 'Sensual Styling',
    type: 'class',
    day: '2025-08-02',
    startMins: 11 * 60 + 30,
    endMins: 12 * 60 + 30,
    levels: ['intermediate', 'advanced'],
    room: 'Main Stage',
    people: [
      { ...DAMARYS, level: 'intermediate' },
      { ...CARLTON, level: 'advanced' },
    ],
  },
  {
    id: 'f8-2b',
    title: 'Partner Connection',
    type: 'class',
    day: '2025-08-02',
    startMins: 11 * 60 + 30,
    endMins: 12 * 60 + 30,
    levels: ['open_level'],
    room: 'Studio B',
    people: [SARA, TOMMY],
  },
  {
    id: 'f8-2c',
    title: 'Roots & Rhythm',
    type: 'class',
    day: '2025-08-02',
    startMins: 11 * 60 + 30,
    endMins: 12 * 60 + 30,
    levels: ['open_level'],
    room: 'Studio C',
    people: [CARLOS, MARINA],
  },
  {
    id: 'f8-party',
    title: 'Sunday Night Closing Party',
    type: 'party',
    day: '2025-08-02',
    startMins: 21 * 60 + 30,
    endMins: 24 * 60 + 30,
    levels: [],
    room: 'Main Stage',
    people: [DJayMR, DJaySOL],
  },
];
export const story8Rooms: string[] = ['Main Stage', 'Studio B', 'Studio C'];

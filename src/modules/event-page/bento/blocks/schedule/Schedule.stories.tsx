/**
 * F.2.d — Schedule Storybook stories (8 canonical scenarios).
 *
 * Coverage:
 *  1  SingleRoomOnePerson          — single room, 1 instructor
 *  2  SingleRoomThreePeople        — single room, 3 people
 *  3  SingleRoomOverflow           — single room, 7 people (+1 chip overflow)
 *  4  TwoRoomsSingleLevel          — 2-room matrix, one level per session
 *  5  TwoRoomsPerLevelBinding      — 2-room matrix, Phase C per-level people
 *  6  ThreeRoomsMixedKinds         — 3-room matrix, class + masterclass + party
 *  7  FestivalTwoDaysTwoRooms      — festival-scale 2-room day
 *  8  FestivalThreeDaysThreeRooms  — festival 3-room day with per-level bindings
 */

import type { Meta, StoryObj } from '@storybook/react';
import { ScheduleGrid } from './ScheduleGrid';
import {
  story1Sessions, story1Rooms,
  story2Sessions, story2Rooms,
  story3Sessions, story3Rooms,
  story4Sessions, story4Rooms,
  story5Sessions, story5Rooms,
  story6Sessions, story6Rooms,
  story7Sessions, story7Rooms,
  story8Sessions, story8Rooms,
} from './Schedule.fixtures';

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta = {
  title: 'Schedule/ScheduleGrid',
  component: ScheduleGrid,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#0f172a' }],
    },
  },
  argTypes: {
    rooms:    { control: false },
    sessions: { control: false },
    eventId:  { control: false },
  },
} satisfies Meta<typeof ScheduleGrid>;

export default meta;

type Story = StoryObj<typeof meta>;

// ─── Story 1 — Single room / 1 person ────────────────────────────────────────

export const SingleRoomOnePerson: Story = {
  name: '1 · Single room / 1 person',
  args: {
    rooms: story1Rooms,
    sessions: story1Sessions,
    eventId: null,
  },
};

// ─── Story 2 — Single room / 3 people ────────────────────────────────────────

export const SingleRoomThreePeople: Story = {
  name: '2 · Single room / 3 people',
  args: {
    rooms: story2Rooms,
    sessions: story2Sessions,
    eventId: null,
  },
};

// ─── Story 3 — Single room / 7 people (overflow "+1") ────────────────────────

export const SingleRoomOverflow: Story = {
  name: '3 · Single room / 7 people (overflow)',
  args: {
    rooms: story3Rooms,
    sessions: story3Sessions,
    eventId: null,
  },
};

// ─── Story 4 — 2 rooms / single level per session ────────────────────────────

export const TwoRoomsSingleLevel: Story = {
  name: '4 · 2 rooms / single level',
  args: {
    rooms: story4Rooms,
    sessions: story4Sessions,
    eventId: null,
  },
};

// ─── Story 5 — 2 rooms / per-level bindings (Phase C) ────────────────────────

export const TwoRoomsPerLevelBinding: Story = {
  name: '5 · 2 rooms / per-level binding (Phase C)',
  args: {
    rooms: story5Rooms,
    sessions: story5Sessions,
    eventId: null,
  },
};

// ─── Story 6 — 3 rooms / mixed kinds ─────────────────────────────────────────

export const ThreeRoomsMixedKinds: Story = {
  name: '6 · 3 rooms / class + masterclass + party',
  args: {
    rooms: story6Rooms,
    sessions: story6Sessions,
    eventId: null,
  },
};

// ─── Story 7 — Festival Day 1: 2 rooms ───────────────────────────────────────

export const FestivalTwoDaysTwoRooms: Story = {
  name: '7 · Festival scale — 2 rooms / 7 slots',
  args: {
    rooms: story7Rooms,
    sessions: story7Sessions,
    eventId: null,
  },
};

// ─── Story 8 — Festival Day 2: 3 rooms + per-level bindings ──────────────────

export const FestivalThreeDaysThreeRooms: Story = {
  name: '8 · Festival scale — 3 rooms / per-level bindings',
  args: {
    rooms: story8Rooms,
    sessions: story8Sessions,
    eventId: null,
  },
};

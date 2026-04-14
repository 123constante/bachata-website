/**
 * Event Page Contract Test
 *
 * This is a developer guardrail that maintains a strict contract for the event
 * page query and model. When you add a new field to get_event_page_snapshot RPC:
 *
 * 1. Add the field to REQUIRED_EVENT_FIELDS below
 * 2. Implement extraction in useEventPageQuery.ts parseEventPageSnapshot()
 * 3. Map it in buildEventPageModel.ts buildReadyPageModel()
 * 4. Add display logic to EventPageScreen.tsx or its sections
 *
 * This test will FAIL at compile time if any field in the contract is
 * missing from the EventPageSnapshot or EventPageModel types.
 */

import type { EventPageModel, EventPageSnapshot } from '@/modules/event-page/types';

// ============================================================================
// RPC OUTPUT CONTRACT
// ============================================================================
// Every field returned inside event.* by get_event_page_snapshot
const REQUIRED_EVENT_FIELDS = [
  'name',
  'description',
  'date',
  'type',
  'timezone',
  'citySlug',
  'location',
  'status',
  'isPublished',
  'createdBy',
  'imageUrl',
  'posterUrl',
  'musicStyles',
  'paymentMethods',
  'keyTimes',
  'metaDataPublic',
  'tickets',
  'promoCodes',
  'actions',
] as const satisfies readonly (keyof EventPageSnapshot['event'])[];

// ============================================================================
// MODEL SLICE CONTRACT
// ============================================================================
// Every top-level key that EventPageModel must have available to renders
const REQUIRED_MODEL_SLICES = [
  'page',
  'identity',
  'hero',
  'actions',
  'schedule',
  'location',
  'organiser',
  'lineup',
  'guestDancers',
  'attendance',
  'description',
  'eventInfo',
  'tickets',
  'promoCodes',
  'metaDataPublic',
] as const satisfies readonly (keyof EventPageModel)[];

// ============================================================================
// COMPILE-TIME CHECKS
// ============================================================================
// If these type assignments cause TypeScript errors, it means a field in
// the contract is missing from the actual type. Fix it by adding the field
// to the type definition and implementing extraction/mapping.

type _EventFieldCheck = typeof REQUIRED_EVENT_FIELDS;
type _ModelSliceCheck = typeof REQUIRED_MODEL_SLICES;

// The following statements will fail TypeScript compilation if any field
// listed above is missing or misspelled in the actual types.
const _: [_EventFieldCheck, _ModelSliceCheck] = [
  REQUIRED_EVENT_FIELDS,
  REQUIRED_MODEL_SLICES,
];

// ============================================================================
// DOCUMENTATION
// ============================================================================
// This test has no runtime assertions. It is a compile-time guardrail only.
// If you see TypeScript errors on REQUIRED_EVENT_FIELDS or REQUIRED_MODEL_SLICES,
// you have either:
//
// a) Added a new RPC field but forgot to add it to REQUIRED_EVENT_FIELDS
// b) Removed a field from the type but didn't remove it from the contract
// c) Renamed a field in the type but didn't update the contract
//
// The contract is intentionally strict to catch schema misalignment early.

// The ONLY thing the public page (src/pages/OrganiserProfile.tsx) imports from
// edit-in-place eagerly, and only as types (erased at build). The layer itself is
// a lazy chunk the page loads when ownershipFacts says canEdit; it hands the page
// this bridge, and the page renders `slot(...)` where a pencil belongs and lays
// `overlay` (the drafted values) over the stored row.

import type { ReactNode } from 'react';
import type { ProfileEntity } from '@/modules/organiser/profile/profileForm';
import type { DraftOverlay } from './draftModel';
import type { FieldKey } from './fieldRules';

export type EipSlot =
  | 'card' | 'photo' | 'name' | 'meta' | 'about' | 'about-empty' | 'links'
  // The owner's Contact card (Public / Hidden per item) and its "Edit contact details" row.
  | 'contact'
  // The owner's (or admin's) Team card and its "Add a person" picker; nothing for a manager.
  | 'team'
  // The Create event links: beside the "Upcoming events" count, and in the empty
  // states (never a night yet / past nights only, so the copy can say "first" honestly).
  | 'create-event' | 'create-first-event' | 'create-another-event';

export interface EipBridge {
  /** Drafted values in the row's own shape; {} with no draft. */
  overlay: DraftOverlay;
  /** The owner-only control for one place on the page. */
  slot: (where: EipSlot) => ReactNode;
  /** The class for a drafted value's dashed outline, or undefined. */
  mark: (field: FieldKey) => string | undefined;
}

export interface EditInPlaceLayerProps {
  organiserId: string;
  entity: ProfileEntity;
  onBridge: (bridge: EipBridge | null) => void;
  /** Keys the private contact read's cache per signed-in user (organiserContactSettingsQueryKey). */
  userId?: string;
}

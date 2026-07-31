export interface GroupableOccurrence {
  id: string;
  occurrenceId?: string | null;
}

export type EventGroup<T extends GroupableOccurrence> =
  | { kind: 'single'; event: T }
  | { kind: 'series'; eventId: string; dates: T[] };

/**
 * Groups occurrences by event id, preserving first-seen order. A run of
 * `threshold` or more occurrences sharing an id collapses into one 'series'
 * group; shorter runs stay as individual 'single' entries. If the input is
 * already sorted (e.g. soonest-first), the output preserves that ordering:
 * a group's position is anchored to its first occurrence's position.
 */
export function groupByEventId<T extends GroupableOccurrence>(
  events: T[],
  threshold = 3,
): EventGroup<T>[] {
  const byId = new Map<string, T[]>();
  const order: string[] = [];
  for (const e of events) {
    if (!byId.has(e.id)) {
      byId.set(e.id, []);
      order.push(e.id);
    }
    byId.get(e.id)!.push(e);
  }
  const items: EventGroup<T>[] = [];
  for (const eventId of order) {
    const group = byId.get(eventId)!;
    if (group.length >= threshold) {
      items.push({ kind: 'series', eventId, dates: group });
    } else {
      for (const e of group) items.push({ kind: 'single', event: e });
    }
  }
  return items;
}

/**
 * A React list key guaranteed unique within a single .map() call, even when
 * occurrenceId is null for more than one item sharing the same fallback id
 * (occurrence_id is nullable on the RPC row) -- the index is the only thing
 * guaranteed unique in that case, so it's appended rather than relied on
 * occurrenceId alone.
 */
export function stableRowKey(
  occurrenceId: string | null | undefined,
  fallbackId: string,
  index: number,
): string {
  return occurrenceId ?? `${fallbackId}-${index}`;
}

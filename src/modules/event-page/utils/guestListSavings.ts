/**
 * Derives the "Save £X" / "Save £X–£Y" headline copy from the guest-list
 * pricing tiers returned by get_event_guest_list. Pure and unit-testable.
 *
 * Returns null when there is no positive saving on any tier — the caller
 * hides the headline line in that case.
 *
 * Range formatting uses the en-dash (–), which is British-style for
 * numeric ranges ("£2–£3", not "£2-£3").
 */
export type GuestListPricing = {
  regular_party_price: number | null;
  guest_list_party_price: number | null;
  regular_class_party_price: number | null;
  guest_list_class_party_price: number | null;
};

export function formatSavingsRange(pricing: GuestListPricing): string | null {
  const savings: number[] = [];

  if (
    pricing.regular_party_price != null &&
    pricing.guest_list_party_price != null
  ) {
    const s = pricing.regular_party_price - pricing.guest_list_party_price;
    if (s > 0) savings.push(s);
  }

  if (
    pricing.regular_class_party_price != null &&
    pricing.guest_list_class_party_price != null
  ) {
    const s =
      pricing.regular_class_party_price - pricing.guest_list_class_party_price;
    if (s > 0) savings.push(s);
  }

  if (savings.length === 0) return null;

  const min = Math.min(...savings);
  const max = Math.max(...savings);
  if (min === max) return `£${min}`;
  return `£${min}–£${max}`;
}

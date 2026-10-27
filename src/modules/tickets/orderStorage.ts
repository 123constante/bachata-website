import { ORDER_STORAGE_KEY } from './ticketCheckoutModel';

/**
 * The one copy of the order-id hand-off across the Stripe redirect: success_url is a bare
 * /tickets/thanks (Stripe passes it verbatim), so the block keeps the id here and the
 * thank-you page moves it into its own URL. Storage can be blocked: every call is safe.
 */
export function saveOrderId(id: string): void {
  try {
    window.sessionStorage.setItem(ORDER_STORAGE_KEY, id);
  } catch {
    /* blocked: the thank-you page still shows the paid copy, without a reference */
  }
}

export function readOrderId(): string | null {
  try {
    return window.sessionStorage.getItem(ORDER_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearOrderId(): void {
  try {
    window.sessionStorage.removeItem(ORDER_STORAGE_KEY);
  } catch {
    /* blocked: nothing was stored */
  }
}

import { useEffect, useState } from 'react';
import { MAX_ORDER_POLLS, pollDelayMs, type OrderStatusReading } from './ticketCheckoutModel';
import { readOrderStatus } from './ticketCheckoutApi';

/**
 * The order read the thank-you page and the dancer app's Tickets tab share: first read now,
 * then 2, 4, 8 s and every 15 s, at most MAX_ORDER_POLLS repeats, and only while the server
 * says pending (retry_later is the server asking us to wait: the same as pending). Stopped
 * on unmount. `gaveUp` = still pending after the last poll.
 */
export function useOrderStatus(orderId: string | null): { reading: OrderStatusReading | null; gaveUp: boolean } {
  const [reading, setReading] = useState<OrderStatusReading | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (!orderId) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = async (poll: number) => {
      const r = await readOrderStatus(orderId);
      if (!live) return;
      setReading(r);
      if (r.status !== 'pending' && !(r.retryLater && r.status === 'unknown')) return;
      if (poll >= MAX_ORDER_POLLS) {
        setGaveUp(true);
        return;
      }
      timer = setTimeout(() => void read(poll + 1), pollDelayMs(poll));
    };
    void read(0);
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [orderId]);
  return { reading, gaveUp };
}

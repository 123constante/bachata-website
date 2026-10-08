import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * [message, announce]: pass `message` to <AnnounceRegion>. Announcing the same
 * text twice still speaks twice (it is cleared for one tick first).
 */
export function useAnnounce(): [string, (text: string) => void] {
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const announce = useCallback((text: string) => {
    setMessage('');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(text), 50);
  }, []);
  return [message, announce];
}

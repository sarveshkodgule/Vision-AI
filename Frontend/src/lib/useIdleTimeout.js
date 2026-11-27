import { useEffect, useRef } from 'react';

const DEFAULT_IDLE_MS = 15 * 60 * 1000; // 15 minutes of inactivity

export default function useIdleTimeout(onTimeout, timeoutMs = DEFAULT_IDLE_MS) {
  const timerRef = useRef(null);
  const callbackRef = useRef(onTimeout);
  callbackRef.current = onTimeout;

  useEffect(() => {
    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        callbackRef.current?.();
      }, timeoutMs);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, reset, { passive: true }));
    reset();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((evt) => window.removeEventListener(evt, reset));
    };
  }, [timeoutMs]);
}

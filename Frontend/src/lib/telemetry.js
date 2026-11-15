const LOCAL_ANALYTICS_ENABLED = import.meta.env.VITE_ENABLE_LOCAL_ANALYTICS === 'true';

export function trackEvent(name) {
  if (!LOCAL_ANALYTICS_ENABLED || typeof window === 'undefined') return;
  try {
    const key = 'visionai_local_events';
    const events = JSON.parse(window.sessionStorage.getItem(key) || '{}');
    events[name] = (events[name] || 0) + 1;
    window.sessionStorage.setItem(key, JSON.stringify(events));
  } catch {
    // Telemetry must never affect the patient experience.
  }
}

export function reportClientError(error, context = {}) {
  console.error('[client-error]', { message: error?.message || String(error), context });
}

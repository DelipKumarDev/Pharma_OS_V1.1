'use client';

import { useEffect } from 'react';

// Registers the PWA service worker (app-shell offline caching). Only in
// production — in dev, Turbopack's HMR and hashed chunks make SW caching flaky,
// and the offline billing queue works without it regardless.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => { /* non-fatal */ });
  }, []);
  return null;
}

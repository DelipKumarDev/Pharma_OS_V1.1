'use client';

import { useEffect, useState } from 'react';
import { subscribeOffline, getQueue, pendingCount, type QueuedOp } from '@/lib/offline';

// Live view of connectivity + the offline sync queue for indicators and pages.
export function useOffline() {
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<QueuedOp[]>([]);

  useEffect(() => {
    const syncOnline = () => setOnline(navigator.onLine);
    const syncQueue = () => setQueue(getQueue());
    syncOnline();
    syncQueue();
    window.addEventListener('online', syncOnline);
    window.addEventListener('offline', syncOnline);
    const unsub = subscribeOffline(syncQueue);
    return () => {
      window.removeEventListener('online', syncOnline);
      window.removeEventListener('offline', syncOnline);
      unsub();
    };
  }, []);

  return { online, queue, pending: pendingCount(queue) };
}

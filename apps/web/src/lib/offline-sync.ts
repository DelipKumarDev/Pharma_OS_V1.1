'use client';

import { apiFetch } from '@/lib/api';
import { getQueue, updateOp, isOnline } from '@/lib/offline';

// Replay queued offline operations against the server. A network failure leaves
// the op pending and stops draining (still offline); a business rejection (e.g.
// stock changed, expired) marks it failed for manual review — never retried in a
// loop. Returns how many synced / failed this pass.
let running = false;
export async function syncQueue(): Promise<{ synced: number; failed: number; skipped: boolean }> {
  if (running || !isOnline()) return { synced: 0, failed: 0, skipped: true };
  running = true;
  let synced = 0;
  let failed = 0;
  try {
    for (const op of getQueue()) {
      if (op.status === 'synced') continue;
      if (op.type !== 'bill') continue;
      updateOp(op.id, { status: 'syncing', error: undefined });
      try {
        const r = await apiFetch('/api/billing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(op.payload),
        });
        const j = await r.json().catch(() => ({})) as { success?: boolean; message?: string; data?: { billNumber?: string } };
        if (r.ok && j.success) {
          updateOp(op.id, { status: 'synced', billNumber: j.data?.billNumber, syncedAt: new Date().toISOString(), error: undefined });
          synced++;
        } else {
          updateOp(op.id, { status: 'failed', error: j.message ?? `Rejected (${r.status})` });
          failed++;
        }
      } catch {
        // Genuine network error — connection dropped mid-sync. Put it back to
        // pending and stop; the next online event / interval will resume.
        updateOp(op.id, { status: 'pending' });
        break;
      }
    }
  } finally {
    running = false;
  }
  return { synced, failed, skipped: false };
}

// Start background sync once: on the `online` event and on a periodic timer.
let started = false;
export function startAutoSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const run = () => { void syncQueue(); };
  window.addEventListener('online', run);
  window.setInterval(() => { if (isOnline()) void syncQueue(); }, 30_000);
  if (isOnline()) void syncQueue();
}

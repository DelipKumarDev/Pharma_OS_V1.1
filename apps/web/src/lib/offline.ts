'use client';

// ─── Offline store ────────────────────────────────────────────────────────────
// A localStorage-backed queue of mutations made while the connection is down
// (primarily bills) plus a cached product catalogue so the POS keeps working with
// no network. Keys are namespaced per tenant. A tiny pub/sub keeps the header
// indicator and the Offline page in sync with the queue.

type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribeOffline(fn: Listener): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
function emit() { listeners.forEach((l) => l()); }

let tenantKey = 'default';
export function setOfflineTenant(t?: string | null) { tenantKey = t || 'default'; }
const qKey = () => `pharmaos_offline_queue_${tenantKey}`;
const catKey = () => `pharmaos_offline_catalog_${tenantKey}`;

export type OpStatus = 'pending' | 'syncing' | 'synced' | 'failed';
export interface QueuedOp {
  id: string;
  type: 'bill';
  label: string;        // human summary, e.g. "Walk-in · ₹120 · 2 items"
  payload: unknown;     // the exact createBill payload to replay
  status: OpStatus;
  error?: string;
  billNumber?: string;  // server-assigned once synced
  createdAt: string;
  syncedAt?: string;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const v = window.localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function write(key: string, val: unknown) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota — best effort */ }
}

export function getQueue(): QueuedOp[] { return read<QueuedOp[]>(qKey(), []); }
function setQueue(q: QueuedOp[]) { write(qKey(), q); emit(); }

export function enqueueOp(op: Pick<QueuedOp, 'type' | 'label' | 'payload'>): QueuedOp {
  const item: QueuedOp = {
    ...op,
    id: `off_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  setQueue([...getQueue(), item]);
  return item;
}
export function updateOp(id: string, patch: Partial<QueuedOp>) {
  setQueue(getQueue().map((o) => (o.id === id ? { ...o, ...patch } : o)));
}
export function removeOp(id: string) { setQueue(getQueue().filter((o) => o.id !== id)); }
export function clearSynced() { setQueue(getQueue().filter((o) => o.status !== 'synced')); }
export function pendingCount(q: QueuedOp[] = getQueue()): number {
  return q.filter((o) => o.status === 'pending' || o.status === 'failed' || o.status === 'syncing').length;
}

// ─── Catalogue cache (for offline billing) ──────────────────────────────────────
export interface CachedCatalog {
  medicines: unknown[];
  batches: Record<string, unknown[]>; // medicineId → its inventory batches
  cachedAt: string;
}
export function cacheCatalog(data: { medicines: unknown[]; batches: Record<string, unknown[]> }) {
  write(catKey(), { ...data, cachedAt: new Date().toISOString() });
}
export function getCatalog(): CachedCatalog | null { return read<CachedCatalog | null>(catKey(), null); }

// ─── Misc ───────────────────────────────────────────────────────────────────
export function offlineStorageBytes(): number {
  if (typeof window === 'undefined') return 0;
  let n = 0;
  for (const k of [qKey(), catKey()]) { const v = window.localStorage.getItem(k); if (v) n += v.length * 2; }
  return n;
}
export function isOnline(): boolean { return typeof navigator === 'undefined' ? true : navigator.onLine; }

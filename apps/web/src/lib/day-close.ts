'use client';

import { apiFetch } from '@/lib/api';

// Day-close is server-authoritative (auditable, enforced across devices) via the
// DayClose model. The localStorage mirror below is only a synchronous cache so
// the `beforeunload` guard — which cannot await a fetch — has an instant answer.

// The pharmacy's business day is IST (UTC+5:30) — keep this in lock-step with the
// server's day boundary so the day-close guards agree across devices.
const IST_OFFSET_MIN = 330;
export function todayStr(): string {
  return new Date(Date.now() + IST_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

export interface DayCloseRecord {
  id: string; closeDate: string; systemCash: number; systemUpi: number; systemCard: number;
  systemCredit: number; systemTotal: number; physicalCash: number; variance: number;
  billCount: number; closedByName?: string | null; closedAt: string;
}
export interface DayCloseStatus { date: string; closed: boolean; close: DayCloseRecord | null; pendingDays: string[] }

export async function fetchDayCloseStatus(): Promise<DayCloseStatus | null> {
  try {
    const r = await apiFetch('/api/day-close/status');
    if (!r.ok) return null;
    const j = await r.json() as { data: DayCloseStatus };
    return j.data ?? null;
  } catch { return null; }
}

export async function fetchDayCloseHistory(): Promise<DayCloseRecord[]> {
  try {
    const r = await apiFetch('/api/day-close');
    if (!r.ok) return [];
    const j = await r.json() as { data: { data: DayCloseRecord[] } };
    return j.data?.data ?? [];
  } catch { return []; }
}

export async function postDayClose(payload: { physicalCash: number; denominations?: unknown; notes?: string }): Promise<DayCloseRecord> {
  const r = await apiFetch('/api/day-close', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const j = await r.json() as { success: boolean; message?: string; data: DayCloseRecord };
  if (!r.ok || !j.success) throw new Error(j.message ?? 'Failed to close day');
  return j.data;
}

const closedKey = (tenant: string, date: string) => `pharmaos_dayclose_${tenant}_${date}`;
const lastActiveKey = (tenant: string) => `pharmaos_lastactive_${tenant}`;

export function isDayClosed(tenant: string, date = todayStr()): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(closedKey(tenant, date)) === '1';
}

export function markDayClosed(tenant: string, date = todayStr()): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(closedKey(tenant, date), '1');
}

// Record that the app was opened today and return the previous open-date (if the
// app was last used on an earlier day) so the caller can check whether that day
// was ever closed.
export function rollLastActive(tenant: string): string | null {
  if (typeof window === 'undefined') return null;
  const today = todayStr();
  const prev = localStorage.getItem(lastActiveKey(tenant));
  localStorage.setItem(lastActiveKey(tenant), today);
  return prev && prev < today ? prev : null;
}

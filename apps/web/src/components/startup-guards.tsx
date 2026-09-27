'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, CalendarX2, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth-store';
import { apiFetch } from '@/lib/api';
import { isDayClosed, markDayClosed, fetchDayCloseStatus, todayStr } from '@/lib/day-close';
import { setOfflineTenant } from '@/lib/offline';
import { startAutoSync } from '@/lib/offline-sync';
import { setActiveCurrency, setActiveDateFormat } from '@pharmaos/utils';

interface DashKpis { todayBills?: number; expiringItems?: number }

/**
 * Cross-cutting startup guards, mounted once in the dashboard shell:
 *  - #3 Expiry: on first load, if any batch is near/at expiry, prompt to act.
 *  - #2 Day Close: warn on browser-close when today has sales but isn't closed,
 *    and on the next login prompt to close a previous day that was left open.
 */
export function StartupGuards() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const patchUser = useAuthStore((s) => s.patchUser);
  const tenant = user?.tenantName ?? 'default';

  const [pendingDay, setPendingDay] = useState<string | null>(null);
  const [expiring, setExpiring] = useState(0);
  const ran = useRef(false);
  const todayHadSales = useRef(false);

  // Apply tenant localization (currency symbol + numeric date format) app-wide so
  // formatCurrency/formatDateShort everywhere honour System Preferences.
  useEffect(() => {
    setActiveCurrency(user?.currency);
    setActiveDateFormat(user?.dateFormat);
  }, [user?.currency, user?.dateFormat]);

  // Guard the browser from closing when today has sales but isn't reconciled.
  useEffect(() => {
    if (!isAuthenticated) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (todayHadSales.current && !isDayClosed(tenant)) {
        e.preventDefault();
        e.returnValue = ''; // triggers the browser's leave-confirmation
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isAuthenticated, tenant]);

  // Offline queue: bind to this tenant and start background sync (fires when the
  // connection returns / periodically) so bills saved offline replay to the server.
  useEffect(() => {
    if (!isAuthenticated) return;
    setOfflineTenant(tenant);
    startAutoSync();
  }, [isAuthenticated, tenant]);

  useEffect(() => {
    if (!isAuthenticated || ran.current) return;
    ran.current = true;

    // Self-heal the cached display name/details from the server so a pharmacy-name
    // (or profile) change made elsewhere shows on this device without re-login.
    (async () => {
      try {
        const r = await apiFetch('/api/auth/me');
        if (!r.ok) return;
        const j = await r.json() as {
          data?: {
            tenantName?: string; name?: string; logoUrl?: string; currency?: string; dateFormat?: string;
            dropdownOptions?: Record<string, string[]>;
            messageTemplates?: Record<string, string>;
            menuHidden?: string[];
            formFields?: Record<string, unknown>;
          };
        };
        const fresh = j.data;
        if (!fresh) return;
        // Self-heal cached name/details AND per-tenant config (dropdowns, menu
        // access, form fields, templates) so a change made in Administration on
        // another device/session takes effect here without a re-login.
        const patch: Record<string, unknown> = {};
        if (fresh.tenantName && fresh.tenantName !== user?.tenantName) patch['tenantName'] = fresh.tenantName;
        if (fresh.name && fresh.name !== user?.name) patch['name'] = fresh.name;
        if (fresh.logoUrl !== undefined && fresh.logoUrl !== user?.logoUrl) patch['logoUrl'] = fresh.logoUrl;
        if (fresh.currency && fresh.currency !== user?.currency) patch['currency'] = fresh.currency;
        if (fresh.dateFormat && fresh.dateFormat !== user?.dateFormat) patch['dateFormat'] = fresh.dateFormat;
        if (fresh.dropdownOptions) patch['dropdownOptions'] = fresh.dropdownOptions;
        if (fresh.messageTemplates) patch['messageTemplates'] = fresh.messageTemplates;
        if (fresh.menuHidden) patch['menuHidden'] = fresh.menuHidden;
        if (fresh.formFields) patch['formFields'] = fresh.formFields;
        if (Object.keys(patch).length > 0) patchUser(patch);
      } catch { /* offline / non-fatal */ }
    })();

    // Server-authoritative day-close status: pending earlier days + today's state.
    (async () => {
      const status = await fetchDayCloseStatus();
      if (status) {
        if (status.closed) markDayClosed(tenant); // mirror for the sync unload guard
        if (status.pendingDays.length > 0) setPendingDay(status.pendingDays[status.pendingDays.length - 1]!);
      }
    })();

    // Expiry + today's sales come from the dashboard summary.
    (async () => {
      try {
        const r = await apiFetch('/api/dashboard');
        if (!r.ok) return;
        const j = await r.json() as { data?: { kpis?: DashKpis } };
        const kpis = j.data?.kpis ?? {};
        todayHadSales.current = (kpis.todayBills ?? 0) > 0;
        const exp = kpis.expiringItems ?? 0;
        if (exp > 0 && sessionStorage.getItem('pharmaos_expiry_ack') !== todayStr()) {
          setExpiring(exp);
        }
      } catch { /* non-blocking */ }
    })();
  }, [isAuthenticated, tenant]);

  function goDayClose() { setPendingDay(null); router.push('/reports?tab=daily-close'); }
  function dismissExpiry() { sessionStorage.setItem('pharmaos_expiry_ack', todayStr()); setExpiring(0); }
  function goExpiry() { dismissExpiry(); router.push('/expiry'); }

  // Previous-day close prompt takes priority; expiry shows once it's cleared.
  const showDayClose = !!pendingDay;
  const showExpiry = !pendingDay && expiring > 0;

  return (
    <>
      <Dialog open={showDayClose} onOpenChange={(o) => !o && setPendingDay(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
              <CalendarClock className="h-5 w-5 text-warning-700" />
            </div>
            <DialogTitle>Day close pending</DialogTitle>
            <DialogDescription>
              The books for <span className="font-semibold text-foreground">{pendingDay}</span> were never closed.
              Reconcile that day&apos;s cash so your records stay accurate.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDay(null)}>Later</Button>
            <Button onClick={goDayClose} className="gap-1.5">Complete Day Close <ArrowRight className="h-4 w-4" /></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showExpiry} onOpenChange={(o) => !o && dismissExpiry()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
              <CalendarX2 className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>{expiring} batch{expiring === 1 ? '' : 'es'} need attention</DialogTitle>
            <DialogDescription>
              {expiring} medicine batch{expiring === 1 ? ' is' : 'es are'} expired or nearing expiry. Review and remove,
              return, or discount them before they reach patients.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={dismissExpiry}>Dismiss</Button>
            <Button onClick={goExpiry} className="gap-1.5">Review Expiry <ArrowRight className="h-4 w-4" /></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

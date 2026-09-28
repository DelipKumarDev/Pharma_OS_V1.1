'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, ArrowRight, Rocket, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCan } from '@/lib/permissions';

interface OnboardingState {
  profile: boolean;
  medicines: boolean;
  stock: boolean;
  firstBill: boolean;
}

async function fetchOnboarding(): Promise<OnboardingState> {
  const [settings, meds, invStats, bills] = await Promise.all([
    apiFetch('/api/settings').then((r) => r.ok ? r.json() : null).catch(() => null),
    apiFetch('/api/medicines?limit=1').then((r) => r.json()).catch(() => null),
    apiFetch('/api/inventory/stats').then((r) => r.json()).catch(() => null),
    apiFetch('/api/billing?limit=1').then((r) => r.json()).catch(() => null),
  ]);
  const p = settings?.data?.profile ?? {};
  return {
    profile: Boolean(p.gstNumber || p.drugLicenseNumber),
    medicines: (meds?.data?.total ?? meds?.data?.data?.length ?? 0) > 0,
    stock: (invStats?.data?.inventoryValue ?? 0) > 0,
    firstBill: (bills?.data?.total ?? 0) > 0,
  };
}

const STORAGE_KEY = 'pharmaos_onboarding_dismissed';

export function OnboardingChecklist() {
  const can = useCan();
  const [dismissed, setDismissed] = React.useState(true);
  React.useEffect(() => { setDismissed(localStorage.getItem(STORAGE_KEY) === '1'); }, []);

  const { data } = useQuery({ queryKey: ['onboarding'], queryFn: fetchOnboarding, staleTime: 60_000 });

  // `perm` is the permission required to REACH the step's destination — steps a
  // user can't reach (e.g. the /settings setup steps for a Billing Assistant
  // without settings:view) are filtered out so we never link them somewhere the
  // route guard just bounces. If nothing actionable remains, the card hides.
  const steps = [
    { key: 'profile', label: 'Set up pharmacy profile', desc: 'GST, drug license, address', href: '/settings?tab=profile', done: data?.profile, perm: 'settings:view' },
    { key: 'medicines', label: 'Add your medicines', desc: 'Manually or bulk-import from Excel', href: '/settings?tab=import', done: data?.medicines, perm: 'settings:view' },
    { key: 'stock', label: 'Add opening stock', desc: 'One-sheet import: medicines + batches together', href: '/settings?tab=import', done: data?.stock, perm: 'settings:view' },
    { key: 'firstBill', label: 'Create your first bill', desc: 'Ring up a sale at the POS', href: '/billing', done: data?.firstBill, perm: 'billing:view' },
  ].filter((s) => can(s.perm));
  const doneCount = steps.filter((s) => s.done).length;

  // Hide once fully set up, dismissed, no actionable steps, or data not loaded.
  if (!data || dismissed || steps.length === 0 || doneCount === steps.length) return null;

  function dismiss() { localStorage.setItem(STORAGE_KEY, '1'); setDismissed(true); }

  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
            <Rocket className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-bold">Finish setting up Pharma Ist</p>
            <p className="text-xs text-muted-foreground">{doneCount} of {steps.length} done — you're almost ready to go</p>
          </div>
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {steps.map((s) => (
          <Link key={s.key} href={s.href}
            className={cn(
              'group flex items-center gap-3 rounded-xl border p-3 transition-all',
              s.done ? 'border-success/30 bg-success/5' : 'border-border bg-card hover:border-primary/50',
            )}>
            {s.done
              ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
              : <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />}
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-medium', s.done && 'text-muted-foreground line-through')}>{s.label}</p>
              <p className="text-xs text-muted-foreground truncate">{s.desc}</p>
            </div>
            {!s.done && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
          </Link>
        ))}
      </div>
    </div>
  );
}

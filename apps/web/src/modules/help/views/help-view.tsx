'use client';

import React, { useState } from 'react';
import { ChevronDown, Search, MessageCircle, Book, Keyboard, Mail, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const FAQ_ITEMS = [
  { category: 'Medicines', q: 'How do I add a new medicine to the master list?', a: 'Go to Medicine Master → click "Add Medicine". Fill in the name, generic name, manufacturer, category, form, strength, GST rate, MRP, and selling price. Prescription medicines must have a drug schedule selected.' },
  { category: 'Medicines', q: 'Can I import medicines from a CSV or Excel file?', a: 'Bulk import is available in the Enterprise plan. Go to Medicine Master → Export CSV to get the correct column format, then upload your filled template using the Import button.' },
  { category: 'Medicines', q: 'How do I discontinue a medicine without losing its billing history?', a: 'Click the three-dot menu next to the medicine → Discontinue. The medicine is marked discontinued and removed from new bill searches, but all historical records are preserved.' },
  { category: 'Inventory', q: 'How do I record a new stock batch?', a: 'Go to Inventory → click "Add Stock". Search for the medicine, enter the batch number, quantity, purchase price, MRP, expiry date, and supplier name.' },
  { category: 'Inventory', q: 'What triggers a low-stock alert?', a: 'Stock is marked Low Stock when the available quantity falls to or below the Reorder Level set on the medicine master. You can configure the global threshold in Settings → Alerts.' },
  { category: 'Inventory', q: 'How do I handle stock adjustments for damaged or expired items?', a: 'Open the Inventory table → click the three-dot menu next to a batch → Adjust Stock. Select "Remove Stock", enter the quantity, and choose the reason (Damaged, Expired, etc.).' },
  { category: 'Billing', q: 'How do I create a new bill?', a: 'Go to Billing → click "New Bill". Search and add medicines to the cart, adjust quantities and discounts per line, add customer details, select payment method, and click Create Bill.' },
  { category: 'Billing', q: 'Can I apply a discount to the entire bill?', a: 'Yes — in the New Bill panel, there is a "Bill Discount %" field that applies a percentage discount to the entire bill total, on top of any individual item discounts.' },
  { category: 'Billing', q: 'How do I print a receipt?', a: 'In the Billing table, click the three-dot menu on any bill → Print Receipt. A formatted receipt opens in a new window and triggers the browser print dialog automatically.' },
  { category: 'Billing', q: 'How do I handle a medicine return?', a: 'Click the three-dot menu on the original bill → Process Return. This is an admin-level action requiring approval and documentation. Contact your Pharma Admin if the option is greyed out.' },
  { category: 'Reports', q: 'What period does the Sales Report cover?', a: 'The Sales Report defaults to the current month. Use the period selector (Today / Week / Month / Year) in the Reports header to change the date range.' },
  { category: 'Reports', q: 'How do I export a report?', a: 'Each module table has an "Export CSV" button that downloads the current view as a spreadsheet. You need "export" permission on the reports module.' },
  { category: 'Users', q: 'How do I invite a new staff member?', a: 'Go to Users → click "Invite User". Enter their name, email, phone, and assign one or more roles. They will receive an email invite to set their password and log in.' },
  { category: 'Users', q: 'What is the difference between roles?', a: 'Pharma Admin has full access. Pharmacist can dispense and bill. Inventory Manager handles stock. Billing Assistant can only create bills. Reports Viewer has read-only reports access. You can create custom roles in Roles & Permissions.' },
  { category: 'System', q: 'Does Pharma Ist work offline?', a: 'Yes — with offline mode enabled (Settings → Security → Enable Offline Mode), you can continue billing and stock entry without internet. Changes sync automatically when you reconnect.' },
  { category: 'System', q: 'How is my data backed up?', a: 'With Auto Backup enabled (Settings → General), data is encrypted and backed up to secure cloud storage every 24 hours. You can also trigger a manual backup anytime from Settings.' },
];

const KEYBOARD_SHORTCUTS = [
  { keys: ['N', 'B'], label: 'New Bill', description: 'Open POS billing sheet' },
  { keys: ['N', 'M'], label: 'Add Medicine', description: 'Open medicine master form' },
  { keys: ['N', 'S'], label: 'Add Stock', description: 'Open stock entry sheet' },
  { keys: ['/', ''], label: 'Search', description: 'Focus global search bar' },
  { keys: ['Esc'], label: 'Close', description: 'Close any open dialog or sheet' },
  { keys: ['?'], label: 'Help', description: 'Open this help page' },
  { keys: ['D'], label: 'Dashboard', description: 'Navigate to dashboard' },
];

const CATEGORIES = ['All', 'Medicines', 'Inventory', 'Billing', 'Reports', 'Users', 'System'];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium">
      {children}
    </kbd>
  );
}

export function HelpView() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const filtered = FAQ_ITEMS.filter((item) => {
    const matchesSearch = !search || item.q.toLowerCase().includes(search.toLowerCase()) || item.a.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Help & Support</h1>
        <p className="text-sm text-muted-foreground">Guides, FAQs, and keyboard shortcuts to get the most out of Pharma Ist</p>
      </div>

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Book, label: 'Full Documentation', desc: 'Detailed guides for every module', action: () => toast.info('Opening documentation…') },
          { icon: MessageCircle, label: 'Chat Support', desc: 'Talk to our team (Mon–Fri 9am–6pm)', action: () => toast.info('Starting chat support…') },
          { icon: Mail, label: 'Email Support', desc: 'support@pharmaos.io · 24h response', action: () => toast.info('Opening email client…') },
        ].map(({ icon: Icon, label, desc, action }) => (
          <button key={label} onClick={action} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30 hover:bg-primary/5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* FAQ */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Frequently Asked Questions</h2>

        {/* Search and filter */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search questions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors', activeCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground')}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 rounded-xl border border-border overflow-hidden">
          {filtered.length === 0 && (
            <div className="py-10 text-center text-muted-foreground">
              <Search className="mx-auto mb-2 h-8 w-8 opacity-40" />
              <p className="text-sm">No matching questions found</p>
            </div>
          )}
          {filtered.map((item, idx) => (
            <div key={idx} className={cn('border-b border-border last:border-b-0', openFaq === idx && 'bg-muted/30')}>
              <button
                className="flex w-full items-center gap-3 px-5 py-4 text-left"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="shrink-0 text-[10px]">{item.category}</Badge>
                    <span className="text-sm font-medium">{item.q}</span>
                  </div>
                </div>
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', openFaq === idx && 'rotate-180')} />
              </button>
              {openFaq === idx && (
                <div className="px-5 pb-4">
                  <Separator className="mb-3" />
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Keyboard shortcuts */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
        </div>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="py-3 pl-5 text-left font-medium text-muted-foreground">Shortcut</th>
                <th className="py-3 pl-4 text-left font-medium text-muted-foreground">Action</th>
                <th className="py-3 pl-4 text-left font-medium text-muted-foreground">Description</th>
              </tr>
            </thead>
            <tbody>
              {KEYBOARD_SHORTCUTS.map(({ keys, label, description }, idx) => (
                <tr key={idx} className={cn('border-b border-border last:border-b-0', idx % 2 === 0 ? 'bg-background' : 'bg-muted/10')}>
                  <td className="py-3 pl-5">
                    <div className="flex items-center gap-1">
                      {keys.filter(Boolean).map((k, ki) => <React.Fragment key={k}>{ki > 0 && <span className="text-muted-foreground">+</span>}<Kbd>{k}</Kbd></React.Fragment>)}
                    </div>
                  </td>
                  <td className="py-3 pl-4 font-medium">{label}</td>
                  <td className="py-3 pl-4 text-muted-foreground">{description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System status */}
      <div className="rounded-xl border border-success/30 bg-success/5 p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <div>
            <p className="font-semibold text-success-700">All Systems Operational</p>
            <p className="text-sm text-muted-foreground">Pharma Ist API, database, and sync services are all running normally. Last checked: {new Date().toLocaleTimeString()}</p>
          </div>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => toast.info('Checking system status…')}>
            View Status Page
          </Button>
        </div>
      </div>
    </div>
  );
}

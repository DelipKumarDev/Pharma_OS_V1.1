'use client';

import { Keyboard } from 'lucide-react';

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Global', items: [
      ['F2', 'New Bill (Billing POS)'],
      ['F3', 'Register Prescription'],
      ['F5', 'Add Stock'],
      ['F6', 'Process Return'],
      ['⌘ / Ctrl + K', 'Focus universal search'],
      ['Esc', 'Close dialog / clear search'],
    ],
  },
  {
    title: 'Billing (POS)', items: [
      ['F1', 'Focus medicine search'],
      ['F8', 'Toggle barcode scanner'],
      ['F4', 'Hold current bill'],
      ['F9', 'Pay & print'],
      ['Enter', 'Add first search result to cart'],
    ],
  },
  {
    title: 'Navigation', items: [
      ['Click group', 'Expand / collapse a sidebar section'],
      ['Collapse ‹', 'Minimise the sidebar to icons'],
    ],
  },
];

export default function ShortcutsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><Keyboard className="h-4 w-4 text-primary" /></div>
        <div><h1 className="text-2xl font-bold tracking-tight">Keyboard Shortcuts</h1><p className="text-sm text-muted-foreground">Work faster with these keys — most work from anywhere in the app</p></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GROUPS.map((g) => (
          <div key={g.title} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">{g.title}</p>
            <div className="space-y-2">
              {g.items.map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">{desc}</span>
                  <kbd className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs font-semibold whitespace-nowrap">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

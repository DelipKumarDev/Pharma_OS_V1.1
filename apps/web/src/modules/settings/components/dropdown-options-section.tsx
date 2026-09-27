'use client';

import React, { useState } from 'react';
import { Loader2, Save, Plus, X, RotateCcw, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { DROPDOWN_REGISTRY, DEFAULT_DROPDOWNS, type DropdownDef } from '@/lib/dropdowns';

interface DropdownsPayload {
  registry: DropdownDef[];
  values: Record<string, string[]>;
}

/**
 * TC_028 — a single, generic editor for every configurable dropdown in the app.
 * Admins add/remove options per list; saved lists flow to every screen that
 * uses that dropdown (medicine form, filters, billing…) via the auth payload.
 */
export function DropdownOptionsSection({ dropdowns, onSaved }: { dropdowns?: DropdownsPayload; onSaved?: (values: Record<string, string[]>) => void }) {
  const registry = dropdowns?.registry?.length ? dropdowns.registry : DROPDOWN_REGISTRY;
  const initial = dropdowns?.values ?? DEFAULT_DROPDOWNS;
  const [lists, setLists] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(registry.map((d) => [d.key, [...(initial[d.key] ?? DEFAULT_DROPDOWNS[d.key] ?? [])]])),
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const patchUser = useAuthStore((s) => s.patchUser);

  function addOption(key: string) {
    const raw = (drafts[key] ?? '').trim();
    if (!raw) return;
    setLists((p) => {
      const existing = p[key] ?? [];
      if (existing.some((o) => o.toLowerCase() === raw.toLowerCase())) {
        toast.warning(`"${raw}" is already in the list`);
        return p;
      }
      return { ...p, [key]: [...existing, raw] };
    });
    setDrafts((p) => ({ ...p, [key]: '' }));
  }

  function removeOption(key: string, opt: string) {
    setLists((p) => ({ ...p, [key]: (p[key] ?? []).filter((o) => o !== opt) }));
  }

  function resetToDefault(key: string) {
    setLists((p) => ({ ...p, [key]: [...(DEFAULT_DROPDOWNS[key] ?? [])] }));
    toast.info('Reset to defaults — remember to Save');
  }

  async function save() {
    // Guard: no list may be emptied — a dropdown with zero options is unusable.
    const empty = registry.find((d) => (lists[d.key] ?? []).length === 0);
    if (empty) { toast.error(`"${empty.label}" must have at least one option`); return; }
    setSaving(true);
    try {
      const res = await apiFetch('/api/settings/dropdowns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: lists }),
      });
      const j = await res.json() as { success: boolean; message?: string; data?: { values: Record<string, string[]> } };
      if (!res.ok || !j.success) throw new Error(j.message ?? 'Failed to save');
      // Reflect immediately across the app (auth user carries the option lists).
      if (j.data?.values) { patchUser({ dropdownOptions: j.data.values }); onSaved?.(j.data.values); }
      toast.success('Dropdown options saved');
    } catch (err) {
      toast.error('Could not save', { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold">Dropdown Options</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Configure the option lists used by dropdowns across the app. Changes apply everywhere that field appears.
          </p>
        </div>
        <Button size="sm" onClick={save} disabled={saving} className="gap-1 shrink-0">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
        </Button>
      </div>

      <div className="space-y-4">
        {registry.map((def) => {
          const opts = lists[def.key] ?? [];
          return (
            <div key={def.key} className="rounded-xl border border-border p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">{def.label}</p>
                    <p className="text-2xs text-muted-foreground">{def.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => resetToDefault(def.key)}
                  className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
              </div>

              <div className="mb-3 flex flex-wrap gap-1.5">
                {opts.map((opt) => (
                  <span key={opt} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                    <span className="capitalize">{opt.replace(/_/g, ' ')}</span>
                    <button
                      type="button"
                      onClick={() => removeOption(def.key, opt)}
                      aria-label={`Remove ${opt}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {opts.length === 0 && <span className="text-2xs italic text-destructive">No options — add at least one</span>}
              </div>

              <div className="flex items-center gap-2">
                <Input
                  value={drafts[def.key] ?? ''}
                  onChange={(e) => setDrafts((p) => ({ ...p, [def.key]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(def.key); } }}
                  placeholder="Add an option…"
                  className="h-8 max-w-xs text-xs"
                />
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => addOption(def.key)}>
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

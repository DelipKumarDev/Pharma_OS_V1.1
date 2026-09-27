'use client';

// Reads the per-tenant Form Fields configuration (Administration → Settings →
// Form Fields) off the auth user, so any form can honour admin overrides for
// which fields show, which are required, and their labels — live, no re-login.
//
// Config shape on the user: { [formId]: FieldConfig[] }. A form that has no saved
// config (or a field not present in it) falls back to its own hardcoded defaults,
// so wiring a form to this hook is always safe and incremental.

import { useAuthStore } from '@/store/auth-store';

export interface StoredFieldConfig {
  id: string;
  label?: string;
  required?: boolean;
  enabled?: boolean;
}

export interface FormFieldAccessor {
  /** Whether the field should render (defaults to `fallback`, normally true). */
  isEnabled: (fieldId: string, fallback?: boolean) => boolean;
  /** Whether the field is required (defaults to `fallback`). */
  isRequired: (fieldId: string, fallback?: boolean) => boolean;
  /** The (possibly admin-renamed) label, else `fallback`. */
  label: (fieldId: string, fallback: string) => string;
  /** True when the tenant has saved any config for this form. */
  configured: boolean;
}

export function useFormFieldConfig(formId: string): FormFieldAccessor {
  const formFields = useAuthStore((s) => s.user?.formFields);
  const raw = (formFields?.[formId] as StoredFieldConfig[] | undefined) ?? undefined;
  const byId = new Map<string, StoredFieldConfig>();
  if (Array.isArray(raw)) for (const f of raw) if (f && typeof f.id === 'string') byId.set(f.id, f);

  return {
    configured: byId.size > 0,
    isEnabled: (fieldId, fallback = true) => {
      const f = byId.get(fieldId);
      return f && typeof f.enabled === 'boolean' ? f.enabled : fallback;
    },
    isRequired: (fieldId, fallback = false) => {
      const f = byId.get(fieldId);
      return f && typeof f.required === 'boolean' ? f.required : fallback;
    },
    label: (fieldId, fallback) => {
      const f = byId.get(fieldId);
      return f && typeof f.label === 'string' && f.label.trim() ? f.label : fallback;
    },
  };
}

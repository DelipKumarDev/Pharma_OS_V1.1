'use client';

// Action-level RBAC for the UI. Pairs with the nav filtering (menu-tree) and the
// route guard: use `can('module:action')` to hide/disable buttons (Create, Edit,
// Delete, Export, Approve…) the current user isn't allowed to perform. The API
// still enforces the same permission, so this is a UX layer over a real boundary.

import { useAuthStore } from '@/store/auth-store';
import { hasMenuPerm } from '@/lib/menu-tree';

export type Can = (perm: string) => boolean;

/** Returns a `can(perm)` predicate bound to the current user's permissions. */
export function useCan(): Can {
  const permissions = useAuthStore((s) => s.user?.permissions);
  return (perm: string) => hasMenuPerm(permissions, perm);
}

/** Convenience for a single check: `const canCreate = useHasPerm('billing:create')`. */
export function useHasPerm(perm: string): boolean {
  const permissions = useAuthStore((s) => s.user?.permissions);
  return hasMenuPerm(permissions, perm);
}

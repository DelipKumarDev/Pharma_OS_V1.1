// Menu visibility is configured per role in `tenant.menuAccess`:
//   { [roleName]: { [menuKey]: boolean } }   (menuKey = the sidebar leaf href)
// A missing key defaults to visible. Two keys can never be hidden — the
// dashboard and the settings page — so no role can lock itself out of the app
// or out of the screen used to undo the restriction.

export const ALWAYS_VISIBLE = new Set<string>(['/dashboard', '/settings']);

export function resolveMenuAccess(raw: unknown): Record<string, Record<string, boolean>> {
  return (raw && typeof raw === 'object' && !Array.isArray(raw))
    ? raw as Record<string, Record<string, boolean>>
    : {};
}

// The set of menu keys hidden for a user, given their roles. A key is hidden
// only if it is explicitly disabled for EVERY role the user holds that has a
// configuration (the most permissive role wins — a user keeps anything any of
// their roles is allowed to see). ALWAYS_VISIBLE keys are never returned.
export function computeMenuHidden(raw: unknown, roles: string[], _permissions: string[]): string[] {
  const cfg = resolveMenuAccess(raw);
  const perRole: Array<Set<string>> = [];
  for (const role of roles) {
    const map = cfg[role];
    if (!map || typeof map !== 'object') continue; // no config for this role → hides nothing
    perRole.push(new Set(Object.entries(map).filter(([, v]) => v === false).map(([k]) => k)));
  }
  if (perRole.length === 0) return [];
  let inter = perRole[0]!;
  for (const s of perRole.slice(1)) inter = new Set([...inter].filter((k) => s.has(k)));
  return [...inter].filter((k) => !ALWAYS_VISIBLE.has(k));
}

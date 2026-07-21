import { redirect } from 'next/navigation';

// /tenants was an unlinked super-admin page. Tenant routes are now self-scoped,
// so managing "your pharmacy" belongs in Settings → Profile. Redirect there
// instead of leaving an orphan page.
export default function TenantsPage() {
  redirect('/settings');
}

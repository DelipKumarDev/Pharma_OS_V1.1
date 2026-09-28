'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { hasMenuPerm, permForPath } from '@/lib/menu-tree';

// Defense-in-depth for RBAC: hiding a leaf in the sidebar is not enough — a user
// could type the URL. This guard blocks and redirects any authenticated user who
// navigates to a route whose required permission they lack. (The API also returns
// 403 for the underlying data, so this is a UX layer over an already-enforced
// boundary.)
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const perm = permForPath(pathname);
  // Only decide once the user is known; unauthenticated redirects are handled by
  // StartupGuards. `undefined` perm = unrestricted route.
  const denied = !!user && !!perm && !hasMenuPerm(user.permissions, perm);

  useEffect(() => {
    if (denied) router.replace('/dashboard');
  }, [denied, router]);

  if (denied) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm font-medium">You don&apos;t have access to this page.</p>
        <p className="text-xs text-muted-foreground">Redirecting to your dashboard…</p>
      </div>
    );
  }
  return <>{children}</>;
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { KeyRound, Shield, Check } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

interface Perm { module: string; action: string; }
interface Role { id: string; name: string; description?: string; isSystem?: boolean; userCount?: number; permissions: Perm[]; }

async function fetchRoles(): Promise<Role[]> {
  const r = await apiFetch('/api/roles');
  const j = await r.json() as { data: Role[] | { data: Role[] } };
  return Array.isArray(j.data) ? j.data : (j.data?.data ?? []);
}

export default function PermissionsPage() {
  const { data: roles = [], isLoading } = useQuery({ queryKey: ['permissions-roles'], queryFn: fetchRoles });

  // All modules across roles → matrix columns are roles, rows are modules.
  const modules = Array.from(new Set(roles.flatMap((r) => r.permissions.map((p) => p.module)))).sort();
  const has = (role: Role, mod: string) => role.permissions.filter((p) => p.module === mod).map((p) => p.action);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><KeyRound className="h-4 w-4 text-primary" /></div>
          <div><h1 className="text-2xl font-bold tracking-tight">Permissions</h1><p className="text-sm text-muted-foreground">What each role can do across every module</p></div>
        </div>
        <Button variant="outline" size="sm" asChild><Link href="/roles"><Shield className="h-4 w-4" /> Manage Roles</Link></Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Module</th>
                {roles.map((r) => (
                  <th key={r.id} className="px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    {r.name}{r.isSystem && <span className="ml-1 text-[9px] font-normal text-muted-foreground/60">(system)</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((mod) => (
                <tr key={mod} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-medium capitalize">{mod}</td>
                  {roles.map((r) => {
                    const actions = has(r, mod);
                    return (
                      <td key={r.id} className="px-4 py-2.5 text-center">
                        {actions.length === 0 ? <span className="text-muted-foreground/30">—</span> : (
                          <div className="flex flex-wrap justify-center gap-1">
                            {actions.map((a) => <Badge key={a} variant="secondary" className="text-[10px] px-1.5 py-0 capitalize"><Check className="h-2.5 w-2.5 mr-0.5" />{a}</Badge>)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {modules.length === 0 && <tr><td colSpan={roles.length + 1} className="px-4 py-8 text-center text-muted-foreground">No permissions defined</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Shield, Users, Trash2, Lock, XCircle, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { Role } from '@pharmaos/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

const MODULES = [
  { key: 'medicines', label: 'Medicine Master', icon: '💊' },
  { key: 'inventory', label: 'Inventory', icon: '📦' },
  { key: 'billing', label: 'Billing', icon: '🧾' },
  { key: 'reports', label: 'Reports', icon: '📊' },
  { key: 'users', label: 'User Management', icon: '👥' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
];

const ACTIONS = ['view', 'create', 'edit', 'delete', 'export'] as const;

async function fetchRoles(): Promise<Role[]> {
  const res = await apiFetch('/api/roles');
  const json = await res.json() as { success: boolean; data: { data: Role[] } };
  if (!res.ok) throw new Error('Request failed');
  return json.data?.data ?? ([] as Role[]);
}

interface PermissionDef { id: string; module: string; action: string }

async function fetchPermissions(): Promise<PermissionDef[]> {
  const res = await apiFetch('/api/roles/permissions');
  const json = await res.json() as { success: boolean; data: PermissionDef[] };
  if (!res.ok) throw new Error('Request failed');
  return json.data ?? [];
}

async function createRole(data: { name: string; description: string; permissionIds: string[] }): Promise<Role> {
  const res = await apiFetch('/api/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json() as { success: boolean; data: Role; message?: string };
  if (!json.success) throw new Error(json.message ?? 'Failed to create role');
  return json.data;
}

async function updateRole(id: string, data: { name: string; description: string; permissionIds: string[] }): Promise<Role> {
  const res = await apiFetch(`/api/roles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json() as { success: boolean; data: Role; message?: string };
  if (!res.ok || !json.success) throw new Error(json.message ?? 'Failed to update role');
  return json.data;
}

async function deleteRole(id: string) {
  const res = await apiFetch(`/api/roles/${id}`, { method: 'DELETE' });
  const json = await res.json() as { success: boolean; message?: string };
  if (!json.success) throw new Error(json.message ?? 'Cannot delete');
}

export function RolesView() {
  const qc = useQueryClient();
  // dialogRole: null = closed, 'new' = create, Role = edit that role.
  const [dialogRole, setDialogRole] = useState<Role | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});

  const { data: roles = [], isLoading } = useQuery({ queryKey: ['roles'], queryFn: fetchRoles });
  const { data: permCatalog = [] } = useQuery({ queryKey: ['permissions'], queryFn: fetchPermissions });

  // Map "module:action" ⇄ real permission id (roles link by permission id).
  const permIdByKey = React.useMemo(
    () => new Map(permCatalog.map((p) => [`${p.module}:${p.action}`, p.id])),
    [permCatalog],
  );

  function openCreate() {
    setNewName(''); setNewDesc(''); setPermissions({}); setDialogRole('new');
  }
  function openEdit(role: Role) {
    setNewName(role.name);
    setNewDesc(role.description ?? '');
    const seed: Record<string, boolean> = {};
    role.permissions.forEach((p) => { seed[`${p.module}:${p.action}`] = true; });
    setPermissions(seed);
    setDialogRole(role);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const permissionIds = Object.keys(permissions)
        .filter((k) => permissions[k])
        .map((k) => permIdByKey.get(k))
        .filter((id): id is string => !!id);
      const payload = { name: newName.trim(), description: newDesc.trim(), permissionIds };
      return dialogRole === 'new' || !dialogRole
        ? createRole(payload)
        : updateRole(dialogRole.id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      toast.success(dialogRole === 'new' ? 'Role created successfully' : 'Role updated');
      setDialogRole(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Role deleted');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function togglePerm(module: string, action: string) {
    const key = `${module}:${action}`;
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSave() {
    if (!newName.trim()) { toast.error('Role name is required'); return; }
    saveMutation.mutate();
  }

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roles & Permissions</h1>
          <p className="text-sm text-muted-foreground">Manage staff roles and their access control across modules</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Create Role
        </Button>
      </div>

      {/* Roles grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <div key={role.id} className={cn('rounded-xl border bg-card p-5 shadow-sm', role.isSystem && 'border-primary/20')}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', role.isSystem ? 'bg-primary/10' : 'bg-muted')}>
                  <Shield className={cn('h-4 w-4', role.isSystem ? 'text-primary' : 'text-muted-foreground')} />
                </div>
                <div>
                  <p className="font-semibold leading-tight">{role.name}</p>
                  {role.isSystem && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">System Role</span>
                    </div>
                  )}
                </div>
              </div>
              {!role.isSystem && (
                <div className="flex items-center gap-0.5">
                  <button onClick={() => openEdit(role)} className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary" title="Edit role">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setDeleteTarget(role)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete role">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {role.description && (
              <p className="mb-3 text-sm text-muted-foreground">{role.description}</p>
            )}

            <Separator className="my-3" />

            <div className="space-y-1.5">
              {MODULES.map((mod) => {
                const modPerms = role.permissions.filter((p) => p.module === mod.key);
                if (modPerms.length === 0) return null;
                return (
                  <div key={mod.key} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 text-xs text-muted-foreground">{mod.label}</span>
                    <div className="flex flex-wrap gap-1">
                      {modPerms.map((p) => (
                        <Badge key={p.id} variant="secondary" className="px-1.5 text-[10px] capitalize">{p.action}</Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
              {role.permissions.length === 0 && (
                <p className="text-xs text-muted-foreground">No specific permissions — custom role</p>
              )}
            </div>

            <Separator className="my-3" />

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>{role.userCount ?? 0} user{(role.userCount ?? 0) !== 1 ? 's' : ''} assigned</span>
            </div>
          </div>
        ))}
      </div>

      {/* Permission matrix overview */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold">Permission Matrix</h2>
          <p className="text-sm text-muted-foreground">Overview of role access across all modules</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="py-3 pl-5 text-left font-medium text-muted-foreground">Module</th>
                {roles.map((r) => <th key={r.id} className="px-3 py-3 text-center font-medium text-muted-foreground">{r.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((mod, mIdx) => (
                <tr key={mod.key} className={cn('border-b border-border', mIdx % 2 === 0 && 'bg-muted/10')}>
                  <td className="py-3 pl-5 font-medium">
                    <span className="mr-1.5">{mod.icon}</span>{mod.label}
                  </td>
                  {roles.map((role) => {
                    const hasAccess = role.permissions.some((p) => p.module === mod.key);
                    const actions = role.permissions.filter((p) => p.module === mod.key).map((p) => p.action);
                    return (
                      <td key={role.id} className="px-3 py-3 text-center">
                        {hasAccess ? (
                          <div className="flex justify-center gap-0.5">
                            {actions.slice(0, 3).map((a) => (
                              <span key={a} className="inline-flex items-center justify-center rounded bg-success/10 px-1 text-[10px] text-success capitalize">{a[0]}</span>
                            ))}
                            {actions.length > 3 && <span className="text-[10px] text-muted-foreground">+{actions.length - 3}</span>}
                          </div>
                        ) : (
                          <XCircle className="mx-auto h-4 w-4 text-muted-foreground/30" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Role Dialog */}
      <Dialog open={dialogRole !== null} onOpenChange={(o) => !o && setDialogRole(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogRole === 'new' || !dialogRole ? 'Create New Role' : `Edit Role — ${dialogRole.name}`}</DialogTitle>
            <DialogDescription>Define the role name and select which permissions to grant</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Role Name <span className="text-destructive">*</span></Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Senior Pharmacist" />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Brief description of this role" />
              </div>
            </div>

            <div>
              <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Permissions</Label>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr,repeat(5,auto)] bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground gap-4">
                  <span>Module</span>
                  {ACTIONS.map((a) => <span key={a} className="w-12 text-center capitalize">{a}</span>)}
                </div>
                {MODULES.map((mod, idx) => (
                  <div key={mod.key} className={cn('grid grid-cols-[1fr,repeat(5,auto)] items-center px-4 py-2 gap-4', idx % 2 === 0 ? 'bg-background' : 'bg-muted/10')}>
                    <span className="text-sm font-medium">{mod.icon} {mod.label}</span>
                    {ACTIONS.map((action) => {
                      const key = `${mod.key}:${action}`;
                      const checked = !!permissions[key];
                      return (
                        <div key={action} className="flex w-12 justify-center">
                          <input type="checkbox" checked={checked} onChange={() => togglePerm(mod.key, action)}
                            className="h-4 w-4 accent-primary cursor-pointer" />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogRole(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {dialogRole === 'new' || !dialogRole ? 'Create Role' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role?</AlertDialogTitle>
            <AlertDialogDescription>
              The role <strong>{deleteTarget?.name}</strong> will be permanently deleted. Users assigned to this role will lose these permissions immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              Delete Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

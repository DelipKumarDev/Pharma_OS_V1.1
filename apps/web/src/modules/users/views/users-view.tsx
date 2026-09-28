'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { UserPlus, Shield, Users, UserCheck, UserX, MoreHorizontal, Edit, Lock, Unlock, Download } from 'lucide-react';
import { toast } from 'sonner';
import type { User } from '@pharmaos/types';
import { formatDateTime } from '@pharmaos/utils';
import { getInitials } from '@/lib/utils';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InviteUserDialog } from '@/components/users/invite-user-dialog';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useCan } from '@/lib/permissions';
import type { Role } from '@pharmaos/types';

async function fetchUsers(): Promise<User[]> {
  const res = await apiFetch('/api/users');
  const json = await res.json() as { success: boolean; data: { data: User[] } };
  if (!res.ok) throw new Error('Request failed');
  return json.data?.data ?? ([] as User[]);
}

async function fetchRoles(): Promise<Role[]> {
  const res = await apiFetch('/api/roles');
  const json = await res.json() as { success: boolean; data: { data: Role[] } };
  if (!res.ok) return [];
  return json.data?.data ?? [];
}

interface EditForm { name: string; phone: string; status: string; roleIds: string[] }

function exportCSV(data: User[]) {
  const headers = ['Name', 'Email', 'Phone', 'Roles', 'Status', 'MFA', 'Last Login', 'Created'];
  // Quote every field — names and formatted date/times contain commas, which
  // otherwise split into extra unlabeled columns (Divya R23 / Vinay P2.4).
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = data.map((u) => [u.name, u.email, u.phone ?? '', u.roles.map((r) => r.name).join('; '), u.status, u.mfaEnabled ? 'Yes' : 'No', u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never', formatDateTime(u.createdAt)].map(q).join(','));
  const csv = [headers.map(q).join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `users-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${data.length} users`);
}

export function UsersView() {
  const router = useRouter();
  const can = useCan();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [lockTarget, setLockTarget] = useState<User | null>(null);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', phone: '', status: 'active', roleIds: [] });

  const { data = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const { data: allRoles = [] } = useQuery({ queryKey: ['roles'], queryFn: fetchRoles });

  function openEdit(u: User) {
    setEditForm({ name: u.name, phone: u.phone ?? '', status: u.status, roleIds: u.roles.map((r) => r.id) });
    setEditTarget(u);
  }

  const editMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/users/${editTarget!.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editForm.name.trim(), phone: editForm.phone.trim() || null, status: editForm.status, roleIds: editForm.roleIds }),
      });
      const j = await res.json() as { success: boolean; message?: string };
      if (!res.ok || !j.success) throw new Error(j.message ?? 'Failed to update user');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User updated'); setEditTarget(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Admin reset password → reveal the one-time temp password to hand over.
  const [tempPw, setTempPw] = useState<{ user: User; password: string } | null>(null);
  const resetMutation = useMutation({
    mutationFn: async (u: User) => {
      const res = await apiFetch(`/api/users/${u.id}/reset-password`, { method: 'POST' });
      const j = await res.json() as { success: boolean; message?: string; data?: { tempPassword: string } };
      if (!res.ok || !j.success || !j.data) throw new Error(j.message ?? 'Failed to reset password');
      return { u, password: j.data.tempPassword };
    },
    onSuccess: ({ u, password }) => setTempPw({ user: u, password }),
    onError: (e: Error) => toast.error(e.message),
  });

  const mfaMutation = useMutation({
    mutationFn: async (u: User) => {
      const res = await apiFetch(`/api/users/${u.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaEnabled: !u.mfaEnabled }),
      });
      const j = await res.json() as { success: boolean; message?: string };
      if (!res.ok || !j.success) throw new Error(j.message ?? 'Failed to update MFA');
      return !u.mfaEnabled;
    },
    onSuccess: (enabled) => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success(`MFA ${enabled ? 'enabled' : 'disabled'}`); },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = {
    total: data.length,
    active: data.filter((u) => u.status === 'active').length,
    locked: data.filter((u) => u.status === 'locked').length,
    mfaEnabled: data.filter((u) => u.mfaEnabled).length,
  };

  const lockMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiFetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(`Account ${lockTarget?.status === 'locked' ? 'unlocked' : 'locked'} successfully`);
      setLockTarget(null);
    },
  });

  const columns: ColumnDef<User>[] = [
    {
      id: 'user',
      accessorFn: (row) => `${row.name} ${row.email}`,
      header: 'User',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={row.original.avatar} />
            <AvatarFallback className="text-xs">{getInitials(row.original.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.phone ?? '—'}</span>,
    },
    {
      id: 'roles',
      header: 'Roles',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.roles.map((role) => (
            <Badge key={role.id} variant="secondary" className="text-xs">{role.name}</Badge>
          ))}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const s = row.original.status;
        const variants = { active: 'success', inactive: 'muted', locked: 'error', pending: 'warning' } as const;
        return <Badge variant={variants[s] ?? 'muted'} dot className="text-xs capitalize">{s}</Badge>;
      },
    },
    {
      id: 'mfa',
      header: 'MFA',
      cell: ({ row }) => row.original.mfaEnabled
        ? <Badge variant="success" className="text-xs">Enabled</Badge>
        : <Badge variant="muted" className="text-xs">Disabled</Badge>,
    },
    {
      accessorKey: 'lastLoginAt',
      header: ({ column }) => <SortableHeader column={column}>Last Login</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.lastLoginAt ? formatDateTime(row.original.lastLoginAt) : 'Never'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        can('users:edit') ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(row.original)}><Edit className="h-4 w-4" /> Edit User</DropdownMenuItem>
              <DropdownMenuItem onClick={() => resetMutation.mutate(row.original)}>
                Reset Password
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => mfaMutation.mutate(row.original)}>
                {row.original.mfaEnabled ? 'Disable MFA' : 'Enable MFA'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onClick={() => setLockTarget(row.original)}>
                {row.original.status === 'locked'
                  ? <><Unlock className="h-4 w-4" /> Unlock Account</>
                  : <><Lock className="h-4 w-4" /> Lock Account</>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground">Manage pharmacy staff, roles, and access control</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCSV(data)}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          {can('users:edit') && (
            <Button variant="outline" size="sm" onClick={() => router.push('/roles')}>
              <Shield className="h-4 w-4" /> Manage Roles
            </Button>
          )}
          {can('users:create') && (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" /> Invite User
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Users', value: stats.total, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Active', value: stats.active, icon: UserCheck, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Locked', value: stats.locked, icon: UserX, color: 'text-destructive', bg: 'bg-destructive/10' },
          { label: 'MFA Enabled', value: stats.mfaEnabled, icon: Shield, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', bg)}>
              <Icon className={cn('h-4 w-4', color)} />
            </div>
            <div>
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={data}
        loading={isLoading}
        searchColumn="user"
        searchPlaceholder="Search by name or email…"
        emptyMessage="No users found"
        emptyDescription="Invite your first team member."
      />

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      {/* Temporary password reveal (shown once) */}
      <Dialog open={!!tempPw} onOpenChange={(o) => !o && setTempPw(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Temporary password</DialogTitle>
            <DialogDescription>
              Share this with <span className="font-medium text-foreground">{tempPw?.user.name}</span> securely. It won&apos;t be shown again — they should change it after signing in.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
            <code className="flex-1 font-mono text-sm tracking-wide select-all">{tempPw?.password}</code>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(tempPw?.password ?? ''); toast.success('Copied'); }}>Copy</Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setTempPw(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update {editTarget?.name}&apos;s profile, status and roles.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Name</Label><Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Phone</Label><Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} placeholder="10-digit" /></div>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="locked">Locked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Roles</Label>
              <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-border p-2 max-h-40 overflow-y-auto">
                {allRoles.map((r) => {
                  const on = editForm.roleIds.includes(r.id);
                  return (
                    <label key={r.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm cursor-pointer hover:bg-muted">
                      <input type="checkbox" checked={on} className="h-3.5 w-3.5 accent-primary"
                        onChange={() => setEditForm((f) => ({ ...f, roleIds: on ? f.roleIds.filter((id) => id !== r.id) : [...f.roleIds, r.id] }))} />
                      <span className="truncate">{r.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button disabled={!editForm.name.trim() || editMutation.isPending} onClick={() => editMutation.mutate()}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!lockTarget} onOpenChange={(o) => !o && setLockTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{lockTarget?.status === 'locked' ? 'Unlock Account?' : 'Lock Account?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {lockTarget?.status === 'locked'
                ? `${lockTarget?.name} will be able to log in again.`
                : `${lockTarget?.name} will not be able to log in until unlocked. Their data will be preserved.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={lockTarget?.status !== 'locked' ? 'bg-destructive hover:bg-destructive/90' : ''}
              onClick={() => lockTarget && lockMutation.mutate({ id: lockTarget.id, status: lockTarget.status === 'locked' ? 'active' : 'locked' })}
            >
              {lockTarget?.status === 'locked' ? 'Unlock Account' : 'Lock Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

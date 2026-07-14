'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Mail, Shield } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Role, User } from '@pharmaos/types';
import { apiFetch } from '@/lib/api';

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  roleIds: z.array(z.string()).min(1, 'Select at least one role'),
  sendInvite: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function fetchRoles(): Promise<Role[]> {
  const res = await apiFetch('/api/roles');
  const json = await res.json() as { success: boolean; data: { data: Role[] } };
  if (!res.ok) throw new Error('Request failed');
  return json.data?.data ?? ([] as Role[]);
}

async function inviteUser(data: FormValues): Promise<User> {
  const res = await apiFetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json() as { success: boolean; data: User; message?: string };
  if (!json.success) throw new Error(json.message ?? 'Failed to invite user');
  return json.data;
}

export function InviteUserDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [selectedRoles, setSelectedRoles] = React.useState<string[]>([]);

  const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: fetchRoles });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { roleIds: [], sendInvite: true },
  });

  React.useEffect(() => {
    if (open) {
      reset({ roleIds: [], sendInvite: true });
      setSelectedRoles([]);
    }
  }, [open, reset]);

  function toggleRole(id: string) {
    const next = selectedRoles.includes(id) ? selectedRoles.filter((r) => r !== id) : [...selectedRoles, id];
    setSelectedRoles(next);
    setValue('roleIds', next);
  }

  const sendInvite = watch('sendInvite');

  const mutation = useMutation({
    mutationFn: inviteUser,
    onSuccess: (user) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(`Invite sent to ${user.email}`, { description: `${user.name} has been added as pending.` });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>Add a new user to your pharmacy. They'll receive an email invite.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1">
            <Label>Full Name <span className="text-destructive">*</span></Label>
            <Input {...register('name')} placeholder="e.g. Ravi Kumar" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Email Address <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input {...register('email')} type="email" className="pl-8" placeholder="user@pharmacy.com" />
            </div>
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Phone</Label>
            <Input {...register('phone')} placeholder="10-digit mobile number" maxLength={10} />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Assign Roles <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-1 gap-1.5">
              {roles.map((role) => (
                <label key={role.id} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${selectedRoles.includes(role.id) ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'}`}>
                  <input type="checkbox" checked={selectedRoles.includes(role.id)} onChange={() => toggleRole(role.id)} className="mt-0.5 h-4 w-4 accent-primary" />
                  <div>
                    <p className="text-sm font-medium">{role.name}</p>
                    {role.description && <p className="text-xs text-muted-foreground">{role.description}</p>}
                  </div>
                  {role.isSystem && <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">System</span>}
                </label>
              ))}
            </div>
            {errors.roleIds && <p className="text-xs text-destructive">{errors.roleIds.message}</p>}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={sendInvite} onChange={(e) => setValue('sendInvite', e.target.checked)} className="h-4 w-4 accent-primary" />
            Send email invite immediately
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

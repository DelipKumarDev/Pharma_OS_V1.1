'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye, EyeOff, Lock, User, AlertTriangle, Shield, Pill, Users, CreditCard,
  Phone, Mail, ExternalLink, ChevronRight, HelpCircle,
  Loader2, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';
import type { AuthSession } from '@pharmaos/types';

/* ── Schema ── */
const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, 'User ID is required')
    .refine(
      (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || /^\d{10}$/.test(v),
      'Enter a valid email address or 10-digit mobile number'
    ),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

/* ── Demo accounts ── */
const DEMO_PASSWORD = 'Divya@Care2026';
const DEMO_ROLES = [
  {
    role: 'Admin',
    icon: Shield,
    email: 'admin@divyacare.test',
    iconBg: 'bg-emerald-50',
    iconCls: 'text-emerald-600',
  },
  {
    role: 'Pharmacist',
    icon: Pill,
    email: 'ananya@divyacare.test',
    iconBg: 'bg-green-50',
    iconCls: 'text-green-600',
  },
  {
    role: 'Cashier',
    icon: CreditCard,
    email: 'suresh@divyacare.test',
    iconBg: 'bg-orange-50',
    iconCls: 'text-orange-500',
  },
  {
    role: 'Manager',
    icon: Users,
    email: 'rahul.admin@divyacare.test',
    iconBg: 'bg-purple-50',
    iconCls: 'text-purple-600',
  },
] as const;

/* ── Support Center Dialog ── */
function SupportCenterDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const options: {
    icon: typeof Phone; iconBg: string; iconCls: string; label: string; desc: string;
    href?: string; onClick?: () => void; badge?: string;
  }[] = [
    {
      icon: Phone,
      iconBg: 'bg-blue-100 dark:bg-blue-950',
      iconCls: 'text-blue-600',
      label: 'Call Support',
      desc: '1800-123-4567 · Mon–Sat, 9 am–8 pm IST',
      href: 'tel:18001234567',
    },
    {
      icon: Mail,
      iconBg: 'bg-indigo-100 dark:bg-indigo-950',
      iconCls: 'text-indigo-600',
      label: 'Email Support',
      desc: 'support@pharmaos.in · Reply within 4 hours',
      href: 'mailto:support@pharmaos.in',
    },
    {
      icon: ExternalLink,
      iconBg: 'bg-amber-100 dark:bg-amber-950',
      iconCls: 'text-amber-600',
      label: 'Help Center',
      desc: 'Guides, FAQs and video tutorials',
      href: '/help',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Support Center
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2.5 pt-1">
          {options.map(({ icon: Icon, iconBg, iconCls, label, desc, badge, href, onClick }) => {
            const inner = (
              <>
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', iconBg)}>
                  <Icon className={cn('h-5 w-5', iconCls)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                {badge ? (
                  <Badge variant="secondary" className="shrink-0 text-xs">{badge}</Badge>
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </>
            );

            const baseCls =
              'flex w-full items-center gap-4 rounded-xl border bg-muted/30 p-4 text-left transition-colors hover:bg-muted';

            return onClick ? (
              <button key={label} onClick={onClick} className={baseCls}>
                {inner}
              </button>
            ) : (
              <a key={label} href={href} className={baseCls}>
                {inner}
              </a>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main LoginForm ── */
export function LoginForm() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '', rememberMe: false },
  });

  async function onSubmit(values: LoginFormValues) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.identifier, password: values.password }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data: AuthSession;
        message?: string;
      };
      if (!res.ok || !json.success) {
        setError('root', { message: json.message ?? 'Invalid credentials. Please try again.' });
        return;
      }
      setAuth(json.data.user, json.data.tokens);
      toast.success(`Welcome back, ${json.data.user.name.split(' ')[0]}!`);
      router.push('/dashboard');
    } catch {
      setError('root', { message: 'Network error. Please check your connection and try again.' });
    }
  }

  async function loginAsDemo(email: string) {
    setDemoLoading(email);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: DEMO_PASSWORD }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data: AuthSession;
        message?: string;
      };
      if (!res.ok || !json.success) {
        toast.error(json.message ?? 'Demo login failed');
        return;
      }
      setAuth(json.data.user, json.data.tokens);
      toast.success(`Signed in as ${(email.split('@')[0] ?? email).replace(/[._]/g, ' ')}`);
      router.push('/dashboard');
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setDemoLoading(null);
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
        aria-label="Sign in form"
      >
        {/* Root error */}
        {errors.root && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{errors.root.message}</span>
          </div>
        )}

        {/* User ID */}
        <div className="space-y-1.5">
          <Label htmlFor="identifier" required>
            User ID
          </Label>
          <Input
            id="identifier"
            type="text"
            inputMode="text"
            placeholder="Enter User ID"
            autoComplete="username"
            autoFocus
            startIcon={<User />}
            error={!!errors.identifier}
            aria-describedby={errors.identifier ? 'identifier-error' : 'identifier-hint'}
            {...register('identifier')}
          />
          {errors.identifier ? (
            <p id="identifier-error" role="alert" className="text-xs text-destructive">
              {errors.identifier.message}
            </p>
          ) : (
            <p id="identifier-hint" className="text-[11px] text-muted-foreground">
              Enter your User ID or mobile number
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" required>
              Password
            </Label>
            <a
              href="/forgot-password"
              className="text-xs font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Forgot password?
            </a>
          </div>
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            startIcon={<Lock />}
            error={!!errors.password}
            aria-describedby={
              errors.password ? 'password-error' : capsLock ? 'caps-warning' : undefined
            }
            endIcon={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-muted-foreground transition-colors hover:text-foreground"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            }
            onKeyDown={(e) => setCapsLock(e.getModifierState('CapsLock'))}
            onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
            {...register('password')}
          />
          {errors.password && (
            <p id="password-error" role="alert" className="text-xs text-destructive">
              {errors.password.message}
            </p>
          )}
          {capsLock && !errors.password && (
            <p id="caps-warning" role="status" className="flex items-center gap-1 text-xs text-amber-600">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              Caps Lock is on
            </p>
          )}
        </div>

        {/* Stay signed in */}
        <div className="flex items-center gap-2">
          <input
            id="rememberMe"
            type="checkbox"
            className="h-4 w-4 rounded border-border accent-primary focus:ring-primary"
            aria-label="Stay signed in"
            {...register('rememberMe')}
          />
          <Label
            htmlFor="rememberMe"
            className="cursor-pointer font-normal text-muted-foreground"
          >
            Stay signed in
          </Label>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full gap-2"
          size="lg"
          loading={isSubmitting}
          aria-label={isSubmitting ? 'Signing in, please wait' : 'Sign in'}
        >
          {isSubmitting ? (
            'Signing in…'
          ) : (
            <>
              Sign in
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </form>

      {/* ── OR divider ── */}
      <div className="relative my-5" role="separator">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-xs font-medium text-muted-foreground">OR</span>
        </div>
      </div>

      {/* ── Demo accounts ── */}
      <div>
        <p className="mb-2.5 text-xs font-medium text-muted-foreground">Try a demo account</p>
        <div className="grid grid-cols-2 gap-2.5">
          {DEMO_ROLES.map(({ role, icon: Icon, email, iconBg, iconCls }) => (
            <button
              key={role}
              type="button"
              onClick={() => loginAsDemo(email)}
              disabled={demoLoading !== null}
              className="flex items-center gap-3 rounded-xl border border-border bg-white px-3.5 py-3 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-[hsl(220_13%_97%)] disabled:pointer-events-none disabled:opacity-50"
              aria-label={`Sign in as ${role}`}
            >
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconBg)}>
                {demoLoading === email ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
                ) : (
                  <Icon className={cn('h-4 w-4', iconCls)} aria-hidden="true" />
                )}
              </div>
              <span>{role}</span>
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-[10px] text-muted-foreground">
          Password for all demo accounts:{' '}
          <code className="font-mono font-semibold">{DEMO_PASSWORD}</code>
        </p>
      </div>

      {/* ── Support link ── */}
      <p className="mt-5 text-center text-[13px] text-muted-foreground">
        Need help signing in?{' '}
        <button
          type="button"
          onClick={() => setSupportOpen(true)}
          className="font-semibold text-emerald-600 transition-colors hover:underline"
          aria-label="Open support center"
        >
          Get help
        </button>
      </p>

      <SupportCenterDialog open={supportOpen} onOpenChange={setSupportOpen} />
    </>
  );
}

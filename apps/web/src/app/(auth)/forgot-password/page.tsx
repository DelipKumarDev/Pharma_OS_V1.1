'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft, Eye, EyeOff, Lock, Mail, Check, AlertTriangle,
  RefreshCw, CheckCircle2, Loader2, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/* ── Pharmacy cross + saffron-leaf icon ── */
function PharmaLogoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="15.5" y="5" width="9" height="30" rx="3.5" fill="white" opacity="0.95" />
      <rect x="5" y="15.5" width="30" height="9" rx="3.5" fill="white" opacity="0.95" />
      <path d="M24.5 5 C32 8 34 20 27 22 C25 16 23 9 24.5 5Z" fill="#f59e0b" opacity="0.9" />
      <circle cx="20" cy="20" r="3" fill="white" opacity="0.55" />
    </svg>
  );
}

/* ── Step indicator ── */
type Step = 'request' | 'verify' | 'reset' | 'success';
const STEPS: { key: Step; label: string }[] = [
  { key: 'request', label: 'Send OTP' },
  { key: 'verify',  label: 'Verify OTP' },
  { key: 'reset',   label: 'New Password' },
  { key: 'success', label: 'Done' },
];

function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="mb-8 flex items-center">
      {STEPS.map(({ key, label }, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <React.Fragment key={key}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ring-2 transition-all',
                  done
                    ? 'bg-primary text-primary-foreground ring-primary'
                    : active
                    ? 'bg-primary/15 text-primary ring-primary'
                    : 'bg-muted text-muted-foreground ring-border'
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  'hidden text-[10px] font-medium sm:block',
                  active ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'mx-2 mb-3.5 h-px flex-1 transition-colors sm:mb-5',
                  i < currentIdx ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Password strength ── */
function getPasswordStrength(p: string): {
  score: number;
  label: string;
  barCls: string;
} {
  if (!p) return { score: 0, label: '', barCls: '' };
  let s = 0;
  if (p.length >= 8) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^a-zA-Z\d]/.test(p)) s++;
  const labels  = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const barCls  = ['', 'bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500'];
  return { score: s, label: labels[s] ?? '', barCls: barCls[s] ?? '' };
}

/* ── Schemas ── */
const requestSchema = z.object({
  identifier: z
    .string()
    .min(1, 'Email or mobile number is required')
    .refine(
      (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || /^\d{10}$/.test(v),
      'Enter a valid email address or 10-digit mobile number'
    ),
});
type RequestValues = z.infer<typeof requestSchema>;

const resetSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
type ResetValues = z.infer<typeof resetSchema>;

/* ══════════════════════════════════════════════
   Step 1 – Request OTP
══════════════════════════════════════════════ */
function RequestOTPStep({
  onSuccess,
}: {
  onSuccess: (identifier: string) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RequestValues>({
    mode: 'onTouched',
    resolver: zodResolver(requestSchema),
  });

  async function onSubmit({ identifier }: RequestValues) {
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      const json = await res.json() as { success: boolean; message?: string };
      if (!res.ok || !json.success) {
        setError('root', { message: json.message ?? 'Failed to send OTP' });
        return;
      }
      toast.success('OTP sent! Check your email or SMS.');
      onSuccess(identifier);
    } catch {
      setError('root', { message: 'Network error. Please try again.' });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div>
        <h2 className="text-xl font-bold tracking-tight">Forgot your password?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your registered email or mobile number and we&rsquo;ll send you a one-time password.
        </p>
      </div>

      {errors.root && (
        <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {errors.root.message}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="req-identifier" required>Email Address or Mobile Number</Label>
        <Input
          id="req-identifier"
          type="text"
          inputMode="email"
          placeholder="name@pharmacy.com or 9876543210"
          autoComplete="email"
          autoFocus
          startIcon={<Mail />}
          error={!!errors.identifier}
          {...register('identifier')}
        />
        {errors.identifier && (
          <p role="alert" className="text-xs text-destructive">{errors.identifier.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
        {isSubmitting ? 'Sending OTP…' : 'Send OTP'}
      </Button>
    </form>
  );
}

/* ══════════════════════════════════════════════
   Step 2 – Verify OTP
══════════════════════════════════════════════ */
function VerifyOTPStep({
  identifier,
  onSuccess,
  onBack,
}: {
  identifier: string;
  onSuccess: (resetToken: string) => void;
  onBack: () => void;
}) {
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(30);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    otpRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  function handleChange(i: number, val: string) {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    setError('');
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = [...otp];
    digits.split('').forEach((d, i) => { next[i] = d; });
    setOtp(next);
    const focusIdx = Math.min(digits.length, 5);
    otpRefs.current[focusIdx]?.focus();
  }

  async function handleResend() {
    setTimer(30);
    try {
      await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      toast.success('New OTP sent!');
    } catch {
      toast.error('Failed to resend OTP');
    }
  }

  async function handleVerify() {
    const code = otp.join('');
    if (code.length < 6) { setError('Please enter the complete 6-digit OTP'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, otp: code }),
      });
      const json = await res.json() as { success: boolean; data?: { resetToken: string }; message?: string };
      if (!res.ok || !json.success || !json.data) {
        setError(json.message ?? 'Invalid OTP. Please try again.');
        setOtp(Array(6).fill(''));
        otpRefs.current[0]?.focus();
        return;
      }
      onSuccess(json.data.resetToken);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const filled = otp.every((d) => d !== '');

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Enter verification code</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent a 6-digit OTP to{' '}
          <span className="font-medium text-foreground">{identifier}</span>.
          {' '}Use <code className="font-mono text-xs text-primary">123456</code> for demo.
        </p>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* 6-box OTP input */}
      <div className="flex items-center justify-between gap-2" onPaste={handlePaste}>
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { otpRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            aria-label={`OTP digit ${i + 1}`}
            className={cn(
              'h-12 w-full max-w-[3rem] rounded-xl border-2 bg-background text-center text-lg font-bold tabular-nums transition-all outline-none',
              digit
                ? 'border-primary text-foreground'
                : 'border-border text-muted-foreground',
              'focus:border-primary focus:ring-1 focus:ring-primary/30'
            )}
          />
        ))}
      </div>

      {/* Resend timer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Change {/^\d{10}$/.test(identifier) ? 'mobile' : 'email'}
        </button>
        {timer > 0 ? (
          <span>Resend in {timer}s</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            className="flex items-center gap-1 font-medium text-primary transition-colors hover:underline"
          >
            <RefreshCw className="h-3 w-3" /> Resend OTP
          </button>
        )}
      </div>

      <Button
        onClick={handleVerify}
        disabled={!filled || loading}
        className="w-full"
        size="lg"
        loading={loading}
      >
        {loading ? 'Verifying…' : 'Verify OTP'}
      </Button>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Step 3 – New Password
══════════════════════════════════════════════ */
function NewPasswordStep({
  resetToken,
  onSuccess,
}: {
  resetToken: string;
  onSuccess: () => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordVal, setPasswordVal] = useState('');
  const strength = useMemo(() => getPasswordStrength(passwordVal), [passwordVal]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    watch,
  } = useForm<ResetValues>({ mode: 'onTouched', resolver: zodResolver(resetSchema) });

  const watchedPassword = watch('password', '');
  useEffect(() => { setPasswordVal(watchedPassword); }, [watchedPassword]);

  async function onSubmit({ password }: ResetValues) {
    try {
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, password }),
      });
      const json = await res.json() as { success: boolean; message?: string };
      if (!res.ok || !json.success) {
        setError('root', { message: json.message ?? 'Failed to reset password' });
        return;
      }
      onSuccess();
    } catch {
      setError('root', { message: 'Network error. Please try again.' });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div>
        <h2 className="text-xl font-bold tracking-tight">Set a new password</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a strong password you haven&rsquo;t used before.
        </p>
      </div>

      {errors.root && (
        <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {errors.root.message}
        </div>
      )}

      {/* New password */}
      <div className="space-y-1.5">
        <Label htmlFor="new-password" required>New Password</Label>
        <Input
          id="new-password"
          type={showNew ? 'text' : 'password'}
          placeholder="Min. 8 characters"
          autoFocus
          startIcon={<Lock />}
          error={!!errors.password}
          endIcon={
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowNew((v) => !v)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={showNew ? 'Hide password' : 'Show password'}
            >
              {showNew ? <EyeOff /> : <Eye />}
            </button>
          }
          {...register('password')}
        />
        {/* Strength bars */}
        {passwordVal && (
          <div className="space-y-1 pt-0.5">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-all',
                    n <= strength.score ? strength.barCls : 'bg-muted'
                  )}
                />
              ))}
            </div>
            {strength.label && (
              <p className="text-xs text-muted-foreground">
                Password strength:{' '}
                <span className="font-medium text-foreground">{strength.label}</span>
              </p>
            )}
          </div>
        )}
        {errors.password && (
          <p role="alert" className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      {/* Confirm password */}
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password" required>Confirm Password</Label>
        <Input
          id="confirm-password"
          type={showConfirm ? 'text' : 'password'}
          placeholder="Re-enter your new password"
          startIcon={<Lock />}
          error={!!errors.confirmPassword}
          endIcon={
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConfirm((v) => !v)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
            >
              {showConfirm ? <EyeOff /> : <Eye />}
            </button>
          }
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p role="alert" className="text-xs text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
        {isSubmitting ? 'Resetting password…' : 'Reset Password'}
      </Button>
    </form>
  );
}

/* ══════════════════════════════════════════════
   Step 4 – Success
══════════════════════════════════════════════ */
function SuccessStep() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
      </div>
      <div>
        <h2 className="text-xl font-bold tracking-tight">Password Reset!</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Your password has been reset successfully.
          <br />
          You can now sign in with your new password.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2 pt-2">
        <Button className="w-full" size="lg" onClick={() => router.push('/login')}>
          Sign in to PharmaOS
        </Button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Page
══════════════════════════════════════════════ */
export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('request');
  const [identifier, setIdentifier] = useState('');
  const [resetToken, setResetToken] = useState('');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">

      {/* Back link — rendered on dark background */}
      <div className="mb-4 w-full max-w-md">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>

      {/* Card */}
      <div className="w-full max-w-md rounded-3xl bg-background p-8 shadow-2xl">

        {/* PharmaOS logo row */}
        <div className="mb-6 flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              background:
                'linear-gradient(135deg, hsl(162 65% 42%) 0%, hsl(175 77% 26%) 100%)',
              boxShadow: '0 4px 16px hsl(162 65% 42% / 0.4)',
            }}
          >
            <PharmaLogoIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold">PharmaOS</p>
            <p className="text-[10px] text-muted-foreground">Account Recovery</p>
          </div>
          <div className="ml-auto">
            <ShieldCheck className="h-5 w-5 text-primary/50" />
          </div>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Step content */}
        {step === 'request' && (
          <RequestOTPStep
            onSuccess={(id) => { setIdentifier(id); setStep('verify'); }}
          />
        )}
        {step === 'verify' && (
          <VerifyOTPStep
            identifier={identifier}
            onSuccess={(token) => { setResetToken(token); setStep('reset'); }}
            onBack={() => setStep('request')}
          />
        )}
        {step === 'reset' && (
          <NewPasswordStep
            resetToken={resetToken}
            onSuccess={() => setStep('success')}
          />
        )}
        {step === 'success' && <SuccessStep />}
      </div>
    </div>
  );
}

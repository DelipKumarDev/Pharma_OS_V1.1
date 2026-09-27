'use client';

import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Phone, Mail, QrCode, Plug, Settings2, CheckCircle2, Circle } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

async function fetchSettings() {
  const r = await apiFetch('/api/settings');
  const j = await r.json() as { data: { notifications?: Record<string, boolean | string>; billing?: Record<string, unknown> } };
  return j.data;
}

export default function IntegrationsPage() {
  const { data } = useQuery({ queryKey: ['integrations-settings'], queryFn: fetchSettings });
  const n = data?.notifications ?? {};
  const b = data?.billing ?? {};

  const integrations = [
    { key: 'whatsapp', name: 'WhatsApp Business', desc: 'Send bills, refill reminders and alerts over WhatsApp', icon: MessageCircle, tone: 'text-green-600 bg-green-50 dark:bg-green-950', on: Boolean(n.whatsappAlerts), tab: 'notifications' },
    { key: 'sms', name: 'SMS Gateway', desc: 'OTP and transactional SMS (MSG91 / Twilio-ready)', icon: Phone, tone: 'text-blue-600 bg-blue-50 dark:bg-blue-950', on: Boolean(n.smsAlerts), tab: 'notifications' },
    { key: 'email', name: 'Email (SMTP)', desc: 'OTP, reports and low-stock alert emails via Nodemailer', icon: Mail, tone: 'text-purple-600 bg-purple-50 dark:bg-purple-950', on: Boolean(n.emailAlerts), tab: 'notifications' },
    { key: 'upi', name: 'UPI Payments', desc: 'Accept UPI at billing with a dynamic QR code', icon: QrCode, tone: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950', on: Boolean(b.upiId), tab: 'tax' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><Plug className="h-4 w-4 text-primary" /></div>
        <div><h1 className="text-2xl font-bold tracking-tight">Integrations</h1><p className="text-sm text-muted-foreground">Connect messaging, email and payment channels to Pharma Ist</p></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {integrations.map((it) => {
          const Icon = it.icon;
          return (
            <div key={it.key} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', it.tone)}><Icon className="h-5 w-5" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{it.name}</p>
                  <Badge variant={it.on ? 'success' : 'muted'} className="text-[10px] gap-0.5">
                    {it.on ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Circle className="h-2.5 w-2.5" />}{it.on ? 'Connected' : 'Not set up'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{it.desc}</p>
                <Button variant="outline" size="sm" className="mt-2.5 h-7 text-xs" asChild>
                  <Link href={`/settings?tab=${it.tab}`}><Settings2 className="h-3 w-3" /> Configure</Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

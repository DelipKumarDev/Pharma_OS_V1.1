import type { Metadata } from 'next';
import { BillingView } from '@/modules/billing/views/billing-view';

export const metadata: Metadata = { title: 'Billing' };

export default function BillingPage() {
  return <BillingView />;
}

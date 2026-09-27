import type { Metadata } from 'next';
import { ExpiryView } from '@/modules/expiry/views/expiry-view';

export const metadata: Metadata = { title: 'Expiry Monitor' };

export default function ExpiryPage() {
  return <ExpiryView />;
}

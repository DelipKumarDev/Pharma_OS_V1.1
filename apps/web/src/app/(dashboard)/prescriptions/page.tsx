import type { Metadata } from 'next';
import { PrescriptionsView } from '@/modules/prescriptions/views/prescriptions-view';

export const metadata: Metadata = { title: 'Prescriptions' };

export default function PrescriptionsPage() {
  return <PrescriptionsView />;
}

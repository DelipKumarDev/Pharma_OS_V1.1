import type { Metadata } from 'next';
import { VendorsView } from '@/modules/vendors/views/vendors-view';

export const metadata: Metadata = { title: 'Vendors & Procurement' };

export default function VendorsPage() {
  return <VendorsView />;
}

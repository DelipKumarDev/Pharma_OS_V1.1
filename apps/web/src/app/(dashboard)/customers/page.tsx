import type { Metadata } from 'next';
import { CustomersView } from '@/modules/customers/views/customers-view';

export const metadata: Metadata = { title: 'Customers' };

export default function CustomersPage() {
  return <CustomersView />;
}

import type { Metadata } from 'next';
import { PurchaseOrdersView } from '@/modules/purchase-orders/views/purchase-orders-view';

export const metadata: Metadata = { title: 'Purchase Orders' };

export default function PurchaseOrdersPage() {
  return <PurchaseOrdersView />;
}

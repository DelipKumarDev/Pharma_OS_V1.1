import type { Metadata } from 'next';
import { InventoryView } from '@/modules/inventory/views/inventory-view';

export const metadata: Metadata = { title: 'Inventory' };

export default function InventoryPage() {
  return <InventoryView />;
}

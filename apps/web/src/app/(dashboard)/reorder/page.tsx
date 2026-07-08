import type { Metadata } from 'next';
import { ReorderView } from '@/modules/reorder/views/reorder-view';

export const metadata: Metadata = { title: 'Reorder Intelligence' };

export default function ReorderPage() {
  return <ReorderView />;
}

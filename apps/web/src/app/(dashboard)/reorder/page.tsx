import type { Metadata } from 'next';
import { ReorderView } from '@/modules/reorder/views/reorder-view';

export const metadata: Metadata = { title: 'Reorder Queue' };

export default function ReorderPage() {
  return <ReorderView />;
}

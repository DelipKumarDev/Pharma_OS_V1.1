import type { Metadata } from 'next';
import { ReturnsView } from '@/modules/returns/views/returns-view';

export const metadata: Metadata = { title: 'Returns' };

export default function ReturnsPage() {
  return <ReturnsView />;
}

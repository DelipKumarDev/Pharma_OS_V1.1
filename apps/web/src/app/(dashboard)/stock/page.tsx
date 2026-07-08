import type { Metadata } from 'next';
import { StockView } from '@/modules/stock/views/stock-view';

export const metadata: Metadata = { title: 'Stock Management' };

export default function StockPage() {
  return <StockView />;
}

import type { Metadata } from 'next';
import { OfflineView } from '@/modules/offline/views/offline-view';

export const metadata: Metadata = { title: 'Offline Mode' };

export default function OfflinePage() {
  return <OfflineView />;
}

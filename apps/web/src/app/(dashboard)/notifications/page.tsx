import type { Metadata } from 'next';
import { NotificationsView } from '@/modules/notifications/views/notifications-view';

export const metadata: Metadata = { title: 'Notifications' };

export default function NotificationsPage() {
  return <NotificationsView />;
}

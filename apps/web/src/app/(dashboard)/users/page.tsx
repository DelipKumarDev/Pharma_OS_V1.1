import type { Metadata } from 'next';
import { UsersView } from '@/modules/users/views/users-view';

export const metadata: Metadata = { title: 'Users' };

export default function UsersPage() {
  return <UsersView />;
}

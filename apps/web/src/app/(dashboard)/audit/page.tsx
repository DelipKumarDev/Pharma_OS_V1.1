import type { Metadata } from 'next';
import { AuditView } from '@/modules/audit/views/audit-view';

export const metadata: Metadata = { title: 'Audit & Security' };

export default function AuditPage() {
  return <AuditView />;
}

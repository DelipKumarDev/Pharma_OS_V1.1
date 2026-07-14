import type { Metadata } from 'next';
import { ScheduleRegisterView } from '@/modules/schedule-register/views/schedule-register-view';

export const metadata: Metadata = { title: 'Schedule Drug Register' };

export default function ScheduleRegisterPage() {
  return <ScheduleRegisterView />;
}

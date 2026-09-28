import { Shell } from '@/components/layout/shell';
import { HelpChatbot } from '@/components/help/help-chatbot';
import { StartupGuards } from '@/components/startup-guards';
import { ServiceWorkerRegister } from '@/components/sw-register';
import { RouteGuard } from '@/components/layout/route-guard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell>
      <RouteGuard>{children}</RouteGuard>
      <HelpChatbot />
      <StartupGuards />
      <ServiceWorkerRegister />
    </Shell>
  );
}

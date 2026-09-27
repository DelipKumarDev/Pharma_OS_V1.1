import { Shell } from '@/components/layout/shell';
import { HelpChatbot } from '@/components/help/help-chatbot';
import { StartupGuards } from '@/components/startup-guards';
import { ServiceWorkerRegister } from '@/components/sw-register';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell>
      {children}
      <HelpChatbot />
      <StartupGuards />
      <ServiceWorkerRegister />
    </Shell>
  );
}

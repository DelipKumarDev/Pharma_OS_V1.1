import { Shell } from '@/components/layout/shell';
import { HelpChatbot } from '@/components/help/help-chatbot';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell>
      {children}
      <HelpChatbot />
    </Shell>
  );
}

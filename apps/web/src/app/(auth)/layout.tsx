import type { ReactNode } from 'react';

// Pre-auth pages render in a coherent LIGHT theme regardless of the user's
// dark/light preference (market-standard for login/password flows). `theme-light`
// (globals.css) redeclares the light color tokens so design-system components
// inside — Input, Button, Badge, etc. — render light even under the app's .dark.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="theme-light min-h-screen bg-background text-foreground">{children}</div>;
}

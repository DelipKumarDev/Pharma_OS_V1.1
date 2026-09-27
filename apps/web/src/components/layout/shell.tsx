'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { useSidebarStore } from '@/store/sidebar-store';

// Full-screen pages (their own 100vh layout) opt out of the global footer.
const NO_FOOTER_ROUTES = ['/billing'];

interface ShellProps {
  children: React.ReactNode;
  breadcrumb?: React.ReactNode;
}

export function Shell({ children, breadcrumb }: ShellProps) {
  const { collapsed } = useSidebarStore();
  const pathname = usePathname();
  const showFooter = !NO_FOOTER_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <Header breadcrumb={breadcrumb} />
      <main
        className={cn(
          'flex min-h-screen flex-col pt-[var(--header-height)] transition-all duration-300',
          collapsed
            ? 'pl-[var(--sidebar-collapsed-width)]'
            : 'pl-[var(--sidebar-width)]'
        )}
      >
        <div className="content-pad flex-1">{children}</div>
        {/* Global footer — shown on every page except full-screen ones (POS) */}
        {showFooter && (
          <footer className="content-pad border-t border-border/60 py-4 text-center">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              A next-gen pharmacy management system by{' '}
              <span className="font-bold tracking-wide text-[#2563eb]">Z2INFY</span>
              <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">Technologies</span>
            </p>
          </footer>
        )}
      </main>
    </div>
  );
}

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { useSidebarStore } from '@/store/sidebar-store';

interface ShellProps {
  children: React.ReactNode;
  breadcrumb?: React.ReactNode;
}

export function Shell({ children, breadcrumb }: ShellProps) {
  const { collapsed } = useSidebarStore();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <Header breadcrumb={breadcrumb} />
      <main
        className={cn(
          'min-h-screen pt-[var(--header-height)] transition-all duration-300',
          collapsed
            ? 'pl-[var(--sidebar-collapsed-width)]'
            : 'pl-[var(--sidebar-width)]'
        )}
      >
        <div className="content-pad">{children}</div>
      </main>
    </div>
  );
}

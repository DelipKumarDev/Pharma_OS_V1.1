'use client';

import React from 'react';
import { Bell, Search, Moon, Sun, ChevronDown } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { useSidebarStore } from '@/store/sidebar-store';
import { getInitials } from '@/lib/utils';

const MOCK_USER = {
  name: 'Rahul Sharma',
  email: 'rahul@divyapharmacy.com',
  role: 'Pharma Admin',
  tenantName: 'Divya Pharmacy',
  avatar: '',
};

const MOCK_NOTIFICATIONS = [
  { id: '1', title: '12 medicines expiring in 30 days', type: 'warning', time: '2m ago' },
  { id: '2', title: 'Stock low: Paracetamol 500mg', type: 'error', time: '15m ago' },
  { id: '3', title: 'Daily backup completed', type: 'success', time: '1h ago' },
];

interface HeaderProps {
  breadcrumb?: React.ReactNode;
}

export function Header({ breadcrumb }: HeaderProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { collapsed } = useSidebarStore();

  return (
    <header
      className={cn(
        'fixed right-0 top-0 z-[var(--z-header)] flex h-[var(--header-height)] items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300',
        collapsed
          ? 'left-[var(--sidebar-collapsed-width)]'
          : 'left-[var(--sidebar-width)]'
      )}
    >
      <div className="flex flex-1 items-center gap-4 px-4 md:px-6">
        {/* Breadcrumb */}
        {breadcrumb && <div className="hidden md:flex">{breadcrumb}</div>}

        {/* Search */}
        <div className="relative hidden max-w-sm flex-1 md:flex">
          <Input
            placeholder="Search medicines, bills, patients…"
            startIcon={<Search />}
            className="h-8 bg-muted/50 pl-8 text-xs"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 select-none items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium opacity-70 sm:flex">
            ⌘K
          </kbd>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Tenant chip */}
          <div className="hidden items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 md:flex">
            <div className="h-2 w-2 rounded-full bg-success" />
            <span className="text-xs font-medium text-foreground">{MOCK_USER.tenantName}</span>
          </div>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="relative" aria-label="Notifications">
                <Bell className="h-4 w-4" />
                <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 px-1 text-2xs">
                  {MOCK_NOTIFICATIONS.length}
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary">
                  Mark all read
                </Button>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {MOCK_NOTIFICATIONS.map((n) => (
                <DropdownMenuItem key={n.id} className="flex-col items-start gap-0.5 py-3">
                  <div className="flex w-full items-start gap-2">
                    <div
                      className={cn(
                        'mt-1 h-2 w-2 shrink-0 rounded-full',
                        n.type === 'warning' && 'bg-warning',
                        n.type === 'error' && 'bg-destructive',
                        n.type === 'success' && 'bg-success'
                      )}
                    />
                    <p className="flex-1 text-sm leading-snug">{n.title}</p>
                  </div>
                  <span className="pl-4 text-xs text-muted-foreground">{n.time}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="justify-center text-sm text-primary" onClick={() => router.push('/notifications')}>
                View all notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 px-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={MOCK_USER.avatar} alt={MOCK_USER.name} />
                  <AvatarFallback className="text-xs">{getInitials(MOCK_USER.name)}</AvatarFallback>
                </Avatar>
                <div className="hidden text-left md:block">
                  <p className="text-xs font-medium leading-none">{MOCK_USER.name}</p>
                  <p className="text-2xs text-muted-foreground">{MOCK_USER.role}</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="font-medium">{MOCK_USER.name}</p>
                <p className="text-xs font-normal text-muted-foreground">{MOCK_USER.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile settings</DropdownMenuItem>
              <DropdownMenuItem>Change password</DropdownMenuItem>
              <DropdownMenuItem>Preferences</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

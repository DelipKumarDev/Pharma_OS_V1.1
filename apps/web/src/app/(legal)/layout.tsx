import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// Public legal pages (Privacy, Terms). These are linked from the login footer,
// so they must render without authentication. They render in a coherent LIGHT
// theme (`theme-light`, globals.css) to match the pre-auth pages.
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="theme-light min-h-screen bg-background text-foreground flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-5">
          <Link href="/login" className="flex items-center gap-1" aria-label="Pharma Ist home">
            <span className="text-[19px] font-extrabold tracking-tight text-foreground leading-none">Pharma</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-black p-0.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-mark.png" alt="Pharma Ist" className="h-full w-full object-contain" />
            </span>
            <span className="text-[19px] font-extrabold tracking-tight text-foreground leading-none">Ist</span>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to sign in
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:py-14">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-5 py-6 text-[12px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Z2INFY Technologies. All rights reserved.</span>
          <div className="flex items-center gap-3">
            <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy Policy</Link>
            <span className="text-border">·</span>
            <Link href="/terms" className="transition-colors hover:text-foreground">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

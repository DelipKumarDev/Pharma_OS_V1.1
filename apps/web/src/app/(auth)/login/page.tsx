import type { Metadata } from 'next';
import { LoginForm } from '@/modules/auth/components/login-form';
import { ShieldCheck, Package, Receipt, ClipboardList, BarChart2, Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Pharma Ist pharmacy management platform',
};

const FEATURES = [
  { icon: Receipt,       title: 'Fast GST billing',     desc: 'Ring up a sale in seconds with barcode scan and batch picking.' },
  { icon: Package,       title: 'Smart inventory',      desc: 'Live stock, batch and expiry tracking with auto reorder alerts.' },
  { icon: ClipboardList, title: 'Prescriptions',        desc: 'Capture, verify and dispense Rx with a full compliance trail.' },
  { icon: BarChart2,     title: 'Business insights',    desc: 'Sales, purchase, profit and GST reports at a glance.' },
] as const;

/* ── Page ── */
export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex p-3 lg:p-4 gap-3 lg:gap-4"
      style={{
        backgroundColor: 'hsl(210 20% 91%)',
        backgroundImage: 'radial-gradient(circle, hsl(210 14% 78%) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
      }}
    >
      {/* ── Left branding card ── */}
      <div
        className="hidden lg:flex lg:w-[44%] xl:w-[45%] flex-col rounded-3xl overflow-hidden"
        style={{ background: 'linear-gradient(160deg, hsl(174 70% 9%) 0%, hsl(175 62% 13%) 100%)' }}
      >
        {/* Logo — wordmark with the mark (on its own black tile) between "Pharma" and "Ist" */}
        <div className="px-8 pt-8">
          <div className="flex items-center gap-1">
            <span className="text-[26px] font-extrabold tracking-tight text-white leading-none">Pharma</span>
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-black p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-mark.png" alt="Pharma Ist" className="h-full w-full object-contain" />
            </span>
            <span className="text-[26px] font-extrabold tracking-tight text-white leading-none">Ist</span>
          </div>
          <p className="mt-2 text-[9px] font-semibold text-white/40 uppercase tracking-[0.16em]">
            Pharma First
          </p>
        </div>

        {/* Headline + product intro */}
        <div className="px-8 mt-7">
          <h2 className="text-[29px] font-bold text-white leading-[1.18] tracking-tight">
            Smarter pharmacy.<br />
            <span className="text-emerald-400">First</span> with You.
          </h2>
          <p className="mt-3.5 text-[13px] text-white/55 leading-relaxed max-w-[370px]">
            Pharma Ist is the all-in-one platform that runs your pharmacy — billing,
            inventory, prescriptions, GST compliance and analytics, together in one place.
          </p>
        </div>

        {/* Feature list — what Pharma Ist does */}
        <ul className="px-8 mt-6 space-y-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.06]">
                <Icon className="h-[17px] w-[17px] text-emerald-400" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white leading-tight">{title}</p>
                <p className="mt-0.5 text-[11.5px] text-white/45 leading-snug">{desc}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Spacer pushes the company block + footer to the bottom */}
        <div className="flex-1 min-h-[16px]" />

        {/* About Z2INFY — the company behind Pharma Ist */}
        <div className="px-8">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden="true" />
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/75">
                Built by Z2INFY Technologies
              </p>
            </div>
            <p className="mt-2 text-[11.5px] text-white/50 leading-relaxed">
              Z2INFY Technologies builds dependable, India-first business software.
              Pharma Ist is crafted to help independent pharmacies run faster, stay
              compliant and grow with confidence.
            </p>
          </div>
        </div>

        {/* Trust + footer */}
        <div className="px-8 pt-4 pb-5">
          <div className="flex items-center gap-2 text-white/45">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
            <span className="text-[11px]">Trusted by pharmacies to deliver better care</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-3 text-[10.5px] text-white/30">
            <span>© 2026 Z2INFY Technologies</span>
            <div className="flex items-center gap-2">
              <a href="/privacy" className="transition-colors duration-150 hover:text-white/60">Privacy</a>
              <span className="text-white/20">·</span>
              <a href="/terms" className="transition-colors duration-150 hover:text-white/60">Terms</a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right auth area ── */}
      <div className="flex flex-1 items-center justify-center relative overflow-hidden py-6">

        {/* Decorative leaves — bottom right */}
        <div className="absolute bottom-0 right-2 pointer-events-none select-none" aria-hidden="true">
          <svg width="150" height="220" viewBox="0 0 150 220" fill="none">
            <path d="M75 220 C115 180 148 118 130 52 C122 20 98 6 76 30 C54 54 34 116 75 220Z"
                  fill="hsl(157 35% 62%)" fillOpacity="0.38" />
            <line x1="75" y1="220" x2="94" y2="30" stroke="hsl(157 35% 50%)" strokeOpacity="0.22" strokeWidth="1.5" />
            <path d="M108 200 C132 168 150 122 135 70 C129 50 112 44 102 62 C92 80 84 128 108 200Z"
                  fill="hsl(157 35% 62%)" fillOpacity="0.22" />
          </svg>
        </div>

        {/* Mobile-only logo */}
        <div className="absolute top-5 left-5 lg:hidden flex items-center gap-1">
          <span className="text-[18px] font-extrabold tracking-tight text-foreground leading-none">Pharma</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-black p-0.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="Pharma Ist" className="h-full w-full object-contain" />
          </span>
          <span className="text-[18px] font-extrabold tracking-tight text-foreground leading-none">Ist</span>
        </div>

        {/* Auth card */}
        <div className="relative z-10 w-full max-w-[430px] bg-white rounded-3xl shadow-xl px-8 py-10">

          {/* Shield icon */}
          <div className="flex justify-center mb-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(220_13%_94%)]">
              <ShieldCheck className="h-8 w-8 text-emerald-600" />
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-7">
            <h1 className="text-[26px] font-bold text-[hsl(220_20%_15%)] leading-tight tracking-tight">
              Welcome back 👋
            </h1>
            <p className="mt-1.5 text-[13px] text-[hsl(220_9%_50%)]">
              Sign in to your Pharma Ist account
            </p>
          </div>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import { LoginForm } from '@/modules/auth/components/login-form';
import { ShieldCheck, Package, Receipt, ClipboardList, BarChart2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Pharma Ist pharmacy management platform',
};

const FEATURES = [
  { icon: Package,       line1: 'Inventory',   line2: 'Management'  },
  { icon: Receipt,       line1: 'Fast',         line2: 'Billing'     },
  { icon: ClipboardList, line1: 'Prescription', line2: 'Management'  },
  { icon: BarChart2,     line1: 'Business',     line2: 'Insights'    },
] as const;

/* ── Pharmacy scene illustration ── */
function PharmacyScene() {
  return (
    <svg
      viewBox="0 0 300 210"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[310px]"
      aria-hidden="true"
    >
      {/* Base platform */}
      <ellipse cx="150" cy="196" rx="144" ry="14" fill="white" fillOpacity="0.07" />

      {/* Back-left leaf */}
      <path d="M38 178 C6 130 20 68 48 55 C64 48 76 72 70 102 C64 132 52 158 38 178Z"
            fill="#2db891" fillOpacity="0.42" />
      <line x1="48" y1="55" x2="38" y2="178" stroke="#1d9070" strokeOpacity="0.3" strokeWidth="1.5" />

      {/* Back-right leaf */}
      <path d="M263 172 C294 124 280 62 252 49 C236 42 224 66 230 96 C236 126 248 152 263 172Z"
            fill="#2db891" fillOpacity="0.35" />
      <line x1="252" y1="49" x2="263" y2="172" stroke="#1d9070" strokeOpacity="0.25" strokeWidth="1.5" />

      {/* FIRST AID BRIEFCASE */}
      {/* Handle */}
      <path d="M103 117 C103 105 112 100 120 100 L138 100 C146 100 155 106 155 117"
            stroke="#07443a" strokeWidth="6" strokeLinecap="round" fill="none" />
      {/* Body */}
      <rect x="84" y="115" width="88" height="72" rx="12" fill="#0e6b59" />
      {/* Latch center line */}
      <rect x="84" y="148" width="88" height="3" fill="#0a5244" fillOpacity="0.55" />
      {/* Cross vertical */}
      <rect x="120" y="130" width="16" height="44" rx="5" fill="white" fillOpacity="0.92" />
      {/* Cross horizontal */}
      <rect x="104" y="146" width="48" height="16" rx="5" fill="white" fillOpacity="0.92" />

      {/* MEDICINE BOTTLE */}
      {/* Cap */}
      <rect x="208" y="106" width="36" height="18" rx="7" fill="#5c2c10" />
      {/* Body */}
      <rect x="204" y="121" width="44" height="62" rx="10" fill="#7c3a1a" />
      {/* Shade */}
      <rect x="236" y="121" width="12" height="62" rx="10" fill="black" fillOpacity="0.18" />
      {/* Label band */}
      <rect x="204" y="151" width="44" height="18" fill="white" fillOpacity="0.12" />
      {/* Cross vertical */}
      <rect x="222" y="127" width="8" height="28" rx="3" fill="white" fillOpacity="0.72" />
      {/* Cross horizontal */}
      <rect x="215" y="136" width="22" height="8" rx="3" fill="white" fillOpacity="0.72" />

      {/* BLISTER PACK */}
      <rect x="76" y="177" width="126" height="22" rx="6" fill="white" fillOpacity="0.84" />
      <ellipse cx="96"  cy="175" rx="10" ry="11" fill="white" fillOpacity="0.68" />
      <ellipse cx="121" cy="175" rx="10" ry="11" fill="white" fillOpacity="0.68" />
      <ellipse cx="146" cy="175" rx="10" ry="11" fill="white" fillOpacity="0.68" />
      <ellipse cx="171" cy="175" rx="10" ry="11" fill="white" fillOpacity="0.68" />
      <ellipse cx="190" cy="175" rx="9"  ry="10" fill="white" fillOpacity="0.68" />

      {/* LOOSE PILLS */}
      {/* Green capsule left */}
      <g transform="translate(40,188) rotate(-22)">
        <rect width="38" height="16" rx="8" fill="#4ec49a" />
        <rect width="19" height="16" rx="8" fill="#3aab82" />
      </g>
      {/* White capsule right */}
      <g transform="translate(222,185) rotate(20)">
        <rect width="34" height="14" rx="7" fill="white" fillOpacity="0.82" />
        <rect width="17" height="14" rx="7" fill="white" fillOpacity="0.55" />
      </g>
      {/* Small round tablet */}
      <circle cx="255" cy="192" r="10" fill="white" fillOpacity="0.62" />
      <circle cx="255" cy="192" r="5"  fill="white" fillOpacity="0.38" />
    </svg>
  );
}

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

        {/* Headline */}
        <div className="px-8 mt-8">
          <h2 className="text-[31px] font-bold text-white leading-[1.2] tracking-tight">
            Smarter pharmacy.<br />
            <span className="text-emerald-400">First</span> with You.
          </h2>
          <p className="mt-4 text-[13.5px] text-white/50 leading-relaxed">
            A next-gen pharmacy management<br />system by Z2INFY Technologies.
          </p>
        </div>

        {/* Feature grid */}
        <div className="px-8 mt-6 grid grid-cols-4 gap-2">
          {FEATURES.map(({ icon: Icon, line1, line2 }) => (
            <div
              key={line1 + line2}
              className="flex flex-col items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.06] p-3"
            >
              <Icon className="h-5 w-5 text-emerald-400" aria-hidden="true" />
              <p className="text-[9px] font-medium text-white/50 text-center leading-[1.4]">
                {line1}<br />{line2}
              </p>
            </div>
          ))}
        </div>

        {/* Illustration */}
        <div className="flex flex-1 items-end justify-center px-6 pb-1 mt-2">
          <PharmacyScene />
        </div>

        {/* Trust badge */}
        <div className="px-8 pb-3 flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
          <span className="text-[11px] text-white/38">
            Trusted by pharmacies to deliver better care.
          </span>
        </div>

        {/* Footer */}
        <div className="px-8 pb-5 flex items-center justify-between text-[10.5px] text-white/25">
          <span>© 2026 Z2INFY Technologies</span>
          <div className="flex items-center gap-2">
            <a href="/privacy" className="transition-colors duration-150 hover:text-white/50">Privacy</a>
            <span className="text-white/20">|</span>
            <a href="/terms" className="transition-colors duration-150 hover:text-white/50">Terms</a>
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

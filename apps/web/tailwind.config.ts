import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          50: '#f0fdfb',
          100: '#ccfbf4',
          200: '#99f4e9',
          300: '#5de8d8',
          400: '#2dd4c0',
          500: '#14b8a8',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e57',
          900: '#134e49',
          950: '#052d2a',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        success: {
          DEFAULT: '#10b981',
          foreground: '#ffffff',
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        warning: {
          DEFAULT: '#d97706',
          foreground: '#ffffff',
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        error: {
          DEFAULT: '#ef4444',
          foreground: '#ffffff',
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        pharma: {
          emerald: '#0F766E',
          'emerald-dark': '#0a4e48',
          'emerald-light': '#ccfbf4',
          saffron: '#D97706',
          'saffron-light': '#fef3c7',
          indigo: '#4338CA',
          'indigo-light': '#e0e7ff',
          ivory: '#FCFAF7',
          green: '#059669',
          red: '#ef4444',
          surface: '#f9f7f4',
          'surface-2': '#f0ede8',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 3px)',
        sm: 'calc(var(--radius) - 6px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heading)', 'var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-out-right': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(100%)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'float-up': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'slide-out-right': 'slide-out-right 0.3s ease-in',
        'fade-in': 'fade-in 0.15s ease-out',
        'fade-out': 'fade-out 0.15s ease-in',
        shimmer: 'shimmer 2s linear infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'float-up': 'float-up 3s ease-in-out infinite',
      },
      boxShadow: {
        'card-sm': '0 2px 8px 0 rgb(15 118 110 / 0.06), 0 1px 3px 0 rgb(0 0 0 / 0.04)',
        card: '0 4px 16px 0 rgb(15 118 110 / 0.08), 0 1px 4px 0 rgb(0 0 0 / 0.04)',
        'card-md': '0 8px 24px -4px rgb(15 118 110 / 0.12), 0 3px 8px -2px rgb(0 0 0 / 0.06)',
        'card-lg': '0 20px 40px -8px rgb(15 118 110 / 0.15), 0 8px 16px -4px rgb(0 0 0 / 0.08)',
        'float': '0 8px 32px -4px rgb(15 118 110 / 0.18), 0 4px 12px rgb(0 0 0 / 0.08)',
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;

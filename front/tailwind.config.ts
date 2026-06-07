// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // shadcn/ui CSS variable colors
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        // brand colors
        primary: {
          DEFAULT: '#5BBFEA',
          dark: '#2A9FD4',
          light: '#E8F6FD',
        },
        accent: {
          DEFAULT: '#F5A623',
          dark: '#D4891A',
        },
        brand: {
          text: '#1A2E3B',
          muted: '#5A7385',
          surface: '#FFFFFF',
          bg: '#F0F8FD',
        },
      },
      fontFamily: {
        display: ['var(--font-nunito)', 'sans-serif'],
        body: ['var(--font-inter)', 'sans-serif'],
      },
      animation: {
        float: 'float 3s ease-in-out infinite',
        pulse2: 'pulse2 2s infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulse2: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(1.4)' },
        },
      },
      borderRadius: {
        card: '16px',
      },
      boxShadow: {
        card: '0 4px 20px rgba(91,191,234,0.12)',
        'card-hover': '0 12px 32px rgba(91,191,234,0.20)',
      },
    },
  },
  plugins: [],
}

export default config

import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Helios AI brand palette — mirrors original CSS variables
        helios: {
          bg:        '#070707',
          'bg-2':    '#0c0c0e',
          panel:     '#0f1012',
          'panel-2': '#141518',
          orange:    '#ff7a18',
          'orange-2':'#ffae3c',
          amber:     '#ffb547',
          cyan:      '#5be3c5',
          green:     '#22d093',
          red:       '#ff6a5a',
          text:      '#f3f3f3',
          'text-dim':'#9a9a9d',
          'text-mute':'#6a6a6e',
          line:      'rgba(255,255,255,0.06)',
          'line-2':  'rgba(255,255,255,0.10)',
        },
      },
      fontFamily: {
        sans: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        lg: '18px',
        md: '12px',
        sm: '8px',
      },
      boxShadow: {
        'glow-orange': '0 0 40px rgba(255,122,24,0.35), 0 0 120px rgba(255,122,24,0.15)',
        'glow-orange-sm': '0 0 20px rgba(255,122,24,0.35)',
        'glow-green': '0 0 20px rgba(34,208,147,0.4)',
        'soft': '0 0 0 1px rgba(255,255,255,0.04), 0 14px 60px rgba(0,0,0,0.55)',
        'card': '0 30px 80px -30px rgba(0,0,0,0.7)',
      },
      keyframes: {
        'pulse-orange': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,122,24,0.7)' },
          '70%':       { boxShadow: '0 0 0 8px rgba(255,122,24,0)' },
        },
        'pulse-green': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(34,208,147,0.5)' },
          '70%':      { boxShadow: '0 0 0 8px rgba(34,208,147,0)' },
        },
        blink: {
          '0%, 80%, 100%': { opacity: '0.2', transform: 'translateY(0)' },
          '40%':            { opacity: '1',   transform: 'translateY(-2px)' },
        },
        'msg-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'drop-in': {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-orange': 'pulse-orange 2s infinite',
        'pulse-green':  'pulse-green 2s infinite',
        'blink':        'blink 1.2s infinite',
        'msg-in':       'msg-in 0.4s ease',
        'drop-in':      'drop-in 0.15s ease',
        'fade-up':      'fade-up 0.8s cubic-bezier(.2,.7,.2,1) both',
      },
    },
  },
  plugins: [],
}

export default config

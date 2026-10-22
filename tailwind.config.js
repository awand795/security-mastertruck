/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // KIM 3 Workshop Design Tokens (Stage 8)
        ink: {
          DEFAULT: 'var(--color-ink)',
          muted: 'var(--color-ink-muted)',
          subtle: 'var(--color-ink-subtle)',
        },
        surface: {
          DEFAULT: 'var(--color-surface)',
          raised: 'var(--color-surface-raised)',
          dark: 'var(--color-surface-dark)',
        },
        accent: {
          DEFAULT: 'var(--color-accent, #12388F)',
          hover: 'var(--color-accent-hover, #0D2A6B)',
          active: 'var(--color-accent-active, #0A2154)',
          subtle: 'var(--color-accent-subtle, #EEF2F9)',
        },
        brand: {
          navy: '#12388F',
          'navy-dark': '#0B1F4D',
          amber: '#F59E0B',
          'amber-hover': '#D97706',
          'amber-subtle': '#FEF3C7',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          dark: 'var(--color-border-dark)',
        },
        status: {
          amber: 'var(--color-status-amber)',
          'amber-bg': 'var(--color-status-amber-bg)',
          blue: 'var(--color-status-blue)',
          'blue-bg': 'var(--color-status-blue-bg)',
          green: 'var(--color-status-green)',
          'green-bg': 'var(--color-status-green-bg)',
          red: 'var(--color-status-red)',
          'red-bg': 'var(--color-status-red-bg)',
        },
        // Backward-compatible primary colors (KIM3 Navy)
        primary: {
          50: '#EEF2F9',
          100: '#DDE5F5',
          200: '#B9CCEC',
          300: '#8FACDF',
          400: '#5F86CE',
          500: '#2A55B8',
          600: '#12388F',
          700: '#0D2A6B',
          800: '#0A2154',
          900: '#0B1F4D',
          950: '#06132F',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        DEFAULT: '4px',
        sm: '2px',
        md: '6px',
        lg: '8px',
      },
      boxShadow: {
        hairline: '0 0 0 1px var(--color-border)',
        'hairline-dark': '0 0 0 1px var(--color-border-dark)',
      },
    },
  },
  plugins: [],
}

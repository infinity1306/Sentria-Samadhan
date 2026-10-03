/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Serene Seoul – Korean-inspired palette ──────────────
        background: '#F5F0E8',     // Hanji (Korean paper) warm beige
        surface: '#FAF6F0',        // Warm cream cards
        surfaceLight: '#F0EBE3',   // Deeper warm stone beige
        primary: '#5B7B6F',        // Dancheong pine (muted sage-green)
        primaryHover: '#4A6A5E',   // Deeper sage
        accent: '#C4917B',         // Ocher clay / warm terracotta
        accentLight: '#D9B8A9',    // Light celadon sand
        accentHover: '#B07C66',    // Deeper clay
        teal: '#7BA8A0',           // Celadon jade
        textMain: '#2D2D2D',      // Ink black (먹)
        textMuted: '#8C8C8C',     // Stone gray
        danger: '#C75B5B',        // Muted crimson (단청 red)
        warning: '#D4A84B',       // Ginseng gold
      },
      fontFamily: {
        sans: ['Noto Sans KR', 'Inter', 'sans-serif'],
        serif: ['Noto Serif KR', 'Georgia', 'serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'soft': '0 4px 24px rgba(0,0,0,0.04)',
        'card': '0 8px 30px rgba(0,0,0,0.06)',
        'elevated': '0 12px 40px rgba(0,0,0,0.08)',
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        }
      }
    },
  },
  plugins: [],
}

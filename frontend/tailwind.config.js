/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'bg-base': '#0a0a0f',
        'bg-surface': 'rgba(15, 15, 25, 0.8)',
        'bg-card': 'rgba(20, 20, 35, 0.6)',
        'border': 'rgba(255, 255, 255, 0.08)',
        'border-glow': 'rgba(0, 149, 255, 0.3)',
        'accent': '#0095ff',
        'gain': '#00d68f',
        'loss': '#ff3d71',
        'warn': '#ffaa00',
        's-grade': '#ff6b35',
        'a-grade': '#ffaa00',
        'b-grade': '#00d68f',
        'c-grade': '#6b7aff',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-slow': 'pulse 4s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(0, 149, 255, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(0, 149, 255, 0.6)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
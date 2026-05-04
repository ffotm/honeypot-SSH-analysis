/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['DM Sans', 'sans-serif'],
      },
      colors: {
        bg:      '#0a0a0a',
        surface: '#111111',
        border:  '#1e1e1e',
        muted:   '#2a2a2a',
        dim:     '#555555',
        text:    '#e8e8e8',
        sub:     '#888888',
        red:     '#ff4444',
        amber:   '#ffaa00',
        green:   '#22c55e',
        blue:    '#3b82f6',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease forwards',
        'slide-up': 'slideUp 0.4s ease forwards',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseDot: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.2 } },
      }
    },
  },
  plugins: [],
}

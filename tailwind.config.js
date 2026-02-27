/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'slide-up': {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to:   { transform: 'translateY(0)',   opacity: '1' },
        },
      },
      animation: {
        'fade-in':  'fade-in 0.1s ease',
        'slide-up': 'slide-up 0.15s ease',
      },
    },
  },
  plugins: [
    require('tailwindcss/plugin')(function ({ addUtilities }) {
      addUtilities({
        '.app-region-drag':    { '-webkit-app-region': 'drag' },
        '.app-region-no-drag': { '-webkit-app-region': 'no-drag' },
      })
    }),
  ],
}

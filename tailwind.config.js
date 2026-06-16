/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink:  { 900: '#061614', 800: '#0a211e', 700: '#0e2c28' }, // projection bg
        teal: { 900: '#0b3d3a', 800: '#0f4f4a', 700: '#14635c', 600: '#1b7f76', 500: '#2aa198', 400: '#52c3b9' },
        gold: { DEFAULT: '#f4b740', soft: '#ffd47a' },   // live bid accent
        live: '#ff5d5d',                                  // unsold / alert
        victory: {
          bg: '#071210',
          shell: '#0b1312',
          panel: '#102520',
          panelAlt: '#153029',
          border: '#8f6a28',
          muted: '#93ada6',
          text: '#f5f2e8',
          success: '#84d98c'
        }
      },
      fontFamily: {
        score: ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
        sans:  ['"Hanken Grotesk"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(244,183,64,.35), 0 0 40px -8px rgba(244,183,64,.45)',
        card: '0 10px 30px -12px rgba(0,0,0,.45)',
        victory: '0 18px 40px -24px rgba(0,0,0,.7), 0 0 0 1px rgba(244,183,64,.12)'
      },
      keyframes: {
        bidflash: { '0%': { backgroundColor: 'rgba(244,183,64,.35)' }, '100%': { backgroundColor: 'transparent' } },
        rise: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        pulsegold: { '0%,100%': { opacity: 1 }, '50%': { opacity: .55 } }
      },
      animation: {
        bidflash: 'bidflash .9s ease-out',
        rise: 'rise .35s ease-out both',
        pulsegold: 'pulsegold 1.6s ease-in-out infinite'
      }
    }
  },
  plugins: []
}

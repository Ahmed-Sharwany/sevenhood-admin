/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary dark surfaces — obsidian replaces forest green
        forest:  '#0B0C0A', // warm obsidian (primary dark)
        deep:    '#131410', // ink-900
        garden:  '#1C1E19', // ink-800
        // Sage kept for success / green status indicators
        sage:    '#566656',
        leaf:    '#7A9E7A',
        mist:    '#E8EDE0',
        // Maqam Gold — replaces orange gold
        gold:    '#C9A56B',
        amber:   '#A88349',
        // Warm ivory surfaces
        cream:   '#FBF8F2', // bone-50
        sand:    '#F4F0E8', // bone-100
        // Text
        ink:     '#0B0C0A',
        slate:   '#6B6D68',
        fog:     '#9B9D98',
        // Borders
        border:  '#E2DDD4',
        // Extended palette
        bone: {
          50:  '#FBF8F2',
          100: '#F4F0E8',
          200: '#E8E2D4',
        },
        'gold-light': '#E8D5B0',
        'gold-subtle': '#F5ECD9',
      },
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        'xl':  '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        'sh1': '0 1px 0 rgba(11,12,10,.04), 0 2px 6px -2px rgba(11,12,10,.06)',
        'sh2': '0 1px 0 rgba(11,12,10,.04), 0 6px 16px -4px rgba(11,12,10,.08)',
        'sh3': '0 1px 0 rgba(11,12,10,.04), 0 18px 40px -16px rgba(11,12,10,.18)',
      },
    },
  },
  plugins: [],
}

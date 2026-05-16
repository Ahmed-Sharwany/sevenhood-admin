/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest:  '#0D2818',
        deep:    '#163D26',
        garden:  '#1E5435',
        sage:    '#2A7A4C',
        leaf:    '#3DAF6B',
        mist:    '#C8E8D4',
        gold:    '#C87C2A',
        amber:   '#E09040',
        cream:   '#FAF7F2',
        sand:    '#F5EDDF',
        ink:     '#0D1A12',
        slate:   '#4A6355',
        fog:     '#8FAF9A',
        border:  '#D8E8DC',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

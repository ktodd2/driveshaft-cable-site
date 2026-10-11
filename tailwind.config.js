/** @type {import('tailwindcss').Config} */
// Design refresh: dark industrial orange/gold system.
// The `yellow` and `gray` ramps are re-tuned rather than replaced so every
// existing page (storefront, checkout, admin) picks up the new palette
// without touching component logic. `ember` is the orange half of the
// orange→gold brand gradient.
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ktodd-yellow': '#F2A900',
        'ktodd-gold': '#D99400',
        'ktodd-steel': '#4A5568',
        'ktodd-dark': '#0A0A0A',
        'ktodd-charcoal': '#111111',
        ember: {
          400: '#FF9533',
          500: '#FF7A00',
          600: '#E06A00',
        },
        // Brand gold. 500 is the primary accent (≈9.6:1 on #0A0A0A).
        yellow: {
          50: '#FFF8E6',
          100: '#FFEFC2',
          200: '#FFE08A',
          300: '#FFD159',
          400: '#FFBE2E',
          500: '#F2A900',
          600: '#D99400',
          700: '#B37A00',
          800: '#8C5F00',
          900: '#5C3F00',
          950: '#2E1F00',
        },
        // Warm neutral ramp tuned for dark surfaces. Text steps keep AA
        // contrast on #0A0A0A–#171717: 400 ≈ 7.4:1, 500 ≈ 5.3:1.
        gray: {
          50: '#FAFAF8',
          100: '#F5F5F2',
          200: '#E6E5E0',
          300: '#D6D5CF',
          400: '#A3A29C',
          500: '#8A8983',
          600: '#4E4D48',
          700: '#2A2A28',
          800: '#171717',
          900: '#111111',
          950: '#0A0A0A',
        },
      },
      fontFamily: {
        'industrial': ['Oswald', '"Saira Condensed"', '"Avenir Next Condensed"', '"Roboto Condensed"', '"Arial Narrow"', 'Impact', 'sans-serif'],
        'body': ['Roboto', '"Avenir Next"', '"Segoe UI"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.375rem',
      },
    },
  },
  plugins: [],
}

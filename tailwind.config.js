/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ktodd-yellow': '#FFD700',
        'ktodd-gold': '#D4A017',
        'ktodd-steel': '#4A5568',
        'ktodd-dark': '#1A1A1A',
        'ktodd-charcoal': '#2D2D2D',
      },
      fontFamily: {
        'industrial': ['Impact', 'Haettenschweiler', 'Arial Narrow Bold', 'sans-serif'],
        'body': ['Arial', 'Helvetica', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

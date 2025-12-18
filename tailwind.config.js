/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Google Sans', 'sans-serif'],
      },
      colors: {
        'ny-blue': '#0A192F',
        'ny-gold': '#FFD700',
      }
    },
  },
  plugins: [],
}
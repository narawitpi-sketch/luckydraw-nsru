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
        'gemini-green': '#66FF00',
      }
    },
  },
  plugins: [],
}
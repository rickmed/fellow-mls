/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "dark-blue": "#027391",
        "med-blue": "#007e97",
      },
      fontSize: {
        mid: ['0.925rem', '1.325rem'],
      }
    },
  },
  plugins: [],
}

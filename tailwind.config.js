/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        kwred: '#E8192C',
        kwred_light: '#FEE8EA',
        kwred_dark: '#B01020',
      },
    },
  },
  plugins: [],
}
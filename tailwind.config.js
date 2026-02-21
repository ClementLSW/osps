/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // O$P$ brand palette — bold red/black with warm neutrals
        osps: {
          red: '#E63946',
          'red-dark': '#C1121F',
          black: '#1D1D1D',
          cream: '#F8F4F0',
          gray: '#6B7280',
          'gray-light': '#E5E7EB',
          green: '#2D936C',
          yellow: '#F4A261',
        },
      },
      fontFamily: {
        display: ['"Outfit"', 'system-ui', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}

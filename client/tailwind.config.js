/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#004ac6',
          light: '#b4c5ff',
          dark: '#00174b',
        },
        secondary: {
          DEFAULT: '#4b41e1',
          light: '#e2dfff',
          dark: '#0f0069',
        },
        background: '#f8f9ff',
        surface: '#f8f9ff',
        'surface-container': '#e5eeff',
        'surface-container-low': '#eff4ff',
        'surface-container-lowest': '#ffffff',
        outline: '#737686',
        'outline-variant': '#c3c6d7',
      }
    },
  },
  plugins: [],
}

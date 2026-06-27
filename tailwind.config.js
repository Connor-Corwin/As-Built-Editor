/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Subtle "engineering blueprint" accent palette.
        ink: '#0f172a',
        panel: '#111827',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        turmeric: '#FF602F',
        malt: '#001621',
        accent: '#FF6A3D',
        success: '#34D399',
        error: '#FF5470',
        card: '#04212E',
        surface: '#0A2E3C',
        'text-primary': '#FFFFFF',
        'text-secondary': '#9DB8C4',
        'k-border': '#FF602F29',
      },
      fontFamily: {
        heading: ['Poppins', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(255, 96, 47, 0.5)',
        'glow-lg': '0 0 48px rgba(255, 96, 47, 0.35)',
      },
    },
  },
  plugins: [],
};

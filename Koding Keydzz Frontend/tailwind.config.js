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
        game: ['Fredoka', 'sans-serif'],
      },
      boxShadow: {
        'golden-glow': '0 0 24px rgba(255, 96, 47, 0.5)',
        'golden-glow-lg': '0 0 56px rgba(255, 96, 47, 0.5)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 16px rgba(255, 96, 47, 0.35)' },
          '50%': { boxShadow: '0 0 40px rgba(255, 96, 47, 0.7)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float 9s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'spin-slow': 'spin-slow 20s linear infinite',
        wiggle: 'wiggle 2s ease-in-out infinite',
      },
    },
  },
  plugins: [
    // `can-hover:` only applies styles on devices with a real hover-capable,
    // fine pointer — prevents sticky hover states on touch screens (Emil).
    function ({ addVariant }) {
      addVariant('can-hover', '@media (hover: hover) and (pointer: fine)')
    },
  ],
}

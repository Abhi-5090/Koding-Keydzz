/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Resolved from CSS variables so each colour has one definition.
        // `<alpha-value>` is what keeps the 138 `text-secondary/xx` and 70
        // `error/xx` modifiers working — the variables therefore hold RGB
        // CHANNELS, not hex. See src/theme.css.
        turmeric: 'rgb(var(--c-primary) / <alpha-value>)',
        malt: 'rgb(var(--c-bg) / <alpha-value>)',
        'bg-elev': 'rgb(var(--c-bg-elev) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        success: 'rgb(var(--c-success) / <alpha-value>)',
        error: 'rgb(var(--c-error) / <alpha-value>)',
        card: 'rgb(var(--c-card) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        'text-primary': 'rgb(var(--c-text) / <alpha-value>)',
        'text-secondary': 'rgb(var(--c-muted) / <alpha-value>)',
        focus: 'rgb(var(--c-focus) / <alpha-value>)',
        // Carries its own alpha, so it is composed rather than modified.
        'k-border': 'rgb(var(--c-border-rgb) / var(--c-border-a))',
        // The brand hue as a GRAPHIC: glows and decorative marks only, never
        // text.
        ember: 'rgb(var(--c-ember) / <alpha-value>)',
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

/**
 * Colours resolve to CSS VARIABLES, not hex literals.
 *
 * Not for theming — there is one theme. It is so a colour has exactly ONE
 * definition: before this the same brand hexes were hand-written in ~90 places
 * and drifted. See src/theme.css.
 *
 * The `<alpha-value>` placeholder is essential. Tailwind substitutes the
 * modifier from a class like `bg-surface/80` into it, so the variables must
 * hold space-separated RGB CHANNELS ("10 46 60") rather than a hex string.
 * The codebase uses those modifiers 300+ times; a hex variable would break
 * every one of them silently — the colour would just not apply.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ---- Semantic tokens (theme-aware) ----
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
        // The border token carries its own alpha, so it is composed rather
        // than exposed to the `/xx` modifier.
        'k-border': 'rgb(var(--c-border-rgb) / var(--c-border-a))',

        // ---- The brand hue as a GRAPHIC ----
        // Glows, world tints, decorative marks — never text, which is what
        // `turmeric` is for. Same value as `turmeric`; the separate name is
        // what stops the two uses being conflated.
        ember: 'rgb(var(--c-ember) / <alpha-value>)',
      },
      fontFamily: {
        heading: ['Poppins', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        game: ['Fredoka', 'Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // On a dark ground the brand glow IS the elevation.
        card: 'var(--shadow-card)',
        lift: 'var(--shadow-lift)',
        'golden-glow': 'var(--shadow-brand)',
        'golden-glow-lg': 'var(--shadow-brand-lg)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
        drawer: 'var(--ease-drawer)',
        back: 'var(--ease-back)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 16px rgb(var(--c-ember) / 0.35)' },
          '50%': { boxShadow: '0 0 40px rgb(var(--c-ember) / 0.7)' },
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
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float 9s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'spin-slow': 'spin-slow 20s linear infinite',
        wiggle: 'wiggle 2s ease-in-out infinite',
        shimmer: 'shimmer 1.6s var(--ease-out) infinite',
      },
    },
  },
  plugins: [
    // `can-hover:` only applies on devices with a real hover-capable, fine
    // pointer — prevents sticky hover states on touch screens.
    function ({ addVariant }) {
      addVariant('can-hover', '@media (hover: hover) and (pointer: fine)');
      // `motion-ok:` for animation that must not run for a pupil who has asked
      // the operating system to reduce motion.
      addVariant('motion-ok', '@media (prefers-reduced-motion: no-preference)');
    },
  ],
};

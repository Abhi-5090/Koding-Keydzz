// Per-world themed environment config keyed by backend slug. Purely
// presentational — the world list (name, topics, requiredLevel, etc.) still
// comes from GET /worlds; this only supplies the authored "vibe" that turns a
// plain world record into a distinct, kid-friendly themed realm page.
//
// Each entry:
//   tint        primary accent for the realm (on-brand Ember-tinted)
//   gradient    Tailwind classes for the hero/page background gradient
//   panelTint   soft rgba used for cards/panels
//   icons       lucide component set for drifting decorative elements
//   tagline     one-line hook shown under the title
//   intro       authored 2–3 sentence welcome
//   rules       3–4 friendly "rules of the realm"
//   learn       authored kid-friendly one-liners keyed by topic name (lower-case)
//
// `learn` is merged onto world.topics from the API at render time; topics with
// no authored line fall back to a generic friendly description.
import {
  Trees,
  Leaf,
  Sparkles,
  Mountain,
  Snowflake,
  Castle,
  Crown,
  Shield,
  Pyramid,
  Sun,
  Code,
  Star,
} from 'lucide-react'

export const WORLD_THEMES = {
  'coding-forest': {
    tint: '#2DBE8A',
    gradient: 'from-[#052620] via-[#06302A] to-[#001621]',
    panelTint: 'rgba(45,190,138,0.12)',
    icons: [Trees, Leaf, Sparkles, Leaf, Trees],
    tagline: 'Where every great coder learns to remember, ask, and answer.',
    intro:
      'Welcome to the Coding Forest, a lush green world buzzing with curious creatures and glowing fireflies. Here you meet the big ideas every coder starts with: how a computer remembers a value, how we ask the player for information, and how we show results. No syntax yet — just the ideas that make everything else click!',
    rules: [
      'A variable is a labelled box — the name tells you what is inside.',
      'A value is the thing the box remembers: a number, a word, or a yes/no.',
      'Input means asking; output means showing. Get one before you give the other.',
      'Mistakes are just seeds — try again and you will grow.',
    ],
    learn: {
      variables: 'A labelled box that remembers a value so you can use it later.',
      'stored values': 'The actual thing kept inside a variable — a number, a word, or true/false.',
      input: 'How we ask the player for information the program can use.',
      output: 'How we show results back to the player so they can see what happened.',
    },
  },

  'loop-mountain': {
    tint: '#47A6F0',
    gradient: 'from-[#04202E] via-[#062A3C] to-[#001621]',
    panelTint: 'rgba(71,166,240,0.12)',
    icons: [Mountain, Snowflake, Snowflake, Mountain, Snowflake],
    tagline: 'Climb high by repeating your steps.',
    intro:
      'Loop Mountain is a frosty range of snowy peaks where the smartest climbers never do the same work twice. Instead, they teach the computer to repeat steps for them! Here you learn what a loop really is — and how for-loops, while-loops, and loops inside loops each climb a different kind of peak.',
    rules: [
      'A loop is just "do this again" — it saves you from repeating yourself.',
      'Use a for-loop when you know exactly how many times to repeat.',
      'Use a while-loop when you repeat until something becomes true — and always give it a way to stop!',
      'A nested loop is a loop inside a loop — handy for grids and rows.',
    ],
    learn: {
      'for loops': 'Repeat an exact number of times — use it when you know the count, like counting stairs.',
      'while loops': 'Keep repeating while a condition stays true, then stop — use it when you do not know the count yet.',
      'nested loops': 'A loop inside another loop — perfect for working through rows and columns, like a grid.',
    },
  },

  'function-castle': {
    tint: '#9E86F5',
    gradient: 'from-[#160E2E] via-[#1C1440] to-[#001621]',
    panelTint: 'rgba(158,134,245,0.12)',
    icons: [Castle, Crown, Shield, Crown, Shield],
    tagline: 'Build mighty machines you can use again and again.',
    intro:
      'Function Castle is a grand fortress of towers and banners, home to the realm’s cleverest engineers. A function is like a magic machine: you build it once, give it a name, and call on it whenever you need its power. Feed it parameters, and it hands you back a result!',
    rules: [
      'Build a function once, then reuse it like a trusty tool.',
      'Parameters are the ingredients you hand your machine.',
      'A return value is the prize your function gives back.',
      'Give every function a name that says what it does.',
    ],
    learn: {
      functions: 'A reusable machine you build once, name, and call whenever you need its work done.',
      parameters: 'The inputs you hand a function so it can do its job on different things each time.',
      'return values': 'The result a function gives back to you after it finishes its work.',
    },
  },

  'algorithm-desert': {
    tint: '#E8A63D',
    gradient: 'from-[#2A200A] via-[#332810] to-[#001621]',
    panelTint: 'rgba(232,166,61,0.12)',
    icons: [Pyramid, Sun, Pyramid, Sun, Pyramid],
    tagline: 'Make decisions and solve ancient puzzles with clever plans.',
    intro:
      'The Algorithm Desert stretches with golden dunes and mysterious pyramids built by master problem-solvers. Here you learn how a program decides — choosing one path or another with if/else — and how true/false logic with AND, OR, and NOT lets you ask exactly the right question before you leap.',
    rules: [
      'A condition asks a yes/no question, then picks a path: if it is true, do this; else, do that.',
      'Boolean logic only knows true and false — combine them with AND, OR, and NOT.',
      'Break a big problem into small, easy steps before you solve it.',
      'Check each step — a good plan has no surprises.',
    ],
    learn: {
      conditions: 'How a program decides — if/else picks one path when something is true and another when it is false.',
      'boolean logic': 'Reasoning with just true and false, combined using AND, OR, and NOT.',
      'problem solving': 'Breaking a big challenge into small, ordered steps you can actually solve.',
    },
  },

  'python-kingdom': {
    tint: '#FF602F',
    gradient: 'from-[#2A0F08] via-[#34160C] to-[#001621]',
    panelTint: 'rgba(255,96,47,0.12)',
    icons: [Crown, Code, Crown, Code, Sparkles],
    tagline: 'Write and run real Python code.',
    intro:
      'Welcome to the Python Kingdom, a royal temple of marble columns where coders speak real Python. Now you turn the ideas you learned into actual code: write print() to show output, use input() to ask questions, store values in variables, and run your program to see it work. This is the real thing — true Python syntax you can run.',
    rules: [
      'Python loves neat spacing — indentation is part of the syntax, so keep it tidy.',
      'Use print() to show output and input() to ask the player a question.',
      'Run your code often and read the error message when something breaks — it tells you where to look.',
      'Clear variable names make your Python readable, like a sentence.',
    ],
    learn: {
      python: 'Writing and running real Python — print(), input(), variables, and proper syntax.',
      'python programming': 'Turning ideas into real, runnable Python code with correct syntax.',
    },
  },
}

const DEFAULT_THEME = {
  tint: '#FF602F',
  gradient: 'from-card via-surface to-malt',
  panelTint: 'rgba(255,96,47,0.12)',
  icons: [Sparkles, Star, Sparkles],
  tagline: 'A brand-new world to explore.',
  intro: 'A mysterious new realm is waiting for you. Step inside and discover what it has to teach!',
  rules: [
    'Stay curious and try new things.',
    'Mistakes help you learn — keep going.',
    'Have fun exploring!',
  ],
  learn: {},
}

export const worldTheme = (slug) => WORLD_THEMES[slug] || DEFAULT_THEME

/**
 * Build the "What you'll master" list from the API topics merged with authored
 * one-liners. Falls back gracefully when a topic has no authored description.
 */
export function buildLearnList(slug, topics = []) {
  const theme = worldTheme(slug)
  return (topics || []).map((topic) => {
    const key = String(topic).trim().toLowerCase()
    const desc =
      theme.learn[key] ||
      DEFAULT_THEME.learn[key] ||
      `Discover and practice ${topic} through fun, hands-on challenges.`
    return { topic, desc }
  })
}

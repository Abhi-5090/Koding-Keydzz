import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { World } from '../models/World.js';
import { Lesson } from '../models/Lesson.js';
import { Challenge } from '../models/Challenge.js';
import { Achievement } from '../models/Achievement.js';
import { AvatarItem } from '../models/AvatarItem.js';
import { Quiz } from '../models/Quiz.js';

// 5 worlds. Worlds 1-4 teach coding *concepts* in a friendly, language-neutral
// way (the ideas — what a variable is, how a loop repeats, what a function gives
// back, how boolean logic works). Only world 5, Python Kingdom, teaches an actual
// programming language. Slugs are kept stable so the frontend keeps matching.
const WORLDS = [
  {
    name: 'Coding Forest',
    slug: 'coding-forest',
    order: 1,
    topics: ['Variables', 'Stored Values', 'Input', 'Output'],
    description:
      'Begin your coding journey among the trees. Discover the big ideas behind variables, the values they store, and how programs take input and show output — no coding language needed yet, just the concepts.',
    requiredLevel: 1,
    icon: 'forest',
  },
  {
    name: 'Loop Mountain',
    slug: 'loop-mountain',
    order: 2,
    topics: ['For Loops', 'While Loops', 'Nested Loops'],
    description:
      'Climb the heights of repetition. Understand the idea of loops — repeating steps a set number of times, repeating while something stays true, and looping inside loops — as concepts before any code.',
    requiredLevel: 3,
    icon: 'mountain',
  },
  {
    name: 'Function Castle',
    slug: 'function-castle',
    order: 3,
    topics: ['Functions', 'Parameters', 'Return Values'],
    description:
      'Enter the castle of reusable ideas. Learn the concept of a function — a named set of steps you can reuse — along with the inputs it takes (parameters) and the value it gives back (return values).',
    requiredLevel: 6,
    icon: 'castle',
  },
  {
    name: 'Algorithm Desert',
    slug: 'algorithm-desert',
    order: 4,
    topics: ['Conditions', 'Boolean Logic', 'Problem Solving'],
    description:
      'Cross the desert of logic. Grasp the ideas of making decisions with conditions, reasoning with boolean (true/false) logic, and breaking big problems into clear steps — all as concepts you can apply anywhere.',
    requiredLevel: 9,
    icon: 'desert',
  },
  {
    name: 'Python Kingdom',
    slug: 'python-kingdom',
    order: 5,
    topics: ['Python Syntax', 'Running Python', 'Putting It Together'],
    description:
      'Rule the kingdom of Python — the one real programming language on your journey. Put every concept you learned into practice: write Python syntax, run real Python programs, and combine variables, loops, functions, and logic into working code.',
    requiredLevel: 12,
    icon: 'python',
  },
];

// Achievements with measurable criteria { type, target } that the achievement
// service evaluates against a user's cumulative counters to compute progress.
const ACHIEVEMENTS = [
  { key: 'first-code', title: 'First Code', description: 'Complete your first game level.', icon: 'sparkles', criteria: { type: 'levelsCompleted', target: 1 }, xpReward: 0, coinReward: 0 },
  { key: 'getting-started', title: 'Getting Started', description: 'Complete 5 game levels.', icon: 'rocket', criteria: { type: 'levelsCompleted', target: 5 }, xpReward: 0, coinReward: 0 },
  { key: 'code-explorer', title: 'Code Explorer', description: 'Complete 20 game levels.', icon: 'compass', criteria: { type: 'levelsCompleted', target: 20 }, xpReward: 0, coinReward: 0 },
  { key: 'maze-runner', title: 'Maze Runner', description: 'Complete 40 game levels.', icon: 'map', criteria: { type: 'levelsCompleted', target: 40 }, xpReward: 0, coinReward: 0 },
  { key: 'perfectionist', title: 'Perfectionist', description: 'Earn 3 stars on 10 levels.', icon: 'star', criteria: { type: 'perfectLevels', target: 10 }, xpReward: 0, coinReward: 0 },
  { key: 'flawless', title: 'Flawless', description: 'Earn 3 stars on 25 levels.', icon: 'award', criteria: { type: 'perfectLevels', target: 25 }, xpReward: 0, coinReward: 0 },
  { key: 'quiz-whiz', title: 'Quiz Whiz', description: 'Pass 5 quizzes.', icon: 'brain', criteria: { type: 'quizzesPassed', target: 5 }, xpReward: 0, coinReward: 0 },
  { key: 'quiz-master', title: 'Quiz Master', description: 'Pass 15 quizzes.', icon: 'graduation-cap', criteria: { type: 'quizzesPassed', target: 15 }, xpReward: 0, coinReward: 0 },
  { key: 'xp-hunter', title: 'XP Hunter', description: 'Earn 1000 total XP.', icon: 'zap', criteria: { type: 'totalXp', target: 1000 }, xpReward: 0, coinReward: 0 },
  { key: 'rising-star', title: 'Rising Star', description: 'Reach level 10.', icon: 'trending-up', criteria: { type: 'reachLevel', target: 10 }, xpReward: 0, coinReward: 0 },
  { key: 'coin-collector', title: 'Coin Collector', description: 'Earn 500 coins in total.', icon: 'coins', criteria: { type: 'coinsEarned', target: 500 }, xpReward: 0, coinReward: 0 },
  { key: 'treasure-hoarder', title: 'Treasure Hoarder', description: 'Earn 2500 coins in total.', icon: 'gem', criteria: { type: 'coinsEarned', target: 2500 }, xpReward: 0, coinReward: 0 },
];

// 48 avatar items: 6 categories x 8 each. Each category has 1-2 free defaults
// and the rest priced. Prices ladder across 50..5000 with legendaries at the
// expensive end and commons cheap. Purchasable (non-default) items: 36.
const AVATAR_ITEMS = [
  // ----- Skins (8): 2 default -----
  { key: 'skin_default', name: 'Classic Fox', type: 'skin', price: 0, requiredLevel: 1, rarity: 'common', asset: '🦊', isDefault: true },
  { key: 'skin_bear', name: 'Buddy Bear', type: 'skin', price: 0, requiredLevel: 1, rarity: 'common', asset: '🐻', isDefault: true },
  { key: 'skin_panda', name: 'Pixel Panda', type: 'skin', price: 75, requiredLevel: 1, rarity: 'common', asset: '🐼', isDefault: false },
  { key: 'skin_robot', name: 'Robo Koder', type: 'skin', price: 200, requiredLevel: 3, rarity: 'rare', asset: '🤖', isDefault: false },
  { key: 'skin_alien', name: 'Astro Alien', type: 'skin', price: 400, requiredLevel: 5, rarity: 'rare', asset: '👽', isDefault: false },
  { key: 'skin_ninja', name: 'Shadow Ninja', type: 'skin', price: 1000, requiredLevel: 8, rarity: 'epic', asset: '🥷', isDefault: false },
  { key: 'skin_dragon', name: 'Dragon Coder', type: 'skin', price: 3000, requiredLevel: 12, rarity: 'legendary', asset: '🐉', isDefault: false },
  { key: 'skin_phoenix', name: 'Phoenix Master', type: 'skin', price: 5000, requiredLevel: 18, rarity: 'legendary', asset: '🔥', isDefault: false },

  // ----- Outfits (8): 1 default -----
  { key: 'outfit_default', name: 'Starter Hoodie', type: 'outfit', price: 0, requiredLevel: 1, rarity: 'common', asset: '👕', isDefault: true },
  { key: 'outfit_tshirt', name: 'Koder Tee', type: 'outfit', price: 50, requiredLevel: 1, rarity: 'common', asset: '👚', isDefault: false },
  { key: 'outfit_labcoat', name: 'Lab Coat', type: 'outfit', price: 150, requiredLevel: 2, rarity: 'common', asset: '🥼', isDefault: false },
  { key: 'outfit_suit', name: 'Sharp Suit', type: 'outfit', price: 300, requiredLevel: 4, rarity: 'rare', asset: '🤵', isDefault: false },
  { key: 'outfit_wizard', name: 'Wizard Robe', type: 'outfit', price: 750, requiredLevel: 6, rarity: 'epic', asset: '🧙', isDefault: false },
  { key: 'outfit_astronaut', name: 'Astronaut Suit', type: 'outfit', price: 1300, requiredLevel: 9, rarity: 'epic', asset: '🧑‍🚀', isDefault: false },
  { key: 'outfit_superhero', name: 'Super Cape', type: 'outfit', price: 2800, requiredLevel: 13, rarity: 'legendary', asset: '🦸', isDefault: false },
  { key: 'outfit_royal', name: 'Royal Regalia', type: 'outfit', price: 4300, requiredLevel: 17, rarity: 'legendary', asset: '🤴', isDefault: false },

  // ----- Accessories (8): 1 default -----
  { key: 'acc_default', name: 'Plain Cap', type: 'accessory', price: 0, requiredLevel: 1, rarity: 'common', asset: '🧢', isDefault: true },
  { key: 'acc_glasses', name: 'Cool Glasses', type: 'accessory', price: 75, requiredLevel: 1, rarity: 'common', asset: '🕶️', isDefault: false },
  { key: 'acc_headphones', name: 'Beat Headphones', type: 'accessory', price: 150, requiredLevel: 2, rarity: 'common', asset: '🎧', isDefault: false },
  { key: 'acc_bowtie', name: 'Snappy Bowtie', type: 'accessory', price: 300, requiredLevel: 4, rarity: 'rare', asset: '🎀', isDefault: false },
  { key: 'acc_medal', name: 'Gold Medal', type: 'accessory', price: 550, requiredLevel: 6, rarity: 'rare', asset: '🏅', isDefault: false },
  { key: 'acc_wizard_hat', name: 'Wizard Hat', type: 'accessory', price: 1000, requiredLevel: 8, rarity: 'epic', asset: '🎩', isDefault: false },
  { key: 'acc_crown', name: 'Golden Crown', type: 'accessory', price: 2200, requiredLevel: 11, rarity: 'legendary', asset: '👑', isDefault: false },
  { key: 'acc_halo', name: 'Glowing Halo', type: 'accessory', price: 3500, requiredLevel: 15, rarity: 'legendary', asset: '😇', isDefault: false },

  // ----- Pets (8): 1 default -----
  { key: 'pet_default', name: 'Pixel Puppy', type: 'pet', price: 0, requiredLevel: 1, rarity: 'common', asset: '🐶', isDefault: true },
  { key: 'pet_cat', name: 'Code Cat', type: 'pet', price: 100, requiredLevel: 2, rarity: 'common', asset: '🐱', isDefault: false },
  { key: 'pet_rabbit', name: 'Loop Bunny', type: 'pet', price: 200, requiredLevel: 3, rarity: 'common', asset: '🐰', isDefault: false },
  { key: 'pet_owl', name: 'Wise Owl', type: 'pet', price: 400, requiredLevel: 5, rarity: 'rare', asset: '🦉', isDefault: false },
  { key: 'pet_fox', name: 'Sly Fox', type: 'pet', price: 750, requiredLevel: 7, rarity: 'rare', asset: '🦊', isDefault: false },
  { key: 'pet_dragon', name: 'Baby Dragon', type: 'pet', price: 1700, requiredLevel: 10, rarity: 'epic', asset: '🐲', isDefault: false },
  { key: 'pet_unicorn', name: 'Magic Unicorn', type: 'pet', price: 3000, requiredLevel: 14, rarity: 'legendary', asset: '🦄', isDefault: false },
  { key: 'pet_phoenix', name: 'Fire Phoenix', type: 'pet', price: 4300, requiredLevel: 18, rarity: 'legendary', asset: '🦅', isDefault: false },

  // ----- Effects (8): 1 default -----
  { key: 'effect_default', name: 'No Effect', type: 'effect', price: 0, requiredLevel: 1, rarity: 'common', asset: '⚪', isDefault: true },
  { key: 'effect_glow', name: 'Soft Glow', type: 'effect', price: 100, requiredLevel: 2, rarity: 'common', asset: '💡', isDefault: false },
  { key: 'effect_sparkle', name: 'Sparkle Aura', type: 'effect', price: 250, requiredLevel: 3, rarity: 'rare', asset: '✨', isDefault: false },
  { key: 'effect_confetti', name: 'Confetti Burst', type: 'effect', price: 500, requiredLevel: 5, rarity: 'rare', asset: '🎉', isDefault: false },
  { key: 'effect_lightning', name: 'Lightning Aura', type: 'effect', price: 1000, requiredLevel: 8, rarity: 'epic', asset: '⚡', isDefault: false },
  { key: 'effect_rainbow', name: 'Rainbow Trail', type: 'effect', price: 1700, requiredLevel: 10, rarity: 'epic', asset: '🌈', isDefault: false },
  { key: 'effect_fire', name: 'Blazing Aura', type: 'effect', price: 3000, requiredLevel: 14, rarity: 'legendary', asset: '🔥', isDefault: false },
  { key: 'effect_galaxy', name: 'Galaxy Aura', type: 'effect', price: 5000, requiredLevel: 18, rarity: 'legendary', asset: '🌌', isDefault: false },

  // ----- Backgrounds (8): 1 default -----
  { key: 'bg_default', name: 'Plain Sky', type: 'background', price: 0, requiredLevel: 1, rarity: 'common', asset: '🟦', isDefault: true },
  { key: 'bg_forest', name: 'Coding Forest', type: 'background', price: 75, requiredLevel: 1, rarity: 'common', asset: '🌳', isDefault: false },
  { key: 'bg_mountain', name: 'Loop Mountain', type: 'background', price: 200, requiredLevel: 3, rarity: 'common', asset: '⛰️', isDefault: false },
  { key: 'bg_castle', name: 'Function Castle', type: 'background', price: 400, requiredLevel: 5, rarity: 'rare', asset: '🏰', isDefault: false },
  { key: 'bg_desert', name: 'Algorithm Desert', type: 'background', price: 750, requiredLevel: 7, rarity: 'rare', asset: '🏜️', isDefault: false },
  { key: 'bg_city', name: 'Python Kingdom', type: 'background', price: 1300, requiredLevel: 9, rarity: 'epic', asset: '🌆', isDefault: false },
  { key: 'bg_space', name: 'Starry Night', type: 'background', price: 2200, requiredLevel: 12, rarity: 'legendary', asset: '🌠', isDefault: false },
  { key: 'bg_aurora', name: 'Aurora Skies', type: 'background', price: 3500, requiredLevel: 16, rarity: 'legendary', asset: '🌌', isDefault: false },
];

// Python Kingdom is the only world that teaches a real programming language; its
// lessons use real Python. Worlds 1-4 teach concepts in a language-neutral way,
// so their lessons describe the *idea* rather than showing code (no starter code).
function lessonsForWorld(world) {
  const isPython = world.slug === 'python-kingdom';
  return world.topics.map((topic, idx) => {
    const base = {
      world: world._id,
      title: `${topic} Basics`,
      order: idx + 1,
      language: 'python',
      xpReward: 100,
    };
    if (isPython) {
      return {
        ...base,
        content: `Learn ${topic} by writing and running real Python in ${world.name}.`,
        starterCode: `# ${topic}\nprint("Hello from ${world.name}")\n`,
      };
    }
    return {
      ...base,
      content: `Understand the concept of ${topic} in ${world.name} — what it means and how it works, before you ever write code.`,
      starterCode: '',
    };
  });
}

/**
 * Quiz blueprints by world slug. Each blueprint has a topic-based title and at
 * least 5 real questions of mixed types with correct answers. Worlds 1-4 are
 * CONCEPT-focused and language-neutral (they teach the ideas, not any specific
 * programming language). Only Python Kingdom uses real Python syntax. We build
 * ~4 per world (20 total) and link each to a lesson in that world (falling back
 * to the world's first lesson if a topic-specific lesson is absent).
 */
const QUIZ_BLUEPRINTS = {
  // ---- Coding Forest: Variables, Stored Values, Input, Output (concepts) ----
  'coding-forest': [
    {
      title: 'Variables 1: What Is a Variable', topicLesson: 'Variables Basics',
      questions: [
        { type: 'mcq', prompt: 'A variable is best described as...', options: ['a labelled box that stores a value', 'a number you cannot change', 'a way to draw pictures', 'the name of the program'], correctAnswer: 'a labelled box that stores a value', explanation: 'A variable is a named place that holds a value.' },
        { type: 'fillblank', prompt: 'A variable is like a ____ that stores a value.', correctAnswer: ['box', 'container'], explanation: 'A variable is a named container/box for a value.' },
        { type: 'mcq', prompt: 'Why do we give a variable a name?', options: ['so we can find and reuse its value later', 'to make the program slower', 'to delete the value', 'names are not needed'], correctAnswer: 'so we can find and reuse its value later', explanation: 'The name lets us refer back to the stored value.' },
        { type: 'match', prompt: 'Match each idea to the right word.', options: ['the name', 'the value'], correctAnswer: { 'the name': 'how we refer to the box', 'the value': 'what is stored inside' }, explanation: 'Name identifies the box; value is its content.' },
        { type: 'fillblank', prompt: 'Putting a value into a variable is called ____ it.', correctAnswer: ['assigning', 'setting', 'storing'], explanation: 'Giving a variable a value is assigning/storing.' },
      ],
    },
    {
      title: 'Stored Values 2: Changing Values', topicLesson: 'Stored Values Basics',
      questions: [
        { type: 'mcq', prompt: 'If a variable holds 5 and you store 8 in it, what does it hold now?', options: ['8', '5', '13', 'both 5 and 8'], correctAnswer: '8', explanation: 'A new value replaces the old one.' },
        { type: 'fillblank', prompt: 'A value like the words "hello" is called a ____.', correctAnswer: ['text', 'string'], explanation: 'Text values are called strings.' },
        { type: 'mcq', prompt: 'Which of these is a number value?', options: ['42', 'cat', 'true', 'red'], correctAnswer: '42', explanation: '42 is a number; the others are not.' },
        { type: 'match', prompt: 'Match each value to the kind of data it is.', options: ['42', 'hello', 'true'], correctAnswer: { '42': 'number', hello: 'text', true: 'true/false' }, explanation: 'Number, text, and true/false are different value types.' },
        { type: 'fillblank', prompt: 'A value that is only ever true or false is a ____ value.', correctAnswer: ['boolean', 'true/false', 'true or false'], explanation: 'True/false values are booleans.' },
      ],
    },
    {
      title: 'Input 3: Getting Information In', topicLesson: 'Input Basics',
      questions: [
        { type: 'mcq', prompt: 'When a program asks you to type your name, that information is the program\'s...', options: ['input', 'output', 'variable name', 'error'], correctAnswer: 'input', explanation: 'Information coming into a program is input.' },
        { type: 'fillblank', prompt: 'Information that goes INTO a program is called ____.', correctAnswer: ['input'], explanation: 'Data entering a program is input.' },
        { type: 'mcq', prompt: 'Which is an example of input?', options: ['a player pressing a key', 'a message shown on screen', 'a printed receipt', 'a sound the program plays'], correctAnswer: 'a player pressing a key', explanation: 'A key press is information coming in.' },
        { type: 'dragdrop', prompt: 'Order the steps: ask the user, receive what they typed, store it.', options: ['ask the user a question', 'receive what they type', 'store it in a variable'], correctAnswer: ['ask the user a question', 'receive what they type', 'store it in a variable'], explanation: 'Ask, receive, then store.' },
        { type: 'fillblank', prompt: 'We often store input in a ____ so we can use it later.', correctAnswer: ['variable'], explanation: 'Input is kept in a variable for later use.' },
      ],
    },
    {
      title: 'Output 4: Showing Results', topicLesson: 'Output Basics',
      questions: [
        { type: 'mcq', prompt: 'A message a program shows on screen is its...', options: ['output', 'input', 'variable', 'loop'], correctAnswer: 'output', explanation: 'Information coming out of a program is output.' },
        { type: 'fillblank', prompt: 'Information a program shows or sends OUT is called ____.', correctAnswer: ['output'], explanation: 'Data leaving a program is output.' },
        { type: 'mcq', prompt: 'Which pairing is correct?', options: ['input goes in, output comes out', 'input comes out, output goes in', 'both go in only', 'both come out only'], correctAnswer: 'input goes in, output comes out', explanation: 'Input is in, output is out.' },
        { type: 'match', prompt: 'Match each example to input or output.', options: ['typing a password', 'a score shown on screen'], correctAnswer: { 'typing a password': 'input', 'a score shown on screen': 'output' }, explanation: 'Typing is input; showing is output.' },
        { type: 'fillblank', prompt: 'Showing the result of a program to the user is producing ____.', correctAnswer: ['output'], explanation: 'Showing a result is output.' },
      ],
    },
  ],
  // ---- Loop Mountain: For, While, Nested loops (concepts) ----
  'loop-mountain': [
    {
      title: 'For Loops 1: Repeating a Set Number of Times', topicLesson: 'For Loops Basics',
      questions: [
        { type: 'mcq', prompt: 'A loop is mainly used to...', options: ['repeat steps without rewriting them', 'store a single value', 'show one message', 'ask one question'], correctAnswer: 'repeat steps without rewriting them', explanation: 'Loops repeat actions.' },
        { type: 'fillblank', prompt: 'A loop that counts from 1 to 5 repeats ____ times.', correctAnswer: ['5', 'five'], explanation: 'Counting 1..5 is five repeats.' },
        { type: 'mcq', prompt: 'A "for" style loop is best when you...', options: ['know how many times to repeat', 'never want to stop', 'only run once', 'do not want to repeat'], correctAnswer: 'know how many times to repeat', explanation: 'For loops suit a known count.' },
        { type: 'dragdrop', prompt: 'Order to repeat an action 3 times.', options: ['start the loop', 'do the action', 'go to the next count', 'stop after the last count'], correctAnswer: ['start the loop', 'do the action', 'go to the next count', 'stop after the last count'], explanation: 'Start, act, advance, stop.' },
        { type: 'fillblank', prompt: 'Each single pass through a loop is called one ____.', correctAnswer: ['repetition', 'iteration', 'pass'], explanation: 'One pass is an iteration/repetition.' },
      ],
    },
    {
      title: 'While Loops 2: Repeating While True', topicLesson: 'While Loops Basics',
      questions: [
        { type: 'fillblank', prompt: 'A loop that keeps going while a condition stays true is a ____ loop.', correctAnswer: ['while'], explanation: 'While loops repeat while a condition holds.' },
        { type: 'mcq', prompt: 'When does a while loop stop?', options: ['when its condition becomes false', 'never', 'after exactly 10 times', 'when the program starts'], correctAnswer: 'when its condition becomes false', explanation: 'It stops once the condition is false.' },
        { type: 'mcq', prompt: 'A loop whose condition never becomes false will...', options: ['run forever (an infinite loop)', 'run once', 'never run', 'count to ten'], correctAnswer: 'run forever (an infinite loop)', explanation: 'A condition that stays true never stops.' },
        { type: 'fillblank', prompt: 'A loop that never stops on its own is called an ____ loop.', correctAnswer: ['infinite'], explanation: 'It never ends — an infinite loop.' },
        { type: 'match', prompt: 'Match the loop to when you would choose it.', options: ['for loop', 'while loop'], correctAnswer: { 'for loop': 'repeat a known number of times', 'while loop': 'repeat until something changes' }, explanation: 'For: known count; while: until a condition flips.' },
      ],
    },
    {
      title: 'Nested Loops 3: Loops Inside Loops', topicLesson: 'Nested Loops Basics',
      questions: [
        { type: 'mcq', prompt: 'A loop placed inside another loop is called a ____ loop.', options: ['nested', 'broken', 'single', 'flat'], correctAnswer: 'nested', explanation: 'Loops inside loops are nested.' },
        { type: 'fillblank', prompt: 'An outer loop of 3 with an inner loop of 3 repeats the inner action ____ times in total.', correctAnswer: ['9', 'nine'], explanation: '3 x 3 = 9.' },
        { type: 'mcq', prompt: 'Nested loops are a natural fit for working with a...', options: ['grid or table of rows and columns', 'single value', 'one short message', 'one yes/no answer'], correctAnswer: 'grid or table of rows and columns', explanation: 'Grids use one loop per dimension.' },
        { type: 'dragdrop', prompt: 'Order to fill a grid row by row.', options: ['start the outer (rows) loop', 'start the inner (columns) loop', 'fill one cell', 'finish both loops'], correctAnswer: ['start the outer (rows) loop', 'start the inner (columns) loop', 'fill one cell', 'finish both loops'], explanation: 'Outer rows, inner columns, fill, finish.' },
        { type: 'fillblank', prompt: 'In nested loops, the loop that runs most often is the ____ loop.', correctAnswer: ['inner'], explanation: 'The inner loop runs every outer pass.' },
      ],
    },
    {
      title: 'Loops Review 4: How Loops Repeat', topicLesson: 'For Loops Basics',
      questions: [
        { type: 'mcq', prompt: 'A loop that counts from 0 up to but not including 3 repeats how many times?', options: ['3', '4', '2', '0'], correctAnswer: '3', explanation: '0, 1, 2 — three repeats.' },
        { type: 'fillblank', prompt: 'The thing a loop checks to decide whether to keep going is its ____.', correctAnswer: ['condition'], explanation: 'A loop repeats based on its condition.' },
        { type: 'mcq', prompt: 'Stopping a loop early, before its normal end, is called...', options: ['breaking out of it', 'storing it', 'printing it', 'nesting it'], correctAnswer: 'breaking out of it', explanation: 'Leaving a loop early is breaking out.' },
        { type: 'match', prompt: 'Match the idea to its meaning.', options: ['iteration', 'infinite loop'], correctAnswer: { iteration: 'one pass through the loop', 'infinite loop': 'a loop that never stops' }, explanation: 'Iteration = one pass; infinite = never ends.' },
        { type: 'fillblank', prompt: 'Repeating the same steps without rewriting them is the whole point of a ____.', correctAnswer: ['loop'], explanation: 'Loops avoid repeating code by hand.' },
      ],
    },
  ],
  // ---- Function Castle: Functions, Parameters, Return Values (concepts) ----
  'function-castle': [
    {
      title: 'Functions 1: Reusable Steps', topicLesson: 'Functions Basics',
      questions: [
        { type: 'mcq', prompt: 'A function is best described as...', options: ['a named set of steps you can reuse', 'a single stored number', 'a way to repeat forever', 'the title of the program'], correctAnswer: 'a named set of steps you can reuse', explanation: 'A function groups reusable steps under a name.' },
        { type: 'fillblank', prompt: 'Grouping steps under a name so you can reuse them creates a ____.', correctAnswer: ['function'], explanation: 'Reusable named steps form a function.' },
        { type: 'mcq', prompt: 'The main benefit of functions is...', options: ['reusing steps without rewriting them', 'making programs slower', 'deleting your code', 'hiding mistakes'], correctAnswer: 'reusing steps without rewriting them', explanation: 'Functions enable reuse.' },
        { type: 'match', prompt: 'Match each function part to its role.', options: ['the name', 'the steps inside'], correctAnswer: { 'the name': 'how you call the function', 'the steps inside': 'the work it does' }, explanation: 'Name calls it; the body does the work.' },
        { type: 'fillblank', prompt: 'Using a function to make it run is called ____ it.', correctAnswer: ['calling', 'running', 'invoking'], explanation: 'You call/run a function to use it.' },
      ],
    },
    {
      title: 'Parameters 2: Giving Functions Input', topicLesson: 'Parameters Basics',
      questions: [
        { type: 'fillblank', prompt: 'A value you pass into a function for it to use is called a ____.', correctAnswer: ['parameter', 'argument', 'parameters', 'arguments'], explanation: 'Inputs to a function are parameters/arguments.' },
        { type: 'mcq', prompt: 'A greeting function that takes the name to greet is using that name as a...', options: ['parameter', 'return value', 'loop', 'output only'], correctAnswer: 'parameter', explanation: 'The name is an input parameter.' },
        { type: 'mcq', prompt: 'The difference between a parameter and an argument is best stated as...', options: ['a parameter is the slot, an argument is the actual value passed in', 'they can never differ', 'a parameter is the output', 'an argument is a loop'], correctAnswer: 'a parameter is the slot, an argument is the actual value passed in', explanation: 'Parameter = the slot; argument = the value given.' },
        { type: 'dragdrop', prompt: 'Order to use a function with input.', options: ['define the function and its parameter', 'call it with an argument', 'use the result'], correctAnswer: ['define the function and its parameter', 'call it with an argument', 'use the result'], explanation: 'Define, call with a value, use.' },
        { type: 'fillblank', prompt: 'Parameters let one function work with ____ values instead of just one.', correctAnswer: ['different', 'many', 'various'], explanation: 'Parameters make a function flexible across values.' },
      ],
    },
    {
      title: 'Return Values 3: Getting Something Back', topicLesson: 'Return Values Basics',
      questions: [
        { type: 'mcq', prompt: 'A return value is...', options: ['the answer a function gives back to whoever called it', 'the name of the function', 'a kind of loop', 'an input to the function'], correctAnswer: 'the answer a function gives back to whoever called it', explanation: 'Return value = the function\'s result handed back.' },
        { type: 'fillblank', prompt: 'When a function hands an answer back, we say it ____ a value.', correctAnswer: ['returns'], explanation: 'A function returns its result.' },
        { type: 'mcq', prompt: 'A function that adds 2 and 3 and gives back the result returns...', options: ['5', '23', 'nothing', 'an error'], correctAnswer: '5', explanation: '2 + 3 returns 5.' },
        { type: 'match', prompt: 'Match each idea to where the value goes.', options: ['a parameter', 'a return value'], correctAnswer: { 'a parameter': 'goes into the function', 'a return value': 'comes back out of the function' }, explanation: 'Parameters go in; return values come out.' },
        { type: 'fillblank', prompt: 'A function that does work but hands nothing back has no ____ value.', correctAnswer: ['return'], explanation: 'Some functions perform an action without returning a value.' },
      ],
    },
    {
      title: 'Functions Review 4: Inputs and Outputs of a Function', topicLesson: 'Functions Basics',
      questions: [
        { type: 'mcq', prompt: 'Which correctly describes a function\'s flow?', options: ['parameters go in, a return value can come out', 'return values go in, parameters come out', 'nothing goes in or out', 'only loops go in'], correctAnswer: 'parameters go in, a return value can come out', explanation: 'Inputs are parameters; output is the return value.' },
        { type: 'fillblank', prompt: 'Reusing the same steps in many places is the main reason we make a ____.', correctAnswer: ['function'], explanation: 'Functions exist for reuse.' },
        { type: 'mcq', prompt: 'Calling the same function with different arguments lets you...', options: ['get different results from the same steps', 'change the program name', 'stop all loops', 'delete variables'], correctAnswer: 'get different results from the same steps', explanation: 'Different inputs give different outputs.' },
        { type: 'dragdrop', prompt: 'Order the life of a function call.', options: ['pass in arguments', 'run the steps inside', 'return a value', 'use the returned value'], correctAnswer: ['pass in arguments', 'run the steps inside', 'return a value', 'use the returned value'], explanation: 'In, run, return, use.' },
        { type: 'fillblank', prompt: 'The value handed back from a function is its ____ value.', correctAnswer: ['return'], explanation: 'The handed-back value is the return value.' },
      ],
    },
  ],
  // ---- Algorithm Desert: Conditions, Boolean Logic, Problem Solving (concepts) ----
  'algorithm-desert': [
    {
      title: 'Conditions 1: Making Decisions', topicLesson: 'Conditions Basics',
      questions: [
        { type: 'mcq', prompt: 'A condition in a program is...', options: ['a question that is either true or false', 'a stored number', 'a kind of loop', 'a program name'], correctAnswer: 'a question that is either true or false', explanation: 'A condition is a true/false test.' },
        { type: 'fillblank', prompt: 'Code that runs only when a condition is true is an ____ decision.', correctAnswer: ['if'], explanation: 'An "if" runs code when the condition is true.' },
        { type: 'mcq', prompt: 'The branch that runs when the condition is NOT true is the...', options: ['else branch', 'loop branch', 'input branch', 'return branch'], correctAnswer: 'else branch', explanation: '"else" handles the false case.' },
        { type: 'match', prompt: 'Match each comparison to its meaning.', options: ['is equal to', 'is greater than'], correctAnswer: { 'is equal to': 'both sides are the same', 'is greater than': 'left side is larger' }, explanation: 'Comparisons test relationships between values.' },
        { type: 'fillblank', prompt: 'The answer to a condition is always either true or ____.', correctAnswer: ['false'], explanation: 'Conditions are true or false.' },
      ],
    },
    {
      title: 'Boolean Logic 2: AND, OR, NOT', topicLesson: 'Boolean Logic Basics',
      questions: [
        { type: 'mcq', prompt: 'For "A AND B" to be true...', options: ['both A and B must be true', 'only one needs to be true', 'neither can be true', 'A must be false'], correctAnswer: 'both A and B must be true', explanation: 'AND needs both true.' },
        { type: 'mcq', prompt: 'For "A OR B" to be true...', options: ['at least one of A or B is true', 'both must be false', 'both must be true', 'neither matters'], correctAnswer: 'at least one of A or B is true', explanation: 'OR needs at least one true.' },
        { type: 'fillblank', prompt: 'The operator that flips true into false (and false into true) is ____.', correctAnswer: ['not'], explanation: 'NOT negates a value.' },
        { type: 'match', prompt: 'Match each operator to its rule.', options: ['AND', 'OR', 'NOT'], correctAnswer: { AND: 'true only if both are true', OR: 'true if at least one is true', NOT: 'flips true and false' }, explanation: 'AND: both; OR: one; NOT: flip.' },
        { type: 'mcq', prompt: '"NOT true" evaluates to...', options: ['false', 'true', 'maybe', 'an error'], correctAnswer: 'false', explanation: 'NOT true is false.' },
      ],
    },
    {
      title: 'Problem Solving 3: Step by Step', topicLesson: 'Problem Solving Basics',
      questions: [
        { type: 'mcq', prompt: 'A clear step-by-step plan to solve a problem is called an...', options: ['algorithm', 'error', 'variable', 'output'], correctAnswer: 'algorithm', explanation: 'An algorithm is an ordered plan of steps.' },
        { type: 'dragdrop', prompt: 'Order a good problem-solving approach.', options: ['understand the problem', 'break it into smaller steps', 'plan the steps in order', 'check the solution works'], correctAnswer: ['understand the problem', 'break it into smaller steps', 'plan the steps in order', 'check the solution works'], explanation: 'Understand, break down, plan, check.' },
        { type: 'fillblank', prompt: 'Breaking a big problem into smaller, easier parts is called ____.', correctAnswer: ['decomposition', 'breaking it down'], explanation: 'Splitting a problem up is decomposition.' },
        { type: 'mcq', prompt: 'Noticing that several problems share the same pattern helps you...', options: ['reuse a solution instead of starting over', 'make the problem harder', 'skip understanding it', 'remove all steps'], correctAnswer: 'reuse a solution instead of starting over', explanation: 'Spotting patterns lets you reuse solutions.' },
        { type: 'fillblank', prompt: 'A repeating idea you can reuse across problems is called a ____.', correctAnswer: ['pattern'], explanation: 'Reusable repeating ideas are patterns.' },
      ],
    },
    {
      title: 'Logic Review 4: Conditions and Truth', topicLesson: 'Conditions Basics',
      questions: [
        { type: 'mcq', prompt: 'A value that can only be true or false is called a...', options: ['boolean', 'number', 'word', 'loop'], correctAnswer: 'boolean', explanation: 'True/false values are booleans.' },
        { type: 'fillblank', prompt: 'Comparing two values (like "is 5 bigger than 3?") gives back a ____ value.', correctAnswer: ['boolean', 'true/false', 'true or false'], explanation: 'Comparisons produce booleans.' },
        { type: 'mcq', prompt: '"Is 7 greater than 10?" gives back...', options: ['false', 'true', '7', '10'], correctAnswer: 'false', explanation: '7 is not greater than 10, so false.' },
        { type: 'match', prompt: 'Match each decision word to its job.', options: ['if', 'else'], correctAnswer: { if: 'run steps when the condition is true', else: 'run other steps when it is false' }, explanation: 'if = true case, else = false case.' },
        { type: 'fillblank', prompt: 'Choosing between two paths based on true or false is called making a ____.', correctAnswer: ['decision', 'choice'], explanation: 'Branching on true/false is a decision.' },
      ],
    },
  ],
  // ---- Python Kingdom: the only real programming language ----
  'python-kingdom': [
    {
      title: 'Python 1: Syntax & Output', topicLesson: 'Python Syntax Basics',
      questions: [
        { type: 'mcq', prompt: 'Which Python function shows text on the screen?', options: ['print', 'input', 'echo', 'show'], correctAnswer: 'print', explanation: 'print() writes output in Python.' },
        { type: 'fillblank', prompt: 'Complete this Python line: ____("Hello") shows Hello.', correctAnswer: ['print'], explanation: 'print("Hello") outputs Hello.' },
        { type: 'mcq', prompt: 'In Python, a line that starts with # is a...', options: ['comment', 'variable', 'loop', 'function'], correctAnswer: 'comment', explanation: '# begins a comment in Python.' },
        { type: 'fillblank', prompt: 'Python uses ____ (spaces at the start of a line) to group code into blocks.', correctAnswer: ['indentation', 'indent', 'whitespace'], explanation: 'Indentation marks code blocks in Python.' },
        { type: 'match', prompt: 'Match each Python piece to its job.', options: ['print()', '#'], correctAnswer: { 'print()': 'shows output', '#': 'starts a comment' }, explanation: 'print shows output; # comments.' },
      ],
    },
    {
      title: 'Python 2: Variables & Input', topicLesson: 'Running Python Basics',
      questions: [
        { type: 'mcq', prompt: 'Which Python symbol assigns a value to a variable?', options: ['=', '==', '=>', ':='], correctAnswer: '=', explanation: 'A single = assigns in Python.' },
        { type: 'fillblank', prompt: 'In Python, the ____() function reads text typed by the user.', correctAnswer: ['input'], explanation: 'input() reads user input.' },
        { type: 'mcq', prompt: 'What type does Python\'s input() return by default?', options: ['a string', 'an int', 'a boolean', 'a list'], correctAnswer: 'a string', explanation: 'input() returns a string.' },
        { type: 'dragdrop', prompt: 'Order this Python flow: ask, store, show.', options: ['name = input("Your name? ")', 'store it in the variable name', 'print("Hi", name)'], correctAnswer: ['name = input("Your name? ")', 'store it in the variable name', 'print("Hi", name)'], explanation: 'Read input, keep it, then print it.' },
        { type: 'fillblank', prompt: 'In Python, wrapping text in quotes makes a ____.', correctAnswer: ['string'], explanation: 'Quoted text is a string.' },
      ],
    },
    {
      title: 'Python 3: Loops & Logic', topicLesson: 'Putting It Together Basics',
      questions: [
        { type: 'mcq', prompt: 'How many times does "for i in range(3)" run in Python?', options: ['3', '2', '4', 'forever'], correctAnswer: '3', explanation: 'range(3) yields 0,1,2 — three runs.' },
        { type: 'fillblank', prompt: 'In Python, range(5) produces the numbers 0 through ____.', correctAnswer: ['4'], explanation: 'range(5) stops before 5.' },
        { type: 'mcq', prompt: 'Which Python keyword starts a condition check?', options: ['if', 'for', 'def', 'print'], correctAnswer: 'if', explanation: 'if begins a condition in Python.' },
        { type: 'mcq', prompt: 'In Python, "True and False" evaluates to...', options: ['False', 'True', 'None', 'an error'], correctAnswer: 'False', explanation: 'and needs both true.' },
        { type: 'fillblank', prompt: 'A Python loop that repeats while a condition is true uses the ____ keyword.', correctAnswer: ['while'], explanation: 'while repeats on a condition.' },
      ],
    },
    {
      title: 'Python 4: Functions in Python', topicLesson: 'Putting It Together Basics',
      questions: [
        { type: 'mcq', prompt: 'Which keyword defines a function in Python?', options: ['def', 'func', 'function', 'lambda'], correctAnswer: 'def', explanation: 'Python uses def.' },
        { type: 'fillblank', prompt: 'A Python function hands a value back using the ____ keyword.', correctAnswer: ['return'], explanation: 'return passes a value out.' },
        { type: 'mcq', prompt: 'In "def greet(name):", what is name?', options: ['a parameter', 'a return value', 'a loop', 'a comment'], correctAnswer: 'a parameter', explanation: 'name is the function parameter.' },
        { type: 'dragdrop', prompt: 'Order to define and use a Python function.', options: ['def add(a, b):', 'return a + b', 'call add(2, 3)', 'use the result 5'], correctAnswer: ['def add(a, b):', 'return a + b', 'call add(2, 3)', 'use the result 5'], explanation: 'Define, return, call, use.' },
        { type: 'fillblank', prompt: 'A Python function with no return statement gives back ____.', correctAnswer: ['none', 'None'], explanation: 'No return yields None.' },
      ],
    },
  ],
};

/**
 * Build all quizzes from the blueprints. Each quiz links to a lesson in its
 * world (the topic lesson, or the world's first lesson). `lessonByTitle` maps a
 * lesson title to its document; `lessonsByWorldId` maps world id -> lesson docs.
 */
function buildQuizzes(worlds, lessonByTitle, lessonsByWorldId) {
  const quizzes = [];
  for (const world of worlds) {
    const blueprints = QUIZ_BLUEPRINTS[world.slug] || [];
    const worldLessons = lessonsByWorldId.get(String(world._id)) || [];
    for (const bp of blueprints) {
      const lesson =
        lessonByTitle.get(bp.topicLesson) || worldLessons[0];
      if (!lesson) continue;
      quizzes.push({
        lesson: lesson._id,
        title: bp.title,
        type: 'mcq',
        xpReward: 50,
        questions: bp.questions.map((q) => ({ points: 10, ...q })),
      });
    }
  }
  return quizzes;
}

async function seed() {
  await connectDB();
  console.log('Seeding database...');

  // Clean slate for seeded content collections (idempotent re-seed).
  await Promise.all([
    World.deleteMany({}),
    Lesson.deleteMany({}),
    Quiz.deleteMany({}),
    Challenge.deleteMany({}),
    Achievement.deleteMany({}),
    AvatarItem.deleteMany({}),
  ]);

  // Remove leftover test data from earlier sample seeds so a fresh seed ends at
  // a clean baseline. We scope deletions to clearly-seeded test sets only:
  //  - the old test org "Sunrise Public School" and all of its users
  //  - any non-real users other than the superadmin + default admin
  const testOrg = await Organization.findOne({ name: 'Sunrise Public School' });
  if (testOrg) {
    const { deletedCount = 0 } = await User.deleteMany({ org: testOrg._id });
    await Organization.deleteOne({ _id: testOrg._id });
    console.log(`Removed test org "Sunrise Public School" and ${deletedCount} of its users.`);
  }

  // Worlds
  const worlds = await World.insertMany(WORLDS);
  console.log(`Inserted ${worlds.length} worlds.`);

  // Lessons (a few per world from its topics)
  const lessonDocs = worlds.flatMap((w) => lessonsForWorld(w));
  const lessons = await Lesson.insertMany(lessonDocs);
  console.log(`Inserted ${lessons.length} lessons.`);

  // Real quizzes across all 5 worlds (~4 per world), with mixed question types.
  const lessonByTitle = new Map(lessons.map((l) => [l.title, l]));
  const lessonsByWorldId = lessons.reduce((map, l) => {
    const key = String(l.world);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(l);
    return map;
  }, new Map());
  const quizDocs = buildQuizzes(worlds, lessonByTitle, lessonsByWorldId);
  const quizzes = await Quiz.insertMany(quizDocs);
  console.log(`Inserted ${quizzes.length} quizzes (across ${worlds.length} worlds).`);

  // Achievements
  const achievements = await Achievement.insertMany(ACHIEVEMENTS);
  console.log(`Inserted ${achievements.length} achievements.`);

  // Avatar shop items
  const avatarItems = await AvatarItem.insertMany(AVATAR_ITEMS);
  const purchasableCount = avatarItems.filter((i) => !i.isDefault).length;
  const byType = avatarItems.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + 1;
    return acc;
  }, {});
  console.log(
    `Inserted ${avatarItems.length} avatar items (${purchasableCount} purchasable in shop). By type: ${JSON.stringify(byType)}`
  );

  // Sample daily challenges
  const codingForest = worlds.find((w) => w.slug === 'coding-forest');
  const loopMountain = worlds.find((w) => w.slug === 'loop-mountain');
  const challenges = await Challenge.insertMany([
    {
      title: 'Say Hello',
      description: 'Print "Hello, Koder!" to the console.',
      difficulty: 'easy',
      language: 'python',
      starterCode: '# Print Hello, Koder!\n',
      xpReward: 150,
      coinReward: 50,
      daily: true,
      world: codingForest?._id,
    },
    {
      title: 'Count to Ten',
      description: 'Use a loop to print numbers 1 through 10.',
      difficulty: 'medium',
      language: 'python',
      starterCode: '# Loop from 1 to 10\n',
      xpReward: 150,
      coinReward: 60,
      daily: true,
      world: loopMountain?._id,
    },
    {
      title: 'FizzBuzz Mini',
      description: 'Print Fizz for multiples of 3 up to 15.',
      difficulty: 'hard',
      language: 'python',
      starterCode: '# Fizz for multiples of 3\n',
      xpReward: 150,
      coinReward: 80,
      daily: true,
    },
  ]);
  console.log(`Inserted ${challenges.length} daily challenges.`);

  // Super admin (tenant-less). Idempotent upsert by email.
  let superadmin = await User.findOne({ email: 'superadmin@kodingkeydzz.com' });
  if (!superadmin) {
    superadmin = new User({
      role: 'superadmin',
      name: 'Koding Keydzz Super Admin',
      email: 'superadmin@kodingkeydzz.com',
      org: null,
    });
  } else {
    superadmin.role = 'superadmin';
    superadmin.org = null;
  }
  await superadmin.setPassword('Super@123');
  await superadmin.save();
  console.log('Created super admin: superadmin@kodingkeydzz.com / Super@123');

  // Default organization (idempotent by name).
  let defaultOrg = await Organization.findOne({ name: 'Koding Keydzz Academy' });
  if (!defaultOrg) {
    defaultOrg = new Organization({
      name: 'Koding Keydzz Academy',
      slug: 'koding-keydzz-academy',
      code: 'KKACAD',
      status: 'active',
      createdBy: superadmin._id,
      studentCount: 0,
    });
    await defaultOrg.save();
  }
  console.log(`Default organization: ${defaultOrg.name} (${defaultOrg.code})`);

  // Org admin (existing credentials), attached to the default org. Idempotent.
  let admin = await User.findOne({ email: 'admin@kodingkeydzz.com' });
  if (!admin) {
    admin = new User({
      role: 'admin',
      name: 'Koding Keydzz Admin',
      email: 'admin@kodingkeydzz.com',
      grade: 'N/A',
      school: 'Koding Keydzz HQ',
      org: defaultOrg._id,
    });
  } else {
    admin.role = 'admin';
    admin.org = defaultOrg._id;
  }
  await admin.setPassword('Admin@123');
  await admin.save();

  // Link the org back to its admin.
  defaultOrg.adminUser = admin._id;
  await defaultOrg.save();
  console.log('Created admin user: admin@kodingkeydzz.com / Admin@123 (Koding Keydzz Academy)');

  // Remove any leftover seeded privileged accounts (clearly test data): admin /
  // superadmin users that are NOT our two canonical accounts. Real students
  // created via the app are never touched.
  const strayAdmins = await User.deleteMany({
    role: { $in: ['admin', 'superadmin'] },
    email: { $nin: ['superadmin@kodingkeydzz.com', 'admin@kodingkeydzz.com'] },
  });
  if (strayAdmins.deletedCount) {
    console.log(`Removed ${strayAdmins.deletedCount} stray seeded admin/superadmin account(s).`);
  }

  // Keep org studentCount accurate after any cleanup above.
  const defaultOrgStudents = await User.countDocuments({
    role: 'student',
    org: defaultOrg._id,
  });
  defaultOrg.studentCount = defaultOrgStudents;
  await defaultOrg.save();

  console.log('--- Seed summary ---');
  console.log(`  Worlds:        ${worlds.length}`);
  console.log(`  Lessons:       ${lessons.length}`);
  console.log(`  Quizzes:       ${quizzes.length}`);
  console.log(`  Achievements:  ${achievements.length}`);
  console.log(`  Avatar items:  ${avatarItems.length} (${purchasableCount} in shop)`);
  console.log(`  Daily challenges: ${challenges.length}`);
  console.log('Seeding complete.');
}

seed()
  .then(async () => {
    await disconnectDB();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Seed failed:', err);
    try {
      await mongoose.disconnect();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });

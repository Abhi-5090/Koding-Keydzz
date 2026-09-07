import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { World } from '../models/World.js';
import { Question } from '../models/Question.js';
import { Course } from '../models/Course.js';
import { COURSES } from '../config/courses.js';
import { C_WORLDS, C_LESSON_CONTENT, C_QUIZ_BLUEPRINTS } from './cCourse.js';
import { ALL_LESSON_CONTENT as LESSON_CATALOG } from './lessonCatalog.js';
import {
  HTML_WORLDS,
  HTML_LESSON_CONTENT,
  HTML_QUIZ_BLUEPRINTS,
} from './htmlCourse.js';
import {
  AI_WORLDS,
  AI_LESSON_CONTENT,
  AI_QUIZ_BLUEPRINTS,
} from './aiCourse.js';
import { QUESTION_BANK } from './questionBank.js';
import { Lesson } from '../models/Lesson.js';
import { Challenge } from '../models/Challenge.js';
import { Achievement } from '../models/Achievement.js';
import { AvatarItem } from '../models/AvatarItem.js';
import { Quiz } from '../models/Quiz.js';
import { Classroom } from '../models/Classroom.js';

// Faithful serialization of all authored lesson content, keyed by world slug.
// Loaded via fs (not a JSON import assertion) so the seed stays portable.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lessonContent = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'lessonContent.json'), 'utf8'),
);

/* ==========================================================================
 * SAFETY
 *
 * This script used to open with deleteMany({}) across every content collection
 * and a deleteMany() that removed any admin whose email wasn't one of two
 * hardcoded values — which, on a live install, erased every teacher's content
 * edits AND every real school's admin account. It also re-set the superadmin
 * password to a value published in the README on every run.
 *
 * It is now IDEMPOTENT: content is upserted on a natural key, so existing
 * documents keep their _id (nothing dangles the ObjectId references held in
 * user.achievements or QuizAttempt.quiz) and nothing belonging to a real
 * organization is touched. Passwords are only ever set when an account is
 * first created.
 *
 * `--reset` restores the old destructive behaviour for local development, and
 * refuses to run against NODE_ENV=production.
 * ========================================================================== */
/** Mirror of utils/xp.computeLevel, inlined so the seed has no import cycle. */
function computeSeedLevel(xp) {
  return Math.max(1, Math.floor(Math.sqrt((Number(xp) || 0) / 100)) + 1);
}

const ARGV = process.argv.slice(2);
const DESTRUCTIVE = ARGV.includes('--reset');
const FORCED = ARGV.includes('--force');
const IS_PROD = process.env.NODE_ENV === 'production';

function assertSafeToRun() {
  if (IS_PROD && DESTRUCTIVE && !FORCED) {
    console.error(
      '\nRefusing to run a DESTRUCTIVE seed against NODE_ENV=production.\n' +
        '  --reset drops all courses, worlds, lessons, quizzes, achievements, challenges\n' +
        '  and shop items, which erases live curriculum edits.\n\n' +
        '  To seed production safely, run without --reset (idempotent upsert).\n' +
        '  If you truly intend to wipe production content, re-run with --force.\n',
    );
    process.exit(1);
  }
  if (IS_PROD) {
    console.warn(
      '[seed] NODE_ENV=production — running in idempotent upsert mode.',
    );
  }
}

/**
 * Upsert documents on a natural key, preserving _id for existing rows.
 *
 * @param {import('mongoose').Model} Model
 * @param {object[]} docs
 * @param {(doc:object)=>object} keyOf  builds the match filter for one doc
 * @returns {Promise<{docs: object[], created: number, updated: number}>}
 */
async function upsertMany(Model, docs, keyOf) {
  const out = [];
  let created = 0;
  let updated = 0;
  for (const doc of docs) {
    const filter = keyOf(doc);
    // eslint-disable-next-line no-await-in-loop
    const existing = await Model.findOne(filter);
    if (existing) {
      existing.set(doc);
      // eslint-disable-next-line no-await-in-loop
      await existing.save();
      out.push(existing);
      updated += 1;
    } else {
      // eslint-disable-next-line no-await-in-loop
      const doc2 = await Model.create(doc);
      out.push(doc2);
      created += 1;
    }
  }
  return { docs: out, created, updated };
}

/** Log a consistent one-liner for an upsert result. */
function report(label, res) {
  console.log(
    `  ${label.padEnd(16)} ${String(res.docs.length).padStart(3)} total  ` +
      `(+${res.created} new, ~${res.updated} updated)`,
  );
}

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
  {
    key: 'first-code',
    title: 'First Code',
    description: 'Complete your first game level.',
    icon: 'sparkles',
    criteria: { type: 'levelsCompleted', target: 1 },
    xpReward: 0,
    coinReward: 0,
  },
  {
    key: 'getting-started',
    title: 'Getting Started',
    description: 'Complete 5 game levels.',
    icon: 'rocket',
    criteria: { type: 'levelsCompleted', target: 5 },
    xpReward: 0,
    coinReward: 0,
  },
  {
    key: 'code-explorer',
    title: 'Code Explorer',
    description: 'Complete 20 game levels.',
    icon: 'compass',
    criteria: { type: 'levelsCompleted', target: 20 },
    xpReward: 0,
    coinReward: 0,
  },
  {
    key: 'maze-runner',
    title: 'Maze Runner',
    description: 'Complete 40 game levels.',
    icon: 'map',
    criteria: { type: 'levelsCompleted', target: 40 },
    xpReward: 0,
    coinReward: 0,
  },
  {
    key: 'perfectionist',
    title: 'Perfectionist',
    description: 'Earn 3 stars on 10 levels.',
    icon: 'star',
    criteria: { type: 'perfectLevels', target: 10 },
    xpReward: 0,
    coinReward: 0,
  },
  {
    key: 'flawless',
    title: 'Flawless',
    description: 'Earn 3 stars on 25 levels.',
    icon: 'award',
    criteria: { type: 'perfectLevels', target: 25 },
    xpReward: 0,
    coinReward: 0,
  },
  {
    key: 'quiz-whiz',
    title: 'Quiz Whiz',
    description: 'Pass 5 quizzes.',
    icon: 'brain',
    criteria: { type: 'quizzesPassed', target: 5 },
    xpReward: 0,
    coinReward: 0,
  },
  {
    key: 'quiz-master',
    title: 'Quiz Master',
    description: 'Pass 15 quizzes.',
    icon: 'graduation-cap',
    criteria: { type: 'quizzesPassed', target: 15 },
    xpReward: 0,
    coinReward: 0,
  },
  {
    key: 'xp-hunter',
    title: 'XP Hunter',
    description: 'Earn 1000 total XP.',
    icon: 'zap',
    criteria: { type: 'totalXp', target: 1000 },
    xpReward: 0,
    coinReward: 0,
  },
  {
    key: 'rising-star',
    title: 'Rising Star',
    description: 'Reach level 10.',
    icon: 'trending-up',
    criteria: { type: 'reachLevel', target: 10 },
    xpReward: 0,
    coinReward: 0,
  },
  {
    key: 'coin-collector',
    title: 'Coin Collector',
    description: 'Earn 500 coins in total.',
    icon: 'coins',
    criteria: { type: 'coinsEarned', target: 500 },
    xpReward: 0,
    coinReward: 0,
  },
  {
    key: 'treasure-hoarder',
    title: 'Treasure Hoarder',
    description: 'Earn 2500 coins in total.',
    icon: 'gem',
    criteria: { type: 'coinsEarned', target: 2500 },
    xpReward: 0,
    coinReward: 0,
  },
];

// 48 avatar items: 6 categories x 8 each. Each category has 1-2 free defaults
// and the rest priced. Prices ladder across 50..5000 with legendaries at the
// expensive end and commons cheap. Purchasable (non-default) items: 36.
const AVATAR_ITEMS = [
  // ----- Skins (8): 2 default -----
  {
    key: 'skin_default',
    name: 'Classic Fox',
    type: 'skin',
    price: 0,
    requiredLevel: 1,
    rarity: 'common',
    asset: '🦊',
    isDefault: true,
  },
  {
    key: 'skin_bear',
    name: 'Buddy Bear',
    type: 'skin',
    price: 0,
    requiredLevel: 1,
    rarity: 'common',
    asset: '🐻',
    isDefault: true,
  },
  {
    key: 'skin_panda',
    name: 'Pixel Panda',
    type: 'skin',
    price: 75,
    requiredLevel: 1,
    rarity: 'common',
    asset: '🐼',
    isDefault: false,
  },
  {
    key: 'skin_robot',
    name: 'Robo Koder',
    type: 'skin',
    price: 200,
    requiredLevel: 3,
    rarity: 'rare',
    asset: '🤖',
    isDefault: false,
  },
  {
    key: 'skin_alien',
    name: 'Astro Alien',
    type: 'skin',
    price: 400,
    requiredLevel: 5,
    rarity: 'rare',
    asset: '👽',
    isDefault: false,
  },
  {
    key: 'skin_ninja',
    name: 'Shadow Ninja',
    type: 'skin',
    price: 1000,
    requiredLevel: 8,
    rarity: 'epic',
    asset: '🥷',
    isDefault: false,
  },
  {
    key: 'skin_dragon',
    name: 'Dragon Coder',
    type: 'skin',
    price: 3000,
    requiredLevel: 12,
    rarity: 'legendary',
    asset: '🐉',
    isDefault: false,
  },
  {
    key: 'skin_phoenix',
    name: 'Phoenix Master',
    type: 'skin',
    price: 5000,
    requiredLevel: 18,
    rarity: 'legendary',
    asset: '🔥',
    isDefault: false,
  },

  // ----- Outfits (8): 1 default -----
  {
    key: 'outfit_default',
    name: 'Starter Hoodie',
    type: 'outfit',
    price: 0,
    requiredLevel: 1,
    rarity: 'common',
    asset: '👕',
    isDefault: true,
  },
  {
    key: 'outfit_tshirt',
    name: 'Koder Tee',
    type: 'outfit',
    price: 50,
    requiredLevel: 1,
    rarity: 'common',
    asset: '👚',
    isDefault: false,
  },
  {
    key: 'outfit_labcoat',
    name: 'Lab Coat',
    type: 'outfit',
    price: 150,
    requiredLevel: 2,
    rarity: 'common',
    asset: '🥼',
    isDefault: false,
  },
  {
    key: 'outfit_suit',
    name: 'Sharp Suit',
    type: 'outfit',
    price: 300,
    requiredLevel: 4,
    rarity: 'rare',
    asset: '🤵',
    isDefault: false,
  },
  {
    key: 'outfit_wizard',
    name: 'Wizard Robe',
    type: 'outfit',
    price: 750,
    requiredLevel: 6,
    rarity: 'epic',
    asset: '🧙',
    isDefault: false,
  },
  {
    key: 'outfit_astronaut',
    name: 'Astronaut Suit',
    type: 'outfit',
    price: 1300,
    requiredLevel: 9,
    rarity: 'epic',
    asset: '🧑‍🚀',
    isDefault: false,
  },
  {
    key: 'outfit_superhero',
    name: 'Super Cape',
    type: 'outfit',
    price: 2800,
    requiredLevel: 13,
    rarity: 'legendary',
    asset: '🦸',
    isDefault: false,
  },
  {
    key: 'outfit_royal',
    name: 'Royal Regalia',
    type: 'outfit',
    price: 4300,
    requiredLevel: 17,
    rarity: 'legendary',
    asset: '🤴',
    isDefault: false,
  },

  // ----- Accessories (8): 1 default -----
  {
    key: 'acc_default',
    name: 'Plain Cap',
    type: 'accessory',
    price: 0,
    requiredLevel: 1,
    rarity: 'common',
    asset: '🧢',
    isDefault: true,
  },
  {
    key: 'acc_glasses',
    name: 'Cool Glasses',
    type: 'accessory',
    price: 75,
    requiredLevel: 1,
    rarity: 'common',
    asset: '🕶️',
    isDefault: false,
  },
  {
    key: 'acc_headphones',
    name: 'Beat Headphones',
    type: 'accessory',
    price: 150,
    requiredLevel: 2,
    rarity: 'common',
    asset: '🎧',
    isDefault: false,
  },
  {
    key: 'acc_bowtie',
    name: 'Snappy Bowtie',
    type: 'accessory',
    price: 300,
    requiredLevel: 4,
    rarity: 'rare',
    asset: '🎀',
    isDefault: false,
  },
  {
    key: 'acc_medal',
    name: 'Gold Medal',
    type: 'accessory',
    price: 550,
    requiredLevel: 6,
    rarity: 'rare',
    asset: '🏅',
    isDefault: false,
  },
  {
    key: 'acc_wizard_hat',
    name: 'Wizard Hat',
    type: 'accessory',
    price: 1000,
    requiredLevel: 8,
    rarity: 'epic',
    asset: '🎩',
    isDefault: false,
  },
  {
    key: 'acc_crown',
    name: 'Golden Crown',
    type: 'accessory',
    price: 2200,
    requiredLevel: 11,
    rarity: 'legendary',
    asset: '👑',
    isDefault: false,
  },
  {
    key: 'acc_halo',
    name: 'Glowing Halo',
    type: 'accessory',
    price: 3500,
    requiredLevel: 15,
    rarity: 'legendary',
    asset: '😇',
    isDefault: false,
  },

  // ----- Pets (8): 1 default -----
  {
    key: 'pet_default',
    name: 'Pixel Puppy',
    type: 'pet',
    price: 0,
    requiredLevel: 1,
    rarity: 'common',
    asset: '🐶',
    isDefault: true,
  },
  {
    key: 'pet_cat',
    name: 'Code Cat',
    type: 'pet',
    price: 100,
    requiredLevel: 2,
    rarity: 'common',
    asset: '🐱',
    isDefault: false,
  },
  {
    key: 'pet_rabbit',
    name: 'Loop Bunny',
    type: 'pet',
    price: 200,
    requiredLevel: 3,
    rarity: 'common',
    asset: '🐰',
    isDefault: false,
  },
  {
    key: 'pet_owl',
    name: 'Wise Owl',
    type: 'pet',
    price: 400,
    requiredLevel: 5,
    rarity: 'rare',
    asset: '🦉',
    isDefault: false,
  },
  {
    key: 'pet_fox',
    name: 'Sly Fox',
    type: 'pet',
    price: 750,
    requiredLevel: 7,
    rarity: 'rare',
    asset: '🦊',
    isDefault: false,
  },
  {
    key: 'pet_dragon',
    name: 'Baby Dragon',
    type: 'pet',
    price: 1700,
    requiredLevel: 10,
    rarity: 'epic',
    asset: '🐲',
    isDefault: false,
  },
  {
    key: 'pet_unicorn',
    name: 'Magic Unicorn',
    type: 'pet',
    price: 3000,
    requiredLevel: 14,
    rarity: 'legendary',
    asset: '🦄',
    isDefault: false,
  },
  {
    key: 'pet_phoenix',
    name: 'Fire Phoenix',
    type: 'pet',
    price: 4300,
    requiredLevel: 18,
    rarity: 'legendary',
    asset: '🦅',
    isDefault: false,
  },

  // ----- Effects (8): 1 default -----
  {
    key: 'effect_default',
    name: 'No Effect',
    type: 'effect',
    price: 0,
    requiredLevel: 1,
    rarity: 'common',
    asset: '⚪',
    isDefault: true,
  },
  {
    key: 'effect_glow',
    name: 'Soft Glow',
    type: 'effect',
    price: 100,
    requiredLevel: 2,
    rarity: 'common',
    asset: '💡',
    isDefault: false,
  },
  {
    key: 'effect_sparkle',
    name: 'Sparkle Aura',
    type: 'effect',
    price: 250,
    requiredLevel: 3,
    rarity: 'rare',
    asset: '✨',
    isDefault: false,
  },
  {
    key: 'effect_confetti',
    name: 'Confetti Burst',
    type: 'effect',
    price: 500,
    requiredLevel: 5,
    rarity: 'rare',
    asset: '🎉',
    isDefault: false,
  },
  {
    key: 'effect_lightning',
    name: 'Lightning Aura',
    type: 'effect',
    price: 1000,
    requiredLevel: 8,
    rarity: 'epic',
    asset: '⚡',
    isDefault: false,
  },
  {
    key: 'effect_rainbow',
    name: 'Rainbow Trail',
    type: 'effect',
    price: 1700,
    requiredLevel: 10,
    rarity: 'epic',
    asset: '🌈',
    isDefault: false,
  },
  {
    key: 'effect_fire',
    name: 'Blazing Aura',
    type: 'effect',
    price: 3000,
    requiredLevel: 14,
    rarity: 'legendary',
    asset: '🔥',
    isDefault: false,
  },
  {
    key: 'effect_galaxy',
    name: 'Galaxy Aura',
    type: 'effect',
    price: 5000,
    requiredLevel: 18,
    rarity: 'legendary',
    asset: '🌌',
    isDefault: false,
  },

  // ----- Backgrounds (8): 1 default -----
  {
    key: 'bg_default',
    name: 'Plain Sky',
    type: 'background',
    price: 0,
    requiredLevel: 1,
    rarity: 'common',
    asset: '🟦',
    isDefault: true,
  },
  {
    key: 'bg_forest',
    name: 'Coding Forest',
    type: 'background',
    price: 75,
    requiredLevel: 1,
    rarity: 'common',
    asset: '🌳',
    isDefault: false,
  },
  {
    key: 'bg_mountain',
    name: 'Loop Mountain',
    type: 'background',
    price: 200,
    requiredLevel: 3,
    rarity: 'common',
    asset: '⛰️',
    isDefault: false,
  },
  {
    key: 'bg_castle',
    name: 'Function Castle',
    type: 'background',
    price: 400,
    requiredLevel: 5,
    rarity: 'rare',
    asset: '🏰',
    isDefault: false,
  },
  {
    key: 'bg_desert',
    name: 'Algorithm Desert',
    type: 'background',
    price: 750,
    requiredLevel: 7,
    rarity: 'rare',
    asset: '🏜️',
    isDefault: false,
  },
  {
    key: 'bg_city',
    name: 'Python Kingdom',
    type: 'background',
    price: 1300,
    requiredLevel: 9,
    rarity: 'epic',
    asset: '🌆',
    isDefault: false,
  },
  {
    key: 'bg_space',
    name: 'Starry Night',
    type: 'background',
    price: 2200,
    requiredLevel: 12,
    rarity: 'legendary',
    asset: '🌠',
    isDefault: false,
  },
  {
    key: 'bg_aurora',
    name: 'Aurora Skies',
    type: 'background',
    price: 3500,
    requiredLevel: 16,
    rarity: 'legendary',
    asset: '🌌',
    isDefault: false,
  },
];

// Build a world's lessons from the authored structured content in
// lessonContent.json (keyed by world slug). Each lesson keeps its rich `body`
// while `content`/`starterCode` mirror the intro and tryIt starter so existing
// consumers keep working. Topic order is preserved. A world slug missing from
// the content file is a fatal seed error (we never silently skip lessons).
/**
 * Content for every course, in one lookup each.
 *
 * The Python worlds come from lessonContent.json; the C course brings its own
 * module. Merging here rather than at each use site means `lessonsForWorld` and
 * `buildQuizzes` need no knowledge of which course a world belongs to — a world
 * slug is all they ever look up.
 */
// Merged in `lessonCatalog.js`, which other scripts can import safely — this
// file calls `seed()` at the bottom, so importing from it would run a seed.
const ALL_LESSON_CONTENT = LESSON_CATALOG;

function lessonsForWorld(world) {
  const items = ALL_LESSON_CONTENT[world.slug];
  if (!items) {
    throw new Error(`No lesson content found for world slug "${world.slug}"`);
  }
  return items.map((item) => ({
    world: world._id,
    title: item.title,
    order: item.order,
    language: item.language || 'python',
    xpReward: 100,
    content: item.body.intro || '',
    starterCode: item.body.tryIt?.starter || '',
    body: item.body,
  }));
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
      title: 'Variables 1: What Is a Variable',
      topicLesson: 'Variables',
      questions: [
        {
          type: 'mcq',
          prompt: 'A variable is best described as...',
          options: [
            'a labelled box that stores a value',
            'a number you cannot change',
            'a way to draw pictures',
            'the name of the program',
          ],
          correctAnswer: 'a labelled box that stores a value',
          explanation: 'A variable is a named place that holds a value.',
        },
        {
          type: 'fillblank',
          prompt: 'A variable is like a ____ that stores a value.',
          correctAnswer: ['box', 'container'],
          explanation: 'A variable is a named container/box for a value.',
        },
        {
          type: 'mcq',
          prompt: 'Why do we give a variable a name?',
          options: [
            'so we can find and reuse its value later',
            'to make the program slower',
            'to delete the value',
            'names are not needed',
          ],
          correctAnswer: 'so we can find and reuse its value later',
          explanation: 'The name lets us refer back to the stored value.',
        },
        {
          type: 'match',
          prompt: 'Match each idea to the right word.',
          options: ['the name', 'the value'],
          correctAnswer: {
            'the name': 'how we refer to the box',
            'the value': 'what is stored inside',
          },
          explanation: 'Name identifies the box; value is its content.',
        },
        {
          type: 'fillblank',
          prompt: 'Putting a value into a variable is called ____ it.',
          correctAnswer: ['assigning', 'setting', 'storing'],
          explanation: 'Giving a variable a value is assigning/storing.',
        },
      ],
    },
    {
      title: 'Stored Values 2: Changing Values',
      topicLesson: 'Stored Values',
      questions: [
        {
          type: 'mcq',
          prompt:
            'If a variable holds 5 and you store 8 in it, what does it hold now?',
          options: ['8', '5', '13', 'both 5 and 8'],
          correctAnswer: '8',
          explanation: 'A new value replaces the old one.',
        },
        {
          type: 'fillblank',
          prompt: 'A value like the words "hello" is called a ____.',
          correctAnswer: ['text', 'string'],
          explanation: 'Text values are called strings.',
        },
        {
          type: 'mcq',
          prompt: 'Which of these is a number value?',
          options: ['42', 'cat', 'true', 'red'],
          correctAnswer: '42',
          explanation: '42 is a number; the others are not.',
        },
        {
          type: 'match',
          prompt: 'Match each value to the kind of data it is.',
          options: ['42', 'hello', 'true'],
          correctAnswer: { 42: 'number', hello: 'text', true: 'true/false' },
          explanation:
            'Number, text, and true/false are different value types.',
        },
        {
          type: 'fillblank',
          prompt: 'A value that is only ever true or false is a ____ value.',
          correctAnswer: ['boolean', 'true/false', 'true or false'],
          explanation: 'True/false values are booleans.',
        },
      ],
    },
    {
      title: 'Input 3: Getting Information In',
      topicLesson: 'Input',
      questions: [
        {
          type: 'mcq',
          prompt:
            "When a program asks you to type your name, that information is the program's...",
          options: ['input', 'output', 'variable name', 'error'],
          correctAnswer: 'input',
          explanation: 'Information coming into a program is input.',
        },
        {
          type: 'fillblank',
          prompt: 'Information that goes INTO a program is called ____.',
          correctAnswer: ['input'],
          explanation: 'Data entering a program is input.',
        },
        {
          type: 'mcq',
          prompt: 'Which is an example of input?',
          options: [
            'a player pressing a key',
            'a message shown on screen',
            'a printed receipt',
            'a sound the program plays',
          ],
          correctAnswer: 'a player pressing a key',
          explanation: 'A key press is information coming in.',
        },
        {
          type: 'dragdrop',
          prompt:
            'Order the steps: ask the user, receive what they typed, store it.',
          options: [
            'ask the user a question',
            'receive what they type',
            'store it in a variable',
          ],
          correctAnswer: [
            'ask the user a question',
            'receive what they type',
            'store it in a variable',
          ],
          explanation: 'Ask, receive, then store.',
        },
        {
          type: 'fillblank',
          prompt: 'We often store input in a ____ so we can use it later.',
          correctAnswer: ['variable'],
          explanation: 'Input is kept in a variable for later use.',
        },
      ],
    },
    {
      title: 'Output 4: Showing Results',
      topicLesson: 'Output',
      questions: [
        {
          type: 'mcq',
          prompt: 'A message a program shows on screen is its...',
          options: ['output', 'input', 'variable', 'loop'],
          correctAnswer: 'output',
          explanation: 'Information coming out of a program is output.',
        },
        {
          type: 'fillblank',
          prompt: 'Information a program shows or sends OUT is called ____.',
          correctAnswer: ['output'],
          explanation: 'Data leaving a program is output.',
        },
        {
          type: 'mcq',
          prompt: 'Which pairing is correct?',
          options: [
            'input goes in, output comes out',
            'input comes out, output goes in',
            'both go in only',
            'both come out only',
          ],
          correctAnswer: 'input goes in, output comes out',
          explanation: 'Input is in, output is out.',
        },
        {
          type: 'match',
          prompt: 'Match each example to input or output.',
          options: ['typing a password', 'a score shown on screen'],
          correctAnswer: {
            'typing a password': 'input',
            'a score shown on screen': 'output',
          },
          explanation: 'Typing is input; showing is output.',
        },
        {
          type: 'fillblank',
          prompt:
            'Showing the result of a program to the user is producing ____.',
          correctAnswer: ['output'],
          explanation: 'Showing a result is output.',
        },
      ],
    },
  ],
  // ---- Loop Mountain: For, While, Nested loops (concepts) ----
  'loop-mountain': [
    {
      title: 'For Loops 1: Repeating a Set Number of Times',
      topicLesson: 'For Loops',
      questions: [
        {
          type: 'mcq',
          prompt: 'A loop is mainly used to...',
          options: [
            'repeat steps without rewriting them',
            'store a single value',
            'show one message',
            'ask one question',
          ],
          correctAnswer: 'repeat steps without rewriting them',
          explanation: 'Loops repeat actions.',
        },
        {
          type: 'fillblank',
          prompt: 'A loop that counts from 1 to 5 repeats ____ times.',
          correctAnswer: ['5', 'five'],
          explanation: 'Counting 1..5 is five repeats.',
        },
        {
          type: 'mcq',
          prompt: 'A "for" style loop is best when you...',
          options: [
            'know how many times to repeat',
            'never want to stop',
            'only run once',
            'do not want to repeat',
          ],
          correctAnswer: 'know how many times to repeat',
          explanation: 'For loops suit a known count.',
        },
        {
          type: 'dragdrop',
          prompt: 'Order to repeat an action 3 times.',
          options: [
            'start the loop',
            'do the action',
            'go to the next count',
            'stop after the last count',
          ],
          correctAnswer: [
            'start the loop',
            'do the action',
            'go to the next count',
            'stop after the last count',
          ],
          explanation: 'Start, act, advance, stop.',
        },
        {
          type: 'fillblank',
          prompt: 'Each single pass through a loop is called one ____.',
          correctAnswer: ['repetition', 'iteration', 'pass'],
          explanation: 'One pass is an iteration/repetition.',
        },
      ],
    },
    {
      title: 'While Loops 2: Repeating While True',
      topicLesson: 'While Loops',
      questions: [
        {
          type: 'fillblank',
          prompt:
            'A loop that keeps going while a condition stays true is a ____ loop.',
          correctAnswer: ['while'],
          explanation: 'While loops repeat while a condition holds.',
        },
        {
          type: 'mcq',
          prompt: 'When does a while loop stop?',
          options: [
            'when its condition becomes false',
            'never',
            'after exactly 10 times',
            'when the program starts',
          ],
          correctAnswer: 'when its condition becomes false',
          explanation: 'It stops once the condition is false.',
        },
        {
          type: 'mcq',
          prompt: 'A loop whose condition never becomes false will...',
          options: [
            'run forever (an infinite loop)',
            'run once',
            'never run',
            'count to ten',
          ],
          correctAnswer: 'run forever (an infinite loop)',
          explanation: 'A condition that stays true never stops.',
        },
        {
          type: 'fillblank',
          prompt: 'A loop that never stops on its own is called an ____ loop.',
          correctAnswer: ['infinite'],
          explanation: 'It never ends — an infinite loop.',
        },
        {
          type: 'match',
          prompt: 'Match the loop to when you would choose it.',
          options: ['for loop', 'while loop'],
          correctAnswer: {
            'for loop': 'repeat a known number of times',
            'while loop': 'repeat until something changes',
          },
          explanation: 'For: known count; while: until a condition flips.',
        },
      ],
    },
    {
      title: 'Nested Loops 3: Loops Inside Loops',
      topicLesson: 'Nested Loops',
      questions: [
        {
          type: 'mcq',
          prompt: 'A loop placed inside another loop is called a ____ loop.',
          options: ['nested', 'broken', 'single', 'flat'],
          correctAnswer: 'nested',
          explanation: 'Loops inside loops are nested.',
        },
        {
          type: 'fillblank',
          prompt:
            'An outer loop of 3 with an inner loop of 3 repeats the inner action ____ times in total.',
          correctAnswer: ['9', 'nine'],
          explanation: '3 x 3 = 9.',
        },
        {
          type: 'mcq',
          prompt: 'Nested loops are a natural fit for working with a...',
          options: [
            'grid or table of rows and columns',
            'single value',
            'one short message',
            'one yes/no answer',
          ],
          correctAnswer: 'grid or table of rows and columns',
          explanation: 'Grids use one loop per dimension.',
        },
        {
          type: 'dragdrop',
          prompt: 'Order to fill a grid row by row.',
          options: [
            'start the outer (rows) loop',
            'start the inner (columns) loop',
            'fill one cell',
            'finish both loops',
          ],
          correctAnswer: [
            'start the outer (rows) loop',
            'start the inner (columns) loop',
            'fill one cell',
            'finish both loops',
          ],
          explanation: 'Outer rows, inner columns, fill, finish.',
        },
        {
          type: 'fillblank',
          prompt:
            'In nested loops, the loop that runs most often is the ____ loop.',
          correctAnswer: ['inner'],
          explanation: 'The inner loop runs every outer pass.',
        },
      ],
    },
    {
      title: 'Loops Review 4: How Loops Repeat',
      topicLesson: 'For Loops',
      questions: [
        {
          type: 'mcq',
          prompt:
            'A loop that counts from 0 up to but not including 3 repeats how many times?',
          options: ['3', '4', '2', '0'],
          correctAnswer: '3',
          explanation: '0, 1, 2 — three repeats.',
        },
        {
          type: 'fillblank',
          prompt:
            'The thing a loop checks to decide whether to keep going is its ____.',
          correctAnswer: ['condition'],
          explanation: 'A loop repeats based on its condition.',
        },
        {
          type: 'mcq',
          prompt: 'Stopping a loop early, before its normal end, is called...',
          options: [
            'breaking out of it',
            'storing it',
            'printing it',
            'nesting it',
          ],
          correctAnswer: 'breaking out of it',
          explanation: 'Leaving a loop early is breaking out.',
        },
        {
          type: 'match',
          prompt: 'Match the idea to its meaning.',
          options: ['iteration', 'infinite loop'],
          correctAnswer: {
            iteration: 'one pass through the loop',
            'infinite loop': 'a loop that never stops',
          },
          explanation: 'Iteration = one pass; infinite = never ends.',
        },
        {
          type: 'fillblank',
          prompt:
            'Repeating the same steps without rewriting them is the whole point of a ____.',
          correctAnswer: ['loop'],
          explanation: 'Loops avoid repeating code by hand.',
        },
      ],
    },
  ],
  // ---- Function Castle: Functions, Parameters, Return Values (concepts) ----
  'function-castle': [
    {
      title: 'Functions 1: Reusable Steps',
      topicLesson: 'Functions',
      questions: [
        {
          type: 'mcq',
          prompt: 'A function is best described as...',
          options: [
            'a named set of steps you can reuse',
            'a single stored number',
            'a way to repeat forever',
            'the title of the program',
          ],
          correctAnswer: 'a named set of steps you can reuse',
          explanation: 'A function groups reusable steps under a name.',
        },
        {
          type: 'fillblank',
          prompt:
            'Grouping steps under a name so you can reuse them creates a ____.',
          correctAnswer: ['function'],
          explanation: 'Reusable named steps form a function.',
        },
        {
          type: 'mcq',
          prompt: 'The main benefit of functions is...',
          options: [
            'reusing steps without rewriting them',
            'making programs slower',
            'deleting your code',
            'hiding mistakes',
          ],
          correctAnswer: 'reusing steps without rewriting them',
          explanation: 'Functions enable reuse.',
        },
        {
          type: 'match',
          prompt: 'Match each function part to its role.',
          options: ['the name', 'the steps inside'],
          correctAnswer: {
            'the name': 'how you call the function',
            'the steps inside': 'the work it does',
          },
          explanation: 'Name calls it; the body does the work.',
        },
        {
          type: 'fillblank',
          prompt: 'Using a function to make it run is called ____ it.',
          correctAnswer: ['calling', 'running', 'invoking'],
          explanation: 'You call/run a function to use it.',
        },
      ],
    },
    {
      title: 'Parameters 2: Giving Functions Input',
      topicLesson: 'Parameters',
      questions: [
        {
          type: 'fillblank',
          prompt:
            'A value you pass into a function for it to use is called a ____.',
          correctAnswer: ['parameter', 'argument', 'parameters', 'arguments'],
          explanation: 'Inputs to a function are parameters/arguments.',
        },
        {
          type: 'mcq',
          prompt:
            'A greeting function that takes the name to greet is using that name as a...',
          options: ['parameter', 'return value', 'loop', 'output only'],
          correctAnswer: 'parameter',
          explanation: 'The name is an input parameter.',
        },
        {
          type: 'mcq',
          prompt:
            'The difference between a parameter and an argument is best stated as...',
          options: [
            'a parameter is the slot, an argument is the actual value passed in',
            'they can never differ',
            'a parameter is the output',
            'an argument is a loop',
          ],
          correctAnswer:
            'a parameter is the slot, an argument is the actual value passed in',
          explanation: 'Parameter = the slot; argument = the value given.',
        },
        {
          type: 'dragdrop',
          prompt: 'Order to use a function with input.',
          options: [
            'define the function and its parameter',
            'call it with an argument',
            'use the result',
          ],
          correctAnswer: [
            'define the function and its parameter',
            'call it with an argument',
            'use the result',
          ],
          explanation: 'Define, call with a value, use.',
        },
        {
          type: 'fillblank',
          prompt:
            'Parameters let one function work with ____ values instead of just one.',
          correctAnswer: ['different', 'many', 'various'],
          explanation: 'Parameters make a function flexible across values.',
        },
      ],
    },
    {
      title: 'Return Values 3: Getting Something Back',
      topicLesson: 'Return Values',
      questions: [
        {
          type: 'mcq',
          prompt: 'A return value is...',
          options: [
            'the answer a function gives back to whoever called it',
            'the name of the function',
            'a kind of loop',
            'an input to the function',
          ],
          correctAnswer:
            'the answer a function gives back to whoever called it',
          explanation: "Return value = the function's result handed back.",
        },
        {
          type: 'fillblank',
          prompt:
            'When a function hands an answer back, we say it ____ a value.',
          correctAnswer: ['returns'],
          explanation: 'A function returns its result.',
        },
        {
          type: 'mcq',
          prompt:
            'A function that adds 2 and 3 and gives back the result returns...',
          options: ['5', '23', 'nothing', 'an error'],
          correctAnswer: '5',
          explanation: '2 + 3 returns 5.',
        },
        {
          type: 'match',
          prompt: 'Match each idea to where the value goes.',
          options: ['a parameter', 'a return value'],
          correctAnswer: {
            'a parameter': 'goes into the function',
            'a return value': 'comes back out of the function',
          },
          explanation: 'Parameters go in; return values come out.',
        },
        {
          type: 'fillblank',
          prompt:
            'A function that does work but hands nothing back has no ____ value.',
          correctAnswer: ['return'],
          explanation:
            'Some functions perform an action without returning a value.',
        },
      ],
    },
    {
      title: 'Functions Review 4: Inputs and Outputs of a Function',
      topicLesson: 'Functions',
      questions: [
        {
          type: 'mcq',
          prompt: "Which correctly describes a function's flow?",
          options: [
            'parameters go in, a return value can come out',
            'return values go in, parameters come out',
            'nothing goes in or out',
            'only loops go in',
          ],
          correctAnswer: 'parameters go in, a return value can come out',
          explanation: 'Inputs are parameters; output is the return value.',
        },
        {
          type: 'fillblank',
          prompt:
            'Reusing the same steps in many places is the main reason we make a ____.',
          correctAnswer: ['function'],
          explanation: 'Functions exist for reuse.',
        },
        {
          type: 'mcq',
          prompt:
            'Calling the same function with different arguments lets you...',
          options: [
            'get different results from the same steps',
            'change the program name',
            'stop all loops',
            'delete variables',
          ],
          correctAnswer: 'get different results from the same steps',
          explanation: 'Different inputs give different outputs.',
        },
        {
          type: 'dragdrop',
          prompt: 'Order the life of a function call.',
          options: [
            'pass in arguments',
            'run the steps inside',
            'return a value',
            'use the returned value',
          ],
          correctAnswer: [
            'pass in arguments',
            'run the steps inside',
            'return a value',
            'use the returned value',
          ],
          explanation: 'In, run, return, use.',
        },
        {
          type: 'fillblank',
          prompt: 'The value handed back from a function is its ____ value.',
          correctAnswer: ['return'],
          explanation: 'The handed-back value is the return value.',
        },
      ],
    },
  ],
  // ---- Algorithm Desert: Conditions, Boolean Logic, Problem Solving (concepts) ----
  'algorithm-desert': [
    {
      title: 'Conditions 1: Making Decisions',
      topicLesson: 'Conditions',
      questions: [
        {
          type: 'mcq',
          prompt: 'A condition in a program is...',
          options: [
            'a question that is either true or false',
            'a stored number',
            'a kind of loop',
            'a program name',
          ],
          correctAnswer: 'a question that is either true or false',
          explanation: 'A condition is a true/false test.',
        },
        {
          type: 'fillblank',
          prompt:
            'Code that runs only when a condition is true is an ____ decision.',
          correctAnswer: ['if'],
          explanation: 'An "if" runs code when the condition is true.',
        },
        {
          type: 'mcq',
          prompt:
            'The branch that runs when the condition is NOT true is the...',
          options: [
            'else branch',
            'loop branch',
            'input branch',
            'return branch',
          ],
          correctAnswer: 'else branch',
          explanation: '"else" handles the false case.',
        },
        {
          type: 'match',
          prompt: 'Match each comparison to its meaning.',
          options: ['is equal to', 'is greater than'],
          correctAnswer: {
            'is equal to': 'both sides are the same',
            'is greater than': 'left side is larger',
          },
          explanation: 'Comparisons test relationships between values.',
        },
        {
          type: 'fillblank',
          prompt: 'The answer to a condition is always either true or ____.',
          correctAnswer: ['false'],
          explanation: 'Conditions are true or false.',
        },
      ],
    },
    {
      title: 'Boolean Logic 2: AND, OR, NOT',
      topicLesson: 'Boolean Logic',
      questions: [
        {
          type: 'mcq',
          prompt: 'For "A AND B" to be true...',
          options: [
            'both A and B must be true',
            'only one needs to be true',
            'neither can be true',
            'A must be false',
          ],
          correctAnswer: 'both A and B must be true',
          explanation: 'AND needs both true.',
        },
        {
          type: 'mcq',
          prompt: 'For "A OR B" to be true...',
          options: [
            'at least one of A or B is true',
            'both must be false',
            'both must be true',
            'neither matters',
          ],
          correctAnswer: 'at least one of A or B is true',
          explanation: 'OR needs at least one true.',
        },
        {
          type: 'fillblank',
          prompt:
            'The operator that flips true into false (and false into true) is ____.',
          correctAnswer: ['not'],
          explanation: 'NOT negates a value.',
        },
        {
          type: 'match',
          prompt: 'Match each operator to its rule.',
          options: ['AND', 'OR', 'NOT'],
          correctAnswer: {
            AND: 'true only if both are true',
            OR: 'true if at least one is true',
            NOT: 'flips true and false',
          },
          explanation: 'AND: both; OR: one; NOT: flip.',
        },
        {
          type: 'mcq',
          prompt: '"NOT true" evaluates to...',
          options: ['false', 'true', 'maybe', 'an error'],
          correctAnswer: 'false',
          explanation: 'NOT true is false.',
        },
      ],
    },
    {
      title: 'Problem Solving 3: Step by Step',
      topicLesson: 'Problem Solving',
      questions: [
        {
          type: 'mcq',
          prompt:
            'A clear step-by-step plan to solve a problem is called an...',
          options: ['algorithm', 'error', 'variable', 'output'],
          correctAnswer: 'algorithm',
          explanation: 'An algorithm is an ordered plan of steps.',
        },
        {
          type: 'dragdrop',
          prompt: 'Order a good problem-solving approach.',
          options: [
            'understand the problem',
            'break it into smaller steps',
            'plan the steps in order',
            'check the solution works',
          ],
          correctAnswer: [
            'understand the problem',
            'break it into smaller steps',
            'plan the steps in order',
            'check the solution works',
          ],
          explanation: 'Understand, break down, plan, check.',
        },
        {
          type: 'fillblank',
          prompt:
            'Breaking a big problem into smaller, easier parts is called ____.',
          correctAnswer: ['decomposition', 'breaking it down'],
          explanation: 'Splitting a problem up is decomposition.',
        },
        {
          type: 'mcq',
          prompt:
            'Noticing that several problems share the same pattern helps you...',
          options: [
            'reuse a solution instead of starting over',
            'make the problem harder',
            'skip understanding it',
            'remove all steps',
          ],
          correctAnswer: 'reuse a solution instead of starting over',
          explanation: 'Spotting patterns lets you reuse solutions.',
        },
        {
          type: 'fillblank',
          prompt:
            'A repeating idea you can reuse across problems is called a ____.',
          correctAnswer: ['pattern'],
          explanation: 'Reusable repeating ideas are patterns.',
        },
      ],
    },
    {
      title: 'Logic Review 4: Conditions and Truth',
      topicLesson: 'Conditions',
      questions: [
        {
          type: 'mcq',
          prompt: 'A value that can only be true or false is called a...',
          options: ['boolean', 'number', 'word', 'loop'],
          correctAnswer: 'boolean',
          explanation: 'True/false values are booleans.',
        },
        {
          type: 'fillblank',
          prompt:
            'Comparing two values (like "is 5 bigger than 3?") gives back a ____ value.',
          correctAnswer: ['boolean', 'true/false', 'true or false'],
          explanation: 'Comparisons produce booleans.',
        },
        {
          type: 'mcq',
          prompt: '"Is 7 greater than 10?" gives back...',
          options: ['false', 'true', '7', '10'],
          correctAnswer: 'false',
          explanation: '7 is not greater than 10, so false.',
        },
        {
          type: 'match',
          prompt: 'Match each decision word to its job.',
          options: ['if', 'else'],
          correctAnswer: {
            if: 'run steps when the condition is true',
            else: 'run other steps when it is false',
          },
          explanation: 'if = true case, else = false case.',
        },
        {
          type: 'fillblank',
          prompt:
            'Choosing between two paths based on true or false is called making a ____.',
          correctAnswer: ['decision', 'choice'],
          explanation: 'Branching on true/false is a decision.',
        },
      ],
    },
  ],
  // ---- Python Kingdom: the only real programming language ----
  'python-kingdom': [
    {
      title: 'Python 1: Syntax & Output',
      topicLesson: 'Python Syntax',
      questions: [
        {
          type: 'mcq',
          prompt: 'Which Python function shows text on the screen?',
          options: ['print', 'input', 'echo', 'show'],
          correctAnswer: 'print',
          explanation: 'print() writes output in Python.',
        },
        {
          type: 'fillblank',
          prompt: 'Complete this Python line: ____("Hello") shows Hello.',
          correctAnswer: ['print'],
          explanation: 'print("Hello") outputs Hello.',
        },
        {
          type: 'mcq',
          prompt: 'In Python, a line that starts with # is a...',
          options: ['comment', 'variable', 'loop', 'function'],
          correctAnswer: 'comment',
          explanation: '# begins a comment in Python.',
        },
        {
          type: 'fillblank',
          prompt:
            'Python uses ____ (spaces at the start of a line) to group code into blocks.',
          correctAnswer: ['indentation', 'indent', 'whitespace'],
          explanation: 'Indentation marks code blocks in Python.',
        },
        {
          type: 'match',
          prompt: 'Match each Python piece to its job.',
          options: ['print()', '#'],
          correctAnswer: { 'print()': 'shows output', '#': 'starts a comment' },
          explanation: 'print shows output; # comments.',
        },
      ],
    },
    {
      title: 'Python 2: Variables & Input',
      topicLesson: 'Running Python',
      questions: [
        {
          type: 'mcq',
          prompt: 'Which Python symbol assigns a value to a variable?',
          options: ['=', '==', '=>', ':='],
          correctAnswer: '=',
          explanation: 'A single = assigns in Python.',
        },
        {
          type: 'fillblank',
          prompt:
            'In Python, the ____() function reads text typed by the user.',
          correctAnswer: ['input'],
          explanation: 'input() reads user input.',
        },
        {
          type: 'mcq',
          prompt: "What type does Python's input() return by default?",
          options: ['a string', 'an int', 'a boolean', 'a list'],
          correctAnswer: 'a string',
          explanation: 'input() returns a string.',
        },
        {
          type: 'dragdrop',
          prompt: 'Order this Python flow: ask, store, show.',
          options: [
            'name = input("Your name? ")',
            'store it in the variable name',
            'print("Hi", name)',
          ],
          correctAnswer: [
            'name = input("Your name? ")',
            'store it in the variable name',
            'print("Hi", name)',
          ],
          explanation: 'Read input, keep it, then print it.',
        },
        {
          type: 'fillblank',
          prompt: 'In Python, wrapping text in quotes makes a ____.',
          correctAnswer: ['string'],
          explanation: 'Quoted text is a string.',
        },
      ],
    },
    {
      title: 'Python 3: Loops & Logic',
      topicLesson: 'Putting It Together',
      questions: [
        {
          type: 'mcq',
          prompt: 'How many times does "for i in range(3)" run in Python?',
          options: ['3', '2', '4', 'forever'],
          correctAnswer: '3',
          explanation: 'range(3) yields 0,1,2 — three runs.',
        },
        {
          type: 'fillblank',
          prompt: 'In Python, range(5) produces the numbers 0 through ____.',
          correctAnswer: ['4'],
          explanation: 'range(5) stops before 5.',
        },
        {
          type: 'mcq',
          prompt: 'Which Python keyword starts a condition check?',
          options: ['if', 'for', 'def', 'print'],
          correctAnswer: 'if',
          explanation: 'if begins a condition in Python.',
        },
        {
          type: 'mcq',
          prompt: 'In Python, "True and False" evaluates to...',
          options: ['False', 'True', 'None', 'an error'],
          correctAnswer: 'False',
          explanation: 'and needs both true.',
        },
        {
          type: 'fillblank',
          prompt:
            'A Python loop that repeats while a condition is true uses the ____ keyword.',
          correctAnswer: ['while'],
          explanation: 'while repeats on a condition.',
        },
      ],
    },
    {
      title: 'Python 4: Functions in Python',
      topicLesson: 'Putting It Together',
      questions: [
        {
          type: 'mcq',
          prompt: 'Which keyword defines a function in Python?',
          options: ['def', 'func', 'function', 'lambda'],
          correctAnswer: 'def',
          explanation: 'Python uses def.',
        },
        {
          type: 'fillblank',
          prompt:
            'A Python function hands a value back using the ____ keyword.',
          correctAnswer: ['return'],
          explanation: 'return passes a value out.',
        },
        {
          type: 'mcq',
          prompt: 'In "def greet(name):", what is name?',
          options: ['a parameter', 'a return value', 'a loop', 'a comment'],
          correctAnswer: 'a parameter',
          explanation: 'name is the function parameter.',
        },
        {
          type: 'dragdrop',
          prompt: 'Order to define and use a Python function.',
          options: [
            'def add(a, b):',
            'return a + b',
            'call add(2, 3)',
            'use the result 5',
          ],
          correctAnswer: [
            'def add(a, b):',
            'return a + b',
            'call add(2, 3)',
            'use the result 5',
          ],
          explanation: 'Define, return, call, use.',
        },
        {
          type: 'fillblank',
          prompt: 'A Python function with no return statement gives back ____.',
          correctAnswer: ['none', 'None'],
          explanation: 'No return yields None.',
        },
      ],
    },
  ],
};

/**
 * Build all quizzes from the blueprints. Each quiz links to a lesson in its
 * world (the topic lesson, or the world's first lesson). `lessonByTitle` maps a
 * lesson title to its document; `lessonsByWorldId` maps world id -> lesson docs.
 */
/**
 * Which course does a world belong to?
 *
 * Read from the slug: C's worlds are all `c-` prefixed, and Python's are the
 * original unprefixed five. A future course adds its prefix here alongside its
 * content, so the mapping stays in one place instead of being spread across
 * the seed as special cases.
 */
const WORLD_SLUG_PREFIXES = [
  { prefix: 'c-', course: 'c' },
  { prefix: 'html-', course: 'html' },
  { prefix: 'ai-', course: 'ai' },
];

function worldCourseSlug(worldSlug) {
  const hit = WORLD_SLUG_PREFIXES.find((p) => worldSlug.startsWith(p.prefix));
  return hit ? hit.course : 'python';
}

/** The courses this seed actually has worlds and lessons for. */
const SEEDED_COURSE_SLUGS = new Set(
  [...WORLDS, ...C_WORLDS, ...HTML_WORLDS, ...AI_WORLDS].map((w) =>
    worldCourseSlug(w.slug),
  ),
);

const ALL_QUIZ_BLUEPRINTS = {
  ...QUIZ_BLUEPRINTS,
  ...C_QUIZ_BLUEPRINTS,
  ...HTML_QUIZ_BLUEPRINTS,
  ...AI_QUIZ_BLUEPRINTS,
};

function buildQuizzes(worlds, lessonByTitle, lessonsByWorldId) {
  const quizzes = [];
  for (const world of worlds) {
    const blueprints = ALL_QUIZ_BLUEPRINTS[world.slug] || [];
    const worldLessons = lessonsByWorldId.get(String(world._id)) || [];
    for (const bp of blueprints) {
      const lesson = lessonByTitle.get(bp.topicLesson) || worldLessons[0];
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
  assertSafeToRun();
  await connectDB();
  console.log(`Seeding database (${DESTRUCTIVE ? 'RESET' : 'upsert'} mode)...`);

  if (DESTRUCTIVE) {
    // Local-development reset only. Guarded by assertSafeToRun() above.
    console.warn('[seed] --reset: dropping all seeded content collections.');
    await Promise.all([
      World.deleteMany({}),
      // Courses too. Without this a --reset recreates the worlds with fresh
      // ids while the old Course documents survive, so every world loses its
      // course attachment and the ladder reports "0 lessons" for Python —
      // which readiness reads as COMPLETE and opens the final test.
      Course.deleteMany({}),
      Lesson.deleteMany({}),
      Quiz.deleteMany({}),
      Challenge.deleteMany({}),
      Achievement.deleteMany({}),
      AvatarItem.deleteMany({}),
    ]);
  }

  // Worlds
  /**
   * All four courses' worlds. Each course's worlds are ordered in its own band
   * (Python 1-5, C 6-10, HTML 11-15, AI 16-20) and every non-Python slug is
   * prefixed, so neither ordering nor slugs can collide.
   */
  const ALL_WORLDS = [...WORLDS, ...C_WORLDS, ...HTML_WORLDS, ...AI_WORLDS];
  const worldsRes = await upsertMany(World, ALL_WORLDS, (w) => ({
    slug: w.slug,
  }));
  const worlds = worldsRes.docs;

  /* ---- The course ladder: Python -> C -> HTML -> AI ----
   *
   * Seeded HERE, immediately after the worlds, because every world must carry
   * a `course` for the student surface to serve it. A world with no course is
   * invisible to pupils (the API only asks for the current course's worlds),
   * so leaving this to a separate script means a fresh install has a working
   * database and an empty world map.
   *
   * Only Python is published: it is the only track with content. Publishing an
   * empty course is worse than hiding it, because 0-of-0 reads as 100%
   * complete and would hand out its final test on day one.
   *
   * `scripts/seed-courses.mjs` does the same reconciliation for an existing
   * database, including the backfill.
   */
  const courseDocs = COURSES.map((c) => ({
    slug: c.slug,
    language: c.language,
    order: c.order,
    title: c.title,
    tagline: c.tagline,
    description: c.description,
    icon: c.icon,
    tint: c.tint,
    kind: c.kind,
    /**
     * A course is published when it HAS content.
     *
     * Publishing a course with no worlds would put a rung on the ladder that
     * a pupil can reach and then find empty — and worse, an empty course reads
     * as 0-of-0 to the readiness check, which counts as complete. So this is
     * derived from the seeded content rather than hardcoded per slug.
     */
    /**
     * A GAMES REALM PUBLISHES WITHOUT WORLDS.
     *
     * The rule above derives `published` from whether the seed has worlds for
     * the slug, which is right for a language course — an empty one reads as
     * 0-of-0 to the readiness check and would hand out its final test on day
     * one. Cognitive Games has no worlds BY DESIGN: its content is four
     * mini-games that already exist, and `courseReadiness` measures it in
     * games and never offers it a paper. Leaving it unpublished would hide the
     * first rung of the ladder.
     */
    published: c.kind === 'games' || SEEDED_COURSE_SLUGS.has(c.slug),
  }));
  /**
   * UPSERTED HIGHEST `order` FIRST, and that is not arbitrary.
   *
   * `Course.order` is UNIQUE, and adding the Cognitive Games realm at 1 shifted
   * every language course down one: Python 1->2, C 2->3, HTML 3->4, AI 4->5.
   * Applied in the natural order, the very first write would try to give
   * Python order 2 while C still holds it, and Mongo would reject the whole
   * re-seed with a duplicate key.
   *
   * Descending, each target has just been vacated by the course above it: AI
   * takes 5 (free), HTML takes 4 (AI's old slot), C takes 3, Python takes 2,
   * and Cognitive Games takes 1 last of all.
   */
  const coursesRes = await upsertMany(
    Course,
    [...courseDocs].sort((a, b) => b.order - a.order),
    (c) => ({ slug: c.slug })
  );
  const courseBySlugDoc = new Map(coursesRes.docs.map((c) => [c.slug, c]));

  /**
   * Attach each world to its course by SLUG PREFIX.
   *
   * Every world used to be assigned to Python unconditionally, which was true
   * when Python was the only course with content. With the C course seeded, an
   * unconditional assignment would hand C's five worlds to Python — so Python
   * would show fifteen worlds and C none, and C's readiness would be 0-of-0,
   * i.e. instantly "complete".
   */
  for (const [slug, courseDoc] of courseBySlugDoc) {
    const owned = worlds.filter((w) => worldCourseSlug(w.slug) === slug);
    if (!owned.length) continue;
    await World.updateMany(
      { _id: { $in: owned.map((w) => w._id) } },
      { $set: { course: courseDoc._id } },
    );
  }
  report('Worlds', worldsRes);

  /**
   * THE FINAL-TEST QUESTION BANK.
   *
   * Seeded because it was EMPTY, which made the final test unsittable on every
   * rung: `drawSection` throws when a section's pool is smaller than the paper
   * needs, so a pupil who finished all the content pressed Start and got an
   * error.
   *
   * Upserted on (courseSlug, type, prompt) so re-seeding does not duplicate the
   * bank, and so a superadmin's own added questions are never touched.
   */
  const questionDocs = [];
  for (const [slug, questions] of Object.entries(QUESTION_BANK)) {
    const courseDoc = courseBySlugDoc.get(slug);
    if (!courseDoc) continue;
    for (const q of questions) {
      questionDocs.push({ ...q, course: courseDoc._id, courseSlug: slug });
    }
  }
  const questionsRes = await upsertMany(Question, questionDocs, (q) => ({
    courseSlug: q.courseSlug,
    type: q.type,
    prompt: q.prompt,
  }));
  report('Questions', questionsRes);

  // Lessons (a few per world from its topics)
  const lessonDocs = worlds.flatMap((w) => lessonsForWorld(w));
  const lessonsRes = await upsertMany(Lesson, lessonDocs, (l) => ({
    world: l.world,
    title: l.title,
  }));
  const lessons = lessonsRes.docs;
  report('Lessons', lessonsRes);

  /**
   * REMOVE LESSONS THAT THE CURRICULUM NO LONGER CONTAINS.
   *
   * THE BUG THIS FIXES
   * ------------------
   * Lessons are upserted on `{ world, title }`, so RENAMING a lesson does not
   * update it — it creates a second one and leaves the original behind. An
   * upgrade that renamed Coding Forest's lessons from "Variables Basics",
   * "Inputs Basics", "Outputs Basics" to "Variables", "Stored Values",
   * "Input", "Output" therefore left the world holding SEVEN lessons: three
   * orphans and four real ones.
   *
   * That is not a tidiness problem, it breaks the ladder. The orphans keep
   * their old `order` values, so sorting by `{ order, _id }` puts
   * "Variables Basics" (order 1, and an older id) ahead of "Variables"
   * (order 1). The first slot — the only one that starts unlocked — is taken
   * by a lesson that is no longer on any card, and the card a child actually
   * sees called "Variables" is the SECOND in sequence and renders locked.
   *
   * So the first lesson of the first world of the first course appeared
   * locked, with no way to open it, on any database that had been upgraded
   * rather than reset.
   *
   * WHY DELETING IS SAFE HERE
   * -------------------------
   * These documents are not in the authored curriculum any more, so nothing
   * links to them from the map. A pupil's `completedLessons` may still name
   * one; those entries are matched by id against the lessons that exist, so a
   * dangling entry is ignored rather than miscounted. And the whole script is
   * already behind `assertSafeToRun()`, which refuses to touch anything but a
   * local development database.
   */
  const authoredTitlesByWorld = new Map();
  for (const doc of lessonDocs) {
    const key = String(doc.world);
    if (!authoredTitlesByWorld.has(key)) authoredTitlesByWorld.set(key, new Set());
    authoredTitlesByWorld.get(key).add(doc.title);
  }

  let prunedLessons = 0;
  for (const [worldId, titles] of authoredTitlesByWorld) {
    const stale = await Lesson.find({
      world: worldId,
      title: { $nin: [...titles] },
    }).select('title');
    if (stale.length === 0) continue;
    console.warn(
      `[seed] removing ${stale.length} lesson(s) no longer in the curriculum: ` +
        stale.map((l) => JSON.stringify(l.title)).join(', ')
    );
    const res = await Lesson.deleteMany({ _id: { $in: stale.map((l) => l._id) } });
    prunedLessons += res.deletedCount || 0;
  }
  if (prunedLessons > 0) {
    console.log(`Lessons: pruned ${prunedLessons} stale`);
  }

  // Real quizzes across all 5 worlds (~4 per world), with mixed question types.
  const lessonByTitle = new Map(lessons.map((l) => [l.title, l]));
  const lessonsByWorldId = lessons.reduce((map, l) => {
    const key = String(l.world);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(l);
    return map;
  }, new Map());
  const quizDocs = buildQuizzes(worlds, lessonByTitle, lessonsByWorldId);

  /**
   * KEYED ON TITLE ALONE — the lesson id must NOT be part of the key.
   *
   * It used to be `{ title, lesson }`, which put a FOREIGN KEY in a natural
   * key. Whenever a lesson was recreated with a new id — which happens
   * whenever lesson titles change, because lessons are themselves keyed on
   * title — every quiz's key changed with it, so the upsert matched nothing
   * and inserted a duplicate beside the original. The original kept pointing
   * at the deleted lesson.
   *
   * The result on a database that had been upgraded a few times: 85 quizzes
   * for 65 authored titles, with 20 exact-title duplicates whose `lesson` ref
   * was dangling. Those 20 could not appear in the arena at all — nothing can
   * list a quiz with no reachable lesson or world — so a fifth of the quizzes
   * were invisible.
   *
   * Blueprint titles are unique across all four courses (65 titles, 65
   * quizzes), so title alone identifies a quiz and re-running updates its
   * lesson link in place.
   */
  const quizzesRes = await upsertMany(Quiz, quizDocs, (q) => ({
    title: q.title,
  }));
  const quizzes = quizzesRes.docs;

  /**
   * Remove quizzes the blueprints no longer contain, for the same reason the
   * lessons are pruned: a renamed quiz would otherwise leave its original
   * behind, unreachable but still counted in the arena's totals and in every
   * report of how much content a course has.
   */
  const authoredQuizTitles = new Set(quizDocs.map((q) => q.title));
  const staleQuizzes = await Quiz.find({
    title: { $nin: [...authoredQuizTitles] },
  }).select('title');
  if (staleQuizzes.length > 0) {
    console.warn(
      `[seed] removing ${staleQuizzes.length} quiz(zes) no longer in the blueprints: ` +
        staleQuizzes
          .slice(0, 8)
          .map((q) => JSON.stringify(q.title))
          .join(', ') +
        (staleQuizzes.length > 8 ? ` …and ${staleQuizzes.length - 8} more` : '')
    );
    const res = await Quiz.deleteMany({ _id: { $in: staleQuizzes.map((q) => q._id) } });
    console.log(`Quizzes: pruned ${res.deletedCount} stale`);
  }

  console.log(
    `Inserted ${quizzes.length} quizzes (across ${worlds.length} worlds).`,
  );

  // Achievements
  const achievementsRes = await upsertMany(Achievement, ACHIEVEMENTS, (a) => ({
    key: a.key,
  }));
  const achievements = achievementsRes.docs;
  console.log(`Inserted ${achievements.length} achievements.`);

  // Avatar shop items
  const avatarItemsRes = await upsertMany(AvatarItem, AVATAR_ITEMS, (i) => ({
    key: i.key,
  }));
  const avatarItems = avatarItemsRes.docs;
  const purchasableCount = avatarItems.filter((i) => !i.isDefault).length;
  const byType = avatarItems.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + 1;
    return acc;
  }, {});
  console.log(
    `Inserted ${avatarItems.length} avatar items (${purchasableCount} purchasable in shop). By type: ${JSON.stringify(byType)}`,
  );

  // Sample daily challenges
  const codingForest = worlds.find((w) => w.slug === 'coding-forest');
  const loopMountain = worlds.find((w) => w.slug === 'loop-mountain');
  const challengesRes = await upsertMany(
    Challenge,
    [
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
    ],
    (c) => ({ title: c.title }),
  );
  const challenges = challengesRes.docs;
  report('Challenges', challengesRes);

  /* ------------------------------------------------------------------------
   * Bootstrap accounts.
   *
   * Passwords are set ONLY when the account is first created. The previous
   * version called setPassword() unconditionally, so every seed run silently
   * reset the platform's highest-privilege account back to a password that was
   * published in the README — including in production.
   *
   * Credentials come from the environment. In production they are REQUIRED; in
   * development they fall back to documented local-only defaults.
   * ---------------------------------------------------------------------- */
  const SUPERADMIN_EMAIL =
    process.env.SEED_SUPERADMIN_EMAIL || 'superadmin@kodingkeydzz.com';
  const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@kodingkeydzz.com';
  const DEV_SUPERADMIN_PASSWORD = 'Super@123';
  const DEV_ADMIN_PASSWORD = 'Admin@123';

  function bootstrapPassword(envVar, devDefault, label) {
    const fromEnv = process.env[envVar];
    if (fromEnv && fromEnv.length >= 8) return fromEnv;
    if (IS_PROD) {
      console.error(
        `\nRefusing to create the ${label} account in production without a strong password.\n` +
          `  Set ${envVar} (at least 8 characters) and re-run.\n` +
          "  Generate one with:  node -e \"console.log(require('crypto').randomBytes(18).toString('base64url'))\"\n",
      );
      process.exit(1);
    }
    if (fromEnv) {
      console.warn(
        `[seed] ${envVar} is shorter than 8 characters — using the dev default.`,
      );
    }
    return devDefault;
  }

  // Super admin (tenant-less). Idempotent by email.
  let superadmin = await User.findOne({ email: SUPERADMIN_EMAIL });
  let superadminCreated = false;
  if (!superadmin) {
    superadmin = new User({
      role: 'superadmin',
      name: 'Koding Keydzz Super Admin',
      email: SUPERADMIN_EMAIL,
      org: null,
    });
    await superadmin.setPassword(
      bootstrapPassword(
        'SEED_SUPERADMIN_PASSWORD',
        DEV_SUPERADMIN_PASSWORD,
        'super admin',
      ),
    );
    superadminCreated = true;
  } else {
    // Repair role/tenant drift, but never touch the password of an existing
    // account — that is the operator's to manage.
    superadmin.role = 'superadmin';
    superadmin.org = null;
  }
  await superadmin.save();
  console.log(
    superadminCreated
      ? `  Created super admin: ${SUPERADMIN_EMAIL}`
      : `  Super admin already exists: ${SUPERADMIN_EMAIL} (password left unchanged)`,
  );

  // Default organization (idempotent by name).
  let defaultOrg = await Organization.findOne({
    name: 'Koding Keydzz Academy',
  });
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

  // Demo org admin, attached to the default org. Idempotent by email.
  let admin = await User.findOne({ email: ADMIN_EMAIL });
  let adminCreated = false;
  if (!admin) {
    admin = new User({
      role: 'admin',
      name: 'Koding Keydzz Admin',
      email: ADMIN_EMAIL,
      grade: 'N/A',
      school: 'Koding Keydzz HQ',
      org: defaultOrg._id,
    });
    await admin.setPassword(
      bootstrapPassword(
        'SEED_ADMIN_PASSWORD',
        DEV_ADMIN_PASSWORD,
        'demo admin',
      ),
    );
    adminCreated = true;
  } else {
    admin.role = 'admin';
    admin.org = defaultOrg._id;
  }
  await admin.save();

  // Link the org back to its admin.
  defaultOrg.adminUser = admin._id;
  await defaultOrg.save();
  console.log(
    adminCreated
      ? `  Created demo admin: ${ADMIN_EMAIL} (Koding Keydzz Academy)`
      : `  Demo admin already exists: ${ADMIN_EMAIL} (password left unchanged)`,
  );

  /* ------------------------------------------------------------------------
   * Demo faculty + classrooms.
   *
   * The tenancy model is superadmin -> organization -> (admins + faculty +
   * students). Without at least one teacher and one class, the faculty
   * dashboard and the class reports have nothing to show, so a fresh install
   * looks broken rather than empty. Created only in NON-production, and only
   * when the organization has no faculty yet.
   * ---------------------------------------------------------------------- */
  if (!IS_PROD) {
    const existingFaculty = await User.countDocuments({
      org: defaultOrg._id,
      role: 'faculty',
      deletedAt: null,
    });

    if (existingFaculty === 0) {
      const DEMO_FACULTY = [
        {
          name: 'Priya Menon',
          email: 'priya.menon@kodingkeydzz.com',
          title: 'Computing Teacher',
          subjects: ['Python', 'Logic'],
        },
        {
          name: 'Arjun Rao',
          email: 'arjun.rao@kodingkeydzz.com',
          title: 'Mathematics Teacher',
          subjects: ['Algorithms'],
        },
      ];

      const facultyDocs = [];
      for (const f of DEMO_FACULTY) {
        // eslint-disable-next-line no-await-in-loop
        const doc = new User({
          role: 'faculty',
          name: f.name,
          email: f.email,
          title: f.title,
          subjects: f.subjects,
          org: defaultOrg._id,
          /**
           * Deliberately NOT forced, unlike a real staff account.
           *
           * `mustChangePassword` is now enforced in `protect`, so a flagged
           * account can do nothing but change its password. These are SHARED
           * demo logins with a published password — forcing a change would mean
           * the first person to open the demo silently locks out everyone
           * after them. Staff created through the admin UI are still flagged
           * (staffService), which is where the rule matters.
           */
          mustChangePassword: false,
        });
        // eslint-disable-next-line no-await-in-loop
        await doc.setPassword('Faculty@123');
        // eslint-disable-next-line no-await-in-loop
        await doc.save();
        facultyDocs.push(doc);
      }
      console.log(
        `  Created ${facultyDocs.length} demo faculty (password Faculty@123)`,
      );

      // A handful of demo students so the class reports and dashboards have
      // real shapes to render.
      const existingStudents = await User.countDocuments({
        org: defaultOrg._id,
        role: 'student',
        deletedAt: null,
      });

      const studentDocs = [];
      if (existingStudents === 0) {
        const DEMO_STUDENTS = [
          ['Aarav', 'Sharma', '5'],
          ['Diya', 'Patel', '5'],
          ['Kabir', 'Singh', '5'],
          ['Ananya', 'Iyer', '5'],
          ['Vivaan', 'Reddy', '5'],
          ['Ishita', 'Nair', '6'],
          ['Rohan', 'Gupta', '6'],
          ['Meera', 'Joshi', '6'],
          ['Aditya', 'Kumar', '6'],
          ['Saanvi', 'Desai', '6'],
        ];
        for (const [first, last, grade] of DEMO_STUDENTS) {
          const username = `${first}.${last}`.toLowerCase();
          // eslint-disable-next-line no-await-in-loop
          const doc = new User({
            role: 'student',
            name: `${first} ${last}`,
            firstName: first,
            lastName: last,
            username,
            grade,
            org: defaultOrg._id,
            // Spread some progress so the charts are not all zeros.
            xp: Math.floor(Math.random() * 1800),
            coins: Math.floor(Math.random() * 300),
            lessonsCompleted: Math.floor(Math.random() * 6),
            gameLevelsCompleted: Math.floor(Math.random() * 14),
            quizzesPassed: Math.floor(Math.random() * 5),
          });
          doc.level = computeSeedLevel(doc.xp);
          // eslint-disable-next-line no-await-in-loop
          await doc.setPassword('Student@123');
          // eslint-disable-next-line no-await-in-loop
          await doc.save();
          studentDocs.push(doc);
        }
        console.log(
          `  Created ${studentDocs.length} demo students (password Student@123)`,
        );
      }

      // Two classes, one per teacher, so faculty scoping is demonstrable.
      const grade5 = studentDocs
        .filter((s) => s.grade === '5')
        .map((s) => s._id);
      const grade6 = studentDocs
        .filter((s) => s.grade === '6')
        .map((s) => s._id);

      const classes = [
        {
          name: 'Grade 5 — Section A',
          grade: '5',
          section: 'A',
          subject: 'Python Basics',
          faculty: [facultyDocs[0]._id],
          students: grade5,
        },
        {
          name: 'Grade 6 — Section A',
          grade: '6',
          section: 'A',
          subject: 'Algorithms',
          faculty: [facultyDocs[1]._id],
          students: grade6,
        },
      ];
      for (const c of classes) {
        // eslint-disable-next-line no-await-in-loop
        await Classroom.findOneAndUpdate(
          { org: defaultOrg._id, name: c.name, academicYear: '' },
          { org: defaultOrg._id, ...c, academicYear: '' },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
      }
      console.log(`  Created ${classes.length} demo classrooms`);
    }
  }

  // Challenges are code-writing tasks, so they belong to a language track —
  // a Python challenge shown to a pupil working in C is a bug, not a stretch.
  await Challenge.updateMany(
    { $or: [{ course: null }, { course: { $exists: false } }] },
    { $set: { course: courseBySlugDoc.get('python')._id } },
  );

  // Keep the organization's denormalized member counters truthful.
  await Organization.recountMembers(defaultOrg._id);

  // NOTE: a previous version deleted every admin/superadmin whose email was
  // not one of the two seeded accounts. On a live install that removed the
  // admin account of EVERY real school. Never reintroduce a role-scoped
  // deleteMany here — organizations and their admins are customer data.

  // Keep org studentCount accurate after any cleanup above.
  const defaultOrgStudents = await User.countDocuments({
    role: 'student',
    org: defaultOrg._id,
  });
  defaultOrg.studentCount = defaultOrgStudents;
  await defaultOrg.save();

  console.log('--- Seed summary ---');
  // Reported per course rather than as a hardcoded sentence: the previous
  // summary said "Python published" and "Worlds -> Python" no matter what had
  // actually been seeded, which is precisely the kind of output that hides a
  // course quietly getting no content.
  const published = coursesRes.docs
    .filter((c) => c.published)
    .map((c) => c.slug);
  console.log(
    `  Courses:       ${coursesRes.docs.length} (published: ${published.join(', ') || 'none'})`,
  );
  for (const course of coursesRes.docs
    .slice()
    .sort((a, b) => a.order - b.order)) {
    const owned = worlds.filter((w) => worldCourseSlug(w.slug) === course.slug);
    const ownedIds = new Set(owned.map((w) => String(w._id)));
    const lessonCount = lessons.filter((l) =>
      ownedIds.has(String(l.world)),
    ).length;
    console.log(
      `    ${course.slug.padEnd(7)} worlds ${String(owned.length).padStart(2)}` +
        `  lessons ${String(lessonCount).padStart(2)}` +
        (course.published ? '' : '  (unpublished — no content yet)'),
    );
  }
  console.log(`  Lessons:       ${lessons.length}`);
  console.log(`  Quizzes:       ${quizzes.length}`);
  console.log(`  Achievements:  ${achievements.length}`);
  console.log(
    `  Avatar items:  ${avatarItems.length} (${purchasableCount} in shop)`,
  );
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

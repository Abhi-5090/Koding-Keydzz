// Logic Puzzle Kingdom — tappable MCQ puzzle levels (ids 1..7).
// Built entirely from authored brain-teaser puzzles, grouped by difficulty with
// a smooth ramp: EASY (2 levels, the kids puzzles), MEDIUM (3 levels, more kids
// puzzles), HARD (2 levels, high-school puzzles). ~5 puzzles per level.
//
// Level shape (consumed by QuestionLevelGame):
//   { id, name, difficulty:'easy'|'medium'|'hard', intro?, questions:[ q ] }
// Question shape:
//   { type:'mcq', prompt, options:[...], answer:<index of correct option>, explain? }
//
// Every `answer` below is the index into its own (already-shuffled) options array
// of the single correct choice. A unit test verifies each index is valid and
// points at the intended answer.

const mcq = (prompt, options, answer, explain) => ({ type: 'mcq', prompt, options, answer, explain })

const levels = [
  // ===== EASY (kids puzzles 1–10) =====
  {
    id: 1,
    name: 'Gatekeeper’s Riddles',
    difficulty: 'easy',
    intro: 'Tap the right answer to enter the castle.',
    questions: [
      mcq('Find the next number: 2, 4, 6, 8, __', ['12', '10', '9', '7'], 1, 'Counting up by 2s: after 8 comes 10.'),
      mcq('Which is different? Apple, Mango, Carrot, Banana', ['Mango', 'Carrot', 'Apple', 'Banana'], 1, 'Carrot is a vegetable; the rest are fruits.'),
      mcq('Circle, Square, Circle, Square, __', ['Triangle', 'Square', 'Circle', 'Star'], 2, 'The pattern alternates, so the next one is Circle.'),
      mcq('I have hands but cannot clap. What am I?', ['A clock', 'A glove', 'A door', 'A book'], 0, 'A clock has hands (hour and minute) but cannot clap.'),
      mcq('A, B, C, __, E', ['F', 'D', 'C', 'G'], 1, 'The alphabet in order — after C comes D.'),
    ],
  },
  {
    id: 2,
    name: 'Forest of First Steps',
    difficulty: 'easy',
    intro: 'Easy riddles to warm up your brain.',
    questions: [
      mcq('Arrange smallest to biggest: Elephant, Ant, Dog', ['Dog, Ant, Elephant', 'Ant, Dog, Elephant', 'Elephant, Dog, Ant', 'Ant, Elephant, Dog'], 1, 'An ant is smallest, then a dog, then a huge elephant.'),
      mcq('Ravi has 3 chocolates. He gives 1 to his friend. How many are left?', ['2', '3', '4', '1'], 0, '3 minus 1 leaves 2 chocolates.'),
      mcq('Sun → Day, Moon → ?', ['Night', 'Star', 'Sky', 'Morning'], 0, 'The sun belongs to the day, the moon to the night.'),
      mcq('If 1=A, 2=B, 3=C, then 4=?', ['C', 'E', 'D', 'F'], 2, 'Counting letters: 4 lines up with D.'),
      mcq('Which comes next? ⭐ ⭐ 🌙 ⭐ ⭐ 🌙 __', ['🌙', '⭐', '☀️', '🌟'], 1, 'The pattern is two stars then a moon, so the next is ⭐.'),
    ],
  },

  // ===== MEDIUM (more-kids puzzles 11–25) =====
  {
    id: 3,
    name: 'The Pattern Path',
    difficulty: 'medium',
    intro: 'Follow the patterned stones across the moat.',
    questions: [
      mcq('What comes next? 1, 3, 5, 7, __', ['8', '11', '9', '10'], 2, 'Odd numbers in order — after 7 comes 9.'),
      mcq('Odd one out: Cat, Dog, Cow, Table', ['Cow', 'Table', 'Cat', 'Dog'], 1, 'A table is furniture; the rest are animals.'),
      mcq('Missing shape: △, ○, △, ○, __', ['○', '△', '□', '☆'], 1, 'The shapes alternate, so the next is △.'),
      mcq('Which is heavier? 1 kg cotton or 1 kg iron?', ['1 kg iron', 'Both same', '1 kg cotton', 'Cannot tell'], 1, 'They weigh the same — both are 1 kg!'),
      mcq('Shoe → Foot, Glove → ?', ['Hand', 'Finger', 'Arm', 'Head'], 0, 'A shoe goes on a foot, a glove goes on a hand.'),
    ],
  },
  {
    id: 4,
    name: 'Riddle Bridge',
    difficulty: 'medium',
    intro: 'Cross the bridge by solving each riddle.',
    questions: [
      mcq('Letter pattern: A, C, E, G, __', ['H', 'J', 'I', 'F'], 2, 'Skip one letter each time: A, C, E, G, I.'),
      mcq('A basket has 5 apples. You take 2. How many do you have?', ['3', '5', '2', '7'], 2, 'You took 2, so you have 2 — the basket has 3 left.'),
      mcq('If you face North and turn right, which direction?', ['West', 'East', 'South', 'North'], 1, 'Turning right from North faces you East.'),
      mcq('Dog → Bark, Cat → ?', ['Meow', 'Moo', 'Bark', 'Roar'], 0, 'A dog barks and a cat meows.'),
      mcq('10, 20, 30, 40, __', ['45', '60', '50', '55'], 2, 'Counting by 10s — after 40 comes 50.'),
    ],
  },
  {
    id: 5,
    name: 'Cipher Chamber',
    difficulty: 'medium',
    intro: 'Tricky teasers hide in the chamber.',
    questions: [
      mcq('I go up but never come down. What am I?', ['Age', 'A balloon', 'Smoke', 'A kite'], 0, 'Your age keeps going up and never comes back down.'),
      mcq('2 + __ = 7', ['4', '6', '5', '3'], 2, '2 plus 5 makes 7.'),
      mcq('Red, Blue, Red, Blue, __', ['Green', 'Red', 'Blue', 'Yellow'], 1, 'The colours alternate, so the next is Red.'),
      mcq('Odd one out: Circle, Square, Triangle, Banana', ['Banana', 'Circle', 'Square', 'Triangle'], 0, 'Banana is a fruit; the rest are shapes.'),
      mcq('What has keys but cannot open locks?', ['A map', 'A keyboard', 'A car', 'A chest'], 1, 'A keyboard has keys you press, but they open no locks.'),
    ],
  },

  // ===== HARD (high-school puzzles 26–35) =====
  {
    id: 6,
    name: 'Throne of Truth',
    difficulty: 'hard',
    intro: 'Only sharp reasoning claims the throne.',
    questions: [
      mcq('What comes next? 3, 6, 12, 24, 48, __', ['72', '96', '64', '50'], 1, 'Each number doubles (×2): 48 × 2 = 96.'),
      mcq('What comes next? 5, 11, 23, 47, __', ['94', '95', '71', '96'], 1, 'The rule is ×2 + 1: 47 × 2 + 1 = 95.'),
      mcq('Odd one out: 121, 144, 169, 196, 225, 250', ['196', '250', '144', '225'], 1, 'All but 250 are perfect squares (11², 12², 13², 14², 15²).'),
      mcq('A clock shows 3:15. Angle between the hour and minute hands?', ['0°', '7.5°', '15°', '30°'], 1, 'At 3:15 the hour hand has moved a quarter past 3, leaving 7.5°.'),
      mcq('Walk 5 km north, 3 km east, 5 km south. How far from start?', ['8 km', '3 km', '5 km', '0 km'], 1, 'The north and south cancel out, leaving just the 3 km east.'),
    ],
  },
  {
    id: 7,
    name: 'Master of the Realm',
    difficulty: 'hard',
    intro: 'The final trial — only a true logician prevails.',
    questions: [
      mcq('If A=1..Z=26, what is the value of LOGIC?', ['52', '46', '40', '48'], 1, 'L12 + O15 + G7 + I9 + C3 = 46.'),
      mcq('"She is the daughter of my father\'s only son." Who is she to Ravi?', ['His sister', 'His daughter', 'His niece', 'His cousin'], 1, 'My father\'s only son is myself (Ravi), so she is Ravi\'s daughter.'),
      mcq('A bag has 3 red and 2 blue balls. Probability of drawing red?', ['2/5', '3/5', '1/2', '3/2'], 1, '3 red out of 5 balls total gives 3/5.'),
      mcq('Five students A,B,C,D,E in a line: A before B, C after B, D before A. Who is first?', ['A', 'D', 'B', 'C'], 1, 'D is before A, A is before B, B before C — so D is first.'),
      mcq('I am always coming but never arrive. What am I?', ['Yesterday', 'Tomorrow', 'Today', 'The wind'], 1, 'Tomorrow is always coming, yet it never actually arrives.'),
    ],
  },
]

export default levels

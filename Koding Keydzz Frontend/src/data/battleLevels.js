// Coding Battle Arena — Campaign mode. 18 timed question levels (ids 1..18) of
// quick coding/logic MCQs and true/false. Rendered with QuestionLevelGame using
// its optional `timePerQuestion` prop for an "arena" countdown feel.
//
// Suggested timer per difficulty (applied by the page):
//   easy ~15s/question, medium ~12s, hard ~9s.
//
// Level shape (consumed by QuestionLevelGame):
//   { id, name, difficulty:'easy'|'medium'|'hard', intro?, questions:[ q ] }

const mcq = (prompt, options, answer, explain) => ({ type: 'mcq', prompt, options, answer, explain })
const tf = (prompt, answer, explain) => ({ type: 'truefalse', prompt, answer, explain })
const code = (prompt, codeStr, options, answer, explain) => ({ type: 'mcq', prompt, code: codeStr, options, answer, explain })

const levels = [
  // ===== EASY 1–8 (15s) =====
  {
    id: 1,
    name: 'Warm-Up Round',
    difficulty: 'easy',
    intro: 'Beat the clock! Quick answers win the arena.',
    questions: [
      mcq('What is 2 + 3 * 2?', ['10', '8', '12', '7'], 1, 'Multiply first: 3 * 2 = 6, then 2 + 6 = 8.'),
      mcq('Which is a Boolean value?', ['"yes"', 'True', '42', 'loop'], 1, 'True (and False) are the Boolean values.'),
      mcq('len("code") returns…', ['3', '4', '5', 'error'], 1, '"code" has 4 letters, so the length is 4.'),
      mcq('Which keyword defines a Python function?', ['func', 'def', 'fun', 'method'], 1, 'Python uses "def" to define a function.'),
    ],
  },
  {
    id: 2,
    name: 'Speed Math',
    difficulty: 'easy',
    intro: 'Fast fingers, sharp minds.',
    questions: [
      mcq('10 % 3 equals…', ['1', '3', '0', '7'], 0, '% is the remainder; 10 ÷ 3 leaves 1.'),
      mcq('2 ** 3 in Python is…', ['6', '8', '9', '5'], 1, '** is power; 2 to the 3rd = 8.'),
      mcq('7 // 2 (integer division) is…', ['3', '3.5', '4', '2'], 0, '// drops the decimal, so 7 // 2 = 3.'),
      mcq('Which is largest?', ['12', '21', '9', '19'], 1, '21 is the biggest of these.'),
    ],
  },
  {
    id: 3,
    name: 'True or False Sprint',
    difficulty: 'easy',
    intro: 'Snap decisions only!',
    questions: [
      tf('In Python, print() shows text on the screen.', true, 'print() outputs to the screen.'),
      tf('A variable can store a number.', true, 'Variables can hold numbers, text, and more.'),
      tf('5 == 5 is False.', false, '5 equals 5, so 5 == 5 is True.'),
      tf('A list can hold more than one item.', true, 'Lists store many items in order.'),
    ],
  },
  {
    id: 4,
    name: 'Code Reader I',
    difficulty: 'easy',
    intro: 'Read fast, answer faster.',
    questions: [
      code('What prints?', 'x = 4\nprint(x + 1)', ['4', '5', '41', 'error'], 1, 'x is 4, so x + 1 = 5.'),
      code('What prints?', 'name = "Sam"\nprint("Hi " + name)', ['Hi Sam', 'Hi name', 'HiSam', 'error'], 0, 'It joins "Hi " with "Sam" → "Hi Sam".'),
      code('How many times does it print?', 'for i in range(4):\n    print("go")', ['3', '4', '5', '0'], 1, 'range(4) is 0,1,2,3 → 4 times.'),
      code('What prints?', 'print(2 * 3)', ['23', '6', '5', '8'], 1, '2 * 3 = 6.'),
    ],
  },
  {
    id: 5,
    name: 'Operator Dash',
    difficulty: 'easy',
    intro: 'Know your symbols!',
    questions: [
      mcq('Which symbol compares for equality?', ['=', '==', '=>', ':='], 1, '== compares; a single = assigns.'),
      mcq('Which symbol means "not equal"?', ['!=', '=/=', '<>', '!=='], 0, '!= means "not equal" in Python.'),
      mcq('What does + do with two strings?', ['Adds them as numbers', 'Joins them', 'Errors', 'Removes spaces'], 1, '+ concatenates (joins) strings.'),
      mcq('Which is the "and" of True and False?', ['True', 'False', 'None', 'Error'], 1, 'True and False is False (both must be true).'),
    ],
  },
  {
    id: 6,
    name: 'Loop Lightning',
    difficulty: 'easy',
    intro: 'Loops at the speed of light.',
    questions: [
      code('What is the last number printed?', 'for i in range(1, 4):\n    print(i)', ['4', '3', '2', '5'], 1, 'range(1,4) gives 1,2,3 — the last is 3.'),
      mcq('range(5) produces which numbers?', ['1..5', '0..5', '0..4', '1..4'], 2, 'range(5) is 0,1,2,3,4.'),
      tf('A "while" loop repeats while its condition is True.', true, 'It keeps looping until the condition becomes False.'),
      code('How many stars print?', 'for i in range(3):\n    print("*")', ['2', '3', '4', '1'], 1, 'range(3) runs 3 times.'),
    ],
  },
  {
    id: 7,
    name: 'Quick Logic',
    difficulty: 'easy',
    intro: 'Think, then strike.',
    questions: [
      mcq('What comes next: 2, 4, 6, __ ?', ['7', '8', '9', '10'], 1, 'Counting by 2s → 8.'),
      tf('NOT True is False.', true, 'NOT flips the value.'),
      mcq('(5 > 3) is…', ['True', 'False', 'Maybe', 'Error'], 0, '5 is greater than 3, so it is True.'),
      mcq('Odd one out:', ['if', 'else', 'elif', 'print'], 3, 'print outputs text; the others are conditionals.'),
    ],
  },
  {
    id: 8,
    name: 'Final Easy Bout',
    difficulty: 'easy',
    intro: 'Last warm-up before the gloves come off.',
    questions: [
      code('What prints?', 'x = 10\nx = x - 4\nprint(x)', ['10', '6', '4', '14'], 1, '10 - 4 = 6.'),
      mcq('Which makes a comment in Python?', ['//', '#', '<!--', '/*'], 1, 'Python comments start with #.'),
      tf('len([1, 2, 3]) is 3.', true, 'The list has 3 items.'),
      code('What prints?', 'print("5" * 2)', ['10', '55', '7', 'error'], 1, '"5" * 2 repeats the string → "55".'),
    ],
  },

  // ===== MEDIUM 9–14 (12s) =====
  {
    id: 9,
    name: 'Rival Appears',
    difficulty: 'medium',
    intro: 'The clock tightens — stay sharp!',
    questions: [
      code('What prints?', 'nums = [3, 6, 9]\nprint(nums[1])', ['3', '6', '9', 'error'], 1, 'Index 1 is the second item → 6.'),
      mcq('What is 3 ** 2 + 1?', ['7', '9', '10', '12'], 2, '3 ** 2 = 9, then + 1 = 10.'),
      code('What prints?', 'word = "robot"\nprint(word[0])', ['r', 'o', 't', 'robot'], 0, 'Index 0 is the first letter → "r".'),
      tf('(4 > 2) and (1 > 5) is True.', false, '1 > 5 is False, so the "and" is False.'),
    ],
  },
  {
    id: 10,
    name: 'String Skirmish',
    difficulty: 'medium',
    intro: 'Slice and dice the text.',
    questions: [
      code('What prints?', 'word = "python"\nprint(word[1:4])', ['pyt', 'yth', 'ytho', 'pyth'], 1, 'Slice [1:4] takes indexes 1,2,3 → "yth".'),
      code('What prints?', 'print(len("battle"))', ['5', '6', '7', '4'], 1, '"battle" has 6 letters.'),
      mcq('"Hi".upper() returns…', ['hi', 'HI', 'Hi', 'error'], 1, 'upper() makes all letters uppercase → "HI".'),
      code('What prints?', 'print("ab" + "cd")', ['abcd', 'ab cd', 'a b c d', 'error'], 0, '+ joins the strings → "abcd".'),
    ],
  },
  {
    id: 11,
    name: 'Branch Battle',
    difficulty: 'medium',
    intro: 'Pick the right path before time runs out.',
    questions: [
      code('What prints?', 'x = 7\nif x > 5:\n    print("big")\nelse:\n    print("small")', ['big', 'small', 'nothing', 'error'], 0, '7 > 5 is True → prints "big".'),
      code('Which runs?', 'score = 50\nif score >= 90:\n    print("A")\nelif score >= 50:\n    print("B")\nelse:\n    print("C")', ['A', 'B', 'C', 'nothing'], 1, '50 is not >= 90 but is >= 50 → the elif prints "B".'),
      tf('In if/elif/else, more than one branch can run.', false, 'Only the first matching branch runs.'),
      code('What prints?', 'n = 4\nif n % 2 == 0:\n    print("even")\nelse:\n    print("odd")', ['even', 'odd', 'error', 'nothing'], 0, '4 % 2 == 0 is True → "even".'),
    ],
  },
  {
    id: 12,
    name: 'List Clash',
    difficulty: 'medium',
    intro: 'Master the lists to win.',
    questions: [
      code('What is the final list?', 'nums = [1, 2, 3]\nnums.append(4)\nprint(nums)', ['[1,2,3]', '[1,2,3,4]', '[4,1,2,3]', 'error'], 1, 'append adds 4 to the end.'),
      code('What prints?', 'nums = [5, 10, 15]\nprint(sum(nums))', ['30', '15', '510', '3'], 0, 'sum adds them: 5+10+15 = 30.'),
      code('What prints?', 'nums = [2, 4, 6]\nprint(len(nums))', ['2', '3', '6', '12'], 1, 'There are 3 items.'),
      code('What prints?', 'nums = [9, 8, 7]\nprint(nums[-1])', ['9', '8', '7', 'error'], 2, 'Index -1 is the last item → 7.'),
    ],
  },
  {
    id: 13,
    name: 'Function Fight',
    difficulty: 'medium',
    intro: 'Call them right, call them fast.',
    questions: [
      code('What prints?', 'def triple(n):\n    return n * 3\n\nprint(triple(4))', ['7', '12', '34', '43'], 1, 'triple(4) returns 4 * 3 = 12.'),
      code('What prints?', 'def greet(name):\n    return "Hi " + name\n\nprint(greet("Mo"))', ['Hi Mo', 'Hi name', 'HiMo', 'error'], 0, 'It returns "Hi " + "Mo" → "Hi Mo".'),
      code('What does this return?', 'def f(x):\n    x * 2\n\nprint(f(5))', ['10', 'None', '5', 'error'], 1, 'There is no return, so the function returns None.'),
      code('What prints?', 'def add(a, b=10):\n    return a + b\n\nprint(add(5))', ['5', '10', '15', 'error'], 2, 'b defaults to 10, so 5 + 10 = 15.'),
    ],
  },
  {
    id: 14,
    name: 'Boolean Brawl',
    difficulty: 'medium',
    intro: 'Logic gates under pressure.',
    questions: [
      tf('(True or False) and True is True.', true, '(True or False) is True, and True and True = True.'),
      tf('not (3 > 1) is True.', false, '3 > 1 is True, and not True is False.'),
      mcq('What is True and True and False?', ['True', 'False', 'None', 'Error'], 1, 'A single False makes the whole "and" False.'),
      mcq('What is False or False or True?', ['True', 'False', 'None', 'Error'], 0, 'One True makes the "or" True.'),
    ],
  },

  // ===== HARD 15–18 (9s) =====
  {
    id: 15,
    name: 'Championship Round',
    difficulty: 'hard',
    intro: 'Only the fastest survive. 9 seconds each!',
    questions: [
      code('What prints?', 'x = 5\nfor i in range(3):\n    x += i\nprint(x)', ['5', '8', '10', '11'], 1, 'x starts at 5, then adds 0, 1, 2 → 5 + 0 + 1 + 2 = 8.'),
      code('What prints?', 'print(10 // 3, 10 % 3)', ['3 1', '3.3 1', '1 3', '3 0'], 0, '10 // 3 = 3 and 10 % 3 = 1 → "3 1".'),
      tf('"abc"[::-1] equals "cba".', true, '[::-1] reverses the string → "cba".'),
      code('What prints?', 'nums = [1, 2, 3, 4]\nprint(nums[1:3])', ['[2, 3]', '[1, 2]', '[2, 3, 4]', '[1, 2, 3]'], 0, 'Slice [1:3] takes indexes 1 and 2 → [2, 3].'),
    ],
  },
  {
    id: 16,
    name: 'Logic Duel',
    difficulty: 'hard',
    intro: 'Out-think your rival, fast.',
    questions: [
      tf('(True and False) or (not False) is True.', true, '(False) or (True) = True.'),
      code('What prints?', 'x = 2\ny = x\nx = 5\nprint(y)', ['2', '5', '7', 'error'], 0, 'y copied x (2) before x changed, so y is still 2.'),
      mcq('What comes next: 1, 2, 4, 8, __ ?', ['10', '12', '16', '14'], 2, 'Each number doubles → 16.'),
      code('What prints?', 'a = 6\nb = 4\nprint(a > b and b > 2)', ['True', 'False', 'None', 'error'], 0, '6 > 4 is True and 4 > 2 is True → True.'),
    ],
  },
  {
    id: 17,
    name: 'Lightning Trace',
    difficulty: 'hard',
    intro: 'Trace the code instantly.',
    questions: [
      code('What is the final total?', 'total = 0\nfor i in range(1, 5):\n    total += i\nprint(total)', ['6', '10', '15', '4'], 1, 'Adds 1+2+3+4 = 10.'),
      code('What prints?', 'def f(n):\n    if n <= 1:\n        return 1\n    return n * f(n - 1)\n\nprint(f(3))', ['3', '6', '9', '1'], 1, 'f(3) = 3 * f(2) = 3 * 2 * 1 = 6 (factorial).'),
      code('What prints?', 'nums = [4, 2, 7, 1]\nnums.sort()\nprint(nums[0])', ['4', '2', '1', '7'], 2, 'After sorting → [1,2,4,7], the first item is 1.'),
      tf('In Python, 0.1 + 0.2 == 0.3 is True.', false, 'Floating-point rounding makes it slightly off, so it is False.'),
    ],
  },
  {
    id: 18,
    name: 'Grand Champion',
    difficulty: 'hard',
    intro: 'The final showdown — claim the arena crown!',
    questions: [
      code('What prints?', 'x = 1\nfor i in range(3):\n    x = x * 2\nprint(x)', ['2', '6', '8', '4'], 2, 'x doubles 3 times: 1→2→4→8.'),
      code('What prints?', 'words = ["a", "bb", "ccc"]\ntotal = 0\nfor w in words:\n    total += len(w)\nprint(total)', ['3', '6', '9', '5'], 1, 'Lengths 1+2+3 = 6.'),
      mcq('What is 17 % 5 + 17 // 5?', ['5', '6', '7', '8'], 0, '17 % 5 = 2 and 17 // 5 = 3, so 2 + 3 = 5.'),
      code('What prints?', 'def mystery(n):\n    return n if n > 0 else -n\n\nprint(mystery(-8))', ['-8', '8', '0', 'error'], 1, 'This is absolute value; -(-8) = 8.'),
      tf('[1,2,3] + [4] equals [1,2,3,4].', true, '+ joins two lists into one.'),
      code('What is the final value?', 'count = 10\nwhile count > 7:\n    count -= 1\nprint(count)', ['10', '7', '6', '8'], 1, 'count goes 10→9→8→7, then 7 > 7 is False → stops at 7.'),
    ],
  },
]

export default levels

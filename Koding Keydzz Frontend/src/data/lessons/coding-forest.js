// Coding Forest — fully authored topic lessons.
//
// This world is the quality bar for every other realm: rich, correct,
// kid-friendly (8–16yo) Python-flavoured content. Each lesson follows the
// shared schema (see ./index.js): title, tagline, intro, sections, snippet,
// tryIt, guide, takeaways.
//
// Topic keys are lower-case so getLesson() can match whatever casing the API
// sends for world.topics ("Variables", "Stored Values", …).

const lessons = {
  variables: {
    title: 'Variables',
    tagline: 'Labelled boxes your program can remember things in.',
    intro:
      'A variable is a named box where your program keeps a value so it can use it again later. Instead of writing the same number or word over and over, you tuck it into a box, give the box a clear name, and reach for it whenever you need it. Almost every program you will ever write is really just a story about variables changing over time.',
    sections: [
      {
        heading: 'What a variable really is',
        body:
          'Picture a shelf full of labelled boxes. When you write name = "Aria", Python makes a box, drops the word "Aria" inside, and sticks the label name on the front. From then on, whenever you say name, Python opens that box and hands you what is inside.',
        bullets: [
          'The = sign means "put this value into this box" — it is NOT "equals" like in maths.',
          'The name goes on the LEFT, the value goes on the RIGHT.',
          'You can look inside a box as many times as you like without emptying it.',
        ],
      },
      {
        heading: 'Naming rules (Python is picky)',
        body:
          'A good variable name tells the reader what is inside. Python only allows certain names, so it helps to know the rules before you get a red error.',
        bullets: [
          'Use letters, numbers and underscores: score, player_2, high_score.',
          'A name may NOT start with a number: 2fast is not allowed, fast2 is fine.',
          'No spaces — use an underscore instead: top score becomes top_score.',
          'Names are case-sensitive: Score and score are two different boxes.',
          'Pick meaningful names: lives beats x every single time.',
        ],
      },
      {
        heading: 'Values come in different types',
        body:
          'The thing you store has a type — a kind. Python figures out the type automatically from what you put in the box.',
        bullets: [
          'int — a whole number, like 7 or -3 (age = 12).',
          'float — a number with a decimal point, like 3.14 (price = 2.5).',
          'str — a string of text in quotes, like "hello" (name = "Aria").',
          'bool — a yes/no value, either True or False (is_ready = True).',
          'list — an ordered collection in square brackets (pets = ["cat", "dog"]).',
        ],
      },
      {
        heading: 'Reassigning: boxes can change',
        body:
          'A variable can hold a new value at any time. The old value is simply forgotten and the new one takes its place — this is called reassignment.',
        bullets: [
          'score = 0 then later score = score + 10 makes score become 10.',
          'The right side is worked out FIRST, then stored back into the box.',
          'A box can even change type: x = 5 then x = "five" is legal (but usually confusing).',
        ],
      },
      {
        heading: 'Common mistakes to dodge',
        body:
          'Everybody hits these at the start — spotting them early saves a lot of head-scratching.',
        bullets: [
          'Forgetting quotes on text: name = Aria breaks; name = "Aria" works.',
          'Using a box before you fill it gives a NameError.',
          'Mixing up = (store a value) with == (check if equal).',
          'Reading name when you stored Name — the capital letters must match.',
        ],
      },
    ],
    snippet: {
      language: 'python',
      lines: [
        '# Make some variables',
        'name = "Aria"      # a str (text)',
        'age = 12           # an int (whole number)',
        'height = 1.4       # a float (decimal)',
        'is_coder = True    # a bool (yes/no)',
        '',
        'print(name, "is", age, "years old")',
        '',
        '# Boxes can change!',
        'age = age + 1',
        'print("Next birthday:", age)',
      ],
      caption: 'Four types of value, then a box that changes with reassignment.',
    },
    tryIt: {
      language: 'python',
      starter:
        '# Store YOUR details in variables, then print them.\n' +
        'name = "your name here"\n' +
        'favourite_number = 7\n' +
        '\n' +
        'print("Hi, I am", name)\n' +
        'print("My favourite number is", favourite_number)\n',
      challenge:
        'Add a variable called age with your age, then print a sentence that uses all three variables.',
      hint:
        'Make a new line: age = 12. Then print("I am", name, "and I am", age). Numbers do not need quotes, text does!',
    },
    guide: [
      {
        step: 'Think of a labelled box',
        body:
          'A variable is a box with a name label. You put a value in, and the label lets you find it again. Say it out loud: "name holds Aria".',
      },
      {
        step: 'Write name = value',
        body:
          'The name goes on the left, an = sign in the middle, and the value on the right. Example: score = 0. Python builds the box and fills it.',
      },
      {
        step: 'Choose the right type',
        body:
          'Whole numbers (int) and decimals (float) need no quotes. Text (str) must sit inside "quotes". Yes/no values are True or False (bool).',
      },
      {
        step: 'Use the box by name',
        body:
          'Anywhere you write the variable name, Python swaps in its value. print(score) shows what is currently inside score.',
      },
      {
        step: 'Change it whenever you like',
        body:
          'Store a new value to replace the old one: score = score + 10. Python works out the right side first, then puts the answer back in the box.',
      },
      {
        step: 'Name things clearly',
        body:
          'Future-you will thank present-you. lives, player_name and high_score explain themselves; a, b and x do not.',
      },
    ],
    takeaways: [
      'A variable is a named box that remembers a value for later.',
      'Write it as name = value — name on the left, value on the right.',
      'Values have types: int, float, str, bool and list.',
      'Reassigning stores a new value and forgets the old one.',
      'Clear, meaningful names make your code read like a sentence.',
    ],
  },

  'stored values': {
    title: 'Stored Values',
    tagline: 'The actual stuff kept inside your boxes.',
    intro:
      'If a variable is a box, the stored value is the treasure inside it. Values are the numbers, words, and yes/no answers your program works with. Learning the different kinds of values — and how to combine them — is what turns a pile of boxes into a real program.',
    sections: [
      {
        heading: 'The main kinds of value',
        body:
          'Every value in Python has a type. The type decides what you can do with it — you can add numbers, but you cannot really subtract two words.',
        bullets: [
          'Numbers: int (12) for whole numbers, float (12.5) for decimals.',
          'Text: str ("hello") — always wrapped in quotes.',
          'Truth: bool — either True or False, used for decisions.',
          'Collections: list (["a", "b", "c"]) — many values in order.',
        ],
      },
      {
        heading: 'Combining values',
        body:
          'Values love to be combined. How they combine depends on their type.',
        bullets: [
          'Add numbers with +: 2 + 3 gives 5.',
          'Join text with + too: "code" + "kid" gives "codekid".',
          'Repeat text with *: "ha" * 3 gives "hahaha".',
          'You cannot add a number to text directly — turn the number into text first with str(7).',
        ],
      },
      {
        heading: 'Peeking at a value',
        body:
          'Two friendly built-in tools help you understand what you are holding.',
        bullets: [
          'print(value) shows the value on screen.',
          'type(value) tells you its kind: type(12) is <class \'int\'>.',
          'Converting types: int("5") makes the number 5, str(5) makes the text "5".',
        ],
      },
    ],
    snippet: {
      language: 'python',
      lines: [
        'points = 42          # an int value',
        'player = "Sam"       # a str value',
        'won = True           # a bool value',
        '',
        '# Join text and a (converted) number',
        'print(player + " scored " + str(points))',
        'print("Winner?", won)',
      ],
      caption: 'Different value types combined into one friendly message.',
    },
    tryIt: {
      language: 'python',
      starter:
        '# Try combining values.\n' +
        'word = "code"\n' +
        'print(word * 3)          # repeat text\n' +
        'print(10 + 5)            # add numbers\n',
      challenge:
        'Make a str variable for a fruit and an int variable for how many you have, then print "I have 3 apples" using both.',
      hint:
        'Numbers must become text before you join them with +. Use str(count), or just pass them to print separated by commas: print("I have", count, fruit).',
    },
    guide: [
      {
        step: 'Know your value types',
        body:
          'int and float are numbers, str is text in quotes, bool is True/False, and list holds many values.',
      },
      {
        step: 'Add numbers, join text',
        body:
          'The + sign adds numbers but glues text together. "a" + "b" makes "ab", while 1 + 2 makes 3.',
      },
      {
        step: 'Match your types',
        body:
          'You cannot glue a number onto text directly. Convert first with str(number), or let print handle it with commas.',
      },
      {
        step: 'Inspect what you have',
        body:
          'Use type(value) to check a kind and print(value) to see it. This is how you debug surprises.',
      },
    ],
    takeaways: [
      'A stored value is the treasure inside a variable.',
      'Main types: int, float, str, bool and list.',
      '+ adds numbers but joins text; * can repeat text.',
      'Convert between types with int(), float() and str().',
    ],
  },

  input: {
    title: 'Input',
    tagline: 'How your program asks the player a question.',
    intro:
      'Input is how a program listens. When you call input(), the program pauses, waits for the person to type something and press Enter, and then hands you back whatever they typed. This is what makes a program feel alive — it can respond to a real person instead of only doing what you hard-coded.',
    sections: [
      {
        heading: 'The input() function',
        body:
          'input() shows an optional prompt, waits for the user to type, and returns their answer as a string. You almost always store that answer in a variable so you can use it.',
        bullets: [
          'name = input("What is your name? ") stores the reply in name.',
          'The prompt is the message shown before the cursor.',
          'The program WAITS at input() until Enter is pressed.',
        ],
      },
      {
        heading: 'Input is always text',
        body:
          'This trips up almost everyone: input() always gives back a string, even when the person types a number. "5" is text, not the number 5.',
        bullets: [
          'age = input("Age? ") gives text like "12", not the number 12.',
          'To do maths, convert it: age = int(input("Age? ")).',
          'Use float(...) for decimals: price = float(input("Price? ")).',
          'If someone types letters into int(), Python raises a ValueError.',
        ],
      },
      {
        heading: 'Using what you collected',
        body:
          'Once the answer is in a variable, it behaves like any other value — you can print it, do maths, or make decisions with it.',
        bullets: [
          'Greet them: print("Hello, " + name + "!").',
          'Do maths: next_year = age + 1.',
          'In this app the player types their answers in the box below the code.',
        ],
      },
    ],
    snippet: {
      language: 'python',
      lines: [
        '# Ask two questions',
        'name = input("What is your name? ")',
        'age = int(input("How old are you? "))',
        '',
        '# Use the answers',
        'print("Nice to meet you, " + name + "!")',
        'print("Next year you will be", age + 1)',
      ],
      caption: 'input() collects text; int() turns the age into a real number.',
    },
    tryIt: {
      language: 'python',
      starter:
        '# Type an answer in the input box below, then Run.\n' +
        'colour = input("What is your favourite colour? ")\n' +
        'print("Wow,", colour, "is a great colour!")\n',
      challenge:
        'Ask the player for a number, turn it into an int, and print that number doubled.',
      hint:
        'Wrap input in int(): num = int(input("Pick a number: ")). Then print(num * 2). Remember to type your answer in the input box before running!',
    },
    guide: [
      {
        step: 'Call input() to ask',
        body:
          'input("your question ") shows a prompt and waits for the person to type and press Enter.',
      },
      {
        step: 'Store the answer',
        body:
          'Catch the reply in a variable: answer = input("...?"). Now you can use it later.',
      },
      {
        step: 'Remember: it is text',
        body:
          'Whatever the user types comes back as a string, even "42". Numbers must be converted before you do maths.',
      },
      {
        step: 'Convert when you need numbers',
        body:
          'Wrap it: int(input("...")) for whole numbers or float(input("...")) for decimals.',
      },
      {
        step: 'Use the answer',
        body:
          'Now print it, add to it, or make a decision with it — it is a normal value like any other.',
      },
    ],
    takeaways: [
      'input() pauses the program and returns what the user types.',
      'The answer always comes back as a string.',
      'Wrap it in int() or float() to do maths.',
      'Store the reply in a variable so you can reuse it.',
    ],
  },

  output: {
    title: 'Output',
    tagline: 'How your program shows results to the world.',
    intro:
      'Output is how a program speaks. The print() function takes whatever you give it and shows it on the screen so a real person can read it. Without output your program could do amazing calculations in secret — but nobody would ever see them. Output is how your code says "look what I did!"',
    sections: [
      {
        heading: 'The print() function',
        body:
          'print() displays one or more values, then moves to a new line. It is the friendliest tool in Python and you will use it constantly.',
        bullets: [
          'print("Hello!") shows Hello! on its own line.',
          'You can print numbers, text, variables — anything.',
          'Each print() call starts a fresh line by default.',
        ],
      },
      {
        heading: 'Printing several things at once',
        body:
          'Give print() several values separated by commas and it shows them all, automatically putting a space between each one.',
        bullets: [
          'print("Score:", 42) shows: Score: 42 (note the space).',
          'Commas handle the type-mixing for you — no str() needed.',
          'print(name, "has", lives, "lives") reads like a sentence.',
        ],
      },
      {
        heading: 'Neat, readable output',
        body:
          'A few small touches make your output clearer and more fun to read.',
        bullets: [
          'Empty line for spacing: print() with nothing inside.',
          'Combine text with + when you want NO extra spaces: "Hi" + name.',
          'f-strings are a tidy way to mix text and values: f"Score: {points}".',
        ],
      },
    ],
    snippet: {
      language: 'python',
      lines: [
        'name = "Aria"',
        'points = 42',
        '',
        'print("=== Score Card ===")',
        'print("Player:", name)',
        'print("Points:", points)',
        'print()                       # blank line',
        'print(f"Well done, {name}!")  # f-string',
      ],
      caption: 'Commas add spaces, an empty print() adds a gap, f-strings mix in values.',
    },
    tryIt: {
      language: 'python',
      starter:
        '# Show a fun message.\n' +
        'hero = "Sam"\n' +
        'level = 3\n' +
        'print("Hello,", hero)\n' +
        'print("You reached level", level)\n',
      challenge:
        'Print a small three-line score card that shows a name, a score, and a cheerful "Great job!" message.',
      hint:
        'Use three print() lines. Mix text and variables with commas: print("Score:", score). Try an f-string for the last line: print(f"Great job, {hero}!").',
    },
    guide: [
      {
        step: 'Call print() to show things',
        body:
          'print(something) displays that something on screen and then moves to a new line.',
      },
      {
        step: 'Print variables, not just text',
        body:
          'print(score) shows the value inside the box, so your output changes as your data changes.',
      },
      {
        step: 'Separate with commas',
        body:
          'print("Score:", points) shows both, with a tidy space between — and no type errors.',
      },
      {
        step: 'Add spacing for clarity',
        body:
          'An empty print() drops a blank line, which makes long output easier to read.',
      },
      {
        step: 'Try an f-string',
        body:
          'f"Hi {name}" slots a variable straight into your text — clean and readable.',
      },
    ],
    takeaways: [
      'print() shows values on screen so people can see results.',
      'Commas print several values with spaces between them.',
      'An empty print() adds a blank line for spacing.',
      'f-strings like f"Hi {name}" mix text and values neatly.',
    ],
  },
}

export default lessons

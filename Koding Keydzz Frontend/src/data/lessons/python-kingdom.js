// Python Kingdom — fully authored topic lessons.
//
// Same schema as coding-forest.js (see ./index.js): title, tagline, intro,
// sections, snippet, tryIt, guide, takeaways. Topic keys are lower-case so
// getLesson() matches whatever casing the API sends for world.topics
// ("Syntax", "Running Python", "Putting It Together").
//
// Includes extra aliases ("python", "python programming") so lessons still open
// gracefully if the API sends the older topic labels for this world.

const syntax = {
  title: 'Syntax',
  tagline: 'The grammar rules that make Python work.',
  intro:
    'Syntax is the grammar of a programming language — the rules about where things go and how they are spelled. Just as English needs spaces and full stops to make sense, Python needs colons, indentation and neat lines. The good news: Python has some of the tidiest, friendliest syntax of any language, and once the shape clicks, your code just works.',
  sections: [
    {
      heading: 'One statement per line',
      body:
        'A statement is a single instruction. In Python you normally write one statement on each line, and you do NOT need a semicolon at the end. Press Enter and start the next instruction on a fresh line.',
      bullets: [
        'One instruction per line keeps code easy to read.',
        'No semicolons needed — the end of the line is the end of the statement.',
        'Blank lines are fine and help group related code.',
      ],
    },
    {
      heading: 'Indentation defines blocks',
      body:
        'This is Python\'s signature idea. Instead of curly braces, Python uses INDENTATION — the spaces at the start of a line — to show which lines belong together inside a block. The standard is 4 spaces per level, and every line in the same block must line up exactly.',
      bullets: [
        'Lines indented the same amount belong to the same block.',
        'Use 4 spaces per level — be consistent, never mix tabs and spaces.',
        'Getting the spacing wrong gives an IndentationError.',
        'The indentation is not just for looks — it is part of the meaning.',
      ],
    },
    {
      heading: 'Colons open a block',
      body:
        'Lines that begin a block — like if, for, while and def — end with a colon. The colon is Python\'s way of saying "the indented lines below are mine".',
      bullets: [
        'End the header line with a colon: if score > 10:.',
        'The very next line steps in one indent level.',
        'Forgetting the colon gives a SyntaxError.',
      ],
    },
    {
      heading: 'Comments with #',
      body:
        'Anything after a # on a line is a comment: a note for humans that Python completely ignores. Comments explain WHY your code does something, which future-you will be grateful for.',
      bullets: [
        'Everything after # on a line is skipped by Python.',
        'Put a comment on its own line, or after code: x = 5  # the score.',
        'Good comments explain the reason, not the obvious.',
      ],
    },
    {
      heading: 'print() and case-sensitivity',
      body:
        'print() is the built-in tool that shows output on screen, and it must be spelled in lower case with round brackets. Python is case-sensitive, meaning Print, PRINT and print are three different things — only print works.',
      bullets: [
        'Spelling and case must match exactly: print, not Print.',
        'Round brackets hold what you want to show: print("Hi").',
        'name and Name are two different variables to Python.',
      ],
    },
  ],
  snippet: {
    language: 'python',
    lines: [
      '# A tidy little Python program',
      'name = "Coder"          # store a value in a variable',
      'level = 3               # numbers need no quotes',
      '',
      'if level >= 3:          # header line ends with a colon',
      '    print("Welcome,", name)   # indented 4 spaces',
      '    print("You reached level", level)',
      '',
      'print("Goodbye!")       # back out of the block',
    ],
    caption: 'Comments explain, a colon opens the block, and 4-space indents show what is inside.',
  },
  tryIt: {
    language: 'python',
    starter:
      '# Just run this and read how the shape works.\n' +
      'for i in range(3):\n' +
      '    print("Line", i)\n',
    challenge:
      'Add a comment above the loop that explains what it does, then add a second indented print inside the loop so each pass prints two lines.',
    hint:
      'Start a new line above the for with # and your explanation. For the second print, add another line indented the same 4 spaces as the first print.',
  },
  guide: [
    {
      step: 'Write one instruction per line',
      body:
        'Each statement goes on its own line, with no semicolon needed. Press Enter to start the next one.',
    },
    {
      step: 'End block headers with a colon',
      body:
        'Lines like if, for and def finish with a colon. The colon promises an indented block is coming next.',
    },
    {
      step: 'Indent the block by 4 spaces',
      body:
        'Everything inside a block lines up at the same indent. Consistent 4-space indents are the Python standard.',
    },
    {
      step: 'Add comments with #',
      body:
        'Use # to leave notes for humans. Python ignores everything after the # on that line.',
    },
    {
      step: 'Watch your spelling and case',
      body:
        'Python is case-sensitive. print must be lower case, and name is different from Name.',
    },
  ],
  takeaways: [
    'Syntax is the grammar of Python — the rules for how code is written.',
    'Indentation (4 spaces) defines which lines belong to a block.',
    'Block headers like if and for end with a colon.',
    'Comments start with # and are ignored by Python.',
    'Python is case-sensitive: print, Print and PRINT are not the same.',
  ],
}

const runningPython = {
  title: 'Running Python',
  tagline: 'Write code, press Run, watch it come alive.',
  intro:
    'Writing code is only half the fun — running it is where the magic happens. When you run a Python program, the computer reads your instructions from the top of the file to the bottom, doing exactly what each line says, in order. In this Playground you type your code, press Run, and the results appear in the output panel below.',
  sections: [
    {
      heading: 'Top to bottom, in order',
      body:
        'Python is a careful reader. It starts at the very first line and works its way down, one line at a time, never skipping ahead. This means the ORDER you write things in really matters — a value has to be created before you can use it.',
      bullets: [
        'Line 1 runs first, then line 2, then line 3, and so on.',
        'You must create a variable before the line that uses it.',
        'Swap two lines around and the output can change completely.',
      ],
    },
    {
      heading: 'How the Playground runs your code',
      body:
        'When you press Run, the Playground hands your whole program to Python, which carries out every line and collects anything you print(). That collected text appears in the output panel so you can read it.',
      bullets: [
        'Press Run to send your code to Python.',
        'Everything you print() shows up in the output panel.',
        'No print()? Then even correct code shows nothing — that is normal.',
      ],
    },
    {
      heading: 'Errors are normal (really!)',
      body:
        'Every coder on Earth sees errors constantly — they are not a sign you are bad at this. An error just means Python got confused at one line and stopped so it could tell you where. Fixing errors is a huge part of coding.',
      bullets: [
        'An error pauses the program at the line that confused Python.',
        'Lines before the error still ran; lines after it did not.',
        'Seeing an error means you are coding, not failing.',
      ],
    },
    {
      heading: 'Reading a traceback',
      body:
        'When something breaks, Python prints a traceback — a short report about what went wrong. The trick is to read the LAST line first: it names the type of error and gives a short message. The lines above point at where in your code it happened.',
      bullets: [
        'Read the last line first — it names the error and the problem.',
        'NameError means you used a variable you never created.',
        'SyntaxError means the shape is wrong, like a missing colon.',
        'The line number tells you where to start looking.',
      ],
    },
  ],
  snippet: {
    language: 'python',
    lines: [
      '# Python runs these in order, top to bottom',
      'print("Step 1: wake up")',
      'print("Step 2: get dressed")',
      'print("Step 3: eat breakfast")',
      '',
      'score = 0            # create the box first...',
      'score = score + 10   # ...then we can use it',
      'print("Score is now", score)',
      '',
      '# print(mystery)   # would cause a NameError — try un-commenting it!',
    ],
    caption: 'Each line runs top to bottom; the commented last line shows a common error to explore.',
  },
  tryIt: {
    language: 'python',
    starter:
      '# Press Run and watch the lines appear in order.\n' +
      'print("Loading...")\n' +
      'print("Ready!")\n' +
      'print("Go!")\n',
    challenge:
      'Swap two of the print lines and predict how the output changes before you Run. Then remove the quotes from one line and Run again to see a real error message.',
    hint:
      'Order matters, so moving a line moves its output. When you break a line on purpose, read the LAST line of the error first — it names the problem.',
  },
  guide: [
    {
      step: 'Write your instructions',
      body:
        'Type your code in the editor, one statement per line, in the order you want it to happen.',
    },
    {
      step: 'Press Run',
      body:
        'The Playground hands your program to Python, which carries out each line from top to bottom.',
    },
    {
      step: 'Read the output panel',
      body:
        'Anything you print() appears below. No print means no visible output — that is expected.',
    },
    {
      step: 'Expect the occasional error',
      body:
        'Errors are a normal part of coding. Python stops at the confusing line so it can tell you where to look.',
    },
    {
      step: 'Read the traceback bottom-up',
      body:
        'Start at the last line of the error — it names the error and the message — then use the line number to find the spot.',
    },
  ],
  takeaways: [
    'Python runs your code from the top line to the bottom, in order.',
    'Order matters — create a value before the line that uses it.',
    'Press Run and your print() output appears in the panel.',
    'Errors are normal; they pause the program and point at the problem.',
    'Read a traceback\'s last line first to learn what went wrong.',
  ],
}

const puttingItTogether = {
  title: 'Putting It Together',
  tagline: 'Build a real little program from all your pieces.',
  intro:
    'This is the moment everything connects. You have met variables, input, output, conditions, loops and functions on their own — now you combine them into one small, complete program that actually does something fun. When you finish this lesson you will have built a real thing you can play with. That is the whole point of coding.',
  sections: [
    {
      heading: 'The pieces you already have',
      body:
        'A complete program is just your familiar tools working as a team. Before we build, let us name the players so you can spot each one in the finished code.',
      bullets: [
        'Variables store the values your program needs to remember.',
        'input() asks the player a question; output with print() shows results.',
        'Conditions (if/elif/else) let the program make decisions.',
        'Loops repeat steps; functions bundle steps under a reusable name.',
      ],
    },
    {
      heading: 'Wrapping steps in a function',
      body:
        'A function lets you name a bunch of steps and reuse them. Here we build a tiny number-guessing game and tuck the whole thing inside a function called play() so it reads cleanly and could be run again.',
      bullets: [
        'def play(): gives the block of steps a name.',
        'Everything the game does lives indented inside the function.',
        'Calling play() at the bottom actually runs the game.',
      ],
    },
    {
      heading: 'Looping until the player wins',
      body:
        'Our game keeps asking for guesses until the player gets it right. A while loop is perfect: it repeats "while" the guess is wrong, and stops the moment it is correct.',
      bullets: [
        'while guess != secret: repeats until the guess matches.',
        'Each pass reads a new guess and gives a hint.',
        'When the guess is right, the loop ends and we celebrate.',
      ],
    },
    {
      heading: 'Deciding with conditions',
      body:
        'Inside the loop, if/elif/else compares the guess to the secret number and prints a helpful "too high" or "too low" hint. This is what makes the game feel smart.',
      bullets: [
        'Compare guess with secret to give a direction.',
        'if too high, elif too low, else it must be correct.',
        'Good hints turn random guessing into clever play.',
      ],
    },
    {
      heading: 'Runnable now, interactive next',
      body:
        'Real input() waits for a person to type, so the snippet below uses a fixed list of guesses to demonstrate the exact same logic without needing you to type. The tryIt version uses live input() so you can play it for real.',
      bullets: [
        'The snippet simulates guesses so it runs and prints on its own.',
        'The tryIt version swaps in input() so YOU play it.',
        'The decision-making logic is identical in both.',
      ],
    },
  ],
  snippet: {
    language: 'python',
    lines: [
      '# A tiny number-guessing game — everything working together!',
      'secret = 7',
      'guesses = [4, 9, 7]   # pretend the player typed these',
      '',
      'def play():',
      '    for guess in guesses:',
      '        print("You guessed", guess)',
      '        if guess > secret:',
      '            print("Too high!")',
      '        elif guess < secret:',
      '            print("Too low!")',
      '        else:',
      '            print("Correct! You win!")',
      '            return',
      '',
      'play()   # run the game',
    ],
    caption: 'Variables, a list, a function, a loop and if/elif/else — one complete program.',
  },
  tryIt: {
    language: 'python',
    starter:
      '# The REAL game — type your guesses in the input box, then Run.\n' +
      'secret = 7\n' +
      'guess = 0\n' +
      '\n' +
      'while guess != secret:\n' +
      '    guess = int(input("Guess a number 1-10: "))\n' +
      '    if guess > secret:\n' +
      '        print("Too high!")\n' +
      '    elif guess < secret:\n' +
      '        print("Too low!")\n' +
      '\n' +
      'print("Correct! You win!")\n',
    challenge:
      'Add a counter that starts at 0 and goes up by 1 each guess, then print how many tries it took to win.',
    hint:
      'Before the loop write tries = 0. Inside the loop add tries = tries + 1. After the loop print("You won in", tries, "tries!"). Remember to type each guess in the input box.',
  },
  guide: [
    {
      step: 'Gather your pieces',
      body:
        'List what the program needs: variables to remember, input to ask, conditions to decide, a loop to repeat, and print to show results.',
    },
    {
      step: 'Set up your variables',
      body:
        'Create the values the program starts with, like a secret number and a first guess, before the action begins.',
    },
    {
      step: 'Loop until the goal is met',
      body:
        'Use a while loop that keeps asking until the guess is correct, so the game does not stop too early.',
    },
    {
      step: 'Decide with conditions',
      body:
        'Inside the loop, use if/elif/else to compare the guess and give a helpful "too high" or "too low" hint.',
    },
    {
      step: 'Show a satisfying result',
      body:
        'When the loop ends, print a clear win message so the player knows they succeeded.',
    },
    {
      step: 'Tweak and make it yours',
      body:
        'Change the secret number, add a try counter, or wrap it in a function. Small tweaks turn an example into your own creation.',
    },
  ],
  takeaways: [
    'A real program is your small pieces working together as a team.',
    'Variables, input, conditions, loops and functions each play a role.',
    'A while loop repeats until a goal is reached, then stops.',
    'if/elif/else lets the program respond smartly to the player.',
    'Start from a working example, then tweak it into something of your own.',
  ],
}

const lessons = {
  syntax,
  'running python': runningPython,
  'putting it together': puttingItTogether,
  // Aliases for the older single-topic labels this world may still send.
  python: syntax,
  'python programming': puttingItTogether,
}

export default lessons

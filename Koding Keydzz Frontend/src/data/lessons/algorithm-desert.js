// Algorithm Desert — fully authored topic lessons.
//
// Same schema as coding-forest.js (see ./index.js): title, tagline, intro,
// sections, snippet, tryIt, guide, takeaways. Topic keys are lower-case so
// getLesson() matches whatever casing the API sends for world.topics
// ("Conditions", "Boolean Logic", "Problem Solving").

const lessons = {
  conditions: {
    title: 'Conditions',
    tagline: 'Let your program choose its own path.',
    intro:
      'A condition is a yes/no question your program asks itself before it decides what to do next. Should the umbrella come out? Is the score high enough for a gold star? With if, elif and else, your code stops doing the exact same thing every time and starts making real decisions — just like you do a hundred times a day.',
    sections: [
      {
        heading: 'The if statement',
        body:
          'if means "only do this when the answer is yes". You write if, then a question that is either True or False, then a colon. The lines you want to run when the answer is yes go underneath, indented to the right.',
        bullets: [
          'The line always ends with a colon: if it is raining:.',
          'The indented block runs ONLY when the question is True.',
          'If the question is False, Python simply skips the whole block.',
        ],
      },
      {
        heading: 'Comparison operators ask the questions',
        body:
          'A condition needs something to compare. Comparison operators take two values and hand back True or False. They are the questions inside every if.',
        bullets: [
          '== asks "are these equal?" — score == 100 (note the DOUBLE equals).',
          '!= asks "are these different?" — name != "Sam".',
          '> and < ask "bigger?" and "smaller?" — age > 12, temp < 0.',
          '>= and <= add "or equal" — score >= 50 means 50 counts too.',
          'Remember: = stores a value, but == checks if two values match.',
        ],
      },
      {
        heading: 'else: the catch-all path',
        body:
          'else means "otherwise, do this instead". It has no question of its own — it simply runs whenever the if above it was False. Together, if/else guarantee exactly one of the two blocks runs.',
        bullets: [
          'else always pairs with an if above it.',
          'else ends with a colon too, but never has a condition.',
          'One of the two paths ALWAYS runs — never zero, never both.',
        ],
      },
      {
        heading: 'elif: checking more than two paths',
        body:
          'When there are several possibilities, elif (short for "else if") lets you check extra questions in order. Python tries each one from the top and stops at the first that is True.',
        bullets: [
          'Order matters: put the strictest test (score >= 90) first.',
          'You can have as many elif branches as you need.',
          'Only ONE branch ever runs — the first True one wins.',
          'A final else catches everything none of the tests matched.',
        ],
      },
      {
        heading: 'Indentation and nesting',
        body:
          'Indentation is how Python knows which lines belong to a branch. Line up the spaces and Python understands the shape. You can even put an if inside another if — that is called nesting, and it lets you ask a follow-up question only after the first one passed.',
        bullets: [
          'Every line inside a branch uses the same indent (4 spaces is standard).',
          'A nested if goes one extra level in, deeper to the right.',
          'The inner question is only asked when the outer one was True.',
          'Wrong indentation gives an IndentationError — line things up neatly.',
        ],
      },
    ],
    snippet: {
      language: 'python',
      lines: [
        'score = 75',
        '',
        '# Only ONE of these branches will run',
        'if score >= 90:',
        '    print("Gold star! Amazing!")',
        'elif score >= 50:',
        '    print("Nice work — you passed!")',
        'else:',
        '    print("Keep trying, you will get there!")',
        '',
        'print("Your score was", score)',
      ],
      caption: 'Python checks each test top to bottom and runs exactly one branch.',
    },
    tryIt: {
      language: 'python',
      starter:
        '# Decide what to wear based on the weather.\n' +
        'raining = True\n' +
        '\n' +
        'if raining:\n' +
        '    print("Take an umbrella!")\n' +
        'else:\n' +
        '    print("Leave the umbrella at home.")\n',
      challenge:
        'Add a temperature variable, then use elif so it prints "Wear a coat!" when it is not raining but the temperature is below 10.',
      hint:
        'Between the if and the else, add a new branch: elif temperature < 10: with its own indented print line. Set temperature = 5 to test it.',
    },
    guide: [
      {
        step: 'Ask a yes/no question',
        body:
          'Start with if and a comparison, like if score >= 50:. This is the question Python will answer as True or False.',
      },
      {
        step: 'Indent what happens when yes',
        body:
          'Put the lines to run under the if, all indented by the same 4 spaces. Python runs them only when the answer is True.',
      },
      {
        step: 'Add else for the other path',
        body:
          'else: with an indented block runs whenever the if was False. Now one of the two paths always runs.',
      },
      {
        step: 'Slot in elif for extra paths',
        body:
          'Need more than two options? Add elif question: branches between if and else. Python stops at the first True one.',
      },
      {
        step: 'Mind the order and the equals',
        body:
          'Put the strictest test first, and use == to compare (two equals), not = which stores a value.',
      },
      {
        step: 'Nest to ask follow-ups',
        body:
          'Put an if inside another if, indented one level deeper, to ask a second question only after the first passes.',
      },
    ],
    takeaways: [
      'A condition is a True/False question that chooses which code runs.',
      'if / elif / else pick exactly one path — never zero, never two.',
      'Comparison operators (==, !=, <, >, <=, >=) ask the questions.',
      'Indentation shows which lines belong to each branch.',
      'A nested if asks a follow-up only after the outer question is True.',
    ],
  },

  'boolean logic': {
    title: 'Boolean Logic',
    tagline: 'Reasoning with just True and False.',
    intro:
      'Boolean logic is the maths of yes and no. Every value in it is one of only two things: True or False. Named after the thinker George Boole, it is the secret engine behind every decision a computer makes. Once you can combine True and False with and, or and not, you can ask your program exactly the right question — no more, no less.',
    sections: [
      {
        heading: 'True and False are values',
        body:
          'True and False are not text — they are a special type called bool. You can store them in variables just like numbers, and Python treats them as the answers to yes/no questions.',
        bullets: [
          'Write them with a capital letter: True and False (not "true").',
          'Store them like anything else: is_ready = True.',
          'They have their own type: type(True) is <class \'bool\'>.',
        ],
      },
      {
        heading: 'Comparisons make booleans',
        body:
          'Every comparison you write actually produces a boolean. When you type 5 > 3, Python quietly works it out to True and hands that back. That is why comparisons fit so neatly inside if statements.',
        bullets: [
          '10 > 3 becomes True; 3 > 10 becomes False.',
          'You can store the result: passed = score >= 50.',
          'Print one to see it: print(7 == 7) shows True.',
        ],
      },
      {
        heading: 'and — both must be True',
        body:
          'and joins two conditions and is only True when BOTH sides are True. If either side is False, the whole thing is False. It is like a strict club with two entry rules.',
        bullets: [
          'age > 8 and age < 13 is True only for ages 9, 10, 11, 12.',
          'This "between two numbers" pattern is a range check.',
          'If the first side is False, the answer is already False.',
        ],
      },
      {
        heading: 'or — at least one must be True',
        body:
          'or is the easy-going one: it is True when AT LEAST ONE side is True. It is only False when both sides are False.',
        bullets: [
          'day == "Sat" or day == "Sun" is True on either weekend day.',
          'or is friendlier than and — it says yes more often.',
          'Only two falses make an or False.',
        ],
      },
      {
        heading: 'not — flip the answer',
        body:
          'not takes a single boolean and turns it upside down: True becomes False, and False becomes True. It is handy for asking "when this is NOT the case".',
        bullets: [
          'not True is False; not False is True.',
          'if not game_over: means "while the game is still going".',
          'You can combine all three: has_key and not is_locked.',
        ],
      },
      {
        heading: 'Truthiness: a quick peek',
        body:
          'Python also lets some non-boolean values stand in for True or False in a condition. This is called truthiness, and it is a handy shortcut once you know it.',
        bullets: [
          'Empty things are "falsy": 0, "" (empty text), and [] (empty list).',
          'Anything with something in it is "truthy": 5, "hi", [1, 2].',
          'So if name: means "if name is not empty".',
        ],
      },
    ],
    snippet: {
      language: 'python',
      lines: [
        'age = 11',
        'has_ticket = True',
        '',
        '# A range check with and',
        'is_kid_price = age > 8 and age < 13',
        'print("Kid price?", is_kid_price)',
        '',
        '# Combine conditions to decide entry',
        'if has_ticket and not age < 6:',
        '    print("Enjoy the ride!")',
        'else:',
        '    print("Sorry, you cannot board.")',
      ],
      caption: 'Comparisons become booleans, then and / not combine them into a decision.',
    },
    tryIt: {
      language: 'python',
      starter:
        '# Combine two true/false values.\n' +
        'sunny = True\n' +
        'warm = True\n' +
        '\n' +
        'if sunny and warm:\n' +
        '    print("Perfect for the beach!")\n' +
        'else:\n' +
        '    print("Maybe stay inside.")\n',
      challenge:
        'Change the code so the beach message shows when it is sunny OR warm (you do not need both). Then try setting one of them to False and predict the result before you Run.',
      hint:
        'Swap the word and for or in the if line. With or, only one of the two needs to be True for the message to appear.',
    },
    guide: [
      {
        step: 'Meet True and False',
        body:
          'Booleans have exactly two values, written with capitals: True and False. They are the answers to yes/no questions.',
      },
      {
        step: 'See comparisons make booleans',
        body:
          'Every comparison like 5 > 3 works out to True or False. You can even store that answer in a variable.',
      },
      {
        step: 'Use and for "both"',
        body:
          'a and b is True only when both a and b are True. Great for range checks like age > 8 and age < 13.',
      },
      {
        step: 'Use or for "either"',
        body:
          'a or b is True when at least one side is True. It says yes more easily than and.',
      },
      {
        step: 'Use not to flip',
        body:
          'not turns True into False and False into True. if not finished: means "while it is not finished".',
      },
      {
        step: 'Drop them into decisions',
        body:
          'Because if needs a True/False answer, booleans and the words and/or/not are what power every decision.',
      },
    ],
    takeaways: [
      'Booleans are the type with only two values: True and False.',
      'Comparisons like > and == produce booleans behind the scenes.',
      'and needs both sides True; or needs at least one; not flips the answer.',
      'age > 8 and age < 13 is the classic "between two numbers" range check.',
      'Empty values (0, "", []) count as falsy; filled ones count as truthy.',
    ],
  },

  'problem solving': {
    title: 'Problem Solving',
    tagline: 'Think like a programmer, one step at a time.',
    intro:
      'The biggest secret in coding is not memorising commands — it is learning how to think. Programmers take a big, scary problem and quietly break it into small steps so simple that a computer could follow them. That ordered list of steps is called an algorithm. Master this way of thinking and you can solve problems you have never seen before.',
    sections: [
      {
        heading: 'The four-step method',
        body:
          'Great problem-solvers do not leap straight to code. They follow a rhythm that keeps them out of trouble: understand, plan, code, then test. Skipping the first two is why code so often breaks.',
        bullets: [
          'Understand: what exactly must the program do? What comes in, what goes out?',
          'Plan: list the steps in plain words — this is your algorithm.',
          'Code: translate each step into Python, one line at a time.',
          'Test: run it with example values and check the answers are right.',
        ],
      },
      {
        heading: 'Write pseudocode first',
        body:
          'Pseudocode is a plan written in plain language that looks a little like code but breaks no rules. It lets you think about the steps without worrying about exact Python syntax yet.',
        bullets: [
          'Use everyday words: "if the score is over 90, print gold star".',
          'One idea per line, in the order it should happen.',
          'When the plan feels right, swap each line for real Python.',
        ],
      },
      {
        heading: 'Break the problem down',
        body:
          'A big problem is really lots of tiny problems hiding together. Splitting it up — a skill called decomposition — turns "impossible" into a to-do list you can tick off.',
        bullets: [
          'Ask: what is the very first small thing I need?',
          'Solve that, then ask what comes next.',
          'Small wins stack up into the whole solution.',
        ],
      },
      {
        heading: 'Worked example: largest of three numbers',
        body:
          'Imagine you must find the biggest of three numbers a, b and c. In plain words: first find the bigger of a and b, remember it, then compare that winner against c. Whichever is bigger is your answer. Notice we solved a two-number problem first, then reused it.',
        bullets: [
          'Plan: biggest = a if a > b else b, then compare biggest with c.',
          'Each comparison is one small, testable step.',
          'Test with numbers where you already know the answer, like 4, 9, 2.',
        ],
      },
      {
        heading: 'Always test with examples',
        body:
          'A plan is only a guess until you try it. Run your code with values where you already know the right answer, then check. If it is wrong, you have found a bug to fix — that is progress, not failure.',
        bullets: [
          'Pick easy examples first (largest of 4, 9, 2 should be 9).',
          'Then try tricky ones: what if two numbers are equal?',
          'A wrong answer tells you exactly which step to revisit.',
        ],
      },
    ],
    snippet: {
      language: 'python',
      lines: [
        '# Goal: find the largest of three numbers',
        '# Plan: compare a with b, then the winner with c',
        'a = 4',
        'b = 9',
        'c = 2',
        '',
        'if a >= b and a >= c:',
        '    print("Largest:", a)',
        'elif b >= c:',
        '    print("Largest:", b)',
        'else:',
        '    print("Largest:", c)',
      ],
      caption: 'A plain-words plan turned into if/elif — the largest number wins exactly one branch.',
    },
    tryIt: {
      language: 'python',
      starter:
        '# Start small: find the biggest of TWO numbers.\n' +
        'a = 4\n' +
        'b = 9\n' +
        '\n' +
        'if a > b:\n' +
        '    print(a)\n' +
        'else:\n' +
        '    print(b)\n',
      challenge:
        'Add a third number c and print the biggest of all three. Write your plan as a comment first, then turn it into code.',
      hint:
        'Reuse what you have: find the bigger of a and b and store it in a variable called biggest, then compare biggest with c using another if/else.',
    },
    guide: [
      {
        step: 'Understand the goal',
        body:
          'Say in one clear sentence what the program must do, and what information goes in and comes out. You cannot solve a problem you have not defined.',
      },
      {
        step: 'Write the plan in words',
        body:
          'List the steps as pseudocode — plain language, one idea per line, in order. No Python rules to worry about yet.',
      },
      {
        step: 'Break it into small pieces',
        body:
          'Split the plan into the smallest steps you can. Solve the easiest piece first, then build on it.',
      },
      {
        step: 'Translate each step to code',
        body:
          'Turn one pseudocode line at a time into real Python. Keep the code and the plan side by side.',
      },
      {
        step: 'Test with known answers',
        body:
          'Run it using examples where you already know the result. Compare what you got with what you expected.',
      },
      {
        step: 'Fix and repeat',
        body:
          'A wrong answer points at the step to revisit. Adjust, run again, and keep going until it is right.',
      },
    ],
    takeaways: [
      'Problem solving is a process: understand, plan, code, then test.',
      'An algorithm is just an ordered list of small, clear steps.',
      'Write pseudocode in plain words before you write real Python.',
      'Break a big problem into tiny problems you can solve one by one.',
      'Test with examples whose answers you already know — bugs are clues, not failures.',
    ],
  },
}

export default lessons

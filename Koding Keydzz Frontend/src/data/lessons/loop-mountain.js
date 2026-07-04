// Loop Mountain — fully authored topic lessons.
//
// Same schema and quality bar as coding-forest.js (see ./index.js): title,
// tagline, intro, sections, snippet, tryIt, guide, takeaways. Rich, correct,
// kid-friendly (8–16yo) Python content. Every snippet and tryIt is real,
// runnable Python 3.
//
// Topic keys are lower-case so getLesson() can match whatever casing the API
// sends for world.topics ("For Loops", "While Loops", "Nested Loops").

const lessons = {
  'for loops': {
    title: 'For Loops',
    tagline: 'Repeat an exact number of times without copy-pasting.',
    intro:
      'A for loop repeats a block of code a set number of times. When you already know how many steps to take — like climbing 10 stairs or greeting every friend in a list — a for loop does the counting and the walking for you. Instead of writing the same line ten times, you write it once and let the loop run it again and again.',
    sections: [
      {
        heading: 'The shape of a for loop',
        body:
          'A for loop has three parts: the word for, a loop variable, and a collection of things to walk through. Write for i in range(5): and Python runs the indented block five times. The colon and the indentation together tell Python exactly which lines belong to the loop.',
        bullets: [
          'for i in range(5): repeats the indented block five times.',
          'The loop variable (often i) holds the current value each time around.',
          'Everything indented under the for line is the loop body — it repeats.',
          'Do not forget the colon : at the end of the for line.',
        ],
      },
      {
        heading: 'range() makes number sequences',
        body:
          'range() is the loop\'s best friend — it hands the loop a run of numbers. It comes in three flavours depending on how many values you give it.',
        bullets: [
          'range(5) counts 0, 1, 2, 3, 4 — it starts at 0 and STOPS BEFORE 5.',
          'range(1, 6) counts 1, 2, 3, 4, 5 — from start up to (but not including) stop.',
          'range(0, 10, 2) counts 0, 2, 4, 6, 8 — the third number is the step (jump size).',
          'range(10, 0, -1) counts down 10, 9, 8 … 1 using a negative step.',
        ],
      },
      {
        heading: 'Looping over lists and strings',
        body:
          'A for loop does not only count numbers. It can walk straight through the items of a list or the letters of a string, handing you one item at a time — no range() needed.',
        bullets: [
          'for pet in ["cat", "dog", "fox"]: gives pet each animal in turn.',
          'for letter in "hi": gives letter as "h", then "i".',
          'The loop variable holds the actual item, not a position number.',
          'Use range(len(mylist)) only when you truly need the index.',
        ],
      },
      {
        heading: 'Accumulating a total',
        body:
          'One of the most useful loop patterns is building up an answer as you go. You start a variable OUTSIDE the loop, then add to it INSIDE the loop each time around. This is called accumulating.',
        bullets: [
          'Start the total before the loop: total = 0.',
          'Add to it each time inside the loop: total = total + number.',
          'After the loop finishes, total holds the whole sum.',
          'The same trick counts things (count = count + 1) or joins text.',
        ],
      },
      {
        heading: 'Common mistakes to dodge',
        body:
          'Almost every new coder hits these snags. Spotting them early saves a lot of red errors.',
        bullets: [
          'Off-by-one: range(1, 5) stops at 4, not 5. Add one to the stop to include it.',
          'Forgetting the colon : at the end of the for line breaks the loop.',
          'Wrong indentation — the body must be indented, and all lines the same amount.',
          'Resetting the total inside the loop wipes your running answer every time.',
        ],
      },
    ],
    snippet: {
      language: 'python',
      lines: [
        '# Climb five steps, counting as we go',
        'for step in range(1, 6):',
        '    print("Climbing step", step)',
        '',
        '# Add up the numbers 1 to 5 with an accumulator',
        'total = 0',
        'for number in range(1, 6):',
        '    total = total + number',
        '',
        'print("Total climb:", total)   # 1+2+3+4+5 = 15',
      ],
      caption: 'range(1, 6) gives 1..5; the total box grows by each number.',
    },
    tryIt: {
      language: 'python',
      starter:
        '# Print each number from 1 to 5.\n' +
        'for i in range(1, 6):\n' +
        '    print(i)\n',
      challenge:
        'Add up all the numbers from 1 to 10 using a total variable, then print the final total (it should be 55).',
      hint:
        'Start total = 0 BEFORE the loop. Loop with range(1, 11). Inside, write total = total + i. Print total AFTER the loop, not inside it.',
    },
    guide: [
      {
        step: 'Write the for line',
        body:
          'Start with for, a loop variable, in, and something to walk through: for i in range(5):. End it with a colon.',
      },
      {
        step: 'Indent the body',
        body:
          'The code you want repeated is indented under the for line. Everything at that indent runs once per loop.',
      },
      {
        step: 'Pick the right range',
        body:
          'range(n) counts 0..n-1. Use range(start, stop) to choose where it begins, and a third number for the step size.',
      },
      {
        step: 'Use the loop variable',
        body:
          'Each time around, the loop variable holds the current value — a number from range(), or the current item of a list or string.',
      },
      {
        step: 'Accumulate outside, add inside',
        body:
          'To build a total, make total = 0 before the loop, then total = total + value inside it. Read the answer after the loop ends.',
      },
      {
        step: 'Watch the boundaries',
        body:
          'Remember range stops one BEFORE the stop number. If you want to include it, add one to the stop.',
      },
    ],
    takeaways: [
      'Use a for loop when you know how many times to repeat.',
      'range(n) counts 0 to n-1; range(start, stop, step) gives you full control.',
      'A for loop can walk over a list or string, item by item.',
      'Accumulate a total by starting at 0 and adding inside the loop.',
      'Watch for off-by-one errors — range stops just before the stop value.',
    ],
  },

  'while loops': {
    title: 'While Loops',
    tagline: 'Keep going until a condition stops being true.',
    intro:
      'A while loop repeats as long as a condition stays true. Use it when you do not know the exact number of repeats in advance — you only know the goal that ends the loop. "Keep asking until the answer is right" or "keep climbing while there is daylight" are perfect while-loop jobs.',
    sections: [
      {
        heading: 'The shape of a while loop',
        body:
          'Write while condition: and Python checks the condition. If it is True, it runs the indented body, then checks again. It keeps looping until the condition becomes False, then moves on. The condition is checked at the TOP, before every single pass.',
        bullets: [
          'while count > 0: repeats while count is greater than 0.',
          'The condition is a yes/no (True/False) test.',
          'Python re-checks the condition before every loop.',
          'When the condition is False, the loop stops and the program continues.',
        ],
      },
      {
        heading: 'Using a counter',
        body:
          'A very common pattern is a counter — a variable you set before the loop and change inside it. The counter is what eventually makes the condition False so the loop can end.',
        bullets: [
          'Set the counter before the loop: count = 5.',
          'Check it in the condition: while count > 0:.',
          'Change it inside the loop: count = count - 1 (or count -= 1).',
          'Without changing the counter, the condition never flips and the loop never ends.',
        ],
      },
      {
        heading: 'When while beats for',
        body:
          'A for loop is best when you know the count up front. A while loop shines when you do NOT — when the number of repeats depends on what happens while the program runs.',
        bullets: [
          'Keep asking the player until they type the correct password.',
          'Keep rolling a dice until you get a six.',
          'Repeat a menu until the user chooses "quit".',
          'In short: for = known count, while = repeat until something happens.',
        ],
      },
      {
        heading: 'break and continue',
        body:
          'Two special words give you extra control inside any loop. break jumps out immediately, and continue skips to the next pass.',
        bullets: [
          'break stops the loop right away, even if the condition is still true.',
          'continue skips the rest of this pass and jumps back to the condition.',
          'break is handy for "stop as soon as we find it" searches.',
          'Use them sparingly — too many can make a loop hard to follow.',
        ],
      },
      {
        heading: 'Infinite loops (and how to avoid them)',
        body:
          'An infinite loop is one that never stops because its condition never becomes False. It is the number-one while-loop bug. The cure is simple: make sure something inside the loop moves the condition toward False.',
        bullets: [
          'while True: with no break inside runs forever.',
          'Forgetting to update the counter (count = count - 1) loops forever.',
          'Always ask: "what makes this loop STOP?" before you run it.',
          'If a program hangs, an infinite loop is usually the culprit.',
        ],
      },
    ],
    snippet: {
      language: 'python',
      lines: [
        '# A countdown using a counter',
        'count = 3',
        'while count > 0:',
        '    print("Countdown:", count)',
        '    count = count - 1   # this is what ends the loop',
        '',
        'print("Blast off!")',
      ],
      caption: 'count shrinks each pass until count > 0 becomes False.',
    },
    tryIt: {
      language: 'python',
      starter:
        '# Count down from 5 to 1.\n' +
        'count = 5\n' +
        'while count > 0:\n' +
        '    print(count)\n' +
        '    count = count - 1\n',
      challenge:
        'Change it to count UP from 1 to 5 instead — print 1, 2, 3, 4, 5, one per line.',
      hint:
        'Start count at 1. Loop while count <= 5. Print count, then add one with count = count + 1. Make sure the counter changes, or the loop never ends!',
    },
    guide: [
      {
        step: 'Write the condition',
        body:
          'Start with while and a yes/no test, then a colon: while count > 0:. Python runs the body only while the test is True.',
      },
      {
        step: 'Set up before the loop',
        body:
          'Give the condition something to check. A counter set before the loop, like count = 5, is the classic setup.',
      },
      {
        step: 'Change something inside',
        body:
          'Update the variable the condition checks — count = count - 1. This is what lets the loop eventually stop.',
      },
      {
        step: 'Know when to reach for while',
        body:
          'Pick while over for when you do not know the number of repeats ahead of time, like asking until the answer is right.',
      },
      {
        step: 'Steer with break and continue',
        body:
          'break leaves the loop immediately; continue skips to the next check. Use them to handle special cases neatly.',
      },
      {
        step: 'Avoid the infinite loop',
        body:
          'Before running, ask "what makes this stop?" If nothing moves the condition toward False, the loop runs forever.',
      },
    ],
    takeaways: [
      'A while loop repeats while its condition stays true.',
      'Use it when you do not know the number of repeats ahead of time.',
      'A counter that changes inside the loop is what lets it end.',
      'break exits the loop now; continue skips to the next pass.',
      'Always give a while loop a way to stop, or it runs forever.',
    ],
  },

  'nested loops': {
    title: 'Nested Loops',
    tagline: 'A loop inside a loop for grids, rows and patterns.',
    intro:
      'A nested loop is a loop inside another loop. The inner loop finishes completely for every single step of the outer loop — like a clock where the minute hand sweeps all the way around for each single move of the hour hand. Nested loops are how you build grids, tables and patterns.',
    sections: [
      {
        heading: 'Loops within loops',
        body:
          'Put one loop in the body of another and you have a nested loop. For every turn of the outer loop, the inner loop runs all the way through from start to finish. The inner loop is indented one level deeper than the outer loop.',
        bullets: [
          'The outer loop is the slow hand; the inner loop is the fast hand.',
          'The inner loop runs FULLY for each single outer step.',
          'The inner loop is indented inside the outer loop.',
          'Think outer = rows, inner = columns.',
        ],
      },
      {
        heading: 'Iterations multiply',
        body:
          'The total number of times the innermost body runs is the outer count TIMES the inner count. This is why nested loops are so powerful — and why they can get slow if the counts are big.',
        bullets: [
          '3 outer steps × 4 inner steps = 12 runs of the inner body.',
          'A 5×5 grid means the inner line runs 25 times.',
          'More nesting multiplies further: 10×10×10 is 1000 runs.',
          'Small grids are instant; huge ones can be slow, so choose sizes wisely.',
        ],
      },
      {
        heading: 'Building grids and patterns',
        body:
          'To draw a grid you print each cell with the inner loop, then move to a new line after each row. The trick is print("*", end=" ") which stays on the same line, and a bare print() to break to the next row.',
        bullets: [
          'end=" " keeps print on the same line, adding a space instead of a newline.',
          'A bare print() after the inner loop starts a fresh row.',
          'Outer loop = one pass per row; inner loop = one cell per column.',
          'Swap the star for numbers or letters to make different patterns.',
        ],
      },
      {
        heading: 'A times table',
        body:
          'Nested loops are perfect for a multiplication table. The outer loop picks a row number, the inner loop picks a column number, and you print row times column in each cell.',
        bullets: [
          'Outer variable = the first number, inner variable = the second.',
          'Print row * col to fill each cell of the table.',
          'range(1, 6) for both gives a neat 5×5 table.',
          'The inner loop rebuilds a full row for every outer number.',
        ],
      },
    ],
    snippet: {
      language: 'python',
      lines: [
        '# A 3x3 grid of stars',
        'for row in range(3):',
        '    for col in range(3):',
        '        print("*", end=" ")   # stay on the same line',
        '    print()                   # new line after each row',
      ],
      caption: 'Outer loop makes rows; inner loop fills each row with columns.',
    },
    tryIt: {
      language: 'python',
      starter:
        '# Print a small grid of stars.\n' +
        'for row in range(3):\n' +
        '    for col in range(3):\n' +
        '        print("*", end=" ")\n' +
        '    print()\n',
      challenge:
        'Change the grid to 5 rows by 5 columns, then try replacing "*" with the number row * col to make a pattern.',
      hint:
        'Change both range(3) values to range(5). To show numbers instead of stars, use print(row * col, end=" ") in the inner loop.',
    },
    guide: [
      {
        step: 'Put a loop inside a loop',
        body:
          'Write your outer loop, then indent a second loop inside its body. That inner loop is now nested.',
      },
      {
        step: 'Understand the order',
        body:
          'For every single step of the outer loop, the inner loop runs all the way through before the outer loop moves on.',
      },
      {
        step: 'Count the iterations',
        body:
          'The inner body runs outer × inner times. A 4×3 nest runs the inner line 12 times in total.',
      },
      {
        step: 'Use end=" " for a row',
        body:
          'print("*", end=" ") stays on the same line so a whole row prints across, instead of one item per line.',
      },
      {
        step: 'Break to the next row',
        body:
          'After the inner loop, a bare print() drops to a new line, starting the next row of your grid.',
      },
      {
        step: 'Swap in your own pattern',
        body:
          'Replace the star with numbers, letters, or row * col to turn the same grid into tables and patterns.',
      },
    ],
    takeaways: [
      'A nested loop is a loop inside another loop.',
      'The inner loop runs fully for each single step of the outer loop.',
      'Total inner runs = outer count × inner count.',
      'Outer loop makes rows, inner loop makes columns — perfect for grids.',
      'end=" " keeps a row on one line; a bare print() starts the next row.',
    ],
  },
}

export default lessons

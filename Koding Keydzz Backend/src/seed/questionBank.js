/**
 * THE FINAL-TEST QUESTION BANK — a starter set for all four courses.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The bank was empty. Every course's content, ladder and marking worked, and
 * the final test could not be sat AT ALL: `drawSection` throws "the question
 * bank is too small" when a section's pool is smaller than the paper needs. A
 * pupil who finished every lesson, quiz and game level pressed Start and got an
 * error. The ladder was broken at its first rung.
 *
 * DELIBERATELY NOT THE QUIZ QUESTIONS
 * -----------------------------------
 * These are written fresh against the same lesson objectives. Reusing the
 * practice quizzes would turn the final test into a memory check of the
 * quizzes — a pupil could pass by recalling answers rather than understanding
 * the material, which is precisely what a closed-book paper exists to prevent.
 *
 * SIZED FOR A REAL DRAW
 * ---------------------
 * Roughly TWICE what a paper needs per section. `drawSection` prefers questions
 * a pupil has not seen, so a bank sized exactly to the paper hands every pupil
 * an identical test and makes a re-sit a repeat. Two attempts' worth of surplus
 * is the minimum that makes the randomness meaningful.
 *
 * This is a STARTER bank, not a finished one. The superadmin's Question Bank
 * screen reports per-section coverage precisely so it can be grown, and more
 * questions strictly improve the draw.
 *
 * MARK SCHEMES LIVE HERE. Everything in this file is the answer key —
 * `answerIndex`, `acceptedAnswers`, `testCases`, `checks`. The student-facing
 * serialiser strips all of it; nothing here is safe to send to a pupil.
 */

/* -------------------------------------------------------------------------- */
/* Helpers — keep the question lists readable                                 */
/* -------------------------------------------------------------------------- */

const mcq = (prompt, options, answerIndex, difficulty = 'basic') => ({
  type: 'mcq',
  difficulty,
  prompt,
  options,
  answerIndex,
});

const blank = (prompt, acceptedAnswers, difficulty = 'basic') => ({
  type: 'fillblank',
  difficulty,
  prompt,
  acceptedAnswers,
});

const coding = (prompt, language, testCases, difficulty = 'basic', starterCode = '') => ({
  type: 'coding',
  difficulty,
  prompt,
  language,
  starterCode,
  testCases,
});

const task = (prompt, expectedOutcome, checks, difficulty = 'basic') => ({
  type: 'task',
  difficulty,
  prompt,
  expectedOutcome,
  checks,
});

/* ========================================================================== */
/* PYTHON — a code paper: 10 mcq, 10 fill-in, 3 coding (basic), 1 (advanced)  */
/* ========================================================================== */

const PYTHON = [
  // ---- multiple choice (need 10, have 20) ----
  mcq('What does `len("hello")` return?', ['5', '4', '"hello"', '6'], 0),
  mcq('Which of these creates a list?', ['[1, 2, 3]', '(1, 2, 3)', '{1: 2}', '"123"'], 0),
  mcq('What is the result of `7 // 2` in Python?', ['3', '3.5', '4', '1'], 0),
  mcq('What does `range(3)` produce?', ['0, 1, 2', '1, 2, 3', '0, 1, 2, 3', '3'], 0),
  mcq('Which keyword defines a function?', ['def', 'func', 'function', 'define'], 0),
  mcq('What type is `3.0`?', ['float', 'int', 'str', 'bool'], 0),
  mcq('How do you add an item to the end of a list called `xs`?', ['xs.append(item)', 'xs.add(item)', 'xs.push(item)', 'xs + item'], 0),
  mcq('What does `"abc".upper()` return?', ['"ABC"', '"abc"', 'True', 'an error'], 0),
  mcq('Which comparison is TRUE?', ['3 != 4', '3 == 4', '3 > 4', '3 >= 4'], 0),
  mcq('What does an `if` block need at the end of its header line?', ['a colon', 'a semicolon', 'nothing', 'braces'], 0),
  mcq('What happens if you index a list past its end?', ['an IndexError', 'it returns None', 'it returns 0', 'it wraps around'], 0),
  mcq('What does `bool("")` return?', ['False', 'True', '""', 'an error'], 0),
  mcq('Which loop runs while a condition stays true?', ['while', 'for', 'do', 'repeat'], 0),
  mcq('What does a function return if it has no `return` statement?', ['None', '0', 'an empty string', 'an error'], 0),
  mcq('How do you write a comment in Python?', ['# like this', '// like this', '/* like this */', '-- like this'], 0),
  mcq('What is `type([])`?', ['list', 'tuple', 'dict', 'set'], 0),
  mcq('What does `"a,b,c".split(",")` return?', ["['a', 'b', 'c']", '"abc"', "['a,b,c']", 'an error'], 0),
  mcq('Which is a valid variable name?', ['total_2', '2total', 'total-2', 'class'], 0),
  mcq('What does `x += 3` do when x is 5?', ['makes x 8', 'makes x 3', 'makes x 15', 'raises an error'], 0),
  mcq('How many times does `for i in range(2, 5)` loop?', ['3', '4', '5', '2'], 0),

  // ---- fill in the blank (need 10, have 20) ----
  blank('The function that shows something on the screen is ____().', ['print']),
  blank('A value that is only True or False is a ____.', ['boolean', 'bool']),
  blank('The keyword that stops a loop early is ____.', ['break']),
  blank('The keyword that skips to the next pass of a loop is ____.', ['continue']),
  blank('`5 % 2` gives ____.', ['1']),
  blank('The function that turns text into a whole number is ____().', ['int']),
  blank('A block of code inside a loop must be ____.', ['indented', 'indent']),
  blank('The function that asks the user to type something is ____().', ['input']),
  blank('`len([1, 2, 3, 4])` is ____.', ['4']),
  blank('The keyword that gives a value back from a function is ____.', ['return']),
  blank('`"ab" * 2` gives ____.', ['abab', '"abab"']),
  blank('The first index of a Python list is ____.', ['0', 'zero']),
  blank('The type used for whole numbers is ____.', ['int', 'integer']),
  blank('A collection written with curly braces and key: value pairs is a ____.', ['dict', 'dictionary']),
  blank('The keyword used for "otherwise, if" is ____.', ['elif']),
  blank('`3 ** 2` gives ____.', ['9']),
  blank('The function that gives the number of items in a list is ____().', ['len']),
  blank('`float("2.5")` gives ____.', ['2.5']),
  blank('The value that means "nothing here" in Python is ____.', ['None', 'none']),
  blank('To make a comment span a whole line, start it with ____.', ['#', 'a hash', 'hash']),

  // ---- coding, basic (need 3, have 6) ----
  coding(
    'Print the word hello (all lower case, on its own line).',
    'python',
    [{ stdin: '', expectedOutput: 'hello', visible: true }],
    'basic',
    '# Print hello\n'
  ),
  coding(
    'Read one whole number from the input and print double it.',
    'python',
    [
      { stdin: '5', expectedOutput: '10', visible: true },
      { stdin: '21', expectedOutput: '42', visible: false },
    ],
    'basic',
    '# Read a number, print double it\n'
  ),
  coding(
    'Print the numbers 1 to 5, one per line.',
    'python',
    [{ stdin: '', expectedOutput: '1\n2\n3\n4\n5', visible: true }],
    'basic',
    '# Print 1 to 5\n'
  ),
  coding(
    'Read one number and print "even" if it is even, otherwise "odd".',
    'python',
    [
      { stdin: '4', expectedOutput: 'even', visible: true },
      { stdin: '7', expectedOutput: 'odd', visible: false },
    ],
    'basic',
    '# even or odd\n'
  ),
  coding(
    'Read one number n and print the sum of 1 to n.',
    'python',
    [
      { stdin: '5', expectedOutput: '15', visible: true },
      { stdin: '10', expectedOutput: '55', visible: false },
    ],
    'basic',
    '# sum 1 to n\n'
  ),
  coding(
    'Read a word and print it backwards.',
    'python',
    [
      { stdin: 'cat', expectedOutput: 'tac', visible: true },
      { stdin: 'python', expectedOutput: 'nohtyp', visible: false },
    ],
    'basic',
    '# print the word backwards\n'
  ),

  // ---- coding, advanced (need 1, have 3) ----
  coding(
    'Read one number n, then print the n times table from 1 to 10 in the form "3 x 1 = 3" — one line per row.',
    'python',
    [
      { stdin: '2', expectedOutput: '2 x 1 = 2\n2 x 2 = 4\n2 x 3 = 6\n2 x 4 = 8\n2 x 5 = 10\n2 x 6 = 12\n2 x 7 = 14\n2 x 8 = 16\n2 x 9 = 18\n2 x 10 = 20', visible: true },
      { stdin: '5', expectedOutput: '5 x 1 = 5\n5 x 2 = 10\n5 x 3 = 15\n5 x 4 = 20\n5 x 5 = 25\n5 x 6 = 30\n5 x 7 = 35\n5 x 8 = 40\n5 x 9 = 45\n5 x 10 = 50', visible: false },
    ],
    'advanced',
    '# Print the n times table\n'
  ),
  coding(
    'Read one number n and print how many of the numbers from 1 to n are multiples of BOTH 3 and 5.',
    'python',
    [
      { stdin: '30', expectedOutput: '2', visible: true },
      { stdin: '100', expectedOutput: '6', visible: false },
    ],
    'advanced',
    '# count multiples of 3 and 5\n'
  ),
  coding(
    'Read a sentence and print how many words it contains.',
    'python',
    [
      { stdin: 'the cat sat down', expectedOutput: '4', visible: true },
      { stdin: 'hello world', expectedOutput: '2', visible: false },
    ],
    'advanced',
    '# count the words\n'
  ),
];

/* ========================================================================== */
/* C — a code paper                                                           */
/* ========================================================================== */

const C = [
  mcq('What does every C program need in order to start?', ['a function called main', 'a class', 'an import list', 'a header called start.h'], 0),
  mcq('Which header must you include to use printf?', ['stdio.h', 'stdlib.h', 'string.h', 'math.h'], 0),
  mcq('What character ends a C statement?', ['a semicolon', 'a colon', 'a newline', 'a full stop'], 0),
  mcq('What is `7 / 2` when both are ints?', ['3', '3.5', '4', '1'], 0),
  mcq('Which placeholder prints an int?', ['%d', '%f', '%c', '%s'], 0),
  mcq('Why does scanf need an & before a variable?', ['so it gets the address and can change it', 'to mark the end of input', 'it is optional', 'to make it faster'], 0),
  mcq('What does `int n = 3.9;` store in n?', ['3', '4', '3.9', 'nothing — it will not compile'], 0),
  mcq('Which operator compares two values for equality?', ['==', '=', '!=', '<='], 0),
  mcq('What happens if a switch case has no `break`?', ['the next case runs too', 'the program stops', 'nothing runs', 'it will not compile'], 0),
  mcq('For `int a[5]`, what is the last valid index?', ['4', '5', '6', '0'], 0),
  mcq('What is a pointer?', ['a variable holding a memory address', 'a copy of a value', 'a type name', 'a kind of loop'], 0),
  mcq('How many chars does the string "cat" occupy?', ['4', '3', '5', '1'], 0),
  mcq('In C, which values count as true?', ['every number except 0', 'only 1', 'only true', 'only positive numbers'], 0),
  mcq('What does `void` as a return type mean?', ['the function returns nothing', 'it returns zero', 'it takes no parameters', 'it never ends'], 0),
  mcq('What must follow a struct definition\'s closing brace?', ['a semicolon', 'nothing', 'a comma', 'the word end'], 0),
  mcq('How do you reach a member of a struct variable `p`?', ['p.member', 'p->member always', 'p[member]', 'member(p)'], 0),
  mcq('What does `%` do?', ['gives the remainder', 'gives a percentage', 'divides', 'multiplies'], 0),
  mcq('How many times does `for (int i = 0; i < 4; i++)` loop?', ['4', '3', '5', '0'], 0),
  mcq('What is a compile error?', ['your code could not be translated, so nothing ran', 'the program crashed while running', 'a warning', 'a slow program'], 0),
  mcq('Which is the correct way to declare two ints?', ['int a, b;', 'int a; int b', 'int a and b;', 'a, b : int;'], 0),

  blank('The type used for a single character is ____.', ['char']),
  blank('`return 0;` at the end of main means the program finished with no ____.', ['problems', 'errors', 'error', 'problem']),
  blank('To read a double with scanf you use the placeholder ____.', ['%lf']),
  blank('The operator that gives you the address of a variable is ____.', ['&', 'ampersand']),
  blank('`count++` adds ____ to count.', ['1', 'one']),
  blank('A C string is an array of char ending in the ____ character.', ['\\0', 'null', 'zero', 'terminator']),
  blank('The keyword that leaves a loop immediately is ____.', ['break']),
  blank('The label in a switch that catches every unlisted value is ____.', ['default']),
  blank('A do-while loop always runs its body at least ____ time(s).', ['1', 'one', 'once']),
  blank('The type used for decimal numbers with more precision than float is ____.', ['double']),
  blank('`7 % 2` gives ____.', ['1']),
  blank('To make `7 / 2` give 3.5 you must ____ one side to a double.', ['cast', 'convert', 'change']),
  blank('The one-line declaration of a function above main is called a ____.', ['prototype', 'declaration']),
  blank('C spells "otherwise if" as ____ (two words).', ['else if']),
  blank('`*p` reads the value ____ the address in p.', ['at', 'stored at']),
  blank('The keyword that groups related values under one name is ____.', ['struct']),
  blank('Arguments are passed to a C function as ____.', ['copies', 'a copy']),
  blank('`sizeof(char)` is always ____.', ['1']),
  blank('Comments in C start with /* and end with ____.', ['*/']),
  blank('C ignores your ____, unlike Python.', ['indentation', 'indent', 'whitespace']),

  coding(
    'Print the word hello (all lower case, on its own line).',
    'c',
    [{ stdin: '', expectedOutput: 'hello', visible: true }],
    'basic',
    '#include <stdio.h>\n\nint main(void) {\n    \n    return 0;\n}\n'
  ),
  coding(
    'Read one whole number and print double it.',
    'c',
    [
      { stdin: '5', expectedOutput: '10', visible: true },
      { stdin: '21', expectedOutput: '42', visible: false },
    ],
    'basic',
    '#include <stdio.h>\n\nint main(void) {\n    int n;\n    \n    return 0;\n}\n'
  ),
  coding(
    'Print the numbers 1 to 5, one per line.',
    'c',
    [{ stdin: '', expectedOutput: '1\n2\n3\n4\n5', visible: true }],
    'basic',
    '#include <stdio.h>\n\nint main(void) {\n    \n    return 0;\n}\n'
  ),
  coding(
    'Read two whole numbers and print their sum.',
    'c',
    [
      { stdin: '3 4', expectedOutput: '7', visible: true },
      { stdin: '10 32', expectedOutput: '42', visible: false },
    ],
    'basic',
    '#include <stdio.h>\n\nint main(void) {\n    \n    return 0;\n}\n'
  ),
  coding(
    'Read one number and print "even" if it is even, otherwise "odd".',
    'c',
    [
      { stdin: '4', expectedOutput: 'even', visible: true },
      { stdin: '7', expectedOutput: 'odd', visible: false },
    ],
    'basic',
    '#include <stdio.h>\n\nint main(void) {\n    \n    return 0;\n}\n'
  ),
  coding(
    'Read two whole numbers and print their average to two decimal places (remember integer division).',
    'c',
    [
      { stdin: '7 2', expectedOutput: '4.50', visible: true },
      { stdin: '10 3', expectedOutput: '6.50', visible: false },
    ],
    'basic',
    '#include <stdio.h>\n\nint main(void) {\n    \n    return 0;\n}\n'
  ),

  coding(
    'Read one number n and print the sum of all whole numbers from 1 to n.',
    'c',
    [
      { stdin: '5', expectedOutput: '15', visible: true },
      { stdin: '100', expectedOutput: '5050', visible: false },
    ],
    'advanced',
    '#include <stdio.h>\n\nint main(void) {\n    \n    return 0;\n}\n'
  ),
  coding(
    'Read 5 whole numbers into an array and print the largest.',
    'c',
    [
      { stdin: '3 9 2 7 4', expectedOutput: '9', visible: true },
      { stdin: '10 1 1 1 1', expectedOutput: '10', visible: false },
    ],
    'advanced',
    '#include <stdio.h>\n\nint main(void) {\n    int a[5];\n    \n    return 0;\n}\n'
  ),
  coding(
    'Write a function that returns the number of vowels in a string, then read a word and print the count.',
    'c',
    [
      { stdin: 'hello', expectedOutput: '2', visible: true },
      { stdin: 'programming', expectedOutput: '3', visible: false },
    ],
    'advanced',
    '#include <stdio.h>\n\nint main(void) {\n    \n    return 0;\n}\n'
  ),
];

/* ========================================================================== */
/* HTML & CSS — a BUILD paper: 20 knowledge, 2 tasks (30), 1 big task (40)   */
/*                                                                            */
/* The knowledge section draws from mcq AND fillblank together, so the pool   */
/* is the two combined. Tasks carry `checks` — without them the build paper   */
/* cannot be passed at all (100 auto-markable against a pass mark of 150).    */
/* ========================================================================== */

const HTML = [
  // ---- knowledge: multiple choice (20) ----
  mcq('Which tag has NO closing tag?', ['<img>', '<p>', '<div>', '<h1>'], 0),
  mcq('Where does the <title> element appear?', ['in the browser tab', 'as a page heading', 'in the footer', 'nowhere'], 0),
  mcq('Which attribute describes an image for someone who cannot see it?', ['alt', 'src', 'title', 'name'], 0),
  mcq('How many <h1> elements should a page normally have?', ['one', 'as many as you like', 'three', 'none'], 0),
  mcq('Which list numbers its items automatically?', ['<ol>', '<ul>', '<li>', '<dl>'], 0),
  mcq('Where does a nested sub-list belong?', ['inside the <li> it belongs to', 'between two <li> elements', 'after the list', 'in the <head>'], 0),
  mcq('What connects a <label> to its input?', ['the label\'s for matches the input\'s id', 'being next to it', 'a shared class', 'nothing'], 0),
  mcq('Which selector matches class="note"?', ['.note', '#note', 'note', '*note'], 0),
  mcq('Which is INSIDE the border in the box model?', ['padding', 'margin', 'both', 'neither'], 0),
  mcq('What does box-sizing: border-box do?', ['makes width include padding and border', 'removes the border', 'centres the box', 'nothing'], 0),
  mcq('Where does display: flex go?', ['on the parent container', 'on each child', 'on both', 'in the head'], 0),
  mcq('In a flex row, which property spreads items across?', ['justify-content', 'align-items', 'gap', 'flex-wrap'], 0),
  mcq('What does the fr unit mean in CSS Grid?', ['a share of the free space', 'a fixed 1px', 'a font ratio', 'a frame'], 0),
  mcq('What minimum contrast ratio should body text meet?', ['4.5:1', '1.5:1', '2:1', 'it does not matter'], 0),
  mcq('Which element holds a page\'s primary content?', ['<main>', '<div>', '<section>', '<body>'], 0),
  mcq('What is wrong with a <div> styled to look like a button?', ['it cannot be focused or used by keyboard', 'it renders slowly', 'nothing', 'divs cannot be styled'], 0),
  mcq('What happens without the viewport meta tag on a phone?', ['it renders a zoomed-out desktop page', 'nothing', 'the page fails', 'CSS is ignored'], 0),
  mcq('What does img { max-width: 100% } prevent?', ['images overflowing their container', 'slow loading', 'caching', 'nothing'], 0),
  mcq('Which pair carries MEANING rather than only appearance?', ['<strong> and <em>', '<b> and <i>', '<span> and <div>', '<big> and <small>'], 0),
  mcq('What is a table for?', ['data with rows and columns', 'page layout', 'navigation', 'images'], 0),

  // ---- knowledge: fill in the blank (20) ----
  blank('The header you include to make printf-style text render accented characters is <meta charset="____">.', ['utf-8', 'utf8']),
  blank('Everything a visitor can see goes inside the ____ element.', ['body', '<body>']),
  blank('Each entry in a list goes inside an ____ element.', ['li', '<li>']),
  blank('The attribute that says where a link goes is ____.', ['href']),
  blank('A decorative image should have alt="____".', ['', 'empty', 'nothing']),
  blank('Every CSS declaration must end with a ____.', ['semicolon', ';']),
  blank('An id must be ____ on a page.', ['unique', 'used once']),
  blank('In CSS, ____ is space outside the border and is always transparent.', ['margin']),
  blank('The property that spaces flex items apart without outer margins is ____.', ['gap']),
  blank('`margin: 0 auto` ____ a fixed-width box horizontally.', ['centres', 'centers']),
  blank('The element that names a table and is announced first is ____.', ['caption', '<caption>']),
  blank('A header cell in a table uses the ____ element.', ['th', '<th>']),
  blank('Designing the narrow layout first is called ____-first.', ['mobile']),
  blank('Media queries that ADD layout as space allows use ____-width.', ['min']),
  blank('The element that groups related form controls is ____.', ['fieldset', '<fieldset>']),
  blank('A link that lets keyboard users jump past the navigation is called a ____ link.', ['skip']),
  blank('HTML collapses several spaces in a row into ____ space.', ['one', '1', 'a single']),
  blank('The CSS unit that respects a reader\'s own text size setting is ____.', ['rem']),
  blank('grid-column: span ____ makes an item cover two columns.', ['2', 'two']),
  blank('Removing the focus outline with outline: ____ makes a page unusable by keyboard.', ['none']),

  // ---- tasks, basic (need 2, have 4) — each carries machine-checkable checks
  task(
    'Build a small page about a hobby. It must have the full page skeleton (doctype, html with a lang, head with a charset and title, and body), one <h1>, and at least two paragraphs.',
    'A complete, well-formed HTML page with a correct skeleton, a single h1 and two or more paragraphs.',
    [
      { kind: 'contains', value: '<!DOCTYPE html', label: 'starts with the doctype', weight: 1 },
      { kind: 'htmlTagWithAttr', value: 'html', attr: 'lang', label: 'the <html> tag sets a lang', weight: 1 },
      { kind: 'htmlTag', value: 'head', label: 'has a <head>', weight: 1 },
      { kind: 'htmlTag', value: 'title', label: 'has a <title>', weight: 1 },
      { kind: 'htmlTag', value: 'body', label: 'has a <body>', weight: 1 },
      { kind: 'htmlTag', value: 'h1', min: 1, label: 'has exactly one <h1>', weight: 1 },
      { kind: 'htmlTag', value: 'p', min: 2, label: 'has at least two paragraphs', weight: 2 },
    ],
    'basic'
  ),
  task(
    'Build a page section with a navigation menu. Use semantic elements: a <nav> containing a <ul> of at least three links, and wrap the page content in <main>.',
    'A semantic navigation block: nav > ul > three or more li each holding an anchor with an href, plus a main element.',
    [
      { kind: 'htmlTag', value: 'nav', label: 'uses a <nav>', weight: 2 },
      { kind: 'htmlTag', value: 'ul', label: 'the links are in a <ul>', weight: 1 },
      { kind: 'htmlTag', value: 'li', min: 3, label: 'has at least three list items', weight: 2 },
      { kind: 'htmlTagWithAttr', value: 'a', attr: 'href', label: 'every link has an href', weight: 2 },
      { kind: 'htmlTag', value: 'main', label: 'wraps the content in <main>', weight: 1 },
    ],
    'basic'
  ),
  task(
    'Build an accessible sign-up form with a name field and an email field. Every input must have a label joined by for and id, the email field must use the right input type, and there must be a real submit button.',
    'A form with two labelled inputs (for/id matched), type="email" on the email field, and a button element.',
    [
      { kind: 'htmlTag', value: 'form', label: 'uses a <form>', weight: 1 },
      { kind: 'htmlTagWithAttr', value: 'label', attr: 'for', label: 'every label has a for attribute', weight: 2 },
      { kind: 'htmlTagWithAttr', value: 'input', attr: 'id', label: 'every input has an id', weight: 2 },
      { kind: 'regex', value: 'type\\s*=\\s*["\']email["\']', label: 'the email field uses type="email"', weight: 2 },
      { kind: 'htmlTag', value: 'button', label: 'has a real <button>', weight: 1 },
    ],
    'basic'
  ),
  task(
    'Write the CSS for a card component. It must set box-sizing to border-box, give the card padding, a border and a background, and set an explicit text colour.',
    'A CSS rule using border-box, with padding, border, background and color all set.',
    [
      { kind: 'contains', value: 'border-box', label: 'sets box-sizing: border-box', weight: 2 },
      { kind: 'contains', value: 'padding', label: 'sets padding', weight: 1 },
      { kind: 'contains', value: 'border', label: 'sets a border', weight: 1 },
      { kind: 'contains', value: 'background', label: 'sets a background', weight: 1 },
      { kind: 'regex', value: '(^|[^-])color\\s*:', label: 'sets an explicit text colour', weight: 1 },
    ],
    'basic'
  ),

  // ---- tasks, advanced (need 1, have 2) ----
  task(
    'Build a complete, responsive, accessible page for a school club. It needs: the full skeleton with a viewport meta tag; semantic landmarks (header, nav, main, footer); at least one image with real alt text; a responsive layout using flexbox or grid; and a media query. Include the CSS in a <style> block.',
    'A full page combining structure, semantics, accessibility and a responsive layout with a media query.',
    [
      { kind: 'contains', value: '<!DOCTYPE html', label: 'starts with the doctype', weight: 1 },
      { kind: 'regex', value: 'name\\s*=\\s*["\']viewport["\']', label: 'has the viewport meta tag', weight: 2 },
      { kind: 'htmlTag', value: 'header', label: 'uses a <header>', weight: 1 },
      { kind: 'htmlTag', value: 'nav', label: 'uses a <nav>', weight: 1 },
      { kind: 'htmlTag', value: 'main', label: 'uses a <main>', weight: 1 },
      { kind: 'htmlTag', value: 'footer', label: 'uses a <footer>', weight: 1 },
      { kind: 'htmlTagWithAttr', value: 'img', attr: 'alt', label: 'every image has non-empty alt text', weight: 2 },
      { kind: 'regex', value: 'display\\s*:\\s*(flex|grid)', label: 'uses flexbox or grid for layout', weight: 2 },
      { kind: 'contains', value: '@media', label: 'includes a media query', weight: 2 },
      { kind: 'htmlTag', value: 'style', label: 'includes the CSS in a <style> block', weight: 1 },
    ],
    'advanced'
  ),
  task(
    'Build a page presenting data in an accessible table, with styling. It needs a table with a caption, header cells using scope, at least three data rows, and CSS that sets a readable text colour and gives the cells padding.',
    'An accessible data table with caption and scoped headers, plus CSS for readability.',
    [
      { kind: 'htmlTag', value: 'table', label: 'uses a <table>', weight: 1 },
      { kind: 'htmlTag', value: 'caption', label: 'the table has a <caption>', weight: 2 },
      { kind: 'htmlTagWithAttr', value: 'th', attr: 'scope', label: 'every header cell has a scope', weight: 2 },
      { kind: 'htmlTag', value: 'tr', min: 4, label: 'has a header row plus at least three data rows', weight: 2 },
      { kind: 'htmlTag', value: 'style', label: 'includes CSS in a <style> block', weight: 1 },
      { kind: 'contains', value: 'padding', label: 'gives the cells padding', weight: 1 },
      { kind: 'regex', value: '(^|[^-])color\\s*:', label: 'sets an explicit text colour', weight: 1 },
    ],
    'advanced'
  ),
];

/* ========================================================================== */
/* AI & PROMPTING — a BUILD paper                                             */
/*                                                                            */
/* The tasks here check STRUCTURE, not quality: that a prompt names an        */
/* audience, sets a length, states a constraint and gives the model           */
/* permission to decline. Those are the objective, teachable properties the   */
/* course covers — judging whether a prompt is "good" is not something any    */
/* automated check should pretend to do.                                      */
/* ========================================================================== */

const AI = [
  // ---- knowledge: multiple choice (20) ----
  mcq('What is a language model fundamentally doing?', ['producing text that is likely to follow your input', 'looking answers up in a database', 'searching the internet', 'running a program'], 0),
  mcq('What does a confident tone tell you about accuracy?', ['nothing at all', 'that it is probably right', 'that it checked sources', 'that it is certain'], 0),
  mcq('You ask the same question twice and get different answers. Why?', ['there is deliberate randomness in the output', 'the tool is broken', 'the first was wrong', 'your prompt was invalid'], 0),
  mcq('Which parts of an answer are LEAST trustworthy?', ['specific names, numbers, dates and citations', 'general explanations', 'creative suggestions', 'grammar fixes'], 0),
  mcq('Why does a vague prompt give a bland answer?', ['it guesses length, audience and tone, and guesses the middle', 'it ignores short prompts', 'it needs more words', 'vague prompts error'], 0),
  mcq('Which improves an answer more?', ['being specific', 'being more polite', 'longer sentences', 'saying please'], 0),
  mcq('Can a model see the files on your computer?', ['no, unless the tool fetches them', 'yes, always', 'yes, if you mention them', 'only code files'], 0),
  mcq('What is the most reliable way to get a specific output format?', ['show one example of exactly what you want', 'describe it carefully', 'ask twice', 'use capital letters'], 0),
  mcq('What happens if your example prompt contains a typo?', ['it gets copied into every result', 'it is corrected', 'the prompt fails', 'nothing'], 0),
  mcq('Which helps more — naming a role or naming the audience?', ['the audience', 'the role', 'they are identical', 'neither'], 0),
  mcq('Does "you are a doctor" make medical information more reliable?', ['no — it changes style, not accuracy', 'yes', 'yes for common conditions', 'only with a source'], 0),
  mcq('What does asking for step-by-step working do?', ['improves multi-step answers and gives you something to check', 'only changes formatting', 'guarantees correctness', 'slows it down for nothing'], 0),
  mcq('You ask twice and get the same answer. What have you learned?', ['nothing — the same patterns repeat the same mistake', 'that it is correct', 'that it is probably right', 'that it checked'], 0),
  mcq('What counts as verifying a claim?', ['a source outside the conversation', 'asking the model again', 'asking "are you sure?"', 'a confidence rating'], 0),
  mcq('Which claim should worry you most?', ['a precise statistic from a study you cannot find', 'a general explanation', 'a rounded estimate', 'a creative idea'], 0),
  mcq('Where does a model\'s view of the world come from?', ['the text it was trained on, including its gaps', 'a curated encyclopaedia', 'live searches', 'its programmers\' opinions'], 0),
  mcq('Whose responsibility is an invented fact in work you submit?', ['yours — you chose to include it', 'the tool\'s', 'nobody\'s', 'the provider\'s'], 0),
  mcq('What is the rule about generated code?', ['never use code you cannot explain', 'never use it at all', 'use it if it compiles', 'only for small functions'], 0),
  mcq('Where is generated code weakest?', ['edge cases: empty, zero, one item, negatives', 'the ordinary case', 'the syntax', 'the formatting'], 0),
  mcq('Is using an AI assistant cheating?', ['not in itself — misrepresenting the work is', 'always', 'never in any circumstance', 'only for code'], 0),

  // ---- knowledge: fill in the blank (20) ----
  blank('When a model invents a plausible but false detail, that is called ____.', ['hallucination', 'hallucinating', 'a hallucination']),
  blank('Three details that fix most weak prompts: what, how long, and for ____.', ['whom', 'who']),
  blank('Providing a couple of examples in a prompt is called ____-shot prompting.', ['few']),
  blank('Adding "if you are not sure, ____" gives it an alternative to inventing.', ['say so', 'say', 'tell me']),
  blank('Real verification must come from ____ the conversation.', ['outside', 'beyond']),
  blank('For generated code, the real verification is to ____ it.', ['run', 'execute', 'test']),
  blank('Training ended at some point, which is called the knowledge ____.', ['cut-off', 'cutoff', 'cut off']),
  blank('For anything substantial, ask for an ____ before any content.', ['outline', 'plan']),
  blank('Saying what to ____ stops a revision losing the good parts.', ['keep', 'preserve']),
  blank('The first reply should be treated as a ____.', ['draft']),
  blank('Asking "what is the ____ part of that answer?" gets a better review than "is it right?".', ['weakest', 'weak']),
  blank('A prompt should say what to avoid as well as what to ____.', ['include', 'do', 'want']),
  blank('Invented ____ are a classic AI failure: plausible author, plausible title, no such paper.', ['citations', 'references', 'sources']),
  blank('You should never submit work you could not ____ if asked.', ['explain', 'defend']),
  blank('Over-represented perspectives in the training text appear as the ____.', ['default', 'norm']),
  blank('A model has no ____ to look facts up in.', ['database', 'index']),
  blank('Word-count limits in a prompt are ____ rather than exact.', ['approximate', 'a guide', 'approximations']),
  blank('Naming the ____ settles vocabulary, assumed knowledge, length and tone at once.', ['audience', 'reader']),
  blank('Asking a model to state its ____ surfaces the ones hidden in your question.', ['assumptions', 'assumption']),
  blank('One specific line saying what a tool did is called an ____.', ['acknowledgement', 'acknowledgment', 'attribution']),

  // ---- tasks, basic (need 2, have 4) ----
  task(
    'Write a prompt asking for an explanation of loops. It must name a specific audience, set a length, and state one thing to avoid. Write the prompt itself, not an explanation of loops.',
    'A prompt containing an audience, a length limit and a negative constraint.',
    [
      { kind: 'minWords', min: 15, label: 'is a real prompt, not a phrase', weight: 1 },
      { kind: 'regex', value: '(year[- ]old|beginner|someone who|for a |audience|pupil|student|child)', label: 'names an audience', weight: 2 },
      { kind: 'regex', value: '(\\d+\\s*words?|one paragraph|two paragraphs|\\d+\\s*(bullet|point|sentence)|briefly in \\d+)', label: 'sets a length', weight: 2 },
      { kind: 'regex', value: "(no |don't|do not|avoid|without |never )", label: 'states something to avoid', weight: 2 },
    ],
    'basic'
  ),
  task(
    'Write a prompt that asks for five book recommendations in a structured format you could paste into a program. It must name the format, give the exact fields, and stop the model adding extra commentary.',
    'A prompt naming a machine-readable format, its fields, and suppressing surrounding prose.',
    [
      { kind: 'minWords', min: 15, label: 'is a real prompt, not a phrase', weight: 1 },
      { kind: 'regex', value: '(json|csv|table|yaml)', label: 'names a machine-readable format', weight: 2 },
      { kind: 'regex', value: '(field|key|column|title|author)', label: 'names the fields it wants', weight: 2 },
      { kind: 'regex', value: '(only the|no explanation|nothing else|no preamble|without any)', label: 'suppresses extra commentary', weight: 2 },
    ],
    'basic'
  ),
  task(
    'You pasted an article and want a summary you can trust. Write a prompt that sets a bullet count, sets a word limit per bullet, and tells the model what to do if a point is not actually stated in the article.',
    'A prompt with a count, a per-item length, and an instruction preventing inference beyond the source.',
    [
      { kind: 'minWords', min: 20, label: 'is a real prompt, not a phrase', weight: 1 },
      { kind: 'regex', value: '(three|3|four|4|five|5)\\s*(bullet|point)', label: 'sets a bullet count', weight: 2 },
      { kind: 'regex', value: '\\d+\\s*words?', label: 'sets a word limit', weight: 2 },
      { kind: 'regex', value: '(not stated|not in the|leave it out|do not infer|only use|say so)', label: 'prevents inventing beyond the source', weight: 3 },
    ],
    'basic'
  ),
  task(
    'Write a prompt asking for help with a bug in your code. It must include the actual code, say what you expected, say what actually happened, and say what you already tried.',
    'A prompt containing code plus expected behaviour, actual behaviour and prior attempts.',
    [
      { kind: 'minWords', min: 25, label: 'is a real prompt with detail', weight: 1 },
      { kind: 'regex', value: '(print|def |int |for |while |return|#include|=)', label: 'includes actual code', weight: 2 },
      { kind: 'regex', value: '(expect|should)', label: 'says what was expected', weight: 2 },
      { kind: 'regex', value: '(instead|but it|actually|happens|got )', label: 'says what actually happened', weight: 2 },
      { kind: 'regex', value: '(already tried|I tried|I checked|ruled out)', label: 'says what was already tried', weight: 2 },
    ],
    'basic'
  ),

  // ---- tasks, advanced (need 1, have 2) ----
  task(
    'Write a short guide, for a classmate, on how to use an AI assistant responsibly for schoolwork. It must cover: that the tool can be confidently wrong; how to verify a claim; that generated code you cannot explain should not be used; and how to acknowledge the help honestly.',
    'A guide covering unreliability, verification from outside the conversation, understanding generated code, and honest acknowledgement.',
    [
      { kind: 'minWords', min: 90, label: 'is a real guide, not notes', weight: 2 },
      { kind: 'regex', value: '(confident|sounds sure|certain|convincing)', label: 'explains it can be confidently wrong', weight: 2 },
      { kind: 'regex', value: '(check|verify|source|look it up|confirm)', label: 'explains how to verify a claim', weight: 3 },
      { kind: 'regex', value: '(outside|another source|textbook|documentation|run it)', label: 'says verification comes from outside the conversation', weight: 2 },
      { kind: 'regex', value: '(explain|understand)', label: 'covers not using code you cannot explain', weight: 2 },
      { kind: 'regex', value: '(acknowledge|say what|declare|admit|be honest|tell your teacher)', label: 'covers acknowledging the help', weight: 3 },
      { kind: 'regex', value: '(hallucinat|invent|made up|make up)', label: 'names invention/hallucination', weight: 1 },
    ],
    'advanced'
  ),
  task(
    'You are asked to research a topic using an AI assistant. Write the full sequence of prompts you would use — at least four — showing how you would break the work down, ask for reasoning, get it reviewed, and check the result. Explain in one line why each prompt is there.',
    'A decomposed prompt sequence with reasoning, self-review and external verification, each step justified.',
    [
      { kind: 'minWords', min: 90, label: 'is a full sequence, not one prompt', weight: 2 },
      { kind: 'regex', value: '(outline|plan|first|step 1|1\\.)', label: 'starts by asking for a plan or outline', weight: 2 },
      { kind: 'regex', value: '(step by step|show your working|reasoning|explain how)', label: 'asks for reasoning, not just an answer', weight: 3 },
      { kind: 'regex', value: '(review|weakest|check that|critique|what is wrong)', label: 'asks it to review its own answer', weight: 2 },
      { kind: 'regex', value: '(verify|source|look up|outside|myself|check it)', label: 'includes verification outside the conversation', weight: 3 },
      { kind: 'regex', value: '(because|so that|why|this is there to|in order to)', label: 'justifies each step', weight: 2 },
    ],
    'advanced'
  ),
];

/**
 * The bank, keyed by course slug.
 *
 * Every entry is a partial Question — the seed attaches `course` and
 * `courseSlug` and lets the model's own pre-validate hook reject anything
 * unmarkable, so a bad question here fails the seed loudly rather than
 * reaching a pupil's paper.
 */
export const QUESTION_BANK = {
  python: PYTHON,
  c: C,
  html: HTML,
  ai: AI,
};

export default QUESTION_BANK;

/**
 * THE C COURSE — the second rung of the ladder.
 *
 * A pupil arrives here having passed Python, so this course does NOT re-teach
 * what a variable or a loop is. It teaches what C does differently, and the
 * shape of the content follows from that:
 *
 *   • TYPES FIRST. Python let them write `n = 5`. C makes them say what kind
 *     of thing `n` is, forever. That is the single biggest shift, so it gets a
 *     whole world rather than a footnote.
 *
 *   • COMPILING IS A STEP THEY CAN SEE. In Python, code ran. In C there is a
 *     build that can fail before anything runs, and a compiler error is a new
 *     category of experience for them. World one makes that normal instead of
 *     frightening.
 *
 *   • POINTERS ARE THE POINT. Everything before Pointer Peak is groundwork so
 *     that addresses arrive as an answer to a question they already have
 *     ("how did scanf change my variable?") rather than as arbitrary syntax.
 *
 * Worlds are ordered from 6 so they sit after Python's five without
 * renumbering existing content, and their slugs are `c-` prefixed so no world
 * slug can ever collide with Python's.
 *
 * Every code snippet here compiles under `-std=c11`, which is what the runner
 * uses — a lesson that showed code the platform's own compiler rejects would
 * teach the wrong thing twice.
 */

export const C_WORLDS = [
  {
    name: 'The C Workshop',
    slug: 'c-workshop',
    order: 6,
    topics: ['Your First C Program', 'Printing Output', 'Compiling'],
    description:
      'Step into the workshop where real programs are built. Meet main(), print your first line with printf, and learn what a compiler does — including what it means when it says no.',
    requiredLevel: 1,
    icon: 'workshop',
  },
  {
    name: 'Type Town',
    slug: 'c-type-town',
    order: 7,
    topics: ['Types and Variables', 'Reading Input', 'Maths and Operators'],
    description:
      'In C every value has a declared type, and that changes everything. Learn int, double and char, read what a user types with scanf, and see why 7 / 2 is not always 3.5.',
    requiredLevel: 3,
    icon: 'town',
  },
  {
    name: 'Decision Docks',
    slug: 'c-decision-docks',
    order: 8,
    topics: ['if and else', 'Logical Operators', 'switch'],
    description:
      'Make your programs choose. Write conditions with if and else, combine them with && and ||, and use switch when one value decides between many paths.',
    requiredLevel: 5,
    icon: 'docks',
  },
  {
    name: 'Loop Lagoon',
    slug: 'c-loop-lagoon',
    order: 9,
    topics: ['for Loops', 'while and do-while', 'Arrays and Strings'],
    description:
      'Repeat with precision. Count with for, wait with while, and store many values at once in arrays — including the char arrays that C calls strings.',
    requiredLevel: 7,
    icon: 'lagoon',
  },
  {
    name: 'Pointer Peak',
    slug: 'c-pointer-peak',
    order: 10,
    topics: ['Functions in C', 'Pointers and Addresses', 'Structs'],
    description:
      'The summit of the course. Write your own functions, discover what a pointer really is, and bundle related values together with struct.',
    requiredLevel: 9,
    icon: 'peak',
  },
];

/**
 * Lesson content, keyed by world slug — the same shape Python's
 * lessonContent.json uses, so the lesson renderer needs no changes.
 */
export const C_LESSON_CONTENT = {
  'c-workshop': [
    {
      topic: 'Your First C Program',
      title: 'Your First C Program',
      order: 1,
      language: 'c',
      body: {
        tagline: 'Every C program starts in the same place: main.',
        intro:
          'In Python you could write one line and run it. C asks for a little more ceremony, and that ceremony is the same in every C program ever written — which means once you learn it, you can start any program in the world. A C program is a set of instructions wrapped inside a function called main, and main is where the computer begins.',
        sections: [
          {
            heading: 'main is the front door',
            body: 'When your program runs, the computer looks for a function called main and starts there. Everything you want to happen goes inside its curly braces. The word int before main says main hands back a whole number when it finishes.',
            bullets: [
              'Every C program has exactly one main.',
              'The braces { } hold everything main does.',
              'return 0; at the end means "finished, no problems".',
            ],
          },
          {
            heading: '#include brings in tools',
            body: 'C starts out knowing almost nothing — not even how to print. The line #include <stdio.h> hands your program the standard input and output tools, printf among them. Forget it and the compiler will tell you it has never heard of printf.',
            bullets: [
              'stdio.h means "standard input and output header".',
              '#include lines go at the very top of the file.',
              'Angle brackets < > are for the built-in libraries.',
            ],
          },
          {
            heading: 'Semicolons end statements',
            body: 'Python used the end of the line. C uses a semicolon, and it does not care about line breaks at all. This is the mistake every beginner makes, so expect it: a missing semicolon is usually reported on the NEXT line, because that is where the compiler finally realises something is wrong.',
            bullets: [
              'Every statement ends with ;',
              'Braces { } do not need a semicolon after them.',
              'An error on line 8 is often a missing semicolon on line 7.',
            ],
          },
        ],
        snippet: {
          language: 'c',
          lines: [
            '#include <stdio.h>   /* tools for printing */',
            '',
            'int main(void) {     /* the program starts here */',
            '    printf("Hello, world!\\n");',
            '    return 0;        /* finished, no problems */',
            '}',
          ],
          caption:
            'The smallest complete C program. Six lines, and five of them are the same in every C program you will ever write.',
        },
        tryIt: {
          language: 'c',
          starter:
            '#include <stdio.h>\n\nint main(void) {\n    printf("Hello, world!\\n");\n    return 0;\n}\n',
          challenge:
            'Run it as-is first. Then add a second printf that prints your name on its own line. Finally, delete one semicolon on purpose and read what the compiler says — knowing what that message looks like will save you an hour later.',
          hint: 'Add your new printf line before return 0;. Remember the \\n at the end of the text, or both lines will run together.',
        },
        guide: [
          {
            step: 'Include the tools you need',
            body: 'Put #include <stdio.h> on the first line so printf exists.',
          },
          {
            step: 'Open main',
            body: 'Write int main(void) { — this is where the program begins.',
          },
          {
            step: 'Write your instructions',
            body: 'Each one ends with a semicolon. printf("...\\n"); prints a line.',
          },
          {
            step: 'Return 0 and close the brace',
            body: 'return 0; reports success, then } ends main.',
          },
        ],
        takeaways: [
          'Every C program begins in a function called main.',
          '#include <stdio.h> is what makes printf available.',
          'Every statement ends with a semicolon.',
          'return 0; means the program finished without a problem.',
          'A missing semicolon is often reported on the line AFTER the mistake.',
        ],
      },
    },
    {
      topic: 'Printing Output',
      title: 'Printing with printf',
      order: 2,
      language: 'c',
      body: {
        tagline: 'printf is fussier than print — and far more powerful.',
        intro:
          "Python's print would happily show you anything. C's printf needs to be told what KIND of value it is printing, using a little placeholder like %d or %f. It feels like extra work for about ten minutes, and then it becomes the reason you can format output exactly how you want it.",
        sections: [
          {
            heading: 'Placeholders name the type',
            body: 'Inside the quotes you leave a placeholder, and after the quotes you list the values to drop in. %d takes a whole number, %f a decimal, %c a single character and %s a string. The placeholder must match the value, or the output will be nonsense.',
            bullets: [
              '%d — an int, like 42',
              '%f — a double, like 3.5',
              "%c — one char, like 'A'",
              '%s — a string, like "hello"',
            ],
          },
          {
            heading: '\\n is a new line',
            body: 'printf does not move to a new line on its own. \\n is an escape sequence meaning "newline". Leave it out and your next printf continues on the same line, which is sometimes exactly what you want.',
            bullets: [
              '\\n starts a new line.',
              '\\t inserts a tab, useful for lining up columns.',
              '\\\\ prints a single backslash, and \\" prints a quote mark.',
            ],
          },
          {
            heading: 'Controlling the decimals',
            body: 'A bare %f prints six decimal places, which is rarely what you want. %.2f rounds to two — perfect for money or averages. The number after the dot is how many decimals to show.',
            bullets: [
              '%f gives 3.500000',
              '%.2f gives 3.50',
              '%.0f gives 4 (it rounds, it does not chop)',
            ],
          },
        ],
        snippet: {
          language: 'c',
          lines: [
            '#include <stdio.h>',
            '',
            'int main(void) {',
            '    int level = 7;',
            '    double score = 91.5;',
            "    char grade = 'A';",
            '',
            '    printf("Level: %d\\n", level);',
            '    printf("Score: %.1f\\n", score);',
            '    printf("Grade: %c\\n", grade);',
            '    printf("%d points at %.2f each\\n", 3, 1.5);',
            '    return 0;',
            '}',
          ],
          caption:
            'One placeholder per value, in the same order. The last line shows two placeholders in one printf.',
        },
        tryIt: {
          language: 'c',
          starter:
            '#include <stdio.h>\n\nint main(void) {\n    int apples = 5;\n    double price = 0.4;\n    printf("apples: %d\\n", apples);\n    return 0;\n}\n',
          challenge:
            'Add a line that prints the total cost of the apples to two decimal places. Then try printing price with %d instead of %f and see what happens — the wrong placeholder does not crash, it just prints something meaningless, which is why the compiler warning matters.',
          hint: 'Multiply inside the printf: printf("total: %.2f\\n", apples * price);',
        },
        guide: [
          {
            step: 'Write the text with placeholders',
            body: 'printf("Level: %d\\n", ...) — %d marks where the number goes.',
          },
          {
            step: 'List the values after the text',
            body: 'Separate them with commas, in the same order as the placeholders.',
          },
          {
            step: 'Match each placeholder to its type',
            body: '%d for int, %f for double, %c for char, %s for a string.',
          },
          {
            step: 'End the line with \\n',
            body: 'Otherwise the next print carries on beside it.',
          },
        ],
        takeaways: [
          'printf needs a placeholder that matches the value type.',
          '%d is int, %f is double, %c is char, %s is a string.',
          '\\n starts a new line — printf will not do it for you.',
          '%.2f rounds a decimal to two places.',
          'A mismatched placeholder prints nonsense rather than crashing.',
        ],
      },
    },
    {
      topic: 'Compiling',
      title: 'What the Compiler Does',
      order: 3,
      language: 'c',
      body: {
        tagline: 'C is translated before it runs — and that is a feature.',
        intro:
          'Python read your code and ran it line by line. C does something different: a program called the compiler reads your whole file first and translates it into machine instructions. Only then does anything run. That extra step is why C programs are fast, and why C can tell you about a whole class of mistakes BEFORE a single line executes.',
        sections: [
          {
            heading: 'Two stages, two kinds of error',
            body: 'First the compiler translates. If it cannot, you get a compile error and nothing runs at all. If it succeeds you get a program, and running it can still go wrong — that is a runtime error. Telling these apart is the most useful debugging skill in C.',
            bullets: [
              'Compile error: your code could not be translated. Nothing ran.',
              'Runtime error: it translated fine, but went wrong while running.',
              'A compile error always names a file and a line number.',
            ],
          },
          {
            heading: 'Read the FIRST error, not the last',
            body: 'One mistake often causes a cascade of errors, because after the first confusion the compiler is guessing. Fix the top one and recompile — very often the other twenty disappear with it.',
            bullets: [
              'Always start at the first error message.',
              'Recompile after each fix rather than fixing everything at once.',
              'The line number is where the compiler NOTICED, not always where you erred.',
            ],
          },
          {
            heading: 'Warnings are advice worth taking',
            body: 'A warning means "this compiled, but I do not think you meant it". Unlike an error it does not stop the build — and it is very often the actual bug. Reading warnings is a habit that separates working C from C that works today.',
            bullets: [
              'Warnings do not stop your program from being built.',
              'An unused variable is harmless; a wrong printf placeholder is not.',
              '"control reaches end of non-void function" means a missing return.',
            ],
          },
        ],
        snippet: {
          language: 'c',
          lines: [
            '#include <stdio.h>',
            '',
            'int main(void) {',
            '    int total = 10;',
            '    /* This line has a mistake on purpose:',
            '       printf("total is %d\\n" total);',
            '       ^ a comma is missing before total.',
            "       The compiler will say: expected ')' */",
            '',
            '    printf("total is %d\\n", total);   /* the fixed version */',
            '    return 0;',
            '}',
          ],
          caption:
            'The commented-out line is a classic. The compiler reports "expected )" — which is its way of saying "I ran out of things I understood".',
        },
        tryIt: {
          language: 'c',
          starter:
            '#include <stdio.h>\n\nint main(void) {\n    int count = 3\n    printf("count: %d\\n", count);\n    return 0;\n}\n',
          challenge:
            'This will not compile. Read the error, fix it, and run it. Then break it a different way — remove the #include line — and notice that the message is completely different. Learning to recognise these two messages will save you more time than any other exercise in this course.',
          hint: 'Look at the end of the line declaring count. Then look at the line number the compiler blames, and notice it is not the line with the mistake.',
        },
        guide: [
          {
            step: 'Write your code',
            body: 'Save the whole file before compiling — the compiler reads the file, not your screen.',
          },
          {
            step: 'Compile it',
            body: 'The compiler translates the whole file into a program, or refuses.',
          },
          {
            step: 'Read the first error only',
            body: 'Fix the top one, then compile again. Later errors are often echoes of it.',
          },
          {
            step: 'Run the program',
            body: 'A clean compile means it built. It can still misbehave — that is a runtime problem.',
          },
        ],
        takeaways: [
          'C is compiled: translated fully before anything runs.',
          'A compile error means nothing ran at all.',
          'A runtime error happens in a program that built successfully.',
          'Fix the FIRST error and recompile — the rest are often knock-ons.',
          'Warnings do not stop the build but frequently point at the real bug.',
        ],
      },
    },
  ],

  'c-type-town': [
    {
      topic: 'Types and Variables',
      title: 'Types and Variables',
      order: 1,
      language: 'c',
      body: {
        tagline:
          'In C you say what kind of value a name holds — once, up front.',
        intro:
          'In Python, `n = 5` was enough, and `n = "five"` later was fine too. C works differently: you declare that n is an int, and from then on n holds whole numbers and nothing else. This is the biggest change from Python, and it buys you speed and a compiler that can catch your mistakes.',
        sections: [
          {
            heading: 'Declaring a variable',
            body: 'A declaration is the type followed by the name: int score;. You can declare and set it in one go: int score = 0;. Until you give it a value, a variable in C contains whatever rubbish was in that memory — reading it before setting it is a real bug and a common one.',
            bullets: [
              'int score = 0; — declare and initialise together.',
              'A declared-but-unset variable holds an unpredictable value.',
              'Always initialise. It costs nothing and prevents a whole bug family.',
            ],
          },
          {
            heading: 'The four types you need first',
            body: 'int for whole numbers, double for decimals, char for a single character, and _Bool (or just an int) for true and false. There are more, but these four cover almost everything in this course.',
            bullets: [
              'int — whole numbers: 0, 42, -7',
              'double — decimals: 3.5, -0.001',
              "char — one character in single quotes: 'A'",
              'Single quotes are for one char; double quotes are for text.',
            ],
          },
          {
            heading: 'The type cannot change',
            body: 'Once n is an int, it is an int for the whole program. Assigning 3.9 to it does not make it a double — it throws the decimals away and stores 3. That silent truncation is not an error, so it is worth remembering.',
            bullets: [
              'int n = 3.9; stores 3, with no complaint.',
              'C discards the fraction — it does not round.',
              'Choose double from the start if you need decimals.',
            ],
          },
        ],
        snippet: {
          language: 'c',
          lines: [
            '#include <stdio.h>',
            '',
            'int main(void) {',
            '    int lives = 3;',
            '    double health = 87.5;',
            "    char initial = 'K';",
            '',
            '    int truncated = 3.9;    /* becomes 3 — the .9 is thrown away */',
            '',
            '    printf("%c has %d lives and %.1f%% health\\n",',
            '           initial, lives, health);',
            '    printf("3.9 stored in an int is %d\\n", truncated);',
            '    return 0;',
            '}',
          ],
          caption:
            'Note %% — that is how you print a literal percent sign, since % alone starts a placeholder.',
        },
        tryIt: {
          language: 'c',
          starter:
            '#include <stdio.h>\n\nint main(void) {\n    int lives = 3;\n    printf("lives: %d\\n", lives);\n    return 0;\n}\n',
          challenge:
            'Add a double called health set to 99.9 and print it to one decimal place. Then declare an int and set it to 2.7, print it, and confirm for yourself that C stores 2 rather than rounding to 3.',
          hint: 'double health = 99.9; then printf("health: %.1f\\n", health);',
        },
        guide: [
          {
            step: 'Pick the right type',
            body: 'Whole numbers use int. Anything with a decimal point needs double.',
          },
          {
            step: 'Declare and initialise in one line',
            body: 'int score = 0; — never leave a variable unset.',
          },
          {
            step: 'Match the printf placeholder',
            body: '%d for int, %.1f for a double, %c for a char.',
          },
          {
            step: 'Remember the type is permanent',
            body: 'An int will silently discard any fraction you assign to it.',
          },
        ],
        takeaways: [
          'Every C variable is declared with a type, and that type never changes.',
          'int is whole numbers, double is decimals, char is one character.',
          'Single quotes \'A\' are a char; double quotes "A" are text.',
          'An uninitialised variable holds unpredictable rubbish — always set it.',
          'Assigning 3.9 to an int stores 3: C truncates rather than rounds.',
        ],
      },
    },
    {
      topic: 'Reading Input',
      title: 'Reading Input with scanf',
      order: 2,
      language: 'c',
      body: {
        tagline: 'scanf reads what the user types — and needs an & to do it.',
        intro:
          'Python had input(). C has scanf, and it looks almost the same except for one strange character: an ampersand before the variable name. That & is not decoration. It is the first hint of pointers, and understanding why it is there now will make Pointer Peak feel obvious later.',
        sections: [
          {
            heading: 'Reading one value',
            body: 'scanf takes a placeholder saying what to read, then WHERE to put it. scanf("%d", &age); reads a whole number and stores it in age. The placeholders are the same family as printf: %d, %lf for a double, %c for a char.',
            bullets: [
              'scanf("%d", &age); reads an int.',
              'scanf("%lf", &price); reads a double — note %lf, not %f.',
              'The format string says what to expect, not what to show.',
            ],
          },
          {
            heading: 'Why the &',
            body: 'printf only needs to LOOK at your variable, so you hand it the value. scanf needs to CHANGE your variable, so handing it the value would be useless — it would change a copy. & means "the address of", and giving scanf the address is what lets it reach your actual variable.',
            bullets: [
              'printf(..., age) — passes the value, for reading.',
              'scanf(..., &age) — passes the address, so it can write.',
              'Forgetting the & is the single most common scanf bug.',
            ],
          },
          {
            heading: 'Check that it worked',
            body: 'scanf returns how many values it successfully read. If the user types "hello" when you asked for a number, it returns 0 and your variable is untouched. Good programs check that return value instead of trusting it.',
            bullets: [
              'scanf returns the count of values read.',
              'if (scanf("%d", &n) != 1) means the input was not a number.',
              'Unchecked scanf on bad input leaves your variable as it was.',
            ],
          },
        ],
        snippet: {
          language: 'c',
          lines: [
            '#include <stdio.h>',
            '',
            'int main(void) {',
            '    int age = 0;',
            '',
            '    printf("How old are you? ");',
            '    if (scanf("%d", &age) != 1) {      /* & lets scanf write to age */',
            '        printf("That was not a number.\\n");',
            '        return 1;                      /* non-zero means "went wrong" */',
            '    }',
            '',
            '    printf("Next year you will be %d\\n", age + 1);',
            '    return 0;',
            '}',
          ],
          caption:
            'The if around scanf is what stops the program carrying on with a value it never actually read.',
        },
        tryIt: {
          language: 'c',
          starter:
            '#include <stdio.h>\n\nint main(void) {\n    int a = 0, b = 0;\n    printf("Enter two numbers: ");\n    scanf("%d %d", &a, &b);\n    printf("%d + %d = %d\\n", a, b, a + b);\n    return 0;\n}\n',
          challenge:
            'Run it and type two numbers separated by a space. Then remove one of the & symbols and read the compiler warning — it is telling you about exactly the bug described above. Finally, add a check that scanf read two values.',
          hint: 'scanf("%d %d", &a, &b) returns 2 when both were read, so compare it against 2.',
        },
        guide: [
          {
            step: 'Declare the variable first',
            body: 'scanf fills a variable that already exists — int age = 0;',
          },
          {
            step: 'Prompt the user',
            body: 'printf a question so they know what to type.',
          },
          {
            step: 'Read with scanf and an &',
            body: 'scanf("%d", &age); — the & gives scanf the address to write to.',
          },
          {
            step: 'Check the return value',
            body: 'Compare it against how many values you asked for.',
          },
        ],
        takeaways: [
          'scanf reads typed input into a variable.',
          'The & before the variable gives scanf its address, so it can write to it.',
          'Use %lf to read a double, even though printf uses %f to show one.',
          'scanf returns how many values it read — check it.',
          'Forgetting the & is the most common scanf mistake.',
        ],
      },
    },
    {
      topic: 'Maths and Operators',
      title: 'Maths and Integer Division',
      order: 3,
      language: 'c',
      body: {
        tagline: '7 / 2 is 3 in C. Knowing why will save you real bugs.',
        intro:
          'C does the arithmetic you expect — until you divide two whole numbers. Because an int can only hold a whole number, dividing one int by another gives an int, and the fraction is discarded. This surprises everybody once, and it is behind a great many wrong answers in beginner C.',
        sections: [
          {
            heading: 'The everyday operators',
            body: 'Plus, minus, times and divide work as you would expect: + - * /. C adds one more that Python also had — % gives the REMAINDER after a division, which is enormously useful for "is this even?" and "every third time".',
            bullets: [
              '+ - * / are addition, subtraction, multiplication, division.',
              '% is the remainder: 7 % 2 is 1.',
              '% works on ints only — not on doubles.',
            ],
          },
          {
            heading: 'Integer division truncates',
            body: 'If both sides of a / are ints, the answer is an int. 7 / 2 gives 3, not 3.5. Making just one side a double fixes it: 7 / 2.0 gives 3.5. This is the fix to reach for whenever an average comes out suspiciously round.',
            bullets: [
              '7 / 2 is 3 — both are ints, so the result is an int.',
              '7 / 2.0 is 3.5 — one double makes the whole sum a double.',
              '(double)a / b converts a first, which works with variables.',
            ],
          },
          {
            heading: 'Shortcuts you will see everywhere',
            body: 'count = count + 1 is so common that C has count++ for it. Similarly += adds in place. These are not just shorter, they are what other C programmers expect to read.',
            bullets: [
              'count++ adds one; count-- subtracts one.',
              'total += 5 is the same as total = total + 5.',
              '*=, -= and /= work the same way.',
            ],
          },
        ],
        snippet: {
          language: 'c',
          lines: [
            '#include <stdio.h>',
            '',
            'int main(void) {',
            '    int total = 7, count = 2;',
            '',
            '    printf("int  division: %d\\n", total / count);        /* 3 */',
            '    printf("real division: %.2f\\n", (double)total / count); /* 3.50 */',
            '    printf("remainder:     %d\\n", total % count);        /* 1 */',
            '',
            '    int score = 10;',
            '    score += 5;      /* now 15 */',
            '    score++;         /* now 16 */',
            '    printf("score: %d\\n", score);',
            '    return 0;',
            '}',
          ],
          caption:
            '(double)total is a cast: it converts total to a double just for this sum, leaving the variable itself an int.',
        },
        tryIt: {
          language: 'c',
          starter:
            '#include <stdio.h>\n\nint main(void) {\n    int marks = 45, papers = 4;\n    printf("average: %d\\n", marks / papers);\n    return 0;\n}\n',
          challenge:
            'The average printed here is wrong — it says 11 when the real answer is 11.25. Fix it so it prints 11.25, using a cast. Then use % to print how many marks are left over after sharing them equally.',
          hint: 'Change the placeholder to %.2f and cast one side: (double)marks / papers.',
        },
        guide: [
          {
            step: 'Use the operator you need',
            body: '+ - * / for arithmetic, % for the remainder.',
          },
          {
            step: 'Watch for two ints in a division',
            body: 'int / int gives an int, and the fraction is thrown away.',
          },
          {
            step: 'Cast to get a real answer',
            body: '(double)a / b converts a first, so the result keeps its decimals.',
          },
          {
            step: 'Print it with the matching placeholder',
            body: 'A double result needs %f or %.2f, not %d.',
          },
        ],
        takeaways: [
          'Dividing two ints gives an int: 7 / 2 is 3.',
          'Cast one side — (double)a / b — to keep the decimals.',
          '% gives the remainder and works only on whole numbers.',
          'count++ adds one; total += 5 adds five in place.',
          'A suspiciously round average is almost always integer division.',
        ],
      },
    },
  ],

  'c-decision-docks': [
    {
      topic: 'if and else',
      title: 'Making Decisions with if',
      order: 1,
      language: 'c',
      body: {
        tagline: 'Braces and parentheses replace the colon and the indent.',
        intro:
          'You already know what an if does. In C the idea is identical and only the punctuation changes: the condition goes in round brackets, and the block goes in curly braces instead of being indented. C does not care about your indentation at all — but every other programmer reading your code does.',
        sections: [
          {
            heading: 'The shape of an if',
            body: 'if (condition) { ... } else { ... }. The condition must be in parentheses. The braces hold the block. There is no colon and no elif — C spells it else if.',
            bullets: [
              'The condition always goes in ( ).',
              'Use { } around the block, even for one line.',
              'else if, not elif.',
            ],
          },
          {
            heading: '== compares, = assigns',
            body: 'This is the classic C trap. if (x = 5) does not test whether x is five — it SETS x to five, and then treats 5 as true, so the branch always runs. Use == to compare. The compiler will usually warn you, which is one more reason to read warnings.',
            bullets: [
              '== asks "are these equal?"',
              '= means "put this value in here".',
              '!= is "not equal". Also < > <= >=',
            ],
          },
          {
            heading: 'There is no true or false, really',
            body: 'C has no separate boolean type in the way Python does. Zero is false, and every other number is true. That is why if (x = 5) always runs, and it is also why if (count) is a common shorthand for "if count is not zero".',
            bullets: [
              '0 is false. Anything else — 1, -3, 42 — is true.',
              'A comparison like a < b produces 1 or 0.',
              'if (count) means "if count is not zero".',
            ],
          },
        ],
        snippet: {
          language: 'c',
          lines: [
            '#include <stdio.h>',
            '',
            'int main(void) {',
            '    int score = 72;',
            '',
            '    if (score >= 75) {',
            '        printf("Distinction\\n");',
            '    } else if (score >= 50) {       /* else if, not elif */',
            '        printf("Pass\\n");',
            '    } else {',
            '        printf("Keep practising\\n");',
            '    }',
            '',
            '    if (score % 2 == 0) {           /* == compares */',
            '        printf("That is an even score.\\n");',
            '    }',
            '    return 0;',
            '}',
          ],
          caption:
            'The braces are optional for a single statement, but including them always is a habit worth forming — it prevents a whole class of bug when you add a second line later.',
        },
        tryIt: {
          language: 'c',
          starter:
            '#include <stdio.h>\n\nint main(void) {\n    int lives = 0;\n    if (lives > 0) {\n        printf("Still alive\\n");\n    } else {\n        printf("Game over\\n");\n    }\n    return 0;\n}\n',
          challenge:
            'Add an else if that prints "Last life!" when lives is exactly 1, and check it runs by changing lives to 1. Then try writing if (lives = 1) with a single = and see what happens — this is the trap worth meeting once, deliberately, in a safe place.',
          hint: 'The else if must come BEFORE the final else, and its condition is lives == 1.',
        },
        guide: [
          {
            step: 'Put the condition in parentheses',
            body: 'if (score >= 50) — the round brackets are required.',
          },
          {
            step: 'Wrap the block in braces',
            body: 'Use { } even for one statement; it saves you later.',
          },
          {
            step: 'Use == to compare',
            body: 'A single = assigns, and makes the condition always true.',
          },
          {
            step: 'Chain with else if',
            body: 'C has no elif. Order matters: the first true branch wins.',
          },
        ],
        takeaways: [
          'Conditions go in parentheses; blocks go in braces.',
          'C uses else if, not elif, and has no colon.',
          '== compares, = assigns — mixing them up is the classic C bug.',
          'Zero is false and every other number is true.',
          'Indentation is for humans; C ignores it entirely.',
        ],
      },
    },
    {
      topic: 'Logical Operators',
      title: 'Combining Conditions',
      order: 2,
      language: 'c',
      body: {
        tagline: '&& is and, || is or, ! is not.',
        intro:
          'Real decisions rarely rest on one fact. C combines conditions with && for "and", || for "or" and ! for "not". They behave exactly as you would hope, plus one clever detail — C stops evaluating as soon as it knows the answer, which you can use to keep your programs safe.',
        sections: [
          {
            heading: 'The three operators',
            body: '&& is true only when both sides are true. || is true when either side is. ! flips a condition. Note they are doubled: a single & and | mean something quite different (bitwise operations), and using one by accident is a subtle bug.',
            bullets: [
              'a && b — true when BOTH are true.',
              'a || b — true when at least one is true.',
              '!a — true when a is false.',
              'Doubled: && and ||, never single & or |.',
            ],
          },
          {
            heading: 'Short-circuiting',
            body: 'For a && b, if a is false the answer must be false, so C never even looks at b. This is not a curiosity — it is how you guard a risky test: check something is safe first, and the dangerous part is never reached.',
            bullets: [
              'In a && b, b is skipped when a is false.',
              'In a || b, b is skipped when a is true.',
              'Put the cheap or protective test on the left.',
            ],
          },
          {
            heading: 'Chained comparisons do not work',
            body: 'Python let you write 0 < x < 10. C will accept it and give you nonsense, because it compares 0 < x, gets 1 or 0, and then compares THAT against 10. You must spell it out with &&.',
            bullets: [
              'Wrong: if (0 < x && x < 10) is what you meant.',
              'if (0 < x < 10) compiles but is always true.',
              'Write each comparison separately and join with &&.',
            ],
          },
        ],
        snippet: {
          language: 'c',
          lines: [
            '#include <stdio.h>',
            '',
            'int main(void) {',
            '    int age = 12;',
            '    int hasPermission = 1;',
            '',
            '    if (age >= 10 && hasPermission) {',
            '        printf("Allowed in\\n");',
            '    }',
            '',
            '    if (age < 5 || age > 90) {',
            '        printf("Free ticket\\n");',
            '    }',
            '',
            '    if (!hasPermission) {',
            '        printf("Needs a signature\\n");',
            '    }',
            '',
            '    /* Spell out a range with && — never 5 < age < 15 */',
            '    if (5 < age && age < 15) {',
            '        printf("Junior group\\n");',
            '    }',
            '    return 0;',
            '}',
          ],
          caption:
            'hasPermission is used directly as a condition: it is an int, and any non-zero int is true.',
        },
        tryIt: {
          language: 'c',
          starter:
            '#include <stdio.h>\n\nint main(void) {\n    int score = 80, attempts = 2;\n    if (score >= 75) {\n        printf("Distinction\\n");\n    }\n    return 0;\n}\n',
          challenge:
            'Change the condition so a distinction needs a score of at least 75 AND no more than 2 attempts. Then add a second if that prints "Needs help" when the score is under 40 OR attempts is 3 or more.',
          hint: 'Use && for the first and || for the second: score >= 75 && attempts <= 2.',
        },
        guide: [
          {
            step: 'Write each comparison in full',
            body: 'score >= 75 and attempts <= 2 — separately, not chained.',
          },
          {
            step: 'Join them with && or ||',
            body: '&& needs both; || needs only one.',
          },
          {
            step: 'Put the protective test first',
            body: 'Short-circuiting means the right side is skipped when the answer is already known.',
          },
          {
            step: 'Use ! to invert',
            body: '!ready is true exactly when ready is zero.',
          },
        ],
        takeaways: [
          '&& is and, || is or, ! is not — all doubled except !.',
          'C short-circuits: it stops as soon as the answer is certain.',
          'Put the safe or cheap test on the left to guard the right.',
          'Chained comparisons like 0 < x < 10 compile but are wrong.',
          'Single & and | are different operators entirely.',
        ],
      },
    },
    {
      topic: 'switch',
      title: 'Choosing with switch',
      order: 3,
      language: 'c',
      body: {
        tagline: 'One value, many paths — and do not forget the break.',
        intro:
          'When a single value decides between many options, a long else-if chain gets hard to read. switch says "look at this one value, and jump to the matching case". It is tidier, and it comes with one famous gotcha: without break, execution falls straight through into the next case.',
        sections: [
          {
            heading: 'The shape of a switch',
            body: 'switch (value) { case 1: ... break; case 2: ... break; default: ... }. Each case names one exact value. default catches everything else, and including one is almost always the right choice.',
            bullets: [
              'switch works on ints and chars, not on doubles or strings.',
              'Each case names one exact value to match.',
              'default runs when nothing matched.',
            ],
          },
          {
            heading: 'break stops the fall-through',
            body: 'After a case runs, C carries straight on into the next case unless you break. This is occasionally useful and much more often a bug — a missing break is one of the most common mistakes in C.',
            bullets: [
              'break jumps out of the switch.',
              'Without it, the next case body runs too.',
              'The last case still deserves a break, for when you add another.',
            ],
          },
          {
            heading: 'Deliberate fall-through for grouping',
            body: 'Stacking cases with no code between them is the one good use of fall-through: it means "any of these values do the same thing", and it reads clearly.',
            bullets: [
              'case 1: case 2: case 3: printf(...); break;',
              'Empty cases stacked together share one body.',
              'Anything else falling through is probably a missing break.',
            ],
          },
        ],
        snippet: {
          language: 'c',
          lines: [
            '#include <stdio.h>',
            '',
            'int main(void) {',
            '    int day = 6;',
            '',
            '    switch (day) {',
            '        case 1:',
            '        case 2:',
            '        case 3:',
            '        case 4:',
            '        case 5:',
            '            printf("School day\\n");   /* 1-5 share this body */',
            '            break;',
            '        case 6:',
            '        case 7:',
            '            printf("Weekend!\\n");',
            '            break;',
            '        default:',
            '            printf("Not a real day\\n");',
            '    }',
            '    return 0;',
            '}',
          ],
          caption:
            'Cases 1 to 5 stack deliberately. The break after each group is what stops the weekend message printing too.',
        },
        tryIt: {
          language: 'c',
          starter:
            '#include <stdio.h>\n\nint main(void) {\n    char grade = \'B\';\n    switch (grade) {\n        case \'A\':\n            printf("Excellent\\n");\n            break;\n        default:\n            printf("Unknown grade\\n");\n    }\n    return 0;\n}\n',
          challenge:
            "Add cases for 'B' and 'C' with their own messages. Then delete the break after case 'A', set grade to 'A', and run it — you will see two messages print. That is fall-through, and now you will recognise it when it happens by accident.",
          hint: "A char case uses single quotes: case 'B': then your printf, then break;",
        },
        guide: [
          {
            step: 'Put the value in switch( )',
            body: 'switch (day) — it must be an int or a char.',
          },
          {
            step: 'List each value as a case',
            body: 'case 6: then the code for that value.',
          },
          {
            step: 'End every case with break',
            body: 'Without it, the next case runs as well.',
          },
          {
            step: 'Add a default',
            body: 'It catches every value you did not list.',
          },
        ],
        takeaways: [
          'switch picks a path based on one int or char value.',
          'Every case needs a break, or execution falls into the next one.',
          'Stacked empty cases deliberately share a body.',
          'default handles everything you did not list.',
          'switch cannot match on doubles or strings.',
        ],
      },
    },
  ],

  'c-loop-lagoon': [
    {
      topic: 'for Loops',
      title: 'Counting with for',
      order: 1,
      language: 'c',
      body: {
        tagline: 'Three parts in one line: start, keep-going, and step.',
        intro:
          "Python's for walked through a list. C's for is more explicit and more powerful: you say where the counter starts, the condition to keep going, and how it changes each time. Once you can read those three parts, you can read almost any C loop.",
        sections: [
          {
            heading: 'The three parts',
            body: 'for (int i = 0; i < 5; i++). The first part runs once at the start. The second is checked before every pass — while it is true, the loop keeps going. The third runs after each pass. They are separated by semicolons, not commas.',
            bullets: [
              'int i = 0 — the setup, runs once.',
              'i < 5 — checked before each pass.',
              'i++ — runs after each pass.',
            ],
          },
          {
            heading: 'Counting from zero',
            body: 'C programmers start at 0 and use < for the limit, because that is how arrays are numbered. for (int i = 0; i < 5; i++) runs five times with i being 0,1,2,3,4. Using <= 5 instead gives six passes, which is the classic off-by-one bug.',
            bullets: [
              'i < 5 gives exactly 5 passes: 0 to 4.',
              'i <= 5 gives 6 passes — usually not what you meant.',
              'Starting at 0 matches how arrays are indexed.',
            ],
          },
          {
            heading: 'break and continue',
            body: 'break leaves the loop immediately. continue skips the rest of this pass and goes on to the next. Both are useful and both are easy to overuse — a clear condition often reads better than a continue.',
            bullets: [
              'break exits the loop entirely.',
              'continue jumps to the next pass.',
              'In a for loop, continue still runs the i++ step.',
            ],
          },
        ],
        snippet: {
          language: 'c',
          lines: [
            '#include <stdio.h>',
            '',
            'int main(void) {',
            '    /* Five passes: i is 0,1,2,3,4 */',
            '    for (int i = 0; i < 5; i++) {',
            '        printf("pass %d\\n", i);',
            '    }',
            '',
            '    /* Sum the numbers 1 to 10 */',
            '    int total = 0;',
            '    for (int n = 1; n <= 10; n++) {',
            '        total += n;',
            '    }',
            '    printf("1 to 10 adds up to %d\\n", total);',
            '',
            '    /* Skip 3, stop at 6 */',
            '    for (int i = 1; i < 10; i++) {',
            '        if (i == 3) continue;',
            '        if (i == 6) break;',
            '        printf("%d ", i);',
            '    }',
            '    printf("\\n");',
            '    return 0;',
            '}',
          ],
          caption:
            'The second loop uses <= 10 on purpose, because it is counting the numbers 1 to 10 rather than indexing an array.',
        },
        tryIt: {
          language: 'c',
          starter:
            '#include <stdio.h>\n\nint main(void) {\n    for (int i = 0; i < 3; i++) {\n        printf("i is %d\\n", i);\n    }\n    return 0;\n}\n',
          challenge:
            'Change it to count from 1 to 10 and print only the even numbers, using %. Then write a second loop that counts DOWN from 5 to 1 — you will need i-- and a condition that stops at the right place.',
          hint: 'Even means i % 2 == 0. To count down: for (int i = 5; i >= 1; i--).',
        },
        guide: [
          {
            step: 'Set up the counter',
            body: 'for (int i = 0; — declared and started in the loop itself.',
          },
          {
            step: 'Write the keep-going condition',
            body: 'i < 5; — while this is true, the loop runs again.',
          },
          {
            step: 'Say how it changes',
            body: 'i++) — after each pass. Use i-- to count down.',
          },
          {
            step: 'Put the work in braces',
            body: 'Everything inside { } runs on every pass.',
          },
        ],
        takeaways: [
          'A for loop has three parts: setup, condition, step.',
          'The parts are separated by semicolons.',
          'i < 5 runs five times, with i from 0 to 4.',
          'Using <= by mistake is the classic off-by-one bug.',
          'break leaves the loop; continue skips to the next pass.',
        ],
      },
    },
    {
      topic: 'while and do-while',
      title: 'while and do-while',
      order: 2,
      language: 'c',
      body: {
        tagline: 'Loop when you do not know how many times.',
        intro:
          'A for loop is ideal when you know the count. When you do not — keep asking until the answer is valid, keep reading until the input runs out — while is the right shape. C also has a do-while, which is the same idea with one important difference: it always runs at least once.',
        sections: [
          {
            heading: 'while checks first',
            body: 'while (condition) { ... } tests before each pass, including the very first. If the condition starts out false, the body never runs at all. Something inside the loop must eventually make the condition false, or it never stops.',
            bullets: [
              'The condition is checked BEFORE the body.',
              'A false condition at the start means zero passes.',
              'Change something inside the body, or it loops forever.',
            ],
          },
          {
            heading: 'do-while runs first, checks after',
            body: 'do { ... } while (condition); runs the body once and only then tests. That makes it the natural shape for "ask the user, and keep asking while the answer is invalid" — because you always need to ask at least once. Note the semicolon after the closing while.',
            bullets: [
              'The body always runs at least once.',
              'The test happens at the end of each pass.',
              'It ends with a semicolon: } while (x < 0);',
            ],
          },
          {
            heading: 'Infinite loops and how to avoid them',
            body: 'A loop that never changes its own condition never ends. In this platform a runaway loop is stopped after a few seconds, but on a real machine it just hangs. Before you run a while loop, find the line that will eventually make the condition false.',
            bullets: [
              'Every while needs something that changes the condition.',
              'Forgetting count++ inside the body is the usual cause.',
              'The runner kills a program that overruns its time.',
            ],
          },
        ],
        snippet: {
          language: 'c',
          lines: [
            '#include <stdio.h>',
            '',
            'int main(void) {',
            '    /* Halve a number until it reaches 1 */',
            '    int n = 40;',
            '    while (n > 1) {',
            '        printf("%d ", n);',
            '        n = n / 2;          /* this is what ends the loop */',
            '    }',
            '    printf("%d\\n", n);',
            '',
            '    /* do-while: always runs at least once */',
            '    int countdown = 0;',
            '    do {',
            '        printf("body ran with countdown = %d\\n", countdown);',
            '        countdown--;',
            '    } while (countdown > 0);   /* note the semicolon */',
            '    return 0;',
            '}',
          ],
          caption:
            'countdown starts at 0, so a while loop would never have run. The do-while runs once anyway — that is the whole difference.',
        },
        tryIt: {
          language: 'c',
          starter:
            '#include <stdio.h>\n\nint main(void) {\n    int count = 3;\n    while (count > 0) {\n        printf("count: %d\\n", count);\n        count--;\n    }\n    printf("Liftoff!\\n");\n    return 0;\n}\n',
          challenge:
            'Delete the count-- line and run it. The program will be stopped for taking too long — that is an infinite loop, and now you have seen one safely. Put it back, then rewrite the whole thing as a do-while.',
          hint: 'For the do-while: do { ... } while (count > 0); — and remember the final semicolon.',
        },
        guide: [
          {
            step: 'Choose the right loop',
            body: 'Known count: for. Unknown: while. Must run once: do-while.',
          },
          {
            step: 'Write the condition',
            body: 'while (count > 0) — the loop continues while this is true.',
          },
          {
            step: 'Change the condition inside',
            body: 'count-- is what eventually ends it. Without it, it never stops.',
          },
          {
            step: 'For do-while, remember the semicolon',
            body: '} while (count > 0); — it is required.',
          },
        ],
        takeaways: [
          'while checks its condition before every pass, including the first.',
          'do-while runs the body once and checks afterwards.',
          'A do-while ends with a semicolon after the condition.',
          'Something in the body must change the condition or it loops forever.',
          'Use while when you do not know the number of passes in advance.',
        ],
      },
    },
    {
      topic: 'Arrays and Strings',
      title: 'Arrays and Strings',
      order: 3,
      language: 'c',
      body: {
        tagline: 'Many values under one name — and text is just characters.',
        intro:
          'An array holds a fixed number of values of the same type, all under one name. Python lists could grow; a C array cannot — you decide its size when you declare it. And C has no separate string type at all: a string is simply an array of chars with a hidden marker on the end.',
        sections: [
          {
            heading: 'Declaring and indexing',
            body: 'int scores[5]; makes room for five ints. You reach them with scores[0] up to scores[4] — counting starts at zero, so the LAST index is one less than the size. Going past the end does not raise an error in C; it silently reads or writes memory that is not yours, which is why the loop condition matters so much.',
            bullets: [
              'int scores[5]; holds five ints.',
              'Valid indexes are 0 to 4. scores[5] is out of bounds.',
              'C does not check bounds — an overrun is silent and dangerous.',
            ],
          },
          {
            heading: 'Looping over an array',
            body: 'A for loop and an array are made for each other: for (int i = 0; i < 5; i++) visits every element exactly once. This is why C programmers start counters at zero and use < for the limit.',
            bullets: [
              'i < size visits every element exactly once.',
              'i <= size reads one element past the end.',
              'Keep the size in a constant so the loop and the array agree.',
            ],
          },
          {
            heading: 'A string is a char array',
            body: 'char name[] = "Kodi"; creates an array of FIVE chars — the four letters plus a hidden \\0 on the end. That zero byte is how every C function knows where the text stops. Lose it and printf keeps reading into whatever comes next.',
            bullets: [
              'A string is an array of char ending in \\0.',
              '"Kodi" needs 5 chars of space, not 4.',
              'strlen from <string.h> counts the letters, not the \\0.',
            ],
          },
        ],
        snippet: {
          language: 'c',
          lines: [
            '#include <stdio.h>',
            '#include <string.h>',
            '',
            'int main(void) {',
            '    int scores[5] = {70, 85, 60, 90, 75};',
            '',
            '    int total = 0;',
            '    for (int i = 0; i < 5; i++) {      /* i < 5, never <= 5 */',
            '        total += scores[i];',
            '    }',
            '    printf("total %d, average %.1f\\n", total, (double)total / 5);',
            '',
            '    char name[] = "Kodi";              /* 5 chars: K o d i \\0 */',
            '    printf("%s has %zu letters\\n", name, strlen(name));',
            '    printf("first letter: %c\\n", name[0]);',
            '    return 0;',
            '}',
          ],
          caption:
            '%zu is the placeholder for the kind of number strlen returns. Note the cast in the average — integer division again.',
        },
        tryIt: {
          language: 'c',
          starter:
            '#include <stdio.h>\n\nint main(void) {\n    int nums[4] = {3, 8, 1, 6};\n    for (int i = 0; i < 4; i++) {\n        printf("%d ", nums[i]);\n    }\n    printf("\\n");\n    return 0;\n}\n',
          challenge:
            'Find and print the largest number in the array using a loop. Then change the loop condition to i <= 4 and print the values again — you will see a fifth, meaningless number, which is what reading past the end of an array looks like.',
          hint: 'Start with int biggest = nums[0]; then in the loop, if (nums[i] > biggest) biggest = nums[i];',
        },
        guide: [
          {
            step: 'Declare with a size',
            body: 'int scores[5]; — the size is fixed and cannot grow later.',
          },
          {
            step: 'Index from zero',
            body: 'scores[0] is the first; scores[4] is the last of five.',
          },
          {
            step: 'Loop with i < size',
            body: 'That visits every element and stops at the right place.',
          },
          {
            step: 'Treat strings as char arrays',
            body: 'They end with a hidden \\0, so allow one extra char of space.',
          },
        ],
        takeaways: [
          'An array holds a fixed number of same-typed values.',
          'Indexes run from 0 to size-1.',
          'C does not check bounds — reading past the end is silent.',
          'A string is a char array terminated by \\0.',
          '"Kodi" occupies five chars because of the terminator.',
        ],
      },
    },
  ],

  'c-pointer-peak': [
    {
      topic: 'Functions in C',
      title: 'Writing Your Own Functions',
      order: 1,
      language: 'c',
      body: {
        tagline: 'Declare the types going in and the type coming out.',
        intro:
          'You have been using functions since your first printf. Now you write your own. A C function states the type it returns, its name, and the type of every parameter — so the compiler can check every call you make. And C needs to have heard of a function before you call it, which is why declarations go above main.',
        sections: [
          {
            heading: 'The shape of a function',
            body: 'int add(int a, int b) { return a + b; }. The first int is what comes back. Each parameter needs its own type, even when two share one. void as the return type means "gives nothing back", and void in the parameter list means "takes nothing".',
            bullets: [
              'int add(int a, int b) — returns an int, takes two ints.',
              'void greet(void) — returns nothing, takes nothing.',
              'Every parameter needs its own type: (int a, int b), not (int a, b).',
            ],
          },
          {
            heading: 'Declare before you call',
            body: 'C reads your file top to bottom. Call a function defined further down and the compiler complains it has never heard of it. Either define it above main, or put a one-line prototype at the top: int add(int a, int b); with a semicolon instead of a body.',
            bullets: [
              'Define the function above main, or',
              'write a prototype at the top: int add(int, int);',
              'A prototype ends in a semicolon, with no braces.',
            ],
          },
          {
            heading: 'Arguments are copies',
            body: 'When you pass a variable to a function, the function gets a COPY. Changing the parameter inside does not touch the original. This surprises people who expect otherwise, and it is exactly the problem that pointers exist to solve — which is the next lesson.',
            bullets: [
              'A function receives copies of its arguments.',
              "Changing a parameter does not change the caller's variable.",
              'To change the original, you need its address — a pointer.',
            ],
          },
        ],
        snippet: {
          language: 'c',
          lines: [
            '#include <stdio.h>',
            '',
            'int add(int a, int b);       /* prototype: promised, defined below */',
            'void greet(void);',
            '',
            'int main(void) {',
            '    greet();',
            '    printf("3 + 4 = %d\\n", add(3, 4));',
            '',
            '    int n = 10;',
            '    add(n, 5);               /* n is copied in; n itself is unchanged */',
            '    printf("n is still %d\\n", n);',
            '    return 0;',
            '}',
            '',
            'int add(int a, int b) {',
            '    return a + b;',
            '}',
            '',
            'void greet(void) {',
            '    printf("Welcome to Pointer Peak!\\n");',
            '}',
          ],
          caption:
            'The prototypes at the top let main call functions that are defined underneath it.',
        },
        tryIt: {
          language: 'c',
          starter:
            '#include <stdio.h>\n\nint doubleIt(int n) {\n    return n * 2;\n}\n\nint main(void) {\n    printf("%d\\n", doubleIt(21));\n    return 0;\n}\n',
          challenge:
            'Write a function int biggest(int a, int b) that returns the larger of two numbers, and call it. Then move its definition BELOW main and watch it fail to compile — then fix it by adding a prototype at the top.',
          hint: 'Inside biggest: if (a > b) return a; else return b;  The prototype is int biggest(int a, int b);',
        },
        guide: [
          {
            step: 'State the return type',
            body: 'int if it hands back a whole number, void if it hands back nothing.',
          },
          {
            step: 'Type every parameter',
            body: '(int a, int b) — each one needs its own type.',
          },
          {
            step: 'Return a value',
            body: 'return a + b; — the type must match what you declared.',
          },
          {
            step: 'Make sure it is declared first',
            body: 'Define it above main, or add a prototype at the top of the file.',
          },
        ],
        takeaways: [
          'A C function declares its return type and the type of each parameter.',
          'void means "nothing" — as a return type or a parameter list.',
          'C must know about a function before you call it.',
          'A prototype is the header line ending in a semicolon.',
          'Arguments are passed as copies, so the original is untouched.',
        ],
      },
    },
    {
      topic: 'Pointers and Addresses',
      title: 'Pointers and Addresses',
      order: 2,
      language: 'c',
      body: {
        tagline: 'A pointer holds WHERE a value lives, not the value itself.',
        intro:
          'You have already used a pointer without being told: the & in scanf("%d", &age). Every variable lives somewhere in memory, and that somewhere has an address. A pointer is a variable that stores an address. That is the whole idea — and it is what lets a function change the caller\'s variable, which plain arguments could not do.',
        sections: [
          {
            heading: 'Two symbols, opposite jobs',
            body: '& takes the address OF a variable. * goes to the value AT an address. They undo each other: *(&age) is just age. The confusing part is that * also appears in a declaration, where it means "this variable is a pointer".',
            bullets: [
              '&age — the address of age.',
              'int *p — declares p as a pointer to an int.',
              '*p — the value stored at the address in p.',
            ],
          },
          {
            heading: 'Using a pointer',
            body: 'int *p = &age; makes p point at age. Now *p reads age, and *p = 20 CHANGES age. You have two names for the same box: one direct, one by address.',
            bullets: [
              'int *p = &age; — p now points at age.',
              'printf("%d", *p) prints age\'s value.',
              '*p = 20; sets age to 20.',
            ],
          },
          {
            heading: 'Why this solves the copy problem',
            body: 'A function cannot change a variable it was given a copy of. Give it the ADDRESS instead and it can reach the original — which is precisely what scanf does, and why it needed the &. That is the whole reason pointers exist in beginner C.',
            bullets: [
              "void setToTen(int *n) { *n = 10; } changes the caller's variable.",
              'Call it with the address: setToTen(&score);',
              'This is exactly what scanf("%d", &age) has been doing.',
            ],
          },
        ],
        snippet: {
          language: 'c',
          lines: [
            '#include <stdio.h>',
            '',
            'void addTen(int *n) {     /* takes an ADDRESS, not a copy */',
            '    *n = *n + 10;         /* change the value AT that address */',
            '}',
            '',
            'int main(void) {',
            '    int score = 5;',
            '',
            '    int *p = &score;      /* p holds the address of score */',
            '    printf("score is %d\\n", *p);   /* read through the pointer */',
            '',
            '    *p = 7;               /* write through the pointer */',
            '    printf("score is now %d\\n", score);',
            '',
            '    addTen(&score);       /* hand over the address */',
            '    printf("after addTen: %d\\n", score);',
            '    return 0;',
            '}',
          ],
          caption:
            "addTen changes the caller's score because it was given the address. A plain int parameter could not have.",
        },
        tryIt: {
          language: 'c',
          starter:
            '#include <stdio.h>\n\nint main(void) {\n    int age = 11;\n    int *p = &age;\n    printf("age via pointer: %d\\n", *p);\n    return 0;\n}\n',
          challenge:
            'Use the pointer to change age to 12 and print age directly to prove it worked. Then write a function void birthday(int *a) that adds one to whatever it points at, and call it with &age.',
          hint: '*p = 12; changes age. Inside birthday: *a = *a + 1;',
        },
        guide: [
          {
            step: 'Get an address with &',
            body: '&score is where score lives in memory.',
          },
          {
            step: 'Declare a pointer with *',
            body: 'int *p = &score; — p is a pointer to an int.',
          },
          {
            step: 'Follow the pointer with *',
            body: '*p reads the value; *p = 7 writes it.',
          },
          {
            step: 'Pass addresses to change originals',
            body: "A function taking int *n can modify the caller's variable.",
          },
        ],
        takeaways: [
          'Every variable has an address; & gives you it.',
          'A pointer is a variable that stores an address.',
          'int *p declares a pointer; *p reaches the value it points at.',
          'Passing an address lets a function change the original variable.',
          'The & in scanf("%d", &age) was a pointer all along.',
        ],
      },
    },
    {
      topic: 'Structs',
      title: 'Bundling Values with struct',
      order: 3,
      language: 'c',
      body: {
        tagline: 'One name for a group of related values.',
        intro:
          'A pupil has a name, an age and a score. You could keep three separate arrays and hope the indexes stay lined up — or you could describe a Pupil once, with struct, and keep everything about one pupil together. struct is how C builds its own types, and it is the last big idea in this course.',
        sections: [
          {
            heading: 'Describing a struct',
            body: 'struct Pupil { char name[20]; int age; double score; }; describes a shape. It does not create a pupil — it tells the compiler what a pupil looks like. Note the semicolon after the closing brace; leaving it off produces a baffling error.',
            bullets: [
              'The definition describes a shape, not a value.',
              'Each member has its own type, like variables.',
              'A semicolon is required after the closing brace.',
            ],
          },
          {
            heading: 'Creating and using one',
            body: 'struct Pupil p = {"Kodi", 11, 91.5}; creates one and fills it in order. Reach a member with a dot: p.age. You can read and assign members exactly like ordinary variables.',
            bullets: [
              'struct Pupil p = {"Kodi", 11, 91.5};',
              'p.age reads the age; p.age = 12 changes it.',
              'The initialiser values go in declared order.',
            ],
          },
          {
            heading: 'Arrays of structs',
            body: "Once you have a struct, an array of them is a whole class register: struct Pupil class[3];. Then class[0].name is the first pupil's name. This is where structs earn their keep — one loop over one array, instead of three arrays kept in step by hand.",
            bullets: [
              'struct Pupil class[3]; is three pupils.',
              'class[i].score reaches one member of one pupil.',
              'One array of structs beats several parallel arrays.',
            ],
          },
        ],
        snippet: {
          language: 'c',
          lines: [
            '#include <stdio.h>',
            '',
            'struct Pupil {              /* describes the shape */',
            '    char name[20];',
            '    int age;',
            '    double score;',
            '};                          /* this semicolon is required */',
            '',
            'int main(void) {',
            '    struct Pupil p = {"Kodi", 11, 91.5};',
            '    printf("%s is %d and scored %.1f\\n", p.name, p.age, p.score);',
            '',
            '    p.age = 12;                    /* members work like variables */',
            '    printf("%s is now %d\\n", p.name, p.age);',
            '',
            '    struct Pupil class[2] = {',
            '        {"Ada", 10, 88.0},',
            '        {"Alan", 11, 79.5}',
            '    };',
            '    for (int i = 0; i < 2; i++) {',
            '        printf("%s: %.1f\\n", class[i].name, class[i].score);',
            '    }',
            '    return 0;',
            '}',
          ],
          caption:
            'The struct definition sits above main so every function in the file knows what a Pupil is.',
        },
        tryIt: {
          language: 'c',
          starter:
            '#include <stdio.h>\n\nstruct Point {\n    int x;\n    int y;\n};\n\nint main(void) {\n    struct Point a = {3, 4};\n    printf("(%d, %d)\\n", a.x, a.y);\n    return 0;\n}\n',
          challenge:
            'Add a second Point and print both. Then write a function that takes two Points and prints the distance between them — you will need sqrt from <math.h>, which is already linked for you.',
          hint: 'The distance is sqrt((a.x-b.x)*(a.x-b.x) + (a.y-b.y)*(a.y-b.y)). Include <math.h> at the top.',
        },
        guide: [
          {
            step: 'Describe the shape',
            body: 'struct Pupil { ... }; above main — and mind the final semicolon.',
          },
          {
            step: 'Create one',
            body: 'struct Pupil p = {"Kodi", 11, 91.5}; in declared order.',
          },
          {
            step: 'Reach members with a dot',
            body: 'p.age reads it; p.age = 12 changes it.',
          },
          {
            step: 'Make an array for many',
            body: 'struct Pupil class[3]; then class[i].name.',
          },
        ],
        takeaways: [
          'A struct groups related values of different types under one name.',
          'The definition describes a shape; it does not create a value.',
          "A semicolon is required after the struct's closing brace.",
          'Reach a member with a dot: p.age.',
          'An array of structs replaces several parallel arrays kept in step by hand.',
        ],
      },
    },
  ],
};

/**
 * QUIZ BLUEPRINTS for the C course, keyed by world slug.
 *
 * These are PRACTICE, not the final test — so they teach through their
 * explanations rather than merely score. Each targets the mistakes this course
 * knows beginners make: the missing semicolon, `=` for `==`, integer division,
 * the forgotten `&`, the off-by-one, the missing `break`.
 *
 * Every quiz links to a lesson in its own world (`topicLesson`), so a pupil who
 * gets one wrong has somewhere to go back to.
 */
export const C_QUIZ_BLUEPRINTS = {
  'c-workshop': [
    {
      title: 'The Workshop 1: main and #include',
      topicLesson: 'Your First C Program',
      questions: [
        {
          type: 'mcq',
          prompt: 'Where does a C program start running?',
          options: [
            'in a function called main',
            'at the first line of the file',
            'in the #include line',
            'wherever you click',
          ],
          correctAnswer: 'in a function called main',
          explanation:
            'The computer looks for main and begins there, whatever order the file is in.',
        },
        {
          type: 'fillblank',
          prompt: 'To use printf you must include the header ____.',
          correctAnswer: ['stdio.h', '<stdio.h>'],
          explanation:
            'stdio.h is the standard input/output header, and printf lives in it.',
        },
        {
          type: 'mcq',
          prompt: 'What does return 0; at the end of main mean?',
          options: [
            'the program failed',
            'the program finished with no problems',
            'the answer is zero',
            'nothing was printed',
          ],
          correctAnswer: 'the program finished with no problems',
          explanation:
            'Zero is the success code; a non-zero value signals a problem.',
        },
        {
          type: 'mcq',
          prompt: 'Which character ends a statement in C?',
          options: [
            'a new line',
            'a full stop .',
            'a semicolon ;',
            'a colon :',
          ],
          correctAnswer: 'a semicolon ;',
          explanation:
            'C ignores line breaks entirely — the semicolon is what ends a statement.',
        },
        {
          type: 'fillblank',
          prompt:
            'The braces that hold the body of main are called ____ brackets.',
          correctAnswer: ['curly', 'brace', 'curly brackets'],
          explanation:
            'Curly brackets { } group the statements that belong to a block.',
        },
      ],
    },
    {
      title: 'The Workshop 2: printf and Placeholders',
      topicLesson: 'Printing with printf',
      questions: [
        {
          type: 'mcq',
          prompt: 'Which placeholder prints a whole number?',
          options: ['%f', '%c', '%s', '%d'],
          correctAnswer: '%d',
          explanation:
            '%d is for an int. %f is a decimal, %c one character, %s a string.',
        },
        {
          type: 'fillblank',
          prompt: 'The escape sequence that starts a new line is ____.',
          correctAnswer: ['\\n', 'backslash n'],
          explanation:
            'printf does not add a line break on its own — \\n does it.',
        },
        {
          type: 'mcq',
          prompt: 'What does printf("%.2f", 3.5) print?',
          options: ['3.50', '3.5', '3', '3.500000'],
          correctAnswer: '3.50',
          explanation: 'The .2 asks for exactly two decimal places.',
        },
        {
          type: 'mcq',
          prompt: 'What happens if you use %d for a double?',
          options: [
            'it refuses to compile',
            'it prints something meaningless',
            'the program crashes',
            'C converts it for you',
          ],
          correctAnswer: 'it prints something meaningless',
          explanation:
            'A mismatched placeholder is usually just a warning, and the output is nonsense — which is why warnings matter.',
        },
        {
          type: 'fillblank',
          prompt: 'To print a literal percent sign you write ____.',
          correctAnswer: ['%%'],
          explanation:
            'A single % starts a placeholder, so it must be doubled to print one.',
        },
      ],
    },
    {
      title: 'The Workshop 3: Compiling and Errors',
      topicLesson: 'What the Compiler Does',
      questions: [
        {
          type: 'mcq',
          prompt: 'What is a compile error?',
          options: [
            'the program was too slow',
            'a warning you can ignore',
            'your code could not be translated, so nothing ran',
            'the program ran and gave a wrong answer',
          ],
          correctAnswer: 'your code could not be translated, so nothing ran',
          explanation: 'A compile error means no program was produced at all.',
        },
        {
          type: 'mcq',
          prompt: 'You get twenty errors. Which do you fix first?',
          options: [
            'the last one',
            'the shortest one',
            'all at once',
            'the first one',
          ],
          correctAnswer: 'the first one',
          explanation:
            'Later errors are usually knock-ons. Fix the top one and recompile — most often the rest vanish.',
        },
        {
          type: 'fillblank',
          prompt:
            'An error caused by a mistake on line 7 is often reported on line ____.',
          correctAnswer: ['8', 'eight', 'the next line'],
          explanation:
            'A missing semicolon is only noticed when the compiler reaches the next statement.',
        },
        {
          type: 'mcq',
          prompt: 'Does a warning stop your program from being built?',
          options: [
            'no, but it often points at the real bug',
            'yes, always',
            'only in C11',
            'only if there are more than five',
          ],
          correctAnswer: 'no, but it often points at the real bug',
          explanation:
            'Warnings say "this compiled, but I doubt you meant it" — frequently the actual defect.',
        },
        {
          type: 'mcq',
          prompt:
            'A program builds fine but then divides by zero. That is a...',
          options: [
            'syntax error',
            'runtime error',
            'compile error',
            'warning',
          ],
          correctAnswer: 'runtime error',
          explanation:
            'It translated successfully; the problem happened while running.',
        },
      ],
    },
  ],

  'c-type-town': [
    {
      title: 'Type Town 1: Declaring Variables',
      topicLesson: 'Types and Variables',
      questions: [
        {
          type: 'mcq',
          prompt: 'Which type holds a whole number?',
          options: ['char', 'float only', 'int', 'double'],
          correctAnswer: 'int',
          explanation: 'int is C’s whole-number type.',
        },
        {
          type: 'fillblank',
          prompt: 'The type used for a single character is ____.',
          correctAnswer: ['char'],
          explanation: 'A char holds one character, written in single quotes.',
        },
        {
          type: 'mcq',
          prompt: 'What does int n = 3.9; store in n?',
          options: ['4', '3.9', 'it will not compile', '3'],
          correctAnswer: '3',
          explanation:
            'C truncates towards zero when storing a decimal in an int — it does not round.',
        },
        {
          type: 'mcq',
          prompt: 'What is the difference between \'A\' and "A" in C?',
          options: [
            '\'A\' is one char; "A" is text',
            'they are identical',
            '"A" is one char; \'A\' is text',
            'only "A" compiles',
          ],
          correctAnswer: '\'A\' is one char; "A" is text',
          explanation:
            'Single quotes make a char; double quotes make a string, which carries a hidden terminator.',
        },
        {
          type: 'fillblank',
          prompt: 'A variable you declare but never set contains ____ value.',
          correctAnswer: [
            'an unpredictable',
            'unpredictable',
            'a random',
            'rubbish',
          ],
          explanation: 'C does not zero it for you, so always initialise.',
        },
      ],
    },
    {
      title: 'Type Town 2: Reading Input',
      topicLesson: 'Reading Input with scanf',
      questions: [
        {
          type: 'mcq',
          prompt: 'Why does scanf need an & before the variable?',
          options: [
            'so it gets the address and can change your variable',
            'to make it faster',
            'it is optional decoration',
            'to mark the end of input',
          ],
          correctAnswer: 'so it gets the address and can change your variable',
          explanation:
            'Without the address scanf would only change a copy — the & is a pointer.',
        },
        {
          type: 'fillblank',
          prompt: 'To read a double with scanf you use the placeholder ____.',
          correctAnswer: ['%lf'],
          explanation:
            'scanf needs %lf for a double, even though printf uses %f to show one.',
        },
        {
          type: 'mcq',
          prompt: 'What does scanf return?',
          options: [
            'nothing',
            'how many values it successfully read',
            'the value it read',
            'zero always',
          ],
          correctAnswer: 'how many values it successfully read',
          explanation:
            'Comparing it against how many you asked for is how you detect bad input.',
        },
        {
          type: 'mcq',
          prompt:
            'A user types "hello" when you asked for a number. What happens to your variable?',
          options: [
            'the program crashes',
            'it becomes "hello"',
            'it keeps whatever it had before',
            'it becomes zero',
          ],
          correctAnswer: 'it keeps whatever it had before',
          explanation:
            'scanf reads nothing and returns 0, leaving the variable untouched — which is why an uninitialised one is dangerous here.',
        },
        {
          type: 'mcq',
          prompt: 'Why does printf NOT need an &?',
          options: [
            'it is a newer function',
            'it does need one',
            'because of stdio.h',
            'it only reads the value, it does not change it',
          ],
          correctAnswer: 'it only reads the value, it does not change it',
          explanation:
            'Reading a copy is fine; only writing needs the address.',
        },
      ],
    },
    {
      title: 'Type Town 3: Maths and Division',
      topicLesson: 'Maths and Integer Division',
      questions: [
        {
          type: 'mcq',
          prompt: 'What is 7 / 2 in C, when both are ints?',
          options: ['3', '3.5', '4', '3.50000'],
          correctAnswer: '3',
          explanation:
            'int divided by int gives an int, and the fraction is discarded.',
        },
        {
          type: 'fillblank',
          prompt: 'The operator that gives the remainder is ____.',
          correctAnswer: ['%', 'modulo', 'the percent sign'],
          explanation: '7 % 2 is 1. It works on whole numbers only.',
        },
        {
          type: 'mcq',
          prompt: 'How do you make 7 / 2 give 3.5?',
          options: [
            'add brackets',
            'make one side a double, e.g. 7 / 2.0',
            'use %f in the printf',
            'nothing, C cannot do it',
          ],
          correctAnswer: 'make one side a double, e.g. 7 / 2.0',
          explanation:
            'One double makes the whole expression a double. Changing only the placeholder does not change the arithmetic.',
        },
        {
          type: 'mcq',
          prompt: 'What does count++ do?',
          options: [
            'prints count',
            'resets count',
            'adds one to count',
            'doubles count',
          ],
          correctAnswer: 'adds one to count',
          explanation: 'It is shorthand for count = count + 1.',
        },
        {
          type: 'fillblank',
          prompt:
            'An average that comes out suspiciously round is usually caused by ____ division.',
          correctAnswer: ['integer', 'int'],
          explanation: 'Both operands being ints throws the decimals away.',
        },
      ],
    },
  ],

  'c-decision-docks': [
    {
      title: 'Decision Docks 1: if and else',
      topicLesson: 'Making Decisions with if',
      questions: [
        {
          type: 'mcq',
          prompt: 'Which operator asks "are these two equal?"',
          options: ['=', '!=', '=>', '=='],
          correctAnswer: '==',
          explanation: 'A single = assigns a value; == compares.',
        },
        {
          type: 'mcq',
          prompt: 'What does if (x = 5) actually do?',
          options: [
            'sets x to 5 and always runs the block',
            'tests whether x is 5',
            'refuses to compile',
            'never runs the block',
          ],
          correctAnswer: 'sets x to 5 and always runs the block',
          explanation:
            'It assigns 5, and 5 is non-zero, so the condition is always true. The classic C bug.',
        },
        {
          type: 'fillblank',
          prompt: 'C spells "else if" — it does NOT have the keyword ____.',
          correctAnswer: ['elif'],
          explanation: 'elif is Python. C uses else if.',
        },
        {
          type: 'mcq',
          prompt: 'In C, which values count as true?',
          options: [
            'only positive numbers',
            'every number except 0',
            'only 1',
            'only true',
          ],
          correctAnswer: 'every number except 0',
          explanation: 'Zero is false; -3, 1 and 42 are all true.',
        },
        {
          type: 'mcq',
          prompt: 'Does C care how you indent your if block?',
          options: [
            'only inside functions',
            'only for else',
            'no, but readers do',
            'yes, like Python',
          ],
          correctAnswer: 'no, but readers do',
          explanation:
            'Braces define the block; indentation is purely for humans.',
        },
      ],
    },
    {
      title: 'Decision Docks 2: Combining Conditions',
      topicLesson: 'Combining Conditions',
      questions: [
        {
          type: 'mcq',
          prompt: 'Which operator means "and"?',
          options: ['||', '!', '&', '&&'],
          correctAnswer: '&&',
          explanation:
            '&& is true only when both sides are. A single & is a different, bitwise operator.',
        },
        {
          type: 'fillblank',
          prompt: 'The operator that means "or" is ____.',
          correctAnswer: ['||'],
          explanation: 'Two vertical bars. One is a bitwise operator.',
        },
        {
          type: 'mcq',
          prompt: 'In a && b, when is b skipped?',
          options: [
            'when a is false',
            'when a is true',
            'never',
            'when b is false',
          ],
          correctAnswer: 'when a is false',
          explanation:
            'Short-circuiting: the answer is already known, so b is never evaluated.',
        },
        {
          type: 'mcq',
          prompt: 'What is wrong with if (0 < x < 10)?',
          options: [
            'it only works for x below 10',
            'it compiles but is always true',
            'it will not compile',
            'nothing, it is correct',
          ],
          correctAnswer: 'it compiles but is always true',
          explanation:
            '0 < x gives 1 or 0, and both are less than 10. Write 0 < x && x < 10.',
        },
        {
          type: 'mcq',
          prompt: 'What does !ready mean?',
          options: [
            'ready is not declared',
            'not equal to ready',
            'true when ready is zero',
            'the opposite of ready’s value',
          ],
          correctAnswer: 'true when ready is zero',
          explanation:
            '! flips a condition: it is true exactly when its operand is false, i.e. zero.',
        },
      ],
    },
    {
      title: 'Decision Docks 3: switch',
      topicLesson: 'Choosing with switch',
      questions: [
        {
          type: 'mcq',
          prompt: 'What happens if you forget break in a case?',
          options: [
            'the program crashes',
            'nothing runs',
            'it will not compile',
            'the next case runs too',
          ],
          correctAnswer: 'the next case runs too',
          explanation:
            'That is fall-through, and a missing break is one of the most common C mistakes.',
        },
        {
          type: 'fillblank',
          prompt: 'The label that catches every unlisted value is ____.',
          correctAnswer: ['default'],
          explanation: 'default runs when no case matched.',
        },
        {
          type: 'mcq',
          prompt: 'Which can a switch match on?',
          options: [
            'an int or a char',
            'a double',
            'a string',
            'anything at all',
          ],
          correctAnswer: 'an int or a char',
          explanation: 'switch works on whole-number-like values only.',
        },
        {
          type: 'mcq',
          prompt:
            'Why stack case 1: case 2: case 3: with no code between them?',
          options: [
            'to skip those values',
            'so all three run the same body',
            'to make it faster',
            'it is a mistake',
          ],
          correctAnswer: 'so all three run the same body',
          explanation: 'This is the one genuinely useful use of fall-through.',
        },
        {
          type: 'mcq',
          prompt: 'When is a switch clearer than a chain of else ifs?',
          options: [
            'when comparing strings',
            'always',
            'when one value decides between many paths',
            'when testing ranges of numbers',
          ],
          correctAnswer: 'when one value decides between many paths',
          explanation: 'For ranges or text, else if is the right tool.',
        },
      ],
    },
  ],

  'c-loop-lagoon': [
    {
      title: 'Loop Lagoon 1: for Loops',
      topicLesson: 'Counting with for',
      questions: [
        {
          type: 'mcq',
          prompt: 'How many times does for (int i = 0; i < 5; i++) run?',
          options: ['4', '6', 'forever', '5'],
          correctAnswer: '5',
          explanation: 'i takes the values 0,1,2,3,4 — five passes.',
        },
        {
          type: 'fillblank',
          prompt: 'The three parts of a for loop are separated by ____.',
          correctAnswer: ['semicolons', 'semicolon', ';'],
          explanation: 'Setup; condition; step — semicolons, not commas.',
        },
        {
          type: 'mcq',
          prompt: 'Which part of a for loop runs only once?',
          options: ['the setup', 'the condition', 'the step', 'the body'],
          correctAnswer: 'the setup',
          explanation:
            'int i = 0 runs once at the start; the others run every pass.',
        },
        {
          type: 'mcq',
          prompt: 'Using i <= 5 instead of i < 5 gives you...',
          options: ['an error', 'one extra pass', 'one fewer pass', 'the same'],
          correctAnswer: 'one extra pass',
          explanation:
            'This is the off-by-one bug, and past the end of a 5-element array it reads memory that is not yours.',
        },
        {
          type: 'mcq',
          prompt: 'What does continue do?',
          options: [
            'restarts the loop from zero',
            'nothing',
            'skips to the next pass',
            'leaves the loop',
          ],
          correctAnswer: 'skips to the next pass',
          explanation:
            'break leaves the loop; continue only abandons the current pass.',
        },
      ],
    },
    {
      title: 'Loop Lagoon 2: while and do-while',
      topicLesson: 'while and do-while',
      questions: [
        {
          type: 'mcq',
          prompt: 'When does a while loop check its condition?',
          options: [
            'after every pass',
            'only once',
            'only at the end',
            'before every pass, including the first',
          ],
          correctAnswer: 'before every pass, including the first',
          explanation:
            'So a condition that starts false means the body never runs.',
        },
        {
          type: 'mcq',
          prompt: 'How many times does a do-while body run at minimum?',
          options: ['once', 'zero', 'twice', 'it depends on the condition'],
          correctAnswer: 'once',
          explanation: 'The body runs before the condition is ever tested.',
        },
        {
          type: 'fillblank',
          prompt: 'A do-while ends with a ____ after the condition.',
          correctAnswer: ['semicolon', ';'],
          explanation: '} while (x > 0); — leaving it off is a compile error.',
        },
        {
          type: 'mcq',
          prompt: 'What causes an infinite loop?',
          options: [
            'too many passes',
            'nothing in the body changes the condition',
            'using while instead of for',
            'a missing break',
          ],
          correctAnswer: 'nothing in the body changes the condition',
          explanation: 'Forgetting count-- is the usual cause.',
        },
        {
          type: 'mcq',
          prompt:
            'You must ask the user until they give a valid answer. Which loop fits best?',
          options: ['while', 'switch', 'do-while', 'for'],
          correctAnswer: 'do-while',
          explanation:
            'You always need to ask at least once, which is exactly what do-while guarantees.',
        },
      ],
    },
    {
      title: 'Loop Lagoon 3: Arrays and Strings',
      topicLesson: 'Arrays and Strings',
      questions: [
        {
          type: 'mcq',
          prompt: 'For int scores[5], what is the last valid index?',
          options: ['5', '6', '0', '4'],
          correctAnswer: '4',
          explanation: 'Indexes run 0 to size-1. scores[5] is past the end.',
        },
        {
          type: 'mcq',
          prompt: 'What happens if you read scores[9] from a 5-element array?',
          options: [
            'you silently get meaningless memory',
            'C raises an error',
            'you get zero',
            'the program will not compile',
          ],
          correctAnswer: 'you silently get meaningless memory',
          explanation:
            'C does not check bounds. This silence is what makes the off-by-one so dangerous.',
        },
        {
          type: 'fillblank',
          prompt:
            'A C string is an array of char ending in the ____ character.',
          correctAnswer: ['\\0', 'null', 'zero', 'terminator'],
          explanation:
            'The \\0 terminator is how every C function knows where the text stops.',
        },
        {
          type: 'mcq',
          prompt: 'How many chars does "Kodi" occupy?',
          options: ['1', '5', '4', '6'],
          correctAnswer: '5',
          explanation: 'Four letters plus the hidden \\0.',
        },
        {
          type: 'mcq',
          prompt: 'Can a C array grow after you declare it?',
          options: [
            'only if it holds ints',
            'only inside a loop',
            'no, its size is fixed',
            'yes, like a Python list',
          ],
          correctAnswer: 'no, its size is fixed',
          explanation: 'The size is decided at declaration and cannot change.',
        },
      ],
    },
  ],

  'c-pointer-peak': [
    {
      title: 'Pointer Peak 1: Functions',
      topicLesson: 'Writing Your Own Functions',
      questions: [
        {
          type: 'mcq',
          prompt: 'What does void as a return type mean?',
          options: [
            'it returns zero',
            'it takes no parameters',
            'it never ends',
            'the function gives nothing back',
          ],
          correctAnswer: 'the function gives nothing back',
          explanation:
            'void in the parameter list separately means it takes nothing.',
        },
        {
          type: 'mcq',
          prompt: 'Why write a prototype at the top of the file?',
          options: [
            'so main can call a function defined below it',
            'to make it run faster',
            'to give it a second name',
            'it is never needed',
          ],
          correctAnswer: 'so main can call a function defined below it',
          explanation:
            'C reads top to bottom and must know a function exists before you call it.',
        },
        {
          type: 'fillblank',
          prompt:
            'A prototype is the header line ending in a ____ instead of a body.',
          correctAnswer: ['semicolon', ';'],
          explanation: 'int add(int a, int b); — no braces.',
        },
        {
          type: 'mcq',
          prompt:
            'You pass n to a function and it changes its parameter. What happens to n?',
          options: [
            'the program crashes',
            'nothing — the function got a copy',
            'it changes too',
            'it becomes zero',
          ],
          correctAnswer: 'nothing — the function got a copy',
          explanation: 'This is exactly the problem pointers solve.',
        },
        {
          type: 'mcq',
          prompt: 'Is int add(int a, b) valid?',
          options: [
            'only in C11',
            'only if a and b are both ints',
            'no, every parameter needs its own type',
            'yes',
          ],
          correctAnswer: 'no, every parameter needs its own type',
          explanation: 'It must be (int a, int b).',
        },
      ],
    },
    {
      title: 'Pointer Peak 2: Pointers',
      topicLesson: 'Pointers and Addresses',
      questions: [
        {
          type: 'mcq',
          prompt: 'What does a pointer store?',
          options: [
            'a copy of a value',
            'a type name',
            'a function',
            'an address in memory',
          ],
          correctAnswer: 'an address in memory',
          explanation: 'It holds WHERE a value lives, not the value itself.',
        },
        {
          type: 'fillblank',
          prompt:
            'The operator that gives you the address of a variable is ____.',
          correctAnswer: ['&', 'ampersand'],
          explanation:
            '&age is the address of age — the same & that scanf needed.',
        },
        {
          type: 'mcq',
          prompt: 'If int *p = &score, what does *p = 7 do?',
          options: [
            'sets score to 7',
            'sets p to 7',
            'compares p with 7',
            'nothing',
          ],
          correctAnswer: 'sets score to 7',
          explanation:
            '* follows the pointer to the value it points at, so writing through it changes score.',
        },
        {
          type: 'mcq',
          prompt: 'How can a function change the caller’s variable?',
          options: [
            'it cannot',
            'take a pointer and be given the address',
            'take the value and change it',
            'declare it twice',
          ],
          correctAnswer: 'take a pointer and be given the address',
          explanation: 'void addTen(int *n) called as addTen(&score).',
        },
        {
          type: 'mcq',
          prompt: 'The & in scanf("%d", &age) is...',
          options: [
            'the "and" operator',
            'optional',
            'a pointer — the address of age',
            'a formatting mark',
          ],
          correctAnswer: 'a pointer — the address of age',
          explanation: 'You have been using a pointer since your first scanf.',
        },
      ],
    },
    {
      title: 'Pointer Peak 3: Structs',
      topicLesson: 'Bundling Values with struct',
      questions: [
        {
          type: 'mcq',
          prompt: 'What is a struct for?',
          options: [
            'storing many values of the same type',
            'repeating code',
            'making decisions',
            'grouping related values of different types under one name',
          ],
          correctAnswer:
            'grouping related values of different types under one name',
          explanation:
            'An array holds many of ONE type; a struct holds several different ones together.',
        },
        {
          type: 'fillblank',
          prompt: 'You reach a member of a struct with a ____.',
          correctAnswer: ['dot', '.', 'full stop'],
          explanation: 'p.age reads the age member.',
        },
        {
          type: 'mcq',
          prompt: 'What must follow the closing brace of a struct definition?',
          options: ['a semicolon', 'nothing', 'the word end', 'a comma'],
          correctAnswer: 'a semicolon',
          explanation:
            'Leaving it off produces a confusing error on the following lines.',
        },
        {
          type: 'mcq',
          prompt: 'Does struct Pupil { ... }; create a pupil?',
          options: [
            'only inside main',
            'no, it only describes the shape',
            'yes, one pupil',
            'yes, an array of pupils',
          ],
          correctAnswer: 'no, it only describes the shape',
          explanation: 'You still need struct Pupil p = {...}; to make one.',
        },
        {
          type: 'mcq',
          prompt:
            'Why is one array of structs better than three parallel arrays?',
          options: [
            'it is the only way that compiles',
            'arrays cannot be parallel',
            'everything about one item stays together',
            'it uses less memory',
          ],
          correctAnswer: 'everything about one item stays together',
          explanation:
            'Parallel arrays must be kept in step by hand, and drift is a silent bug.',
        },
      ],
    },
  ],
};

export default { C_WORLDS, C_LESSON_CONTENT, C_QUIZ_BLUEPRINTS };

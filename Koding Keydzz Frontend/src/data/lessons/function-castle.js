// Function Castle — fully authored topic lessons.
//
// Same schema and quality bar as coding-forest.js (see ./index.js): title,
// tagline, intro, sections, snippet, tryIt, guide, takeaways. Rich, correct,
// kid-friendly (8–16yo) Python content. Every snippet and tryIt is real,
// runnable Python 3.
//
// Topic keys are lower-case so getLesson() can match whatever casing the API
// sends for world.topics ("Functions", "Parameters", "Return Values").

const lessons = {
  functions: {
    title: 'Functions',
    tagline: 'Build a machine once, then use it again and again.',
    intro:
      'A function is a reusable machine: you build it once, give it a name, and call on it whenever you need its work done. Instead of copying the same lines all over your program, you wrap them in a function and just say its name. Functions keep your code tidy, save you from repeating yourself, and let you name a task so the rest of your code reads like plain English.',
    sections: [
      {
        heading: 'Why functions exist',
        body:
          'Imagine writing the same ten lines to draw a castle in five different places. If you find a bug, you must fix it five times! A function lets you write those lines once, name them draw_castle, and reuse them everywhere. Functions give you three big wins.',
        bullets: [
          'Reuse — write it once, use it as many times as you like.',
          'Organise — a big program becomes a set of small, named machines.',
          'Name a task — greet() explains itself better than five loose lines.',
          'Fix once — change the function in one place and every call gets the fix.',
        ],
      },
      {
        heading: 'Defining a function',
        body:
          'You build a function with the word def, a name, a pair of brackets, and a colon. The lines that do the work go INDENTED underneath. Defining a function only builds the machine — it does not run it yet.',
        bullets: [
          'def greet(): starts a function definition named greet.',
          'The brackets () will later hold inputs (parameters).',
          'The colon : and indentation mark the function body.',
          'Choose a clear, verb-like name: greet, save_score, roll_dice.',
        ],
      },
      {
        heading: 'Defining vs calling',
        body:
          'This is the idea that unlocks functions: defining and calling are two separate steps. def builds the machine but does not switch it on. Writing the name with brackets — greet() — is what actually runs it.',
        bullets: [
          'Defining (def greet():) builds the machine but runs nothing.',
          'Calling (greet()) switches the machine on and runs its body.',
          'You must define a function BEFORE you call it.',
          'Nothing you put in a function happens until it is called.',
        ],
      },
      {
        heading: 'Calling it many times',
        body:
          'The whole point of a function is reuse. Once it is defined, you can call it as often as you like, and its body runs fresh every single time. That is how one small definition can do a lot of work.',
        bullets: [
          'Each call runs the whole body again from the top.',
          'greet() written three times greets three times.',
          'Calls can even be inside loops: for i in range(3): greet().',
          'One definition, unlimited calls.',
        ],
      },
    ],
    snippet: {
      language: 'python',
      lines: [
        '# Define the machine once',
        'def greet():',
        '    print("Welcome to the castle!")',
        '',
        '# Now switch it on as many times as we like',
        'greet()   # call the machine',
        'greet()   # use it again',
      ],
      caption: 'def builds greet; each greet() call runs its body afresh.',
    },
    tryIt: {
      language: 'python',
      starter:
        '# Define and call a function.\n' +
        'def cheer():\n' +
        '    print("You can do it!")\n' +
        '\n' +
        'cheer()\n',
      challenge:
        'Make a function called wave that prints a friendly wave message, then call it three times.',
      hint:
        'Define it with def wave(): and an indented print inside. Then write wave() on three separate lines below the definition.',
    },
    guide: [
      {
        step: 'Decide what task to name',
        body:
          'Spot some lines you repeat, or a job worth naming. That job becomes your function — for example, greeting the player.',
      },
      {
        step: 'Define with def',
        body:
          'Write def, a clear name, brackets and a colon: def greet():. This starts a new function definition.',
      },
      {
        step: 'Indent the body',
        body:
          'The code the function should run is indented underneath the def line. That indented block is the machine\'s job.',
      },
      {
        step: 'Remember: defining is not running',
        body:
          'Writing def only builds the machine. Nothing inside runs until you actually call it.',
      },
      {
        step: 'Call it by name',
        body:
          'Write the name with brackets, greet(), to switch the machine on and run its body.',
      },
      {
        step: 'Reuse it freely',
        body:
          'Call the same function as many times as you need. Each call runs the body again from the start.',
      },
    ],
    takeaways: [
      'A function is a reusable, named block of code.',
      'Define it with def name(): and an indented body.',
      'Defining builds the machine; calling name() runs it.',
      'Functions let you reuse code, organise programs, and name tasks.',
      'One definition can be called as many times as you like.',
    ],
  },

  parameters: {
    title: 'Parameters',
    tagline: 'The ingredients you hand your machine.',
    intro:
      'Parameters let a function work on different things each time you call it. Instead of always doing the exact same job, the function accepts inputs — like ingredients handed into a recipe — and uses them inside its body. One greet function can then welcome Aria, Sam, or anyone else, all depending on what you pass in.',
    sections: [
      {
        heading: 'Passing in a value',
        body:
          'To give a function an input, put a parameter name inside its brackets when you define it. When you call the function, you hand in a real value that flows into that parameter for that one run.',
        bullets: [
          'def greet(name): defines a function that expects one input.',
          'Inside the body, name behaves just like a variable.',
          'greet("Aria") sends "Aria" in, so name becomes "Aria" for that call.',
          'The same function gives different results for different inputs.',
        ],
      },
      {
        heading: 'Argument vs parameter',
        body:
          'These two words are easy to mix up. A parameter is the name in the definition — the empty slot. An argument is the actual value you pass in when you call. Same slot, different fillings each time.',
        bullets: [
          'Parameter — the name in the definition: def greet(name).',
          'Argument — the real value you pass: greet("Sam").',
          'Think of the parameter as a labelled cup, the argument as the drink poured in.',
          'One parameter can receive a different argument on every call.',
        ],
      },
      {
        heading: 'Several parameters (positional)',
        body:
          'A function can take more than one input — just separate the parameters with commas. When you call it, the arguments line up by POSITION: the first argument fills the first parameter, the second fills the second, and so on. So order matters!',
        bullets: [
          'def power(base, exp): takes two inputs.',
          'power(2, 3) sets base = 2 and exp = 3 (first goes to first).',
          'Swapping the order swaps the meaning: power(3, 2) is different.',
          'These are called positional arguments because position decides the match.',
        ],
      },
      {
        heading: 'Default parameter values',
        body:
          'You can give a parameter a default value in the definition using an equals sign. If the caller leaves that argument out, the default is used. This makes some inputs optional and keeps common calls short.',
        bullets: [
          'def power(base, exp=2): makes exp default to 2.',
          'power(5) uses the default, so exp is 2 and you get 25.',
          'power(5, 3) overrides the default, so exp is 3 and you get 125.',
          'Parameters with defaults must come AFTER ones without.',
        ],
      },
    ],
    snippet: {
      language: 'python',
      lines: [
        '# One parameter: name',
        'def greet(name):',
        '    print("Hello,", name)',
        '',
        'greet("Aria")',
        'greet("Sam")',
        '',
        '# Two parameters, one with a default',
        'def power(base, exp=2):',
        '    print(base, "to the", exp, "=", base ** exp)',
        '',
        'power(5)      # uses the default exp = 2  -> 25',
        'power(2, 3)   # overrides exp = 3          -> 8',
      ],
      caption: 'Arguments fill parameters by position; exp=2 supplies a default.',
    },
    tryIt: {
      language: 'python',
      starter:
        '# A function with a parameter.\n' +
        'def greet(name):\n' +
        '    print("Hi,", name)\n' +
        '\n' +
        'greet("Coder")\n',
      challenge:
        'Add a second parameter for age so the function prints "Aria is 12 years old", then call it with greet("Aria", 12).',
      hint:
        'Change the definition to def greet(name, age): and print(name, "is", age, "years old"). Then call greet("Aria", 12) — the values line up by position.',
    },
    guide: [
      {
        step: 'Add a parameter slot',
        body:
          'Put a name inside the brackets of the definition: def greet(name):. That name is the input the function expects.',
      },
      {
        step: 'Use it inside the body',
        body:
          'Inside the function, the parameter behaves like a normal variable holding whatever was passed in.',
      },
      {
        step: 'Pass an argument when calling',
        body:
          'Give a real value in the brackets when you call: greet("Aria"). That value flows into the parameter.',
      },
      {
        step: 'Add more, separated by commas',
        body:
          'Need more inputs? List several parameters: def power(base, exp):. Arguments match them by position, left to right.',
      },
      {
        step: 'Mind the order',
        body:
          'The first argument fills the first parameter. Swapping the order changes the meaning, so keep them lined up.',
      },
      {
        step: 'Set defaults for optional inputs',
        body:
          'Write exp=2 in the definition to give a fallback. Callers can leave it out to use the default, or pass a value to override it.',
      },
    ],
    takeaways: [
      'Parameters are the named input slots in a function definition.',
      'Arguments are the real values you pass when you call it.',
      'Multiple positional arguments match parameters by their order.',
      'A default like exp=2 makes an input optional.',
      'Parameters let one function handle many different inputs.',
    ],
  },

  'return values': {
    title: 'Return Values',
    tagline: 'The prize your function hands back.',
    intro:
      'A return value is the result a function gives back after it finishes its work. Instead of only printing something on the screen, a function can hand you an answer that you catch in a variable and reuse later. This is the difference between a machine that just flashes a light and one that hands you a finished product you can carry away.',
    sections: [
      {
        heading: 'The return keyword',
        body:
          'The return keyword sends a value back to whoever called the function, and it ends the function right there. Whatever you write after return is the answer the call becomes.',
        bullets: [
          'return a + b hands the sum back to the caller.',
          'return immediately ends the function — lines after it do not run.',
          'A function can compute something complex, then return just the answer.',
          'Without return, a function hands back None (nothing useful).',
        ],
      },
      {
        heading: 'Capturing the result',
        body:
          'A returned value is worthless if you throw it away. Catch it in a variable, and now you own the answer — you can print it, do maths with it, or pass it into another function.',
        bullets: [
          'total = add(2, 3) stores the returned 5 in total.',
          'The call add(2, 3) becomes its return value right where you wrote it.',
          'You can use the returned value straight away: print(add(2, 3)).',
          'Store it once and reuse it many times.',
        ],
      },
      {
        heading: 'return vs print',
        body:
          'This is the trickiest idea in the whole topic. print shows a value on the screen for a human to read — but the program cannot reuse it. return hands the value back to the program so it CAN be reused. print is for people; return is for your code.',
        bullets: [
          'print(a + b) shows the answer but nothing keeps it.',
          'return a + b gives the answer back so you can store and reuse it.',
          'A function that returns can feed its answer into other code.',
          'You often return the answer, then print the returned value separately.',
        ],
      },
      {
        heading: 'Functions that return nothing (None)',
        body:
          'Not every function returns a useful value. If a function has no return statement (or a bare return), Python quietly hands back a special value called None, which means "nothing here". That is fine for functions whose job is just to do something, like printing.',
        bullets: [
          'A function with no return gives back None automatically.',
          'None means "no value" — it is not zero and not empty text.',
          'A print-only function does its job but returns None.',
          'Do not try to store and reuse the result of a None-returning function as an answer.',
        ],
      },
    ],
    snippet: {
      language: 'python',
      lines: [
        '# A function that returns its result',
        'def add(a, b):',
        '    return a + b',
        '',
        '# Catch the returned value in a variable',
        'total = add(2, 3)',
        'print("The total is", total)   # 5',
        '',
        '# Reuse it — the answer is a real value',
        'print("Double that is", total * 2)   # 10',
      ],
      caption: 'add hands back a + b; we store it in total and reuse it.',
    },
    tryIt: {
      language: 'python',
      starter:
        '# A function that returns a value.\n' +
        'def double(n):\n' +
        '    return n * 2\n' +
        '\n' +
        'print(double(5))\n',
      challenge:
        'Write a function square(n) that RETURNS n times itself, store square(4) in a variable, and print it (it should be 16).',
      hint:
        'Inside the function write return n * n. Then result = square(4) and print(result). Use return, not print, so the answer can be stored.',
    },
    guide: [
      {
        step: 'Do the work, then return',
        body:
          'Inside the function, compute what you need, then hand the answer back with return, for example return a + b.',
      },
      {
        step: 'Know that return ends the function',
        body:
          'As soon as return runs, the function stops. Any lines written after it never execute.',
      },
      {
        step: 'Catch the result',
        body:
          'The call becomes its returned value, so store it: total = add(2, 3). Now total holds the answer.',
      },
      {
        step: 'Choose return over print to reuse',
        body:
          'print only shows a value; return gives it back to your code. Return when you need to keep or reuse the answer.',
      },
      {
        step: 'Reuse the answer anywhere',
        body:
          'A returned value is an ordinary value — print it, add to it, or feed it into another function.',
      },
      {
        step: 'Remember None',
        body:
          'A function with no return hands back None, meaning "nothing". Do not try to reuse that as a real answer.',
      },
    ],
    takeaways: [
      'return sends a value back from a function and ends it.',
      'Catch the returned value in a variable to keep and reuse it.',
      'return gives a value to your code; print only shows it to a person.',
      'A function with no return hands back None (nothing useful).',
      'Returning a computed result lets one function feed another.',
    ],
  },
}

export default lessons

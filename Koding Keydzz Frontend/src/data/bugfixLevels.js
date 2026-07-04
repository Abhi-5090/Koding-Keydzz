// Bug Fix Challenge — 18 question-set levels (ids 1..18) teaching DEBUGGING.
// Each level shows short buggy snippets (Python or JS) in q.code and asks the
// player to spot the bug, pick the correct fix, or predict the output. Bugs
// ramp from beginner typos (= vs ==) to off-by-one, scope, and logic errors.
//
// Level shape (consumed by QuestionLevelGame):
//   { id, name, difficulty:'easy'|'medium'|'hard', intro?, questions:[ q ] }
// Every question carries `code` and a one-line `explain` (shown on a wrong pick).

const mcq = (prompt, code, options, answer, explain) => ({ type: 'mcq', prompt, code, options, answer, explain })
const tf = (prompt, code, answer, explain) => ({ type: 'truefalse', prompt, code, answer, explain })

const levels = [
  // ===== EASY 1–8 =====
  {
    id: 1,
    name: 'First Squashes',
    difficulty: 'easy',
    intro: 'Welcome, bug hunter! Spot these beginner slip-ups.',
    questions: [
      mcq('This loop won’t run. What’s the bug?', 'for i in range(5)\n    print(i)', ['Missing a colon after range(5)', 'range should be loop', 'print is misspelled', 'Use a while loop'], 0, 'Python needs a colon ( : ) after the for statement: for i in range(5):'),
      mcq('Running this throws a NameError. Why?', 'name = "Alex"\nprint("Hi " + nam)', ['"nam" should be "name"', 'You can’t add strings', '"Hi" needs no quotes', 'print needs a semicolon'], 0, 'The variable is "name", but the code uses "nam" — a typo.'),
      mcq('add(2, 3) returns -1 instead of 5. Fix it.', 'def add(a, b):\n    return a - b', ['Change - to + in the return', 'Swap a and b', 'Rename the function', 'Add a print'], 0, 'It subtracts instead of adding — use a + b.'),
      mcq('This comparison is broken. What’s wrong?', 'x = 10\nif x = 5:\n    print("five")', ['Use == to compare, not =', 'Use > instead', 'Remove the if', 'Change x to 5'], 0, '"=" assigns a value; "==" compares. The if needs ==.'),
    ],
  },
  {
    id: 2,
    name: 'Print Problems',
    difficulty: 'easy',
    intro: 'Will it print what we expect? Read carefully.',
    questions: [
      tf('Will this print 5?', 'x = 2\ny = 3\nprint(x + y)', true, '2 + 3 = 5, so it prints 5.'),
      tf('Will this print 23?', 'x = "2"\ny = "3"\nprint(x + y)', true, 'These are strings, so + joins them → "23".'),
      mcq('This prints nothing. What’s missing?', 'message = "Hello!"\n', ['A print(message) line', 'A loop', 'A return', 'Quotes around Hello'], 0, 'The value is stored but never printed — add print(message).'),
      mcq('What prints?', 'print("5" * 3)', ['15', '555', '5 5 5', 'Error'], 1, 'In Python, "5" * 3 repeats the string → "555".'),
    ],
  },
  {
    id: 3,
    name: 'Missing Pieces',
    difficulty: 'easy',
    intro: 'Something small is missing. Can you find it?',
    questions: [
      mcq('This Python if has an error. What’s wrong?', 'if score > 10\n    print("win")', ['Missing a colon after > 10', 'score is undefined', 'print is wrong', 'Need elif'], 0, 'Python needs a colon after the if condition: if score > 10:'),
      mcq('This JavaScript line errors. What’s the bug?', 'let total = (3 + 4', ['A closing parenthesis ) is missing', 'let is wrong', 'Use == ', 'total is reserved'], 0, 'The opening "(" is never closed — add ")".'),
      mcq('The function gives no value back. Why?', 'def double(n):\n    answer = n * 2', ['It’s missing a return statement', 'n is undefined', 'Use print', '* should be +'], 0, 'It computes answer but never returns it — add "return answer".'),
      tf('Will this print "Hi"?', 'greeting = "Hi"\nprint(greeting)', true, 'greeting holds "Hi", and it is printed.'),
    ],
  },
  {
    id: 4,
    name: 'Equals Trouble',
    difficulty: 'easy',
    intro: 'The classic = vs == mix-up strikes again.',
    questions: [
      mcq('Which fix makes this compare correctly?', 'age = 12\nif age = 12:\n    print("yes")', ['if age == 12:', 'if age => 12:', 'if age := 12:', 'if age = "12":'], 0, 'Use == to compare. A single = is assignment.'),
      tf('Does this correctly check if x equals 5?', 'x = 5\nif x == 5:\n    print("ok")', true, '== compares values, and x is 5, so it prints "ok".'),
      mcq('JS: this always runs the if. Why?', 'let n = 0;\nif (n = 1) {\n  doStuff();\n}', ['n = 1 assigns instead of compares; use ==', 'doStuff is wrong', 'let should be var', 'Missing semicolon'], 0, '(n = 1) assigns 1 (truthy) every time. Use == (or ===) to compare.'),
      mcq('Fix this so it checks equality:', 'if color = "red":\n    print("stop")', ['if color == "red":', 'if color = red:', 'if color === "red":', 'if color is = "red":'], 0, 'In Python use == to compare strings.'),
    ],
  },
  {
    id: 5,
    name: 'Loop Logic',
    difficulty: 'easy',
    intro: 'Loops are tricky — count the turns carefully.',
    questions: [
      mcq('How many times does this print?', 'for i in range(3):\n    print("hi")', ['2 times', '3 times', '4 times', '0 times'], 1, 'range(3) gives 0, 1, 2 — that is 3 times.'),
      tf('Will this print the numbers 0, 1, 2?', 'for i in range(3):\n    print(i)', true, 'range(3) yields 0, 1, 2.'),
      mcq('This prints 1 to 4 but should print 1 to 5. Fix it.', 'for i in range(1, 5):\n    print(i)', ['Use range(1, 6)', 'Use range(1, 4)', 'Use range(5)', 'Use range(0, 5)'], 0, 'range stops BEFORE the end value, so range(1, 6) gives 1..5.'),
      mcq('How many times does this run?', 'for i in range(0):\n    print("x")', ['0 times', '1 time', 'forever', 'Error'], 0, 'range(0) is empty, so the loop body never runs.'),
    ],
  },
  {
    id: 6,
    name: 'Name Mix-ups',
    difficulty: 'easy',
    intro: 'Wrong names cause sneaky errors. Match them up.',
    questions: [
      mcq('Why does this crash?', 'count = 0\ncount = cont + 1', ['"cont" is a typo for "count"', 'count starts at 0', 'Use ++', 'Missing print'], 0, '"cont" was never defined — it should be "count".'),
      mcq('JS: this logs undefined. Why?', 'let userName = "Sam";\nconsole.log(username);', ['username vs userName — case matters', 'Use print', 'Missing quotes', 'let is wrong'], 0, 'JavaScript is case-sensitive: userName ≠ username.'),
      mcq('Pick the fix:', 'total = 5\nprint(totl)', ['print(total)', 'print("totl")', 'total = totl', 'remove print'], 0, 'The variable is "total"; "totl" is a typo.'),
      tf('Will this print 7?', 'a = 7\nb = a\nprint(b)', true, 'b is set to a (7), so it prints 7.'),
    ],
  },
  {
    id: 7,
    name: 'Type Tangles',
    difficulty: 'easy',
    intro: 'Mixing text and numbers? That can break things.',
    questions: [
      mcq('This crashes with a TypeError. What’s wrong?', 'age = "12"\nprint(age + 1)', ['"12" is a string; convert with int(age)', 'age is too big', 'Use a loop', '+ should be -'], 0, 'You can’t add a number to a string. Use int(age) + 1.'),
      tf('Does this print 12 (the number)?', 'age = input()  # user types 12\nprint(age + 0)', false, 'input() returns a string, so "12" + 0 raises a TypeError.'),
      mcq('Make this add the numbers (result 8):', 'x = "5"\ny = "3"\nprint(x + y)', ['print(int(x) + int(y))', 'print(x * y)', 'print(x - y)', 'print("8")'], 0, 'Convert the strings to ints first: int(x) + int(y) = 8.'),
      mcq('What prints?', 'print(3 + 4 * 2)', ['14', '11', '24', '9'], 1, 'Multiplication runs first: 4 * 2 = 8, then 3 + 8 = 11.'),
    ],
  },
  {
    id: 8,
    name: 'Indent Inspectors',
    difficulty: 'easy',
    intro: 'In Python, spacing changes everything.',
    questions: [
      mcq('This raises an IndentationError. Why?', 'def hi():\nprint("hi")', ['print must be indented under def', 'def needs ()', 'Use return', 'Missing colon'], 0, 'Code inside a function must be indented one level.'),
      mcq('This prints "done" 3 times, but it should print once after the loop. Fix it.', 'for i in range(3):\n    print(i)\n    print("done")', ['Un-indent the "done" line so it runs after the loop', 'Remove the loop', 'Use range(1)', 'Indent it more'], 0, 'The "done" line is inside the loop. Un-indent it to run once after.'),
      tf('Will this run without an IndentationError?', 'if True:\n    print("ok")', true, 'The print is correctly indented under the if.'),
      mcq('What’s the bug?', 'x = 5\n  y = 6', ['"y" has an unexpected indent', 'x is wrong', 'Need a colon', 'Use =='], 0, 'There is no block here, so the extra indent before y is an error.'),
    ],
  },

  // ===== MEDIUM 9–14 =====
  {
    id: 9,
    name: 'Off By One',
    difficulty: 'medium',
    intro: 'The most famous bug of all: counting one too many or few.',
    questions: [
      mcq('This should print 1..10 but stops at 9. Fix it.', 'for i in range(1, 10):\n    print(i)', ['range(1, 11)', 'range(1, 9)', 'range(10)', 'range(0, 10)'], 0, 'range stops before the end, so range(1, 11) prints 1 through 10.'),
      mcq('IndexError on the last item. What’s wrong?', 'nums = [10, 20, 30]\nfor i in range(1, 4):\n    print(nums[i])', ['Indexes are 0..2; loop should be range(0, 3)', 'Use range(4)', 'List too short', 'Use while'], 0, 'Lists start at index 0. Valid indexes are 0, 1, 2 — range(0, 3).'),
      tf('Will nums[3] work here?', 'nums = [5, 6, 7]\nprint(nums[3])', false, 'Indexes are 0, 1, 2. nums[3] is out of range → IndexError.'),
      mcq('What is the LAST valid index of a list with 5 items?', 'items = ["a","b","c","d","e"]', ['5', '4', '6', '0'], 1, 'Indexes go 0..4, so the last valid index is 4.'),
    ],
  },
  {
    id: 10,
    name: 'Return Riddles',
    difficulty: 'medium',
    intro: 'Functions that forget to return cause silent bugs.',
    questions: [
      mcq('square(4) prints None. Why?', 'def square(n):\n    n * n\n\nprint(square(4))', ['It computes n * n but never returns it', 'n is undefined', '* should be **', 'Missing colon'], 0, 'Without "return n * n", the function returns None.'),
      tf('Does this return 6?', 'def add(a, b):\n    return a + b\n\nadd(2, 4)', true, 'The function returns 6 (though it isn’t printed here).'),
      mcq('Code after return never runs. Fix the bug.', 'def f(x):\n    return x\n    x = x + 1', ['Move "x = x + 1" before the return', 'Remove return', 'Use yield', 'Indent more'], 0, 'Anything after "return" is unreachable; do the work before returning.'),
      mcq('greet() prints None below its message. Why?', 'def greet():\n    print("hello")\n\nprint(greet())', ['greet() returns None, and print shows it', 'print twice', 'Missing return value', 'It is correct'], 0, 'greet() prints but returns None, so print(greet()) also shows "None".'),
    ],
  },
  {
    id: 11,
    name: 'Logic Leaks',
    difficulty: 'medium',
    intro: 'The code runs, but the answer is wrong. Find the flaw.',
    questions: [
      mcq('isEven(4) returns False but should be True. Fix it.', 'def isEven(n):\n    return n % 2 == 1', ['Compare to 0: n % 2 == 0', 'Use n / 2', 'Use n % 1', 'Return n'], 0, 'Even numbers have remainder 0, so check n % 2 == 0.'),
      mcq('This finds the max wrong. What’s the bug?', 'nums = [3, 9, 2]\nbiggest = 0\nfor n in nums:\n    if n > biggest:\n        biggest = n', ['Start biggest at nums[0], not 0 (fails with negatives)', 'Use < not >', 'Remove the loop', 'biggest = nums'], 0, 'Starting at 0 breaks for all-negative lists; start at nums[0].'),
      tf('Does this correctly check 5 < x < 10 for x = 7?', 'x = 7\nif 5 < x < 10:\n    print("in range")', true, 'Python allows chained comparisons; 5 < 7 < 10 is True.'),
      mcq('grade("B") never triggers. Why?', 'score = 85\nif score > 90:\n    print("A")\nif score > 80:\n    print("B")\nif score > 70:\n    print("C")', ['Use elif so only one branch runs', 'score is wrong', 'Use ==', 'Remove ifs'], 0, 'Separate ifs all check; with 85 it prints B AND C. Use elif.'),
    ],
  },
  {
    id: 12,
    name: 'Infinite Loops',
    difficulty: 'medium',
    intro: 'A loop that never ends is a bug that never stops!',
    questions: [
      mcq('This loops forever. What’s missing?', 'i = 0\nwhile i < 5:\n    print(i)', ['Increase i inside the loop (i += 1)', 'Use range', 'Change < to >', 'Remove print'], 0, 'i never changes, so i < 5 stays true forever. Add i += 1.'),
      mcq('Why does this never stop?', 'i = 10\nwhile i > 0:\n    print(i)\n    i = i + 1', ['i grows, so i > 0 is always true; use i -= 1', 'Start i at 0', 'Use ==', 'Remove while'], 0, 'Adding to i moves away from 0. To count down, use i -= 1.'),
      tf('Will this loop ever stop?', 'n = 3\nwhile n != 0:\n    n = n - 1', true, 'n goes 3, 2, 1, 0 — it stops when n == 0.'),
      mcq('Make this stop after 5 prints:', 'count = 0\nwhile True:\n    print(count)\n    count += 1', ['Add: if count == 5: break', 'Remove count', 'Use False', 'Use range(True)'], 0, '"while True" needs a break — stop when count reaches 5.'),
    ],
  },
  {
    id: 13,
    name: 'List Landmines',
    difficulty: 'medium',
    intro: 'Lists trip up many coders. Step carefully.',
    questions: [
      mcq('This crashes. What’s wrong?', 'fruits = ["apple", "pear"]\nprint(fruits[2])', ['Index 2 is out of range (only 0 and 1 exist)', 'fruits is empty', 'Use a loop', 'Quotes are wrong'], 0, 'A 2-item list has indexes 0 and 1; fruits[2] is out of range.'),
      mcq('append isn’t adding. Fix it.', 'nums = [1, 2]\nnums.append', ['Call it: nums.append(3)', 'Use nums.add(3)', 'Use nums + 3', 'Use push'], 0, 'append is a method — you must call it with (): nums.append(3).'),
      tf('Does this print 3 (the list length)?', 'colors = ["r", "g", "b"]\nprint(len(colors))', true, 'len() returns the count of items, which is 3.'),
      mcq('This skips the first item. Why?', 'nums = [10, 20, 30]\nfor i in range(1, len(nums)):\n    print(nums[i])', ['Loop should start at 0, not 1', 'len is wrong', 'Use while', 'Indexes start at 1'], 0, 'Starting range at 1 skips nums[0]. Use range(0, len(nums)).'),
    ],
  },
  {
    id: 14,
    name: 'JavaScript Jams',
    difficulty: 'medium',
    intro: 'JavaScript has its own traps. Debug them!',
    questions: [
      mcq('This logs "55" not 10. Why?', 'let a = "5";\nlet b = 5;\nconsole.log(a + b);', ['a is a string, so + joins → "55"; use Number(a)', 'b is wrong', 'Use let twice', 'console is wrong'], 0, '"5" + 5 concatenates to "55". Convert a to a number first.'),
      tf('Does (2 == "2") evaluate to true in JavaScript?', 'console.log(2 == "2");', true, '== does type coercion, so 2 == "2" is true (use === to be strict).'),
      mcq('This errors. What’s missing?', 'function greet(name) {\n  console.log("Hi " + name)\n', ['A closing curly brace }', 'A semicolon', 'return', 'let'], 0, 'The function body is never closed — add a "}".'),
      mcq('The loop runs one extra time. Fix the condition.', 'for (let i = 0; i <= 3; i++) {\n  console.log(i)\n}\n// want 0,1,2', ['Use i < 3', 'Use i <= 2 only', 'Use i = 3', 'Remove i++'], 0, 'i <= 3 prints 0,1,2,3. For 0,1,2 use i < 3.'),
    ],
  },

  // ===== HARD 15–18 =====
  {
    id: 15,
    name: 'Subtle Saboteurs',
    difficulty: 'hard',
    intro: 'These bugs hide in plain sight. Look closely.',
    questions: [
      mcq('average([2,4,6]) returns 4.0, but average([]) crashes. Best fix?', 'def average(nums):\n    return sum(nums) / len(nums)', ['Guard empty lists: return 0 if len(nums)==0', 'Use sum only', 'Use round', 'Use a loop'], 0, 'Dividing by len 0 raises ZeroDivisionError; handle the empty case.'),
      mcq('This mutates the original list unexpectedly. Why?', 'def add_zero(lst):\n    lst.append(0)\n    return lst\n\na = [1, 2]\nb = add_zero(a)', ['Lists are passed by reference, so "a" changes too', 'append is wrong', 'b is undefined', 'Use return'], 0, 'append modifies the SAME list object, so a and b both gain the 0.'),
      tf('Will counter end at 3 here?', 'counter = 0\nfor i in range(3):\n    counter += 1\nprint(counter)', true, 'The loop runs 3 times, adding 1 each time → counter is 3.'),
      mcq('is_prime(2) returns False but 2 is prime. Bug?', 'def is_prime(n):\n    for i in range(2, n):\n        if n % i == 0:\n            return False\n    return n > 1', ['range(2, 2) is empty, so it should return True — code is actually correct', 'Use range(1, n)', 'Return False', 'n % 0'], 0, 'For n=2, range(2,2) is empty, so it skips to "return n > 1" → True. (The premise is the trick — it’s correct.)'),
    ],
  },
  {
    id: 16,
    name: 'Scope & Shadows',
    difficulty: 'hard',
    intro: 'Where a variable lives decides whether your code works.',
    questions: [
      mcq('This raises a NameError on print(total). Why?', 'def sum_list(nums):\n    total = 0\n    for n in nums:\n        total += n\n\nsum_list([1,2,3])\nprint(total)', ['"total" is local to the function and not visible outside', 'nums is wrong', 'Use ++', 'Indent error'], 0, 'total only exists inside sum_list. Return it and print the result.'),
      mcq('count stays 0 after the loop. Fix it.', 'count = 0\ndef bump():\n    count = count + 1\n\nbump()', ['Add "global count" (or return the new value)', 'Use count++', 'Remove def', 'count = 1'], 0, 'Assigning inside the function makes a new local count; use global or return.'),
      tf('Does x equal 5 after this runs?', 'x = 5\ndef show():\n    print(x)\nshow()\nprint(x)', true, 'show() only reads x; the outer x stays 5.'),
      mcq('What does this print?', 'x = 1\ndef change():\n    x = 99\nchange()\nprint(x)', ['1', '99', 'None', 'Error'], 0, 'The function’s x is local; the global x stays 1.'),
    ],
  },
  {
    id: 17,
    name: 'Output Detectives',
    difficulty: 'hard',
    intro: 'Predict exactly what these tricky snippets print.',
    questions: [
      mcq('What is printed?', 'x = 5\nx += 3\nx *= 2\nprint(x)', ['16', '13', '10', '11'], 0, 'x = 5 → +3 = 8 → *2 = 16.'),
      mcq('What does this print?', 'word = "code"\nprint(word[1:3])', ['"co"', '"od"', '"ode"', '"cod"'], 1, 'Slicing [1:3] takes indexes 1 and 2 → "od".'),
      tf('Will this print "True"?', 'print(10 > 5 and 5 > 8)', false, '5 > 8 is False, so the whole "and" is False.'),
      mcq('What is the final list?', 'nums = [1, 2, 3]\nnums[0] = nums[2]\nprint(nums)', ['[3, 2, 3]', '[1, 2, 3]', '[3, 2, 1]', '[1, 2, 1]'], 0, 'nums[0] becomes nums[2] (3), so the list is [3, 2, 3].'),
    ],
  },
  {
    id: 18,
    name: 'Master Debugger',
    difficulty: 'hard',
    intro: 'The final gauntlet — only a true debugger passes!',
    questions: [
      mcq('This should reverse a list but returns it unchanged. Bug?', 'def reverse(lst):\n    lst.reverse\n    return lst', ['reverse is not called — use lst.reverse()', 'Use lst[::-1] only', 'Return lst.reverse', 'Use sort'], 0, 'lst.reverse without () does nothing. Call it: lst.reverse().'),
      mcq('countdown(3) prints 3,2,1 then errors. Fix the base case.', 'def countdown(n):\n    print(n)\n    countdown(n - 1)', ['Add: if n == 0: return  (stop the recursion)', 'Use a loop', 'Print n+1', 'Remove print'], 0, 'There is no stop condition, so it recurses forever. Return when n reaches 0.'),
      tf('Will this print "equal"?', 'a = 0.1 + 0.2\nif a == 0.3:\n    print("equal")\nelse:\n    print("nope")', false, 'Floating-point math makes 0.1 + 0.2 slightly off, so it prints "nope".'),
      mcq('This swap leaves both values equal to b. Fix it.', 'a = 1\nb = 2\na = b\nb = a', ['Use a temp: t = a; a = b; b = t', 'Use a == b', 'Swap the order only', 'Use a + b'], 0, 'After a = b, the old a is lost. Save it in a temp first (or a, b = b, a).'),
      mcq('What does this print?', 'total = 0\nfor i in range(1, 4):\n    total += i\nprint(total)', ['6', '3', '4', '10'], 0, 'It adds 1 + 2 + 3 = 6.'),
      mcq('is_adult returns the wrong answer for age 18. Fix it.', 'def is_adult(age):\n    if age > 18:\n        return True\n    else:\n        return False', ['Use >= 18 so 18 counts as adult', 'Use == 18', 'Return age', 'Swap branches'], 0, 'age > 18 excludes 18 itself. Use age >= 18.'),
    ],
  },
]

export default levels

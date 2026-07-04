// Treasure Hunt — 18 question-set levels (ids 1..18) teaching CONDITIONS.
// A pirate/jungle treasure-map adventure: each level is a short run of path
// choices framed as if/else decisions, comparisons, and boolean logic
// (AND / OR / NOT), ramping into nested if/else on the hard levels.
//
// Level shape (consumed by QuestionLevelGame):
//   { id, name, difficulty:'easy'|'medium'|'hard', intro?, questions:[ q ] }
// Question types:
//   { type:'truefalse', prompt, code?, answer:<bool>, explain? }
//   { type:'mcq',       prompt, code?, options:[...], answer:<index>, explain? }
//   { type:'choice',    prompt, code?, options:[...], answer:<index>, explain? }

const tf = (prompt, answer, explain) => ({ type: 'truefalse', prompt, answer, explain })
const mcq = (prompt, options, answer, explain) => ({ type: 'mcq', prompt, options, answer, explain })
const choice = (prompt, options, answer, explain) => ({ type: 'choice', prompt, options, answer, explain })

const levels = [
  // ===== EASY 1–8 =====
  {
    id: 1,
    name: 'The Rope Bridge',
    difficulty: 'easy',
    intro: 'Ahoy! Cross the jungle bridge by reading each rule, matey.',
    questions: [
      tf('The bridge holds only if weight < 50. Your chest weighs 40. Do you cross safely?', true, '40 < 50 is TRUE, so the bridge holds — cross!'),
      tf('The bridge holds only if weight < 50. Your chest weighs 60. Do you cross safely?', false, '60 < 50 is FALSE, so the bridge would snap.'),
      choice('If the path is muddy, take the LEFT trail; else take the RIGHT. The path IS muddy. Which trail?', ['Left trail', 'Right trail'], 0, 'The condition is TRUE, so the "if" branch runs → Left.'),
      choice('If the path is muddy, take the LEFT trail; else take the RIGHT. The path is DRY. Which trail?', ['Left trail', 'Right trail'], 1, 'The condition is FALSE, so the "else" branch runs → Right.'),
    ],
  },
  {
    id: 2,
    name: 'The Golden Key',
    difficulty: 'easy',
    intro: 'A locked chest waits. Match the key to the lock!',
    questions: [
      choice('if key == "gold": open chest, else: keep searching. Your key is GOLD. What happens?', ['Open the chest', 'Keep searching'], 0, 'key == "gold" is TRUE → open the chest!'),
      choice('if key == "gold": open chest, else: keep searching. Your key is SILVER. What happens?', ['Open the chest', 'Keep searching'], 1, 'A silver key is NOT gold → the else branch runs.'),
      tf('A chest opens if coins >= 100. You have 100 coins. Does it open?', true, '>= means "greater than OR equal". 100 >= 100 is TRUE.'),
      tf('A chest opens if coins > 100. You have 100 coins. Does it open?', false, '> means "strictly greater". 100 > 100 is FALSE.'),
    ],
  },
  {
    id: 3,
    name: 'Two Caves',
    difficulty: 'easy',
    intro: 'Two glittering caves — pick the right one to find the gems.',
    questions: [
      choice('If the gem is RED, enter the LEFT cave; else the RIGHT cave. The gem is RED. Which cave?', ['Left cave', 'Right cave'], 0, 'The gem IS red, so the "if" branch runs → Left cave.'),
      choice('If the gem is RED, enter the LEFT cave; else the RIGHT cave. The gem is BLUE. Which cave?', ['Left cave', 'Right cave'], 1, 'A blue gem is not red, so the else branch runs → Right cave.'),
      tf('The torch lights only if it is dark. Right now it is bright daytime. Does the torch light?', false, 'The condition "it is dark" is FALSE, so the torch stays off.'),
      mcq('if temperature > 30: drink water. The temperature is 35. What do you do?', ['Drink water', 'Do nothing', 'Light a fire', 'Sleep'], 0, '35 > 30 is TRUE → drink water.'),
    ],
  },
  {
    id: 4,
    name: 'Counting Coins',
    difficulty: 'easy',
    intro: 'Tally your loot and compare it carefully.',
    questions: [
      tf('You can buy the map if coins >= 50. You have 75. Can you buy it?', true, '75 >= 50 is TRUE.'),
      tf('You can buy the map if coins >= 50. You have 30. Can you buy it?', false, '30 >= 50 is FALSE — not enough coins.'),
      mcq('Which comparison is TRUE?', ['10 < 5', '8 == 8', '3 > 9', '2 >= 7'], 1, '8 == 8 is true; the others are false.'),
      mcq('if score == 10: win. Your score is 9. What happens?', ['You win', 'You do not win', 'You lose a life', 'Score resets'], 1, '9 == 10 is FALSE, so the "win" line does not run.'),
    ],
  },
  {
    id: 5,
    name: 'The Storm Warning',
    difficulty: 'easy',
    intro: 'Read the skies to keep your ship safe.',
    questions: [
      choice('if isStorm: stay in port, else: set sail. There IS a storm. What do you do?', ['Stay in port', 'Set sail'], 0, 'isStorm is TRUE → the "if" branch runs → stay in port.'),
      choice('if isStorm: stay in port, else: set sail. The sky is CLEAR. What do you do?', ['Stay in port', 'Set sail'], 1, 'No storm → isStorm is FALSE → set sail.'),
      tf('The sail opens if windSpeed >= 10. The wind is 8. Does the sail open?', false, '8 >= 10 is FALSE, so the sail stays closed.'),
      tf('NOT raining means you can dig. It is NOT raining. Can you dig?', true, 'NOT raining is TRUE, so you can dig.'),
    ],
  },
  {
    id: 6,
    name: 'The Talking Parrot',
    difficulty: 'easy',
    intro: 'The parrot squawks riddles about true and false.',
    questions: [
      tf('NOT true is false.', true, 'NOT flips a value, so NOT true = false.'),
      tf('NOT false is false.', false, 'NOT flips a value, so NOT false = true (not false).'),
      mcq('if hungry: eat a banana. The parrot is NOT hungry. What happens?', ['Eats a banana', 'Does nothing', 'Flies away', 'Squawks loudly'], 1, '"hungry" is FALSE, so the "eat" line does not run.'),
      tf('The door is locked if NOT hasKey. You have NO key. Is the door locked?', true, 'NOT hasKey is TRUE (you have no key), so the door is locked.'),
    ],
  },
  {
    id: 7,
    name: 'Sharks or Safe',
    difficulty: 'easy',
    intro: 'One wrong jump and the sharks get the gold!',
    questions: [
      choice('if depth > 20: too deep, swim up, else: keep diving. Depth is 25. What do you do?', ['Swim up', 'Keep diving'], 0, '25 > 20 is TRUE → swim up.'),
      choice('if depth > 20: too deep, swim up, else: keep diving. Depth is 12. What do you do?', ['Swim up', 'Keep diving'], 1, '12 > 20 is FALSE → keep diving.'),
      tf('It is safe if sharks == 0. There are 3 sharks. Is it safe?', false, 'sharks == 0 is FALSE because there are 3 sharks.'),
      mcq('Which value makes "coins >= 50" TRUE?', ['10', '49', '50', '0'], 2, '50 >= 50 is true; the smaller numbers are false.'),
    ],
  },
  {
    id: 8,
    name: 'The Map Reader',
    difficulty: 'easy',
    intro: 'Read the captain’s rules and choose the right move.',
    questions: [
      mcq('if steps == 5: turn left. You have taken 5 steps. What do you do?', ['Turn left', 'Turn right', 'Stop', 'Nothing'], 0, 'steps == 5 is TRUE → turn left.'),
      tf('You may pass if age >= 8. You are 8 years old. May you pass?', true, '8 >= 8 is TRUE.'),
      tf('You may pass if age > 8. You are 8 years old. May you pass?', false, '8 > 8 is FALSE — you need to be older than 8.'),
      choice('if treasureFound: celebrate, else: keep digging. Treasure is NOT found yet. What now?', ['Celebrate', 'Keep digging'], 1, 'treasureFound is FALSE → keep digging.'),
    ],
  },

  // ===== MEDIUM 9–14 =====
  {
    id: 9,
    name: 'AND Island',
    difficulty: 'medium',
    intro: 'On this island BOTH rules must be true to win the loot.',
    questions: [
      tf('The chest opens if hasKey AND hasMap. You have BOTH. Does it open?', true, 'AND needs both true; both are true → it opens.'),
      tf('The chest opens if hasKey AND hasMap. You have the key but NO map. Does it open?', false, 'AND needs BOTH true; the missing map makes it false.'),
      tf('(weight < 50) AND (rope == strong). Weight is 40 and rope is strong. Can you cross?', true, '40 < 50 is true AND rope is strong → both true → cross.'),
      mcq('Cross the lava if (hasBoots) AND (bridge == safe). You have boots but the bridge is broken. What do you do?', ['Cross the lava', 'Do not cross'], 1, 'AND needs both true; a broken bridge makes it false.'),
    ],
  },
  {
    id: 10,
    name: 'OR Lagoon',
    difficulty: 'medium',
    intro: 'Here you only need ONE rule to be true.',
    questions: [
      tf('You may enter if hasGold OR hasGems. You have gold but no gems. May you enter?', true, 'OR needs just one true; gold alone is enough.'),
      tf('You may enter if hasGold OR hasGems. You have NEITHER. May you enter?', false, 'OR is false only when BOTH are false.'),
      tf('(coins >= 100) OR (hasTicket). You have 20 coins but a ticket. Can you board?', true, 'coins >= 100 is false, but hasTicket is true, so OR is true.'),
      mcq('Light the lamp if (isDark) OR (insideCave). It is bright daytime but you are inside a cave. Does it light?', ['Yes, light it', 'No, leave it off'], 0, 'isDark is false, but insideCave is true, so OR is true.'),
    ],
  },
  {
    id: 11,
    name: 'The Riddle Gate',
    difficulty: 'medium',
    intro: 'Mix AND, OR and NOT to unlock the gate.',
    questions: [
      tf('NOT (5 > 3) is true.', false, '5 > 3 is true, and NOT true is false.'),
      tf('(2 < 1) OR (4 > 2) is true.', true, 'OR is true because 4 > 2 is true.'),
      tf('(2 < 1) AND (4 > 2) is true.', false, 'AND needs both true; 2 < 1 is false.'),
      mcq('Pass if (hasKey) AND (NOT isLocked). You have the key and it is NOT locked. Do you pass?', ['Yes, pass', 'No, blocked'], 0, 'hasKey is true AND NOT isLocked is true → both true → pass.'),
      tf('Open if (hasKey) AND (NOT isLocked). You have the key but it IS locked. Does it open?', false, 'NOT isLocked is false here, so the AND is false.'),
    ],
  },
  {
    id: 12,
    name: 'The Toll Bridge',
    difficulty: 'medium',
    intro: 'Compare numbers carefully before you pay the toll.',
    questions: [
      mcq('if coins >= 50: pay toll, elif coins >= 20: beg, else: turn back. You have 35. What happens?', ['Pay toll', 'Beg', 'Turn back', 'Nothing'], 1, '35 is not >= 50, but 35 >= 20 is true → the elif "beg" runs.'),
      mcq('if coins >= 50: pay toll, elif coins >= 20: beg, else: turn back. You have 60. What happens?', ['Pay toll', 'Beg', 'Turn back', 'Nothing'], 0, '60 >= 50 is true, so the FIRST branch runs → pay toll.'),
      mcq('if coins >= 50: pay toll, elif coins >= 20: beg, else: turn back. You have 5. What happens?', ['Pay toll', 'Beg', 'Turn back', 'Nothing'], 2, 'Neither 50 nor 20 is reached, so the else runs → turn back.'),
      tf('In an if / elif / else, only ONE branch runs.', true, 'The first matching branch runs; the rest are skipped.'),
    ],
  },
  {
    id: 13,
    name: 'The Tide Table',
    difficulty: 'medium',
    intro: 'Read the code blocks and predict the path.',
    questions: [
      { type: 'mcq', prompt: 'What does the hero do?', code: 'tide = 7\nif tide > 5:\n    print("sail out")\nelse:\n    print("anchor")', options: ['Wait', 'Sail out', 'Anchor', 'Nothing'], answer: 1, explain: 'tide is 7, and 7 > 5 is TRUE, so the "if" branch runs → sail out.' },
      { type: 'truefalse', prompt: 'Will this print "cross"?', code: 'weight = 30\nif weight < 50:\n    print("cross")', answer: true, explain: 'weight is 30 and 30 < 50 is TRUE, so it prints "cross".' },
      { type: 'mcq', prompt: 'Which line runs?', code: 'gem = "blue"\nif gem == "red":\n    print("left")\nelse:\n    print("right")', options: ['print("left")', 'print("right")', 'both', 'neither'], answer: 1, explain: 'gem is "blue", which is NOT "red", so the else runs → print("right").' },
      { type: 'truefalse', prompt: 'Will this print "open"?', code: 'coins = 40\nif coins >= 100:\n    print("open")', answer: false, explain: 'coins is 40 and 40 >= 100 is FALSE, so "open" does not print.' },
    ],
  },
  {
    id: 14,
    name: 'The Compass Code',
    difficulty: 'medium',
    intro: 'Trace each snippet to find the treasure’s direction.',
    questions: [
      { type: 'mcq', prompt: 'Which direction is printed?', code: 'steps = 10\nif steps > 8:\n    print("North")\nelse:\n    print("South")', options: ['North', 'South', 'East', 'West'], answer: 0, explain: 'steps is 10, and 10 > 8 is TRUE, so it prints "North".' },
      { type: 'truefalse', prompt: 'Will the lamp turn on?', code: 'isDark = True\nif isDark:\n    lamp = "on"\n    print(lamp)', answer: true, explain: 'isDark is True, so the if branch runs and the lamp turns on.' },
      { type: 'mcq', prompt: 'What is printed?', code: 'sharks = 2\nif sharks == 0:\n    print("safe")\nelse:\n    print("danger")', options: ['safe', 'danger', 'nothing', 'error'], answer: 1, explain: 'sharks is 2; 2 == 0 is FALSE, so the else runs → "danger".' },
      { type: 'truefalse', prompt: 'Does the hero cross?', code: 'weight = 55\nif weight < 50:\n    print("cross")', answer: false, explain: 'weight is 55 and 55 < 50 is FALSE, so the hero does not cross.' },
    ],
  },

  // ===== HARD 15–18 =====
  {
    id: 15,
    name: 'The Nested Vault',
    difficulty: 'hard',
    intro: 'An if inside an if — follow both rules to crack the vault.',
    questions: [
      mcq('if hasKey: if isGold: open vault, else: leave. You have a GOLD key. What happens?', ['Open vault', 'Leave', 'Nothing', 'Error'], 0, 'hasKey is true (outer), and isGold is true (inner) → open vault.'),
      mcq('if hasKey: if isGold: open vault, else: leave. You have a SILVER key. What happens?', ['Open vault', 'Leave', 'Nothing', 'Error'], 1, 'hasKey is true, but isGold is false → the inner else runs → leave.'),
      mcq('if hasKey: if isGold: open vault, else: leave. You have NO key at all. What happens?', ['Open vault', 'Leave', 'Nothing runs', 'Error'], 2, 'hasKey is false, so the WHOLE inner block is skipped — nothing runs.'),
      tf('(true AND false) OR true is true.', true, '(true AND false) is false, and false OR true = true.'),
    ],
  },
  {
    id: 16,
    name: 'The Pirate’s Logic',
    difficulty: 'hard',
    intro: 'Only flawless boolean logic claims the captain’s gold.',
    questions: [
      tf('NOT (true OR false) is true.', false, '(true OR false) is true, and NOT true is false.'),
      tf('(NOT false) AND (3 > 1) is true.', true, 'NOT false is true and 3 > 1 is true; true AND true = true.'),
      mcq('Pass if (hasGold OR hasGems) AND (NOT cursed). You have gems and are NOT cursed. Do you pass?', ['Yes, pass', 'No, blocked'], 0, '(false OR true) is true, NOT cursed is true; true AND true → pass.'),
      tf('Pass if (hasGold OR hasGems) AND (NOT cursed). You have gold but ARE cursed. Do you pass?', false, '(true OR ...) is true, but NOT cursed is false → AND is false → blocked.'),
      mcq('if (a > b): big = a, else: big = b. a is 4, b is 9. What is big?', ['4', '9', '13', '0'], 1, '4 > 9 is FALSE, so the else runs → big = b = 9.'),
    ],
  },
  {
    id: 17,
    name: 'The Trap Room',
    difficulty: 'hard',
    intro: 'Trace nested conditions to dodge every trap.',
    questions: [
      { type: 'mcq', prompt: 'Which message prints?', code: 'door = "left"\nhasTorch = False\nif door == "left":\n    if hasTorch:\n        print("safe")\n    else:\n        print("trap")', options: ['"dragon"', '"safe"', '"trap"', 'nothing'], answer: 2, explain: 'door is "left" so we enter the if; inside, hasTorch is False, so the inner else prints "trap".' },
      { type: 'mcq', prompt: 'What is the final value of "result"?', code: 'score = 80\nif score >= 70:\n    result = "win"\nelse:\n    result = "retry"', options: ['"win"', '"retry"', '"lose"', '"none"'], answer: 0, explain: 'score is 80; 80 >= 70 is true, so result = "win".' },
      { type: 'truefalse', prompt: 'Will this print "boom"?', code: 'fuse = 0\nif fuse > 0:\n    print("boom")', answer: false, explain: 'fuse is 0 and the if needs fuse > 0, so the if is skipped and "boom" never prints.' },
      tf('(true AND true) AND (false OR true) is true.', true, '(true) is true and (false OR true) is true; true AND true = true.'),
    ],
  },
  {
    id: 18,
    name: 'The Final Treasure',
    difficulty: 'hard',
    intro: 'The last trial — master every condition to claim the gold!',
    questions: [
      mcq('if coins >= 100: tier = "gold", elif coins >= 50: tier = "silver", else: tier = "bronze". coins = 50. What is tier?', ['gold', 'silver', 'bronze', 'none'], 1, '50 is not >= 100, but 50 >= 50 is true → the elif runs → "silver".'),
      tf('NOT ((5 > 3) AND (4 > 2)) is true.', false, 'Both inside are true, so AND is true, and NOT true = false.'),
      mcq('Open the gate if (hasKey AND hasMap) OR isCaptain. You are NOT the captain, have the key but NO map. Open?', ['Yes, open', 'No, stays shut'], 1, '(true AND false) is false, and isCaptain is false → false OR false → stays shut.'),
      mcq('Open the gate if (hasKey AND hasMap) OR isCaptain. You ARE the captain (with nothing else). Open?', ['Yes, open', 'No, stays shut'], 0, 'The first part is false, but isCaptain is true, so OR is true → open.'),
      mcq('if x > 0: if x > 10: size = "big", else: size = "small". x = 5. What is size?', ['big', 'small', 'none', 'error'], 1, 'x > 0 is true (enter), but x > 10 is false → inner else → "small".'),
      tf('In if / elif / else, if the first condition is true the elif and else are skipped.', true, 'Only the first matching branch runs; the rest are skipped.'),
    ],
  },
]

export default levels

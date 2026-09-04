/**
 * THE AI & PROMPTING COURSE — the last rung of the ladder.
 *
 * A pupil arrives having passed Python, C and HTML/CSS. They can program, and
 * they have built something people can see. This course is about working WITH
 * a tool that writes text and code, which is a genuinely different skill and
 * needs a different kind of teaching:
 *
 *   • THE ANSWER IS NOT DETERMINISTIC. Every other course in this ladder had
 *     right answers a compiler could check. Here the same prompt can give two
 *     different replies, and a pupil who expects `2 + 2` behaviour will think
 *     the tool is broken. Lesson one addresses that directly.
 *
 *   • THE MODEL IS CONFIDENT WHEN IT IS WRONG. This is the single most
 *     important thing a child can learn about these tools, and it is the reason
 *     the verification world exists. A course that taught prompting without
 *     teaching checking would be actively harmful.
 *
 *   • IT IS NOT A COURSE ABOUT ONE PRODUCT. Model names and interfaces change
 *     every few months. Everything here is about the underlying skill — being
 *     specific, giving context, checking claims — which does not.
 *
 * Worlds are ordered from 16 (after Python 1-5, C 6-10, HTML 11-15) and slugs
 * are `ai-` prefixed.
 *
 * The final test is a BUILD paper: 20 knowledge questions plus three tasks
 * worth 30, 30 and 40 — so the course teaches towards producing and judging
 * real work, not towards reciting terminology.
 */

export const AI_WORLDS = [
  {
    name: 'Prompt Basics',
    slug: 'ai-prompt-basics',
    order: 16,
    topics: ['What a Model Actually Does', 'Being Specific', 'Giving Context'],
    description:
      'Start with what these tools really are — and are not. Learn why the same question can get two different answers, and why being specific matters more than being polite.',
    requiredLevel: 1,
    icon: 'spark',
  },
  {
    name: 'Prompt Craft',
    slug: 'ai-prompt-craft',
    order: 17,
    topics: ['Examples and Format', 'Roles and Audience', 'Constraints'],
    description:
      'Move from asking to directing. Show examples of what you want, say who the answer is for, and set limits — the three things that turn a vague reply into a useful one.',
    requiredLevel: 3,
    icon: 'craft',
  },
  {
    name: 'Thinking Prompts',
    slug: 'ai-thinking-prompts',
    order: 18,
    topics: ['Step by Step', 'Breaking Down a Problem', 'Asking It to Check'],
    description:
      'Get better answers to harder questions. Ask for reasoning rather than a conclusion, split a big task into parts, and have the model check its own work.',
    requiredLevel: 5,
    icon: 'think',
  },
  {
    name: 'Building with AI',
    slug: 'ai-building',
    order: 19,
    topics: [
      'Generating Code',
      'Iterating on a Draft',
      'Reviewing What You Get',
    ],
    description:
      'Use it on real work. Generate code you understand, improve a draft through conversation, and — most importantly — read what comes back before you trust it.',
    requiredLevel: 7,
    icon: 'build',
  },
  {
    name: 'Using AI Honestly',
    slug: 'ai-honestly',
    order: 20,
    topics: ['Checking Claims', 'Bias and Limits', 'Being Honest About Help'],
    description:
      'The part that matters most. Learn how these tools go wrong, why they sound certain anyway, and how to be straight with people about what you used.',
    requiredLevel: 9,
    icon: 'compass',
  },
];

export const AI_LESSON_CONTENT = {
  'ai-prompt-basics': [
    {
      topic: 'What a Model Actually Does',
      title: 'What a Model Actually Does',
      order: 1,
      language: 'ai',
      body: {
        tagline:
          'It predicts likely text. That explains almost everything about it.',
        intro:
          'A language model is trained on an enormous amount of writing and learns which words tend to follow which. When you ask it something, it produces text that is LIKELY to follow your question. That is the whole mechanism, and nearly every surprising thing about these tools follows from it — including the useful behaviour and the dangerous behaviour.',
        sections: [
          {
            heading: 'It has no database to look things up in',
            body: 'It is not searching. It learned patterns from text and generates from those patterns, which is why it can write a poem about your cat it has never seen — and also why it can state a fact that is simply not true. Both come from the same ability.',
            bullets: [
              'It generates likely text rather than retrieving stored facts.',
              'That is why it can be creative.',
              'That is also why it can be confidently wrong.',
            ],
          },
          {
            heading: 'The same prompt can give different answers',
            body: 'There is deliberate randomness in how the next word is chosen, so asking twice can produce two different replies. This is not a fault. But it does mean you cannot treat it like `2 + 2` — and if you need the same answer every time, you need to check the answer rather than trust the process.',
            bullets: [
              'Two identical prompts can give two different answers.',
              'Neither is "the" answer.',
              'If it matters, verify the answer rather than trusting repetition.',
            ],
          },
          {
            heading: 'Hallucination is not lying',
            body: 'When it invents a book title or a function that does not exist, it is not deceiving you — it is producing text that FITS the pattern of a real answer. That is why the invention is always plausible: plausibility is exactly what it optimises for. A made-up answer looks precisely like a real one.',
            bullets: [
              'A confident tone is not evidence of correctness.',
              'Invented details are plausible BY DESIGN.',
              'Names, numbers, dates and citations are the most likely to be wrong.',
            ],
          },
        ],
        snippet: {
          language: 'text',
          lines: [
            'ASK THE SAME THING TWICE, and compare:',
            '',
            '  "Give me a name for a robot in a story."',
            '',
            '  → Attempt 1: "Bolt"',
            '  → Attempt 2: "Kestrel-9"',
            '',
            'Both are fine. There is no single right answer, and the',
            'difference is the randomness in how the next word is picked.',
            '',
            'NOW ASK SOMETHING FACTUAL, and check it:',
            '',
            '  "What year was the Python programming language released?"',
            '',
            '  → It will answer confidently. It is probably right.',
            '  → But the CONFIDENCE tells you nothing either way.',
            '    Look it up. That habit is the whole lesson.',
          ],
          caption:
            'The tone is identical in both cases. That is the point: it sounds equally sure of an invented name and of a checkable fact.',
        },
        tryIt: {
          language: 'text',
          starter:
            'Ask an AI assistant: "Give me three facts about the Eiffel Tower, and tell me how confident you are about each."\n',
          challenge:
            'Check all three facts yourself. Then ask the same question again and see whether you get the same three. Finally, ask it about something obscure — a small local landmark near you — and check that answer too. The gap between how sure it sounds and how right it is, is the most useful thing in this course.',
          hint: 'Pick facts you can verify quickly: dates, heights, names. Those are exactly the kind it gets wrong.',
        },
        guide: [
          {
            step: 'Remember what it is doing',
            body: 'Producing likely text, not looking up answers.',
          },
          {
            step: 'Expect variation',
            body: 'The same prompt can give different replies. Neither is definitive.',
          },
          {
            step: 'Separate tone from truth',
            body: 'It sounds equally confident when right and when wrong.',
          },
          {
            step: 'Check anything that matters',
            body: 'Especially names, numbers, dates and sources.',
          },
        ],
        takeaways: [
          'A language model predicts likely text; it does not look facts up.',
          'The same prompt can produce different answers, by design.',
          'Hallucination means inventing plausible detail, not deliberate lying.',
          'Confidence in the tone says nothing about accuracy.',
          'Names, numbers, dates and citations are the least trustworthy parts.',
        ],
      },
    },
    {
      topic: 'Being Specific',
      title: 'Being Specific',
      order: 2,
      language: 'ai',
      body: {
        tagline: 'A vague question gets an average answer.',
        intro:
          'The most common reason a reply is disappointing is that the question left too much open. Given "write about dogs", the model has to guess the length, the audience, the tone and the purpose — and it guesses the middle of everything, which is exactly what a bland answer is. Every detail you supply is a guess it no longer has to make.',
        sections: [
          {
            heading: 'Say what, how long, and for whom',
            body: 'Three details fix most weak prompts: what exactly you want, roughly how long, and who is going to read it. "Write about dogs" versus "Write one paragraph for a 7-year-old on why dogs sleep so much" — the second cannot produce a bland answer, because there is nothing left to be bland about.',
            bullets: [
              'WHAT: the specific thing, not the general topic.',
              'HOW LONG: a paragraph, five bullet points, one sentence.',
              'FOR WHOM: their age or expertise sets the whole tone.',
            ],
          },
          {
            heading: 'Politeness is not the useful part',
            body: 'People often try to improve a prompt by making it more elaborate — "please could you kindly help me with...". That adds nothing. Clarity is what helps. A blunt, precise instruction beats a courteous, vague one every time, and it is shorter to write.',
            bullets: [
              'Courtesy does not improve the answer.',
              'Specificity does.',
              'Direct instructions are fine: "List five. One line each."',
            ],
          },
          {
            heading: 'Say what to avoid',
            body: 'Negative instructions work and are often overlooked. "No jargon", "do not mention prices", "avoid bullet points" all steer the answer usefully. It is often faster to rule out what you keep getting and do not want than to describe what you do.',
            bullets: [
              '"No technical terms" is a useful instruction.',
              'Rule out a format you keep receiving and do not want.',
              'Combine positive and negative: "Plain English. No jargon."',
            ],
          },
        ],
        snippet: {
          language: 'text',
          lines: [
            'VAGUE:',
            '  "Write about recycling."',
            '  → Gets you a bland, medium-length, generic essay.',
            '',
            'SPECIFIC:',
            '  "Write one paragraph, about 60 words, for a 9-year-old,',
            '   explaining why washing a yoghurt pot before recycling it',
            '   matters. Plain English, no statistics."',
            '',
            'What changed, and why each part helped:',
            '  • one paragraph, ~60 words → length is settled',
            '  • for a 9-year-old         → vocabulary and tone settled',
            '  • why washing matters      → one specific point, not a survey',
            '  • no statistics            → rules out what you do not want',
          ],
          caption:
            'The second prompt is longer to type and far shorter to fix afterwards. That trade is almost always worth making.',
        },
        tryIt: {
          language: 'text',
          starter:
            'Start with this deliberately vague prompt: "Tell me about space."\n',
          challenge:
            'Send it, and keep the answer. Now rewrite it with a specific subject, a length, an audience and one thing to avoid — then compare the two replies side by side. Keep both: the difference between them is the entire skill this lesson teaches.',
          hint: 'Something like: "In 50 words, for someone who has never studied physics, explain why astronauts float. No equations."',
        },
        guide: [
          {
            step: 'Name the exact thing',
            body: 'One specific point, not a whole topic.',
          },
          {
            step: 'Set a length',
            body: 'A paragraph, three bullets, one sentence.',
          },
          {
            step: 'Name the reader',
            body: 'Their age or expertise decides the tone.',
          },
          {
            step: 'Rule something out',
            body: 'No jargon, no statistics, no bullet points.',
          },
        ],
        takeaways: [
          'A vague prompt produces an average answer, because averages are the safest guess.',
          'What, how long, and for whom fix most weak prompts.',
          'Politeness does not help; clarity does.',
          'Negative instructions ("no jargon") are genuinely useful.',
          'A longer prompt is usually faster than fixing a bad answer.',
        ],
      },
    },
    {
      topic: 'Giving Context',
      title: 'Giving Context',
      order: 3,
      language: 'ai',
      body: {
        tagline: 'It knows nothing about your situation unless you tell it.',
        intro:
          "A model has no idea who you are, what you are working on, or what you already tried. It cannot see your screen or your files. Every time you leave that out, it fills the gap with the most likely guess — and then the answer is right for somebody else's situation rather than yours.",
        sections: [
          {
            heading: 'Include the actual material',
            body: 'Do not describe your code, your essay or your error — PASTE it. "My loop is broken" gives it nothing to work with; the twelve lines and the exact error message give it everything. This is the single biggest improvement most people can make.',
            bullets: [
              'Paste the real code, text or error message.',
              'Include the exact wording of an error, not a summary.',
              'Say what you already tried, so it does not suggest that.',
            ],
          },
          {
            heading: 'It cannot see anything you have not shown it',
            body: "It has no access to your computer, your school's systems or a link's contents unless the tool you are using explicitly fetches it. If it appears to describe a file you did not paste, be suspicious — it is more likely generating something plausible than actually reading it.",
            bullets: [
              'No access to your files or screen by default.',
              'Referring to something you did not share is a warning sign.',
              'If unsure, ask it what it can actually see.',
            ],
          },
          {
            heading: 'A conversation remembers; a new chat does not',
            body: 'Within one conversation it can refer back to what you both said, so you can build up gradually and refine. Start a new chat and all of that is gone. Knowing which situation you are in saves a lot of confusion about why it "forgot".',
            bullets: [
              'Earlier messages in the same chat are available to it.',
              'A new conversation starts from nothing.',
              'Very long conversations may lose the earliest parts.',
            ],
          },
        ],
        snippet: {
          language: 'text',
          lines: [
            'NO CONTEXT:',
            '  "My C program does not work. Why?"',
            '  → It can only guess, so it lists ten common mistakes.',
            '',
            'WITH CONTEXT:',
            '  "This C program should print the average of two numbers',
            '   but prints 3 when I enter 7 and 2. I am on the C course',
            '   and have just learned about integer division.',
            '',
            '   #include <stdio.h>',
            '   int main(void) {',
            '       int a = 7, b = 2;',
            '       printf(\\"%d\\\\n\\", a / b);',
            '       return 0;',
            '   }',
            '',
            '   I already checked the values of a and b are right."',
            '',
            '→ Now it can name the actual cause, because it can SEE it.',
          ],
          caption:
            'The second version includes the code, the symptom, the expected result and what was already ruled out. Nothing is left to guess.',
        },
        tryIt: {
          language: 'text',
          starter:
            'Think of something you actually got stuck on in the Python or C course.\n',
          challenge:
            'Ask about it twice. First describe the problem in one vague sentence. Then ask again with the real code pasted in, the exact error, and what you already tried. Compare the two answers — this is the difference between a useful assistant and a horoscope.',
          hint: 'Include four things: the code, what you expected, what actually happened, and what you already ruled out.',
        },
        guide: [
          {
            step: 'Paste the real thing',
            body: 'Code, text, or the exact error message.',
          },
          { step: 'Say what you expected', body: 'And what happened instead.' },
          {
            step: 'Say what you already tried',
            body: 'So it does not suggest the same thing.',
          },
          {
            step: 'Remember what it cannot see',
            body: 'Your files and screen are invisible to it.',
          },
        ],
        takeaways: [
          'A model knows nothing about your situation unless you tell it.',
          'Paste the actual code, text or error rather than describing it.',
          'It cannot see your files or screen unless the tool fetches them.',
          'Saying what you already tried stops it repeating your work.',
          'One conversation has memory; a new chat starts from nothing.',
        ],
      },
    },
  ],

  'ai-prompt-craft': [
    {
      topic: 'Examples and Format',
      title: 'Showing, Not Just Telling',
      order: 1,
      language: 'ai',
      body: {
        tagline: 'One example is worth three sentences of description.',
        intro:
          'Describing the format you want is surprisingly hard; showing it is easy. Give one or two examples of exactly what you are after, and the model will follow the pattern — including details you would have struggled to put into words. This is the single most reliable prompting technique there is.',
        sections: [
          {
            heading: 'Give an example of the output',
            body: 'Providing examples is often called "few-shot" prompting. Show one completed item in exactly the shape you want and ask for more like it. The pattern carries the punctuation, capitalisation, length and tone all at once.',
            bullets: [
              'One or two examples is usually enough.',
              'The example carries details description would miss.',
              'Make the example EXACTLY right — it will be copied faithfully.',
            ],
          },
          {
            heading: 'Ask for a structure you can use',
            body: 'If you are going to put the answer into a table, a program or a spreadsheet, say so and name the format: JSON, CSV, a markdown table. Then you can use the answer directly instead of retyping it.',
            bullets: [
              'Name the format: JSON, CSV, a markdown table.',
              'Give the exact field names you want.',
              '"Only the JSON, no explanation" stops the surrounding chatter.',
            ],
          },
          {
            heading: 'A flawed example is copied too',
            body: 'The pattern is followed closely, so a mistake in your example gets reproduced throughout. If your sample has a typo or an inconsistent format, you will get that back many times over. Check your example before sending it.',
            bullets: [
              'Errors in your example are reproduced in the output.',
              'Inconsistent examples produce inconsistent output.',
              'Reread the example before you send it.',
            ],
          },
        ],
        snippet: {
          language: 'text',
          lines: [
            'TELLING (vague about the shape):',
            '  "Give me some facts about planets with their details."',
            '',
            'SHOWING (a pattern to follow):',
            '  "List five planets in exactly this format:',
            '',
            '   Mars | 4th from the Sun | has the tallest volcano',
            '',
            '   Name | position | one interesting fact. Nothing else."',
            '',
            'ASKING FOR STRUCTURED DATA:',
            '  "Return five planets as JSON, an array of objects with',
            '   keys name, position and fact. Only the JSON — no',
            '   explanation before or after it."',
            '',
            '→ The last one can be pasted straight into a program.',
          ],
          caption:
            'The example does the work of a paragraph of description, and it settles the separator, the order and the length together.',
        },
        tryIt: {
          language: 'text',
          starter:
            'Ask for a list of five books, giving ONE example line in exactly the format you want.\n',
          challenge:
            'Then ask for the same five as JSON with keys you choose, and "only the JSON". Finally, put a deliberate typo in your example line and watch it get copied into every row — which is why checking your example matters.',
          hint: 'Format example: Title | Author | one-line summary. Then ask for four more like it.',
        },
        guide: [
          {
            step: 'Write one perfect example',
            body: 'Exactly the shape and length you want.',
          },
          {
            step: 'Ask for more like it',
            body: 'The pattern carries the details for you.',
          },
          {
            step: 'Name a format if you will reuse it',
            body: 'JSON, CSV, a table — with the field names.',
          },
          {
            step: 'Check your example first',
            body: 'Any flaw in it will be faithfully reproduced.',
          },
        ],
        takeaways: [
          'Showing an example is more reliable than describing a format.',
          'One or two examples is usually enough — this is "few-shot" prompting.',
          'Name the format if you intend to use the output in a program.',
          '"Only the JSON, no explanation" removes the surrounding chatter.',
          'A mistake in your example is copied into every result.',
        ],
      },
    },
    {
      topic: 'Roles and Audience',
      title: 'Roles and Audience',
      order: 2,
      language: 'ai',
      body: {
        tagline:
          'Saying who it is writing FOR does more than saying who it is.',
        intro:
          'A popular trick is to open with "You are an expert historian". It does help a little — it steers vocabulary and focus. But naming the AUDIENCE helps far more, because that decides the vocabulary, the assumed knowledge, the length and the tone all at once. Between the two, the reader matters more than the persona.',
        sections: [
          {
            heading: 'A role sets the angle',
            body: '"Answer as a physics teacher" and "answer as a science journalist" produce genuinely different replies to the same question — different focus, different vocabulary, different examples. It is a quick way to get the kind of answer you want.',
            bullets: [
              'A role shifts focus, vocabulary and choice of example.',
              'Useful for getting a particular slant on a topic.',
              'It does NOT make the model more accurate.',
            ],
          },
          {
            heading: 'The audience does the heavy lifting',
            body: '"Explain recursion to a 10-year-old" and "explain recursion to a Java programmer" are almost different questions. The audience settles which words are allowed, what can be assumed, how long it should be and which analogies land. If you only add one thing to a prompt, add the audience.',
            bullets: [
              'The audience sets vocabulary and assumed knowledge.',
              'It also implies the right length and tone.',
              'If you add one thing to a prompt, make it this.',
            ],
          },
          {
            heading: 'A role does not add expertise',
            body: 'This is the important limit. "You are a doctor" does not make the medical information more reliable — it changes the STYLE, not the accuracy. Treating a confident persona as a qualification is how people get badly wrong information in a convincing voice.',
            bullets: [
              'A role changes tone, not correctness.',
              '"You are a doctor" is not medical advice.',
              'A confident persona can make a wrong answer more convincing.',
            ],
          },
        ],
        snippet: {
          language: 'text',
          lines: [
            'SAME QUESTION, DIFFERENT AUDIENCE:',
            '',
            '  "Explain what a variable is to a 9-year-old."',
            '  → "It is like a labelled box you keep something in..."',
            '',
            '  "Explain what a variable is to someone who knows C,',
            '   coming to Python."',
            '  → "Python names are references, and there is no',
            '     declared type — the same name can be rebound..."',
            '',
            'Both are correct. Neither would serve the other reader.',
            '',
            'ROLE PLUS AUDIENCE, together:',
            '  "You are a patient teacher. Explain to a beginner who',
            '   has just learned loops why an infinite loop happens.',
            '   Two short paragraphs, one worked example, no jargon."',
          ],
          caption:
            'The two answers are not better and worse — they are for different people. That is what naming the audience buys you.',
        },
        tryIt: {
          language: 'text',
          starter:
            'Pick something you learned in the C course — pointers, say.\n',
          challenge:
            'Ask for an explanation three times: for a 9-year-old, for a Python programmer, and for someone who has never programmed. Compare them. Then ask "as a doctor" about something medical and remember that the confident tone is style, not qualification.',
          hint: 'Change ONLY the audience between the three, so the difference you see is caused by that alone.',
        },
        guide: [
          {
            step: 'Name the audience',
            body: 'Their age or expertise. This does the most work.',
          },
          {
            step: 'Add a role if you want a slant',
            body: 'Teacher, journalist, reviewer.',
          },
          {
            step: 'Set length and tone',
            body: 'Two paragraphs, plain English, one example.',
          },
          {
            step: 'Do not mistake a role for expertise',
            body: 'It changes the style, not the accuracy.',
          },
        ],
        takeaways: [
          'Naming the audience helps more than naming a role.',
          'The audience settles vocabulary, assumed knowledge, length and tone.',
          'A role shifts focus and style, which is genuinely useful.',
          'A role does NOT make the model more accurate or qualified.',
          'A confident persona can make a wrong answer more convincing.',
        ],
      },
    },
    {
      topic: 'Constraints',
      title: 'Setting Limits',
      order: 3,
      language: 'ai',
      body: {
        tagline: 'Limits make an answer usable.',
        intro:
          'Left unconstrained, a model tends towards the middling and the long: a bit of everything, at moderate length, hedged. Constraints cut through that. A word limit, a required structure, a banned word, a fixed number of items — each one removes a decision it would otherwise make badly.',
        sections: [
          {
            heading: 'Count and length',
            body: '"Exactly five" beats "some". "Under 50 words" beats "briefly". Note that word counts are approximate — it is predicting text, not counting it — so treat a limit as a strong steer rather than a guarantee.',
            bullets: [
              '"Exactly five bullet points" is clearer than "a few".',
              '"Under 50 words" is clearer than "keep it short".',
              'Counts are approximate; expect close, not exact.',
            ],
          },
          {
            heading: 'Ban what you keep getting',
            body: 'If every answer opens with "In today\'s fast-paced world", say "do not begin with a general opening". If it keeps giving you bullet points when you wanted prose, say "no lists". Ruling out the thing you keep receiving is often the fastest fix available.',
            bullets: [
              '"No bullet points" when you want prose.',
              '"Do not restate my question" removes a common preamble.',
              '"No hedging — commit to an answer" cuts the qualifications.',
            ],
          },
          {
            heading: 'Give it permission to say no',
            body: 'A model will attempt almost anything, including making something up rather than admitting a gap. Adding "if you are not sure, say so" or "if the question cannot be answered from what I gave you, say that instead" gives it a legitimate alternative to inventing. It is one of the highest-value sentences you can add.',
            bullets: [
              '"If you are not sure, say so."',
              '"Only use the text I pasted; if it is not in there, say so."',
              'Without permission to decline, it invents instead.',
            ],
          },
        ],
        snippet: {
          language: 'text',
          lines: [
            'UNCONSTRAINED:',
            '  "Summarise this article."',
            '  → Some length, some format, probably hedged.',
            '',
            'CONSTRAINED:',
            '  "Summarise the article below in exactly three bullet',
            '   points, under 15 words each. No preamble, no',
            '   conclusion. If a point is not actually stated in the',
            '   article, leave it out rather than inferring it.',
            '',
            '   [article text pasted here]"',
            '',
            'Each constraint removed one bad decision:',
            '  • exactly three, under 15 words → length settled',
            '  • no preamble or conclusion     → no padding',
            '  • leave it out rather than infer → no invention',
          ],
          caption:
            'The last constraint is the important one: without it, a summary will happily include a point the article never made.',
        },
        tryIt: {
          language: 'text',
          starter:
            'Take any paragraph from one of your earlier course lessons.\n',
          challenge:
            'Ask for a summary with no constraints, then again with a bullet count, a word limit, "no preamble", and "if it is not in the text, leave it out". Compare. Then paste a paragraph and ask a question the paragraph does NOT answer — with and without permission to say "not stated" — and see what changes.',
          hint: 'That last experiment is the whole lesson. Without permission to decline, it will usually answer anyway.',
        },
        guide: [
          {
            step: 'Fix the count and length',
            body: '"Exactly three, under 15 words each."',
          },
          { step: 'Ban the padding', body: '"No preamble, no conclusion."' },
          {
            step: 'Rule out what you keep getting',
            body: '"No bullet points", "do not restate the question".',
          },
          {
            step: 'Allow it to decline',
            body: '"If it is not in the text, say so." This prevents invention.',
          },
        ],
        takeaways: [
          'Unconstrained answers drift towards medium-length and hedged.',
          'Exact counts and word limits are clearer than "briefly".',
          'Word counts are approximate — it predicts text, it does not count it.',
          'Banning what you keep receiving is often the fastest fix.',
          '"If you are not sure, say so" is one of the most valuable instructions there is.',
        ],
      },
    },
  ],

  'ai-thinking-prompts': [
    {
      topic: 'Step by Step',
      title: 'Asking for the Reasoning',
      order: 1,
      language: 'ai',
      body: {
        tagline: 'An answer you can follow is an answer you can check.',
        intro:
          'On a question with several steps, asking straight for the answer often gets a wrong one. Asking it to work through the steps first usually gets a right one — and, just as importantly, gives you something you can check. Since it generates text in order, the reasoning it writes becomes part of what it uses to produce the conclusion.',
        sections: [
          {
            heading: 'Ask it to work through it',
            body: '"Work through this step by step, then give the answer" measurably improves multi-step problems — arithmetic, logic, anything with several stages. It is the best-known prompting technique for a reason.',
            bullets: [
              'Say "step by step" or "show your working".',
              'Most effective on multi-step problems.',
              'Ask for the reasoning FIRST, then the conclusion.',
            ],
          },
          {
            heading: 'Reasoning you can check is the real prize',
            body: 'Even when the answer is right, the working is what lets you verify it. And when the answer is wrong, the working usually shows you exactly where it went wrong — which is far more useful than a bare wrong number, and often teaches you something.',
            bullets: [
              'Working lets you check a right answer.',
              'Working shows WHERE a wrong answer went wrong.',
              'A bare answer gives you nothing to inspect.',
            ],
          },
          {
            heading: 'Plausible reasoning can still be wrong',
            body: 'The important caveat. The steps are also generated text, so they can look convincing and contain a bad step — and a confident, well-formatted argument for a wrong answer is more persuasive than a bare wrong answer. Read the steps; do not just count them.',
            bullets: [
              'The reasoning is generated too, and can be flawed.',
              'Well-presented working is not proof of correctness.',
              'Check each step, especially arithmetic.',
            ],
          },
        ],
        snippet: {
          language: 'text',
          lines: [
            'STRAIGHT TO THE ANSWER:',
            '  "A shop sells pens at 3 for 2 pounds. I have 10 pounds.',
            '   How many pens can I buy?"',
            '  → A single number. Possibly wrong, and nothing to inspect.',
            '',
            'ASKING FOR THE WORKING:',
            '  "A shop sells pens at 3 for 2 pounds. I have 10 pounds.',
            '   Work through this step by step, then give the answer.',
            '   State any assumption you make."',
            '',
            '  → 1. Each set of 3 pens costs 2 pounds.',
            '    2. 10 / 2 = 5 complete sets.',
            '    3. 5 sets x 3 pens = 15 pens.',
            '    4. Assumption: pens are only sold in sets of 3.',
            '    Answer: 15 pens.',
            '',
            'Now you can check every line — including whether that',
            'assumption in step 4 is the one you actually meant.',
          ],
          caption:
            'Step 4 is the useful part. The assumption was hidden in the original question, and asking for the working surfaced it.',
        },
        tryIt: {
          language: 'text',
          starter:
            'Ask a multi-step word problem twice — once for just the answer, once with "work through it step by step".\n',
          challenge:
            'Check every line of the working, including the arithmetic. Then try a harder problem and look specifically for a step that sounds reasonable but is wrong — they do happen, and spotting one is the skill worth having.',
          hint: 'Good test problems mix a rate and a total: speeds and distances, prices and quantities.',
        },
        guide: [
          {
            step: 'Ask for step-by-step working',
            body: 'Reasoning first, answer last.',
          },
          {
            step: 'Ask it to state assumptions',
            body: 'That is often where the real disagreement hides.',
          },
          { step: 'Read every step', body: 'Especially the arithmetic.' },
          {
            step: 'Do not be persuaded by presentation',
            body: 'Neat working is not proof.',
          },
        ],
        takeaways: [
          'Asking for step-by-step working improves multi-step answers.',
          'Ask for the reasoning first and the conclusion last.',
          'Working is what lets you check the answer, right or wrong.',
          'Asking it to state its assumptions surfaces hidden ones.',
          'Convincing reasoning can still contain a wrong step.',
        ],
      },
    },
    {
      topic: 'Breaking Down a Problem',
      title: 'Breaking Down a Problem',
      order: 2,
      language: 'ai',
      body: {
        tagline: 'One big ask gets a shallow answer to all of it.',
        intro:
          'Ask for a whole website and you get a shallow sketch of a whole website. Ask for the page structure, then the styling, then the form, and each part gets real attention. Decomposition is a skill you already learned in the Python and C courses — it turns out to apply to prompting for exactly the same reasons.',
        sections: [
          {
            heading: 'One thing at a time',
            body: 'A prompt with five requests in it spreads the effort thinly over all five. Split them, and each answer is fuller and easier to judge. You also get to correct course after each step rather than after all of it.',
            bullets: [
              'One request per prompt gets a fuller answer.',
              'You can correct course between steps.',
              'Errors are easier to spot in a smaller answer.',
            ],
          },
          {
            heading: 'Ask for the plan first',
            body: 'For anything substantial, ask for an outline before any content. You can then fix the structure cheaply — while it is five bullet points — instead of discovering the shape is wrong after two pages have been written on it.',
            bullets: [
              '"Outline this in five bullet points first."',
              'Fixing a plan is much cheaper than fixing prose.',
              'Then ask it to expand one section at a time.',
            ],
          },
          {
            heading: 'Build on the conversation',
            body: 'Within one chat it remembers what you have agreed, so you can say "now write section two, in the same style" without repeating everything. That is what makes step-by-step building practical rather than tedious.',
            bullets: [
              'Refer back: "using the outline above...".',
              'No need to restate what you have established.',
              'A new chat loses all of it, so finish a task in one.',
            ],
          },
        ],
        snippet: {
          language: 'text',
          lines: [
            'ONE BIG ASK:',
            '  "Build me a website for a school chess club with pages,',
            '   styling, a signup form and a fixtures table."',
            '  → A thin sketch of four things, none of them finished.',
            '',
            'BROKEN DOWN:',
            '  1. "List the pages a school chess club site needs, and',
            '      one line on what each is for. Just the list."',
            '',
            '  2. "For the home page from that list, write the HTML',
            '      structure only — semantic elements, no styling."',
            '',
            '  3. "Now the CSS for that page. Mobile-first, and it',
            '      must pass 4.5:1 contrast."',
            '',
            '  4. "Now the signup form. Every input needs a label',
            '      joined by for and id."',
            '',
            '→ Four solid answers you can check one at a time, and',
            '  you can change your mind after step 1 for free.',
          ],
          caption:
            'Step 1 costs almost nothing and is where a wrong shape gets caught. Steps 3 and 4 carry the standards learned in the HTML course.',
        },
        tryIt: {
          language: 'text',
          starter:
            'Pick something you would like to build — a page about a hobby, say.\n',
          challenge:
            'Ask for it all in one prompt and keep the result. Then start again: ask for an outline, deliberately change one thing about it, and work through the parts one at a time. Compare the finished results, and notice how much easier the second one was to check.',
          hint: 'Always ask for the outline first. It is the cheapest place to discover you wanted something different.',
        },
        guide: [
          {
            step: 'Ask for a plan first',
            body: 'An outline you can correct cheaply.',
          },
          {
            step: 'Fix the plan before any content',
            body: 'Restructuring prose is far more work.',
          },
          {
            step: 'Do one part per prompt',
            body: 'Each gets real attention and is easy to check.',
          },
          {
            step: 'Build on the conversation',
            body: 'Refer back instead of repeating yourself.',
          },
        ],
        takeaways: [
          'One large request produces a shallow answer to all of it.',
          'Ask for an outline first — a plan is cheap to change.',
          'One request per prompt gets a fuller, checkable answer.',
          'You can correct course between steps instead of at the end.',
          'A single conversation remembers what you have agreed; a new one does not.',
        ],
      },
    },
    {
      topic: 'Asking It to Check',
      title: 'Asking It to Check Its Own Work',
      order: 3,
      language: 'ai',
      body: {
        tagline: 'A second pass catches real mistakes — but it is not proof.',
        intro:
          'Having produced an answer, a model can often find faults in it when asked to look again. This genuinely works: reviewing is a different task from producing, and a fresh pass catches things the first one missed. It is a useful habit and a weak guarantee, and knowing which is which matters.',
        sections: [
          {
            heading: 'Ask for a review as a separate step',
            body: '"Now check that for mistakes" or "what is the weakest part of that answer?" often produces real corrections. Asking it to critique its own work as if it were somebody else\'s tends to work better than asking "is that right?", which invites a yes.',
            bullets: [
              'Review as a separate step, after the answer.',
              '"What is weakest here?" beats "is this right?"',
              '"Are there cases this code would fail on?" is very effective.',
            ],
          },
          {
            heading: 'Ask for the counter-argument',
            body: '"What would somebody who disagreed say?" surfaces the assumptions in an answer. It is the fastest way to see whether a confident reply had any real basis, or was just confidently phrased.',
            bullets: [
              '"What is the strongest argument against this?"',
              '"What assumptions did you make?"',
              '"What would change your answer?"',
            ],
          },
          {
            heading: 'Agreement is not verification',
            body: 'The essential limit. Asking it twice and getting the same answer is not confirmation — the same patterns produce the same mistake. Self-checking finds careless errors; it cannot find an error rooted in what the model believes. For anything that matters, check against a source outside the conversation.',
            bullets: [
              'The same wrong answer twice is not two pieces of evidence.',
              'Self-checking finds slips, not systematic errors.',
              'Real verification comes from OUTSIDE the conversation.',
            ],
          },
        ],
        snippet: {
          language: 'text',
          lines: [
            'A USEFUL SEQUENCE:',
            '',
            '  1. "Write a C function that returns the largest value',
            '      in an array."',
            '',
            '  2. "Now review that as if a colleague wrote it. What',
            '      inputs would it fail on?"',
            '      → Often finds: an empty array, or a size of 0.',
            '',
            '  3. "What assumptions did you make about the input?"',
            '      → Surfaces: assumed size >= 1, assumed ints.',
            '',
            '  4. Then YOU compile it and try an empty array.',
            '',
            'Step 4 is the only one that actually verifies anything.',
            'Steps 2 and 3 make it much more likely to pass.',
          ],
          caption:
            'The review step reliably finds the empty-array case. But only step 4 is evidence, and it is the step people skip.',
        },
        tryIt: {
          language: 'text',
          starter:
            'Ask for a short function that does something with a list of numbers.\n',
          challenge:
            'Ask it to review its own code for inputs that would break it, then ask what assumptions it made. Then actually run it on those inputs and see whether the review was right. Doing this once will tell you exactly how much to trust a self-review.',
          hint: 'Empty inputs, a single item, negative numbers and duplicates break more code than anything else.',
        },
        guide: [
          {
            step: 'Get the answer first',
            body: 'Then review it as a separate step.',
          },
          {
            step: 'Ask what is weakest',
            body: 'Rather than "is this right?", which invites a yes.',
          },
          {
            step: 'Ask for assumptions and counter-arguments',
            body: 'That is where the real problems hide.',
          },
          {
            step: 'Verify outside the conversation',
            body: 'Run the code. Check the source. That is the only real evidence.',
          },
        ],
        takeaways: [
          'A model can often find genuine faults in its own answer when asked.',
          'Review as a separate step, and ask what is weakest rather than whether it is right.',
          'Asking for assumptions and counter-arguments surfaces hidden problems.',
          'The same answer twice is not confirmation — the same patterns repeat the same mistake.',
          'Only a check from outside the conversation actually verifies anything.',
        ],
      },
    },
  ],

  'ai-building': [
    {
      topic: 'Generating Code',
      title: 'Generating Code You Understand',
      order: 1,
      language: 'ai',
      body: {
        tagline: 'Never use code you cannot explain.',
        intro:
          'These tools write code well, and that creates a specific trap: it is entirely possible to produce a working program you could not have written and cannot debug. The rule that keeps you safe is simple and non-negotiable — if you cannot explain what a line does, you are not finished with it yet.',
        sections: [
          {
            heading: 'Say the language, version and constraints',
            body: '"Write a function in C11 that... using only the standard library" gets you something that fits where it has to go. Left unsaid, it will pick a language version and libraries by popularity, which may not be what your project can use.',
            bullets: [
              'Name the language AND version: C11, Python 3.',
              'Say what it may not use: no external libraries.',
              'Mention where it will run, if that constrains it.',
            ],
          },
          {
            heading: 'Ask it to explain, then check the explanation',
            body: 'Ask for a comment on each non-obvious line, or an explanation after the code. Then read the explanation against the code — occasionally they disagree, and when they do, the code is what runs. That mismatch is a reliable sign something is wrong.',
            bullets: [
              '"Explain each non-obvious line."',
              'Read the explanation against the actual code.',
              'If they disagree, trust the code and be suspicious.',
            ],
          },
          {
            heading: 'Test it yourself, on the awkward cases',
            body: 'Generated code is usually right for the ordinary case and much less often right for the edges: empty input, zero, one item, negatives, the maximum size. Those are exactly the cases you learned to think about in the C course, and they are where you will find the bugs.',
            bullets: [
              'Always run it. Do not trust it by reading.',
              'Test empty, zero, one, negative, and very large inputs.',
              'A confident explanation is not a test result.',
            ],
          },
        ],
        snippet: {
          language: 'text',
          lines: [
            'A GOOD CODE PROMPT:',
            '',
            '  "Write a C11 function:',
            '     int count_vowels(const char *s);',
            '',
            '   It returns how many vowels are in the string.',
            '   Standard library only. Handle a NULL pointer by',
            '   returning 0. Add a brief comment on any line that',
            '   is not obvious, then explain your approach in two',
            '   sentences."',
            '',
            'What each part bought:',
            '  • C11 + standard library only → it fits my project',
            '  • the exact signature         → it drops straight in',
            '  • "handle NULL"               → the edge case is stated',
            '  • comments + explanation      → I can check I follow it',
            '',
            'THEN: compile it and try "", NULL, "xyz", and "AEIOU".',
          ],
          caption:
            'The NULL requirement is stated because it is the case generated code most often forgets. The last line is not optional.',
        },
        tryIt: {
          language: 'text',
          starter:
            'Ask for a small C or Python function, naming the language version and one edge case it must handle.\n',
          challenge:
            'Read it and explain every line out loud before running anything. Then compile or run it and test the empty input, zero, and one item. If any line resisted explanation, ask about that specific line until it does not.',
          hint: 'If you cannot explain a line, that is the line to ask about. Do not move on from it.',
        },
        guide: [
          {
            step: 'State language, version and limits',
            body: 'And the exact signature if you have one.',
          },
          {
            step: 'Name the edge cases you care about',
            body: 'NULL, empty, zero — say them up front.',
          },
          {
            step: 'Ask for explanation, then check it',
            body: 'Against the code. Disagreement is a warning.',
          },
          {
            step: 'Run it on the awkward inputs',
            body: 'Reading is not testing.',
          },
        ],
        takeaways: [
          'Never ship code you cannot explain line by line.',
          'Name the language version and any libraries you cannot use.',
          'Generated code is weakest on edge cases: empty, zero, one, negative.',
          'If the explanation and the code disagree, the code is what runs.',
          'An explanation is not a test. Run it.',
        ],
      },
    },
    {
      topic: 'Iterating on a Draft',
      title: 'Improving Through Conversation',
      order: 2,
      language: 'ai',
      body: {
        tagline: 'The first answer is a draft. Say what to change.',
        intro:
          'Treating the first reply as final is the commonest way to get mediocre results. It is a draft. The efficient move is to say precisely what is wrong with it — not to rewrite your original prompt and start over, which throws away everything that was already right.',
        sections: [
          {
            heading: 'Change one thing at a time',
            body: '"Shorter, and drop the third point" is easy to act on. "Make it better" is not — better in what respect? Specific, single changes get reliably applied; vague global ones get a rewrite that may lose what you liked.',
            bullets: [
              'Name the specific change you want.',
              '"Make it better" gives it nothing to act on.',
              'One or two changes per turn, not ten.',
            ],
          },
          {
            heading: 'Say what to keep',
            body: 'Revision can lose the good parts. "Keep the second paragraph exactly as it is, and rewrite the first" protects what worked. Without that, you can go round in circles as each fix breaks something the last one got right.',
            bullets: [
              '"Keep paragraph two unchanged."',
              'Protects the parts you already approved.',
              'Prevents fixes that undo earlier fixes.',
            ],
          },
          {
            heading: 'Know when to start over',
            body: 'If the third revision is still wrong, the problem is usually the original framing rather than the details. At that point a fresh prompt built on what you have learned beats a fourth patch — and it is usually faster.',
            bullets: [
              'Three failed revisions means the framing is wrong.',
              'Start again with what you now know you want.',
              'A long thread of patches accumulates contradictions.',
            ],
          },
        ],
        snippet: {
          language: 'text',
          lines: [
            'VAGUE REVISION:',
            '  "Make it better."   → Anything might change, including',
            '                        the parts you liked.',
            '',
            'SPECIFIC REVISION:',
            '  "Two changes. Cut it to about 80 words, and remove the',
            '   sentence about costs. Keep the opening line exactly',
            '   as it is — that part is right."',
            '',
            'A NORMAL SEQUENCE:',
            '  1. Ask.',
            '  2. "Good, but too long. Half the length, same points."',
            '  3. "Now make the last sentence a question."',
            "  4. \"Keep everything, just replace 'utilise' with 'use'.\"",
            '',
            'Each step is small, applied reliably, and safe.',
          ],
          caption:
            '"Keep the opening line exactly as it is" is the instruction people forget, and it is what stops revision going backwards.',
        },
        tryIt: {
          language: 'text',
          starter: 'Ask for a short paragraph about something you like.\n',
          challenge:
            'Improve it over three turns, changing exactly one thing each time and saying what to keep. Then try a fourth turn with only "make it better" and see what happens to the parts you had already got right.',
          hint: 'Useful single changes: halve the length, change the audience, replace one word, turn the ending into a question.',
        },
        guide: [
          {
            step: 'Treat the first answer as a draft',
            body: 'It almost never is the finished thing.',
          },
          {
            step: 'Name one specific change',
            body: 'Shorter, drop a point, change a word.',
          },
          {
            step: 'Say what to keep',
            body: 'So a fix does not undo what worked.',
          },
          {
            step: 'Restart if three fixes fail',
            body: 'The framing is wrong, not the details.',
          },
        ],
        takeaways: [
          'The first reply is a draft, not an answer.',
          'Specific single changes are applied reliably; "make it better" is not.',
          'Say what to KEEP, or revision can lose the good parts.',
          'Three failed revisions means the original framing was wrong.',
          'Starting fresh with what you have learned often beats a fourth patch.',
        ],
      },
    },
    {
      topic: 'Reviewing What You Get',
      title: 'Reading Before Trusting',
      order: 3,
      language: 'ai',
      body: {
        tagline:
          'The output is a suggestion. You are still responsible for it.',
        intro:
          'This is the habit that separates using these tools well from using them badly. Whatever comes back — an essay, a function, a plan — you are the one putting your name to it. That means reading it properly, and knowing in advance which parts are most likely to be wrong.',
        sections: [
          {
            heading: 'The parts most likely to be wrong',
            body: 'Specific, checkable details: numbers, dates, names, quotations, citations, and any claim about a real person or event. These are precisely the parts that look most authoritative, which is what makes them dangerous. Fluent prose around a wrong date reads as more credible, not less.',
            bullets: [
              'Numbers, dates, names and quotations.',
              'Citations — invented references are a classic failure.',
              'Anything about a real, named person or event.',
            ],
          },
          {
            heading: 'Read code before running it',
            body: 'Never run generated code that touches files, deletes anything, installs software or sends data without reading it first. Not because it is malicious, but because it does not know your setup — a command that is fine on a clean machine can be destructive on yours.',
            bullets: [
              'Read anything that deletes, installs or uploads.',
              'It does not know what is on your machine.',
              'Ask what a command does before running it.',
            ],
          },
          {
            heading: 'You are accountable, not the tool',
            body: 'If you hand in work with an invented fact in it, that is your error. "The AI said so" is not a defence anybody accepts, and it should not be — you chose to include it. That responsibility is exactly why the reviewing habit is worth building now.',
            bullets: [
              'You are responsible for what you submit or ship.',
              '"The AI said so" is not a defence.',
              'Reviewing is part of the work, not an optional extra.',
            ],
          },
        ],
        snippet: {
          language: 'text',
          lines: [
            'A REVIEW CHECKLIST, for anything you are about to use:',
            '',
            '  1. Is every NUMBER, DATE and NAME checkable? Check them.',
            '  2. Are there citations? Verify each one EXISTS.',
            '  3. Can I explain every line of the code?',
            '  4. Does it delete, install, or send anything anywhere?',
            '  5. Did it answer the question I actually asked?',
            '  6. Is anything stated that my own source material',
            '     did not actually say?',
            '',
            'On (2): invented references are one of the most reliable',
            'failures there is. A plausible author, a plausible title,',
            'a plausible year — and no such paper. Always look it up.',
          ],
          caption:
            'Point 6 catches the subtle case: a summary that includes something the source never said, which is easy to miss precisely because it fits.',
        },
        tryIt: {
          language: 'text',
          starter:
            'Ask for a short paragraph about a historical event, with three specific dates and two sources.\n',
          challenge:
            'Check every date and try to find both sources. Then paste a paragraph of your own and ask a question it does not answer — and check whether the reply quietly invents something rather than saying "not stated". Both experiments teach the same lesson from different directions.',
          hint: 'Search for the exact title of each source. An invented one returns nothing, or a real paper with a different title.',
        },
        guide: [
          {
            step: 'Check the checkable',
            body: 'Numbers, dates, names, quotations.',
          },
          {
            step: 'Verify every citation exists',
            body: 'Invented references are a classic failure.',
          },
          {
            step: 'Read code before running it',
            body: 'Especially anything that deletes or installs.',
          },
          {
            step: 'Own the result',
            body: 'You are accountable for what you submit.',
          },
        ],
        takeaways: [
          'Numbers, dates, names and citations are the least reliable parts.',
          'Invented references look completely plausible — always verify them.',
          'Read any code that deletes, installs or sends data before running it.',
          'A summary can include something the source never said.',
          'You are responsible for what you submit; "the AI said so" is not a defence.',
        ],
      },
    },
  ],

  'ai-honestly': [
    {
      topic: 'Checking Claims',
      title: 'How to Check a Claim',
      order: 1,
      language: 'ai',
      body: {
        tagline: 'Verification comes from outside the conversation.',
        intro:
          'You now know that a model can be confidently wrong. This lesson is the practical response: how to actually check something, efficiently, without checking everything. The key principle is that evidence has to come from OUTSIDE the conversation — asking the same tool again is not a second opinion.',
        sections: [
          {
            heading: 'Decide what is worth checking',
            body: 'You cannot verify every sentence, and you do not need to. Check what would MATTER if it were wrong: anything you will submit or publish, anything about a real person, anything that affects a decision. A brainstorm of story ideas needs no checking at all.',
            bullets: [
              'Check what matters if it is wrong.',
              'Facts you will repeat publicly always matter.',
              'A creative brainstorm needs no verification.',
            ],
          },
          {
            heading: 'Go to a source that is not the model',
            body: 'A textbook, an official site, documentation, an encyclopaedia, a teacher. For code, the real check is running it. For a fact, it is a source that existed before you asked. Asking the model to confirm itself is not verification, however confident the confirmation sounds.',
            bullets: [
              'For code: run it. That is the real test.',
              'For a fact: a source that existed before you asked.',
              'Asking it "are you sure?" proves nothing.',
            ],
          },
          {
            heading: 'Watch for the specific-and-unverifiable',
            body: 'The reddest flag there is: a very precise detail you cannot find anywhere. "A 2019 study at Leeds found 43% of..." with no trace of that study. Real facts leave traces. A precise claim with no source is more suspicious than a vague one, not less.',
            bullets: [
              'Precise statistics with no findable source.',
              'Quotations you cannot locate anywhere.',
              'Papers, books or people who do not appear to exist.',
            ],
          },
        ],
        snippet: {
          language: 'text',
          lines: [
            'A CLAIM WORTH CHECKING:',
            '',
            '  "The C programming language was created in 1972 at',
            '   Bell Labs by Dennis Ritchie."',
            '',
            '  → Specific, checkable, and something you might repeat.',
            '    Look it up. (It is right — but you did not know that',
            '    until you checked, and it sounded exactly as',
            '    confident as a wrong answer would have.)',
            '',
            'A CLAIM THAT SHOULD WORRY YOU:',
            '',
            '  "A 2019 study at the University of Leeds found that',
            '   43% of beginners abandon programming in week three."',
            '',
            '  → Very precise. Search for it. If a specific study',
            '    cannot be found at all, treat the number as invented',
            '    — because that is the most likely explanation.',
          ],
          caption:
            'Both sound equally authoritative. The difference only appears when you look, which is the entire argument for looking.',
        },
        tryIt: {
          language: 'text',
          starter:
            'Ask for five facts about a topic you are studying, each with a source.\n',
          challenge:
            'Check all five against something that is not the model, and try to find every source. Note how the wrong ones — if any — sounded no different from the right ones. Then ask it to "confirm" a fact you have already proved wrong, and see what it does.',
          hint: 'Ask about something slightly obscure. Very famous facts are usually right; the edges are where it invents.',
        },
        guide: [
          {
            step: 'Decide if it matters',
            body: 'Would being wrong cause a problem?',
          },
          {
            step: 'Find a source outside the chat',
            body: 'Documentation, a textbook, an official site.',
          },
          {
            step: 'For code, run it',
            body: 'Execution is the only real test.',
          },
          {
            step: 'Distrust precise-and-untraceable',
            body: 'Real facts leave traces.',
          },
        ],
        takeaways: [
          'Verification must come from outside the conversation.',
          'Check what would matter if it were wrong; not everything needs checking.',
          'Asking the model to confirm itself proves nothing.',
          'For code, running it is the real test.',
          'A precise statistic with no findable source is probably invented.',
        ],
      },
    },
    {
      topic: 'Bias and Limits',
      title: 'Bias and Blind Spots',
      order: 2,
      language: 'ai',
      body: {
        tagline:
          'It learned from what people wrote — including what they got wrong.',
        intro:
          "A model's view of the world comes from its training text. Where that text was uneven, incomplete or prejudiced, so is the model — and it will present the result in the same even, confident tone as everything else. Knowing where those gaps usually are tells you when to be more careful.",
        sections: [
          {
            heading: 'It reflects its training text',
            body: 'If most of the writing on a subject came from one country, one language or one era, the answers lean that way. Ask for "typical breakfast" or "a famous scientist" and you get an answer shaped by whose writing dominated the training data — usually English-language and Western.',
            bullets: [
              'Over-represented views appear as the default.',
              'English-language and Western sources usually dominate.',
              'Ask explicitly for other perspectives; they are in there.',
            ],
          },
          {
            heading: 'It has a knowledge cut-off',
            body: 'Training ended at some point, so recent events may be missing or wrong. It also may not know that it does not know — it can answer a question about last month with the same confidence as one about last century. Ask about anything recent with care.',
            bullets: [
              'Recent events may be missing entirely.',
              'It may answer confidently anyway.',
              'For anything current, check a live source.',
            ],
          },
          {
            heading: 'Stereotypes survive in the patterns',
            body: 'Ask it to describe a nurse or an engineer and you may get an assumed gender, because that assumption was common in the text it learned from. This is worth spotting for a practical reason as well as a fair one: the same mechanism produces subtler errors in less obvious places.',
            bullets: [
              'Occupations, names and places carry assumptions.',
              'Naming a group explicitly usually corrects it.',
              'The same mechanism causes subtler errors elsewhere.',
            ],
          },
        ],
        snippet: {
          language: 'text',
          lines: [
            'EXPERIMENTS WORTH RUNNING YOURSELF:',
            '',
            '  1. "Describe a typical breakfast."',
            '     → Whose breakfast did you get? Now ask for a',
            '       typical breakfast in three different countries.',
            '',
            '  2. "Write two sentences about a nurse and an engineer."',
            '     → Were any genders assumed? Ask again, explicitly',
            '       varying them, and compare.',
            '',
            '  3. "Name five important computer scientists."',
            '     → Which countries and which era? Ask for five more',
            '       from outside that group. They exist.',
            '',
            '  4. "What happened in the news last week?"',
            '     → Does it say it cannot know, or answer anyway?',
            '       That distinction matters a great deal.',
            '',
            'The pattern in every case: it defaults to whatever was',
            'most common in the text, and asking directly fixes it.',
          ],
          caption:
            'Experiment 4 is the most useful. A tool that admits a gap is easier to work with than one that fills it in.',
        },
        tryIt: {
          language: 'text',
          starter:
            'Run experiment 1 above: ask for "a typical breakfast" with no other detail.\n',
          challenge:
            'Then ask for a typical breakfast in three named countries and compare. Try experiment 3 as well, and notice that the second list is perfectly good — the information was there, it just was not the default.',
          hint: 'The point is not that it cannot do better. It is that the default answer reflects the training text, and you have to ask.',
        },
        guide: [
          {
            step: 'Notice the default',
            body: 'Whose perspective did an unqualified answer assume?',
          },
          {
            step: 'Ask explicitly for others',
            body: 'Naming a group or country usually works.',
          },
          {
            step: 'Be careful about anything recent',
            body: 'There is a cut-off, and it may not admit it.',
          },
          {
            step: 'Watch for assumed attributes',
            body: 'Gender, nationality, era in descriptions.',
          },
        ],
        takeaways: [
          'A model reflects its training text, including its gaps and prejudices.',
          'Over-represented perspectives appear as the neutral default.',
          'Explicitly asking for other perspectives usually works.',
          'There is a knowledge cut-off, and recent events may be wrong.',
          'A tool that admits it cannot know something is more useful than one that guesses.',
        ],
      },
    },
    {
      topic: 'Being Honest About Help',
      title: 'Being Honest About Help',
      order: 3,
      language: 'ai',
      body: {
        tagline: 'Say what you used. It costs nothing and protects everything.',
        intro:
          'Using these tools is not cheating. Passing off their work as entirely your own, when you were asked not to, is. The line is about honesty rather than about the tool, and the last lesson of this ladder is how to stay on the right side of it — which is mostly a matter of saying so.',
        sections: [
          {
            heading: 'Find out the rule, then follow it',
            body: 'Different teachers, schools and workplaces have different rules, and they are all legitimate. Some ban it, some require a note, some encourage it. Assuming instead of asking is how people get into trouble over something that would have been fine if declared.',
            bullets: [
              'Ask what is allowed before you rely on it.',
              'Rules differ by class and by task, quite reasonably.',
              '"I did not know" is a much weaker position than asking.',
            ],
          },
          {
            heading: 'Note what you used it for',
            body: 'A single line is usually enough: "I used an AI assistant to check my grammar and suggest a structure; the content and code are mine." It is specific, it is honest, and it takes ten seconds. Being upfront also makes it easier for someone to help you properly.',
            bullets: [
              'One specific line, not a vague disclaimer.',
              'Say WHAT it did: checked spelling, suggested a structure.',
              'Specific is more credible than "AI was used".',
            ],
          },
          {
            heading: 'Learning is still the point',
            body: 'The practical argument, beyond honesty. If it writes your code and you do not understand it, you cannot fix it, cannot extend it, and will not be able to do the next thing without it. The final tests on this ladder are closed-book for exactly that reason: they measure what YOU can do.',
            bullets: [
              'Code you do not understand is code you cannot maintain.',
              'The habit of not understanding compounds over time.',
              'Use it to learn faster, not to skip the learning.',
            ],
          },
        ],
        snippet: {
          language: 'text',
          lines: [
            'GOOD USES — you are still doing the thinking:',
            '  • "Explain why my loop runs one time too many."',
            '  • "What am I misunderstanding about pointers?"',
            '  • "Review my code and tell me what I missed."',
            '  • "Give me three practice questions on the box model."',
            '',
            'USES THAT NEED A NOTE — or may not be allowed:',
            '  • Having it write an essay you submit.',
            '  • Having it write code you hand in.',
            '  • Having it answer an assessment question.',
            '',
            'A NOTE THAT IS ENOUGH:',
            '  "I used an AI assistant to suggest the structure of',
            '   this page and to check my CSS for contrast problems.',
            '   The HTML, the CSS and the writing are my own."',
            '',
            'Specific, honest, ten seconds to write.',
          ],
          caption:
            'Note that every "good use" leaves the pupil doing the thinking. That is the distinction that actually matters.',
        },
        tryIt: {
          language: 'text',
          starter:
            'Think about how you have used AI tools during these four courses.\n',
          challenge:
            "Write the one-line note you would attach to your best piece of work, specific about what the tool did and what you did. Then find out your school's actual rule — if you do not already know it, that is the most useful thing you can do today.",
          hint: 'Name the task, not the tool: "checked my grammar", "suggested a structure", "explained an error message".',
        },
        guide: [
          { step: 'Find out the rule', body: 'Ask. Do not assume.' },
          {
            step: 'Write a specific note',
            body: 'What the tool did, and what you did.',
          },
          {
            step: 'Keep doing the thinking',
            body: 'Use it to understand faster, not to skip understanding.',
          },
          {
            step: 'Never submit what you cannot explain',
            body: 'The same rule as the code lesson.',
          },
        ],
        takeaways: [
          'Using AI tools is not cheating; misrepresenting the work is.',
          'Rules differ, so find out what applies before you rely on it.',
          'A single specific line of acknowledgement is usually enough.',
          'Code you do not understand is code you cannot fix or extend.',
          'Never submit anything you could not explain if asked.',
        ],
      },
    },
  ],
};

/**
 * QUIZ BLUEPRINTS for the AI & Prompting course, keyed by world slug.
 *
 * These carry a heavier share of the teaching than the other courses' quizzes,
 * because the important claims here are not syntax a compiler will enforce —
 * they are judgements about when to trust a tool. So the explanations argue
 * rather than merely confirm.
 *
 * The verification questions are deliberately the most numerous. A course that
 * taught prompting without teaching checking would be worse than no course.
 */
export const AI_QUIZ_BLUEPRINTS = {
  'ai-prompt-basics': [
    {
      title: 'Basics 1: What a Model Does',
      topicLesson: 'What a Model Actually Does',
      questions: [
        {
          type: 'mcq',
          prompt: 'What is a language model fundamentally doing?',
          options: [
            'producing text that is likely to follow your input',
            'looking answers up in a database',
            'searching the internet',
            'running a program',
          ],
          correctAnswer: 'producing text that is likely to follow your input',
          explanation:
            'Almost everything surprising about these tools follows from this — the creativity and the confident errors come from the same mechanism.',
        },
        {
          type: 'mcq',
          prompt:
            'You ask the same question twice and get different answers. What does that mean?',
          options: [
            'your prompt was invalid',
            'nothing is wrong — there is deliberate randomness in the output',
            'the tool is broken',
            'the first answer was wrong',
          ],
          correctAnswer:
            'nothing is wrong — there is deliberate randomness in the output',
          explanation:
            'Neither reply is "the" answer, which is why repetition is not verification.',
        },
        {
          type: 'fillblank',
          prompt:
            'When a model invents a plausible but false detail, that is called ____.',
          correctAnswer: ['hallucination', 'hallucinating', 'a hallucination'],
          explanation:
            'It is not deception — it is producing text that fits the pattern of a real answer.',
        },
        {
          type: 'mcq',
          prompt: 'What does a confident tone tell you about accuracy?',
          options: [
            'that it checked its sources',
            'that it is certain',
            'nothing at all',
            'that it is probably right',
          ],
          correctAnswer: 'nothing at all',
          explanation:
            'It sounds equally sure when right and when wrong. This is the most important thing to internalise.',
        },
        {
          type: 'mcq',
          prompt: 'Which parts of an answer are LEAST trustworthy?',
          options: [
            'general explanations',
            'creative suggestions',
            'grammar corrections',
            'specific names, numbers, dates and citations',
          ],
          correctAnswer: 'specific names, numbers, dates and citations',
          explanation:
            'Precisely the parts that look most authoritative, which is what makes them dangerous.',
        },
      ],
    },
    {
      title: 'Basics 2: Being Specific',
      topicLesson: 'Being Specific',
      questions: [
        {
          type: 'mcq',
          prompt: 'Why does a vague prompt produce a bland answer?',
          options: [
            'it has to guess length, audience and tone, and guesses the middle of each',
            'it ignores short prompts',
            'it needs more words to work',
            'vague prompts cause errors',
          ],
          correctAnswer:
            'it has to guess length, audience and tone, and guesses the middle of each',
          explanation:
            'An average of everything IS a bland answer. Every detail you supply is a guess it no longer makes.',
        },
        {
          type: 'mcq',
          prompt: 'Which improves an answer more?',
          options: [
            'adding please and thank you',
            'being specific about what you want',
            'being more polite',
            'using longer sentences',
          ],
          correctAnswer: 'being specific about what you want',
          explanation: 'Courtesy adds nothing. Clarity is the whole game.',
        },
        {
          type: 'fillblank',
          prompt:
            'Three details that fix most weak prompts: what, how long, and for ____.',
          correctAnswer: ['whom', 'who'],
          explanation:
            'The audience settles vocabulary, assumed knowledge and tone all at once.',
        },
        {
          type: 'mcq',
          prompt: 'Are negative instructions like "no jargon" useful?',
          options: [
            'only for code',
            'only in long prompts',
            'yes — ruling things out steers the answer well',
            'no, models ignore negatives',
          ],
          correctAnswer: 'yes — ruling things out steers the answer well',
          explanation:
            'It is often faster to rule out what you keep getting than to describe what you want.',
        },
        {
          type: 'mcq',
          prompt: 'Which is the better prompt?',
          options: [
            '"Tell me about ice."',
            '"Please could you kindly explain ice to me?"',
            '"Ice — explain."',
            '"In 50 words, for a 9-year-old, explain why ice floats. No chemistry terms."',
          ],
          correctAnswer:
            '"In 50 words, for a 9-year-old, explain why ice floats. No chemistry terms."',
          explanation:
            'Length, audience, one specific point, and something ruled out. Nothing left to be bland about.',
        },
      ],
    },
    {
      title: 'Basics 3: Giving Context',
      topicLesson: 'Giving Context',
      questions: [
        {
          type: 'mcq',
          prompt:
            'What is the biggest improvement most people can make when asking about broken code?',
          options: [
            'paste the actual code and the exact error',
            'describe the problem more carefully',
            'ask more politely',
            'use shorter sentences',
          ],
          correctAnswer: 'paste the actual code and the exact error',
          explanation:
            '"My loop is broken" gives it nothing. The twelve lines give it everything.',
        },
        {
          type: 'mcq',
          prompt: 'Can a model see the files on your computer?',
          options: [
            'only code files',
            'no, unless the tool explicitly fetches them',
            'yes, always',
            'yes, if you mention them',
          ],
          correctAnswer: 'no, unless the tool explicitly fetches them',
          explanation:
            'If it describes something you never shared, be suspicious — it is more likely generating than reading.',
        },
        {
          type: 'fillblank',
          prompt:
            'Saying what you already ____ stops it suggesting the same thing.',
          correctAnswer: ['tried', 'attempted', 'checked'],
          explanation:
            'Otherwise you get the ten most common causes, including the ones you eliminated.',
        },
        {
          type: 'mcq',
          prompt: 'What happens to context when you start a NEW conversation?',
          options: [
            'it is remembered for a day',
            'only code is remembered',
            'it is gone — the new chat starts from nothing',
            'it carries over',
          ],
          correctAnswer: 'it is gone — the new chat starts from nothing',
          explanation:
            'Which is why it is worth finishing a task in one conversation.',
        },
        {
          type: 'mcq',
          prompt: 'Beyond the code, what else should you include?',
          options: [
            'the time of day',
            'your operating system version only',
            'nothing else is useful',
            'what you expected and what actually happened',
          ],
          correctAnswer: 'what you expected and what actually happened',
          explanation:
            'The gap between those two is the actual problem, and it is often the part left out.',
        },
      ],
    },
  ],

  'ai-prompt-craft': [
    {
      title: 'Craft 1: Examples and Format',
      topicLesson: 'Showing, Not Just Telling',
      questions: [
        {
          type: 'mcq',
          prompt: 'Why is giving an example better than describing a format?',
          options: [
            'the example carries details that are hard to put into words',
            'examples are shorter',
            'models cannot read descriptions',
            'it is not better',
          ],
          correctAnswer:
            'the example carries details that are hard to put into words',
          explanation:
            'Punctuation, capitalisation, length and tone all travel with the pattern at once.',
        },
        {
          type: 'fillblank',
          prompt:
            'Providing a couple of examples in a prompt is often called ____-shot prompting.',
          correctAnswer: ['few'],
          explanation: 'One or two is usually enough.',
        },
        {
          type: 'mcq',
          prompt: 'What happens if your example contains a typo?',
          options: [
            'nothing',
            'it gets copied into every result',
            'it is corrected automatically',
            'the prompt fails',
          ],
          correctAnswer: 'it gets copied into every result',
          explanation:
            'The pattern is followed faithfully, flaws included. Reread your example before sending it.',
        },
        {
          type: 'mcq',
          prompt:
            'You want to use the answer in a program. What should you ask for?',
          options: [
            'bullet points',
            'a table drawn with dashes',
            'a named format like JSON, with the exact field names',
            'a nicely written paragraph',
          ],
          correctAnswer: 'a named format like JSON, with the exact field names',
          explanation: 'Then you can use it directly instead of retyping it.',
        },
        {
          type: 'mcq',
          prompt: 'What does adding "only the JSON, no explanation" achieve?',
          options: [
            'makes it faster',
            'improves accuracy',
            'nothing',
            'removes the surrounding chatter so the output is usable as-is',
          ],
          correctAnswer:
            'removes the surrounding chatter so the output is usable as-is',
          explanation:
            'Otherwise you get a helpful sentence before and after, which breaks a parser.',
        },
      ],
    },
    {
      title: 'Craft 2: Roles and Audience',
      topicLesson: 'Roles and Audience',
      questions: [
        {
          type: 'mcq',
          prompt: 'Which helps more — naming a role or naming the audience?',
          options: [
            'the audience',
            'the role',
            'they are identical',
            'neither helps',
          ],
          correctAnswer: 'the audience',
          explanation:
            'The audience settles vocabulary, assumed knowledge, length and tone together. If you add one thing, add this.',
        },
        {
          type: 'mcq',
          prompt:
            'Does "you are a doctor" make medical information more reliable?',
          options: [
            'only with a source',
            'no — it changes the style, not the accuracy',
            'yes',
            'yes, for common conditions',
          ],
          correctAnswer: 'no — it changes the style, not the accuracy',
          explanation:
            'And a confident persona makes a wrong answer MORE convincing, which is the real danger.',
        },
        {
          type: 'fillblank',
          prompt:
            "A role usefully shifts the answer's ____ and choice of examples.",
          correctAnswer: ['focus', 'tone', 'style', 'angle'],
          explanation:
            'A physics teacher and a science journalist give genuinely different answers to the same question.',
        },
        {
          type: 'mcq',
          prompt:
            '"Explain recursion to a 10-year-old" versus "to a Java programmer" — what differs?',
          options: [
            'nothing much',
            'only the politeness',
            'vocabulary, assumed knowledge, length and the analogies used',
            'only the length',
          ],
          correctAnswer:
            'vocabulary, assumed knowledge, length and the analogies used',
          explanation:
            'They are almost different questions. Both answers are correct and neither serves the other reader.',
        },
        {
          type: 'mcq',
          prompt: 'What is the safest way to think about a role instruction?',
          options: [
            'a qualification',
            'a guarantee of accuracy',
            'a fact-checking mode',
            'a way to choose a slant, not a source of expertise',
          ],
          correctAnswer: 'a way to choose a slant, not a source of expertise',
          explanation:
            'Genuinely useful for getting the kind of answer you want; no help at all with correctness.',
        },
      ],
    },
    {
      title: 'Craft 3: Constraints',
      topicLesson: 'Setting Limits',
      questions: [
        {
          type: 'mcq',
          prompt: 'Which is the more useful instruction?',
          options: [
            '"exactly three bullet points, under 15 words each"',
            '"keep it brief"',
            '"make it good"',
            '"summarise"',
          ],
          correctAnswer: '"exactly three bullet points, under 15 words each"',
          explanation:
            'Each constraint removes a decision it would otherwise make badly.',
        },
        {
          type: 'mcq',
          prompt: 'How exact are word-count limits?',
          options: [
            'ignored entirely',
            'approximate — it predicts text, it does not count it',
            'exact',
            'exact for short limits only',
          ],
          correctAnswer: 'approximate — it predicts text, it does not count it',
          explanation:
            'Treat a limit as a strong steer rather than a guarantee.',
        },
        {
          type: 'fillblank',
          prompt:
            'Adding "if you are not sure, ____" gives it an alternative to inventing.',
          correctAnswer: ['say so', 'say', 'tell me'],
          explanation:
            'One of the highest-value sentences you can add to any prompt.',
        },
        {
          type: 'mcq',
          prompt: 'Why does giving permission to decline reduce invention?',
          options: [
            'it makes it search',
            'it does not help',
            'without a legitimate alternative it will attempt an answer anyway',
            'it disables the model',
          ],
          correctAnswer:
            'without a legitimate alternative it will attempt an answer anyway',
          explanation:
            'A model will try almost anything, including making something up rather than admitting a gap.',
        },
        {
          type: 'mcq',
          prompt:
            'You are summarising a pasted article. Which constraint matters most?',
          options: [
            '"be interesting"',
            '"use formal language"',
            '"add a conclusion"',
            '"if a point is not stated in the article, leave it out"',
          ],
          correctAnswer:
            '"if a point is not stated in the article, leave it out"',
          explanation:
            'Without it, a summary will happily include a point the article never made.',
        },
      ],
    },
  ],

  'ai-thinking-prompts': [
    {
      title: 'Thinking 1: Step by Step',
      topicLesson: 'Asking for the Reasoning',
      questions: [
        {
          type: 'mcq',
          prompt: 'What does asking for step-by-step working do?',
          options: [
            'improves multi-step answers and gives you something to check',
            'makes it slower for no benefit',
            'guarantees correctness',
            'only changes the formatting',
          ],
          correctAnswer:
            'improves multi-step answers and gives you something to check',
          explanation:
            'The reasoning it writes becomes part of what it uses to produce the conclusion.',
        },
        {
          type: 'mcq',
          prompt: 'Which order should you ask for?',
          options: [
            'it makes no difference',
            'reasoning first, answer last',
            'answer first, reasoning after',
            'answer only',
          ],
          correctAnswer: 'reasoning first, answer last',
          explanation:
            'It generates in order, so the working has to come before the conclusion to help it.',
        },
        {
          type: 'fillblank',
          prompt:
            'Asking it to state its ____ surfaces the ones hidden in your question.',
          correctAnswer: ['assumptions', 'assumption'],
          explanation: 'Often the most useful line in the whole answer.',
        },
        {
          type: 'mcq',
          prompt:
            'Well-presented working with a neat layout means the answer is...',
          options: [
            'checked',
            'from a source',
            'not necessarily right — the steps are generated too',
            'definitely right',
          ],
          correctAnswer: 'not necessarily right — the steps are generated too',
          explanation:
            'A confident, well-formatted argument for a wrong answer is MORE persuasive than a bare wrong answer.',
        },
        {
          type: 'mcq',
          prompt:
            'What is the practical value of working, when the answer is wrong?',
          options: [
            'nothing',
            'it proves the answer',
            'it hides the error',
            'it shows you where it went wrong',
          ],
          correctAnswer: 'it shows you where it went wrong',
          explanation:
            'Far more useful than a bare wrong number, and it often teaches you something.',
        },
      ],
    },
    {
      title: 'Thinking 2: Breaking It Down',
      topicLesson: 'Breaking Down a Problem',
      questions: [
        {
          type: 'mcq',
          prompt:
            'What do you get from a prompt containing five separate requests?',
          options: [
            'a shallow answer to all five',
            'five thorough answers',
            'an error',
            'the first one only',
          ],
          correctAnswer: 'a shallow answer to all five',
          explanation:
            'The effort spreads thinly. Split them and each gets real attention.',
        },
        {
          type: 'fillblank',
          prompt:
            'For anything substantial, ask for an ____ before any content.',
          correctAnswer: ['outline', 'plan'],
          explanation: 'A plan is cheap to change; two pages of prose are not.',
        },
        {
          type: 'mcq',
          prompt: 'Why ask for the plan first?',
          options: [
            'it saves tokens',
            'fixing a five-bullet outline is far cheaper than restructuring finished work',
            'it is traditional',
            'plans are more accurate',
          ],
          correctAnswer:
            'fixing a five-bullet outline is far cheaper than restructuring finished work',
          explanation:
            'And it is where you discover you wanted something different.',
        },
        {
          type: 'mcq',
          prompt:
            'Within one conversation, do you need to restate what you have agreed?',
          options: [
            'only for code',
            'only after five messages',
            'no — you can refer back to it',
            'yes, every time',
          ],
          correctAnswer: 'no — you can refer back to it',
          explanation:
            'Which is what makes step-by-step building practical rather than tedious.',
        },
        {
          type: 'mcq',
          prompt: 'Where have you met this skill before on this ladder?',
          options: [
            'nowhere',
            'only in HTML',
            'only in quizzes',
            'breaking a problem into steps, in the Python and C courses',
          ],
          correctAnswer:
            'breaking a problem into steps, in the Python and C courses',
          explanation:
            'Decomposition applies to prompting for exactly the same reasons it applies to programming.',
        },
      ],
    },
    {
      title: 'Thinking 3: Asking It to Check',
      topicLesson: 'Asking It to Check Its Own Work',
      questions: [
        {
          type: 'mcq',
          prompt: 'Which question gets a better review?',
          options: [
            '"what is the weakest part of that?"',
            '"is that right?"',
            '"are you sure?"',
            '"confirm that"',
          ],
          correctAnswer: '"what is the weakest part of that?"',
          explanation:
            'Asking whether it is right invites a yes. Asking what is weakest invites actual criticism.',
        },
        {
          type: 'mcq',
          prompt:
            'You ask twice and get the same answer. What have you learned?',
          options: [
            'that it checked',
            'nothing — the same patterns produce the same mistake',
            'that it is correct',
            'that it is probably correct',
          ],
          correctAnswer: 'nothing — the same patterns produce the same mistake',
          explanation:
            'The same wrong answer twice is not two pieces of evidence. This is the essential limit of self-checking.',
        },
        {
          type: 'fillblank',
          prompt: 'Real verification has to come from ____ the conversation.',
          correctAnswer: ['outside', 'beyond'],
          explanation:
            'Running the code, or a source that existed before you asked.',
        },
        {
          type: 'mcq',
          prompt: 'What CAN self-review reliably find?',
          options: [
            'invented citations',
            'nothing at all',
            'careless slips and missed edge cases',
            'systematic errors in what it believes',
          ],
          correctAnswer: 'careless slips and missed edge cases',
          explanation:
            'Asking "what inputs would this fail on?" very often turns up the empty-array case.',
        },
        {
          type: 'mcq',
          prompt:
            'After it reviews its own code, what is the only step that proves anything?',
          options: [
            'asking it once more',
            'asking it to rate its confidence',
            'reading it again',
            'compiling and running it yourself',
          ],
          correctAnswer: 'compiling and running it yourself',
          explanation: 'And it is the step people skip.',
        },
      ],
    },
  ],

  'ai-building': [
    {
      title: 'Building 1: Generating Code',
      topicLesson: 'Generating Code You Understand',
      questions: [
        {
          type: 'mcq',
          prompt: 'What is the rule about generated code?',
          options: [
            'never use code you cannot explain',
            'never use generated code at all',
            'always use it if it compiles',
            'only use it for small functions',
          ],
          correctAnswer: 'never use code you cannot explain',
          explanation:
            'It is entirely possible to produce a working program you cannot debug. That is the trap.',
        },
        {
          type: 'mcq',
          prompt: 'Where is generated code weakest?',
          options: [
            'the formatting',
            'edge cases: empty, zero, one item, negatives',
            'the ordinary case',
            'the syntax',
          ],
          correctAnswer: 'edge cases: empty, zero, one item, negatives',
          explanation:
            'Exactly the cases you learned to think about in the C course.',
        },
        {
          type: 'fillblank',
          prompt: 'If the explanation and the code disagree, trust the ____.',
          correctAnswer: ['code'],
          explanation:
            'The code is what runs — and the mismatch is a reliable sign something is wrong.',
        },
        {
          type: 'mcq',
          prompt: 'Why name the language VERSION in your prompt?',
          options: [
            'it makes it faster',
            'to be polite',
            'otherwise it picks by popularity, which may not suit your project',
            'versions do not matter',
          ],
          correctAnswer:
            'otherwise it picks by popularity, which may not suit your project',
          explanation:
            'Same for libraries: say if you can only use the standard library.',
        },
        {
          type: 'mcq',
          prompt:
            'Is a confident explanation of the code a substitute for running it?',
          options: [
            'yes',
            'yes for short functions',
            'only if it lists the edge cases',
            'no — an explanation is not a test result',
          ],
          correctAnswer: 'no — an explanation is not a test result',
          explanation: 'Reading is not testing. Run it on the awkward inputs.',
        },
      ],
    },
    {
      title: 'Building 2: Iterating',
      topicLesson: 'Improving Through Conversation',
      questions: [
        {
          type: 'mcq',
          prompt: 'How should you treat the first reply?',
          options: [
            'as a draft',
            'as the final answer',
            'as a mistake',
            'as a suggestion to ignore',
          ],
          correctAnswer: 'as a draft',
          explanation:
            'Treating it as final is the commonest way to get mediocre results.',
        },
        {
          type: 'mcq',
          prompt: 'Why is "make it better" a poor revision instruction?',
          options: [
            'it is rude',
            'it gives nothing to act on, and may change the parts you liked',
            'it is too short',
            'models reject it',
          ],
          correctAnswer:
            'it gives nothing to act on, and may change the parts you liked',
          explanation:
            'Better in what respect? Specific single changes are applied reliably.',
        },
        {
          type: 'fillblank',
          prompt: 'Saying what to ____ stops a revision losing the good parts.',
          correctAnswer: ['keep', 'preserve'],
          explanation:
            '"Keep the second paragraph exactly as it is" prevents fixes that undo earlier fixes.',
        },
        {
          type: 'mcq',
          prompt: 'The third revision is still wrong. What should you do?',
          options: [
            'accept it',
            'change tool',
            'start again — the original framing is the problem',
            'try a fourth revision',
          ],
          correctAnswer: 'start again — the original framing is the problem',
          explanation:
            'A long thread of patches accumulates contradictions. A fresh prompt built on what you learned is faster.',
        },
        {
          type: 'mcq',
          prompt: 'How many changes per revision turn work best?',
          options: [
            'as many as possible',
            'exactly five',
            'none',
            'one or two',
          ],
          correctAnswer: 'one or two',
          explanation:
            'Small, specific changes are applied reliably and are easy to judge.',
        },
      ],
    },
    {
      title: 'Building 3: Reviewing',
      topicLesson: 'Reading Before Trusting',
      questions: [
        {
          type: 'mcq',
          prompt:
            'Whose responsibility is an invented fact in work you submit?',
          options: [
            'yours — you chose to include it',
            "the tool's",
            "nobody's",
            "the tool provider's",
          ],
          correctAnswer: 'yours — you chose to include it',
          explanation:
            '"The AI said so" is not a defence anybody accepts, and it should not be.',
        },
        {
          type: 'mcq',
          prompt: 'What is a classic AI failure that looks entirely plausible?',
          options: [
            'a missing paragraph',
            'an invented citation with a real-sounding author and title',
            'a spelling mistake',
            'a slow response',
          ],
          correctAnswer:
            'an invented citation with a real-sounding author and title',
          explanation:
            'Plausible author, plausible title, plausible year — and no such paper. Always look them up.',
        },
        {
          type: 'fillblank',
          prompt:
            'Always read generated code before running it if it ____ anything.',
          correctAnswer: ['deletes', 'removes', 'installs'],
          explanation:
            'Not because it is malicious, but because it does not know what is on your machine.',
        },
        {
          type: 'mcq',
          prompt: 'Which subtle error is easiest to miss in a summary?',
          options: [
            'the wrong length',
            'a missing heading',
            'a point the source never actually made',
            'a spelling error',
          ],
          correctAnswer: 'a point the source never actually made',
          explanation:
            'Easy to miss precisely because it fits the rest of the summary.',
        },
        {
          type: 'mcq',
          prompt: 'Which parts of an answer deserve checking first?',
          options: [
            'the introduction',
            'the formatting',
            'the closing sentence',
            'numbers, dates, names and quotations',
          ],
          correctAnswer: 'numbers, dates, names and quotations',
          explanation:
            'The specific and checkable — which is also what looks most authoritative.',
        },
      ],
    },
  ],

  'ai-honestly': [
    {
      title: 'Honestly 1: Checking Claims',
      topicLesson: 'How to Check a Claim',
      questions: [
        {
          type: 'mcq',
          prompt: 'What counts as verifying a claim?',
          options: [
            'a source outside the conversation',
            'asking the model again',
            'asking "are you sure?"',
            'the model rating its confidence',
          ],
          correctAnswer: 'a source outside the conversation',
          explanation:
            'Everything inside the conversation shares the same patterns, and therefore the same mistakes.',
        },
        {
          type: 'mcq',
          prompt: 'Which claim should worry you MOST?',
          options: [
            'a creative suggestion',
            'a precise statistic from a study you cannot find anywhere',
            'a general explanation',
            'a rounded estimate',
          ],
          correctAnswer:
            'a precise statistic from a study you cannot find anywhere',
          explanation:
            'Real facts leave traces. A precise claim with no source is more suspicious than a vague one, not less.',
        },
        {
          type: 'fillblank',
          prompt: 'For generated code, the real verification is to ____ it.',
          correctAnswer: ['run', 'execute', 'compile'],
          explanation: 'Execution is evidence. Reading is not.',
        },
        {
          type: 'mcq',
          prompt: 'Does everything need checking?',
          options: [
            'no, nothing does',
            'only code',
            'no — check what would matter if it were wrong',
            'yes, every sentence',
          ],
          correctAnswer: 'no — check what would matter if it were wrong',
          explanation:
            'A brainstorm of story ideas needs none. Anything you will submit or repeat publicly does.',
        },
        {
          type: 'mcq',
          prompt:
            'You prove a fact wrong, then ask the model to confirm it. What is that worth?',
          options: [
            'a second opinion',
            'proof',
            'a useful check',
            'nothing — self-confirmation is not evidence',
          ],
          correctAnswer: 'nothing — self-confirmation is not evidence',
          explanation: 'However confident the confirmation sounds.',
        },
      ],
    },
    {
      title: 'Honestly 2: Bias and Limits',
      topicLesson: 'Bias and Blind Spots',
      questions: [
        {
          type: 'mcq',
          prompt: "Where does a model's view of the world come from?",
          options: [
            'the text it was trained on, including its gaps and prejudices',
            'a curated encyclopaedia',
            'live internet searches',
            "its programmers' opinions",
          ],
          correctAnswer:
            'the text it was trained on, including its gaps and prejudices',
          explanation:
            'And it presents the result in the same even, confident tone as everything else.',
        },
        {
          type: 'mcq',
          prompt:
            'You ask for "a typical breakfast" with no other detail. What do you get?',
          options: [
            'a list of every country',
            'whatever was most common in the training text, usually Western',
            'a global average',
            'a question back',
          ],
          correctAnswer:
            'whatever was most common in the training text, usually Western',
          explanation:
            'Over-represented perspectives appear as the neutral default. Asking explicitly usually fixes it.',
        },
        {
          type: 'fillblank',
          prompt:
            'Training ended at some point, which is called the knowledge ____.',
          correctAnswer: ['cut-off', 'cutoff', 'cut off'],
          explanation:
            'Recent events may be missing — and it may answer confidently anyway.',
        },
        {
          type: 'mcq',
          prompt: 'Why do stereotypes appear in descriptions of occupations?',
          options: [
            'it is guessing randomly',
            'they do not appear',
            'the assumptions were common in the text it learned from',
            'they are programmed in',
          ],
          correctAnswer:
            'the assumptions were common in the text it learned from',
          explanation:
            'Worth spotting for a practical reason too: the same mechanism causes subtler errors elsewhere.',
        },
        {
          type: 'mcq',
          prompt: 'Which behaviour makes a tool MORE useful?',
          options: [
            'always producing an answer',
            'sounding confident',
            'answering quickly',
            'admitting when it cannot know something',
          ],
          correctAnswer: 'admitting when it cannot know something',
          explanation:
            'A tool that fills a gap with a guess is harder to work with than one that names the gap.',
        },
      ],
    },
    {
      title: 'Honestly 3: Being Honest About Help',
      topicLesson: 'Being Honest About Help',
      questions: [
        {
          type: 'mcq',
          prompt: 'Is using an AI assistant cheating?',
          options: [
            'not in itself — misrepresenting the work is',
            'always',
            'never, in any circumstance',
            'only for code',
          ],
          correctAnswer: 'not in itself — misrepresenting the work is',
          explanation: 'The line is about honesty, not about the tool.',
        },
        {
          type: 'mcq',
          prompt: 'What should you do before relying on it for schoolwork?',
          options: [
            'use it and mention it if asked',
            'find out the actual rule for that class or task',
            'assume it is allowed',
            'assume it is banned',
          ],
          correctAnswer: 'find out the actual rule for that class or task',
          explanation:
            'Rules differ, quite reasonably. Assuming is how people get into trouble over something that would have been fine if declared.',
        },
        {
          type: 'fillblank',
          prompt:
            'A good acknowledgement is ____ about what the tool actually did.',
          correctAnswer: ['specific', 'honest', 'clear'],
          explanation:
            '"Checked my grammar and suggested a structure" is more credible than "AI was used".',
        },
        {
          type: 'mcq',
          prompt:
            'What is the practical problem with submitting code you do not understand?',
          options: [
            'it is always wrong',
            'there is no problem',
            'you cannot fix or extend it, and the habit compounds',
            'it runs more slowly',
          ],
          correctAnswer: 'you cannot fix or extend it, and the habit compounds',
          explanation:
            'And the final tests on this ladder are closed-book precisely because they measure what YOU can do.',
        },
        {
          type: 'mcq',
          prompt: 'Which use leaves you doing the thinking?',
          options: [
            '"Write my essay"',
            '"Answer this assessment question"',
            '"Write the code I have to hand in"',
            '"Explain why my loop runs one time too many"',
          ],
          correctAnswer: '"Explain why my loop runs one time too many"',
          explanation: 'Use it to learn faster, not to skip the learning.',
        },
      ],
    },
  ],
};

export default { AI_WORLDS, AI_LESSON_CONTENT, AI_QUIZ_BLUEPRINTS };

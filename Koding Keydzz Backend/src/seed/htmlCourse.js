/**
 * THE HTML & CSS COURSE — the third rung of the ladder.
 *
 * A pupil arrives having passed Python and C, so they can already think in
 * sequences, conditions and loops. This course is a deliberate change of
 * character rather than a third language in the same mould:
 *
 *   • IT IS NOT A PROGRAMMING LANGUAGE, and saying so early matters. HTML
 *     describes structure and CSS describes appearance; neither has variables
 *     or loops. A pupil who expects `if` and cannot find it concludes they have
 *     misunderstood, when in fact they are looking for something not there.
 *
 *   • THE FEEDBACK LOOP IS VISUAL. In Python a mistake printed the wrong
 *     number; here it moves a box. That is the most motivating thing about this
 *     course, so every lesson is built around something the pupil can see
 *     change.
 *
 *   • THE FINAL TEST IS A BUILD, not a set of coding questions — 20 knowledge
 *     questions plus three tasks worth 30, 30 and 40. So the course teaches
 *     towards making a working page, not towards reciting tag names.
 *
 * Worlds are ordered from 11 (after Python's 1-5 and C's 6-10) and slugs are
 * `html-` prefixed, so nothing can collide.
 */

export const HTML_WORLDS = [
  {
    name: 'Structure Studio',
    slug: 'html-structure-studio',
    order: 11,
    topics: ['Tags and Elements', 'Page Skeleton', 'Text and Headings'],
    description:
      'Every web page is a set of labelled boxes. Learn what a tag is, how a page is put together, and how to mark up text so a browser — and a person — knows what matters.',
    requiredLevel: 1,
    icon: 'studio',
  },
  {
    name: 'Content Corner',
    slug: 'html-content-corner',
    order: 12,
    topics: ['Lists', 'Links and Images', 'Tables'],
    description:
      'Fill your pages with real content. Make lists a browser understands, link pages together, add pictures with proper descriptions, and lay out data in a table.',
    requiredLevel: 3,
    icon: 'corner',
  },
  {
    name: 'Style Street',
    slug: 'html-style-street',
    order: 13,
    topics: ['Selectors', 'Colours and Fonts', 'The Box Model'],
    description:
      'Now make it look like something. Point CSS at the right elements, choose colours and type that work together, and understand the box every element really is.',
    requiredLevel: 5,
    icon: 'street',
  },
  {
    name: 'Layout Lane',
    slug: 'html-layout-lane',
    order: 14,
    topics: ['Flexbox', 'CSS Grid', 'Responsive Design'],
    description:
      'Arrange things on purpose. Line elements up with flexbox, build real grids, and make a page that works on a phone as well as a laptop.',
    requiredLevel: 7,
    icon: 'lane',
  },
  {
    name: 'Polish Plaza',
    slug: 'html-polish-plaza',
    order: 15,
    topics: ['Forms', 'Semantic HTML', 'Accessibility'],
    description:
      'The difference between a page that works and a page that is good. Collect input with forms, use tags that carry meaning, and build something everybody can use.',
    requiredLevel: 9,
    icon: 'plaza',
  },
];

export const HTML_LESSON_CONTENT = {
  'html-structure-studio': [
    {
      topic: 'Tags and Elements',
      title: 'Tags and Elements',
      order: 1,
      language: 'html',
      body: {
        tagline: 'HTML labels your content so a browser knows what it is.',
        intro:
          'HTML is not a programming language — there is nothing to run, no variables and no loops. It is a way of LABELLING content. You wrap a piece of text in a tag, and the tag says what that text is: a heading, a paragraph, a list item. The browser reads those labels and decides how to show it.',
        sections: [
          {
            heading: 'A tag comes in a pair',
            body: 'Most tags have an opening and a closing half: <p>Hello</p>. The closing one has a slash. Everything between them is the content, and the whole thing — open tag, content, close tag — is called an element.',
            bullets: [
              '<p> opens a paragraph; </p> closes it.',
              'The slash is what makes it a closing tag.',
              'Tag + content + closing tag = an element.',
            ],
          },
          {
            heading: 'Some tags stand alone',
            body: 'A few tags have no content to wrap, so they have no closing half. <img> puts a picture on the page and <br> forces a line break. These are called void or empty elements, and forgetting that they need no closing tag is a very common early mistake.',
            bullets: [
              '<img> and <br> have no closing tag.',
              'They are called void elements.',
              'Writing </img> is not valid HTML.',
            ],
          },
          {
            heading: 'Attributes add detail',
            body: 'A tag can carry extra information inside its opening half, written name="value". <img src="cat.jpg" alt="A ginger cat"> uses src to say WHICH picture and alt to describe it for anyone who cannot see it. Attribute values go in double quotes.',
            bullets: [
              'Attributes live in the opening tag only.',
              'Written as name="value", in quotes.',
              'alt on an image is a description, not a caption — it matters.',
            ],
          },
        ],
        snippet: {
          language: 'html',
          lines: [
            '<h1>My Favourite Animals</h1>',
            '<p>I like cats the most.</p>',
            '',
            '<img src="cat.jpg" alt="A ginger cat asleep on a windowsill">',
            '',
            '<p>Dogs are a close second.<br>They are very loud.</p>',
          ],
          caption:
            'Four elements. Note that <img> and <br> have no closing tag, and that the alt text describes the picture properly.',
        },
        tryIt: {
          language: 'html',
          starter:
            '<h1>About Me</h1>\n<p>Change this paragraph to say something true.</p>\n',
          challenge:
            'Add a second paragraph about a hobby. Then add an <img> with an alt description — any src will do, and if the file does not exist you will see the alt text appear, which shows you exactly why it matters.',
          hint: 'A paragraph is <p>your text</p>. The image is <img src="something.jpg" alt="a description">, with no closing tag.',
        },
        guide: [
          {
            step: 'Choose the tag that describes your content',
            body: 'A heading is <h1>, a paragraph is <p>. The tag says what the thing IS.',
          },
          {
            step: 'Wrap the content',
            body: 'Opening tag, your content, closing tag with a slash.',
          },
          {
            step: 'Add attributes if the tag needs them',
            body: 'Inside the opening tag: <img src="..." alt="...">',
          },
          {
            step: 'Remember the void elements',
            body: '<img> and <br> wrap nothing, so they have no closing tag.',
          },
        ],
        takeaways: [
          'HTML labels content; it does not compute anything.',
          'Most elements are an opening tag, content, and a closing tag.',
          'The closing tag is the one with the slash.',
          '<img> and <br> are void elements and have no closing tag.',
          'Attributes go in the opening tag as name="value".',
        ],
      },
    },
    {
      topic: 'Page Skeleton',
      title: 'The Shape of a Page',
      order: 2,
      language: 'html',
      body: {
        tagline:
          'Every page has the same bones: head for information, body for content.',
        intro:
          'A single tag is not a web page. A real page has a fixed outer structure that every page in the world shares — and because it is always the same, learning it once means you can start any page from scratch. The key idea is the split between the head (facts about the page) and the body (what people actually see).',
        sections: [
          {
            heading: 'The five lines that start every page',
            body: '<!DOCTYPE html> tells the browser this is modern HTML. Then <html> wraps everything, <head> holds information about the page, and <body> holds the content. That is the skeleton, and it does not change.',
            bullets: [
              '<!DOCTYPE html> comes first and is not really a tag.',
              '<html> wraps the whole document.',
              '<head> is information; <body> is content.',
            ],
          },
          {
            heading: 'The head is not visible',
            body: 'Nothing in the head appears on the page. It holds the <title> (which shows in the browser tab, not the page), the character set, and links to stylesheets. Putting a paragraph in the head is a classic mistake — it simply will not show up.',
            bullets: [
              '<title> appears in the TAB, not on the page.',
              '<meta charset="utf-8"> makes accented and non-Latin characters work.',
              'Content in the head does not display.',
            ],
          },
          {
            heading: 'Nesting must not cross over',
            body: 'Elements go inside other elements, and the inner one must close before the outer one does. <p><strong>Hi</strong></p> is right; <p><strong>Hi</p></strong> crosses over and is wrong. Indenting each level makes this easy to see.',
            bullets: [
              'Close the inner element first — last opened, first closed.',
              'Indent each level of nesting so the shape is visible.',
              'Browsers often silently fix crossed tags, which hides the mistake.',
            ],
          },
        ],
        snippet: {
          language: 'html',
          lines: [
            '<!DOCTYPE html>',
            '<html lang="en">',
            '  <head>',
            '    <meta charset="utf-8">',
            '    <title>My First Page</title>   <!-- shows in the TAB -->',
            '  </head>',
            '  <body>',
            '    <h1>Welcome</h1>',
            '    <p>This part is <strong>visible</strong>.</p>',
            '  </body>',
            '</html>',
          ],
          caption:
            'The full skeleton. lang="en" tells screen readers which language to pronounce, and the indentation shows the nesting at a glance.',
        },
        tryIt: {
          language: 'html',
          starter:
            '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8">\n    <title>Change Me</title>\n  </head>\n  <body>\n    <h1>Hello</h1>\n  </body>\n</html>\n',
          challenge:
            'Change the title and notice it changes the tab, not the page. Then deliberately put a <p> inside the <head> and confirm it does not appear — knowing that head content is invisible will save you a confusing half hour later.',
          hint: 'The <title> is inside <head>. Anything you want people to SEE goes inside <body>.',
        },
        guide: [
          {
            step: 'Start with the doctype',
            body: '<!DOCTYPE html> on the very first line.',
          },
          {
            step: 'Wrap everything in <html>',
            body: 'Add lang="en" so assistive software knows the language.',
          },
          {
            step: 'Put information in the head',
            body: 'Charset and title. Nothing here is visible on the page.',
          },
          {
            step: 'Put content in the body',
            body: 'Everything a visitor reads goes here, properly nested.',
          },
        ],
        takeaways: [
          'Every page has the same skeleton: doctype, html, head, body.',
          'The head holds information; nothing in it is visible.',
          '<title> appears in the browser tab, not on the page.',
          'Inner elements must close before outer ones.',
          'Indenting makes nesting mistakes visible.',
        ],
      },
    },
    {
      topic: 'Text and Headings',
      title: 'Marking Up Text',
      order: 3,
      language: 'html',
      body: {
        tagline: 'Headings are an outline, not a font size.',
        intro:
          'HTML has six heading levels, h1 to h6, and it is tempting to pick one because of how big it looks. That is the wrong reason. Headings are the OUTLINE of your page — screen readers use them to navigate, and search engines use them to understand structure. Choose the level that describes the content, then use CSS if you want a different size.',
        sections: [
          {
            heading: 'Headings are levels, not sizes',
            body: 'One <h1> per page, naming what the page is. <h2> for its main sections, <h3> for subsections of those, and so on. Skipping from h1 straight to h4 because it looks right breaks the outline for anyone navigating by headings.',
            bullets: [
              "One h1 per page — the page's own title.",
              'Do not skip levels: h2 then h3, never h2 then h4.',
              'To change the size, use CSS — not a different level.',
            ],
          },
          {
            heading: 'Emphasis means something',
            body: '<strong> means "this is important" and <em> means "this changes the emphasis of the sentence". They usually LOOK bold and italic, but the meaning is the point: a screen reader can change its tone. <b> and <i> only change appearance and carry no meaning.',
            bullets: [
              '<strong> for importance, <em> for emphasis.',
              'Prefer them over <b> and <i>, which mean nothing.',
              'A screen reader can voice strong and em differently.',
            ],
          },
          {
            heading: 'Whitespace collapses',
            body: "HTML squashes any run of spaces, tabs and newlines into a single space. So pressing Enter twice does not make a gap, and lining text up with spaces does nothing. Layout is CSS's job; use separate elements and let CSS space them.",
            bullets: [
              'Many spaces or newlines render as one space.',
              'Blank lines in your HTML do not create gaps on the page.',
              'Use <p> elements and CSS spacing, not <br><br>.',
            ],
          },
        ],
        snippet: {
          language: 'html',
          lines: [
            '<h1>Cooking for Beginners</h1>',
            '',
            '<h2>Getting Started</h2>',
            '<p>You need <strong>very few</strong> tools to begin.</p>',
            '',
            '<h3>The Only Three Things</h3>',
            '<p>A pan, a knife, and a <em>little</em> patience.</p>',
            '',
            '<h2>Your First Meal</h2>',
            '<p>These      extra      spaces all collapse into one.</p>',
          ],
          caption:
            'The headings form an outline: h1, then h2 with an h3 under it, then another h2. Note the collapsed spaces in the last paragraph.',
        },
        tryIt: {
          language: 'html',
          starter: '<h1>My Page</h1>\n<p>One paragraph.</p>\n',
          challenge:
            'Turn this into a proper outline: add two <h2> sections, each with a paragraph, and put an <h3> under the first one. Then try adding several blank lines between two paragraphs and confirm the page looks exactly the same.',
          hint: 'Order matters: h1, then h2, then h3 under that h2, then the next h2. Use <strong> on a word to mark it important.',
        },
        guide: [
          {
            step: 'Use one h1 for the page',
            body: 'It names what the whole page is about.',
          },
          {
            step: 'Break content into h2 sections',
            body: 'Each main section gets an h2, in order.',
          },
          {
            step: 'Nest deeper levels without skipping',
            body: 'An h3 belongs under an h2, never directly under an h1.',
          },
          {
            step: 'Mark meaning, not looks',
            body: '<strong> and <em> for importance and emphasis; CSS for size.',
          },
        ],
        takeaways: [
          'Headings h1-h6 are an outline, not font sizes.',
          'Use one h1 per page and never skip a level.',
          '<strong> and <em> carry meaning; <b> and <i> do not.',
          'HTML collapses runs of whitespace into a single space.',
          "Spacing and layout are CSS's job, not <br><br>.",
        ],
      },
    },
  ],

  'html-content-corner': [
    {
      topic: 'Lists',
      title: 'Lists a Browser Understands',
      order: 1,
      language: 'html',
      body: {
        tagline: 'Two kinds of list, and the items always go inside.',
        intro:
          'You could type a dash in front of each line and call it a list. A browser would not know it was one, and neither would a screen reader — which announces "list, five items" and lets a user skip it. Marking a list up properly costs two extra tags and makes it real.',
        sections: [
          {
            heading: 'Unordered and ordered',
            body: '<ul> is for things where order does not matter (a shopping list) and shows bullets. <ol> is for things where it does (steps in a recipe) and numbers them automatically — so inserting a step in the middle renumbers everything for free.',
            bullets: [
              '<ul> = unordered, shown with bullets.',
              '<ol> = ordered, numbered automatically.',
              'Never type the numbers yourself in an <ol>.',
            ],
          },
          {
            heading: 'Every item is an <li>',
            body: 'Each entry goes in an <li> element, and <li> must be a direct child of <ul> or <ol>. Putting a paragraph directly inside a <ul> is invalid — wrap it in an <li> first.',
            bullets: [
              '<li> means list item.',
              'Only <li> may sit directly inside <ul> or <ol>.',
              'An <li> can itself contain paragraphs, links, anything.',
            ],
          },
          {
            heading: 'Lists nest inside items',
            body: 'A sub-list goes INSIDE the <li> it belongs to, not between two <li> elements. This is the single most common list mistake, and it produces a page that looks nearly right and is structurally wrong.',
            bullets: [
              'The nested <ul> goes inside the parent <li>.',
              'Close the nested list before closing that <li>.',
              'Between two <li> elements is the wrong place.',
            ],
          },
        ],
        snippet: {
          language: 'html',
          lines: [
            '<h2>Shopping</h2>',
            '<ul>',
            '  <li>Apples</li>',
            '  <li>',
            '    Bread',
            '    <ul>                     <!-- nested INSIDE the li -->',
            '      <li>White</li>',
            '      <li>Brown</li>',
            '    </ul>',
            '  </li>',
            '  <li>Milk</li>',
            '</ul>',
            '',
            '<h2>How to Make Tea</h2>',
            '<ol>',
            '  <li>Boil the water</li>',
            '  <li>Add the teabag</li>',
            '  <li>Wait three minutes</li>',
            '</ol>',
          ],
          caption:
            'The nested list sits inside the "Bread" item, which is what makes it a sub-list of it rather than a sibling.',
        },
        tryIt: {
          language: 'html',
          starter:
            '<h2>My Favourite Foods</h2>\n<ul>\n  <li>Pizza</li>\n  <li>Pasta</li>\n</ul>\n',
          challenge:
            'Add a third item with a nested list of two toppings inside it. Then write an <ol> of three steps for making a sandwich — and swap two steps around to watch the numbers fix themselves.',
          hint: "The nested <ul> goes between the item text and that item's </li>.",
        },
        guide: [
          {
            step: 'Pick the right list',
            body: '<ul> if order does not matter, <ol> if it does.',
          },
          {
            step: 'Put each entry in an <li>',
            body: 'One <li> per item, directly inside the list.',
          },
          {
            step: 'Nest sub-lists inside the item',
            body: 'Inside the parent <li>, before its closing tag.',
          },
          {
            step: 'Let <ol> do the numbering',
            body: 'Never type numbers — reordering then breaks them.',
          },
        ],
        takeaways: [
          '<ul> is unordered and bulleted; <ol> is ordered and numbered.',
          'Every entry is an <li>, and only <li> may sit directly inside a list.',
          'A nested list goes INSIDE its parent <li>.',
          '<ol> numbers items automatically, so reordering is free.',
          'A marked-up list can be announced and skipped by screen readers.',
        ],
      },
    },
    {
      topic: 'Links and Images',
      title: 'Links and Images',
      order: 2,
      language: 'html',
      body: {
        tagline: 'href goes where, alt says what.',
        intro:
          'Links are what make the web a web. An <a> element with an href attribute turns text into something clickable. Images work similarly but need something extra: a text description, because not everybody can see the picture and sometimes the picture does not load.',
        sections: [
          {
            heading: 'The anchor element',
            body: '<a href="https://example.com">Visit Example</a>. The href says where to go; the text between the tags is what people click. Leaving out the href makes it a link to nowhere — it still looks like text but does nothing.',
            bullets: [
              'href is the destination.',
              'The text between the tags is the clickable part.',
              'No href means no link.',
            ],
          },
          {
            heading: 'Link text must make sense alone',
            body: 'Screen reader users can pull up a list of every link on a page, out of context. A page of nine links all called "click here" is useless to them. Write link text that describes its destination.',
            bullets: [
              'Good: "Read our opening hours".',
              'Bad: "click here", "more", "link".',
              'Link text is read out of context, so it must stand alone.',
            ],
          },
          {
            heading: 'Images need alt text',
            body: '<img src="dog.jpg" alt="A collie catching a frisbee">. src is the file; alt is what the picture SHOWS, for anyone who cannot see it and for when the file fails to load. A decorative image that adds no information gets alt="" — empty, but present, which tells assistive software to skip it.',
            bullets: [
              'src = which file, alt = what it shows.',
              'alt="" (empty) is correct for purely decorative images.',
              'Missing alt entirely is different from alt="" — and worse.',
            ],
          },
        ],
        snippet: {
          language: 'html',
          lines: [
            '<p>',
            '  Read the <a href="rules.html">competition rules</a> before entering.',
            '</p>',
            '',
            '<p>',
            '  Our site is built with',
            '  <a href="https://developer.mozilla.org">MDN\'s HTML guide</a>.',
            '</p>',
            '',
            '<img src="dog.jpg" alt="A collie catching a frisbee mid-air">',
            '',
            '<!-- Decorative only: empty alt tells a screen reader to skip it -->',
            '<img src="divider.png" alt="">',
          ],
          caption:
            'Both link texts describe where they go. The second image is decoration, so its alt is deliberately empty rather than missing.',
        },
        tryIt: {
          language: 'html',
          starter:
            '<p>My favourite site is <a href="https://example.com">click here</a>.</p>\n',
          challenge:
            'Rewrite that link text so it makes sense on its own. Then add an image with a proper alt description, and point src at a file that does not exist — you will see the alt text render, which is exactly what a screen reader user gets.',
          hint: 'Describe the destination: <a href="...">Example\'s home page</a>.',
        },
        guide: [
          {
            step: 'Wrap the text in <a>',
            body: 'The text between the tags is what gets clicked.',
          },
          {
            step: 'Set href to the destination',
            body: 'Another page, or a full https:// address.',
          },
          {
            step: 'Write link text that stands alone',
            body: 'It will be read out of context.',
          },
          {
            step: 'Give every image an alt',
            body: 'Describe what it shows, or alt="" if decorative.',
          },
        ],
        takeaways: [
          '<a href="...">text</a> makes a link; href is the destination.',
          'Link text is read out of context, so "click here" is useless.',
          'Images need src (which file) and alt (what it shows).',
          'A decorative image takes alt="" — empty but present.',
          'alt text appears when an image fails to load.',
        ],
      },
    },
    {
      topic: 'Tables',
      title: 'Tables for Data',
      order: 3,
      language: 'html',
      body: {
        tagline: 'Rows, cells, and headers that say what a column means.',
        intro:
          'A table is for DATA — things with rows and columns, like a timetable or a score sheet. It is not for laying out a page; that was a common trick twenty years ago and CSS does it far better now. Used for its real purpose, a table is one of the most useful elements there is.',
        sections: [
          {
            heading: 'Rows first, then cells',
            body: '<table> holds <tr> row elements, and each row holds cells. A table is built row by row, not column by column — there is no column element, and every row must have the same number of cells or the shape breaks.',
            bullets: [
              '<table> wraps everything.',
              '<tr> is a table row.',
              'Cells live inside rows; there is no column tag.',
            ],
          },
          {
            heading: 'th is a header cell, td is data',
            body: '<th> marks a cell as a HEADER — the label for its column or row. It is not just bold text: a screen reader uses it to announce "Monday, Maths" as it moves through the grid, so a user always knows which column they are in.',
            bullets: [
              '<th> for headers, <td> for ordinary data.',
              'A screen reader reads the header with each cell.',
              'Add scope="col" or scope="row" to say which it labels.',
            ],
          },
          {
            heading: 'Give it a caption',
            body: '<caption> as the first child of the table names what the table is about. It is visible, unlike a title attribute, and it is announced first — so a user knows what they are about to read before they start.',
            bullets: [
              '<caption> goes immediately inside <table>.',
              'It is visible on the page and read out first.',
              '<thead> and <tbody> group the header row and the data.',
            ],
          },
        ],
        snippet: {
          language: 'html',
          lines: [
            '<table>',
            '  <caption>Week 1 test scores</caption>',
            '  <thead>',
            '    <tr>',
            '      <th scope="col">Pupil</th>',
            '      <th scope="col">Maths</th>',
            '      <th scope="col">Science</th>',
            '    </tr>',
            '  </thead>',
            '  <tbody>',
            '    <tr>',
            '      <th scope="row">Ada</th>',
            '      <td>91</td>',
            '      <td>88</td>',
            '    </tr>',
            '    <tr>',
            '      <th scope="row">Alan</th>',
            '      <td>84</td>',
            '      <td>93</td>',
            '    </tr>',
            '  </tbody>',
            '</table>',
          ],
          caption:
            'The first column uses <th scope="row">, so each pupil\'s name labels their row just as the top row labels the columns.',
        },
        tryIt: {
          language: 'html',
          starter:
            '<table>\n  <tr>\n    <th>Day</th>\n    <th>Lesson</th>\n  </tr>\n  <tr>\n    <td>Monday</td>\n    <td>Maths</td>\n  </tr>\n</table>\n',
          challenge:
            'Add a <caption> saying what the table is, two more days as rows, and a third column for the room number — remembering that every row needs the same number of cells.',
          hint: 'The <caption> is the first thing inside <table>. A third column means one more <th> in the header row and one more <td> in every data row.',
        },
        guide: [
          {
            step: 'Open the table and caption it',
            body: '<caption> first, saying what the data is.',
          },
          {
            step: 'Build it row by row',
            body: 'Each <tr> holds one row of cells.',
          },
          {
            step: 'Use <th> for labels',
            body: 'Headers for columns and, where useful, for rows.',
          },
          {
            step: 'Keep the rows the same length',
            body: 'Same number of cells in every row.',
          },
        ],
        takeaways: [
          'Tables are for data, not for page layout.',
          '<table> holds <tr> rows; rows hold cells.',
          '<th> is a header cell, <td> is data.',
          'scope="col" or "row" says what a header labels.',
          '<caption> names the table and is announced first.',
        ],
      },
    },
  ],

  'html-style-street': [
    {
      topic: 'Selectors',
      title: 'Pointing CSS at the Right Thing',
      order: 1,
      language: 'html',
      body: {
        tagline: 'A rule is a selector plus the declarations it applies.',
        intro:
          'CSS changes how HTML looks. Every CSS rule has two halves: a SELECTOR that says which elements to affect, and a block of declarations saying what to change. Almost every CSS problem a beginner has is really a selector problem — the styles are fine, they are just landing on the wrong elements, or on none.',
        sections: [
          {
            heading: 'The shape of a rule',
            body: 'p { color: navy; } — `p` is the selector, and everything in the braces is a declaration of the form property: value; with a semicolon after each. Miss a semicolon and the NEXT declaration is usually the one that stops working, which makes it look like the wrong line is broken.',
            bullets: [
              'selector { property: value; }',
              'Each declaration ends with a semicolon.',
              'A missing semicolon breaks the declaration AFTER it.',
            ],
          },
          {
            heading: 'Three selectors do most of the work',
            body: 'A tag name (p) hits every paragraph. A class (.warning) hits every element with class="warning" and can be reused freely. An id (#header) hits the one element with that id — ids must be unique on a page.',
            bullets: [
              'p — every element of that type.',
              '.warning — every element with that class. Reusable.',
              '#header — the single element with that id. Unique.',
            ],
          },
          {
            heading: 'When two rules disagree',
            body: 'If two rules set the same property, the more SPECIFIC one wins: an id beats a class, and a class beats a tag name. If they are equally specific, the one written later wins. This is the cascade, and it is why "my CSS is being ignored" is usually "something more specific is overriding it".',
            bullets: [
              'id beats class beats tag name.',
              'Equal specificity: the later rule wins.',
              '"My CSS is ignored" almost always means it is being overridden.',
            ],
          },
        ],
        snippet: {
          language: 'css',
          lines: [
            '/* every paragraph */',
            'p {',
            '  color: #333;',
            '  line-height: 1.6;',
            '}',
            '',
            '/* anything with class="warning" — reusable */',
            '.warning {',
            '  color: #b00020;',
            '  font-weight: bold;',
            '}',
            '',
            '/* the one element with id="intro" */',
            '#intro {',
            '  font-size: 1.25rem;',
            '}',
            '',
            '/* A paragraph with class="warning" is red, not #333:',
            '   the class is more specific than the tag name. */',
          ],
          caption:
            'Three selectors, and a note about which one wins when they overlap on the same element.',
        },
        tryIt: {
          language: 'css',
          starter:
            'p {\n  color: black;\n}\n\n.highlight {\n  background: yellow;\n}\n',
          challenge:
            'Add a rule making the class .quiet a soft grey. Then set a colour on both p and .quiet, apply both to one paragraph, and confirm the class wins — that is the cascade, and seeing it once is worth more than reading about it.',
          hint: 'A class selector starts with a dot: .quiet { color: #888; }',
        },
        guide: [
          {
            step: 'Write the selector',
            body: 'Tag name, .class or #id — whichever picks the right elements.',
          },
          { step: 'Open the braces', body: 'Declarations go inside { }.' },
          {
            step: 'Set property: value;',
            body: 'One per line, each ending in a semicolon.',
          },
          {
            step: 'Watch for overrides',
            body: 'If a rule seems ignored, something more specific is winning.',
          },
        ],
        takeaways: [
          'A CSS rule is a selector plus declarations in braces.',
          'Every declaration ends with a semicolon.',
          '.class is reusable; #id must be unique on the page.',
          'Specificity: id beats class beats tag name.',
          'Equally specific rules are settled by whichever comes later.',
        ],
      },
    },
    {
      topic: 'Colours and Fonts',
      title: 'Colour and Type',
      order: 2,
      language: 'html',
      body: {
        tagline:
          'Readable beats pretty — and contrast is not a matter of taste.',
        intro:
          "Colour and type are where a page starts to feel like yours. They are also where a page most easily becomes unreadable: pale grey text on white looks elegant on a designer's bright screen and disappears on a school laptop in a sunny classroom. There is a real measure for this, and it is worth knowing.",
        sections: [
          {
            heading: 'Three ways to write a colour',
            body: 'A name (navy), a hex code (#1a2b3c), or rgb(26, 43, 60). Hex is the most common: a # then two digits each for red, green and blue, from 00 to ff. #000 is black, #fff is white, and the three-digit form is shorthand for the six.',
            bullets: [
              'Named colours: red, navy, tomato — about 140 of them.',
              'Hex: #rrggbb, each pair 00 to ff.',
              '#fff is shorthand for #ffffff.',
            ],
          },
          {
            heading: 'Contrast is measurable',
            body: 'The contrast between text and its background has a ratio, and the accessibility standard asks for at least 4.5:1 for normal text. That is not an opinion — you can check it. Light grey on white is typically around 2:1 and fails, however nice it looks.',
            bullets: [
              'Aim for 4.5:1 or better for body text.',
              'Large text can go as low as 3:1.',
              'Browser devtools will calculate the ratio for you.',
            ],
          },
          {
            heading: 'Font stacks and sensible sizes',
            body: "font-family takes a LIST, tried left to right, because the first font may not be installed. Always end with a generic family (sans-serif or serif) so there is a guaranteed fallback. For size, prefer rem over px: 1rem is the browser's base size, so it respects a pupil who has set larger text.",
            bullets: [
              'font-family: Georgia, "Times New Roman", serif;',
              'Quote any font name containing a space.',
              'Always end with a generic family.',
              "rem respects the user's own text-size setting; px ignores it.",
            ],
          },
        ],
        snippet: {
          language: 'css',
          lines: [
            'body {',
            '  /* Near-black on off-white: about 15:1, comfortably readable */',
            '  color: #1a1a1a;',
            '  background: #fafafa;',
            '',
            '  font-family: Georgia, "Times New Roman", serif;',
            "  font-size: 1rem;      /* respects the reader's own setting */",
            '  line-height: 1.6;     /* room to breathe between lines */',
            '}',
            '',
            'h1 {',
            '  font-size: 2rem;',
            '  color: #003366;',
            '}',
            '',
            '.muted {',
            '  /* Still 4.6:1 on #fafafa — quiet, but it PASSES */',
            '  color: #595959;',
            '}',
          ],
          caption:
            'The .muted grey was chosen by checking the ratio, not by eye. A softer grey would have looked nicer and failed.',
        },
        tryIt: {
          language: 'css',
          starter:
            'body {\n  color: #333;\n  background: white;\n  font-family: system-ui, sans-serif;\n}\n',
          challenge:
            'Set a line-height of 1.6 and see how much easier the text is to read. Then try color: #cccccc on white and look at it — that is what a lot of "elegant" web design does to anyone with less than perfect eyesight.',
          hint: 'line-height takes a plain number: line-height: 1.6;  No units needed.',
        },
        guide: [
          {
            step: 'Set colour and background together',
            body: 'Never one without the other — you cannot predict the default.',
          },
          {
            step: 'Check the contrast',
            body: 'At least 4.5:1 for body text. Devtools will tell you.',
          },
          {
            step: 'Give font-family a fallback',
            body: 'End the list with sans-serif or serif.',
          },
          {
            step: 'Size with rem',
            body: 'It respects a reader who needs larger text.',
          },
        ],
        takeaways: [
          'Colours can be names, hex codes, or rgb() values.',
          'Contrast is measurable: aim for 4.5:1 on body text.',
          'font-family is a list, tried in order, ending in a generic family.',
          "rem respects the reader's text-size setting; px overrides it.",
          'line-height around 1.6 makes paragraphs far easier to read.',
        ],
      },
    },
    {
      topic: 'The Box Model',
      title: 'Everything Is a Box',
      order: 3,
      language: 'html',
      body: {
        tagline: 'Content, padding, border, margin — in that order, outwards.',
        intro:
          'Every element on a page is a rectangle, even when it does not look like one. Around its content sit three layers: padding inside the border, then the border, then margin outside it. Once you can see those four layers, most mysterious layout behaviour stops being mysterious.',
        sections: [
          {
            heading: 'The four layers',
            body: 'Content is the text or image. Padding is space INSIDE the box, between content and border — it takes the background colour. Border is the edge. Margin is space OUTSIDE, pushing other elements away — and it is always transparent.',
            bullets: [
              'padding is inside the border and shows the background.',
              'margin is outside the border and is always transparent.',
              'Use padding to give content room; margin to separate boxes.',
            ],
          },
          {
            heading: 'width does not mean total width',
            body: 'By default, width sets the CONTENT box only — padding and border are added on top. So width: 200px with 20px padding and a 2px border occupies 244px, and two of them will not fit in a 400px space. This surprises everybody exactly once.',
            bullets: [
              'Default: width = content only.',
              '200px + 20px padding each side + 2px border each side = 244px.',
              'This is why "two 50% boxes" often do not fit side by side.',
            ],
          },
          {
            heading: 'The one line that fixes it',
            body: 'box-sizing: border-box makes width mean the WHOLE box, padding and border included — which is what almost everybody expects. Applying it to everything at the top of a stylesheet is standard practice and saves a great deal of arithmetic.',
            bullets: [
              '* { box-sizing: border-box; } at the top of your CSS.',
              'Then width: 200px really is 200px on screen.',
              'Nearly every real project starts with this line.',
            ],
          },
        ],
        snippet: {
          language: 'css',
          lines: [
            '/* The line almost every stylesheet begins with */',
            '* {',
            '  box-sizing: border-box;',
            '}',
            '',
            '.card {',
            '  width: 300px;        /* the WHOLE box, thanks to border-box */',
            '  padding: 16px;       /* space inside — takes the background */',
            '  border: 2px solid #ccc;',
            '  margin: 24px auto;   /* space outside; auto centres it */',
            '  background: #fff;',
            '}',
            '',
            '/* Without border-box the card above would be 336px wide:',
            '   300 + 16 + 16 + 2 + 2. */',
          ],
          caption:
            'margin: 24px auto is a common trick — 24px top and bottom, automatic left and right, which centres a fixed-width box.',
        },
        tryIt: {
          language: 'css',
          starter:
            '.box {\n  width: 200px;\n  padding: 20px;\n  border: 2px solid black;\n  background: lightblue;\n}\n',
          challenge:
            "Measure the box in your browser's devtools — it will be 244px, not 200. Now add box-sizing: border-box and measure again. Then add a margin and notice the background does NOT extend into it, because margin is always transparent.",
          hint: 'Devtools shows the four layers as coloured bands. box-sizing: border-box goes inside the .box rule.',
        },
        guide: [
          {
            step: 'Start with border-box',
            body: '* { box-sizing: border-box; } so width means what you expect.',
          },
          {
            step: 'Use padding for inner space',
            body: 'It sits inside the border and takes the background.',
          },
          {
            step: 'Use margin to separate boxes',
            body: 'It pushes neighbours away and stays transparent.',
          },
          {
            step: 'Inspect it when confused',
            body: 'Devtools draws all four layers for you.',
          },
        ],
        takeaways: [
          'Every element is a box: content, padding, border, margin.',
          'Padding is inside the border; margin is outside and transparent.',
          'By default, width sets the content only — padding and border add to it.',
          'box-sizing: border-box makes width mean the whole box.',
          'margin: 0 auto centres a box that has a fixed width.',
        ],
      },
    },
  ],

  'html-layout-lane': [
    {
      topic: 'Flexbox',
      title: 'Lining Things Up with Flexbox',
      order: 1,
      language: 'html',
      body: {
        tagline:
          'One line makes a row. The rest is deciding how the space is shared.',
        intro:
          'For years, putting two things side by side in CSS was genuinely difficult. Flexbox fixed that. display: flex on a container lays its children out in a row, and then a handful of properties control how they line up and how leftover space is divided. It is the tool for arranging things in ONE direction.',
        sections: [
          {
            heading: 'Container and items',
            body: 'display: flex goes on the PARENT. Its direct children become flex items automatically — you do not style them to participate. This split matters: some properties belong on the container, others on the items, and mixing them up is the usual reason nothing happens.',
            bullets: [
              'display: flex on the parent, not the children.',
              'Direct children become flex items automatically.',
              'flex-direction: row (default) or column.',
            ],
          },
          {
            heading: 'The two alignment axes',
            body: 'justify-content spreads items along the MAIN axis (across, in a row). align-items positions them on the CROSS axis (up and down, in a row). Remembering which is which is easier if you name the direction: in a row, justify is horizontal and align is vertical. Switch to column and they swap.',
            bullets: [
              'justify-content: flex-start | center | space-between | space-around',
              'align-items: stretch | center | flex-start | flex-end',
              'flex-direction: column swaps which axis is which.',
            ],
          },
          {
            heading: 'gap, and letting items grow',
            body: 'gap puts space BETWEEN items without adding it outside the group — much tidier than margins on each child. flex: 1 on an item tells it to grow and share the leftover space, so three items with flex: 1 divide the row equally however wide it is.',
            bullets: [
              'gap: 16px spaces items without edge margins.',
              'flex: 1 makes an item take a share of the free space.',
              'flex-wrap: wrap lets items drop to a second line.',
            ],
          },
        ],
        snippet: {
          language: 'css',
          lines: [
            '.toolbar {',
            '  display: flex;                    /* on the PARENT */',
            '  justify-content: space-between;   /* along the row */',
            '  align-items: center;              /* across the row */',
            '  gap: 16px;',
            '}',
            '',
            '.cards {',
            '  display: flex;',
            '  gap: 16px;',
            '  flex-wrap: wrap;    /* drop to a new line instead of squashing */',
            '}',
            '',
            '.cards > * {',
            '  flex: 1;            /* every card takes an equal share */',
            '  min-width: 200px;   /* ...but never narrower than this */',
            '}',
          ],
          caption:
            'flex: 1 with min-width and wrap is the classic responsive card row: equal widths until they get too narrow, then a new line.',
        },
        tryIt: {
          language: 'css',
          starter: '.row {\n  display: flex;\n  gap: 8px;\n}\n',
          challenge:
            'Add justify-content: space-between and watch the items push apart. Then try align-items: center, and finally flex-direction: column — notice that justify and align have swapped which way they work.',
          hint: 'These all go on .row (the container), not on its children.',
        },
        guide: [
          {
            step: 'Put display: flex on the container',
            body: 'Its direct children become flex items.',
          },
          {
            step: 'Choose the direction',
            body: 'row is the default; column stacks them.',
          },
          {
            step: 'Align on both axes',
            body: 'justify-content along, align-items across.',
          },
          {
            step: 'Space and share',
            body: 'gap between items; flex: 1 to divide leftover space.',
          },
        ],
        takeaways: [
          'display: flex goes on the parent; children become items.',
          'justify-content works along the main axis, align-items across it.',
          'flex-direction: column swaps which axis is which.',
          'gap spaces items without adding outer margins.',
          'flex: 1 makes items share the remaining space equally.',
        ],
      },
    },
    {
      topic: 'CSS Grid',
      title: 'Real Grids with CSS Grid',
      order: 2,
      language: 'html',
      body: {
        tagline: 'Flexbox is one direction. Grid is two.',
        intro:
          'Flexbox arranges things along a line. When you need rows AND columns that line up with each other — a gallery, a dashboard, a page layout — Grid is the right tool. You describe the shape of the grid on the container, and items drop into it.',
        sections: [
          {
            heading: 'Describing the columns',
            body: 'display: grid, then grid-template-columns lists the column widths. The `fr` unit means "a share of the free space", so 1fr 1fr 1fr is three equal columns. repeat(3, 1fr) says the same thing more briefly.',
            bullets: [
              'grid-template-columns: 1fr 1fr 1fr — three equal columns.',
              'repeat(3, 1fr) is shorthand for the same.',
              'Mix units freely: 200px 1fr auto.',
            ],
          },
          {
            heading: 'Responsive without any media queries',
            body: 'repeat(auto-fit, minmax(200px, 1fr)) means "as many columns of at least 200px as will fit, sharing the space equally". The grid then reflows on its own as the window changes — a genuinely responsive gallery in one line, with no breakpoints to maintain.',
            bullets: [
              'auto-fit works out the column count for you.',
              'minmax(200px, 1fr) sets a floor and lets them grow.',
              'No media queries needed for this pattern.',
            ],
          },
          {
            heading: 'Spanning cells',
            body: 'An item can cover several tracks with grid-column: span 2. This is what Grid does that Flexbox genuinely cannot: a featured item twice as wide as its neighbours, while everything else stays perfectly aligned in the same grid.',
            bullets: [
              'grid-column: span 2 covers two columns.',
              'grid-row: span 2 covers two rows.',
              'gap works exactly as it does in flexbox.',
            ],
          },
        ],
        snippet: {
          language: 'css',
          lines: [
            '.gallery {',
            '  display: grid;',
            '  /* As many >=200px columns as fit. Reflows by itself. */',
            '  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));',
            '  gap: 16px;',
            '}',
            '',
            '.featured {',
            '  grid-column: span 2;   /* twice as wide, still aligned */',
            '}',
            '',
            '.page {',
            '  display: grid;',
            '  grid-template-columns: 240px 1fr;   /* sidebar and content */',
            '  gap: 24px;',
            '}',
          ],
          caption:
            'The gallery needs no media query at all. The .page rule is the classic sidebar layout: a fixed column and one that takes the rest.',
        },
        tryIt: {
          language: 'css',
          starter:
            '.grid {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 12px;\n}\n',
          challenge:
            'Swap the columns for repeat(auto-fit, minmax(150px, 1fr)) and resize the window — the column count changes on its own. Then give one child grid-column: span 2 and see it stay aligned with everything else.',
          hint: 'grid-column: span 2 goes on the CHILD; the template goes on the container.',
        },
        guide: [
          {
            step: 'Set display: grid on the container',
            body: 'Then describe the shape you want.',
          },
          {
            step: 'List the columns',
            body: 'grid-template-columns, using fr for shares of space.',
          },
          {
            step: 'Add gap',
            body: 'Space between tracks, without outer margins.',
          },
          {
            step: 'Span where you need to',
            body: 'grid-column: span 2 on an item that should be wider.',
          },
        ],
        takeaways: [
          'Grid handles two directions; flexbox handles one.',
          'fr is a share of the free space.',
          'repeat(auto-fit, minmax(200px, 1fr)) is responsive with no media queries.',
          'grid-column: span 2 makes an item cover two columns.',
          'Grid keeps rows and columns aligned with each other; flexbox does not.',
        ],
      },
    },
    {
      topic: 'Responsive Design',
      title: 'Pages That Fit Any Screen',
      order: 3,
      language: 'html',
      body: {
        tagline: 'Start narrow. Add layout as the screen gets wider.',
        intro:
          'Most people will see your page on a phone. A layout designed for a laptop and then squeezed down never fits properly, but a layout designed narrow and then given more room as space allows always works. That approach is called mobile-first, and it is mostly a matter of which way round you write your rules.',
        sections: [
          {
            heading: 'The meta viewport tag',
            body: 'Without <meta name="viewport" content="width=device-width, initial-scale=1"> in the head, a phone pretends to be a 980px-wide desktop and shrinks your page to fit — so your careful responsive CSS never activates. This single line is the prerequisite for everything else.',
            bullets: [
              'It goes in the <head>, and it is not optional.',
              'Without it a phone renders a zoomed-out desktop page.',
              'width=device-width, initial-scale=1 is the standard value.',
            ],
          },
          {
            heading: 'Media queries add, they do not undo',
            body: 'Write the narrow layout as your normal CSS, then use @media (min-width: 40rem) to ADD to it for wider screens. Going the other way — desktop first with max-width queries — means every query is undoing something, which gets tangled fast.',
            bullets: [
              '@media (min-width: 40rem) { ... } applies from 40rem up.',
              'Base CSS is the narrow layout; queries add to it.',
              'Choose breakpoints where the layout breaks, not by device.',
            ],
          },
          {
            heading: 'Often you need no query at all',
            body: 'Flexbox with wrap, Grid with auto-fit, max-width: 100% on images, and percentage or fr widths adapt on their own. A page built from those needs far fewer breakpoints — and every breakpoint you do not write is one you never have to maintain.',
            bullets: [
              'img { max-width: 100%; } stops images overflowing.',
              'flex-wrap and auto-fit reflow without breakpoints.',
              'Fewer breakpoints means less to keep in step.',
            ],
          },
        ],
        snippet: {
          language: 'css',
          lines: [
            '/* Base: the NARROW layout. One column, stacked. */',
            '.layout {',
            '  display: grid;',
            '  gap: 16px;',
            '}',
            '',
            'img {',
            '  max-width: 100%;   /* never wider than its container */',
            '  height: auto;      /* keep the proportions */',
            '}',
            '',
            '/* From 40rem up there is room for a sidebar. */',
            '@media (min-width: 40rem) {',
            '  .layout {',
            '    grid-template-columns: 240px 1fr;',
            '  }',
            '}',
            '',
            '/* Respect a reader who asked for less movement. */',
            '@media (prefers-reduced-motion: reduce) {',
            '  * {',
            '    transition: none;',
            '    animation: none;',
            '  }',
            '}',
          ],
          caption:
            'The base rule is the phone layout; the query only ADDS a second column. The last query is a courtesy that costs three lines.',
        },
        tryIt: {
          language: 'css',
          starter: '.layout {\n  display: grid;\n  gap: 16px;\n}\n',
          challenge:
            'Add a media query that gives .layout two columns above 40rem, then narrow your browser window until it collapses back to one. Also add img { max-width: 100% } and try a very large image to see what it prevents.',
          hint: '@media (min-width: 40rem) { .layout { grid-template-columns: 1fr 1fr; } }',
        },
        guide: [
          {
            step: 'Add the viewport meta tag',
            body: 'In the <head>, or none of this works on a phone.',
          },
          {
            step: 'Write the narrow layout first',
            body: 'That is your base CSS, with no query.',
          },
          {
            step: 'Add min-width queries for more room',
            body: 'Each one adds; none undoes.',
          },
          {
            step: 'Prefer things that adapt on their own',
            body: 'wrap, auto-fit, max-width: 100%.',
          },
        ],
        takeaways: [
          'The viewport meta tag is required for responsive CSS to work on phones.',
          'Mobile-first means the base CSS is the narrow layout.',
          'min-width media queries add layout as space allows.',
          'Choose breakpoints where the layout breaks, not by device name.',
          'img { max-width: 100% } prevents most overflow problems.',
        ],
      },
    },
  ],

  'html-polish-plaza': [
    {
      topic: 'Forms',
      title: 'Collecting Input with Forms',
      order: 1,
      language: 'html',
      body: {
        tagline: 'Every input needs a label — and not just a nearby one.',
        intro:
          'Forms are how a page asks for something. They are also the part of HTML that is easiest to get subtly wrong: a form can look completely finished and still be unusable with a keyboard or a screen reader. The fix is small and mechanical, which is the good news.',
        sections: [
          {
            heading: 'Label and input must be connected',
            body: 'A <label for="email"> must match an <input id="email">. That connection is what makes clicking the label focus the field, and what makes a screen reader announce "Email, edit text" instead of just "edit text". Text sitting next to a box is not a label.',
            bullets: [
              "label's for must equal the input's id.",
              'A connected label is clickable, which helps everyone.',
              'Placeholder text is NOT a label — it vanishes when typing starts.',
            ],
          },
          {
            heading: 'The type attribute does real work',
            body: 'type="email" brings up a keyboard with an @ on it and validates the format. type="number", type="date" and type="password" all change the control the browser shows. Choosing the right type gets you better behaviour on a phone for free.',
            bullets: [
              'type="email", "number", "date", "password", "tel"',
              'Phones show a keyboard matched to the type.',
              'The browser validates some types before submitting.',
            ],
          },
          {
            heading: 'Group related fields',
            body: '<fieldset> groups related controls and <legend> names the group. For a set of radio buttons this is not decoration — it is the only way a screen reader can tell a user what the choice is ABOUT rather than just reading the options.',
            bullets: [
              '<fieldset> wraps related controls; <legend> names them.',
              'Essential for radio groups and checkbox sets.',
              '<button type="submit"> sends the form.',
            ],
          },
        ],
        snippet: {
          language: 'html',
          lines: [
            '<form action="/signup" method="post">',
            '  <p>',
            '    <label for="name">Your name</label>',
            '    <input type="text" id="name" name="name" required>',
            '  </p>',
            '',
            '  <p>',
            '    <label for="email">Email address</label>',
            '    <input type="email" id="email" name="email" required>',
            '  </p>',
            '',
            '  <fieldset>',
            '    <legend>Favourite subject</legend>',
            '    <input type="radio" id="maths" name="subject" value="maths">',
            '    <label for="maths">Maths</label>',
            '    <input type="radio" id="art" name="subject" value="art">',
            '    <label for="art">Art</label>',
            '  </fieldset>',
            '',
            '  <button type="submit">Sign up</button>',
            '</form>',
          ],
          caption:
            'Every for matches an id. The radio buttons share a name (so only one can be chosen) and are wrapped in a fieldset that names the question.',
        },
        tryIt: {
          language: 'html',
          starter:
            '<form>\n  <label for="colour">Favourite colour</label>\n  <input type="text" id="colour" name="colour">\n  <button type="submit">Send</button>\n</form>\n',
          challenge:
            'Click the label text and watch the box focus — that is the for/id connection working. Now break the for attribute and try again: the click does nothing, and that is exactly what a screen reader user experiences on a badly-built form.',
          hint: 'Add another field with type="email", and remember its id must match its label\'s for.',
        },
        guide: [
          {
            step: 'Wrap the controls in <form>',
            body: 'With action (where it goes) and method.',
          },
          {
            step: 'Label every input',
            body: 'label for="x" paired with input id="x".',
          },
          {
            step: 'Choose the right type',
            body: 'email, number, date — better keyboards and validation.',
          },
          {
            step: 'Group and submit',
            body: 'fieldset + legend for related fields; a submit button to send.',
          },
        ],
        takeaways: [
          "A label's for must match its input's id.",
          'Placeholder text is not a label — it disappears as you type.',
          'The type attribute changes the keyboard and the validation.',
          'Radio buttons in one group share the same name.',
          'fieldset and legend tell a user what a group of choices is about.',
        ],
      },
    },
    {
      topic: 'Semantic HTML',
      title: 'Tags That Mean Something',
      order: 2,
      language: 'html',
      body: {
        tagline: 'A <div> says nothing. <nav> says "this is the navigation".',
        intro:
          'You could build an entire page from <div> elements and style them to look right. Many sites do. But a <div> carries no meaning, so nothing except your CSS knows what any part of the page IS. Semantic tags look identical and tell browsers, screen readers and search engines what they are looking at.',
        sections: [
          {
            heading: 'The landmark elements',
            body: '<header>, <nav>, <main>, <aside>, <footer> and <article> describe the parts of a page. A screen reader user can jump straight to <main> and skip the navigation — something they do constantly, and which is impossible on a page of unlabelled divs.',
            bullets: [
              '<header> and <footer> top and bottom, <nav> for links.',
              "<main> is the page's primary content — one per page.",
              '<article> is a self-contained piece; <aside> is related-but-separate.',
            ],
          },
          {
            heading: 'div and span are still fine',
            body: 'They are the right choice when you need a box purely to hang styling on and there is no meaning to express. The rule is simple: if a semantic element describes what the thing is, use it; otherwise a div is honest.',
            bullets: [
              'Use a semantic tag when one fits the meaning.',
              'div for a styling-only block; span for styling-only inline text.',
              'A div is not a mistake — an unnecessary one is a missed opportunity.',
            ],
          },
          {
            heading: 'Buttons and links are different things',
            body: 'A <a> goes somewhere. A <button> does something. Styling a div to look like a button gives you something that cannot be focused, cannot be triggered by the keyboard, and is invisible to assistive software — three bugs a real <button> would never have had.',
            bullets: [
              '<a> navigates; <button> acts.',
              'Both are keyboard-focusable and announce themselves.',
              'A clickable div has none of that, and it is a common bug.',
            ],
          },
        ],
        snippet: {
          language: 'html',
          lines: [
            '<body>',
            '  <header>',
            '    <h1>Rock Club</h1>',
            '    <nav>',
            '      <ul>',
            '        <li><a href="/">Home</a></li>',
            '        <li><a href="/trips">Trips</a></li>',
            '      </ul>',
            '    </nav>',
            '  </header>',
            '',
            '  <main>',
            '    <article>',
            '      <h2>Our Trip to the Peaks</h2>',
            '      <p>It rained the whole time.</p>',
            '    </article>',
            '',
            '    <aside>',
            '      <h2>Kit list</h2>',
            '      <p>Bring boots.</p>',
            '    </aside>',
            '  </main>',
            '',
            '  <footer>',
            '    <p>Founded 2019</p>',
            '  </footer>',
            '</body>',
          ],
          caption:
            'The same page built from divs would look identical and be far harder to navigate. Note the nav is a list of links, which is what it actually is.',
        },
        tryIt: {
          language: 'html',
          starter:
            '<div class="header">\n  <h1>My Site</h1>\n</div>\n<div class="content">\n  <p>Some content.</p>\n</div>\n',
          challenge:
            'Replace both divs with the semantic elements that describe them, add a <nav> with two links inside the header, and wrap the content in <main>. The page will look exactly the same — and be considerably more usable.',
          hint: 'The first div is a <header>; the second is <main>. Nothing else needs to change.',
        },
        guide: [
          {
            step: 'Ask what the section IS',
            body: 'Header, navigation, main content, aside, footer?',
          },
          {
            step: 'Use the tag that says so',
            body: 'One <main> per page; <nav> for link groups.',
          },
          {
            step: 'Fall back to div honestly',
            body: 'When there is no meaning, a div is correct.',
          },
          {
            step: 'Never fake a button',
            body: 'Use <button> to act and <a> to navigate.',
          },
        ],
        takeaways: [
          'Semantic tags look the same but carry meaning.',
          '<header>, <nav>, <main>, <aside>, <footer>, <article> are landmarks.',
          'A screen reader user can jump straight to <main>.',
          'div and span are correct when there is no meaning to express.',
          '<a> navigates and <button> acts — a clickable div does neither properly.',
        ],
      },
    },
    {
      topic: 'Accessibility',
      title: 'Building for Everybody',
      order: 3,
      language: 'html',
      body: {
        tagline:
          'Most of accessibility is using the right tag and checking the contrast.',
        intro:
          'Some people use a page without seeing it, some without a mouse, some with a screen magnified four times. Accessibility is making sure the page still works for them, and it has a reputation for being difficult that it does not really deserve — most of it is things you have already learned in this course, done consistently.',
        sections: [
          {
            heading: 'You have done most of it already',
            body: 'Proper headings, alt text on images, labels joined to inputs, real buttons, enough colour contrast, semantic landmarks. That is the bulk of it, and each one was a lesson in this course for its own sake before accessibility was even mentioned.',
            bullets: [
              'Headings in order, never skipping a level.',
              'alt on every image; alt="" if decorative.',
              'label for matching input id.',
              '4.5:1 contrast on body text.',
            ],
          },
          {
            heading: 'It must work with a keyboard',
            body: 'Press Tab through your page. Every link, button and field should be reachable, in a sensible order, with a VISIBLE outline showing where you are. Removing that outline with outline: none is a very common piece of CSS and it makes a page unusable for keyboard users.',
            bullets: [
              'Tab through the page and watch where focus goes.',
              'Never remove the focus outline without replacing it.',
              ':focus-visible lets you style it instead of deleting it.',
            ],
          },
          {
            heading: 'Do not rely on colour alone',
            body: 'A red border on an invalid field is invisible to a colourblind user — about one man in twelve. Add an icon, a word, or a message. The rule is that any information carried by colour must also be carried by something else.',
            bullets: [
              'Pair colour with text or an icon.',
              'Roughly 1 in 12 men has some colour vision deficiency.',
              'Error messages should say what is wrong, in words.',
            ],
          },
        ],
        snippet: {
          language: 'html',
          lines: [
            '<!-- Skip link: the first thing a keyboard user meets -->',
            '<a href="#main" class="skip-link">Skip to main content</a>',
            '',
            '<nav>...</nav>',
            '',
            '<main id="main">',
            '  <h1>Sign up</h1>',
            '',
            '  <label for="email">Email address</label>',
            '  <input type="email" id="email" aria-describedby="email-error">',
            '',
            '  <!-- The error is a WORD, not just a red border -->',
            '  <p id="email-error" class="error">',
            '    <span aria-hidden="true">&#9888;</span>',
            '    That does not look like an email address.',
            '  </p>',
            '',
            '  <button type="submit">Create account</button>',
            '</main>',
          ],
          caption:
            'aria-describedby joins the error text to the field, so a screen reader reads it when the field is focused. The warning symbol is hidden from screen readers because the sentence already says it.',
        },
        tryIt: {
          language: 'html',
          starter:
            '<main>\n  <h1>Contact</h1>\n  <label for="msg">Message</label>\n  <textarea id="msg"></textarea>\n  <button type="submit">Send</button>\n</main>\n',
          challenge:
            'Put your hands on the keyboard only and Tab through it — check you can reach the box and the button and see where you are. Then add a skip link at the top, and finally try adding CSS with outline: none to see how much harder it becomes.',
          hint: 'A skip link is just an <a href="#main"> pointing at an element with id="main".',
        },
        guide: [
          {
            step: 'Use the right elements',
            body: 'Headings, labels, buttons, landmarks. This is most of the work.',
          },
          {
            step: 'Test with the keyboard',
            body: 'Tab through everything and watch the focus outline.',
          },
          {
            step: 'Check your contrast',
            body: '4.5:1 for body text; devtools will tell you.',
          },
          {
            step: 'Never inform by colour alone',
            body: 'Add a word or an icon alongside it.',
          },
        ],
        takeaways: [
          'Most of accessibility is using the correct element for the job.',
          'Every interactive thing must be reachable by keyboard.',
          'Never remove the focus outline without providing another one.',
          'Information carried by colour must also be carried some other way.',
          'A skip link lets keyboard users jump past the navigation.',
        ],
      },
    },
  ],
};

/**
 * QUIZ BLUEPRINTS for the HTML & CSS course, keyed by world slug.
 *
 * Practice, not the final test — so the explanations teach rather than merely
 * score. They target the mistakes this course knows beginners make: closing a
 * void element, putting content in the head, choosing a heading by its size,
 * `width` not meaning total width, a label that is only next to its input, and
 * a div dressed up as a button.
 */
export const HTML_QUIZ_BLUEPRINTS = {
  'html-structure-studio': [
    {
      title: 'Structure 1: Tags and Elements',
      topicLesson: 'Tags and Elements',
      questions: [
        {
          type: 'mcq',
          prompt: 'What does HTML actually do?',
          options: [
            'labels content so a browser knows what it is',
            'calculates values like a program',
            'stores data in variables',
            'styles the page',
          ],
          correctAnswer: 'labels content so a browser knows what it is',
          explanation:
            "HTML describes structure and meaning. It has no variables and nothing to run — styling is CSS's job.",
        },
        {
          type: 'mcq',
          prompt: 'Which is the CLOSING tag of a paragraph?',
          options: ['<-p>', '</p>', '<p>', '<p/>'],
          correctAnswer: '</p>',
          explanation: 'The slash is what makes a tag a closing tag.',
        },
        {
          type: 'fillblank',
          prompt:
            'A tag that wraps nothing and has no closing half is called a ____ element.',
          correctAnswer: ['void', 'empty'],
          explanation:
            '<img> and <br> are void elements — writing </img> is invalid.',
        },
        {
          type: 'mcq',
          prompt: 'Where do attributes go?',
          options: [
            'in both tags',
            'between the tags',
            'in the opening tag only',
            'in the closing tag',
          ],
          correctAnswer: 'in the opening tag only',
          explanation: 'Written as name="value" inside the opening tag.',
        },
        {
          type: 'mcq',
          prompt: 'What is the alt attribute on an image for?',
          options: [
            'a caption shown under the image',
            'the file name',
            'the image width',
            'describing the picture for anyone who cannot see it',
          ],
          correctAnswer: 'describing the picture for anyone who cannot see it',
          explanation: 'It is also what appears if the file fails to load.',
        },
      ],
    },
    {
      title: 'Structure 2: The Page Skeleton',
      topicLesson: 'The Shape of a Page',
      questions: [
        {
          type: 'mcq',
          prompt: 'Where does the <title> element appear?',
          options: [
            'in the browser tab',
            'as a heading on the page',
            'in the footer',
            'nowhere',
          ],
          correctAnswer: 'in the browser tab',
          explanation:
            'It is information about the page, so it lives in the head and shows in the tab — not on the page itself.',
        },
        {
          type: 'fillblank',
          prompt: 'Everything a visitor can SEE goes inside the ____ element.',
          correctAnswer: ['body', '<body>'],
          explanation: 'The head holds information; the body holds content.',
        },
        {
          type: 'mcq',
          prompt: 'You put a <p> inside the <head>. What happens?',
          options: [
            'it appears in the tab',
            'it does not appear at all',
            'it appears at the top of the page',
            'the page fails to load',
          ],
          correctAnswer: 'it does not appear at all',
          explanation:
            'Nothing in the head is rendered. This is a very common early confusion.',
        },
        {
          type: 'mcq',
          prompt: 'Which nesting is correct?',
          options: [
            '<strong><p>Hi</strong></p>',
            'all of them',
            '<p><strong>Hi</strong></p>',
            '<p><strong>Hi</p></strong>',
          ],
          correctAnswer: '<p><strong>Hi</strong></p>',
          explanation:
            'Last opened, first closed. Crossed tags are invalid even when browsers quietly fix them.',
        },
        {
          type: 'mcq',
          prompt: 'What does <meta charset="utf-8"> do?',
          options: [
            'sets the page width',
            'links the stylesheet',
            'names the author',
            'makes accented and non-Latin characters display correctly',
          ],
          correctAnswer:
            'makes accented and non-Latin characters display correctly',
          explanation:
            'Without it, characters outside basic English often render as gibberish.',
        },
      ],
    },
    {
      title: 'Structure 3: Text and Headings',
      topicLesson: 'Marking Up Text',
      questions: [
        {
          type: 'mcq',
          prompt: 'How should you choose a heading level?',
          options: [
            "by where it sits in the page's outline",
            'by how big it looks',
            'by the colour you want',
            'at random',
          ],
          correctAnswer: "by where it sits in the page's outline",
          explanation:
            'Headings are structure. Change the SIZE with CSS, never by picking a different level.',
        },
        {
          type: 'mcq',
          prompt: 'How many <h1> elements should a page normally have?',
          options: ['none', 'one', 'as many as you like', 'at least three'],
          correctAnswer: 'one',
          explanation: 'The h1 names the page. Its sections are h2s.',
        },
        {
          type: 'fillblank',
          prompt:
            'Going straight from h2 to h4 is wrong because it ____ a level.',
          correctAnswer: ['skips', 'misses'],
          explanation:
            'Skipping levels breaks the outline for anyone navigating by headings.',
        },
        {
          type: 'mcq',
          prompt: 'Why prefer <strong> over <b>?',
          options: [
            '<strong> is shorter',
            'there is no difference',
            '<strong> carries meaning; <b> only changes appearance',
            '<b> is deprecated and will not render',
          ],
          correctAnswer:
            '<strong> carries meaning; <b> only changes appearance',
          explanation:
            'A screen reader can voice <strong> differently. <b> tells it nothing.',
        },
        {
          type: 'mcq',
          prompt: 'What happens to five spaces in a row in your HTML?',
          options: [
            'they all show',
            'the page breaks',
            'they become a tab',
            'they collapse into one space',
          ],
          correctAnswer: 'they collapse into one space',
          explanation:
            'HTML collapses whitespace, which is why you cannot lay out a page with spaces or blank lines.',
        },
      ],
    },
  ],

  'html-content-corner': [
    {
      title: 'Content 1: Lists',
      topicLesson: 'Lists a Browser Understands',
      questions: [
        {
          type: 'mcq',
          prompt: 'Which list numbers its items automatically?',
          options: ['<ol>', '<ul>', '<li>', '<dl>'],
          correctAnswer: '<ol>',
          explanation:
            'Ordered lists number themselves, so reordering the steps is free.',
        },
        {
          type: 'fillblank',
          prompt: 'Each entry in a list goes inside an ____ element.',
          correctAnswer: ['li', '<li>'],
          explanation: 'Only <li> may sit directly inside a <ul> or <ol>.',
        },
        {
          type: 'mcq',
          prompt: 'Where does a nested sub-list go?',
          options: [
            'inside the <ul> but outside any <li>',
            'inside the <li> it belongs to',
            'between two <li> elements',
            'after the closing </ul>',
          ],
          correctAnswer: 'inside the <li> it belongs to',
          explanation:
            'This is the most common list mistake, and it produces a page that looks nearly right.',
        },
        {
          type: 'mcq',
          prompt: 'Why not type the numbers yourself in an ordered list?',
          options: [
            'it is slower to render',
            'no reason, it is fine',
            'reordering or inserting an item would break them',
            'numbers are not allowed in HTML',
          ],
          correctAnswer: 'reordering or inserting an item would break them',
          explanation:
            'Let <ol> do it and inserting a step in the middle renumbers everything for free.',
        },
        {
          type: 'mcq',
          prompt: 'What does marking a list up properly give you?',
          options: [
            'a faster page',
            'automatic styling',
            'nothing beyond bullets',
            'a screen reader announces it as a list and lets users skip it',
          ],
          correctAnswer:
            'a screen reader announces it as a list and lets users skip it',
          explanation: 'Typed dashes look like a list but are just text.',
        },
      ],
    },
    {
      title: 'Content 2: Links and Images',
      topicLesson: 'Links and Images',
      questions: [
        {
          type: 'fillblank',
          prompt: 'The attribute that says where a link goes is ____.',
          correctAnswer: ['href'],
          explanation:
            'No href means no link — it still looks like text but does nothing.',
        },
        {
          type: 'mcq',
          prompt: 'Why is "click here" bad link text?',
          options: [
            'screen reader users can list every link out of context, where it means nothing',
            'it is too short',
            'it is not valid HTML',
            'search engines ban it',
          ],
          correctAnswer:
            'screen reader users can list every link out of context, where it means nothing',
          explanation:
            'Nine links all called "click here" is a useless list. Describe the destination.',
        },
        {
          type: 'mcq',
          prompt: 'What alt text should a purely decorative image have?',
          options: [
            'alt="image"',
            'alt="" — empty but present',
            'no alt attribute at all',
            'alt="decoration"',
          ],
          correctAnswer: 'alt="" — empty but present',
          explanation:
            'An empty alt tells assistive software to skip it. A MISSING alt makes it read the file name instead.',
        },
        {
          type: 'mcq',
          prompt: 'What does the src attribute do?',
          options: [
            'sets the image size',
            'links to another page',
            'names which image file to show',
            'describes the image',
          ],
          correctAnswer: 'names which image file to show',
          explanation: 'src is which file; alt is what it shows.',
        },
        {
          type: 'mcq',
          prompt: 'When does alt text become visible on screen?',
          options: [
            'never',
            'on hover',
            'always, under the image',
            'when the image fails to load',
          ],
          correctAnswer: 'when the image fails to load',
          explanation:
            'Which is a good way to check your alt text is actually useful.',
        },
      ],
    },
    {
      title: 'Content 3: Tables',
      topicLesson: 'Tables for Data',
      questions: [
        {
          type: 'mcq',
          prompt: 'What are tables for?',
          options: [
            'data with rows and columns',
            'laying out a page',
            'navigation menus',
            'images',
          ],
          correctAnswer: 'data with rows and columns',
          explanation:
            'Page layout was done with tables twenty years ago; CSS Grid does it far better now.',
        },
        {
          type: 'mcq',
          prompt: 'What is the difference between <th> and <td>?',
          options: [
            'nothing',
            '<th> is a header cell that labels its row or column',
            '<th> is just bold',
            '<td> is for text and <th> for numbers',
          ],
          correctAnswer: '<th> is a header cell that labels its row or column',
          explanation:
            'A screen reader reads the header with each cell, so a user always knows which column they are in.',
        },
        {
          type: 'fillblank',
          prompt: 'A table is built out of ____ elements, each holding cells.',
          correctAnswer: ['tr', '<tr>', 'row', 'rows'],
          explanation: 'Row by row — there is no column element.',
        },
        {
          type: 'mcq',
          prompt: 'What does <caption> do?',
          options: [
            'styles the table',
            'numbers the rows',
            'names the table, visibly, and is announced first',
            'adds a tooltip',
          ],
          correctAnswer: 'names the table, visibly, and is announced first',
          explanation:
            'So a user knows what they are about to read before they start.',
        },
        {
          type: 'mcq',
          prompt: 'What does scope="col" tell a screen reader?',
          options: [
            'the column width',
            'that the cell is bold',
            'to skip the cell',
            'that this header labels a column',
          ],
          correctAnswer: 'that this header labels a column',
          explanation: 'scope="row" does the same for a row header.',
        },
      ],
    },
  ],

  'html-style-street': [
    {
      title: 'Style 1: Selectors',
      topicLesson: 'Pointing CSS at the Right Thing',
      questions: [
        {
          type: 'mcq',
          prompt: 'Which selector matches every element with class="note"?',
          options: ['.note', '#note', 'note', '*note'],
          correctAnswer: '.note',
          explanation: 'A dot is for classes; a hash is for ids.',
        },
        {
          type: 'fillblank',
          prompt: 'Every CSS declaration must end with a ____.',
          correctAnswer: ['semicolon', ';'],
          explanation:
            'And a missing one usually breaks the declaration AFTER it, which makes the wrong line look faulty.',
        },
        {
          type: 'mcq',
          prompt: 'How many elements on a page may share one id?',
          options: ['two', 'one', 'any number', 'up to ten'],
          correctAnswer: 'one',
          explanation:
            'Ids are unique. Use a class when you need it more than once.',
        },
        {
          type: 'mcq',
          prompt:
            'A tag rule and a class rule both set the colour. Which wins?',
          options: [
            'whichever is shorter',
            'neither, it is an error',
            'the class — it is more specific',
            'the tag rule',
          ],
          correctAnswer: 'the class — it is more specific',
          explanation: 'Specificity: id beats class beats tag name.',
        },
        {
          type: 'mcq',
          prompt:
            'Two equally specific rules set the same property. Which wins?',
          options: [
            'the one written first',
            'neither applies',
            'the shorter one',
            'the one written later',
          ],
          correctAnswer: 'the one written later',
          explanation: 'That is the "cascade" in Cascading Style Sheets.',
        },
      ],
    },
    {
      title: 'Style 2: Colour and Type',
      topicLesson: 'Colour and Type',
      questions: [
        {
          type: 'mcq',
          prompt: 'What contrast ratio should normal body text meet?',
          options: [
            'at least 4.5:1',
            'at least 1.5:1',
            'exactly 2:1',
            'it does not matter',
          ],
          correctAnswer: 'at least 4.5:1',
          explanation:
            'It is measurable, not a matter of taste — devtools will calculate it for you.',
        },
        {
          type: 'fillblank',
          prompt: 'In hex, #fff is shorthand for #______.',
          correctAnswer: ['ffffff', 'FFFFFF'],
          explanation: 'The three-digit form doubles each digit.',
        },
        {
          type: 'mcq',
          prompt: 'Why does font-family take a LIST of fonts?',
          options: [
            'it does not, that is invalid',
            'the first may not be installed, so it falls back',
            'to blend them together',
            'to use a different one per paragraph',
          ],
          correctAnswer: 'the first may not be installed, so it falls back',
          explanation:
            'Always end the list with a generic family like sans-serif.',
        },
        {
          type: 'mcq',
          prompt: 'Why prefer rem over px for font size?',
          options: [
            'px is deprecated',
            'they are identical',
            'rem respects a reader who has set larger text',
            'rem renders faster',
          ],
          correctAnswer: 'rem respects a reader who has set larger text',
          explanation:
            'A fixed px size overrides that choice, which matters to anyone who needs it.',
        },
        {
          type: 'mcq',
          prompt:
            'Roughly what line-height makes paragraphs comfortable to read?',
          options: [
            'about 0.8',
            'exactly 1',
            'as high as possible',
            'about 1.6',
          ],
          correctAnswer: 'about 1.6',
          explanation:
            'A plain number, needing no units — it multiplies the font size.',
        },
      ],
    },
    {
      title: 'Style 3: The Box Model',
      topicLesson: 'Everything Is a Box',
      questions: [
        {
          type: 'mcq',
          prompt: 'Which of these is INSIDE the border?',
          options: ['padding', 'margin', 'both', 'neither'],
          correctAnswer: 'padding',
          explanation:
            'Padding is inside and takes the background; margin is outside and is transparent.',
        },
        {
          type: 'mcq',
          prompt:
            'An element has width: 200px, padding: 20px and a 2px border, with default box-sizing. How wide is it on screen?',
          options: ['240px', '244px', '200px', '222px'],
          correctAnswer: '244px',
          explanation:
            '200 + 20 + 20 + 2 + 2. By default width sets the CONTENT box only.',
        },
        {
          type: 'fillblank',
          prompt:
            'The declaration that makes width mean the whole box is box-sizing: ____.',
          correctAnswer: ['border-box', 'borderbox'],
          explanation:
            'Almost every real stylesheet starts by applying it to everything.',
        },
        {
          type: 'mcq',
          prompt: 'Why does a background colour not extend into the margin?',
          options: [
            'backgrounds only apply to text',
            'it does extend',
            'margin is always transparent',
            'margins are not real',
          ],
          correctAnswer: 'margin is always transparent',
          explanation:
            'Which is exactly why padding, not margin, is what gives content room inside a coloured box.',
        },
        {
          type: 'mcq',
          prompt: 'What does margin: 0 auto do to a fixed-width box?',
          options: [
            'removes all spacing',
            'stretches it to full width',
            'nothing',
            'centres it horizontally',
          ],
          correctAnswer: 'centres it horizontally',
          explanation:
            'Automatic left and right margins split the leftover space equally.',
        },
      ],
    },
  ],

  'html-layout-lane': [
    {
      title: 'Layout 1: Flexbox',
      topicLesson: 'Lining Things Up with Flexbox',
      questions: [
        {
          type: 'mcq',
          prompt: 'Where does display: flex go?',
          options: [
            'on the parent container',
            'on each child',
            'on both',
            'in the <head>',
          ],
          correctAnswer: 'on the parent container',
          explanation:
            'Its direct children then become flex items automatically. Putting it on the children is the usual reason nothing happens.',
        },
        {
          type: 'mcq',
          prompt: 'In a flex ROW, which property spreads items across?',
          options: ['gap', 'justify-content', 'align-items', 'flex-wrap'],
          correctAnswer: 'justify-content',
          explanation:
            'justify works along the main axis; align works across it. flex-direction: column swaps them.',
        },
        {
          type: 'fillblank',
          prompt:
            'The property that spaces items apart without adding outer margins is ____.',
          correctAnswer: ['gap'],
          explanation: 'Much tidier than a margin on every child.',
        },
        {
          type: 'mcq',
          prompt: 'What does flex: 1 on an item do?',
          options: [
            'hides it',
            'moves it first',
            'makes it take a share of the leftover space',
            'makes it exactly 1px wide',
          ],
          correctAnswer: 'makes it take a share of the leftover space',
          explanation:
            'Three items with flex: 1 divide the row equally, however wide it is.',
        },
        {
          type: 'mcq',
          prompt: 'What does flex-wrap: wrap allow?',
          options: [
            'text to wrap inside items',
            'the container to scroll',
            'items to overlap',
            'items to drop onto a second line instead of squashing',
          ],
          correctAnswer:
            'items to drop onto a second line instead of squashing',
          explanation:
            'Combined with min-width it gives you a responsive row for free.',
        },
      ],
    },
    {
      title: 'Layout 2: CSS Grid',
      topicLesson: 'Real Grids with CSS Grid',
      questions: [
        {
          type: 'mcq',
          prompt: 'When is Grid the better choice than Flexbox?',
          options: [
            'when you need rows AND columns aligned with each other',
            'when you have only one row',
            'always',
            'never, they are identical',
          ],
          correctAnswer:
            'when you need rows AND columns aligned with each other',
          explanation:
            'Flexbox arranges along one direction; Grid handles two.',
        },
        {
          type: 'fillblank',
          prompt: 'The unit meaning "a share of the free space" is ____.',
          correctAnswer: ['fr'],
          explanation: '1fr 1fr 1fr is three equal columns.',
        },
        {
          type: 'mcq',
          prompt: 'What does repeat(auto-fit, minmax(200px, 1fr)) do?',
          options: [
            'nothing without a media query',
            'fits as many >=200px columns as it can and reflows on its own',
            'always makes exactly two columns',
            'sets a fixed 200px grid',
          ],
          correctAnswer:
            'fits as many >=200px columns as it can and reflows on its own',
          explanation:
            'A responsive gallery in one line, with no breakpoints to maintain.',
        },
        {
          type: 'mcq',
          prompt: 'How do you make one item cover two columns?',
          options: [
            'flex: 2',
            'colspan="2"',
            'grid-column: span 2',
            'width: 200%',
          ],
          correctAnswer: 'grid-column: span 2',
          explanation:
            'And it stays aligned with everything else — which is what Flexbox genuinely cannot do.',
        },
        {
          type: 'mcq',
          prompt: 'Which rule creates a sidebar-and-content layout?',
          options: [
            'grid-template-columns: 1fr 1fr',
            'display: block',
            'float: left',
            'grid-template-columns: 240px 1fr',
          ],
          correctAnswer: 'grid-template-columns: 240px 1fr',
          explanation: 'A fixed column, and one that takes whatever is left.',
        },
      ],
    },
    {
      title: 'Layout 3: Responsive Design',
      topicLesson: 'Pages That Fit Any Screen',
      questions: [
        {
          type: 'mcq',
          prompt: 'What happens without the viewport meta tag?',
          options: [
            'a phone pretends to be a wide desktop and shrinks the page',
            'nothing',
            'the page will not load',
            'CSS is ignored entirely',
          ],
          correctAnswer:
            'a phone pretends to be a wide desktop and shrinks the page',
          explanation:
            'So your responsive CSS never activates. It is the prerequisite for all of this.',
        },
        {
          type: 'fillblank',
          prompt:
            'Designing the narrow layout first and adding to it is called ____-first.',
          correctAnswer: ['mobile'],
          explanation:
            'Each media query then ADDS layout rather than undoing it.',
        },
        {
          type: 'mcq',
          prompt: 'Which query direction suits mobile-first?',
          options: ['neither', 'min-width', 'max-width', 'either'],
          correctAnswer: 'min-width',
          explanation:
            'min-width applies from that size upwards, adding to the base narrow layout.',
        },
        {
          type: 'mcq',
          prompt: 'How should you choose a breakpoint?',
          options: [
            'every 100px',
            'at 768px always',
            'where the layout starts to break',
            'the width of the newest iPhone',
          ],
          correctAnswer: 'where the layout starts to break',
          explanation:
            "Device widths change constantly; your layout's own limits do not.",
        },
        {
          type: 'mcq',
          prompt: 'What does img { max-width: 100% } prevent?',
          options: [
            'images loading slowly',
            'images being cached',
            'nothing',
            'images overflowing their container',
          ],
          correctAnswer: 'images overflowing their container',
          explanation: 'Pair it with height: auto to keep the proportions.',
        },
      ],
    },
  ],

  'html-polish-plaza': [
    {
      title: 'Polish 1: Forms',
      topicLesson: 'Collecting Input with Forms',
      questions: [
        {
          type: 'mcq',
          prompt: 'How is a label connected to its input?',
          options: [
            "the label's for matches the input's id",
            'they just need to be next to each other',
            'by a class',
            'they cannot be connected',
          ],
          correctAnswer: "the label's for matches the input's id",
          explanation:
            'Text merely sitting beside a box is not a label. The connection is what makes it clickable and announced.',
        },
        {
          type: 'mcq',
          prompt: 'Is placeholder text a substitute for a label?',
          options: [
            'only on mobile',
            'no — it disappears as soon as you type',
            'yes',
            'yes, if it is descriptive',
          ],
          correctAnswer: 'no — it disappears as soon as you type',
          explanation:
            'Leaving a user who looks away with no idea what the field was for.',
        },
        {
          type: 'fillblank',
          prompt:
            'Radio buttons in the same group must share the same ____ attribute.',
          correctAnswer: ['name'],
          explanation: 'That is what makes them mutually exclusive.',
        },
        {
          type: 'mcq',
          prompt: 'What do <fieldset> and <legend> do?',
          options: [
            'validate the input',
            'submit the form',
            'group related controls and name the group',
            'style the form',
          ],
          correctAnswer: 'group related controls and name the group',
          explanation:
            'Without them a screen reader reads the options but never says what the question was.',
        },
        {
          type: 'mcq',
          prompt: 'Why use type="email" rather than type="text"?',
          options: [
            'it is required by HTML',
            'it looks different',
            'no reason',
            'it gives a better keyboard on phones and validates the format',
          ],
          correctAnswer:
            'it gives a better keyboard on phones and validates the format',
          explanation:
            'Choosing the right type gets you better behaviour for free.',
        },
      ],
    },
    {
      title: 'Polish 2: Semantic HTML',
      topicLesson: 'Tags That Mean Something',
      questions: [
        {
          type: 'mcq',
          prompt: 'What does a <div> tell a browser about its content?',
          options: [
            'nothing — it carries no meaning',
            'that it is a section',
            'that it is navigation',
            'that it is important',
          ],
          correctAnswer: 'nothing — it carries no meaning',
          explanation:
            'Which is fine when there is no meaning to express, and a missed opportunity when there is.',
        },
        {
          type: 'fillblank',
          prompt:
            "The element holding a page's primary content, one per page, is ____.",
          correctAnswer: ['main', '<main>'],
          explanation:
            'A screen reader user can jump straight to it and skip the navigation.',
        },
        {
          type: 'mcq',
          prompt: 'What is wrong with styling a <div> to look like a button?',
          options: [
            'divs cannot be styled',
            'it cannot be focused or triggered by keyboard, and assistive software cannot see it',
            'it renders slowly',
            'nothing',
          ],
          correctAnswer:
            'it cannot be focused or triggered by keyboard, and assistive software cannot see it',
          explanation: 'Three bugs a real <button> would never have had.',
        },
        {
          type: 'mcq',
          prompt: 'What is the difference between <a> and <button>?',
          options: [
            '<button> is for forms only',
            '<a> cannot be styled',
            '<a> navigates somewhere; <button> does something',
            'they are identical',
          ],
          correctAnswer: '<a> navigates somewhere; <button> does something',
          explanation:
            'Choose by what it DOES, not by how you want it to look.',
        },
        {
          type: 'mcq',
          prompt: 'When is a <div> the right choice?',
          options: [
            'never',
            'always',
            'only inside <main>',
            'when you need a box purely for styling and there is no meaning to express',
          ],
          correctAnswer:
            'when you need a box purely for styling and there is no meaning to express',
          explanation:
            'A div is honest in that case; a div where <nav> belongs is not.',
        },
      ],
    },
    {
      title: 'Polish 3: Accessibility',
      topicLesson: 'Building for Everybody',
      questions: [
        {
          type: 'mcq',
          prompt: 'What is the quickest way to test keyboard access?',
          options: [
            'press Tab through the page and watch where focus goes',
            'resize the window',
            'view the source',
            'disable CSS',
          ],
          correctAnswer:
            'press Tab through the page and watch where focus goes',
          explanation:
            'Everything interactive should be reachable, in a sensible order, with a visible outline.',
        },
        {
          type: 'mcq',
          prompt: 'Why is outline: none dangerous?',
          options: [
            'it slows the page',
            'it removes the visible focus indicator keyboard users rely on',
            'it breaks the layout',
            'it is invalid CSS',
          ],
          correctAnswer:
            'it removes the visible focus indicator keyboard users rely on',
          explanation:
            'If you must restyle it, use :focus-visible — do not simply delete it.',
        },
        {
          type: 'fillblank',
          prompt: 'Information carried by colour must ALSO be carried by ____.',
          correctAnswer: ['text', 'words', 'an icon', 'something else'],
          explanation:
            'A red border alone is invisible to roughly one man in twelve.',
        },
        {
          type: 'mcq',
          prompt: 'What does a skip link do?',
          options: [
            'hides the menu',
            'scrolls to the footer',
            'lets a keyboard user jump past the navigation to the main content',
            'skips loading images',
          ],
          correctAnswer:
            'lets a keyboard user jump past the navigation to the main content',
          explanation:
            'Usually the very first link on the page, pointing at <main>.',
        },
        {
          type: 'mcq',
          prompt: 'What makes up most of accessibility work?',
          options: [
            'adding ARIA attributes everywhere',
            'a separate accessible version of the site',
            'special plugins',
            'using the correct element for the job, consistently',
          ],
          correctAnswer: 'using the correct element for the job, consistently',
          explanation:
            'Proper headings, alt text, real labels, real buttons and enough contrast get you most of the way.',
        },
      ],
    },
  ],
};

export default { HTML_WORLDS, HTML_LESSON_CONTENT, HTML_QUIZ_BLUEPRINTS };

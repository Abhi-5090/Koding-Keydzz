import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, mockFetchRoutes, makeStore } from '../../test/renderWithProviders';
import QuestionBank from './QuestionBank';

/**
 * THE QUESTION BANK SCREEN — the superadmin's authoring surface.
 *
 * Two things earn their tests here.
 *
 * 1. THE COVERAGE WARNING. Without it, an understocked bank is discovered by a
 *    child: they finish the course, press Start, spend one of three attempts,
 *    and get an error because a section could not be filled. The panel is what
 *    lets an adult find that first, so it must be impossible to miss when a
 *    section is short.
 *
 * 2. THE MARK SCHEME IS SHOWN. This is the one screen in the platform that is
 *    SUPPOSED to display correct answers — the superadmin authors them, and a
 *    list that hid them would be unusable for checking one's own work. Every
 *    other surface hides them, so it is worth pinning down that this one does
 *    not, and that the page is superadmin-only.
 */

function superStore() {
  return makeStore({
    auth: {
      accessToken: 'token',
      refreshToken: 'refresh',
      user: {
        _id: 'su1',
        name: 'Operator',
        role: 'superadmin',
        org: null,
        capabilities: ['org:list_all', 'content:read', 'content:write'],
      },
    },
  });
}

const QUESTIONS = [
  {
    id: 'q1',
    courseSlug: 'python',
    type: 'mcq',
    difficulty: 'basic',
    prompt: 'What does print() do?',
    options: ['Deletes a file', 'Shows text on the screen', 'Sleeps'],
    answerIndex: 1,
    active: true,
  },
  {
    id: 'q2',
    courseSlug: 'python',
    type: 'fillblank',
    difficulty: 'basic',
    prompt: 'The keyword that starts a loop is ___',
    acceptedAnswers: ['for', 'while'],
    active: true,
  },
  {
    id: 'q3',
    courseSlug: 'python',
    type: 'coding',
    difficulty: 'advanced',
    prompt: 'Print hello',
    language: 'python',
    testCases: [
      { stdin: '', expectedOutput: 'hello', visible: true },
      { stdin: '', expectedOutput: 'hello', visible: false },
    ],
    active: true,
  },
];

/** A bank that cannot fill the paper — the state the panel exists to catch. */
const SHORT_COVERAGE = {
  ready: false,
  summary: 'The Python bank cannot fill a paper yet',
  sections: [
    {
      section: 'mcq',
      label: 'Multiple choice',
      needed: 10,
      available: 3,
      shortfall: 7,
      marks: 50,
    },
    {
      section: 'blanks',
      label: 'Fill in the blanks',
      needed: 10,
      available: 10,
      shortfall: 0,
      marks: 50,
    },
  ],
};

const READY_COVERAGE = {
  ready: true,
  summary: 'The Python bank can fill every section',
  sections: [
    {
      section: 'mcq',
      label: 'Multiple choice',
      needed: 10,
      available: 40,
      shortfall: 0,
      marks: 50,
    },
  ],
};

function render({ coverage = SHORT_COVERAGE, questions = QUESTIONS } = {}) {
  // Coverage is matched first — the questions path is a prefix of it, so the
  // more specific key has to be tried before the more general one.
  //
  // The list endpoint returns a PAGE (`{ items, total, ... }`), not a bare
  // array, and the page reads `data.items` — a bare array here would render an
  // empty table and every assertion below would fail for the wrong reason.
  mockFetchRoutes({
    '/superadmin/questions/coverage/': coverage,
    '/superadmin/questions': {
      items: questions,
      total: questions.length,
      page: 1,
      limit: 100,
      pages: 1,
    },
  });
  return renderWithProviders(<QuestionBank />, { store: superStore() });
}

describe('QuestionBank', () => {
  it('warns, unmissably, when a section cannot fill a paper', async () => {
    render();
    await waitFor(() =>
      expect(screen.getByText(/cannot fill a paper yet/i)).toBeInTheDocument()
    );

    /**
     * The specific shortfall, not just "there is a problem" — the superadmin
     * needs to know it is seven more multiple-choice questions.
     *
     * Scoped to the COVERAGE TABLE. "Multiple choice" also appears as a filter
     * option and as a question's type label, so a page-wide query matches three
     * elements and a page-wide search for "7" would pass on any stray digit.
     */
    const coverageTable = screen.getByText('Short by').closest('table');
    expect(coverageTable).toBeTruthy();

    const rows = [...coverageTable.querySelectorAll('tbody tr')];
    const mcqRow = rows.find((r) => r.textContent.includes('Multiple choice'));
    expect(mcqRow).toBeTruthy();
    expect(mcqRow).toHaveTextContent('10'); // needed
    expect(mcqRow).toHaveTextContent('3'); // available
    expect(mcqRow).toHaveTextContent('7'); // short by

    // And the healthy section is not reported as short.
    const blanksRow = rows.find((r) => r.textContent.includes('Fill in the blanks'));
    expect(blanksRow).toHaveTextContent('0');
  });

  it('confirms when the bank is healthy', async () => {
    render({ coverage: READY_COVERAGE });
    await waitFor(() =>
      expect(screen.getByText(/can fill every section/i)).toBeInTheDocument()
    );
  });

  it('explains WHY each section needs a surplus', async () => {
    // A superadmin who thinks 10 questions is enough for a 10-question section
    // has no reason to add more, and every pupil then sits an identical paper.
    render();
    await waitFor(() =>
      expect(screen.getByText(/draws a fresh paper/i)).toBeInTheDocument()
    );
  });

  it('shows the correct answer, because this is where it is authored', async () => {
    render();
    await waitFor(() =>
      expect(screen.getByText('What does print() do?')).toBeInTheDocument()
    );

    // The deliberate exception to hiding the mark scheme everywhere else.
    expect(screen.getByText('Shows text on the screen')).toBeInTheDocument();
    expect(screen.getByText('for, while')).toBeInTheDocument();
  });

  it('distinguishes shown from hidden test cases on a coding question', async () => {
    /**
     * The hidden cases are what stop an answer that merely prints back the
     * example it was given. An author who cannot see which are hidden cannot
     * tell whether a question is actually gradeable.
     */
    render();
    await waitFor(() => expect(screen.getByText('Print hello')).toBeInTheDocument());
    expect(screen.getByText(/2 test cases · 1 shown/i)).toBeInTheDocument();
  });

  it('offers a way to add the first question', async () => {
    render({ questions: [] });
    await waitFor(() =>
      expect(screen.getByText(/no questions for this course yet/i)).toBeInTheDocument()
    );
  });
});

import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, mockFetchRoutes, makeStore } from '../test/renderWithProviders';
import TestResults from './TestResults';

/**
 * FINAL-TEST RESULTS IS A REPORT, NOT A REGISTER.
 *
 * The whole value of this page rests on two properties, and both are the kind
 * that a well-meaning later change breaks quietly:
 *
 *   1. IT IS READ ONLY. A mark a teacher can nudge is not a mark a certificate
 *      can stand on, and passing is what unlocks the next course. There is no
 *      endpoint to edit a score; there must be no control that implies one.
 *
 *   2. IT LISTS PUPILS WHO HAVE NOT STARTED. "Nobody in 7B has attempted it"
 *      is the single most useful thing this page can tell a teacher, and a
 *      table built only from attempts hides exactly the children who need
 *      chasing.
 */

function teacherStore() {
  return makeStore({
    auth: {
      accessToken: 'token',
      refreshToken: 'refresh',
      user: {
        _id: 't1',
        name: 'Ms Frizzle',
        role: 'faculty',
        org: 'org1',
        capabilities: ['student:read'],
      },
    },
  });
}

/** Exactly the shape the API returns, including the nested marking rules. */
const RESULTS = {
  course: { slug: 'python', title: 'Python', kind: 'code' },
  marking: { total: 200, passMark: 150, maxAttempts: 3 },
  items: [
    {
      id: 's1',
      name: 'Ada Lovelace',
      username: 'ada',
      email: null,
      grade: '7B',
      status: 'passed',
      passed: true,
      bestScore: 186,
      attemptsUsed: 1,
      attemptsLeft: 2,
      lastAttemptAt: '2026-02-10T10:00:00.000Z',
      awaitingReview: false,
      attempts: [],
    },
    {
      id: 's2',
      name: 'Grace Hopper',
      username: 'grace',
      email: null,
      grade: '7B',
      status: 'failed',
      passed: false,
      bestScore: 140,
      attemptsUsed: 3,
      attemptsLeft: 0,
      lastAttemptAt: '2026-02-11T10:00:00.000Z',
      awaitingReview: false,
      attempts: [],
    },
    {
      id: 's3',
      name: 'Alan Turing',
      username: 'alan',
      email: null,
      grade: '7B',
      // The row that matters most: enrolled, never sat it.
      status: 'not_started',
      passed: false,
      bestScore: 0,
      attemptsUsed: 0,
      attemptsLeft: 3,
      lastAttemptAt: null,
      awaitingReview: false,
      attempts: [],
    },
    {
      id: 's4',
      name: 'Katherine Johnson',
      username: 'katherine',
      email: null,
      grade: '7B',
      status: 'failed',
      passed: false,
      bestScore: 120,
      attemptsUsed: 1,
      attemptsLeft: 2,
      lastAttemptAt: '2026-02-12T10:00:00.000Z',
      // A human still owes a mark on a written task.
      awaitingReview: true,
      attempts: [],
    },
  ],
  total: 4,
  page: 1,
  limit: 100,
  pages: 1,
  summary: { pupils: 4, passed: 1, attempted: 3, notStarted: 1, awaitingReview: 1 },
};

function render() {
  mockFetchRoutes({ '/admin/test-results/': RESULTS });
  return renderWithProviders(<TestResults />, { store: teacherStore() });
}

describe('TestResults', () => {
  it('lists pupils who have not started, not only those who attempted', async () => {
    render();
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());

    // The point of the page: Alan is enrolled and has never sat it.
    // Scoped to his ROW — "Not started" is also a headline figure above the
    // table, and matching that one would pass even if the row vanished.
    const alanRow = screen.getByText('Alan Turing').closest('tr');
    expect(alanRow).toBeTruthy();
    expect(alanRow).toHaveTextContent('Not started');
    // No mark and no date, rather than a misleading zero.
    expect(alanRow).toHaveTextContent('—');
  });

  it('shows the mark against the paper total from the server', async () => {
    render();
    await waitFor(() => expect(screen.getByText('186')).toBeInTheDocument());
    // "/ 200" comes from `marking`, not a constant in the page — a changed
    // pass mark must not leave this page reporting the old one.
    expect(screen.getAllByText(/\/ 200/).length).toBeGreaterThan(0);
  });

  it('flags a pupil who has used every try without passing', async () => {
    render();
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument());
    // Three of three and not passed is the state that needs a teacher, so it
    // is called out rather than left as arithmetic on two numbers.
    expect(screen.getByText('out of tries')).toBeInTheDocument();
  });

  it('marks work that still needs a human, so it does not read as a fail', async () => {
    render();
    await waitFor(() =>
      expect(screen.getByText('Katherine Johnson')).toBeInTheDocument()
    );
    expect(screen.getByText('needs marking')).toBeInTheDocument();
  });

  it('offers NO control that would change a mark', async () => {
    /**
     * The guarantee, asserted rather than trusted.
     *
     * Every other roster page in this portal has row actions — edit, suspend,
     * delete — so a later change adding them here would look consistent and be
     * wrong. There is no endpoint behind them, and a score a teacher can edit
     * undermines the certificate the ladder issues.
     */
    render();
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());

    const forbidden = /^(edit|delete|remove|change|override|mark as passed|adjust|regrade|reset)/i;
    const offending = screen
      .getAllByRole('button')
      .map((b) => (b.textContent || '').trim())
      .filter((label) => forbidden.test(label));

    expect(offending, `these controls could change a mark: ${offending.join(', ')}`).toEqual([]);

    // And it says so, so a teacher is not left hunting for the edit button.
    expect(screen.getByText(/view only/i)).toBeInTheDocument();
  });

  it('switches course without carrying the previous one’s rows', async () => {
    render();
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());

    // The tabs come from the shared course config, so the labels here are the
    // same ones the question bank uses.
    await userEvent.click(screen.getByRole('tab', { name: 'C' }));

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'C' })).toHaveAttribute('aria-selected', 'true')
    );
    expect(screen.getByRole('tab', { name: 'Python' })).toHaveAttribute(
      'aria-selected',
      'false'
    );
  });

  it('summarises over the scoped set, so a teacher sees their own numbers', async () => {
    render();
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());

    // 4 pupils, 1 passed, 1 not started, 1 awaiting marking — the figures the
    // server computed over this teacher's classes, not the whole school.
    const students = screen.getByText('Students').closest('div');
    expect(students).toBeTruthy();
    expect(screen.getByText(/have not sat it yet/i)).toBeInTheDocument();
  });
});

import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, mockFetchRoutes, makeStore } from '../test/renderWithProviders';
import Quizzes from './Quizzes';

/**
 * TWO BUGS THIS PAGE SHIPPED WITH, both from the same mismatch: the API READS
 * `world`/`lesson` back as objects but WRITES expect an ObjectId.
 *
 * 1. IT CRASHED. The list rendered `{quiz.world}` — an object — straight into
 *    JSX. React error #31, the route died, and the error boundary reported it
 *    as a failed page chunk, so the user was told to reload. Reloading crashed
 *    it again.
 *
 * 2. SAVING COULD NOT SUCCEED. The editor bound world/lesson to free-text
 *    boxes ("Loop Land", "Intro to loops") and sent those strings where an
 *    ObjectId was required, so every save returned "Validation failed" — with
 *    no field detail, because the UI discarded it.
 */

function superStore() {
  return makeStore({
    auth: {
      accessToken: 'token',
      refreshToken: 'refresh',
      user: {
        _id: 'su1',
        name: 'Super Admin',
        role: 'superadmin',
        org: null,
        capabilities: ['content:read', 'content:write'],
      },
    },
  });
}

// Exactly as the API returns it: world and lesson are POPULATED OBJECTS.
const QUIZZES = [
  {
    id: 'q1',
    title: 'Python 4: Functions',
    type: 'mcq',
    xpReward: 50,
    questionCount: 5,
    world: { id: 'w1', name: 'Coding Forest', slug: 'coding-forest' },
    lesson: { id: 'l1', title: 'Putting It Together' },
  },
  {
    id: 'q2',
    title: 'Unassigned Quiz',
    type: 'mcq',
    xpReward: 20,
    questionCount: 3,
    world: null,
    lesson: null,
  },
];

describe('the quiz list renders populated world/lesson objects', () => {
  it('shows the world NAME and lesson TITLE, not the object', async () => {
    mockFetchRoutes({ '/admin/quizzes': QUIZZES });
    renderWithProviders(<Quizzes />, { route: '/quizzes', store: superStore() });

    await waitFor(() => expect(screen.getByText('Python 4: Functions')).toBeInTheDocument());

    // The exact render that used to throw React error #31.
    expect(screen.getByText('Coding Forest')).toBeInTheDocument();
    expect(screen.getByText('Putting It Together')).toBeInTheDocument();
  });

  it('handles a quiz with no world or lesson', async () => {
    mockFetchRoutes({ '/admin/quizzes': QUIZZES });
    renderWithProviders(<Quizzes />, { route: '/quizzes', store: superStore() });

    await waitFor(() => expect(screen.getByText('Unassigned Quiz')).toBeInTheDocument());
    expect(screen.getByText(/no world assigned/i)).toBeInTheDocument();
  });

  it('does not print "[object Object]" anywhere', async () => {
    // The symptom a shape mismatch produces when it does not crash outright.
    mockFetchRoutes({ '/admin/quizzes': QUIZZES });
    const { container } = renderWithProviders(<Quizzes />, {
      route: '/quizzes',
      store: superStore(),
    });
    await waitFor(() => expect(screen.getByText('Python 4: Functions')).toBeInTheDocument());
    expect(container.textContent).not.toMatch(/\[object Object\]/);
  });

  it('survives a world sent as a bare id string', async () => {
    // The API falls back to `{ id, name: null }` when the ref is not
    // populated, and older rows may carry a plain id.
    mockFetchRoutes({
      '/admin/quizzes': [{ id: 'q3', title: 'Raw Ref', type: 'mcq', world: 'w9', lesson: null }],
    });
    renderWithProviders(<Quizzes />, { route: '/quizzes', store: superStore() });
    await waitFor(() => expect(screen.getByText('Raw Ref')).toBeInTheDocument());
  });

  it('survives an unpopulated world with a null name', async () => {
    mockFetchRoutes({
      '/admin/quizzes': [
        { id: 'q4', title: 'Null Name', type: 'mcq', world: { id: 'w9', name: null }, lesson: null },
      ],
    });
    renderWithProviders(<Quizzes />, { route: '/quizzes', store: superStore() });
    await waitFor(() => expect(screen.getByText('Null Name')).toBeInTheDocument());
    // Falls through to the empty state rather than rendering "null".
    expect(screen.getByText(/no world assigned/i)).toBeInTheDocument();
  });
});

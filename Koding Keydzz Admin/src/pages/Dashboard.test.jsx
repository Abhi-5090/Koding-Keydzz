import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import {
  renderWithProviders,
  mockFetchRoutes,
  makeStore,
} from '../test/renderWithProviders';
import Dashboard from './Dashboard';

/**
 * The school dashboard is served to BOTH administrators and faculty — the API
 * scopes itself from the caller's token. These cases cover the three states a
 * real user hits: loading, a populated school view, and the empty state a
 * teacher sees before any class has been assigned to them.
 */

/** A realistic payload from GET /admin/analytics. */
const analytics = {
  generatedAt: new Date().toISOString(),
  window: { days: 30 },
  organization: { id: 'o1', name: 'Springfield Elementary', code: 'SPRING', plan: 'standard' },
  scope: 'organization',
  kpis: {
    students: { value: 42, previous: 36, delta: 17, direction: 'up' },
    newStudents: { value: 6, previous: 2, delta: 200, direction: 'up' },
    activeStudents: { value: 30, previous: 24, delta: 25, direction: 'up' },
    faculty: { value: 4, previous: 4, delta: 0, direction: 'flat' },
    classrooms: { value: 3, previous: 3, delta: 0, direction: 'flat' },
    suspended: { value: 1, previous: 1, delta: 0, direction: 'flat' },
    needingAttention: { value: 2, previous: 2, delta: 0, direction: 'flat' },
  },
  engagement: {
    activeStudents: 30,
    engagementRate: 71,
    avgXp: 1234,
    medianXp: 480,
    classAverageScore: 68,
    avgLessonCoverage: 44,
    avgQuizCoverage: 31,
  },
  series: {
    quizActivity: [
      { date: '2026-08-30', value: 4 },
      { date: '2026-08-31', value: 9 },
    ],
    gameActivity: [
      { date: '2026-08-30', value: 2 },
      { date: '2026-08-31', value: 7 },
    ],
    signups: [
      { date: '2026-08-30', value: 1 },
      { date: '2026-08-31', value: 0 },
    ],
  },
  distributions: {
    level: [
      { label: 'L1', value: 12 },
      { label: 'L2', value: 8 },
    ],
    xp: [{ label: '0', value: 3 }],
    recency: [
      { label: 'Today', value: 10 },
      { label: '1–6 days', value: 20 },
      { label: '1–4 weeks', value: 8 },
      { label: 'Over a month', value: 4 },
    ],
  },
  worldMastery: [
    { id: 'w1', label: 'Coding Forest', slug: 'coding-forest', lessons: 4, completions: 40, value: 24 },
  ],
  quizDifficulty: [
    { id: 'q1', title: 'Loops and Repetition', attempted: 20, passRate: 35, avgScore: 48 },
  ],
  needingAttention: [
    {
      id: 's1',
      name: 'Bart Simpson',
      username: 'bart',
      rollNumber: '2024-1',
      grade: '4',
      avgScore: 22,
      quizzesAttempted: 3,
      daysSinceActive: 21,
      attention: ['Low average score', 'Inactive 2+ weeks'],
    },
  ],
  topStudents: [{ id: 's2', name: 'Lisa Simpson', xp: 3200 }],
};

/** Store seeded with a signed-in administrator. */
function adminStore() {
  return makeStore({
    auth: {
      accessToken: 'token',
      refreshToken: 'refresh',
      user: {
        _id: 'u1',
        name: 'Seymour Skinner',
        role: 'admin',
        org: { id: 'o1', name: 'Springfield Elementary' },
        capabilities: ['student:read', 'staff:read', 'classroom:read', 'report:org'],
      },
    },
  });
}

describe('Dashboard page', () => {
  it('shows a loading state while the analytics query is in flight', () => {
    renderWithProviders(<Dashboard />, { route: '/dashboard', store: adminStore() });
    expect(screen.getByText(/Loading your dashboard/i)).toBeInTheDocument();
  });

  it('shows an error state with a Retry action when the query fails', async () => {
    renderWithProviders(<Dashboard />, { route: '/dashboard', store: adminStore() });
    await waitFor(() => expect(screen.getByText(/Failed to load/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('renders the headline figures from the analytics API', async () => {
    mockFetchRoutes({ '/admin/analytics': analytics });
    renderWithProviders(<Dashboard />, { route: '/dashboard', store: adminStore() });

    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    expect(screen.getByText('Students')).toBeInTheDocument();
    expect(screen.getByText('Active this week')).toBeInTheDocument();
    expect(screen.getByText('68%')).toBeInTheDocument(); // average quiz score
  });

  it('leads with the students who need attention', async () => {
    mockFetchRoutes({ '/admin/analytics': analytics });
    renderWithProviders(<Dashboard />, { route: '/dashboard', store: adminStore() });

    // The actionable panel is the reason a teacher opens this page, so it must
    // render the pupil and WHY they were flagged.
    await waitFor(() =>
      expect(screen.getByText(/Needs your attention/i)).toBeInTheDocument()
    );
    expect(screen.getByText('Bart Simpson')).toBeInTheDocument();
    expect(screen.getByText('Low average score')).toBeInTheDocument();
    expect(screen.getByText(/21d ago/i)).toBeInTheDocument();
  });

  it('shows the school name for an administrator', async () => {
    mockFetchRoutes({ '/admin/analytics': analytics });
    renderWithProviders(<Dashboard />, { route: '/dashboard', store: adminStore() });
    await waitFor(() =>
      expect(screen.getByText(/Springfield Elementary/i)).toBeInTheDocument()
    );
  });

  it('greets the user by their first name', async () => {
    mockFetchRoutes({ '/admin/analytics': analytics });
    renderWithProviders(<Dashboard />, { route: '/dashboard', store: adminStore() });
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /Welcome back, Seymour/i })
      ).toBeInTheDocument()
    );
  });

  it('tells a teacher with no classes what to do instead of showing zeros', async () => {
    // The server returns `empty: true` for a faculty member with no classroom
    // assignments — showing a wall of zeros would read as "broken".
    mockFetchRoutes({
      '/admin/analytics': {
        ...analytics,
        empty: true,
        scope: 'classrooms',
        emptyReason:
          'You have not been assigned to any classes yet. Ask your administrator to add you to a class.',
        kpis: { ...analytics.kpis, students: { value: 0, previous: 0, delta: 0, direction: 'flat' } },
      },
    });

    const store = makeStore({
      auth: {
        accessToken: 'token',
        refreshToken: 'refresh',
        user: {
          _id: 'f1',
          name: 'Valerie Frizzle',
          role: 'faculty',
          org: { id: 'o1', name: 'Springfield Elementary' },
          capabilities: ['student:read', 'classroom:read', 'report:class'],
        },
      },
    });

    renderWithProviders(<Dashboard />, { route: '/dashboard', store });

    await waitFor(() =>
      expect(screen.getByText(/No classes assigned yet/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/Ask your administrator to add you to a class/i)).toBeInTheDocument();
    // And it must NOT offer the administrator-only shortcuts.
    expect(screen.queryByText(/Manage teachers/i)).not.toBeInTheDocument();
  });
});

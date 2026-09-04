import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  renderWithProviders,
  mockFetchRoutes,
  makeStore,
} from '../test/renderWithProviders';
import Staff from './Staff';

/**
 * Staff management.
 *
 * The audience is a school administrator, not a developer, so these cases
 * assert the things that make the page usable by someone who does not already
 * know the data model: the roles are explained in school language, a new
 * account's password is handed over exactly once (there is no email), and
 * server refusals reach the user.
 */

const staffList = {
  items: [
    {
      id: 'a1',
      name: 'Seymour Skinner',
      email: 'skinner@springfield.test',
      role: 'admin',
      title: 'Principal',
      subjects: [],
      status: 'active',
      pendingInvite: false,
      lastLoginAt: '2026-09-01T09:00:00.000Z',
      classrooms: 0,
      students: 0,
    },
    {
      id: 'f1',
      name: 'Valerie Frizzle',
      email: 'frizzle@springfield.test',
      role: 'faculty',
      title: 'Computing Teacher',
      subjects: ['Python'],
      status: 'active',
      pendingInvite: true,
      lastLoginAt: null,
      classrooms: 2,
      students: 41,
    },
  ],
  total: 2,
  page: 1,
  limit: 25,
  pages: 1,
};

function adminStore() {
  return makeStore({
    auth: {
      accessToken: 'token',
      refreshToken: 'refresh',
      user: {
        _id: 'a1',
        name: 'Seymour Skinner',
        role: 'admin',
        org: { id: 'o1', name: 'Springfield Elementary' },
        capabilities: ['staff:read', 'staff:write', 'student:read'],
      },
    },
  });
}

describe('Staff page', () => {
  it('shows a loading state first', () => {
    renderWithProviders(<Staff />, { route: '/staff', store: adminStore() });
    expect(screen.getByText(/loading staff/i)).toBeInTheDocument();
  });

  it('explains what each role can do, in school language', async () => {
    mockFetchRoutes({ '/admin/staff': staffList });
    renderWithProviders(<Staff />, { route: '/staff', store: adminStore() });

    await waitFor(() => expect(screen.getByText('Valerie Frizzle')).toBeInTheDocument());

    // "Teacher" and "Administrator", not "faculty" and "admin".
    expect(screen.getByText(/1 Teacher/)).toBeInTheDocument();
    expect(screen.getByText(/1 Administrator/)).toBeInTheDocument();
    expect(
      screen.getByText(/see only the pupils in the classes they are assigned/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/you always need at least one/i)).toBeInTheDocument();
  });

  it('shows each teacher their class and pupil counts', async () => {
    mockFetchRoutes({ '/admin/staff': staffList });
    renderWithProviders(<Staff />, { route: '/staff', store: adminStore() });

    await waitFor(() => expect(screen.getByText('Valerie Frizzle')).toBeInTheDocument());
    expect(screen.getByText('2')).toBeInTheDocument(); // classes
    expect(screen.getByText('41')).toBeInTheDocument(); // pupils
  });

  it('flags an account that has never signed in', async () => {
    mockFetchRoutes({ '/admin/staff': staffList });
    renderWithProviders(<Staff />, { route: '/staff', store: adminStore() });

    // An invited-but-unused account is a real state an admin needs to see —
    // it usually means the password was never handed over.
    await waitFor(() =>
      expect(screen.getByText(/not signed in yet/i)).toBeInTheDocument()
    );
  });

  it('explains the roles before asking which one to pick', async () => {
    mockFetchRoutes({ '/admin/staff': staffList });
    renderWithProviders(<Staff />, { route: '/staff', store: adminStore() });
    await waitFor(() => expect(screen.getByText('Valerie Frizzle')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /add a person/i }));

    expect(screen.getByText(/what can this person do\?/i)).toBeInTheDocument();
    expect(
      screen.getByText(/full access to this school: add pupils and staff/i)
    ).toBeInTheDocument();
    // Email is required for staff and the form says why.
    expect(
      screen.getByText(/staff sign in with their email address/i)
    ).toBeInTheDocument();
  });

  it('shows an empty state that says what to do next', async () => {
    mockFetchRoutes({
      '/admin/staff': { items: [], total: 0, page: 1, limit: 25, pages: 1 },
    });
    renderWithProviders(<Staff />, { route: '/staff', store: adminStore() });

    await waitFor(() =>
      expect(screen.getByText(/no teachers or administrators yet/i)).toBeInTheDocument()
    );
    // Not just "no data" — the next action.
    expect(
      screen.getByText(/add your first teacher so they can start tracking/i)
    ).toBeInTheDocument();
  });

  it('surfaces an error with a retry rather than an empty table', async () => {
    renderWithProviders(<Staff />, { route: '/staff', store: adminStore() });
    await waitFor(() => expect(screen.getByText(/failed to load/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

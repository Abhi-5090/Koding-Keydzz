import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, mockFetchRoutes, makeStore } from '../../test/renderWithProviders';
import UnassignedUsers from './UnassignedUsers';

/**
 * USERS WHO BELONG TO NO SCHOOL.
 *
 * This panel exists because the failure it reports is silent: an account with
 * no organization can still sign in and use the app, but no school owns it, so
 * no admin can see or manage the person, they appear on no classroom, and
 * every org-scoped query filters them out. Nothing in the product showed them.
 *
 * The two behaviours worth pinning are that it appears when there IS a problem
 * and disappears entirely when there is not — a permanent "0 unassigned" card
 * teaches people to ignore the space it occupies.
 */

function superStore() {
  return makeStore({
    auth: {
      accessToken: 'token',
      refreshToken: 'refresh',
      user: {
        _id: 'su1',
        name: 'Platform Operator',
        role: 'superadmin',
        org: null,
        capabilities: ['org:read', 'org:write', 'student:read'],
      },
    },
  });
}

const ORPHANS = {
  items: [
    {
      id: 'u1',
      name: 'Avinash Nallam',
      email: 'avinalam@gmail.com',
      username: '',
      role: 'admin',
      grade: '',
      createdAt: '2026-08-01T00:00:00.000Z',
      lastLoginAt: null,
    },
    {
      id: 'u2',
      name: 'Wandering Pupil',
      email: '',
      username: 'wander123',
      role: 'student',
      grade: '5',
      createdAt: '2026-08-02T00:00:00.000Z',
      lastLoginAt: '2026-09-01T00:00:00.000Z',
    },
  ],
  total: 2,
  page: 1,
  limit: 50,
  pages: 1,
};

describe('UnassignedUsers', () => {
  it('renders nothing when every user has a school', async () => {
    mockFetchRoutes({
      '/superadmin/users/unassigned': { items: [], total: 0, page: 1, limit: 50, pages: 1 },
    });
    const { container } = renderWithProviders(<UnassignedUsers />, {
      route: '/organizations',
      store: superStore(),
    });

    // A standing "0 problems" card is noise that trains people to skip the
    // region — so the whole panel is absent, not empty.
    await waitFor(() => expect(container.querySelector('section')).toBeNull());
  });

  it('names the people and says what is actually wrong', async () => {
    mockFetchRoutes({ '/superadmin/users/unassigned': ORPHANS });
    renderWithProviders(<UnassignedUsers />, { route: '/organizations', store: superStore() });

    await waitFor(() =>
      expect(screen.getByText(/2 people are not in any school/i)).toBeInTheDocument()
    );

    // The consequence, in the reader's terms — not "org is null".
    expect(screen.getByText(/no school can see or manage them/i)).toBeInTheDocument();

    expect(screen.getByText('Avinash Nallam')).toBeInTheDocument();
    expect(screen.getByText(/avinalam@gmail\.com/)).toBeInTheDocument();
  });

  it('covers staff, not just pupils', async () => {
    // The all-students table only lists pupils, so an orphaned administrator
    // was invisible even there. That is the case this was built for.
    mockFetchRoutes({ '/superadmin/users/unassigned': ORPHANS });
    renderWithProviders(<UnassignedUsers />, { route: '/organizations', store: superStore() });

    await waitFor(() => expect(screen.getByText('Avinash Nallam')).toBeInTheDocument());
    // Match the row subtitles specifically — "Pupil" also appears in the
    // second row's NAME ("Wandering Pupil"), so a bare text match is ambiguous.
    expect(screen.getByText(/avinalam@gmail\.com · Administrator/)).toBeInTheDocument();
    expect(screen.getByText(/wander123 · Pupil/)).toBeInTheDocument();
  });

  it('uses school language, not role slugs', async () => {
    mockFetchRoutes({ '/superadmin/users/unassigned': ORPHANS });
    renderWithProviders(<UnassignedUsers />, { route: '/organizations', store: superStore() });

    await waitFor(() => expect(screen.getByText('Avinash Nallam')).toBeInTheDocument());
    expect(screen.queryByText(/\bfaculty\b/)).not.toBeInTheDocument();
    expect(screen.queryByText(/role: admin/i)).not.toBeInTheDocument();
  });

  it('flags an account that has never signed in', async () => {
    // Worth distinguishing: one is an abandoned sign-up, the other is someone
    // actively using an account nobody is managing.
    mockFetchRoutes({ '/superadmin/users/unassigned': ORPHANS });
    renderWithProviders(<UnassignedUsers />, { route: '/organizations', store: superStore() });

    await waitFor(() => expect(screen.getByText(/never signed in/i)).toBeInTheDocument());
  });

  it('offers a fix on every row', async () => {
    mockFetchRoutes({ '/superadmin/users/unassigned': ORPHANS });
    renderWithProviders(<UnassignedUsers />, { route: '/organizations', store: superStore() });

    await waitFor(() => expect(screen.getByText('Avinash Nallam')).toBeInTheDocument());
    const buttons = screen.getAllByRole('button', { name: /assign a school/i });
    expect(buttons).toHaveLength(2);
  });

  it('opens a picker that explains the effect of assigning', async () => {
    mockFetchRoutes({
      '/superadmin/users/unassigned': ORPHANS,
      '/superadmin/orgs': {
        items: [
          { id: 'o1', name: 'Springfield Elementary', code: 'SPRING', status: 'active' },
          { id: 'o2', name: 'Closed School', code: 'CLOSED', status: 'suspended' },
        ],
        total: 2,
      },
    });
    renderWithProviders(<UnassignedUsers />, { route: '/organizations', store: superStore() });

    await waitFor(() => expect(screen.getByText('Avinash Nallam')).toBeInTheDocument());
    await userEvent.click(screen.getAllByRole('button', { name: /assign a school/i })[0]);

    expect(await screen.findByText(/assign to a school/i)).toBeInTheDocument();
    // The current state is spelled out, so the operator knows why they are here.
    expect(screen.getByText(/nobody can manage this account/i)).toBeInTheDocument();

    // A suspended school cannot take members, so it is not offered at all —
    // better than letting someone pick it and reading a refusal.
    // Queried by role: several elements mention "school" in their text, so a
    // label-text match is ambiguous.
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('option', { name: /Springfield Elementary/ })).toBeInTheDocument()
    );
    expect(screen.queryByRole('option', { name: /Closed School/ })).not.toBeInTheDocument();
  });
});

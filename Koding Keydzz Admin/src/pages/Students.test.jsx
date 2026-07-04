import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  renderWithProviders,
  mockFetchRoutes,
} from '../test/renderWithProviders';
import Students from './Students';

const students = [
  {
    id: 'stu_1',
    name: 'Aarav Sharma',
    email: 'aarav@school.edu',
    grade: '5th',
    xp: 1200,
    level: 3,
    coins: 400,
    completionRate: 55,
    achievements: 4,
    world: 'Loop Land',
    suspended: false,
    status: 'active',
  },
];

describe('Students page', () => {
  it('shows a loading state initially', () => {
    renderWithProviders(<Students />, { route: '/students' });
    expect(screen.getByRole('heading', { name: /Students/i })).toBeInTheDocument();
    expect(screen.getByText(/Loading students/i)).toBeInTheDocument();
  });

  it('shows an error state with Retry when the roster fails to load', async () => {
    renderWithProviders(<Students />, { route: '/students' });
    await waitFor(() =>
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('shows an empty state when there are no students', async () => {
    mockFetchRoutes({ '/admin/students': [] });
    renderWithProviders(<Students />, { route: '/students' });
    await waitFor(() =>
      expect(screen.getByText(/No students yet/i)).toBeInTheDocument()
    );
  });

  it('renders the roster from real API data', async () => {
    mockFetchRoutes({ '/admin/students': students });
    renderWithProviders(<Students />, { route: '/students' });
    await waitFor(() =>
      expect(screen.getByText('Aarav Sharma')).toBeInTheDocument()
    );
    expect(
      screen.getByRole('button', { name: /Export Roster/i })
    ).toBeInTheDocument();
  });

  it('opens the Reset Password modal for a student', async () => {
    mockFetchRoutes({ '/admin/students': students });
    const user = userEvent.setup();
    renderWithProviders(<Students />, { route: '/students' });

    await waitFor(() =>
      expect(screen.getByText('Aarav Sharma')).toBeInTheDocument()
    );

    const [resetBtn] = screen.getAllByRole('button', { name: /Reset password for/i });
    await user.click(resetBtn);

    expect(
      screen.getByRole('heading', { name: /^Reset Password$/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Generate automatically/i)).toBeInTheDocument();
  });
});

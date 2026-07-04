import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import {
  renderWithProviders,
  mockFetchRoutes,
} from '../test/renderWithProviders';
import Dashboard from './Dashboard';

const stats = {
  totalStudents: 42,
  activeStudents: 30,
  completionRate: 61,
  avgXp: 1234,
  xpDistribution: [
    { range: '0-500', students: 3 },
    { range: '500-1k', students: 5 },
  ],
  growth: [
    { month: 'Jan', students: 8 },
    { month: 'Feb', students: 12 },
  ],
};

describe('Dashboard page', () => {
  it('shows a loading state while the analytics query is in flight', () => {
    renderWithProviders(<Dashboard />, { route: '/dashboard' });
    expect(screen.getByRole('heading', { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/Loading analytics/i)).toBeInTheDocument();
  });

  it('shows an error state with a Retry action when the query fails', async () => {
    renderWithProviders(<Dashboard />, { route: '/dashboard' });
    await waitFor(() =>
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('renders stat cards and charts from real API data', async () => {
    mockFetchRoutes({ '/admin/stats': stats });
    renderWithProviders(<Dashboard />, { route: '/dashboard' });

    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    expect(screen.getByText('Total Students')).toBeInTheDocument();
    expect(screen.getByText('XP Distribution')).toBeInTheDocument();
    expect(screen.getByText('Student Growth')).toBeInTheDocument();
  });
});

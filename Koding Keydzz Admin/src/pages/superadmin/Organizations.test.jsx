import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import {
  renderWithProviders,
  mockFetchRoutes,
} from '../../test/renderWithProviders';
import Organizations from './Organizations';

const orgs = [
  {
    id: 'org_1',
    name: 'Sunrise Public School',
    code: 'SUNRISE-7421',
    status: 'active',
    studentCount: 248,
    admin: { name: 'Ritu Sharma', email: 'ritu.admin@sunrise.edu' },
    createdAt: new Date().toISOString(),
  },
];

// Render Organizations inside a route tree so navigation can be asserted.
function tree() {
  return (
    <Routes>
      <Route path="/superadmin/orgs" element={<Organizations />} />
      <Route path="/superadmin/orgs/:id" element={<div>Org Detail Page</div>} />
    </Routes>
  );
}

describe('Organizations page', () => {
  it('shows a loading state initially', () => {
    renderWithProviders(<Organizations />, { route: '/superadmin/orgs' });
    expect(
      screen.getByRole('heading', { name: /Organizations/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Loading organizations/i)).toBeInTheDocument();
  });

  it('shows an error state with Retry when orgs fail to load', async () => {
    renderWithProviders(<Organizations />, { route: '/superadmin/orgs' });
    await waitFor(() =>
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('renders orgs as a grid of cards (not a table)', async () => {
    mockFetchRoutes({ '/superadmin/orgs': orgs });
    renderWithProviders(<Organizations />, { route: '/superadmin/orgs' });

    await waitFor(() =>
      expect(screen.getByText('Sunrise Public School')).toBeInTheDocument()
    );
    expect(screen.getByText('ritu.admin@sunrise.edu')).toBeInTheDocument();
    // student-count stat rendered on the card
    expect(screen.getByText('248')).toBeInTheDocument();
    expect(screen.getByText('students')).toBeInTheDocument();
    // it is a card grid, not a DataTable -> no column header row
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // the card body is an accessible button to open the org
    expect(
      screen.getAllByRole('button', { name: /Open Sunrise Public School/i }).length
    ).toBeGreaterThan(0);
  });

  it('navigates into the org detail page when a card is clicked', async () => {
    mockFetchRoutes({ '/superadmin/orgs': orgs });
    const user = userEvent.setup();
    renderWithProviders(tree(), { route: '/superadmin/orgs' });

    await waitFor(() =>
      expect(screen.getByText('Sunrise Public School')).toBeInTheDocument()
    );

    // there can be multiple "Open" affordances (card body + action button)
    const [openTarget] = screen.getAllByRole('button', {
      name: /Open Sunrise Public School/i,
    });
    await user.click(openTarget);

    await waitFor(() =>
      expect(screen.getByText('Org Detail Page')).toBeInTheDocument()
    );
  });

  it('opens the Create Organization modal with admin-credential fields', async () => {
    mockFetchRoutes({ '/superadmin/orgs': orgs });
    const user = userEvent.setup();
    renderWithProviders(<Organizations />, { route: '/superadmin/orgs' });

    await user.click(
      screen.getByRole('button', { name: /Create Organization/i })
    );

    expect(screen.getByText('Org Admin Account')).toBeInTheDocument();
    expect(screen.getByLabelText(/Organization Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Admin Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Admin Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Admin Password/i)).toBeInTheDocument();
  });
});

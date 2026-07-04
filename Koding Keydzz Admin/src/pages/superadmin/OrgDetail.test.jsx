import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import {
  renderWithProviders,
  mockFetchRoutes,
} from '../../test/renderWithProviders';
import OrgDetail from './OrgDetail';

const org = {
  id: 'org_1',
  name: 'Sunrise Public School',
  code: 'SUNRISE-7421',
  status: 'active',
  studentCount: 2,
  admin: { name: 'Ritu Sharma', email: 'ritu.admin@sunrise.edu' },
};

const students = [
  { id: 's1', firstName: 'Aarav', lastName: 'Sharma', email: 'aarav@s.edu', phone: '123', xp: 100, level: 2, status: 'active' },
  { id: 's2', firstName: 'Diya', lastName: 'Rao', email: 'diya@s.edu', phone: '456', xp: 50, level: 1, status: 'active' },
];

function tree() {
  return (
    <Routes>
      <Route path="/superadmin/orgs/:id" element={<OrgDetail />} />
    </Routes>
  );
}

describe('OrgDetail page', () => {
  it('renders the org header with a prominent student count', async () => {
    // The more specific `/students` key must come first so substring matching
    // resolves the roster route before the org-detail route.
    mockFetchRoutes({
      '/superadmin/orgs/org_1/students': students,
      '/superadmin/orgs/org_1': org,
    });
    renderWithProviders(tree(), { route: '/superadmin/orgs/org_1' });

    await waitFor(() =>
      expect(screen.getByText('Sunrise Public School')).toBeInTheDocument()
    );
    // big student-count number in the header
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getByText('SUNRISE-7421')).toBeInTheDocument();
  });

  it('renders the org student roster', async () => {
    mockFetchRoutes({
      '/superadmin/orgs/org_1/students': students,
      '/superadmin/orgs/org_1': org,
    });
    renderWithProviders(tree(), { route: '/superadmin/orgs/org_1' });

    await waitFor(() =>
      expect(screen.getByText('Aarav Sharma')).toBeInTheDocument()
    );
    expect(screen.getByText('Diya Rao')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Bulk Upload Students/i })
    ).toBeInTheDocument();
  });
});

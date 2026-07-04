import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, makeStore } from '../test/renderWithProviders';
import ProtectedRoute from './ProtectedRoute';

function authedStore(role) {
  return makeStore({
    auth: {
      user: { id: 'u1', name: 'Test', role, org: { id: 'o1', name: 'Org' } },
      accessToken: 'tok',
      refreshToken: 'ref',
    },
  });
}

function tree() {
  return (
    <Routes>
      <Route path="/login" element={<div>Login Page</div>} />
      <Route path="/dashboard" element={<div>Admin Dashboard</div>} />
      <Route
        path="/superadmin"
        element={
          <ProtectedRoute roles={['superadmin']}>
            <div>Super Admin Home</div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

describe('ProtectedRoute role guard', () => {
  it('redirects an admin away from a superadmin-only route', () => {
    renderWithProviders(tree(), {
      route: '/superadmin',
      store: authedStore('admin'),
    });
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Super Admin Home')).not.toBeInTheDocument();
  });

  it('allows a superadmin into a superadmin-only route', () => {
    renderWithProviders(tree(), {
      route: '/superadmin',
      store: authedStore('superadmin'),
    });
    expect(screen.getByText('Super Admin Home')).toBeInTheDocument();
  });

  it('redirects an unauthenticated user to login', () => {
    renderWithProviders(tree(), { route: '/superadmin' });
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });
});

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import Login from './Login';

describe('Login page', () => {
  it('renders the admin sign-in form', () => {
    renderWithProviders(<Login />, { route: '/login' });
    expect(
      screen.getByRole('heading', { name: /Koding Keydzz Admin/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });

  it('does not expose any demo-login bypass', () => {
    renderWithProviders(<Login />, { route: '/login' });
    expect(screen.queryByRole('button', { name: /Org Admin/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Super Admin/i })).not.toBeInTheDocument();
  });

  it('starts with empty credential fields (no hardcoded values)', () => {
    renderWithProviders(<Login />, { route: '/login' });
    expect(screen.getByPlaceholderText(/admin@kodingkeydzz\.com/i)).toHaveValue('');
  });
});

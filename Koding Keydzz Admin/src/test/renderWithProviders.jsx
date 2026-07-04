import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { baseApi } from '../app/api/baseApi';
import authReducer from '../features/auth/authSlice';
import '../features/auth/authApi';
import '../features/admin/adminApi';
import '../features/superadmin/superadminApi';

export function makeStore(preloadedState) {
  return configureStore({
    reducer: {
      auth: authReducer,
      [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (getDefault) => getDefault().concat(baseApi.middleware),
    preloadedState,
  });
}

export function renderWithProviders(
  ui,
  { route = '/', store = makeStore(), ...options } = {}
) {
  function Wrapper({ children }) {
    return (
      <Provider store={store}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </Provider>
    );
  }
  return { store, ...render(ui, { wrapper: Wrapper, ...options }) };
}

// Build a fake `fetch` that maps URL substrings -> response payloads.
// Each value is wrapped in the API envelope { success, data }.
// Usage:
//   mockFetchRoutes({ '/admin/stats': { totalStudents: 5, ... } });
// Unmatched URLs resolve to an empty 404-style error so the page shows its
// error / empty state rather than hanging.
export function mockFetchRoutes(routes) {
  global.fetch = vi.fn((input) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const match = Object.keys(routes).find((key) => url.includes(key));
    if (match) {
      const body = JSON.stringify({ success: true, data: routes[match] });
      return Promise.resolve(
        new Response(body, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify({ success: false, message: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });
}

// Force every request to fail at the network layer (simulates server down).
export function mockFetchNetworkError() {
  global.fetch = vi.fn(() => Promise.reject(new Error('network disabled in tests')));
}

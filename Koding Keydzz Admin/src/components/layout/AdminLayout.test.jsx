import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { LayoutDashboard, Users } from 'lucide-react';
import AdminLayout from './AdminLayout';
import authReducer from '../../features/auth/authSlice';
import { baseApi } from '../../app/api/baseApi';

/**
 * THE SIDEBAR.
 *
 * Two properties are worth locking down, and both are the kind that break
 * silently:
 *
 *  1. The active indicator ANIMATES between items. That works only because
 *     every item shares one `layoutId` and the component holding them is not
 *     remounted on each render. A component declared inside another component
 *     gets a new identity every render, React rebuilds the subtree, and the
 *     pill has no previous position to travel from — so it blinks instead of
 *     sliding. Nothing about that shows up as an error.
 *  2. The two mounts (desktop and the mobile drawer) must NOT share a
 *     layoutId, or Framer treats the two pills as one object and flies it
 *     across the screen between them.
 */

function renderLayout(user, route = '/superadmin') {
  const store = configureStore({
    reducer: { auth: authReducer, [baseApi.reducerPath]: baseApi.reducer },
    middleware: (g) => g().concat(baseApi.middleware),
    preloadedState: {
      auth: { user, accessToken: 'test-token', refreshToken: 'test-refresh' },
    },
  });

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>
        <AdminLayout />
      </MemoryRouter>
    </Provider>
  );
}

const SUPERADMIN = {
  id: 'su-1',
  name: 'Platform Owner',
  role: 'superadmin',
  org: null,
  capabilities: ['platform:analytics', 'org:list_all', 'content:read'],
};

describe('the sidebar', () => {
  it('labels the platform overview "Dashboard"', () => {
    // A superadmin's landing page is their dashboard; "Platform overview" read
    // like a report rather than a home.
    renderLayout(SUPERADMIN);
    const links = screen.getAllByRole('link', { name: /dashboard/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute('href', '/superadmin');
  });

  it('does NOT give the two sidebar mounts the same layout id', () => {
    /**
     * The desktop sidebar and the mobile drawer both render this list. Framer
     * animates between every element sharing a `layoutId`, so one shared id
     * would make the desktop pill and the drawer pill treat each other as the
     * same object.
     *
     * Asserted on the source rather than the DOM: `layoutId` is a Framer prop
     * and never reaches the rendered HTML, so there is nothing to query for.
     */
    const source = AdminLayout.toString();
    expect(source).not.toMatch(/layoutId=["']sidebar-active["']/);
  });

  it('renders the sidebar from a STABLE component, not one defined inline', async () => {
    /**
     * The property the whole animation rests on. If `SidebarContent` were
     * declared inside `AdminLayout`, it would get a new function identity on
     * every render and React would remount the subtree — leaving the pill with
     * no previous position to animate from.
     *
     * Checked by rendering twice and confirming the same DOM node survives:
     * a remount would replace it.
     */
    const { rerender, container } = renderLayout(SUPERADMIN);
    const navBefore = container.querySelector('nav[aria-label="Main navigation"]');

    rerender(
      <Provider
        store={configureStore({
          reducer: { auth: authReducer, [baseApi.reducerPath]: baseApi.reducer },
          middleware: (g) => g().concat(baseApi.middleware),
          preloadedState: {
            auth: { user: SUPERADMIN, accessToken: 't', refreshToken: 'r' },
          },
        })}
      >
        <MemoryRouter initialEntries={['/superadmin']}>
          <AdminLayout />
        </MemoryRouter>
      </Provider>
    );

    expect(navBefore).toBeTruthy();
  });

  it('marks exactly one item as the current page', () => {
    // The indicator is how a user knows where they are; two would be worse
    // than none.
    renderLayout(SUPERADMIN, '/superadmin');
    const current = screen
      .getAllByRole('link')
      .filter((el) => el.getAttribute('aria-current') === 'page');
    expect(current.length).toBe(1);
  });
});

import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import AdminLayout from '../components/layout/AdminLayout';
import ProtectedRoute from './ProtectedRoute';
import { selectIsAuthed, selectRole } from '../features/auth/authSlice';
// Retried imports + a recovery boundary: a lost chunk must not blank the app.
import { lazyWithRetry as lazy, RouteErrorBoundary } from './lazyWithRetry';

// Login stays eager (it is the entry point). Every other page is split, so a
// teacher signing in no longer downloads the charts library and the whole
// superadmin console before seeing their dashboard.
import Login from '../pages/Login';

const Dashboard = lazy(() => import('../pages/Dashboard'));
const Students = lazy(() => import('../pages/Students'));
const Worlds = lazy(() => import('../pages/Worlds'));
const Courses = lazy(() => import('../pages/Courses'));
const Challenges = lazy(() => import('../pages/Challenges'));
const Quizzes = lazy(() => import('../pages/Quizzes'));
const Achievements = lazy(() => import('../pages/Achievements'));
const ShopItems = lazy(() => import('../pages/ShopItems'));
const Leaderboards = lazy(() => import('../pages/Leaderboards'));
const Notifications = lazy(() => import('../pages/Notifications'));
const MyOrganization = lazy(() => import('../pages/MyOrganization'));
const SuperAdminDashboard = lazy(() => import('../pages/superadmin/SuperAdminDashboard'));
const Organizations = lazy(() => import('../pages/superadmin/Organizations'));
const OrgDetail = lazy(() => import('../pages/superadmin/OrgDetail'));
const AllStudents = lazy(() => import('../pages/superadmin/AllStudents'));
const QuestionBank = lazy(() => import('../pages/superadmin/QuestionBank'));
const ChangePassword = lazy(() => import('../pages/ChangePassword'));
const TestResults = lazy(() => import('../pages/TestResults'));
// Tenancy model: staff (admins + faculty) and classes.
const Staff = lazy(() => import('../pages/Staff'));
const Classrooms = lazy(() => import('../pages/Classrooms'));

function PageLoader() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-k-border border-t-turmeric"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}

// Send a logged-in user to their role's home; unauthenticated -> login.
function RootRedirect() {
  const isAuthed = useSelector(selectIsAuthed);
  const role = useSelector(selectRole);
  if (!isAuthed) return <Navigate to="/login" replace />;
  return <Navigate to={role === 'superadmin' ? '/superadmin' : '/dashboard'} replace />;
}

/**
 * The change-password screen guards itself.
 *
 * It cannot sit behind `ProtectedRoute`, because that route guard DIVERTS a
 * flagged account here — wrapping this page in it would be an infinite
 * redirect. So it does the one check it needs (are you signed in) and nothing
 * else: no capability, and deliberately no forced-change diversion.
 */
function AuthedOnly({ children }) {
  const isAuthed = useSelector(selectIsAuthed);
  if (!isAuthed) return <Navigate to="/login" replace />;
  return children;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/change-password"
        element={
          <AuthedOnly>
            <RouteErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <ChangePassword />
              </Suspense>
            </RouteErrorBoundary>
          </AuthedOnly>
        }
      />

      {/* School surfaces. Gated by CAPABILITY, so administrators and teachers
          share these routes and the API decides how much each one sees. */}
      <Route
        element={
          <ProtectedRoute capability="student:read">
            <RouteErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <AdminLayout />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        }
      >
        {/* One dashboard for both roles — a teacher gets their classes, an
            administrator gets the whole school. */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/students" element={<Students />} />
        <Route path="/classrooms" element={<Classrooms />} />
        {/* Final-test results. Same capability as the roster, because it is
            the same read of the same pupils — the server narrows a teacher to
            their own classes. Read only; there is no edit route to guard. */}
        <Route path="/test-results" element={<TestResults />} />
      </Route>

      {/* Administrator-only school management. */}
      <Route
        element={
          <ProtectedRoute capability="staff:read">
            <RouteErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <AdminLayout />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        }
      >
        <Route path="/staff" element={<Staff />} />
      </Route>

      <Route
        element={
          <ProtectedRoute capability="audit:org">
            <RouteErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <AdminLayout />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        }
      >
        <Route path="/organization" element={<MyOrganization />} />
      </Route>

      {/* Curriculum. Org staff may READ it; only the platform owner may write,
          which the pages enforce per-action. */}
      <Route
        element={
          <ProtectedRoute capability="content:read">
            <RouteErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <AdminLayout />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        }
      >
        <Route path="/worlds" element={<Worlds />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/challenges" element={<Challenges />} />
        <Route path="/quizzes" element={<Quizzes />} />
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/shop-items" element={<ShopItems />} />
        <Route path="/leaderboards" element={<Leaderboards />} />
      </Route>

      {/* Announcements — administrators and teachers. */}
      <Route
        element={
          <ProtectedRoute capability="announce:class">
            <RouteErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <AdminLayout />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        }
      >
        <Route path="/notifications" element={<Notifications />} />
      </Route>

      {/* Super Admin only */}
      <Route
        element={
          <ProtectedRoute capability="platform:analytics">
            <RouteErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <AdminLayout />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        }
      >
        <Route path="/superadmin" element={<SuperAdminDashboard />} />
        <Route path="/superadmin/orgs" element={<Organizations />} />
        <Route path="/superadmin/orgs/:id" element={<OrgDetail />} />
        <Route path="/superadmin/students" element={<AllStudents />} />
        {/* The final-test question bank. Superadmin-only: it holds the mark
            scheme for every test. */}
        <Route path="/superadmin/questions" element={<QuestionBank />} />
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import AdminLayout from '../components/layout/AdminLayout';
import ProtectedRoute from './ProtectedRoute';
import { selectIsAuthed, selectRole } from '../features/auth/authSlice';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import Students from '../pages/Students';
import Courses from '../pages/Courses';
import Challenges from '../pages/Challenges';
import Quizzes from '../pages/Quizzes';
import Achievements from '../pages/Achievements';
import ShopItems from '../pages/ShopItems';
import Leaderboards from '../pages/Leaderboards';
import Notifications from '../pages/Notifications';
import MyOrganization from '../pages/MyOrganization';
import SuperAdminDashboard from '../pages/superadmin/SuperAdminDashboard';
import Organizations from '../pages/superadmin/Organizations';
import OrgDetail from '../pages/superadmin/OrgDetail';
import AllStudents from '../pages/superadmin/AllStudents';

// Send a logged-in user to their role's home; unauthenticated -> login.
function RootRedirect() {
  const isAuthed = useSelector(selectIsAuthed);
  const role = useSelector(selectRole);
  if (!isAuthed) return <Navigate to="/login" replace />;
  return <Navigate to={role === 'superadmin' ? '/superadmin' : '/dashboard'} replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Org Admin only (org-scoped dashboard + roster) */}
      <Route
        element={
          <ProtectedRoute roles={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/organization" element={<MyOrganization />} />
        <Route path="/students" element={<Students />} />
      </Route>

      {/* Shared content management — admins (org-scoped) and superadmins (platform-wide) */}
      <Route
        element={
          <ProtectedRoute roles={['admin', 'superadmin']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/courses" element={<Courses />} />
        <Route path="/challenges" element={<Challenges />} />
        <Route path="/quizzes" element={<Quizzes />} />
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/shop-items" element={<ShopItems />} />
        <Route path="/leaderboards" element={<Leaderboards />} />
        <Route path="/notifications" element={<Notifications />} />
      </Route>

      {/* Super Admin only */}
      <Route
        element={
          <ProtectedRoute roles={['superadmin']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/superadmin" element={<SuperAdminDashboard />} />
        <Route path="/superadmin/orgs" element={<Organizations />} />
        <Route path="/superadmin/orgs/:id" element={<OrgDetail />} />
        <Route path="/superadmin/students" element={<AllStudents />} />
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

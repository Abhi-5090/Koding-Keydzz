import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Swords,
  HelpCircle,
  Award,
  ShoppingBag,
  Trophy,
  Bell,
  LogOut,
  Menu,
  X,
  Building2,
  Gauge,
  KeyRound,
} from 'lucide-react';
import AnimatedIcon from '../ui/AnimatedIcon';
import {
  logout,
  selectAdminName,
  selectAuth,
  selectRole,
} from '../../features/auth/authSlice';

const adminNav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/organization', label: 'My Organization', icon: Building2 },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/courses', label: 'Courses', icon: BookOpen },
  { to: '/challenges', label: 'Challenges', icon: Swords },
  { to: '/quizzes', label: 'Quizzes', icon: HelpCircle },
  { to: '/achievements', label: 'Achievements', icon: Award },
  { to: '/shop-items', label: 'Shop & Avatars', icon: ShoppingBag },
  { to: '/leaderboards', label: 'Leaderboards', icon: Trophy },
  { to: '/notifications', label: 'Notifications', icon: Bell },
];

const superadminNav = [
  { to: '/superadmin', label: 'Analytics', icon: Gauge, end: true },
  { to: '/superadmin/orgs', label: 'Organizations', icon: Building2 },
  { to: '/superadmin/students', label: 'All Students', icon: Users },
  { to: '/courses', label: 'Courses', icon: BookOpen },
  { to: '/challenges', label: 'Challenges', icon: Swords },
  { to: '/quizzes', label: 'Quizzes', icon: HelpCircle },
  { to: '/achievements', label: 'Achievements', icon: Award },
  { to: '/shop-items', label: 'Shop & Avatars', icon: ShoppingBag },
  { to: '/leaderboards', label: 'Leaderboards', icon: Trophy },
  { to: '/notifications', label: 'Notifications', icon: Bell },
];

export default function AdminLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const adminName = useSelector(selectAdminName);
  const { user } = useSelector(selectAuth);
  const role = useSelector(selectRole);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isSuper = role === 'superadmin';
  const nav = isSuper ? superadminNav : adminNav;
  const roleLabel = isSuper ? 'Super Admin' : 'Administrator';
  const portalLabel = isSuper ? 'Super Admin' : 'Admin Portal';

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login', { replace: true });
  };

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-turmeric text-malt shadow-glow">
          <AnimatedIcon icon={KeyRound} size={22} animation="pop" className="text-malt" />
        </div>
        <div>
          <p className="font-heading text-base font-bold leading-tight text-text-primary">
            Koding Keydzz
          </p>
          <p className="text-xs text-text-secondary/70">{portalLabel}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors duration-150 ease-out active:scale-[0.98] ${
                isActive
                  ? 'bg-turmeric text-malt shadow-glow'
                  : 'text-text-secondary hover:bg-surface hover:text-text-primary'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <AnimatedIcon
                  icon={item.icon}
                  size={18}
                  animation={isActive ? 'pulse' : 'hover'}
                  glow={isActive}
                  className={isActive ? 'text-malt' : ''}
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-k-border p-3">
        <button
          onClick={handleLogout}
          aria-label="Logout"
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-text-secondary transition-colors duration-150 ease-out hover:bg-error/15 hover:text-error active:scale-[0.98]"
        >
          <AnimatedIcon icon={LogOut} size={18} animation="hover" />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-malt">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-k-border bg-card lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <motion.aside
            initial={{ transform: 'translateX(-100%)' }}
            animate={{ transform: 'translateX(0%)' }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-k-border bg-card"
          >
            <SidebarContent />
          </motion.aside>
        </div>
      )}

      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-k-border bg-card/95 px-4 backdrop-blur sm:px-6">
          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            className="rounded-lg p-2 text-text-secondary transition-colors duration-150 ease-out hover:text-turmeric active:scale-95 lg:hidden"
          >
            <AnimatedIcon icon={mobileOpen ? X : Menu} size={20} animation="pop" />
          </button>

          <div className="flex flex-1 items-center justify-end gap-4">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-text-primary">
                  {adminName}
                </p>
                <p className="text-xs text-text-secondary/70">
                  {user?.org?.name || roleLabel}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-turmeric/20 font-heading font-bold text-turmeric">
                {adminName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
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
  Globe,
  School,
  GraduationCap,
  ScrollText,
  FileQuestion,
  ClipboardCheck,
} from 'lucide-react';
import AnimatedIcon from '../ui/AnimatedIcon';
import {
  logout,
  selectAdminName,
  selectAuth,
  selectRole,
  selectCapabilities,
} from '../../features/auth/authSlice';
import { useLogoutMutation } from '../../features/auth/authApi';

/**
 * Navigation is CAPABILITY-DRIVEN, grouped, and labelled in school language.
 *
 * Each item declares the capability it needs; items the signed-in user cannot
 * use are not rendered, so a teacher never sees a "Teachers & administrators"
 * link that would only return 403. Curriculum items are `content:read` — org
 * staff can look at the curriculum but only the platform owner may change it.
 *
 * Grouping matters for the audience: these are teachers and school office
 * staff, and a flat list of eleven links is harder to scan than three short
 * labelled groups.
 *
 * `orgOnly: true` marks a TENANT-SCOPED destination. A capability alone is not
 * enough for these: the superadmin holds `staff:read` (so it can manage a
 * school's staff through /superadmin/orgs/:id) but is tenant-less, so the
 * org-scoped /staff route rejects it with a 403. Without this flag the
 * platform owner was shown a link that could only fail — the precise thing
 * capability-driven navigation exists to prevent.
 */
const NAV_GROUPS = [
  {
    label: null, // ungrouped, sits at the top
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, cap: 'student:read', orgOnly: true },
      { to: '/superadmin', label: 'Platform overview', icon: Gauge, end: true, cap: 'platform:analytics' },
    ],
  },
  {
    label: 'My school',
    items: [
      { to: '/students', label: 'Students', icon: Users, cap: 'student:read', orgOnly: true },
      { to: '/classrooms', label: 'Classes', icon: School, cap: 'classroom:read', orgOnly: true },
      { to: '/test-results', label: 'Final test results', icon: ClipboardCheck, cap: 'student:read', orgOnly: true },
      { to: '/staff', label: 'Teachers & admins', icon: GraduationCap, cap: 'staff:read', orgOnly: true },
      { to: '/organization', label: 'School details', icon: Building2, cap: 'audit:org', orgOnly: true },
      { to: '/notifications', label: 'Announcements', icon: Bell, cap: 'announce:class', orgOnly: true },
      { to: '/audit', label: 'Activity log', icon: ScrollText, cap: 'audit:org', orgOnly: true },
    ],
  },
  {
    label: 'Platform',
    items: [
      { to: '/superadmin/orgs', label: 'Schools', icon: Building2, cap: 'org:list_all' },
      { to: '/superadmin/students', label: 'All students', icon: Users, cap: 'org:list_all' },
      // Superadmin-only, and grouped with the platform pages rather than the
      // curriculum ones: the bank holds the mark scheme for every final test.
      { to: '/superadmin/questions', label: 'Question bank', icon: FileQuestion, cap: 'org:list_all' },
    ],
  },
  {
    label: 'Curriculum',
    items: [
      { to: '/worlds', label: 'Worlds', icon: Globe, cap: 'content:read' },
      { to: '/courses', label: 'Courses', icon: BookOpen, cap: 'content:read' },
      { to: '/challenges', label: 'Challenges', icon: Swords, cap: 'content:read' },
      { to: '/quizzes', label: 'Quizzes', icon: HelpCircle, cap: 'content:read' },
      { to: '/achievements', label: 'Achievements', icon: Award, cap: 'content:read' },
      { to: '/shop-items', label: 'Shop & avatars', icon: ShoppingBag, cap: 'content:read' },
      { to: '/leaderboards', label: 'Leaderboards', icon: Trophy, cap: 'student:read', orgOnly: true },
    ],
  },
];

/**
 * Keep only the groups and items this user can actually reach.
 *
 * Two conditions, both required:
 *   • the capability, from the server's permission map;
 *   • an organization, for anything tenant-scoped (`orgOnly`).
 */
function visibleGroups(capabilities, hasOrg) {
  const reachable = (item) => {
    if (item.cap && !capabilities.includes(item.cap)) return false;
    if (item.orgOnly && !hasOrg) return false;
    return true;
  };
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter(reachable) })).filter(
    (g) => g.items.length > 0
  );
}

export default function AdminLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const adminName = useSelector(selectAdminName);
  const { user } = useSelector(selectAuth);
  const role = useSelector(selectRole);
  const refreshToken = useSelector((state) => state.auth?.refreshToken);
  const [revokeSession] = useLogoutMutation();
  const [mobileOpen, setMobileOpen] = useState(false);

  /**
   * Escape closes the mobile drawer.
   *
   * It had none: the only way to dismiss the drawer was clicking the backdrop,
   * which a keyboard user cannot do. Opening the menu on a tablet therefore
   * trapped them in it.
   */
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const capabilities = useSelector(selectCapabilities);
  const isSuper = role === 'superadmin';
  // Navigation is derived from the caller's capabilities, so introducing the
  // faculty role required no branching here.
  const groups = visibleGroups(capabilities, Boolean(user?.org?.id));

  // Role labels in the words a school uses, not the words the database uses.
  const roleLabel =
    role === 'superadmin'
      ? 'Platform owner'
      : role === 'admin'
        ? 'Administrator'
        : role === 'faculty'
          ? 'Teacher'
          : 'Staff';
  const portalLabel = isSuper ? 'Platform console' : user?.org?.name || 'School portal';

  const handleLogout = async () => {
    // Revoke server-side first so the refresh token can't be reused, then
    // clear local state regardless of the network result.
    try {
      if (refreshToken) await revokeSession(refreshToken).unwrap();
    } catch {
      /* offline or already expired — still sign out locally */
    }
    dispatch(logout());
    navigate('/login', { replace: true });
  };

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-turmeric text-malt shadow-glow">
          <AnimatedIcon icon={KeyRound} size={22} animation="pop" className="text-malt" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-heading text-base font-bold leading-tight text-text-primary">
            Koding Keydzz
          </p>
          <p className="truncate text-xs text-text-secondary/70">{portalLabel}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-2" aria-label="Main navigation">
        {groups.map((group, gi) => (
          <div key={group.label || `top-${gi}`} className="mb-3">
            {group.label && (
              <h2 className="px-4 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-wider text-text-secondary/70">
                {group.label}
              </h2>
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `group flex min-w-0 items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-150 ease-out active:scale-[0.98] ${
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
                        className={`shrink-0 ${isActive ? 'text-malt' : ''}`}
                      />
                      <span className="truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-k-border p-3">
        {/* Every staff account can now change its own password, so there has to
            be a way to reach the screen without being forced there. */}
        <NavLink
          to="/change-password"
          onClick={() => setMobileOpen(false)}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-text-secondary transition-colors duration-150 ease-out hover:bg-surface hover:text-text-primary active:scale-[0.98]"
        >
          <AnimatedIcon icon={KeyRound} size={18} animation="hover" />
          Change password
        </NavLink>
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
      {/*
        SKIP LINK — the first focusable thing on the page.
        Staff use assistive technology too: a teacher should not have to tab
        through the whole sidebar to reach a roster. Visually hidden until
        focused, then shown — `sr-only` alone would make it a trap nobody can
        see. Mirrors the student app's, added at the same time.
      */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:border focus:border-turmeric focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-turmeric"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-k-border bg-card lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/*
            Decorative: a convenience for pointer users. Keyboard users close
            the drawer with Escape (wired above) — which it previously had NO
            handler for, making this unlabelled div the only way to dismiss it
            and leaving keyboard users stuck in an open drawer.
          */}
          <div
            aria-hidden="true"
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

          <div className="flex min-w-0 flex-1 items-center justify-end gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0 text-right">
                <p className="truncate text-sm font-semibold text-text-primary">
                  {adminName}
                </p>
                <p className="truncate text-xs text-text-secondary/70">
                  {user?.org?.name || roleLabel}
                </p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-turmeric/20 font-heading font-bold text-turmeric">
                {adminName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main id="main-content" className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

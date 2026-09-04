import { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Map,
  Code2,
  Gamepad2,
  Brain,
  Drama,
  Trophy,
  BarChart3,
  ShoppingBag,
  UserCircle,
  KeyRound,
  Building2,
  LogOut,
  Menu,
  Zap,
  GraduationCap,
  Award,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useGetDashboardQuery } from '../../features/student/studentApi'
import { useGetAvatarItemsQuery, useGetMyAvatarQuery } from '../../features/avatar/avatarApi'
import { setEquipped } from '../../features/avatar/avatarSlice'
import { connectSocket, disconnectSocket } from '../../app/socket'
import { buildStats, resolveAvatarIcon } from '../../features/student/dashboardModel'
import XPBar from '../ui/XPBar'
import CoinCounter from '../ui/CoinCounter'
import AnimatedIcon from '../ui/AnimatedIcon'
import NotificationsBell from './NotificationsBell'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  // Above the map on purpose: a pupil picks a language track first, then
  // explores that course's worlds. Trophy is already imported for
  // Achievements, so GraduationCap keeps the two distinguishable.
  { to: '/courses', label: 'My Journey', icon: GraduationCap },
  { to: '/map', label: 'World Map', icon: Map },
  { to: '/play', label: 'Playground', icon: Code2 },
  { to: '/games', label: 'Mini Games', icon: Gamepad2 },
  { to: '/quiz', label: 'Quiz Arena', icon: Brain },
  { to: '/avatar', label: 'Avatar', icon: Drama },
  { to: '/achievements', label: 'Achievements', icon: Trophy },
  // Certificates sit next to Achievements deliberately: both answer "what have
  // I actually earned", and a certificate is the one a child shows someone.
  { to: '/certificates', label: 'Certificates', icon: Award },
  { to: '/leaderboard', label: 'Leaderboard', icon: BarChart3 },
  { to: '/shop', label: 'Shop', icon: ShoppingBag },
  { to: '/profile', label: 'Profile', icon: UserCircle },
]

export default function StudentLayout() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [mobileOpen, setMobileOpen] = useState(false)

  /**
   * Escape closes the mobile drawer.
   *
   * It had none. The backdrop was the only way to dismiss it, and a backdrop
   * cannot be clicked with a keyboard — so a pupil who opened the menu on a
   * tablet was stuck in it. (The same bug existed in the admin portal.)
   */
  useEffect(() => {
    if (!mobileOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  // Live dashboard + avatar catalog drive the topbar.
  const { data: dashboard } = useGetDashboardQuery()
  const { data: catalog } = useGetAvatarItemsQuery()
  const { data: myAvatar } = useGetMyAvatarQuery()

  // Mirror the server's equipped avatar into the local cache.
  useEffect(() => {
    if (myAvatar?.avatar) dispatch(setEquipped(myAvatar.avatar))
  }, [myAvatar, dispatch])

  // Connect the shared Socket.IO client for the whole authed session so the
  // NotificationsBell receives live `notification` events everywhere. The
  // socket is a singleton, so this never opens a duplicate connection.
  useEffect(() => {
    if (!token) return
    connectSocket(token)
    return () => disconnectSocket()
  }, [token])

  const stats = buildStats(user, dashboard)
  // Prefer the server's equipped avatar (refreshes when an item is equipped)
  // and fall back to the auth user's snapshot.
  const avatarIcon = resolveAvatarIcon(
    myAvatar?.avatar ? { avatar: myAvatar.avatar } : user,
    catalog || []
  )

  // Organization the student belongs to (set when an admin creates the account).
  const orgName = user?.org?.name || null

  const handleLogout = async () => {
    disconnectSocket()
    await logout()
    navigate('/login')
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-6 pb-4 pt-6">
        <AnimatedIcon icon={KeyRound} size={28} animation="float" className="text-turmeric" glow />
        <div className="min-w-0">
          <div className="game-text text-lg font-bold leading-tight text-turmeric">Koding Keydzz</div>
          {orgName && (
            <div className="flex min-w-0 items-center gap-1 text-xs text-text-secondary" title={orgName}>
              <Building2 size={12} className="shrink-0" /> <span className="min-w-0 truncate">{orgName}</span>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 scrollbar-thin overflow-y-auto">
        {NAV.map((item, i) => (
          <motion.div
            key={item.to}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04, ease: [0.23, 1, 0.32, 1] }}
          >
          <NavLink
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-[background-color,color,box-shadow] duration-200 ${
                isActive
                  ? 'bg-turmeric text-malt font-bold shadow-golden-glow'
                  : 'text-text-secondary hover:bg-surface hover:text-turmeric'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="transition-transform duration-200 can-hover:group-hover:scale-125">
                  <AnimatedIcon
                    icon={item.icon}
                    size={20}
                    animation={isActive ? 'pulse' : 'none'}
                    glow={isActive}
                  />
                </span>
                <span className="game-text">{item.label}</span>
              </>
            )}
          </NavLink>
          </motion.div>
        ))}
      </nav>

      <button
        onClick={handleLogout}
        className="game-text group m-3 flex items-center gap-2 rounded-xl bg-surface px-4 py-3 text-sm text-text-secondary transition-colors hover:bg-error hover:text-white"
      >
        <span className="transition-transform group-hover:-translate-x-0.5">
          <LogOut size={18} />
        </span>
        Log Out
      </button>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-malt">
      {/*
        SKIP LINK — the first focusable thing on the page.
        A keyboard or screen-reader user should not have to tab through the
        whole sidebar to reach the lesson. Visually hidden until focused, then
        it appears: `sr-only` alone would make it a trap nobody can see.
        The HTML course teaches this, so the platform should demonstrate it.
      */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:border focus:border-turmeric focus:bg-malt focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-turmeric"
      >
        Skip to main content
      </a>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-k-border bg-card/60 backdrop-blur-md lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              className="fixed inset-y-0 left-0 z-50 w-64 border-r border-k-border bg-card lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-k-border bg-malt/80 px-4 py-3 backdrop-blur-md sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg bg-surface px-3 py-2 text-turmeric lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <div className="hidden flex-1 sm:block">
            <div className="max-w-xs">
              <XPBar xp={stats.xpIntoLevel} xpToNext={stats.xpLevelSpan} level={stats.level} earnHint />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {orgName && (
              <span
                className="hidden max-w-[12rem] items-center gap-1.5 truncate rounded-full border border-k-border bg-surface/70 px-3 py-1.5 text-xs text-text-secondary game-text md:flex"
                title={orgName}
              >
                <Building2 size={13} className="shrink-0" /> <span className="min-w-0 truncate">{orgName}</span>
              </span>
            )}
            <CoinCounter coins={stats.coins ?? 0} />
            <div className="hidden items-center gap-1.5 rounded-full border border-k-border bg-surface/70 px-3 py-1.5 sm:flex">
              <AnimatedIcon icon={Zap} size={14} animation="pulse" className="text-turmeric" />
              <span className="text-xs text-text-secondary game-text">Lvl</span>
              <span className="game-text font-bold text-turmeric">{stats.level ?? 1}</span>
            </div>
            <NotificationsBell />
            <NavLink to="/avatar">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 6 }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-turmeric to-accent text-xl shadow-golden-glow"
              >
                {avatarIcon}
              </motion.div>
            </NavLink>
          </div>
        </header>

        <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <Outlet />
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

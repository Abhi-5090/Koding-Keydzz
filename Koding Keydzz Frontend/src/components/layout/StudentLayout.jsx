import { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  LayoutDashboard,
  Map as MapIcon,
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
  Menu as MenuIcon,
  Zap,
  GraduationCap,
  Award,
  ClipboardList,
  ChevronRight,
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

/**
 * NAVIGATION, IN FOUR NAMED GROUPS.
 *
 * Thirteen destinations in one flat column asked a child to read the whole
 * list every time, and gave "Profile" the same weight as "My Journey". Worse,
 * on a laptop the last few sat below the fold, so the shop and the leaderboard
 * were effectively hidden behind a scroll a child had no reason to try.
 *
 * The groups are named for what a child is trying to DO, not for how the app
 * is built: you are learning, playing, collecting, or looking after your
 * account. Dashboard stays outside them — the one place everybody starts
 * should never be behind a disclosure.
 */
const NAV_GROUPS = [
  {
    label: null, // ungrouped, pinned to the top
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Learn',
    // Every group carries its own icon, so a collapsed header is still a row
    // with a picture on it rather than a bare word — the same shape as the
    // Dashboard link above it.
    icon: GraduationCap,
    items: [
      // First in the group on purpose: a pupil picks a language track, then
      // explores that course's worlds.
      { to: '/courses', label: 'My Journey', icon: GraduationCap },
      // Directly under it: if a teacher has set something, that is what a
      // pupil should be doing before they wander off to the games.
      { to: '/assignments', label: 'My Work', icon: ClipboardList },
      { to: '/map', label: 'World Map', icon: MapIcon },
      { to: '/play', label: 'Playground', icon: Code2 },
    ],
  },
  {
    label: 'Play',
    icon: Gamepad2,
    items: [
      { to: '/games', label: 'Mini Games', icon: Gamepad2 },
      { to: '/quiz', label: 'Quiz Arena', icon: Brain },
      { to: '/leaderboard', label: 'Leaderboard', icon: BarChart3 },
    ],
  },
  {
    label: 'Rewards',
    icon: Trophy,
    items: [
      { to: '/achievements', label: 'Achievements', icon: Trophy },
      // Next to Achievements deliberately: both answer "what have I actually
      // earned", and a certificate is the one a child shows someone.
      { to: '/certificates', label: 'Certificates', icon: Award },
      { to: '/shop', label: 'Shop', icon: ShoppingBag },
      { to: '/avatar', label: 'Avatar', icon: Drama },
    ],
  },
  {
    label: 'My account',
    icon: UserCircle,
    items: [
      { to: '/profile', label: 'Profile', icon: UserCircle },
      { to: '/change-password', label: 'Change password', icon: KeyRound },
    ],
  },
]

/**
 * ONE COLLAPSIBLE GROUP.
 *
 * WHY THE HEIGHT IS A CSS GRID TRANSITION AND NOT A FRAMER `height: auto`
 * ----------------------------------------------------------------------
 * The first version animated `height: 0 -> auto` with Framer Motion. That
 * forces a layout measurement on every frame, and because the measured target
 * changes as the rows inside settle, the whole column visibly jumps — the
 * flicker this replaces.
 *
 * `grid-template-rows: 0fr -> 1fr` on a wrapper whose child has `min-height: 0`
 * and `overflow: hidden` gives the browser a single interpolable value and no
 * measuring to do. It is one composited transition, it never overshoots, and it
 * needs no JavaScript at all.
 *
 * WHY HOVER AND OPEN USE DIFFERENT COLOURS
 * ----------------------------------------
 * They both used to go turmeric. So hovering an already-open group re-triggered
 * the same colour change, and moving the pointer across the list read as the
 * sidebar flashing. Hover is now a NEUTRAL lift — brighter text on a raised
 * surface — and the accent is reserved for state: this group is open, this page
 * is current. One meaning per colour.
 *
 * The header is a real <button> with `aria-expanded` and `aria-controls`,
 * because it toggles something: a styled heading leaves a keyboard or
 * screen-reader user facing a list that has quietly lost most of its links.
 */
function NavGroup({ group, open, onToggle, children }) {
  if (!group.label) return <div className="mb-1 space-y-1">{children}</div>

  const panelId = `student-nav-${group.label.replace(/\s+/g, '-').toLowerCase()}`
  const Icon = group.icon

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        /*
          The padding, gap, radius and type scale are the SAME as a nav link's,
          so a group header is a row of the same height rather than a small
          caption. That was the visual complaint: the categories read as
          different, lesser furniture than the Dashboard item.
        */
        className={`group/head flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[0.95rem] transition-[background-color,color] duration-200 ease-out ${
          open
            ? 'bg-turmeric/15 font-bold text-turmeric'
            : 'text-text-secondary hover:bg-surface hover:text-text-primary'
        }`}
      >
        {/*
          MIRRORS THE LINK'S ICON MARKUP EXACTLY — a plain inline span, NOT a
          flex box.
          
          This is the whole reason the headers were four pixels shorter. A link
          wraps its icon in an inline span, so the line box adds descender
          space and the span measures 26.8px around a 20px glyph. Wrapping the
          same icon in `flex items-center` collapses it to exactly 20px, and
          the header came out 46.8px against the link's 50.8px — the
          categories visibly sitting lower than the Dashboard row.
          
          Matching padding and font size was not enough; the rows have to be
          BUILT the same way.
        */}
        <span className="shrink-0">
          <AnimatedIcon icon={Icon} size={20} animation="none" />
        </span>
        {/* `game-text` belongs on the label, as it does on a link — putting it
            on the button gave the whole row a different typeface. */}
        <span className="game-text min-w-0 flex-1 truncate">{group.label}</span>
        {/*
          Rotated by CSS, not by an animated component: a transform transition
          on one property cannot cause a reflow, so it stays smooth even while
          the panel above or below it is opening.
        */}
        <ChevronRight
          size={16}
          strokeWidth={2.4}
          aria-hidden
          className={`shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none ${
            open ? 'rotate-90' : ''
          }`}
        />
      </button>

      <div
        id={panelId}
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        {/* `min-h-0` is what lets the 0fr row actually collapse. */}
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-1 pt-1">{children}</div>
        </div>
      </div>
    </div>
  )
}

export default function StudentLayout() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [mobileOpen, setMobileOpen] = useState(false)
  const reduceMotion = useReducedMotion()
  const { pathname } = useLocation()

  /**
   * WHICH GROUP IS OPEN — one at a time.
   *
   * Derived from the CURRENT ROUTE rather than remembered, for two reasons: a
   * deep link opens the right group on first paint, and navigating can never
   * leave a child staring at a sidebar that has closed around the page they
   * are on.
   */
  const groupKey = (group, index) => group.label || `top-${index}`

  /**
   * The group to open, given where the pupil is.
   *
   * Falling back to the FIRST LABELLED group matters more than it looks. The
   * dashboard is not inside any labelled group, so "open the group containing
   * the current page" left every one of them shut on the screen a child lands
   * on — a sidebar showing one link and four closed headings, which is worse
   * than the long list it replaced. Learn is open by default instead, because
   * that is where a pupil is going next.
   */
  const activeGroupKey = (() => {
    const index = NAV_GROUPS.findIndex((g) =>
      g.label && g.items.some((item) => pathname.startsWith(item.to))
    )
    if (index !== -1) return groupKey(NAV_GROUPS[index], index)
    const firstLabelled = NAV_GROUPS.findIndex((g) => g.label)
    return firstLabelled === -1 ? null : groupKey(NAV_GROUPS[firstLabelled], firstLabelled)
  })()

  const [openGroup, setOpenGroup] = useState(activeGroupKey)

  useEffect(() => {
    if (activeGroupKey) setOpenGroup(activeGroupKey)
  }, [activeGroupKey])

  // Clicking the open group closes it; clicking another swaps to it. That
  // single-open behaviour is the whole reason for collapsing in the first
  // place — two open groups is just the old long list again.
  const toggleGroup = (key) => setOpenGroup((current) => (current === key ? null : key))

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

      <nav className="flex-1 px-3 scrollbar-thin overflow-y-auto" aria-label="Main navigation">
        {NAV_GROUPS.map((group, gi) => (
          <NavGroup
            key={group.label || `top-${gi}`}
            group={group}
            open={openGroup === (group.label || `top-${gi}`)}
            onToggle={() => toggleGroup(group.label || `top-${gi}`)}
          >
            {group.items.map((item, i) => (
              <motion.div
                key={item.to}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04, ease: [0.23, 1, 0.32, 1] }}
              >
                <NavLink
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  /*
                    Hover is a NEUTRAL lift; the accent means state. Hover used
                    to go turmeric as well, so moving the pointer down the list
                    lit each row the same colour the active row already had —
                    which is what made the sidebar look like it was flashing.
                  */
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-xl px-4 py-3 text-[0.95rem] transition-[background-color,color,box-shadow] duration-200 ease-out ${
                      isActive
                        ? 'bg-turmeric text-malt font-bold shadow-golden-glow'
                        : 'text-text-secondary hover:bg-surface hover:text-text-primary'
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
          </NavGroup>
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
            <MenuIcon size={20} />
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
          {/*
            THE KEY IS THE WHOLE POINT.

            `AnimatePresence` decides a child has left by comparing keys. A bare
            `<Outlet />` is the same element with the same (absent) key on every
            route, so Framer never saw a change: the exit animation never ran,
            React swapped the page out in one frame, and the new page animated
            in from below. That hard swap followed by a slide is what read as
            flickering.

            Keyed on the pathname, `mode="wait"` plays the outgoing page out
            before the incoming one starts, and `initial={false}` stops the
            very first paint animating — arriving on the dashboard should not
            look like a navigation.
          */}
          <AnimatePresence mode="wait" initial={false}>
            <div key={pathname} className="h-full">
              <Outlet />
            </div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

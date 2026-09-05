import { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import StudentLayout from '../components/layout/StudentLayout'
import ProtectedRoute from './ProtectedRoute'
import { lazyWithRetry as lazy, RouteErrorBoundary } from './lazyWithRetry'

/**
 * ROUTE SPLITTING
 *
 * Everything below the landing/login pair is lazy-loaded.
 *
 * Previously every page and all thirteen mini-games were imported eagerly, so
 * the first screen a child saw had to download the entire application — a
 * ~395 kB main chunk. On a shared school connection with thirty devices
 * starting a lesson at once, that is the difference between the class
 * beginning on time and not.
 *
 * Landing and Login stay eager: they are the entry points, and lazy-loading
 * them would only add a spinner to the very first paint.
 *
 * Each chunk is fetched when a child taps a link, so a stuttering school
 * connection can lose one. `lazyWithRetry` retries the import before giving
 * up, and RouteErrorBoundary below turns whatever still fails into a "try
 * again" button instead of the white screen React would otherwise render.
 */

// Public pages (eager — first paint).
import Landing from '../pages/Landing'
import Login from '../pages/Login'

// Student pages.
const Dashboard = lazy(() => import('../pages/Dashboard'))
const Courses = lazy(() => import('../pages/Courses'))
const FinalTest = lazy(() => import('../pages/FinalTest'))
const WorldMap = lazy(() => import('../pages/WorldMap'))
const CourseMap = lazy(() => import('../pages/CourseMap'))
const ChangePassword = lazy(() => import('../pages/ChangePassword'))
const WorldDetail = lazy(() => import('../pages/WorldDetail'))
const Quiz = lazy(() => import('../pages/Quiz'))
const Achievements = lazy(() => import('../pages/Achievements'))
const Leaderboard = lazy(() => import('../pages/Leaderboard'))
const Shop = lazy(() => import('../pages/Shop'))
const Profile = lazy(() => import('../pages/Profile'))
const Certificates = lazy(() => import('../pages/Certificates'))
const Assignments = lazy(() => import('../pages/Assignments'))
const Family = lazy(() => import('../pages/Family'))
const VerifyCertificate = lazy(() => import('../pages/VerifyCertificate'))
const Avatar = lazy(() => import('../pages/Avatar'))

// Heavy editor.
const Playground = lazy(() => import('../pages/Playground'))

// Mini-games hub + individual games. Each game carries its own level data and
// engine, so splitting them is where most of the saving comes from.
const GamesHub = lazy(() => import('../pages/games/GamesHub'))
const MazeCoding = lazy(() => import('../pages/games/MazeCoding'))
const RobotNavigation = lazy(() => import('../pages/games/RobotNavigation'))
const TreasureHunt = lazy(() => import('../pages/games/TreasureHunt'))
const BugFixChallenge = lazy(() => import('../pages/games/BugFixChallenge'))
const SpaceAdventure = lazy(() => import('../pages/games/SpaceAdventure'))
const CodingBattleArena = lazy(() => import('../pages/games/CodingBattleArena'))
const LogicPuzzleKingdom = lazy(() => import('../pages/games/LogicPuzzleKingdom'))
const Sudoku = lazy(() => import('../pages/games/Sudoku'))
const TicTacToe = lazy(() => import('../pages/games/TicTacToe'))
const NQueens = lazy(() => import('../pages/games/NQueens'))
const TowersOfHanoi = lazy(() => import('../pages/games/TowersOfHanoi'))
const Zip = lazy(() => import('../pages/games/Zip'))
const Patches = lazy(() => import('../pages/games/Patches'))

function PageLoader() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-12 w-12 animate-spin rounded-full border-4 border-k-border border-t-turmeric"
          role="status"
          aria-label="Loading"
        />
        <p className="game-text text-text-secondary">Loading adventure...</p>
      </div>
    </div>
  )
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      {/* Public sign-up is disabled — students are added by their organization. */}
      <Route path="/register" element={<Navigate to="/login" replace />} />

      {/*
        PUBLIC certificate verification, and it must stay public.
        The whole point of a code printed on a certificate is that someone who
        does not have an account — a parent, a grandparent, another school — can
        confirm the award is real. Putting this behind the login would make the
        code useless. The endpoint returns the achievement and nothing else.
        Both forms are routed: a bare page to type a code into, and a direct
        link (or QR code) that carries one.
      */}
      <Route
        path="/verify"
        element={
          <RouteErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <VerifyCertificate />
            </Suspense>
          </RouteErrorBoundary>
        }
      />
      <Route
        path="/verify/:code"
        element={
          <RouteErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <VerifyCertificate />
            </Suspense>
          </RouteErrorBoundary>
        }
      />

      {/*
        THE FAMILY VIEW. Authenticated, but deliberately outside StudentLayout:
        a parent should not be given a pupil's sidebar, XP bar or avatar. It has
        its own header and its own sign-out.
      */}
      <Route
        path="/family"
        element={
          <ProtectedRoute>
            <RouteErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Family />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        }
      />

      {/* Protected student area. One Suspense boundary around the layout's
          Outlet covers every lazy child, so the sidebar and topbar stay put
          while the page itself loads. */}
      <Route
        element={
          <ProtectedRoute>
            <RouteErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <StudentLayout />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        {/* The course ladder: Python -> C -> HTML -> AI. Sits before the map
            because a pupil picks a track first, then explores its worlds. */}
        <Route path="/courses" element={<Courses />} />
        {/* The exam that gates the ladder. Nested under the course it belongs
            to, so the slug is unambiguous and a bookmark still makes sense. */}
        <Route path="/courses/:slug/final-test" element={<FinalTest />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/map" element={<WorldMap />} />
        {/* One realm's worlds. `/map` is the four realms; this is inside one. */}
        <Route path="/map/:courseSlug" element={<CourseMap />} />
        <Route path="/world/:slug" element={<WorldDetail />} />
        <Route path="/play" element={<Playground />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/achievements" element={<Achievements />} />
        {/* Work a teacher has set. Read-only: completion comes from the
            pupil's own progress, so there is nothing to submit here. */}
        <Route path="/assignments" element={<Assignments />} />
        <Route path="/certificates" element={<Certificates />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/avatar" element={<Avatar />} />

        {/* Mini Games */}
        <Route path="/games" element={<GamesHub />} />
        <Route path="/games/maze-coding" element={<MazeCoding />} />
        <Route path="/games/robot-navigation" element={<RobotNavigation />} />
        <Route path="/games/treasure-hunt" element={<TreasureHunt />} />
        <Route path="/games/bug-fix" element={<BugFixChallenge />} />
        <Route path="/games/space-adventure" element={<SpaceAdventure />} />
        <Route path="/games/battle-arena" element={<CodingBattleArena />} />
        <Route path="/games/logic-puzzle" element={<LogicPuzzleKingdom />} />
        <Route path="/games/tic-tac-toe" element={<TicTacToe />} />
        <Route path="/games/sudoku" element={<Sudoku />} />
        <Route path="/games/n-queens" element={<NQueens />} />
        <Route path="/games/towers-of-hanoi" element={<TowersOfHanoi />} />
        <Route path="/games/zip" element={<Zip />} />
        <Route path="/games/patches" element={<Patches />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

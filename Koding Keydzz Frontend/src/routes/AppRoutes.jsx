import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import StudentLayout from '../components/layout/StudentLayout'
import ProtectedRoute from './ProtectedRoute'

// Public pages
import Landing from '../pages/Landing'
import Login from '../pages/Login'

// Student pages
import Dashboard from '../pages/Dashboard'
import WorldMap from '../pages/WorldMap'
import WorldDetail from '../pages/WorldDetail'
import Quiz from '../pages/Quiz'
import Achievements from '../pages/Achievements'
import Leaderboard from '../pages/Leaderboard'
import Shop from '../pages/Shop'
import Profile from '../pages/Profile'
import Avatar from '../pages/Avatar'

// Mini-games hub + individual games.
import GamesHub from '../pages/games/GamesHub'
import MazeCoding from '../pages/games/MazeCoding'
import RobotNavigation from '../pages/games/RobotNavigation'
import TreasureHunt from '../pages/games/TreasureHunt'
import BugFixChallenge from '../pages/games/BugFixChallenge'
import SpaceAdventure from '../pages/games/SpaceAdventure'
import CodingBattleArena from '../pages/games/CodingBattleArena'
import LogicPuzzleKingdom from '../pages/games/LogicPuzzleKingdom'
import Sudoku from '../pages/games/Sudoku'
import NQueens from '../pages/games/NQueens'
import TowersOfHanoi from '../pages/games/TowersOfHanoi'
import Zip from '../pages/games/Zip'

// Heavy editor — lazy loaded.
const Playground = lazy(() => import('../pages/Playground'))

function PageLoader() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-k-border border-t-turmeric" />
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

      {/* Protected student area */}
      <Route
        element={
          <ProtectedRoute>
            <StudentLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/map" element={<WorldMap />} />
        <Route path="/world/:slug" element={<WorldDetail />} />
        <Route
          path="/play"
          element={
            <Suspense fallback={<PageLoader />}>
              <Playground />
            </Suspense>
          }
        />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/achievements" element={<Achievements />} />
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
        <Route path="/games/sudoku" element={<Sudoku />} />
        <Route path="/games/n-queens" element={<NQueens />} />
        <Route path="/games/towers-of-hanoi" element={<TowersOfHanoi />} />
        <Route path="/games/zip" element={<Zip />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

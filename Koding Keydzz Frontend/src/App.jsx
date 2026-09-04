import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './routes/AppRoutes'
import { useGsapPreload } from './motion/hooks'

export default function App() {
  // Warm the GSAP chunk while the browser is idle. Without this the FIRST
  // animation a child triggers — usually the level-complete overlay, the one
  // moment that most needs to feel immediate — is also the one waiting on a
  // 112 kB download. Skipped entirely under prefers-reduced-motion, so a
  // device that will not animate never spends the school's bandwidth on it.
  useGsapPreload()

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

import AppRoutes from './routes/AppRoutes';
import { useGsapPreload } from './motion/hooks';

export default function App() {
  // Warm the GSAP chunk while the browser is idle, so the first dashboard a
  // user opens is not the one waiting on a 112 kB download. Skipped entirely
  // under prefers-reduced-motion.
  useGsapPreload();

  return <AppRoutes />;
}

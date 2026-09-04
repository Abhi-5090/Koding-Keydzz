import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Mail, Lock } from 'lucide-react';
import { useLoginMutation } from '../features/auth/authApi';
import { setCredentials, PORTAL_ROLES } from '../features/auth/authSlice';
import Button from '../components/ui/Button';
import { formatApiError } from '../utils/apiError';

const homeForRole = (role) => (role === 'superadmin' ? '/superadmin' : '/dashboard');

/*
 * PORTAL_ROLES is imported from authSlice so this gate and the route guard
 * can never disagree.
 *
 * Faculty were previously rejected here with "This portal is for
 * administrators only" — the gate was written when the only staff role was
 * `admin` and was not revisited when teachers were introduced, so every
 * teacher account was unusable despite being valid server-side. The route
 * guard had the same omission, which would have bounced them in a redirect
 * loop even if login had let them through.
 */

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [login, { isLoading }] = useLoginMutation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = await login({ email, password }).unwrap();
      const user = data.user || data;
      if (!PORTAL_ROLES.includes(user?.role)) {
        setError(
          user?.role === 'student'
            ? 'This is the staff portal. Students sign in on the Koding Keydzz learning app.'
            : 'This account does not have access to the staff portal.'
        );
        return;
      }
      dispatch(
        setCredentials({
          user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        })
      );
      navigate(homeForRole(user.role), { replace: true });
    } catch (err) {
      if (err?.status === 'FETCH_ERROR' || err?.status === 'TIMEOUT_ERROR') {
        setError('Could not reach the server. Please try again.');
        return;
      }
      setError(formatApiError(err, 'Invalid email or password.'));
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-malt p-4">
      {/* glow backdrop */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-turmeric/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-turmeric font-heading text-3xl font-extrabold text-malt shadow-glow">
            K
          </div>
          <h1 className="font-heading text-2xl font-extrabold text-text-primary">
            Koding Keydzz Admin
          </h1>
          <p className="mt-1 text-sm text-text-secondary/80">
            Sign in to manage the gaming platform
          </p>
        </div>

        <div className="k-card p-7">
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-k-border bg-malt/50 px-4 py-3 text-xs text-text-secondary">
            <ShieldCheck size={16} className="text-turmeric" />
            Administrator access only
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* htmlFor + id: these labels were previously siblings of their
                inputs with no association at all, so a screen reader could not
                announce either field and clicking a label did not focus its
                input. Caught by the browser test suite. */}
            <div>
              <label className="k-label" htmlFor="login-email">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/70"
                  aria-hidden="true"
                />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="k-input pl-9"
                  placeholder="admin@kodingkeydzz.com"
                />
              </div>
            </div>

            <div>
              <label className="k-label" htmlFor="login-password">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/70"
                  aria-hidden="true"
                />
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="k-input pl-9"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error"
              >
                {error}
              </motion.p>
            )}

            <Button type="submit" className="w-full" size="lg" loading={isLoading}>
              Sign In
            </Button>

            {/* Staff can now recover their own account. Before this, a teacher
                who forgot their password had to find an administrator, and a
                locked-out superadmin needed shell access to the host. */}
            <Link
              to="/forgot-password"
              className="block w-full rounded-lg py-1 text-center text-sm font-semibold text-text-secondary transition hover:text-turmeric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric/40"
            >
              Forgot your password?
            </Link>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

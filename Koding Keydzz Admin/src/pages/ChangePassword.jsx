import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { KeyRound, Lock, ShieldCheck, Check } from 'lucide-react';
import { useChangePasswordMutation } from '../features/auth/authApi';
import {
  setCredentials,
  selectMustChangePassword,
  selectRole,
} from '../features/auth/authSlice';
import Button from '../components/ui/Button';
import { formatApiError } from '../utils/apiError';

/**
 * CHANGE YOUR OWN PASSWORD — and, for a new account, the last step of joining.
 *
 * Staff are created with a temporary password chosen by whoever created them,
 * and flagged `mustChangePassword`. Until this screen existed the flag was
 * unsatisfiable: there was no endpoint to change a password, so a teacher's
 * account kept the administrator's chosen password for ever.
 *
 * The screen serves two situations and says which one it is in:
 *
 *   • FORCED — the account cannot use the rest of the product yet. The server
 *     refuses it on every route but four, so this is the only page it can
 *     reach and there is no cancel.
 *   • VOLUNTARY — reached from the account menu. Cancel returns to the
 *     dashboard.
 */

const homeForRole = (role) =>
  role === 'superadmin' ? '/superadmin' : '/dashboard';

/** The floor the server applies, mirrored so the message arrives before the request. */
const MIN_LENGTH = { student: 6 };
const minFor = (role) => MIN_LENGTH[role] ?? 8;

export default function ChangePassword() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const forced = useSelector(selectMustChangePassword);
  const role = useSelector(selectRole);
  const [changePassword, { isLoading }] = useChangePasswordMutation();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const min = minFor(role);

  // Checked here as well as on the server so the user is told before the
  // round trip, not after it.
  const tooShort = newPassword.length > 0 && newPassword.length < min;
  const mismatch = confirm.length > 0 && confirm !== newPassword;
  const sameAsOld =
    newPassword.length > 0 &&
    currentPassword.length > 0 &&
    newPassword === currentPassword;
  const ready =
    currentPassword.length > 0 &&
    newPassword.length >= min &&
    confirm === newPassword &&
    !sameAsOld;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = await changePassword({
        currentPassword,
        newPassword,
      }).unwrap();
      /**
       * The change revoked every session, including the token that made this
       * request. The response carries a replacement pair, and storing it is
       * what keeps the user signed in — without this the next request 401s and
       * they are bounced to the login form having just proved who they are.
       */
      dispatch(
        setCredentials({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        }),
      );
      navigate(homeForRole(data.user?.role || role), { replace: true });
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md rounded-2xl border border-k-border bg-card p-7 shadow-lg"
      >
        <div className="mb-6 flex items-start gap-3">
          <span className="rounded-xl bg-turmeric/15 p-2.5 text-turmeric">
            <KeyRound size={22} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-text-primary">
              {forced ? 'Set your own password' : 'Change your password'}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {forced
                ? 'Your account was created with a temporary password. Choose your own before you continue — whoever set it up knows the old one.'
                : 'You will stay signed in here. Every other device will be signed out.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="current-password"
              className="mb-1.5 block text-sm font-semibold text-text-primary"
            >
              {forced ? 'Temporary password' : 'Current password'}
            </label>
            <div className="relative">
              <Lock
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
              />
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-k-border bg-surface py-2.5 pl-9 pr-3 text-text-primary placeholder:text-text-secondary/70 focus:border-turmeric focus:outline-none focus:ring-2 focus:ring-turmeric/40"
                placeholder="The password you signed in with"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="new-password"
              className="mb-1.5 block text-sm font-semibold text-text-primary"
            >
              New password
            </label>
            <div className="relative">
              <ShieldCheck
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
              />
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                aria-describedby="new-password-hint"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-k-border bg-surface py-2.5 pl-9 pr-3 text-text-primary placeholder:text-text-secondary/70 focus:border-turmeric focus:outline-none focus:ring-2 focus:ring-turmeric/40"
                placeholder={`At least ${min} characters`}
              />
            </div>
            <p
              id="new-password-hint"
              className="mt-1.5 text-xs text-text-secondary"
            >
              {tooShort
                ? `Needs at least ${min} characters.`
                : sameAsOld
                  ? 'This is the password you already have — choose a different one.'
                  : `At least ${min} characters. Not the one you were given.`}
            </p>
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="mb-1.5 block text-sm font-semibold text-text-primary"
            >
              Confirm new password
            </label>
            <div className="relative">
              <Check
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
              />
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-k-border bg-surface py-2.5 pl-9 pr-3 text-text-primary placeholder:text-text-secondary/70 focus:border-turmeric focus:outline-none focus:ring-2 focus:ring-turmeric/40"
                placeholder="Type it again"
              />
            </div>
            {mismatch ? (
              <p className="mt-1.5 text-xs font-semibold text-red-500">
                These two do not match.
              </p>
            ) : null}
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500"
            >
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={!ready || isLoading}
            className="w-full"
          >
            {isLoading
              ? 'Saving…'
              : forced
                ? 'Set password and continue'
                : 'Change password'}
          </Button>

          {!forced ? (
            <button
              type="button"
              onClick={() => navigate(homeForRole(role))}
              className="w-full rounded-lg py-2 text-sm font-semibold text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric/40"
            >
              Cancel
            </button>
          ) : null}
        </form>
      </motion.div>
    </div>
  );
}

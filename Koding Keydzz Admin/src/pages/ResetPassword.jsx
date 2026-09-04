import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Check, AlertTriangle } from 'lucide-react';
import Button from '../components/ui/Button';
import { baseApi } from '../app/api/baseApi';
import { formatApiError } from '../utils/apiError';

/**
 * SET A NEW PASSWORD FROM A RESET LINK.
 *
 * The link is inspected BEFORE the form is shown, so a stale or spent link
 * explains itself instead of letting somebody type a password twice and then
 * be told it was pointless.
 *
 * Three outcomes, kept distinct on purpose:
 *   • valid    — show the form.
 *   • used     — "already used". Someone clicked the link twice, or a mail
 *                scanner followed it. Not an error to hunt for.
 *   • invalid  — includes expired. Ask for a new one.
 *
 * Distinguishing these is safe: by the time somebody holds a token, none of the
 * three answers reveals whether any particular address has an account. That is
 * the opposite of the request screen, which must reveal nothing at all.
 */
export const resetPasswordApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    inspectPasswordReset: builder.query({
      query: (token) => ({ url: '/auth/password-reset/inspect', params: { token } }),
      transformResponse: (res) => res?.data || res,
    }),
    completePasswordReset: builder.mutation({
      query: (body) => ({ url: '/auth/password-reset/complete', method: 'POST', body }),
      transformResponse: (res) => res?.data || res,
    }),
  }),
});

const { useInspectPasswordResetQuery, useCompletePasswordResetMutation } = resetPasswordApi;

const MIN_LENGTH = 8;

function Explain({ title, body }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-error/40 bg-error/5 p-4">
        <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-error" />
        <div>
          <p className="font-semibold text-text-primary">{title}</p>
          <p className="mt-1 text-sm text-text-secondary">{body}</p>
        </div>
      </div>
      <Link
        to="/forgot-password"
        className="block w-full rounded-lg bg-turmeric py-2.5 text-center font-bold text-malt transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric/40"
      >
        Request a new link
      </Link>
      <Link
        to="/login"
        className="block w-full rounded-lg py-2 text-center text-sm font-semibold text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric/40"
      >
        Back to sign in
      </Link>
    </div>
  );
}

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const { data: inspection, isLoading: inspecting } = useInspectPasswordResetQuery(token, {
    skip: !token,
  });
  const [completeReset, { isLoading: saving }] = useCompletePasswordResetMutation();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== password;
  const ready = password.length >= MIN_LENGTH && confirm === password;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await completeReset({ token, newPassword: password }).unwrap();
      setDone(true);
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
            {done ? (
              <Check size={22} aria-hidden="true" />
            ) : (
              <ShieldCheck size={22} aria-hidden="true" />
            )}
          </span>
          <div>
            <h1 className="text-xl font-bold text-text-primary">
              {done ? 'Password set' : 'Choose a new password'}
            </h1>
            {!done ? (
              <p className="mt-1 text-sm text-text-secondary">
                Setting this signs you out everywhere else, which is the point if you think
                someone else had your old one.
              </p>
            ) : null}
          </div>
        </div>

        {done ? (
          <div className="space-y-4">
            <p className="rounded-xl bg-success/10 p-3 text-sm text-text-primary">
              Your password has been changed and every other session has been signed out.
            </p>
            <Button className="w-full" onClick={() => navigate('/login', { replace: true })}>
              Sign in
            </Button>
          </div>
        ) : !token ? (
          <Explain
            title="This page needs a reset link"
            body="Open the link from your email, or ask for a new one."
          />
        ) : inspecting ? (
          <p className="text-sm text-text-secondary" role="status">
            Checking your link…
          </p>
        ) : inspection && !inspection.valid ? (
          <Explain
            title={
              inspection.reason === 'used'
                ? 'That link has already been used'
                : 'That link is no longer valid'
            }
            body={
              inspection.reason === 'used'
                ? 'Reset links work once. If you did not use it, a mail scanner may have followed it for you — request a new one.'
                : 'Reset links expire after 30 minutes. Request a new one and use it straight away.'
            }
          />
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            {inspection?.name ? (
              <p className="text-sm text-text-secondary">
                Resetting the password for <strong>{inspection.name}</strong>.
              </p>
            ) : null}

            <div>
              <label
                htmlFor="new-password"
                className="mb-1.5 block text-sm font-semibold text-text-primary"
              >
                New password
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                aria-describedby="new-password-hint"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`At least ${MIN_LENGTH} characters`}
                className="w-full rounded-lg border border-k-border bg-surface px-3 py-2.5 text-text-primary placeholder:text-text-secondary/70 focus:border-turmeric focus:outline-none focus:ring-2 focus:ring-turmeric/40"
              />
              <p id="new-password-hint" className="mt-1.5 text-xs text-text-secondary">
                {tooShort
                  ? `Needs at least ${MIN_LENGTH} characters.`
                  : `At least ${MIN_LENGTH} characters — the same floor staff accounts are created with.`}
              </p>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="mb-1.5 block text-sm font-semibold text-text-primary"
              >
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-k-border bg-surface px-3 py-2.5 text-text-primary focus:border-turmeric focus:outline-none focus:ring-2 focus:ring-turmeric/40"
              />
              {mismatch ? (
                <p className="mt-1.5 text-xs font-semibold text-error">
                  These two do not match.
                </p>
              ) : null}
            </div>

            {error ? (
              <p role="alert" className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={!ready || saving} className="w-full">
              {saving ? 'Saving…' : 'Set password'}
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

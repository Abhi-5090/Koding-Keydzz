import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { KeyRound, Mail, MailCheck } from 'lucide-react';
import Button from '../components/ui/Button';
import { baseApi } from '../app/api/baseApi';

/**
 * ASK FOR A RESET LINK.
 *
 * Every password reset used to be somebody else doing it for you: a superadmin
 * reset an admin, an admin reset a teacher. A teacher who forgot theirs had to
 * find an administrator, and a locked-out superadmin needed shell access to the
 * production host.
 *
 * THE SCREEN DELIBERATELY TELLS YOU NOTHING
 * -----------------------------------------
 * Whatever happens on the server — unknown address, a pupil's address, a
 * suspended account, mail switched off entirely — the answer is identical. A
 * form that says "no such account" is a free tool for discovering which of a
 * school's staff addresses are real, which is the first step of a phishing
 * campaign aimed at exactly the people who can reset children's passwords.
 *
 * So the success state is shown for ANY accepted submission, and the copy is
 * written to be true in every case rather than implying a link was definitely
 * sent.
 */
export const forgotPasswordApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    requestPasswordReset: builder.mutation({
      query: (body) => ({ url: '/auth/password-reset/request', method: 'POST', body }),
    }),
  }),
});

const { useRequestPasswordResetMutation } = forgotPasswordApi;

export default function ForgotPassword() {
  const [requestReset, { isLoading }] = useRequestPasswordResetMutation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await requestReset({ email }).unwrap();
    } catch {
      /**
       * Even a failure shows the success state.
       *
       * The endpoint answers 200 for every accepted request, so the only errors
       * reachable here are a malformed address (the form already blocks that)
       * or the network. Surfacing a server error would leak the distinction
       * this whole flow exists to hide.
       */
    }
    setSent(true);
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
            {sent ? (
              <MailCheck size={22} aria-hidden="true" />
            ) : (
              <KeyRound size={22} aria-hidden="true" />
            )}
          </span>
          <div>
            <h1 className="text-xl font-bold text-text-primary">
              {sent ? 'Check your email' : 'Forgot your password?'}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {sent
                ? 'If that address belongs to a staff account, a reset link is on its way. It works once and expires in 30 minutes.'
                : 'Enter the email address you sign in with and we will send you a link to set a new password.'}
            </p>
          </div>
        </div>

        {sent ? (
          <div className="space-y-4">
            <p className="rounded-xl bg-surface/60 p-3 text-sm text-text-secondary">
              Nothing arrived? Check the spam folder first. Pupils do not receive reset
              emails — a pupil&apos;s password is reset by their teacher, which is
              deliberate.
            </p>
            <Link
              to="/login"
              className="block w-full rounded-lg bg-turmeric py-2.5 text-center font-bold text-malt transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric/40"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="reset-email"
                className="mb-1.5 block text-sm font-semibold text-text-primary"
              >
                Email address
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
                />
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.example"
                  className="w-full rounded-lg border border-k-border bg-surface py-2.5 pl-9 pr-3 text-text-primary placeholder:text-text-secondary/70 focus:border-turmeric focus:outline-none focus:ring-2 focus:ring-turmeric/40"
                />
              </div>
            </div>

            <Button type="submit" disabled={!email.includes('@') || isLoading} className="w-full">
              {isLoading ? 'Sending…' : 'Send reset link'}
            </Button>

            <Link
              to="/login"
              className="block w-full rounded-lg py-2 text-center text-sm font-semibold text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric/40"
            >
              Back to sign in
            </Link>
          </form>
        )}
      </motion.div>
    </div>
  );
}

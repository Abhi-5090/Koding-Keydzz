import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { KeyRound, Eye, EyeOff, CheckCircle2, ArrowLeft } from 'lucide-react'
import { useChangePasswordMutation } from '../features/auth/authApi'
import PageTransition from '../components/layout/PageTransition'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import AnimatedIcon from '../components/ui/AnimatedIcon'
import { formatApiError } from '../utils/apiError'

const EASE_OUT = [0.23, 1, 0.32, 1]

/** The server's floor. Stated here so the form can say so before submitting. */
const MIN_LENGTH = 6

/**
 * CHANGE YOUR OWN PASSWORD.
 *
 * A pupil could not do this. Their password was set by whoever created the
 * account — a teacher, or a bulk upload — and there was no screen anywhere in
 * the pupil app to change it. On a shared classroom machine that means a
 * password a child cannot change is known to at least one other person, and
 * possibly to a whole spreadsheet.
 *
 * WHY THE CURRENT PASSWORD IS REQUIRED
 * ------------------------------------
 * The server demands it, and this form asks for it rather than hiding the
 * requirement: on the machines this runs on, a session left signed in is the
 * normal case, not the exception. Without it, walking up to an unattended
 * laptop would be enough to lock a classmate out of their own account.
 */
export default function ChangePassword() {
  const navigate = useNavigate()
  const [changePassword, { isLoading }] = useChangePasswordMutation()

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [reveal, setReveal] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  /**
   * Checked here as well as on the server, because catching a typo before the
   * round trip is kinder than a rejection afterwards — never INSTEAD of the
   * server, which remains the thing that decides.
   */
  const tooShort = form.newPassword.length > 0 && form.newPassword.length < MIN_LENGTH
  const mismatch = form.confirm.length > 0 && form.newPassword !== form.confirm
  const unchanged =
    form.newPassword.length > 0 && form.newPassword === form.currentPassword
  const ready =
    form.currentPassword.length > 0 &&
    form.newPassword.length >= MIN_LENGTH &&
    form.newPassword === form.confirm &&
    !unchanged

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!ready) return
    try {
      await changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      }).unwrap()
      setDone(true)
      setForm({ currentPassword: '', newPassword: '', confirm: '' })
    } catch (err) {
      // The server's own words — "your current password is wrong" is something
      // only it can tell us.
      setError(formatApiError(err, 'Could not change your password. Please try again.'))
    }
  }

  if (done) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-md">
          <Card className="p-8 text-center">
            <div className="mb-4 flex justify-center">
              <AnimatedIcon icon={CheckCircle2} size={56} animation="pop" className="text-success" glow />
            </div>
            <h1 className="font-heading mb-2 text-2xl font-extrabold">Password changed</h1>
            <p className="mb-6 text-sm text-text-secondary">
              Your new password is saved. Use it the next time you sign in.
            </p>
            <Button onClick={() => navigate('/profile')} className="w-full">
              Back to my profile
            </Button>
          </Card>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-md">
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="game-text mb-4 inline-flex items-center gap-2 rounded-xl border border-k-border bg-surface/60 px-3 py-2 text-sm text-text-secondary transition-colors can-hover:hover:text-turmeric"
        >
          <ArrowLeft size={16} /> My profile
        </button>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
        >
          <Card className="p-7">
            <div className="mb-5 flex items-center gap-3">
              <AnimatedIcon icon={KeyRound} size={28} animation="float" className="text-turmeric" glow />
              <div>
                <h1 className="font-heading text-2xl font-extrabold">Change my password</h1>
                <p className="text-sm text-text-secondary">
                  Pick something only you know — at least {MIN_LENGTH} characters.
                </p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="cp-current"
                  className="game-text mb-1.5 block text-sm font-semibold text-text-primary"
                >
                  Current password
                </label>
                <input
                  id="cp-current"
                  name="currentPassword"
                  type={reveal ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.currentPassword}
                  onChange={(e) => set({ currentPassword: e.target.value })}
                  className="w-full rounded-xl border border-k-border bg-surface px-3 py-2.5 text-text-primary focus:border-turmeric focus:outline-none focus:ring-2 focus:ring-turmeric/40"
                />
              </div>

              <div>
                <label
                  htmlFor="cp-new"
                  className="game-text mb-1.5 block text-sm font-semibold text-text-primary"
                >
                  New password
                </label>
                <div className="relative">
                  <input
                    id="cp-new"
                    name="newPassword"
                    type={reveal ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.newPassword}
                    onChange={(e) => set({ newPassword: e.target.value })}
                    aria-describedby="cp-new-help"
                    className="w-full rounded-xl border border-k-border bg-surface px-3 py-2.5 pr-11 text-text-primary focus:border-turmeric focus:outline-none focus:ring-2 focus:ring-turmeric/40"
                  />
                  {/*
                    A reveal toggle, not a strength meter. Children mistype
                    passwords far more often than they choose weak ones, and
                    being able to SEE what you typed fixes the common problem.
                  */}
                  <button
                    type="button"
                    onClick={() => setReveal((v) => !v)}
                    aria-label={reveal ? 'Hide passwords' : 'Show passwords'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-text-secondary transition-colors can-hover:hover:text-turmeric"
                  >
                    {reveal ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p id="cp-new-help" className="mt-1.5 text-xs text-text-secondary">
                  {tooShort
                    ? `A bit longer — at least ${MIN_LENGTH} characters.`
                    : unchanged
                      ? 'That is the password you already have.'
                      : `At least ${MIN_LENGTH} characters.`}
                </p>
              </div>

              <div>
                <label
                  htmlFor="cp-confirm"
                  className="game-text mb-1.5 block text-sm font-semibold text-text-primary"
                >
                  Type it again
                </label>
                <input
                  id="cp-confirm"
                  name="confirm"
                  type={reveal ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={(e) => set({ confirm: e.target.value })}
                  className="w-full rounded-xl border border-k-border bg-surface px-3 py-2.5 text-text-primary focus:border-turmeric focus:outline-none focus:ring-2 focus:ring-turmeric/40"
                />
                {mismatch && (
                  <p className="mt-1.5 text-xs font-semibold text-error">
                    These two do not match yet.
                  </p>
                )}
              </div>

              {/*
                `role="alert"` so the failure is announced. A password form that
                fails silently leaves a child pressing the button again.
              */}
              {error && (
                <p role="alert" className="text-sm font-semibold text-error">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={!ready || isLoading} className="w-full">
                {isLoading ? 'Saving…' : 'Change my password'}
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    </PageTransition>
  )
}

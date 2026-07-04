import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { KeyRound, Swords } from 'lucide-react'
import { useLoginMutation } from '../features/auth/authApi'
import Particles from '../components/ui/Particles'
import FloatingShapes from '../components/ui/FloatingShapes'
import AnimatedIcon from '../components/ui/AnimatedIcon'
import Mascot from '../components/ui/Mascot'
import Button from '../components/ui/Button'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [login, { isLoading }] = useLoginMutation()

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')

  const from = location.state?.from?.pathname || '/dashboard'

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await login(form).unwrap()
      navigate(from, { replace: true })
    } catch (err) {
      if (err?.status === 'FETCH_ERROR') {
        setError('Could not reach the server. Please try again shortly.')
      } else {
        setError(err?.data?.message || 'Invalid email or password.')
      }
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-malt px-6 py-12">
      <div className="absolute inset-0 bg-gradient-to-br from-malt via-card to-malt" />
      <Particles count={24} />
      <FloatingShapes />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-6 flex justify-center">
          <Mascot size={96} message="Welcome back, hero! Ready to continue your quest?" />
        </div>

        <div className="rounded-3xl border border-k-border bg-card/90 p-8 shadow-golden-glow backdrop-blur-md">
          <Link to="/" className="game-text mb-2 flex items-center justify-center gap-2 text-center text-sm text-text-secondary hover:text-turmeric">
            <AnimatedIcon icon={KeyRound} size={16} className="text-turmeric" animation="hover" glow />
            Koding Keydzz
          </Link>
          <h1 className="mb-6 text-center font-heading text-3xl font-extrabold">Log In</h1>

          {error && (
            <div className="mb-4 rounded-xl border border-error/50 bg-error/10 px-4 py-2 text-center text-sm text-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="hero@example.com" />
            <Field label="Password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="••••••••" />

            <Button type="submit" size="lg" disabled={isLoading} className="w-full">
              {isLoading ? (
                'Entering...'
              ) : (
                <span className="inline-flex items-center justify-center gap-2">
                  <Swords size={18} /> Enter the Kingdom
                </span>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Your account is created by your school or organization.
            <br />
            Ask your teacher or admin if you need access.
          </p>
        </div>
      </motion.div>
    </div>
  )
}

function Field({ label, ...props }) {
  return (
    <label className="block">
      <span className="game-text mb-1 block text-sm text-text-secondary">{label}</span>
      <input
        {...props}
        required
        className="w-full rounded-xl border border-k-border bg-surface/60 px-4 py-3 text-text-primary outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-text-secondary/50 focus:border-turmeric focus:shadow-golden-glow"
      />
    </label>
  )
}

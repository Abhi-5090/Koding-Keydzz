import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { KeyRound } from 'lucide-react'
import { useRegisterStudentMutation } from '../features/auth/authApi'
import Particles from '../components/ui/Particles'
import FloatingShapes from '../components/ui/FloatingShapes'
import AnimatedIcon from '../components/ui/AnimatedIcon'
import Mascot from '../components/ui/Mascot'
import Button from '../components/ui/Button'

export default function Register() {
  const navigate = useNavigate()
  const [registerStudent, { isLoading }] = useRegisterStudentMutation()

  const [form, setForm] = useState({ name: '', grade: '', school: '', email: '', password: '' })
  const [error, setError] = useState('')

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await registerStudent(form).unwrap()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      if (err?.status === 'FETCH_ERROR') {
        setError('Could not reach the server. Please try again shortly.')
      } else {
        setError(err?.data?.message || 'Could not create your account. Try again.')
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
          <Mascot size={96} message="A new hero! Let's set up your adventure." />
        </div>

        <div className="rounded-3xl border border-k-border bg-card/90 p-8 shadow-golden-glow backdrop-blur-md">
          <Link to="/" className="game-text mb-2 flex items-center justify-center gap-2 text-center text-sm text-text-secondary hover:text-turmeric">
            <AnimatedIcon icon={KeyRound} size={16} className="text-turmeric" animation="hover" glow />
            Koding Keydzz
          </Link>
          <h1 className="mb-6 text-center font-heading text-3xl font-extrabold">Create Your Hero</h1>

          {error && (
            <div className="mb-4 rounded-xl border border-error/50 bg-error/10 px-4 py-2 text-center text-sm text-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Hero Name" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Arya the Explorer" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Grade" name="grade" value={form.grade} onChange={handleChange} placeholder="e.g. 5" />
              <Field label="School" name="school" value={form.school} onChange={handleChange} placeholder="Your school" />
            </div>
            <Field label="Email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="hero@example.com" />
            <Field label="Password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="••••••••" />

            <Button type="submit" size="lg" disabled={isLoading} className="w-full">
              {isLoading ? (
                'Creating...'
              ) : (
                <span className="inline-flex items-center justify-center gap-2">
                  <KeyRound size={18} /> Start My Adventure
                </span>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Already a hero?{' '}
            <Link to="/login" className="game-text font-bold text-turmeric hover:underline">
              Log in
            </Link>
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
        className="w-full rounded-xl border border-k-border bg-surface/60 px-4 py-3 text-text-primary outline-none transition-[background-color,border-color,color,box-shadow] duration-200 placeholder:text-text-secondary/70 focus:border-turmeric focus:shadow-golden-glow"
      />
    </label>
  )
}

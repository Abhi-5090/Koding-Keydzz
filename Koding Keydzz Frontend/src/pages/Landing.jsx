import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  KeyRound, Rocket, Swords, BarChart3, Sparkles,
  Gamepad2, Brain, Code2, Trophy,
  Trees, Mountain, Castle, Sun, Bot,
  Footprints, Repeat, Bug, Wand2, Flame,
  Rabbit, GraduationCap, User,
  Medal, Award,
} from 'lucide-react'
import { useGsap, gsap } from '../hooks/useGsap'
import FloatingShapes from '../components/ui/FloatingShapes'
import Particles from '../components/ui/Particles'
import AnimatedIcon from '../components/ui/AnimatedIcon'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'

const TYPED_WORDS = ['Adventure', 'Magic', 'Games', 'Worlds', 'Code']

// Static marketing showcase of the game worlds (landing copy, not live data).
const MARKETING_WORLDS = [
  { id: 1, name: 'Coding Forest', icon: Trees, tint: '#1FB6A6', description: 'Begin among whispering trees and learn variables, inputs and outputs.', topics: ['Variables', 'Inputs', 'Outputs'] },
  { id: 2, name: 'Loop Mountain', icon: Mountain, tint: '#FF8A4D', description: 'Climb the peaks by mastering repetition with loops.', topics: ['For Loops', 'While Loops'] },
  { id: 3, name: 'Function Castle', icon: Castle, tint: '#FF602F', description: 'Build reusable spells called functions.', topics: ['Functions', 'Parameters', 'Return Values'] },
  { id: 4, name: 'Algorithm Desert', icon: Sun, tint: '#C98A5A', description: 'Cross the sands with clever step-by-step logic.', topics: ['Logic', 'Problem Solving'] },
  { id: 5, name: 'Python Kingdom', icon: Code2, tint: '#2DD4BF', description: 'Rule the kingdom with the mighty Python language.', topics: ['Python'] },
  { id: 6, name: 'JavaScript Galaxy', icon: Rocket, tint: '#FF6A3D', description: 'Blast off into a galaxy powered by JavaScript.', topics: ['JavaScript'] },
  { id: 7, name: 'AI Future City', icon: Bot, tint: '#5BC0BE', description: 'Command intelligent machines in the future city.', topics: ['AI', 'ML Basics', 'Prompt Engineering'] },
]

function Typewriter() {
  const [index, setIndex] = useState(0)
  const [text, setText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const current = TYPED_WORDS[index % TYPED_WORDS.length]
    const speed = deleting ? 60 : 120
    const timeout = setTimeout(() => {
      if (!deleting) {
        setText(current.slice(0, text.length + 1))
        if (text.length + 1 === current.length) setTimeout(() => setDeleting(true), 1200)
      } else {
        setText(current.slice(0, text.length - 1))
        if (text.length - 1 === 0) {
          setDeleting(false)
          setIndex((i) => i + 1)
        }
      }
    }, speed)
    return () => clearTimeout(timeout)
  }, [text, deleting, index])

  return (
    <span className="golden-text">
      {text}
      <span className="ml-0.5 animate-pulse text-turmeric">|</span>
    </span>
  )
}

const FEATURES = [
  { icon: Gamepad2, title: 'Game-First Learning', text: 'Every lesson is a quest. Earn XP, coins and badges as you conquer real code.' },
  { icon: Brain, title: 'Adaptive Difficulty', text: 'Challenges grow with you — from your first variable to building AI.' },
  { icon: Code2, title: 'Real Code Playground', text: 'Write actual Python & JavaScript in a built-in editor and see it run.' },
  { icon: Trophy, title: 'Compete & Climb', text: 'Global leaderboards, streaks and tournaments keep the spark alive.' },
]

const BENEFITS = {
  Students: ['Learn by playing, not memorizing', 'Build real projects', 'Earn rewards & level up'],
  Parents: ['Track progress in real time', 'Safe, ad-free environment', 'Reports & milestones'],
  Teachers: ['Classroom dashboards', 'Auto-graded challenges', 'Curriculum-aligned worlds'],
}

const TESTIMONIALS = [
  { name: 'Maya, age 11', avatar: Rabbit, text: 'I built my first game in Python and didn\'t even realize I was learning!' },
  { name: 'Mr. Rao, Teacher', avatar: GraduationCap, text: 'My whole class is hooked. Engagement has never been higher.' },
  { name: 'Priya, Parent', avatar: User, text: 'Finally screen time I feel great about. The progress reports are wonderful.' },
]

const ACHIEVEMENTS = [Footprints, Repeat, Bug, Wand2, Code2, Rocket, Bot, Flame]

export default function Landing() {
  const scope = useGsap(() => {
    // Hero entrance
    gsap.from('.hero-line', { y: 40, opacity: 0, duration: 0.9, stagger: 0.15, ease: 'power3.out' })

    // Generic scroll reveals
    gsap.utils.toArray('.reveal').forEach((el) => {
      gsap.from(el, {
        y: 60,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%' },
      })
    })

    // Staggered card reveals
    gsap.utils.toArray('.reveal-group').forEach((group) => {
      gsap.from(group.children, {
        y: 50,
        opacity: 0,
        duration: 0.6,
        stagger: 0.12,
        ease: 'power2.out',
        scrollTrigger: { trigger: group, start: 'top 85%' },
      })
    })

    // Hero parallax
    gsap.to('.parallax-bg', {
      yPercent: 30,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    })
  }, [])

  return (
    <div ref={scope} className="relative min-h-screen overflow-x-hidden bg-malt text-text-primary">
      {/* Nav */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-k-border bg-malt/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <AnimatedIcon icon={KeyRound} size={28} className="text-turmeric" animation="hover" glow />
            <span className="game-text text-xl font-bold text-turmeric">Koding Keydzz</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button size="sm">Student Log In</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="hero relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-20">
        <div className="parallax-bg absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-malt via-card to-malt" />
          <Particles count={30} />
          <FloatingShapes />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="game-text mb-6 inline-flex items-center gap-2 rounded-full border border-k-border bg-surface/60 px-4 py-1.5 text-sm text-text-secondary"
          >
            <AnimatedIcon icon={Rocket} size={16} className="text-turmeric" animation="float" />
            For young coders aged 6–16
          </motion.span>

          <h1 className="hero-line mb-4 font-heading text-5xl font-extrabold leading-tight sm:text-7xl">
            Learn Coding Through
          </h1>
          <h1 className="hero-line mb-6 font-heading text-5xl font-extrabold leading-tight sm:text-7xl">
            <Typewriter />
          </h1>

          <p className="hero-line mx-auto mb-10 max-w-2xl text-lg text-text-secondary">
            Explore 5 magical worlds, write real code, defeat bugs and become a
            coding hero in the Golden Coding Kingdom.
          </p>

          <div className="hero-line flex flex-wrap items-center justify-center gap-4">
            <Link to="/login">
              <Button size="lg" className="animate-pulse-glow inline-flex items-center gap-2">
                <Swords size={20} /> Log In to Play
              </Button>
            </Link>
          </div>

          <div className="hero-line mt-12 flex flex-wrap items-center justify-center gap-8 text-text-secondary">
            <div><span className="game-text block text-3xl font-bold text-turmeric">7</span>Worlds</div>
            <div><span className="game-text block text-3xl font-bold text-turmeric">200+</span>Quests</div>
            <div><span className="game-text block text-3xl font-bold text-turmeric">50K+</span>Young Coders</div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative mx-auto max-w-7xl px-6 py-24">
        <h2 className="reveal mb-4 text-center font-heading text-4xl font-extrabold sm:text-5xl">
          Why Kids <span className="golden-text">Love</span> It
        </h2>
        <p className="reveal mx-auto mb-14 max-w-2xl text-center text-text-secondary">
          Built like a game, powered by real curriculum.
        </p>
        <div className="reveal-group grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Card key={f.title} className="text-center">
              <div className="mb-4 flex justify-center">
                <AnimatedIcon icon={f.icon} size={48} className="text-turmeric" animation="float" glow />
              </div>
              <h3 className="mb-2 game-text text-lg font-bold text-turmeric">{f.title}</h3>
              <p className="text-sm text-text-secondary">{f.text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* GAME WORLDS */}
      <section className="relative overflow-hidden px-6 py-24">
        <Particles count={16} />
        <div className="relative mx-auto max-w-7xl">
          <h2 className="reveal mb-4 text-center font-heading text-4xl font-extrabold sm:text-5xl">
            Explore <span className="golden-text">7 Magical Worlds</span>
          </h2>
          <p className="reveal mx-auto mb-14 max-w-2xl text-center text-text-secondary">
            Each world unlocks new powers and new code.
          </p>
          <div className="reveal-group grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {MARKETING_WORLDS.map((w) => (
              <Card key={w.id} className="group relative overflow-hidden">
                <div
                  className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
                  style={{ background: w.tint }}
                />
                <div className="mb-3 flex items-center gap-3">
                  <span className="shrink-0">
                    <AnimatedIcon icon={w.icon} size={36} animation="float" style={{ color: w.tint }} />
                  </span>
                  <div className="min-w-0">
                    <span className="text-xs text-text-secondary">World {w.id}</span>
                    <h3 className="game-text truncate text-lg font-bold" style={{ color: w.tint }}>{w.name}</h3>
                  </div>
                </div>
                <p className="mb-3 text-sm text-text-secondary">{w.description}</p>
                <div className="flex flex-wrap gap-2">
                  {w.topics.map((t) => (
                    <span key={t} className="rounded-full border border-k-border bg-surface/60 px-2.5 py-1 text-xs text-text-secondary">
                      {t}
                    </span>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <h2 className="reveal mb-14 text-center font-heading text-4xl font-extrabold sm:text-5xl">
          Loved by <span className="golden-text">Everyone</span>
        </h2>
        <div className="reveal-group grid gap-6 lg:grid-cols-3">
          {Object.entries(BENEFITS).map(([who, list]) => (
            <Card key={who} glow>
              <h3 className="mb-4 game-text text-2xl font-bold text-turmeric">For {who}</h3>
              <ul className="space-y-3">
                {list.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-text-secondary">
                    <Sparkles size={16} className="mt-0.5 shrink-0 text-turmeric" /> {item}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* ACHIEVEMENTS */}
      <section className="overflow-hidden px-6 py-24">
        <div className="mx-auto max-w-7xl text-center">
          <h2 className="reveal mb-4 font-heading text-4xl font-extrabold sm:text-5xl">
            Collect <span className="golden-text">Epic Badges</span>
          </h2>
          <p className="reveal mx-auto mb-14 max-w-2xl text-text-secondary">
            Unlock dozens of achievements as you grow.
          </p>
          <div className="reveal-group flex flex-wrap items-center justify-center gap-6">
            {ACHIEVEMENTS.map((Icon, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.2, rotate: 10 }}
                className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-k-border bg-surface/60 text-turmeric shadow-golden-glow"
              >
                <AnimatedIcon icon={Icon} size={36} className="text-turmeric" animation="pop" glow />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <h2 className="reveal mb-14 text-center font-heading text-4xl font-extrabold sm:text-5xl">
          What People <span className="golden-text">Say</span>
        </h2>
        <div className="reveal-group grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <Card key={t.name}>
              <p className="mb-4 text-text-secondary">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-turmeric">
                  <AnimatedIcon icon={t.avatar} size={20} className="text-turmeric" animation="hover" />
                </span>
                <span className="game-text font-bold text-turmeric">{t.name}</span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* LEADERBOARD CTA */}
      <section className="mx-auto max-w-3xl px-6 py-24">
        <h2 className="reveal mb-4 text-center font-heading text-4xl font-extrabold sm:text-5xl">
          Climb the <span className="golden-text">Leaderboard</span>
        </h2>
        <p className="reveal mx-auto mb-12 text-center text-text-secondary">
          Earn XP, top the rankings, and become the kingdom's greatest coder.
        </p>
        <Card className="reveal text-center" glow>
          <div className="mb-4 flex justify-center gap-6">
            <AnimatedIcon icon={Trophy} size={48} className="text-turmeric" animation="float" glow />
            <AnimatedIcon icon={Medal} size={48} className="text-accent" animation="float" />
            <AnimatedIcon icon={Award} size={48} className="text-text-secondary" animation="float" />
          </div>
          <p className="mb-6 text-text-secondary">
            Every lesson, quiz and challenge you complete pushes you up the live leaderboard.
            Sign in to see where you rank!
          </p>
          <Link to="/login">
            <Button className="inline-flex items-center gap-2"><BarChart3 size={18} /> View My Rank</Button>
          </Link>
        </Card>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden px-6 py-28">
        <Particles count={20} />
        <div className="relative mx-auto max-w-3xl text-center">
          <h2 className="reveal mb-6 font-heading text-4xl font-extrabold sm:text-6xl">
            Ready to <span className="golden-text">Begin?</span>
          </h2>
          <p className="reveal mx-auto mb-10 max-w-xl text-lg text-text-secondary">
            Join thousands of young coders on the greatest adventure in the kingdom.
          </p>
          <div className="reveal">
            <Link to="/login">
              <Button size="lg" className="animate-pulse-glow inline-flex items-center gap-2">
                <KeyRound size={20} /> Log In to Play
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-k-border px-6 py-10 text-center text-sm text-text-secondary">
        <div className="mb-2 game-text inline-flex items-center gap-2 text-turmeric">
          <KeyRound size={16} className="text-turmeric" /> Koding Keydzz
        </div>
        <p>© {new Date().getFullYear()} Koding Keydzz — Learn Coding Through Adventure.</p>
      </footer>
    </div>
  )
}

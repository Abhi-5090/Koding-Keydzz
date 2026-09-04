import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Gamepad2, ArrowRight } from 'lucide-react'
import { GAMES } from '../../data/games'
import AnimatedIcon from '../../components/ui/AnimatedIcon'
import PageTransition from '../../components/layout/PageTransition'
import Particles from '../../components/ui/Particles'

const diffColor = {
  Easy: 'text-success',
  Medium: 'text-turmeric',
  Hard: 'text-error',
}

// Hub is grouped into these difficulty tiers, in this order.
const TIERS = ['Easy', 'Medium', 'Hard']

export default function GamesHub() {
  const reduce = useReducedMotion()
  return (
    <PageTransition>
      <div className="relative mb-8 overflow-hidden rounded-3xl border border-k-border bg-gradient-to-br from-card to-surface p-8 shadow-golden-glow">
        <Particles count={16} />
        <div className="relative">
          <h1 className="flex items-center gap-3 font-heading text-3xl font-extrabold sm:text-4xl">
            <AnimatedIcon icon={Gamepad2} size={36} className="text-turmeric" animation="float" glow />
            Mini Games Arcade
          </h1>
          <p className="mt-2 text-text-secondary">
            Play, learn, and earn XP &amp; coins. Every game teaches a real coding superpower!
          </p>
        </div>
      </div>

      {TIERS.map((tier) => {
        const tierGames = GAMES.filter((g) => g.difficulty === tier)
        if (!tierGames.length) return null
        return (
          <section key={tier} className="mb-9">
            <div className="mb-4 flex items-center gap-3">
              <h2 className={`font-heading text-xl font-extrabold ${diffColor[tier]}`}>{tier}</h2>
              <span className="game-text rounded-full border border-k-border bg-surface/60 px-2.5 py-0.5 text-xs text-text-secondary">
                {tierGames.length} games
              </span>
              <div className="h-px flex-1 bg-k-border" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
              {tierGames.map((g, i) => (
                <motion.div
                  key={g.slug}
                  className="h-full"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.06, 0.35), ease: [0.23, 1, 0.32, 1] }}
                >
                  <Link to={`/games/${g.slug}`} className="block h-full">
                    <motion.div
                      whileHover={reduce ? undefined : { y: -8, boxShadow: '0 0 32px rgba(255,96,47,0.45)' }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border-2 bg-card p-5 xl:p-6"
                      style={{ borderColor: `${g.tint}55` }}
                    >
                      <div
                        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-xl"
                        style={{ background: g.tint }}
                      />
                      <motion.div
                        animate={reduce ? undefined : { y: [0, -8, 0] }}
                        transition={{ duration: 3 + i * 0.2, repeat: Infinity }}
                        className="mb-3"
                      >
                        <AnimatedIcon icon={g.icon} size={48} animation="none" style={{ color: g.tint }} />
                      </motion.div>
                      <h3 className="game-text text-lg font-bold leading-tight text-text-primary xl:text-xl">
                        {g.title}
                      </h3>
                      <p className="mt-1 flex-1 text-sm leading-snug text-text-secondary">{g.tagline}</p>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                        {/*
                          The tint stays as the BACKGROUND wash; the label is
                          ordinary text.

                          It used to be the tint on a 13% wash of the same
                          tint, which is inherently low contrast — the audit
                          measured 4.19:1 for the purple and 4.33:1 for the
                          orange, both under the 4.5:1 this platform teaches.
                          No amount of tuning fixes a colour against a pale
                          wash of itself for every tint in the catalogue.

                          The colour coding is carried by the wash, so moving
                          the label to `text-text-primary` keeps the coding and
                          makes the words legible.
                        */}
                        <span
                          className="game-text rounded-full px-2.5 py-1 text-xs font-bold text-text-primary"
                          style={{ background: `${g.tint}33` }}
                        >
                          {g.concept}
                        </span>
                        <span className={`game-text text-xs font-bold ${diffColor[g.difficulty]}`}>
                          {g.difficulty}
                        </span>
                      </div>
                      <div className="mt-4 flex items-center gap-1 game-text text-sm font-bold text-turmeric opacity-0 transition-opacity group-hover:opacity-100">
                        Play now <ArrowRight size={16} />
                      </div>
                    </motion.div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )
      })}
    </PageTransition>
  )
}

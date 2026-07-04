import { motion, AnimatePresence } from 'framer-motion'

/**
 * Layered avatar preview — stacks skin, outfit, accessory, pet and an
 * effect aura. `reveal` plays a glow-burst when a new item is equipped.
 */
export default function AvatarPreview({ items, equipped, reveal, size = 'lg' }) {
  const get = (slot) => items.find((i) => i.id === equipped[slot])
  const skin = get('skin')
  const outfit = get('outfit')
  const accessory = get('accessory')
  const pet = get('pet')
  const effect = get('effect')
  const background = get('background')

  const big = size === 'lg'

  return (
    <div className="relative flex flex-col items-center">
      {/* background scene behind the hero */}
      {background && big && (
        <div className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 select-none text-7xl opacity-30 blur-[1px]">
          {background.icon}
        </div>
      )}
      <div
        className={`relative flex items-center justify-center rounded-full bg-gradient-to-br from-turmeric to-accent shadow-golden-glow ${
          big ? 'h-40 w-40' : 'h-10 w-10'
        }`}
      >
        {/* effect aura */}
        {effect && (
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            className={`pointer-events-none absolute inset-0 flex items-start justify-center ${big ? 'text-2xl' : 'text-xs'}`}
          >
            {effect.icon}
          </motion.span>
        )}

        {/* skin */}
        <span style={{ fontSize: big ? 72 : 22 }}>{skin?.icon || '🦊'}</span>

        {/* outfit badge */}
        {outfit && big && (
          <span className="absolute bottom-2 text-3xl" style={{ filter: 'drop-shadow(0 2px 4px #0008)' }}>
            {outfit.icon}
          </span>
        )}

        {/* accessory */}
        {accessory && big && (
          <span className="absolute -top-2 text-3xl">{accessory.icon}</span>
        )}

        {/* glow burst on equip */}
        <AnimatePresence>
          {reveal && big && (
            <motion.span
              key={reveal}
              initial={{ scale: 0, opacity: 0.9 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 0.7 }}
              className="pointer-events-none absolute inset-0 rounded-full border-4 border-accent"
            />
          )}
        </AnimatePresence>
      </div>

      {/* pet companion */}
      {pet && big && (
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          className="mt-2 flex items-center gap-1 rounded-full border border-k-border bg-surface/60 px-3 py-1"
        >
          <span className="text-xl">{pet.icon}</span>
          <span className="game-text text-xs text-text-secondary">{pet.name}</span>
        </motion.div>
      )}
    </div>
  )
}

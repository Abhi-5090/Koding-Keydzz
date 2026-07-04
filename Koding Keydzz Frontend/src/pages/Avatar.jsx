import { useState, useMemo, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { Drama, Shirt, Crown, PawPrint, Sparkles, Image, Lock, Coins, Check, Backpack } from 'lucide-react'
import { AVATAR_SLOTS, RARITIES, EQUIP_FIELD_BY_SLOT, decorateAvatarItem } from '../data/avatarItems'
import {
  useGetAvatarItemsQuery,
  useGetMyAvatarQuery,
  useEquipAvatarItemMutation,
} from '../features/avatar/avatarApi'
import { useGetDashboardQuery } from '../features/student/studentApi'
import { selectEquipped, setEquipped, equipItem } from '../features/avatar/avatarSlice'
import PageTransition from '../components/layout/PageTransition'
import Card from '../components/ui/Card'
import Particles from '../components/ui/Particles'
import AvatarPreview from '../components/avatar/AvatarPreview'
import AnimatedIcon from '../components/ui/AnimatedIcon'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/QueryState'

// Lucide icons for wardrobe slot tabs (UI chrome — replaces the slot emoji glyphs).
const SLOT_ICON = {
  skin: Drama,
  outfit: Shirt,
  accessory: Crown,
  pet: PawPrint,
  effect: Sparkles,
  background: Image,
}

// Convert the backend avatar field map into a wardrobe-slot -> itemKey map.
function toSlotMap(avatar = {}) {
  const out = {}
  for (const slot of AVATAR_SLOTS) {
    out[slot.key] = avatar[EQUIP_FIELD_BY_SLOT[slot.key]] || null
  }
  return out
}

export default function Avatar() {
  const dispatch = useDispatch()
  const localEquipped = useSelector(selectEquipped)

  const itemsQuery = useGetAvatarItemsQuery()
  const { data: itemsData, isLoading, isError, refetch } = itemsQuery
  const { data: meData } = useGetMyAvatarQuery()
  const { data: dash } = useGetDashboardQuery()
  const [equipAvatar, { isLoading: equipping }] = useEquipAvatarItemMutation()

  const items = useMemo(() => (itemsData || []).map(decorateAvatarItem), [itemsData])

  // Mirror the server's equipped avatar into the local cache.
  useEffect(() => {
    if (meData?.avatar) dispatch(setEquipped(toSlotMap(meData.avatar)))
  }, [meData, dispatch])

  const equipped = Object.keys(localEquipped || {}).length
    ? localEquipped
    : toSlotMap(meData?.avatar)

  const level = dash?.level ?? 1
  const ownedIds = useMemo(
    () => new Set(meData?.inventory || items.filter((i) => i.isDefault).map((i) => i.id)),
    [meData, items]
  )

  const [activeSlot, setActiveSlot] = useState('skin')
  const [reveal, setReveal] = useState(0)
  const [toast, setToast] = useState(null)

  const slotItems = items.filter((i) => i.slot === activeSlot)

  const equip = async (item) => {
    const owned = ownedIds.has(item.id) || item.isDefault
    if (!owned) {
      if (level < item.level) {
        setToast({ type: 'error', text: `Reach Level ${item.level} to unlock ${item.name}.` })
      } else {
        setToast({ type: 'error', text: `Buy ${item.name} in the Shop first!` })
      }
      setTimeout(() => setToast(null), 2200)
      return
    }
    // Optimistic local update, then persist to the backend.
    dispatch(equipItem({ slot: item.slot, id: item.id }))
    setReveal((k) => k + 1)
    try {
      await equipAvatar(item.key).unwrap()
      setToast({ type: 'success', text: `${item.name} equipped!` })
    } catch (err) {
      // Roll back to the server's truth on failure.
      if (meData?.avatar) dispatch(setEquipped(toSlotMap(meData.avatar)))
      setToast({ type: 'error', text: err?.data?.message || 'Could not equip that item.' })
    }
    setTimeout(() => setToast(null), 1800)
  }

  return (
    <PageTransition>
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-extrabold inline-flex items-center gap-2">
          <AnimatedIcon icon={Drama} size={30} className="text-turmeric" animation="float" glow />
          Avatar Wardrobe
        </h1>
        <p className="text-text-secondary">Customize your hero and stand out in the Kingdom!</p>
      </div>

      {isLoading ? (
        <LoadingState message="Opening the wardrobe…" />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : items.length === 0 ? (
        <EmptyState icon={Drama} title="No wardrobe items yet" message="New gear is coming soon — check back later!" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          {/* Preview */}
          <Card hover={false} className="relative overflow-hidden text-center">
            <Particles count={10} />
            <div className="relative">
              <h2 className="game-text mb-4 font-bold text-turmeric">Your Hero</h2>
              <div className="flex justify-center py-4">
                <AvatarPreview items={items} equipped={equipped} reveal={reveal} />
              </div>
              <div className="mt-4 space-y-1.5 text-left text-sm">
                {AVATAR_SLOTS.map((s) => {
                  const it = items.find((i) => i.id === equipped[s.key])
                  return (
                    <div
                      key={s.key}
                      className="flex items-center justify-between rounded-lg border border-k-border bg-surface/40 px-3 py-1.5"
                    >
                      <span className="game-text inline-flex items-center gap-1.5 text-text-secondary">
                        {SLOT_ICON[s.key] && <AnimatedIcon icon={SLOT_ICON[s.key]} size={15} className="text-text-secondary" animation="none" />}
                        {s.label}
                      </span>
                      <span className="game-text text-turmeric">
                        {it ? `${it.icon} ${it.name}` : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>

          {/* Wardrobe */}
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              {AVATAR_SLOTS.map((s) => {
                const SlotIcon = SLOT_ICON[s.key]
                return (
                  <button
                    key={s.key}
                    onClick={() => setActiveSlot(s.key)}
                    className={`game-text inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm transition-[background-color,border-color,color,box-shadow] duration-200 ${
                      activeSlot === s.key
                        ? 'bg-turmeric text-malt shadow-golden-glow'
                        : 'border border-k-border bg-surface/60 text-text-secondary hover:text-turmeric'
                    }`}
                  >
                    {SlotIcon && <SlotIcon size={16} />}
                    {s.label}
                  </button>
                )
              })}
            </div>

            {slotItems.length === 0 ? (
              <EmptyState icon={Backpack} title="Nothing in this slot yet" message="More items are on the way!" />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {slotItems.map((item) => {
                  const owned = ownedIds.has(item.id) || item.isDefault
                  const isEquipped = equipped[item.slot] === item.id
                  const r = RARITIES[item.rarity] || RARITIES.common
                  return (
                    <motion.button
                      key={item.id}
                      whileHover={{ y: -4 }}
                      disabled={equipping}
                      onClick={() => equip(item)}
                      className={`relative rounded-2xl border-2 bg-card p-4 text-center transition-[background-color,border-color,color,box-shadow] duration-200 ${r.ring} ${
                        isEquipped ? 'ring-2 ring-turmeric ' + r.glow : ''
                      } ${!owned ? 'opacity-80' : ''}`}
                    >
                      {isEquipped && (
                        <span className="absolute right-2 top-2 rounded-full bg-turmeric px-2 py-0.5 text-[10px] font-bold text-malt">
                          EQUIPPED
                        </span>
                      )}
                      <div className={`mb-2 text-5xl ${owned ? 'animate-float' : 'grayscale'}`}>
                        {item.icon}
                      </div>
                      <h3 className="game-text text-sm font-bold text-text-primary">{item.name}</h3>
                      <span className={`game-text text-[10px] uppercase tracking-wider ${r.ring.replace('border', 'text')}`}>
                        {r.label}
                      </span>
                      <div className="mt-2">
                        {owned ? (
                          <span className="game-text inline-flex items-center gap-1 text-xs text-success">
                            {isEquipped ? (
                              <>
                                <Check size={13} /> Worn
                              </>
                            ) : (
                              'Tap to equip'
                            )}
                          </span>
                        ) : level < item.level ? (
                          <span className="game-text inline-flex items-center gap-1 text-xs text-error">
                            <Lock size={13} /> Lvl {item.level}
                          </span>
                        ) : (
                          <span className="game-text inline-flex items-center gap-1 text-xs text-turmeric">
                            <Coins size={13} /> {item.price}
                          </span>
                        )}
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border px-6 py-3 game-text shadow-golden-glow ${
              toast.type === 'success' ? 'border-success bg-card text-success' : 'border-error bg-card text-error'
            }`}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  )
}

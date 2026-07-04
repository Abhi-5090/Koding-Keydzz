import { useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, Coins, Check, Lock, Sparkles } from 'lucide-react'
import { SHOP_RARITY, decorateShopItem, buildCategories } from '../data/shopItems'
import { useGetDashboardQuery } from '../features/student/studentApi'
import { useGetShopItemsQuery, usePurchaseItemMutation } from '../features/shop/shopApi'
import { useEquipAvatarItemMutation } from '../features/avatar/avatarApi'
import PageTransition from '../components/layout/PageTransition'
import Button from '../components/ui/Button'
import Confetti from '../components/ui/Confetti'
import CoinCounter from '../components/ui/CoinCounter'
import AnimatedIcon from '../components/ui/AnimatedIcon'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/QueryState'

export default function Shop() {
  const { data: dash } = useGetDashboardQuery()
  const { data: shopData, isLoading, isError, refetch } = useGetShopItemsQuery()
  const [purchase, { isLoading: purchasing }] = usePurchaseItemMutation()
  const [equip, { isLoading: equipping }] = useEquipAvatarItemMutation()

  const items = useMemo(() => (shopData || []).map(decorateShopItem), [shopData])
  const categories = useMemo(() => buildCategories(items), [items])
  const coins = dash?.coins ?? 0
  const level = dash?.level ?? 1

  const [category, setCategory] = useState('All')
  const [toast, setToast] = useState(null)
  const [burst, setBurst] = useState(0)
  const [unlockedId, setUnlockedId] = useState(null)
  const toastTimer = useRef(null)

  // Single source of truth for the toast so a later purchase/equip can't have
  // its message cleared by an earlier timeout.
  const flashToast = (next, ms = 2400) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(next)
    toastTimer.current = setTimeout(() => setToast(null), ms)
  }

  const filtered = items.filter((i) => (category === 'All' ? true : i.category === category))

  const buy = async (item) => {
    if (item.owned || purchasing) return
    if (level < item.level) {
      flashToast({ type: 'error', text: `Reach Level ${item.level} to unlock ${item.name}.` })
      return
    }
    if (coins < item.price) {
      flashToast({ type: 'error', text: 'Not enough coins! Earn more by playing.' })
      return
    }
    try {
      await purchase(item.key).unwrap()
      setUnlockedId(item.id)
      setBurst((b) => b + 1)
      // Offer to equip right away for wearable items; keep it up long enough
      // to actually tap "Wear it now".
      flashToast(
        { type: 'success', text: `${item.name} unlocked!`, wear: item.equippable ? item : null },
        item.equippable ? 5000 : 2200
      )
      setTimeout(() => setUnlockedId(null), 1200)
    } catch (err) {
      flashToast({ type: 'error', text: err?.data?.message || 'Purchase failed. Try again.' })
    }
  }

  // Equip a just-purchased item via the avatar API; the Avatar tag invalidation
  // refreshes the topbar avatar.
  const wearNow = async (item) => {
    if (equipping) return
    try {
      await equip(item.key).unwrap()
      flashToast({ type: 'success', text: `${item.name} equipped! Looking sharp.` }, 2400)
    } catch (err) {
      flashToast({ type: 'error', text: err?.data?.message || 'Could not equip that item.' })
    }
  }

  return (
    <PageTransition>
      {burst > 0 && <Confetti key={burst} pieces={70} />}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold inline-flex items-center gap-2">
            <AnimatedIcon icon={ShoppingBag} size={30} className="text-turmeric" animation="float" glow />
            Treasure Marketplace
          </h1>
          <p className="text-text-secondary">Spend your coins on legendary gear!</p>
        </div>
        <CoinCounter coins={coins} />
      </div>

      {isLoading ? (
        <LoadingState message="Stocking the shelves…" />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : items.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="The shop is empty" message="New treasures are on the way — check back soon!" />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`game-text rounded-xl px-4 py-2 text-sm transition-[background-color,border-color,color,box-shadow] duration-200 ${
                  category === c
                    ? 'bg-turmeric text-malt shadow-golden-glow'
                    : 'border border-k-border bg-surface/60 text-text-secondary hover:text-turmeric'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((item) => {
              const r = SHOP_RARITY[item.rarity] || SHOP_RARITY.common
              const justUnlocked = unlockedId === item.id
              const levelLocked = !item.owned && level < item.level
              const tooPoor = !item.owned && !levelLocked && coins < item.price
              return (
                <motion.div
                  key={item.id}
                  layout
                  whileHover={{ y: -6 }}
                  className={`relative overflow-hidden rounded-2xl border-2 bg-card p-5 text-center ${r.ring} ${r.glow}`}
                >
                  <span className={`absolute right-2 top-2 game-text text-[10px] font-bold uppercase ${r.text}`}>
                    {r.label}
                  </span>
                  <AnimatePresence>
                    {justUnlocked && (
                      <motion.span
                        initial={{ scale: 0, opacity: 0.8 }}
                        animate={{ scale: 3, opacity: 0 }}
                        transition={{ duration: 1 }}
                        className="pointer-events-none absolute inset-0 m-auto h-16 w-16 rounded-full border-4 border-accent"
                      />
                    )}
                  </AnimatePresence>
                  <motion.div
                    animate={justUnlocked ? { scale: [1, 1.4, 1], rotate: [0, 15, -15, 0] } : {}}
                    className="mb-2 text-5xl animate-float"
                  >
                    {item.icon}
                  </motion.div>
                  <h3 className="game-text font-bold text-text-primary">{item.name}</h3>
                  <p className="mb-3 text-xs text-text-secondary">{item.category}</p>
                  {item.owned ? (
                    <span className="game-text inline-flex items-center gap-1.5 rounded-xl border border-success/50 bg-success/10 px-4 py-2 text-sm text-success">
                      <Check size={16} /> Owned
                    </span>
                  ) : levelLocked ? (
                    <span className="game-text inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-k-border bg-surface/50 px-4 py-2 text-sm text-text-secondary">
                      <Lock size={15} /> Level {item.level}
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={purchasing || tooPoor}
                      title={tooPoor ? 'Not enough coins' : undefined}
                      onClick={() => buy(item)}
                    >
                      <span className="inline-flex items-center justify-center gap-1.5">
                        <Coins size={16} /> {item.price}
                      </span>
                    </Button>
                  )}
                </motion.div>
              )
            })}
          </div>
        </>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className={`fixed bottom-6 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-xl border px-6 py-3 game-text shadow-golden-glow ${
              toast.type === 'success' ? 'border-success bg-card text-success' : 'border-error bg-card text-error'
            }`}
          >
            <span>{toast.text}</span>
            {toast.wear && (
              <Button
                size="sm"
                variant="secondary"
                disabled={equipping}
                onClick={() => wearNow(toast.wear)}
                className="flex items-center gap-1.5"
              >
                <Sparkles size={15} /> {equipping ? 'Equipping…' : 'Wear it now'}
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  )
}

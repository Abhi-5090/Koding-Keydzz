import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Award, TrendingUp, Swords, Gift, Megaphone } from 'lucide-react'
import { useGetNotificationsQuery } from '../../features/student/studentApi'
import { getSocket } from '../../app/socket'
import AnimatedIcon from '../ui/AnimatedIcon'

const ICON_BY_TYPE = {
  achievement: Award,
  levelup: TrendingUp,
  challenge: Swords,
  reward: Gift,
  broadcast: Megaphone,
  system: Bell,
}

const iconFor = (n) => ICON_BY_TYPE[n.type] || Bell

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diff)) return ''
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export default function NotificationsBell() {
  const { data } = useGetNotificationsQuery()
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Sync when the query resolves (backend returns an array of notifications).
  useEffect(() => {
    if (Array.isArray(data)) setItems(data)
  }, [data])

  // Live updates via socket.io.
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const onNotif = (n) => setItems((list) => [n, ...list])
    socket.on('notification', onNotif)
    return () => socket.off('notification', onNotif)
  }, [])

  // Close on outside click.
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unread = items.filter((n) => !n.read).length

  const toggle = () => setOpen((o) => !o)
  const markAllRead = () => setItems((list) => list.map((n) => ({ ...n, read: true })))

  return (
    <div ref={ref} className="relative">
      <motion.button
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
        onClick={toggle}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-k-border bg-surface/70 text-turmeric transition-colors hover:text-accent"
        aria-label="Notifications"
      >
        <motion.span animate={unread ? { rotate: [0, -15, 15, -10, 10, 0] } : {}} transition={{ duration: 0.8, repeat: unread ? Infinity : 0, repeatDelay: 2 }}>
          <Bell size={20} />
        </motion.span>
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [1, 1.2, 1], opacity: 1 }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white"
          >
            {unread}
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-k-border bg-card shadow-golden-glow"
          >
            <div className="flex items-center justify-between border-b border-k-border px-4 py-3">
              <span className="game-text flex items-center gap-2 font-bold text-turmeric">
                <Bell size={16} /> Notifications
              </span>
              {unread > 0 && (
                <button onClick={markAllRead} className="game-text text-xs text-text-secondary hover:text-turmeric">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto scrollbar-thin">
              {items.length === 0 ? (
                <p className="game-text px-4 py-8 text-center text-sm text-text-secondary">
                  You're all caught up!
                </p>
              ) : (
                items.map((n) => (
                  <div
                    key={n._id || n.id}
                    className={`flex gap-3 border-b border-k-border/50 px-4 py-3 transition-colors hover:bg-surface/40 ${
                      n.read ? 'opacity-60' : ''
                    }`}
                  >
                    <span className="mt-0.5 text-turmeric">
                      <AnimatedIcon icon={iconFor(n)} size={22} animation={n.read ? 'none' : 'pop'} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="game-text text-sm font-bold text-text-primary">{n.title}</p>
                      <p className="truncate text-xs text-text-secondary">{n.body || n.text}</p>
                      <p className="mt-0.5 text-[10px] text-text-secondary/70">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-turmeric" />}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

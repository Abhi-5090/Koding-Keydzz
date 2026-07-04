import { motion } from 'framer-motion'
import { Loader2, PackageOpen, AlertTriangle, RefreshCw } from 'lucide-react'
import Mascot from './Mascot'
import Button from './Button'
import AnimatedIcon from './AnimatedIcon'

/**
 * Animated loading state — Keydzz the mascot with a spinning golden ring.
 */
export function LoadingState({ message = 'Loading your adventure…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
      <div className="relative flex items-center justify-center">
        <motion.span
          className="absolute h-32 w-32 rounded-full border-4 border-turmeric/30 border-t-turmeric"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
        />
        <AnimatedIcon icon={Loader2} size={44} animation="spin" className="text-turmeric" glow />
      </div>
      <p className="game-text text-sm text-text-secondary">{message}</p>
    </div>
  )
}

/**
 * Friendly empty state with a floating icon and optional call-to-action.
 */
export function EmptyState({ icon = PackageOpen, title = 'Nothing here yet', message, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-3 py-16 text-center"
    >
      <AnimatedIcon icon={icon} size={64} animation="float" className="text-turmeric" glow />
      <h3 className="game-text text-xl font-bold text-turmeric">{title}</h3>
      {message && <p className="max-w-sm text-sm text-text-secondary">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  )
}

/**
 * Error state with a shaking warning icon and a retry button.
 */
export function ErrorState({ message = 'We could not reach the kingdom. Check your connection and try again.', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <motion.span
        className="text-error"
        animate={{ rotate: [0, -8, 8, -6, 6, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 1.6 }}
      >
        <AlertTriangle size={56} />
      </motion.span>
      <Mascot size={96} message={message} bobbing={false} />
      {onRetry && (
        <Button onClick={onRetry} size="sm" className="flex items-center gap-2">
          <AnimatedIcon icon={RefreshCw} size={16} animation="hover" />
          Try Again
        </Button>
      )}
    </div>
  )
}

/**
 * Convenience wrapper: renders the right state for an RTK Query result, or the
 * children once data has loaded successfully.
 *
 *   <QueryState query={result} isEmpty={!list.length} emptyProps={{...}}>
 *     {children}
 *   </QueryState>
 */
export default function QueryState({
  query,
  isEmpty = false,
  loadingMessage,
  errorMessage,
  emptyProps = {},
  children,
}) {
  const { isLoading, isFetching, isError, refetch } = query || {}

  if (isLoading || (isFetching && query?.data === undefined)) {
    return <LoadingState message={loadingMessage} />
  }
  if (isError) {
    return <ErrorState message={errorMessage} onRetry={refetch} />
  }
  if (isEmpty) {
    return <EmptyState {...emptyProps} />
  }
  return children
}

import { Loader2, AlertTriangle, Inbox, RotateCw } from 'lucide-react';
import AnimatedIcon from './AnimatedIcon';
import Button from './Button';

/**
 * Wraps an RTK Query result and renders the right UI for each state:
 *  - loading  -> spinner
 *  - error    -> message + Retry (calls refetch)
 *  - empty    -> friendly "no data yet" panel
 *  - success  -> children (data)
 *
 * Pass the query result fields directly:
 *   <QueryState isLoading={q.isLoading} isError={q.isError}
 *               error={q.error} refetch={q.refetch} isEmpty={!list.length}>
 *     ...content...
 *   </QueryState>
 */
export default function QueryState({
  isLoading,
  isError,
  error,
  refetch,
  isEmpty,
  emptyTitle = 'Nothing here yet',
  emptyMessage = 'Data will appear here once it is available.',
  emptyIcon: EmptyIcon = Inbox,
  loadingLabel = 'Loading…',
  children,
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-text-secondary/70">
        <AnimatedIcon icon={Loader2} size={28} animation="spin" className="text-turmeric" />
        <p className="text-sm">{loadingLabel}</p>
      </div>
    );
  }

  if (isError) {
    const message =
      error?.data?.message ||
      (error?.status === 'FETCH_ERROR'
        ? 'Could not reach the server. Check your connection and try again.'
        : 'Something went wrong while loading this data.');
    return (
      <div className="k-card flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="rounded-full bg-error/15 p-3 text-error">
          <AnimatedIcon icon={AlertTriangle} size={26} animation="pop" className="text-error" />
        </div>
        <p className="font-heading text-base font-bold text-text-primary">
          Failed to load
        </p>
        <p className="max-w-sm text-sm text-text-secondary/70">{message}</p>
        {refetch && (
          <Button variant="outline" icon={RotateCw} onClick={() => refetch()}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="k-card flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="rounded-full bg-turmeric/15 p-3 text-turmeric">
          <AnimatedIcon icon={EmptyIcon} size={26} animation="pop" className="text-turmeric" />
        </div>
        <p className="font-heading text-base font-bold text-text-primary">
          {emptyTitle}
        </p>
        <p className="max-w-sm text-sm text-text-secondary/70">{emptyMessage}</p>
      </div>
    );
  }

  return children;
}

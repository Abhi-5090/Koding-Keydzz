import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ClipboardList,
  CheckCircle2,
  CalendarClock,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'
import { useGetMyAssignmentsQuery } from '../features/student/studentApi'

/**
 * WORK MY TEACHER HAS SET ME.
 *
 * NOTHING TO HAND IN, AND NO BUTTON TO PRESS.
 * -------------------------------------------
 * A pupil finishes an assignment by doing the thing — completing the lesson,
 * passing the quiz, beating the level. The server works out what is done from
 * their own progress, so there is no "mark as complete" here and there is no
 * way to be marked down for forgetting to click something.
 *
 * That also means every card can link STRAIGHT TO THE WORK, which is the whole
 * point: the useful thing to do with a list of homework is start it.
 *
 * Tone matters on this page more than most. It is the one screen in a
 * children's product that says "you owe this", so: unfinished work is amber
 * rather than red, overdue is stated once without scolding, finished work is
 * kept visible so the list shows progress and not just debt, and a pupil with
 * nothing set is told that plainly instead of seeing an error.
 */

/** Where a pupil should go to actually do this. */
function targetLink(target) {
  if (!target) return null
  if (target.kind === 'course') return `/courses`
  if (target.kind === 'world') return `/map`
  if (target.kind === 'quiz') return `/quiz`
  if (target.kind === 'lesson') return `/map`
  if (target.kind === 'game') return `/games/${target.ref}`
  return null
}

function dueText(item) {
  if (!item.dueAt) return 'Whenever you can'
  const due = new Date(item.dueAt)
  const date = due.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  if (item.done) return `Was due ${date}`
  const days = Math.round((due.getTime() - Date.now()) / 86_400_000)
  if (days < 0) return `Was due ${date}`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days <= 7) return `Due in ${days} days (${date})`
  return `Due ${date}`
}

function AssignmentCard({ item, index }) {
  const href = targetLink(item.target)

  return (
    <motion.article
      initial={{ opacity: 1, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
      className={`rounded-2xl border p-5 ${
        item.done
          ? 'border-success/40 bg-success/5'
          : item.overdue
            ? 'border-error/40 bg-error/5'
            : 'border-k-border bg-card'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 shrink-0 ${
            item.done ? 'text-success' : item.overdue ? 'text-error' : 'text-turmeric'
          }`}
        >
          {item.done ? (
            <CheckCircle2 size={20} aria-hidden="true" />
          ) : item.overdue ? (
            <AlertTriangle size={20} aria-hidden="true" />
          ) : (
            <ClipboardList size={20} aria-hidden="true" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="game-text text-lg font-bold text-text-primary">{item.title}</h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            {item.target?.label || item.target?.ref}
            {item.classroomName ? ` · ${item.classroomName}` : ''}
          </p>

          {item.instructions ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">
              {item.instructions}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                item.done
                  ? 'text-success'
                  : item.overdue
                    ? 'text-error'
                    : 'text-text-secondary'
              }`}
            >
              <CalendarClock size={14} aria-hidden="true" />
              {item.done ? 'Finished' : dueText(item)}
            </span>

            {!item.done && href ? (
              <Link
                to={href}
                className="inline-flex items-center gap-1.5 rounded-lg bg-turmeric px-3 py-1.5 text-sm font-bold text-malt transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric/40"
              >
                Start it
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </motion.article>
  )
}

export default function Assignments() {
  const { data, isLoading, isError } = useGetMyAssignmentsQuery()
  const items = data?.items || []
  const outstanding = data?.outstanding || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="game-text text-3xl font-bold text-turmeric">My work</h1>
        <p className="mt-1 text-text-secondary">
          {isLoading
            ? 'Loading…'
            : items.length === 0
              ? 'Nothing has been set for you yet.'
              : outstanding === 0
                ? 'Everything is finished. Nice.'
                : `${outstanding} thing${outstanding === 1 ? '' : 's'} still to do.`}
        </p>
      </div>

      {isError ? (
        <p role="alert" className="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">
          We could not load your work just now. Please try again.
        </p>
      ) : null}

      {!isLoading && !isError && items.length === 0 ? (
        <div className="rounded-2xl border border-k-border bg-card p-10 text-center">
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-turmeric/15 text-turmeric">
            <ClipboardList size={30} aria-hidden="true" />
          </span>
          <h2 className="game-text text-xl font-bold text-text-primary">
            No work set right now
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
            When your teacher sets something, it will show up here with when it is due. In
            the meantime, the world map and the games are always open.
          </p>
          <Link
            to="/map"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-turmeric px-4 py-2 font-bold text-malt transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric/40"
          >
            Open the world map
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      <div className="space-y-4">
        {items.map((item, i) => (
          <AssignmentCard key={item.id} item={item} index={i} />
        ))}
      </div>
    </div>
  )
}

/**
 * The dashboard panel: only what is still owed, and only when there is any.
 *
 * A permanent "0 assignments" tile is clutter; a panel that appears when a
 * teacher sets something is a message. Capped at three so the dashboard does
 * not become the homework page — there is a link for that.
 */
export function AssignmentsPanel() {
  const { data } = useGetMyAssignmentsQuery()
  const outstanding = (data?.items || []).filter((i) => !i.done)

  if (outstanding.length === 0) return null

  return (
    <section
      aria-labelledby="homework-heading"
      className="rounded-2xl border border-turmeric/40 bg-turmeric/5 p-5"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="homework-heading"
          className="game-text flex items-center gap-2 text-lg font-bold text-text-primary"
        >
          <ClipboardList size={18} aria-hidden="true" className="text-turmeric" />
          Your teacher set you {outstanding.length === 1 ? 'something' : 'some things'}
        </h2>
        <Link
          to="/assignments"
          className="text-sm font-bold text-turmeric underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric/40"
        >
          See all {outstanding.length} →
        </Link>
      </div>

      <ul className="space-y-2">
        {outstanding.slice(0, 3).map((item) => (
          <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold text-text-primary">{item.title}</span>
            <span
              className={`text-sm ${item.overdue ? 'font-bold text-error' : 'text-text-secondary'}`}
            >
              {dueText(item)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

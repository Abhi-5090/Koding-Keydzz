import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  Flame,
  Award,
  ClipboardList,
  BookOpen,
  Trophy,
  ShieldCheck,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { baseApi } from '../app/api/baseApi'

/**
 * THE FAMILY VIEW — what a parent or carer sees.
 *
 * For a children's product the guardian is usually the person who cares
 * whether it is being used, and often the person who pays. They had no way in
 * at all: the roles were superadmin, admin, faculty, student.
 *
 * WHAT IS DELIBERATELY ABSENT
 * ---------------------------
 * No classmates, no class averages, no rankings, no other children's names.
 * A parent seeing where their child sits against named children is a different
 * product and a much worse one — and it is the obvious next request, so the
 * boundary is stated here as well as enforced on the server.
 *
 * No controls, either. A guardian cannot reset a password, change a class or
 * alter progress; those stay with the school, where the audit trail is. This
 * page is a window, not a console.
 *
 * WHAT IT DOES SHOW is chosen to answer the three questions a parent asks: is
 * it being used, is it going in, and has anything been achieved. Certificates
 * come with their verification codes, because the point of a certificate is
 * that it can be shown to somebody who was not there.
 */
export const guardianApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyChildren: builder.query({
      query: () => '/guardian/children',
      transformResponse: (res) => res?.data || res,
    }),
    getChildProgress: builder.query({
      query: (id) => `/guardian/children/${id}`,
      transformResponse: (res) => res?.data || res,
    }),
  }),
})

const { useGetMyChildrenQuery, useGetChildProgressQuery } = guardianApi

function Tile({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-2xl border border-k-border bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">
          {label}
        </p>
        <span className="text-turmeric">
          <Icon size={16} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 game-text text-3xl font-bold tabular-nums text-text-primary">
        {value}
      </p>
      {sub ? <p className="mt-1 text-sm text-text-secondary">{sub}</p> : null}
    </div>
  )
}

function ChildReport({ childId }) {
  const { data, isLoading, isError } = useGetChildProgressQuery(childId, { skip: !childId })

  if (isLoading) {
    return (
      <p className="text-text-secondary" role="status">
        Loading…
      </p>
    )
  }
  if (isError || !data) {
    return (
      <p role="alert" className="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">
        We could not load this report just now. Please try again.
      </p>
    )
  }

  const { standing, activity, ladder, certificates, work } = data
  const passed = ladder.filter((c) => c.passed).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          icon={Trophy}
          label="Level"
          value={standing.level}
          sub={`${standing.xp.toLocaleString()} XP earned`}
        />
        <Tile
          icon={Flame}
          label="Day streak"
          value={standing.streak?.current ?? 0}
          sub={
            standing.streak?.longest
              ? `Best so far: ${standing.streak.longest} days`
              : 'Comes back on consecutive days'
          }
        />
        <Tile
          icon={BookOpen}
          label="Lessons done"
          value={activity.lessonsCompleted}
          sub={`${activity.quizzesPassed} quizzes passed`}
        />
        <Tile
          icon={Award}
          label="Courses passed"
          value={passed}
          sub={`of ${ladder.length} on the ladder`}
        />
      </div>

      {/* Outstanding work: a count and the titles, not a nagging tracker. */}
      {work.outstanding > 0 ? (
        <section
          aria-labelledby="family-work"
          className="rounded-2xl border border-turmeric/40 bg-turmeric/5 p-5"
        >
          <h2
            id="family-work"
            className="game-text flex items-center gap-2 text-lg font-bold text-text-primary"
          >
            <ClipboardList size={18} aria-hidden="true" className="text-turmeric" />
            {work.outstanding} thing{work.outstanding === 1 ? '' : 's'} still to do
          </h2>
          <ul className="mt-3 space-y-1.5">
            {work.items.map((item, i) => (
              <li
                key={`${item.title}-${i}`}
                className="flex flex-wrap items-baseline justify-between gap-2"
              >
                <span className="text-text-primary">{item.title}</span>
                <span
                  className={`text-sm ${item.overdue ? 'font-bold text-error' : 'text-text-secondary'}`}
                >
                  {item.dueAt
                    ? `${item.overdue ? 'Was due ' : 'Due '}${new Date(item.dueAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`
                    : 'No deadline'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="family-ladder">
        <h2
          id="family-ladder"
          className="game-text mb-3 text-lg font-bold text-text-primary"
        >
          The course ladder
        </h2>
        <ul className="space-y-2">
          {ladder.map((course) => (
            <li
              key={course.slug}
              className="flex items-center justify-between gap-3 rounded-xl border border-k-border bg-card px-4 py-3"
            >
              <span className="font-semibold text-text-primary">{course.title}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  course.passed
                    ? 'bg-success/15 text-success'
                    : 'bg-surface text-text-secondary'
                }`}
              >
                {course.passed ? 'Passed' : 'In progress'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="family-certs">
        <h2
          id="family-certs"
          className="game-text mb-3 text-lg font-bold text-text-primary"
        >
          Certificates
        </h2>
        {certificates.length === 0 ? (
          <p className="rounded-xl border border-k-border bg-card p-5 text-sm text-text-secondary">
            None yet. One is issued automatically each time a course&apos;s final test is
            passed.
          </p>
        ) : (
          <ul className="space-y-2">
            {certificates.map((cert) => (
              <li
                key={cert.code}
                className="rounded-xl border border-k-border bg-card p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-text-primary">{cert.courseTitle}</span>
                  <span className="text-sm text-text-secondary">
                    {cert.score} / {cert.total}
                    {cert.completedAt
                      ? ` · ${new Date(cert.completedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`
                      : ''}
                  </span>
                </div>
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-text-secondary">
                  <ShieldCheck size={13} aria-hidden="true" className="shrink-0" />
                  Anyone can check this at{' '}
                  <Link
                    to={`/verify/${cert.code}`}
                    className="font-mono font-semibold text-turmeric underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric/40"
                  >
                    {cert.code}
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default function Family() {
  const { user, logout } = useAuth()
  const { data, isLoading } = useGetMyChildrenQuery()
  const [selected, setSelected] = useState('')

  const children = data?.items || []
  const activeId = selected || children[0]?.id || ''

  return (
    <div className="min-h-screen bg-surface px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="game-text text-3xl font-bold text-turmeric">
              {user?.name ? `Hello ${user.name.split(' ')[0]}` : 'Your family'}
            </h1>
            <p className="mt-1 text-text-secondary">
              {isLoading
                ? 'Loading…'
                : children.length === 0
                  ? 'No children are linked to your account yet.'
                  : children.length === 1
                    ? `How ${children[0].name.split(' ')[0]} is getting on.`
                    : 'How your children are getting on.'}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-lg border border-k-border px-3 py-2 text-sm font-semibold text-text-secondary transition hover:border-error hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric/40"
          >
            <LogOut size={15} aria-hidden="true" />
            Sign out
          </button>
        </header>

        {!isLoading && children.length === 0 ? (
          <div className="rounded-2xl border border-k-border bg-card p-10 text-center">
            <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-turmeric/15 text-turmeric">
              <Users size={30} aria-hidden="true" />
            </span>
            <h2 className="game-text text-xl font-bold text-text-primary">
              Nothing linked yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
              Your child&apos;s school links your account to them — we cannot do it from
              here, and that is on purpose: it means nobody can see a child&apos;s record
              by claiming to be a relative. Ask the school office to add the link.
            </p>
          </div>
        ) : null}

        {children.length > 1 ? (
          <div>
            <label
              htmlFor="child-picker"
              className="mb-1.5 block text-sm font-semibold text-text-primary"
            >
              Child
            </label>
            <select
              id="child-picker"
              value={activeId}
              onChange={(e) => setSelected(e.target.value)}
              className="rounded-lg border border-k-border bg-card px-3 py-2 text-text-primary focus:border-turmeric focus:outline-none focus:ring-2 focus:ring-turmeric/40"
            >
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.grade ? ` — ${c.grade}` : ''}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {activeId ? <ChildReport childId={activeId} /> : null}
      </div>
    </div>
  )
}

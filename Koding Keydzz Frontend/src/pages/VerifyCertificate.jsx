import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShieldCheck, ShieldAlert, ShieldX, Search, KeyRound } from 'lucide-react'
import { useVerifyCertificateQuery } from '../features/certificates/certificatesApi'

/**
 * PUBLIC CERTIFICATE VERIFICATION.
 *
 * The endpoint behind a code printed on paper. A grandparent, a parent or a
 * school two towns over can confirm that a certificate is real without an
 * account and without being handed anything about the child beyond the
 * achievement itself — the server returns the name, the course, the school, the
 * score and the date, and nothing else. No user id, no email, no other courses.
 *
 * THREE ANSWERS, NOT TWO
 * ----------------------
 * "Genuine", "withdrawn" and "no such code" are three different things, and
 * collapsing the middle one into either of the others would be wrong in a way
 * that matters: a withdrawn certificate reported as "not found" looks like a
 * forgery, and reported as "genuine" defeats the withdrawal.
 *
 * The code may arrive in the URL (a QR code or a link) or be typed in.
 */

const CODE_PATTERN = /^KK-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

/** Format as the user types: uppercase, and grouped with dashes. */
function tidyCode(raw) {
  const cleaned = String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  const withoutPrefix = cleaned.startsWith('KK') ? cleaned.slice(2) : cleaned
  const groups = withoutPrefix.slice(0, 12).match(/.{1,4}/g) || []
  return groups.length ? `KK-${groups.join('-')}` : cleaned ? 'KK-' : ''
}

function Verdict({ result }) {
  if (!result?.found) {
    return (
      <div className="rounded-2xl border border-k-border bg-card p-6 text-center">
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-error/15 text-error">
          <ShieldX size={26} aria-hidden="true" />
        </span>
        <h2 className="game-text text-xl font-bold text-text-primary">
          No certificate with that code
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-text-secondary">
          Check the code and try again. Codes look like{' '}
          <span className="font-mono">KK-A1B2-C3D4-E5F6</span> and never contain
          the letters O, I or L, or the digits 0 or 1 — so a character that looks
          like one of those is one of the others.
        </p>
      </div>
    )
  }

  const c = result.certificate
  const withdrawn = result.revoked

  return (
    <div
      className={`rounded-2xl border p-6 ${
        withdrawn ? 'border-error/50 bg-error/5' : 'border-success/50 bg-success/5'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            withdrawn ? 'bg-error/15 text-error' : 'bg-success/15 text-success'
          }`}
        >
          {withdrawn ? (
            <ShieldAlert size={24} aria-hidden="true" />
          ) : (
            <ShieldCheck size={24} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0">
          <h2 className="game-text text-xl font-bold text-text-primary">
            {withdrawn ? 'Issued, then withdrawn' : 'Genuine certificate'}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {withdrawn
              ? 'This certificate was issued by the school and has since been withdrawn. It is no longer valid.'
              : 'This certificate was issued by Koding Keydzz and has not been withdrawn.'}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-k-border pt-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wider text-text-secondary">
            Awarded to
          </dt>
          <dd className="font-semibold text-text-primary">{c.studentName}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-text-secondary">
            Course
          </dt>
          <dd className="font-semibold text-text-primary">{c.courseTitle}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-text-secondary">
            School
          </dt>
          <dd className="text-text-primary">{c.organizationName || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-text-secondary">
            Completed
          </dt>
          <dd className="text-text-primary">
            {c.completedAt
              ? new Date(c.completedAt).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
              : '—'}
          </dd>
        </div>
        {c.total ? (
          <div>
            <dt className="text-xs uppercase tracking-wider text-text-secondary">
              Score
            </dt>
            <dd className="text-text-primary">
              {c.score} / {c.total}
              {c.percent != null ? ` (${c.percent}%)` : ''}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs uppercase tracking-wider text-text-secondary">
            Code
          </dt>
          <dd className="font-mono text-text-primary">{c.code}</dd>
        </div>
      </dl>
    </div>
  )
}

export default function VerifyCertificate() {
  const { code: codeFromUrl } = useParams()
  const [typed, setTyped] = useState(codeFromUrl ? tidyCode(codeFromUrl) : '')
  const [submitted, setSubmitted] = useState(codeFromUrl ? tidyCode(codeFromUrl) : '')

  const valid = CODE_PATTERN.test(submitted)
  const { data, isFetching, isError } = useVerifyCertificateQuery(submitted, {
    skip: !valid,
  })

  return (
    <div className="min-h-screen bg-surface px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-2 font-heading text-lg font-bold text-turmeric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric/40"
          >
            <KeyRound size={20} aria-hidden="true" />
            Koding Keydzz
          </Link>
          <h1 className="game-text text-3xl font-bold text-text-primary">
            Check a certificate
          </h1>
          <p className="mt-2 text-text-secondary">
            Type the code printed on a Koding Keydzz certificate and we will
            confirm whether it is genuine. No account needed.
          </p>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSubmitted(typed)
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex-1">
            <label htmlFor="cert-code" className="sr-only">
              Certificate code
            </label>
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
            />
            <input
              id="cert-code"
              value={typed}
              onChange={(e) => setTyped(tidyCode(e.target.value))}
              inputMode="text"
              autoCapitalize="characters"
              spellCheck="false"
              placeholder="KK-A1B2-C3D4-E5F6"
              aria-describedby="cert-code-hint"
              className="w-full rounded-lg border border-k-border bg-card py-2.5 pl-9 pr-3 font-mono text-text-primary placeholder:text-text-secondary/70 focus:border-turmeric focus:outline-none focus:ring-2 focus:ring-turmeric/40"
            />
          </div>
          <button
            type="submit"
            disabled={!CODE_PATTERN.test(typed)}
            className="rounded-lg bg-turmeric px-5 py-2.5 font-bold text-malt transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric/40"
          >
            Check
          </button>
        </form>
        <p id="cert-code-hint" className="text-xs text-text-secondary">
          Sixteen characters, in four groups. The dashes are added for you.
        </p>

        {isFetching ? (
          <p className="text-sm text-text-secondary" role="status">
            Checking…
          </p>
        ) : null}

        {isError ? (
          <p role="alert" className="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">
            We could not reach the verification service. Please try again shortly.
          </p>
        ) : null}

        {!isFetching && !isError && valid && data ? (
          <motion.div initial={{ opacity: 1 }} animate={{ opacity: 1 }}>
            <Verdict result={data} />
          </motion.div>
        ) : null}
      </div>
    </div>
  )
}

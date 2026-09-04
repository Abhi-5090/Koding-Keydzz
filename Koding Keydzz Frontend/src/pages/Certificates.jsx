import { useState } from 'react'
import { motion } from 'framer-motion'
import { Award, Printer, Copy, Check, GraduationCap } from 'lucide-react'
import { useGetMyCertificatesQuery } from '../features/certificates/certificatesApi'
import CertificateSheet, {
  VerificationNote,
} from '../components/certificates/CertificateSheet'

/**
 * A PUPIL'S CERTIFICATES.
 *
 * The server has issued these all along — idempotently on a pass, with the
 * facts snapshotted so a later rename cannot rewrite an award — and there was
 * no page. A child passed Python and there was nothing to show anyone.
 *
 * Two things a certificate needs to be worth having, and both are here:
 * it can be PRINTED (the certificate alone, not the app around it — see the
 * print block in index.css) and it can be CHECKED by someone who was not there,
 * using the code, without an account.
 */

function EmptyState() {
  return (
    <div className="rounded-2xl border border-k-border bg-card p-10 text-center">
      <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-turmeric/15 text-turmeric">
        <GraduationCap size={30} aria-hidden="true" />
      </span>
      <h2 className="game-text text-xl font-bold text-text-primary">
        No certificates yet
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
        Pass a course&apos;s final test and a certificate is issued
        automatically. It will appear here, ready to print — with a code anyone
        can use to check it is genuine.
      </p>
    </div>
  )
}

export default function Certificates() {
  const { data, isLoading, isError } = useGetMyCertificatesQuery()
  const [copied, setCopied] = useState(null)

  const items = data?.items || []

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(code)
      window.setTimeout(() => setCopied(null), 1800)
    } catch {
      /* Clipboard refused (permissions, insecure context). The code is on
         screen and selectable, so this is a convenience, not a requirement. */
    }
  }

  return (
    <div className="print-root print-only-sheet space-y-6">
      <div className="no-print">
        <h1 className="game-text text-3xl font-bold text-turmeric">
          My certificates
        </h1>
        <p className="mt-1 text-text-secondary">
          {isLoading
            ? 'Loading…'
            : items.length === 0
              ? 'Finish a course to earn your first one.'
              : `${items.length} earned. Print one, or share its code.`}
        </p>
      </div>

      {isError ? (
        <p
          role="alert"
          className="no-print rounded-xl bg-error/10 px-4 py-3 text-sm text-error"
        >
          We could not load your certificates just now. Please try again.
        </p>
      ) : null}

      {!isLoading && !isError && items.length === 0 ? (
        <div className="no-print">
          <EmptyState />
        </div>
      ) : null}

      <div className="space-y-10">
        {items.map((certificate, i) => (
          <motion.section
            key={certificate.code}
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.07, 0.3) }}
            aria-labelledby={`cert-${certificate.code}`}
          >
            <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-turmeric">
                  <Award size={18} aria-hidden="true" />
                </span>
                <h2
                  id={`cert-${certificate.code}`}
                  className="font-heading text-lg font-bold text-text-primary"
                >
                  {certificate.courseTitle}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyCode(certificate.code)}
                  className="inline-flex items-center gap-2 rounded-lg border border-k-border px-3 py-1.5 text-sm font-semibold text-text-secondary transition hover:border-turmeric hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric/40"
                >
                  {copied === certificate.code ? (
                    <>
                      <Check size={15} aria-hidden="true" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={15} aria-hidden="true" />
                      Copy code
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 rounded-lg bg-turmeric px-3 py-1.5 text-sm font-bold text-malt transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric/40"
                >
                  <Printer size={15} aria-hidden="true" />
                  Print
                </button>
              </div>
            </div>

            <CertificateSheet certificate={certificate} />

            <VerificationNote code={certificate.code} className="no-print mt-3" />
          </motion.section>
        ))}
      </div>
    </div>
  )
}

import { Award, ShieldCheck } from 'lucide-react'

/**
 * THE CERTIFICATE ITSELF — the thing that gets printed and put on a fridge.
 *
 * WHY IT IS DRAWN IN HTML/CSS RATHER THAN GENERATED AS A PDF
 * ---------------------------------------------------------
 * A print stylesheet gets a real certificate out of a school printer with no
 * dependency, no server round trip and no fonts to embed — and it stays legible
 * on the tablet the child is holding. A PDF would look identical and add a
 * library, a server route and a download that the artifact viewer and some
 * school-managed browsers block outright.
 *
 * TEMPLATE FIELDS ARE POSITIONED IN PERCENTAGES
 * ---------------------------------------------
 * When a certificate has a template with a background image, the server sends
 * field positions as percentages of the sheet, not pixels. That is what makes
 * the preview an administrator sets up match A4, A5 and a screen — the same
 * fractions of the same aspect ratio. So the absolute positioning below is
 * driven off `%`, never a fixed size.
 *
 * Every value shown is a SNAPSHOT taken when the certificate was issued —
 * the pupil's name, the course title, the school's name, the score. They are
 * not joined at read time, so renaming a course next year does not silently
 * rewrite what a child was awarded.
 */

/** What each template field key means, and how to read it off the payload. */
const FIELD_VALUE = {
  studentName: (c) => c.studentName,
  courseTitle: (c) => c.courseTitle,
  organizationName: (c) => c.organizationName,
  code: (c) => c.code,
  completedAt: (c) => formatDate(c.completedAt),
  score: (c) => (c.total ? `${c.score} / ${c.total}` : String(c.score ?? '')),
  percent: (c) => (c.percent != null ? `${c.percent}%` : ''),
}

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function CertificateSheet({ certificate, className = '' }) {
  if (!certificate) return null

  const template = certificate.template
  const hasBackground = Boolean(template?.backgroundUrl)

  // A template's own aspect ratio when it has one, otherwise landscape A4-ish.
  const aspectRatio = template?.aspectRatio || 1.414

  return (
    <div
      className={`certificate-sheet relative w-full overflow-hidden rounded-xl border border-k-border bg-white text-[#1a1408] shadow-lg ${className}`}
      /* `container-type: inline-size` is what makes the `cqw` units below
         resolve — every font size on the sheet is a percentage of the sheet's
         own width, which is how one layout serves a tablet screen and A4. */
      style={{ aspectRatio, containerType: 'inline-size' }}
    >
      {hasBackground ? (
        <>
          <img
            src={template.backgroundUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {(template.fields || []).map((field, i) => (
            <span
              key={`${field.key}-${i}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-semibold"
              style={{
                left: `${field.x}%`,
                top: `${field.y}%`,
                // Font size is a percentage of the sheet's WIDTH, so the text
                // scales with the certificate instead of shrinking on paper.
                fontSize: `${field.fontSize}cqw`,
                color: field.color || '#1a1408',
              }}
            >
              {FIELD_VALUE[field.key]?.(certificate) ?? ''}
            </span>
          ))}
        </>
      ) : (
        /* No template configured: a plain, honest certificate rather than an
           error. A school that has not uploaded artwork still gets something
           printable. */
        <div className="flex h-full flex-col items-center justify-center gap-3 px-[8%] text-center">
          <span className="text-[#b4801a]">
            <Award size={44} aria-hidden="true" strokeWidth={1.5} />
          </span>
          <p className="text-[1.6cqw] font-bold uppercase tracking-[0.3em] text-[#8a7a56]">
            Certificate of completion
          </p>
          <p className="mt-[1%] text-[1.3cqw] text-[#5c5340]">This certifies that</p>
          <p className="font-heading text-[4.2cqw] font-bold leading-tight text-[#1a1408]">
            {certificate.studentName}
          </p>
          <p className="text-[1.3cqw] text-[#5c5340]">has successfully completed</p>
          <p className="text-[2.6cqw] font-bold leading-tight text-[#b4801a]">
            {certificate.courseTitle}
          </p>
          {certificate.total ? (
            <p className="text-[1.3cqw] text-[#5c5340]">
              with a score of {certificate.score} out of {certificate.total}
              {certificate.percent != null ? ` (${certificate.percent}%)` : ''}
            </p>
          ) : null}

          <div className="mt-[3%] flex w-full items-end justify-between gap-4 text-left">
            <div>
              <p className="text-[1.1cqw] font-semibold text-[#1a1408]">
                {certificate.organizationName}
              </p>
              <p className="text-[1cqw] text-[#8a7a56]">
                {formatDate(certificate.completedAt)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[1cqw] uppercase tracking-widest text-[#8a7a56]">
                Certificate code
              </p>
              <p className="font-mono text-[1.3cqw] font-semibold text-[#1a1408]">
                {certificate.code}
              </p>
            </div>
          </div>
        </div>
      )}

      {certificate.revoked ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          <p className="rotate-[-14deg] rounded-lg border-4 border-red-600 px-6 py-2 text-[3cqw] font-bold uppercase tracking-widest text-red-600">
            Withdrawn
          </p>
        </div>
      ) : null}
    </div>
  )
}

/** The verification line that belongs beside a printed certificate. */
export function VerificationNote({ code, className = '' }) {
  return (
    <p className={`flex items-center gap-2 text-xs text-text-secondary ${className}`}>
      <ShieldCheck size={14} aria-hidden="true" className="shrink-0" />
      <span>
        Anyone can check this is genuine at <strong>/verify</strong> using the code{' '}
        <span className="font-mono font-semibold text-text-primary">{code}</span>.
      </span>
    </p>
  )
}

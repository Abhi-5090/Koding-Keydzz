import { Activity, CheckCircle2, AlertTriangle, XCircle, Database, Clock } from 'lucide-react';
import { useGetSystemHealthQuery } from '../../features/admin/adminApi';

/**
 * SYSTEM HEALTH — the metrics, read by a person.
 *
 * WHY A PANEL RATHER THAN JUST PROMETHEUS RULES
 * ---------------------------------------------
 * Alert rules now exist (ops/alerts/koding-keydzz.rules.yml), and they are the
 * right answer for a monitored deployment. But not every deployment runs a
 * monitoring stack, and the platform owner should not have to stand one up
 * before they can find out whether exams are markable. So the same metrics get
 * a screen.
 *
 * THE ROW THAT MATTERS IS THE RUNTIMES
 * ------------------------------------
 * With a language runtime missing, coding answers in a final test cannot be
 * judged. They are flagged for human review instead — so the exam still
 * appears to work. Pupils sit it, submit it, and receive a score with marks
 * missing, and the only visible symptom is a marking queue quietly filling up.
 * That is why a missing runtime is drawn as a failure here and not as a
 * footnote, and why the copy says what it actually costs.
 *
 * Not cached for long: a stale health reading is worse than none, because it
 * gets believed.
 */

const LANGUAGE_LABEL = {
  python: 'Python',
  c: 'C',
  javascript: 'JavaScript',
  html: 'HTML',
};

function Row({ state, label, detail }) {
  const Icon = state === 'ok' ? CheckCircle2 : state === 'warn' ? AlertTriangle : XCircle;
  const tone =
    state === 'ok' ? 'text-success' : state === 'warn' ? 'text-turmeric' : 'text-error';

  return (
    <div className="flex items-start gap-3 border-t border-k-border py-2.5 first:border-t-0">
      <span className={`mt-0.5 shrink-0 ${tone}`}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        {detail ? <p className="text-sm text-text-secondary">{detail}</p> : null}
      </div>
    </div>
  );
}

function formatUptime(seconds) {
  if (!seconds && seconds !== 0) return '—';
  if (seconds < 90) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 90) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${Math.round(hours / 24)} days`;
}

export default function SystemHealthPanel() {
  const { data, isLoading, isError } = useGetSystemHealthQuery(undefined, {
    // Health is the one thing on the page worth refetching on its own.
    pollingInterval: 30_000,
  });

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-k-border bg-card p-5">
        <p className="text-sm text-text-secondary" role="status">
          Checking system health…
        </p>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className="rounded-2xl border border-error/40 bg-error/5 p-5">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-text-primary">
          <Activity size={18} aria-hidden="true" className="text-error" />
          System health unavailable
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          The metrics endpoint did not answer. If <code>METRICS_TOKEN</code> is set on the
          API, this panel needs it too — otherwise the API itself may be unreachable, which
          is the more urgent explanation.
        </p>
      </section>
    );
  }

  const runners = data.runners || {};
  const missing = Object.entries(runners).filter(([, present]) => !present);
  const errorRate = data.requests?.errorRate ?? 0;
  const avgMs = data.requests?.avgMs ?? 0;

  return (
    <section
      aria-labelledby="system-health-heading"
      className={`rounded-2xl border p-5 ${
        missing.length > 0 || !data.dbConnected
          ? 'border-error/50 bg-error/5'
          : 'border-k-border bg-card'
      }`}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="system-health-heading"
          className="flex items-center gap-2 font-heading text-lg font-bold text-text-primary"
        >
          <Activity size={18} aria-hidden="true" className="text-turmeric" />
          System health
        </h2>
        <p className="text-sm text-text-secondary/70">Refreshed every 30 seconds</p>
      </div>

      {missing.length > 0 ? (
        <div className="mb-4 rounded-xl border border-error/50 bg-error/10 p-3">
          <p className="text-sm font-bold text-text-primary">
            Exams cannot be fully marked right now.
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {missing.map(([lang]) => LANGUAGE_LABEL[lang] || lang).join(', ')} missing. Coding
            answers are being held for human review instead of marked, so papers submitted
            now will arrive in the marking queue with marks withheld. Restore the runtime,
            then clear the queue — nothing is lost, but nothing is scored until it is.
          </p>
        </div>
      ) : null}

      <div>
        {Object.entries(runners).map(([lang, present]) => (
          <Row
            key={lang}
            state={present ? 'ok' : 'error'}
            label={`${LANGUAGE_LABEL[lang] || lang} runtime`}
            detail={
              present ? 'Available — answers in this language are marked automatically.' : 'Missing — answers are queued for a human.'
            }
          />
        ))}

        <Row
          state={data.dbConnected ? 'ok' : 'error'}
          label="Database"
          detail={
            data.dbConnected
              ? 'Connected.'
              : 'Not connected. Every request that touches data is failing.'
          }
        />

        <Row
          state={errorRate > 0.25 ? 'error' : errorRate > 0.05 ? 'warn' : 'ok'}
          label={`Error rate ${(errorRate * 100).toFixed(2)}%`}
          detail={`${data.requests?.total ?? 0} requests since start. Above 5% is a warning, above 25% is an outage.`}
        />

        <Row
          state={avgMs > 1500 ? 'warn' : 'ok'}
          label={`Average response ${avgMs}ms`}
          detail="Sustained time above 1.5s is slow enough to cost a lesson on a school tablet."
        />

        <Row
          state={data.uptimeSeconds != null && data.uptimeSeconds < 120 ? 'warn' : 'ok'}
          label={`Up for ${formatUptime(data.uptimeSeconds)}`}
          detail={
            data.uptimeSeconds != null && data.uptimeSeconds < 120
              ? 'Recently restarted — if this stays low the process is crash-looping.'
              : 'Running normally.'
          }
        />
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-text-secondary">
        <Clock size={12} aria-hidden="true" />
        For alerting rather than watching, load{' '}
        <code>ops/alerts/koding-keydzz.rules.yml</code> into Prometheus.
      </p>
    </section>
  );
}

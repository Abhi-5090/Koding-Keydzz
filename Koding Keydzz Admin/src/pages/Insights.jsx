import {
  useGetHardestQuestionsQuery,
  useGetHardestQuizzesQuery,
  useGetStallPointsQuery,
} from '../features/admin/adminApi';
import PageHeader from '../components/ui/PageHeader';
import QueryState from '../components/ui/QueryState';
import { Lightbulb, AlertOctagon, TrendingDown, Users } from 'lucide-react';

/**
 * TEACHING INSIGHTS — the three questions a teacher actually has.
 *
 * The service behind this was written, tested and never rendered. It answers:
 *
 *   1. WHICH QUESTIONS IS THE CLASS FAILING — and, crucially, whether a
 *      question is merely HARD or actually SUSPECT. Those need opposite
 *      responses: reteach the topic, or go and read the question, because it is
 *      probably wrong. Conflating them sends a teacher to do the wrong thing,
 *      so the verdict is computed on the server and shown as a verdict here.
 *   2. WHICH QUIZZES STALL PEOPLE — pass rate measured PER PUPIL, not per
 *      attempt, because per-attempt rewards a quiz that pupils retry until
 *      they pass and hides the ones where nobody gets there.
 *   3. WHERE PUPILS ARE STUCK ON THE LADDER, attributed to the strand with the
 *      most work left, with the biggest blocker written out as a sentence.
 *
 * Scoped exactly like the class report: a teacher sees their own classes, an
 * administrator the whole school. Nothing here changes anything.
 */

/** A percentage from a 0–1 rate, or an em dash. */
const pct = (rate) => (rate == null ? '—' : `${Math.round(rate * 100)}%`);

function SectionHeading({ icon: Icon, title, note }) {
  return (
    <div className="mb-3">
      <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-text-primary">
        <span className="text-turmeric">
          <Icon size={18} aria-hidden="true" />
        </span>
        {title}
      </h2>
      {note ? <p className="mt-1 text-sm text-text-secondary">{note}</p> : null}
    </div>
  );
}

/** Hard vs suspect, said plainly. */
function Verdict({ verdict }) {
  const suspect = verdict === 'suspect';
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
        suspect ? 'bg-error/15 text-error' : 'bg-turmeric/15 text-turmeric'
      }`}
    >
      {suspect ? 'Check the question' : 'Reteach the topic'}
    </span>
  );
}

function HardestQuestions() {
  const { data, isLoading, isError, error, refetch } = useGetHardestQuestionsQuery({
    limit: 15,
  });
  const items = data?.items || [];
  const suspect = data?.suspect || [];

  return (
    <section>
      <SectionHeading
        icon={AlertOctagon}
        title="Questions the class is failing"
        note={
          data?.minAttempts
            ? `Only questions asked at least ${data.minAttempts} times are shown — below that a low mark rate is noise, not a signal.`
            : undefined
        }
      />

      {suspect.length > 0 ? (
        <div className="mb-4 rounded-xl border border-error/40 bg-error/5 p-4">
          <p className="text-sm font-semibold text-text-primary">
            {suspect.length} question{suspect.length === 1 ? '' : 's'} almost nobody is getting
            right.
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            At this mark rate the likeliest explanation is the question, not the class. Worth
            reading each one before reteaching anything.
          </p>
        </div>
      ) : null}

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={refetch}
        isEmpty={!isLoading && !isError && items.length === 0}
        emptyTitle="Not enough data yet"
        emptyMessage="Once pupils have sat enough final tests, the questions they struggle with most will be listed here."
      >
        <div className="overflow-x-auto rounded-2xl border border-k-border">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="bg-surface/60 text-left text-xs uppercase tracking-wider text-text-secondary">
                <th className="p-3 font-semibold">Question</th>
                <th className="p-3 font-semibold">Course</th>
                <th className="p-3 text-right font-semibold">Asked</th>
                <th className="p-3 text-right font-semibold">Mark rate</th>
                <th className="p-3 text-right font-semibold">Awaiting review</th>
                <th className="p-3 font-semibold">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {items.map((q) => (
                <tr key={q.questionId} className="border-t border-k-border align-top">
                  <td className="max-w-md p-3">
                    <p className="text-text-primary">{q.prompt}</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {q.type}
                      {q.difficulty ? ` · ${q.difficulty}` : ''}
                      {q.retired ? ' · retired' : ''}
                    </p>
                  </td>
                  <td className="p-3 text-text-secondary">{q.courseSlug}</td>
                  <td className="p-3 text-right tabular-nums text-text-secondary">{q.asked}</td>
                  <td className="p-3 text-right font-semibold tabular-nums text-text-primary">
                    {pct(q.markRate)}
                  </td>
                  <td className="p-3 text-right tabular-nums text-text-secondary">
                    {q.awaitingReview || 0}
                  </td>
                  <td className="p-3">
                    <Verdict verdict={q.verdict} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryState>
    </section>
  );
}

function StallingQuizzes() {
  const { data, isLoading, isError, error, refetch } = useGetHardestQuizzesQuery({ limit: 15 });
  const items = data?.items || [];

  return (
    <section>
      <SectionHeading
        icon={TrendingDown}
        title="Quizzes people get stuck on"
        note="Pass rate is measured per pupil, not per attempt — a quiz that everyone eventually passes after ten tries would otherwise look like a disaster, and one nobody passes would look fine."
      />
      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={refetch}
        isEmpty={!isLoading && !isError && items.length === 0}
        emptyTitle="Not enough attempts yet"
        emptyMessage="Quizzes appear here once enough pupils have tried them for the numbers to mean something."
      >
        <div className="overflow-x-auto rounded-2xl border border-k-border">
          <table className="w-full min-w-[38rem] border-collapse text-sm">
            <thead>
              <tr className="bg-surface/60 text-left text-xs uppercase tracking-wider text-text-secondary">
                <th className="p-3 font-semibold">Quiz</th>
                <th className="p-3 text-right font-semibold">Pupils</th>
                <th className="p-3 text-right font-semibold">Attempts each</th>
                <th className="p-3 text-right font-semibold">Average score</th>
                <th className="p-3 text-right font-semibold">Pass rate</th>
              </tr>
            </thead>
            <tbody>
              {items.map((q) => (
                <tr key={q.quizId} className="border-t border-k-border">
                  <td className="p-3 text-text-primary">{q.title}</td>
                  <td className="p-3 text-right tabular-nums text-text-secondary">{q.pupils}</td>
                  <td className="p-3 text-right tabular-nums text-text-secondary">
                    {q.attemptsPerPupil}
                  </td>
                  <td className="p-3 text-right tabular-nums text-text-secondary">
                    {pct(q.avgScore)}
                  </td>
                  <td className="p-3 text-right font-semibold tabular-nums text-text-primary">
                    {pct(q.passRate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryState>
    </section>
  );
}

/** The stall breakdown for one course on the ladder. */
const STALL_ROWS = [
  ['notStarted', 'Not started'],
  ['onLessons', 'Working through lessons'],
  ['onQuizzes', 'Stuck on quizzes'],
  ['onGames', 'Stuck on game levels'],
  ['readyForTest', 'Ready for the final test'],
  ['failedTest', 'Failed the final test'],
  ['passed', 'Passed'],
];

function LadderStalls() {
  const { data, isLoading, isError, error, refetch } = useGetStallPointsQuery();
  const courses = data?.courses || [];

  return (
    <section>
      <SectionHeading
        icon={Users}
        title="Where pupils are on the ladder"
        note={
          data?.pupils != null
            ? `${data.pupils} pupil${data.pupils === 1 ? '' : 's'} in scope. Each one is counted against the strand with the most work left, so nobody is double-counted.`
            : undefined
        }
      />
      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={refetch}
        isEmpty={!isLoading && !isError && courses.length === 0}
        emptyTitle="No courses to report on"
        emptyMessage="Once courses are published and pupils are enrolled, their progress through the ladder appears here."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {courses.map((course) => (
            <article
              key={course.slug}
              className="rounded-2xl border border-k-border bg-card p-5"
            >
              <h3 className="font-heading text-base font-bold text-text-primary">
                {course.title}
              </h3>
              {course.biggestBlocker ? (
                <p className="mt-1 text-sm font-semibold text-turmeric">
                  {course.biggestBlocker}
                </p>
              ) : (
                <p className="mt-1 text-sm text-text-secondary">Nobody is stuck here.</p>
              )}

              <dl className="mt-4 space-y-1.5">
                {STALL_ROWS.map(([key, label]) => {
                  const n = course.counts?.[key] ?? 0;
                  const total = data?.pupils || 0;
                  const share = total ? Math.round((n / total) * 100) : 0;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <dt className="w-48 shrink-0 text-sm text-text-secondary">{label}</dt>
                      <dd className="flex flex-1 items-center gap-2">
                        {/* A bar, not a chart library: one measure, one scale,
                            and the number is right there beside it. */}
                        <div
                          className="h-2 flex-1 overflow-hidden rounded-full bg-surface"
                          role="presentation"
                        >
                          <div
                            className={`h-full rounded-full ${
                              key === 'passed'
                                ? 'bg-success'
                                : key === 'failedTest'
                                  ? 'bg-error'
                                  : 'bg-turmeric'
                            }`}
                            style={{ width: `${share}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-sm font-semibold tabular-nums text-text-primary">
                          {n}
                        </span>
                      </dd>
                    </div>
                  );
                })}
              </dl>

              {data?.passMark ? (
                <p className="mt-3 text-xs text-text-secondary">
                  Pass mark {data.passMark} of 200.
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </QueryState>
    </section>
  );
}

export default function Insights() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Teaching insights"
        subtitle="What the data says to do next — for your classes, or the whole school if you are an administrator"
      />

      <div className="flex items-start gap-3 rounded-2xl border border-k-border bg-card p-4">
        <span className="mt-0.5 shrink-0 text-turmeric">
          <Lightbulb size={18} aria-hidden="true" />
        </span>
        <p className="text-sm text-text-secondary">
          Everything here is read-only and is scoped to the pupils you can already see. The
          three sections answer three different questions, and each one implies a different
          action: fix a question, reteach a topic, or go and find a particular child.
        </p>
      </div>

      <HardestQuestions />
      <StallingQuizzes />
      <LadderStalls />
    </div>
  );
}

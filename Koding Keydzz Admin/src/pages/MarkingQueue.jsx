import { useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, User, BookOpen, Clock, AlertTriangle, Check } from 'lucide-react';
import {
  useGetReviewQueueQuery,
  useMarkTestAnswerMutation,
} from '../features/admin/adminApi';
import PageHeader from '../components/ui/PageHeader';
import QueryState from '../components/ui/QueryState';
import Button from '../components/ui/Button';
import { formatApiError } from '../utils/apiError';

/**
 * THE MARKING QUEUE — the answers a machine could not judge.
 *
 * WHY THIS SCREEN MATTERS MORE THAN IT LOOKS
 * ------------------------------------------
 * A task answer with no machine-checkable rule, or a coding answer the runner
 * could not judge, is flagged `needsReview`. That is a WITHHELD mark, never a
 * zero — the deliberate design decision being that guessing zero would fail a
 * child for the platform's inability to mark, and a human queue is the honest
 * resolution.
 *
 * The service, the endpoints and the auditing were all built and tested. There
 * was no screen. So the withheld mark, which was supposed to be temporary, was
 * permanent in practice: a pupil sat below their real score with no way for
 * anyone to release it.
 *
 * THIS IS THE ONLY PLACE A MARK SCHEME IS SHOWN TO STAFF
 * -----------------------------------------------------
 * `expectedOutcome` is hidden everywhere else in the product, deliberately and
 * absolutely. A marker cannot judge work without knowing what was asked for,
 * so this screen is the single exception — which is why it needs
 * `final_test:mark` rather than ordinary student read, and why the page says so
 * out loud. Faculty hold that capability on purpose: they are the ones who know
 * the pupil and the work.
 *
 * ORDERING IS OLDEST-FIRST, and that comes from the server. A child who has
 * been waiting three days is marked before one who submitted this morning.
 */

function timeAgo(value) {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** One flagged answer, with everything a marker needs and nothing else. */
function MarkingCard({ item, onMarked }) {
  const [markAnswer, { isLoading }] = useMarkTestAnswerMutation();
  const [marks, setMarks] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const max = item.maxMarks ?? 0;
  const value = marks === '' ? null : Number(marks);
  const outOfRange = value != null && (Number.isNaN(value) || value < 0 || value > max);
  const ready = value != null && !outOfRange;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await markAnswer({
        attemptId: item.attemptId,
        questionId: item.questionId,
        marks: value,
        comment: comment.trim() || undefined,
      }).unwrap();
      setDone(true);
      onMarked?.();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-success/40 bg-success/5 p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/15 text-success">
          <Check size={18} aria-hidden="true" />
        </span>
        <p className="text-sm text-text-primary">
          Marked <strong>{value}</strong> of {max} for {item.pupil?.name || 'this pupil'}. The
          attempt has been rescored.
        </p>
      </div>
    );
  }

  return (
    <motion.article
      initial={{ opacity: 1, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-k-border bg-card p-5"
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-k-border pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
            <span className="inline-flex items-center gap-1.5 font-semibold text-text-primary">
              <User size={14} aria-hidden="true" />
              {item.pupil?.name || 'Unknown pupil'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BookOpen size={14} aria-hidden="true" />
              {item.course?.title || item.course?.slug || 'Unknown course'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} aria-hidden="true" />
              {timeAgo(item.submittedAt)}
            </span>
            {item.attemptNumber ? (
              <span>Attempt {item.attemptNumber}</span>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-turmeric/15 px-3 py-1 text-xs font-bold text-turmeric">
          {max} mark{max === 1 ? '' : 's'} available
        </span>
      </header>

      {/* Why the machine gave up. Stated first, because it tells the marker
          what kind of judgement is being asked of them. */}
      <div className="mb-4 flex items-start gap-2 rounded-xl bg-surface/60 p-3">
        <AlertTriangle size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-turmeric" />
        <p className="text-sm text-text-secondary">{item.reason}</p>
      </div>

      <div className="space-y-4">
        <section>
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-text-secondary">
            The question
          </h3>
          <p className="whitespace-pre-wrap text-sm text-text-primary">{item.prompt}</p>
        </section>

        <section>
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-text-secondary">
            What the pupil wrote
          </h3>
          <pre className="max-h-72 overflow-auto rounded-xl border border-k-border bg-surface p-3 text-sm text-text-primary">
            <code>{String(item.response || '(nothing submitted)')}</code>
          </pre>
        </section>

        {item.expectedOutcome ? (
          <section>
            <h3 className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-turmeric">
              Mark scheme
              <span className="rounded bg-turmeric/15 px-1.5 py-0.5 text-[10px] normal-case tracking-normal">
                staff only — never shown to pupils
              </span>
            </h3>
            <p className="whitespace-pre-wrap rounded-xl border border-turmeric/30 bg-turmeric/5 p-3 text-sm text-text-primary">
              {item.expectedOutcome}
            </p>
          </section>
        ) : null}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-3 border-t border-k-border pt-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor={`marks-${item.attemptId}-${item.questionId}`}
              className="mb-1.5 block text-sm font-semibold text-text-primary"
            >
              Marks awarded
            </label>
            <div className="flex items-center gap-2">
              <input
                id={`marks-${item.attemptId}-${item.questionId}`}
                type="number"
                min={0}
                max={max}
                step={1}
                inputMode="numeric"
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                aria-describedby={`marks-hint-${item.questionId}`}
                className="w-24 rounded-lg border border-k-border bg-surface px-3 py-2 text-text-primary focus:border-turmeric focus:outline-none focus:ring-2 focus:ring-turmeric/40"
              />
              <span className="text-sm text-text-secondary">of {max}</span>
            </div>
          </div>

          <div className="min-w-[16rem] flex-1">
            <label
              htmlFor={`comment-${item.questionId}`}
              className="mb-1.5 block text-sm font-semibold text-text-primary"
            >
              Note <span className="font-normal text-text-secondary">(optional)</span>
            </label>
            <input
              id={`comment-${item.questionId}`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={2000}
              placeholder="Why this mark — recorded on the attempt"
              className="w-full rounded-lg border border-k-border bg-surface px-3 py-2 text-text-primary placeholder:text-text-secondary/70 focus:border-turmeric focus:outline-none focus:ring-2 focus:ring-turmeric/40"
            />
          </div>

          <Button type="submit" disabled={!ready || isLoading}>
            {isLoading ? 'Saving…' : 'Award marks'}
          </Button>
        </div>

        <p id={`marks-hint-${item.questionId}`} className="text-xs text-text-secondary">
          {outOfRange
            ? `Must be between 0 and ${max}.`
            : `The server caps this at the question's ${max} mark${max === 1 ? '' : 's'} and rescores the whole paper from the blueprint, so a total can never exceed 200. Every mark is recorded in the activity log against your name.`}
        </p>

        {error ? (
          <p role="alert" className="text-sm font-semibold text-error">
            {error}
          </p>
        ) : null}
      </form>
    </motion.article>
  );
}

export default function MarkingQueue() {
  const { data, isLoading, isError, error, refetch } = useGetReviewQueueQuery({ limit: 50 });
  const items = data?.items || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marking queue"
        subtitle={
          isLoading
            ? 'Loading…'
            : items.length === 0
              ? 'Nothing is waiting to be marked'
              : `${items.length} answer${items.length === 1 ? '' : 's'} waiting, oldest first`
        }
      />

      <div className="flex items-start gap-3 rounded-2xl border border-k-border bg-card p-4">
        <span className="mt-0.5 shrink-0 text-turmeric">
          <ClipboardCheck size={18} aria-hidden="true" />
        </span>
        <div className="text-sm text-text-secondary">
          <p className="mb-1 font-semibold text-text-primary">
            These marks are withheld, not zero.
          </p>
          <p>
            When an answer cannot be checked automatically the platform holds the mark back
            rather than guessing. Until you award it, the pupil&apos;s score is lower than
            their work deserves — so this queue is the difference between a fair result and
            an unfair one. Oldest submissions come first.
          </p>
        </div>
      </div>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        isEmpty={!isLoading && !isError && items.length === 0}
        emptyTitle="Nothing to mark"
        emptyMessage="Every answer that needed a human has been marked. New ones appear here as pupils submit final tests."
        refetch={refetch}
      >
        <div className="space-y-5">
          {items.map((item) => (
            <MarkingCard
              key={`${item.attemptId}-${item.questionId}`}
              item={item}
              onMarked={refetch}
            />
          ))}
        </div>
      </QueryState>
    </div>
  );
}

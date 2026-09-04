import { useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Archive,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import QueryState from '../../components/ui/QueryState';
import { COURSES as COURSE_TABS } from '../../config/courses';
import DataTable from '../../components/ui/DataTable';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import QuestionEditorModal from '../../components/questions/QuestionEditorModal';
import { formatApiError } from '../../utils/apiError';
import {
  useGetQuestionsQuery,
  useGetBankCoverageQuery,
  useRetireQuestionMutation,
  useDeleteQuestionMutation,
} from '../../features/superadmin/superadminApi';

/**
 * THE FINAL-TEST QUESTION BANK.
 *
 * Superadmin-only: this page shows the mark scheme for every final test.
 *
 * The coverage panel leads, and that is the point of the page. A bank that
 * cannot fill a section produces a failure nobody sees until the worst possible
 * moment — a pupil who has finished an entire course pressing "Start test" and
 * being told there are not enough questions. So the shortfall is the first
 * thing on screen, per section, with the numbers rather than a warning icon.
 */

// Mirrors the backend ladder. Hardcoded rather than fetched: the four courses
// are fixed by config/courses.js, and a dropdown that has to wait on a request
// before it can be used is worse than one that is simply right.
const TYPE_LABELS = {
  mcq: 'Multiple choice',
  fillblank: 'Fill in the blank',
  coding: 'Coding',
  task: 'Build task',
};

export default function QuestionBank() {
  const [courseSlug, setCourseSlug] = useState('python');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [confirmRetire, setConfirmRetire] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionError, setActionError] = useState('');

  const query = useGetQuestionsQuery({
    courseSlug,
    ...(type ? { type } : {}),
    ...(search ? { search } : {}),
    limit: 100,
  });
  const coverage = useGetBankCoverageQuery(courseSlug);

  const [retire, { isLoading: retiring }] = useRetireQuestionMutation();
  const [remove, { isLoading: removing }] = useDeleteQuestionMutation();

  const questions = query.data?.items || [];

  const doRetire = async () => {
    setActionError('');
    try {
      await retire(confirmRetire.id).unwrap();
      setConfirmRetire(null);
    } catch (err) {
      setActionError(formatApiError(err, 'Could not retire the question.'));
    }
  };

  const doDelete = async () => {
    setActionError('');
    try {
      await remove(confirmDelete.id).unwrap();
      setConfirmDelete(null);
    } catch (err) {
      // The server refuses to delete a question that past attempts drew, and
      // its message explains why and points at retire. Surfacing it verbatim
      // is more useful than anything this page could invent.
      setActionError(formatApiError(err, 'Could not delete the question.'));
    }
  };

  const columns = useMemo(
    () => [
      {
        key: 'prompt',
        header: 'Question',
        render: (r) => (
          <div className="min-w-0 max-w-[28rem]">
            <p className={`truncate text-sm ${r.active ? 'text-text-primary' : 'text-text-secondary/70'}`}>
              {r.prompt}
            </p>
            <p className="truncate text-xs text-text-secondary/70">
              {TYPE_LABELS[r.type] || r.type}
              {r.difficulty === 'advanced' && ' · advanced'}
              {!r.active && ' · retired'}
            </p>
          </div>
        ),
      },
      {
        key: 'markScheme',
        header: 'Mark scheme',
        sortable: false,
        render: (r) => <MarkSchemeSummary question={r} />,
      },
      {
        key: 'status',
        header: 'Status',
        render: (r) =>
          r.active ? (
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
              In use
            </span>
          ) : (
            <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-text-secondary/70">
              Retired
            </span>
          ),
      },
      {
        key: 'actions',
        header: 'Actions',
        sortable: false,
        searchable: false,
        render: (r) => (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditing(r)}
              aria-label={`Edit: ${r.prompt.slice(0, 40)}`}
              title="Edit"
              className="rounded-lg p-1.5 text-text-secondary hover:bg-surface hover:text-turmeric"
            >
              <Pencil size={15} />
            </button>
            {r.active && (
              <button
                onClick={() => setConfirmRetire(r)}
                aria-label={`Retire: ${r.prompt.slice(0, 40)}`}
                title="Retire — keeps it for past attempts, never drawn again"
                className="rounded-lg p-1.5 text-text-secondary hover:bg-surface hover:text-turmeric"
              >
                <Archive size={15} />
              </button>
            )}
            <button
              onClick={() => setConfirmDelete(r)}
              aria-label={`Delete: ${r.prompt.slice(0, 40)}`}
              title="Delete permanently"
              className="rounded-lg p-1.5 text-text-secondary hover:bg-surface hover:text-error"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question bank"
        subtitle="Final tests are drawn from these questions — a fresh paper for every attempt"
      >
        <Button icon={Plus} onClick={() => setEditing({})}>
          New question
        </Button>
      </PageHeader>

      {/* Course tabs. One bank per language track. */}
      <div className="flex flex-wrap gap-1.5">
        {COURSE_TABS.map((c) => (
          <button
            key={c.slug}
            onClick={() => setCourseSlug(c.slug)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              courseSlug === c.slug
                ? 'bg-turmeric text-malt'
                : 'bg-surface text-text-secondary hover:text-turmeric'
            }`}
          >
            {c.title}
          </button>
        ))}
      </div>

      <CoveragePanel coverage={coverage} />

      {actionError && (
        <p className="flex items-start gap-2 rounded-xl border border-error/50 bg-error/10 px-3 py-2 text-sm text-error">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{actionError}</span>
        </p>
      )}

      <section className="k-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-k-border p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/70"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions…"
              aria-label="Search questions"
              className="k-input w-full pl-9"
            />
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Filter by type"
            className="k-input w-full sm:w-48"
          >
            <option value="">All types</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* QueryState owns the empty state too, so this page does not invent a
            second look for "nothing here". */}
        <QueryState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          refetch={query.refetch}
          loadingLabel="Loading questions…"
          isEmpty={questions.length === 0}
          emptyIcon={FileQuestion}
          emptyTitle="No questions for this course yet"
          emptyMessage="Add questions until every section above is covered — then pupils can sit the final test."
        >
          <DataTable columns={columns} data={questions} pageSize={15} searchKeys={[]} />
        </QueryState>
      </section>

      <QuestionEditorModal
        open={Boolean(editing)}
        question={editing?.id ? editing : { ...editing, courseSlug }}
        courses={COURSE_TABS}
        onClose={() => setEditing(null)}
      />

      <ConfirmDialog
        open={Boolean(confirmRetire)}
        title="Retire this question?"
        message={
          'It stays in the bank so past attempts still make sense, but it will never be ' +
          'drawn into a new test again. You can bring it back by editing it.'
        }
        confirmLabel="Retire"
        variant="primary"
        loading={retiring}
        onConfirm={doRetire}
        onClose={() => setConfirmRetire(null)}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete this question permanently?"
        message={
          'This cannot be undone. If any pupil has already been given this question in a ' +
          'test, deletion is refused — retire it instead.'
        }
        confirmLabel="Delete"
        variant="danger"
        loading={removing}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Whether this course's bank can produce a test, and where it is short.
 *
 * Leads the page because the shortfall it reports is otherwise invisible until
 * a pupil is blocked by it.
 */
function CoveragePanel({ coverage }) {
  const data = coverage.data;
  if (coverage.isLoading) return <div className="skeleton h-28 w-full rounded-2xl" />;
  if (!data) return null;

  return (
    <section className={`k-card p-4 sm:p-5 ${data.ready ? 'border-success/40' : 'border-error/40'}`}>
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 rounded-full p-2 ${
            data.ready ? 'bg-success/15 text-success' : 'bg-error/15 text-error'
          }`}
        >
          {data.ready ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-base font-bold text-text-primary">{data.summary}</h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            Every attempt draws a fresh paper, so each section needs enough questions to fill it.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-text-secondary/70">
                  <th className="pb-2 text-left font-semibold">Section</th>
                  <th className="pb-2 text-right font-semibold">Needed</th>
                  <th className="pb-2 text-right font-semibold">Available</th>
                  <th className="pb-2 text-right font-semibold">Short by</th>
                  <th className="pb-2 text-right font-semibold">Marks</th>
                </tr>
              </thead>
              <tbody>
                {data.sections.map((s) => (
                  <tr key={s.section} className="border-t border-k-border">
                    <td className="py-2 text-text-primary">
                      {s.label}
                      {s.difficulty === 'advanced' && (
                        <span className="ml-1.5 text-xs text-text-secondary/70">advanced</span>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums text-text-secondary">{s.needed}</td>
                    <td className="py-2 text-right tabular-nums text-text-secondary">
                      {s.available}
                    </td>
                    <td
                      className={`py-2 text-right font-semibold tabular-nums ${
                        s.shortfall > 0 ? 'text-error' : 'text-success'
                      }`}
                    >
                      {s.shortfall > 0 ? s.shortfall : '—'}
                    </td>
                    <td className="py-2 text-right tabular-nums text-text-secondary/70">
                      {s.sectionPoints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

/** A one-line summary of how a question is marked, for the table. */
function MarkSchemeSummary({ question }) {
  if (question.type === 'mcq') {
    const answer = question.options?.[question.answerIndex];
    return (
      <span className="block max-w-[14rem] truncate text-xs text-text-secondary">
        {question.options?.length || 0} options · answer:{' '}
        <span className="text-success">{answer || '—'}</span>
      </span>
    );
  }
  if (question.type === 'fillblank') {
    return (
      <span className="block max-w-[14rem] truncate text-xs text-text-secondary">
        accepts: <span className="text-success">{(question.acceptedAnswers || []).join(', ')}</span>
      </span>
    );
  }
  if (question.type === 'coding') {
    const cases = question.testCases || [];
    const visible = cases.filter((c) => c.visible).length;
    return (
      <span className="text-xs text-text-secondary">
        {cases.length} test case{cases.length === 1 ? '' : 's'}
        {visible > 0 && ` · ${visible} shown`}
      </span>
    );
  }
  return (
    <span className="block max-w-[14rem] truncate text-xs text-text-secondary">
      {question.expectedOutcome || 'no outcome set'}
    </span>
  );
}

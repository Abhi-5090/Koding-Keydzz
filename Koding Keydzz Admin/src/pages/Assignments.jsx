import { useMemo, useState } from 'react';
import {
  ClipboardList,
  Plus,
  Archive,
  CalendarClock,
  CheckCircle2,
} from 'lucide-react';
import {
  useGetClassroomsQuery,
  useGetClassroomAssignmentsQuery,
  useCreateAssignmentMutation,
  useArchiveAssignmentMutation,
  useGetWorldsQuery,
  useGetQuizzesQuery,
  useGetCoursesQuery,
  useGetWorldLessonsQuery,
} from '../features/admin/adminApi';
import PageHeader from '../components/ui/PageHeader';
import QueryState from '../components/ui/QueryState';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { formatApiError } from '../utils/apiError';

/**
 * SETTING WORK — "finish this by Friday".
 *
 * The primitive the product did not have. Everything a pupil did was
 * pupil-initiated, so a teacher with a login had nothing to do here.
 *
 * THERE IS NO "MARK AS DONE" ANYWHERE ON THIS SCREEN, DELIBERATELY.
 * ----------------------------------------------------------------
 * Completion is derived on the server from progress the pupil already
 * recorded — a completed lesson, a passed quiz, a beaten game level. A pupil
 * who does the work is done, whether or not anybody presses anything. The
 * alternative, a stored submission, produces "it says I haven't done it but I
 * have" the moment the two records disagree.
 *
 * So this page sets work and shows who still owes it. The outstanding pupils
 * are NAMED rather than just counted, because "18 of 24" tells a teacher there
 * is a problem and the six names tell them what to do about it, which is the
 * only reason to open this screen.
 */

const TARGET_KINDS = [
  { value: 'lesson', label: 'A lesson' },
  { value: 'world', label: 'A whole world' },
  { value: 'quiz', label: 'A quiz' },
  { value: 'course', label: 'A whole course' },
  { value: 'game', label: 'A game level' },
];

/** The games a level can be set on. Matches the student app's catalogue. */
const GAMES = [
  'sudoku',
  'patches',
  'zip',
  'n-queens',
  'tic-tac-toe',
  'hanoi',
  'maze-coding',
  'robot-navigation',
  'treasure-hunt',
  'space-adventure',
];

function dueLabel(dueAt) {
  if (!dueAt) return 'No deadline';
  const due = new Date(dueAt);
  const days = Math.round((due.getTime() - Date.now()) / 86_400_000);
  const date = due.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  if (days < 0) return `Overdue — was due ${date}`;
  if (days === 0) return `Due today (${date})`;
  if (days === 1) return `Due tomorrow (${date})`;
  return `Due ${date}`;
}

/** The set-work form. Kept in a modal so the list stays the main thing. */
function AssignmentForm({ classroomId, onDone, onCancel }) {
  const [createAssignment, { isLoading }] = useCreateAssignmentMutation();
  const worlds = useGetWorldsQuery();
  const quizzes = useGetQuizzesQuery();
  const courses = useGetCoursesQuery();

  const [form, setForm] = useState({
    title: '',
    instructions: '',
    kind: 'lesson',
    ref: '',
    level: '',
    dueAt: '',
  });
  const [error, setError] = useState('');

  const worldList = useMemo(
    () => (Array.isArray(worlds.data) ? worlds.data : worlds.data?.items || []),
    [worlds.data]
  );
  const quizList = useMemo(
    () => (Array.isArray(quizzes.data) ? quizzes.data : quizzes.data?.items || []),
    [quizzes.data]
  );
  const courseList = useMemo(
    () => (Array.isArray(courses.data) ? courses.data : courses.data?.items || []),
    [courses.data]
  );

  /**
   * LESSONS ARE PICKED IN TWO STEPS: a world, then a lesson inside it.
   *
   * The first version of this form built one flat list by reading `w.lessons`
   * off each world. `GET /admin/worlds` does not return nested lessons — they
   * come from `/worlds/:id/lessons` — so the list was always empty, and since
   * "A lesson" is the form's default kind, the "which one" picker was empty
   * every time the dialog opened. The form looked broken on arrival.
   *
   * Flattening every world's lessons into one list would also mean one request
   * per world just to open a dialog. Choosing the world first is both correct
   * and cheaper, and it is how a teacher thinks about it anyway.
   */
  const [lessonWorldId, setLessonWorldId] = useState('');
  const worldLessons = useGetWorldLessonsQuery(lessonWorldId, { skip: !lessonWorldId });

  const lessonOptions = useMemo(() => {
    const raw = worldLessons.data;
    const list = Array.isArray(raw) ? raw : raw?.lessons || raw?.items || [];
    return list.map((l) => ({ id: l.id || l._id, label: l.title }));
  }, [worldLessons.data]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createAssignment({
        classroomId,
        title: form.title,
        instructions: form.instructions,
        target: {
          kind: form.kind,
          ref: form.ref,
          ...(form.kind === 'game' ? { level: Number(form.level) } : {}),
        },
        // A local datetime from the input is converted to an instant here; the
        // server stores instants and the API schema requires ISO.
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
      }).unwrap();
      onDone();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const refOptions =
    form.kind === 'lesson'
      ? lessonOptions
      : form.kind === 'world'
        ? worldList.map((w) => ({ id: w.id || w._id, label: w.name }))
        : form.kind === 'quiz'
          ? quizList.map((q) => ({ id: q.id || q._id, label: q.title }))
          : form.kind === 'course'
            ? courseList.map((c) => ({ id: c.slug, label: c.title }))
            : GAMES.map((g) => ({ id: g, label: g.replace(/-/g, ' ') }));

  const ready = form.title.trim().length >= 2 && form.ref && (form.kind !== 'game' || form.level);

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="a-title" className="mb-1.5 block text-sm font-semibold text-text-primary">
          What are they doing?
        </label>
        <input
          id="a-title"
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
          maxLength={160}
          required
          placeholder="Finish World 3 before Friday"
          className="w-full rounded-lg border border-k-border bg-surface px-3 py-2 text-text-primary placeholder:text-text-secondary/70 focus:border-turmeric focus:outline-none focus:ring-2 focus:ring-turmeric/40"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="a-kind" className="mb-1.5 block text-sm font-semibold text-text-primary">
            Kind of work
          </label>
          <select
            id="a-kind"
            value={form.kind}
            onChange={(e) => {
              set({ kind: e.target.value, ref: '', level: '' });
              setLessonWorldId('');
            }}
            className="w-full rounded-lg border border-k-border bg-surface px-3 py-2 text-text-primary focus:border-turmeric focus:outline-none focus:ring-2 focus:ring-turmeric/40"
          >
            {TARGET_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="a-ref" className="mb-1.5 block text-sm font-semibold text-text-primary">
            Which one
          </label>
          {/* A lesson cannot be chosen before its world is. */}
          <select
            id="a-ref"
            value={form.ref}
            onChange={(e) => set({ ref: e.target.value })}
            required
            disabled={form.kind === 'lesson' && !lessonWorldId}
            className="w-full rounded-lg border border-k-border bg-surface px-3 py-2 text-text-primary focus:border-turmeric focus:outline-none focus:ring-2 focus:ring-turmeric/40"
          >
            <option value="">Choose…</option>
            {refOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {form.kind === 'lesson' ? (
        <div>
          <label
            htmlFor="a-lesson-world"
            className="mb-1.5 block text-sm font-semibold text-text-primary"
          >
            Which world is the lesson in?
          </label>
          <select
            id="a-lesson-world"
            value={lessonWorldId}
            onChange={(e) => {
              setLessonWorldId(e.target.value);
              // The old lesson belongs to the old world; clearing it stops a
              // stale id being submitted against a different world.
              set({ ref: '' });
            }}
            className="w-full rounded-lg border border-k-border bg-surface px-3 py-2 text-text-primary focus:border-turmeric focus:outline-none focus:ring-2 focus:ring-turmeric/40"
          >
            <option value="">Choose a world…</option>
            {worldList.map((w) => (
              <option key={w.id || w._id} value={w.id || w._id}>
                {w.name}
              </option>
            ))}
          </select>
          {lessonWorldId && !worldLessons.isLoading && lessonOptions.length === 0 ? (
            <p className="mt-1.5 text-xs text-text-secondary">
              That world has no lessons yet — pick another, or set a different kind of work.
            </p>
          ) : null}
        </div>
      ) : null}

      {form.kind === 'game' ? (
        <div>
          <label htmlFor="a-level" className="mb-1.5 block text-sm font-semibold text-text-primary">
            Level to reach
          </label>
          <input
            id="a-level"
            type="number"
            min={1}
            value={form.level}
            onChange={(e) => set({ level: e.target.value })}
            required
            className="w-32 rounded-lg border border-k-border bg-surface px-3 py-2 text-text-primary focus:border-turmeric focus:outline-none focus:ring-2 focus:ring-turmeric/40"
          />
        </div>
      ) : null}

      <div>
        <label htmlFor="a-due" className="mb-1.5 block text-sm font-semibold text-text-primary">
          Due <span className="font-normal text-text-secondary">(optional)</span>
        </label>
        <input
          id="a-due"
          type="datetime-local"
          value={form.dueAt}
          onChange={(e) => set({ dueAt: e.target.value })}
          aria-describedby="a-due-hint"
          className="rounded-lg border border-k-border bg-surface px-3 py-2 text-text-primary focus:border-turmeric focus:outline-none focus:ring-2 focus:ring-turmeric/40"
        />
        <p id="a-due-hint" className="mt-1.5 text-xs text-text-secondary">
          Leave it empty for &ldquo;whenever&rdquo;. A date in the past is refused — it would
          show the whole class in red for work they were never given time to do.
        </p>
      </div>

      <div>
        <label htmlFor="a-notes" className="mb-1.5 block text-sm font-semibold text-text-primary">
          Notes for the class <span className="font-normal text-text-secondary">(optional)</span>
        </label>
        <textarea
          id="a-notes"
          rows={3}
          maxLength={2000}
          value={form.instructions}
          onChange={(e) => set({ instructions: e.target.value })}
          className="w-full rounded-lg border border-k-border bg-surface px-3 py-2 text-text-primary focus:border-turmeric focus:outline-none focus:ring-2 focus:ring-turmeric/40"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={!ready || isLoading}>
          {isLoading ? 'Setting…' : 'Set work'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function AssignmentRow({ item, classroomId, onArchive }) {
  const overdue = item.dueAt && new Date(item.dueAt).getTime() < Date.now();
  const allDone = item.completed === item.pupils && item.pupils > 0;

  return (
    <article className="rounded-2xl border border-k-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading text-base font-bold text-text-primary">{item.title}</h3>
          <p className="mt-0.5 text-sm text-text-secondary">
            {item.target.label || item.target.ref}
            {item.target.kind ? ` · ${item.target.kind}` : ''}
          </p>
          {item.instructions ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">
              {item.instructions}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
              overdue
                ? 'bg-error/15 text-error'
                : item.dueAt
                  ? 'bg-turmeric/15 text-turmeric'
                  : 'bg-surface text-text-secondary'
            }`}
          >
            <CalendarClock size={12} aria-hidden="true" />
            {dueLabel(item.dueAt)}
          </span>
          <button
            type="button"
            onClick={() => onArchive(item)}
            aria-label={`Archive ${item.title}`}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-surface hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric/40"
          >
            <Archive size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-4 border-t border-k-border pt-3">
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
            <div
              className={`h-full rounded-full ${allDone ? 'bg-success' : 'bg-turmeric'}`}
              style={{ width: `${item.completionRate}%` }}
            />
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-text-primary">
            {item.completed} of {item.pupils}
          </span>
        </div>

        {allDone ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-success">
            <CheckCircle2 size={14} aria-hidden="true" />
            Everybody has done this.
          </p>
        ) : item.outstanding?.length ? (
          <p className="mt-2 text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">Still to do:</span>{' '}
            {item.outstanding.map((p) => p.name).join(', ')}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export default function Assignments() {
  const classrooms = useGetClassroomsQuery({ limit: 100 });
  const [classroomId, setClassroomId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [archiveAssignment] = useArchiveAssignmentMutation();

  const classList = useMemo(() => {
    const d = classrooms.data;
    return Array.isArray(d) ? d : d?.items || [];
  }, [classrooms.data]);

  // Default to the first class the user can see, so the page is useful on
  // arrival rather than showing an empty picker.
  const activeId = classroomId || classList[0]?.id || '';

  const query = useGetClassroomAssignmentsQuery(
    { classroomId: activeId },
    { skip: !activeId }
  );
  const items = query.data?.items || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignments"
        subtitle="Set work with a deadline, and see who still owes it"
      >
        {activeId ? (
          <Button icon={Plus} onClick={() => setShowForm(true)}>
            Set work
          </Button>
        ) : null}
      </PageHeader>

      <div className="flex items-start gap-3 rounded-2xl border border-k-border bg-card p-4">
        <span className="mt-0.5 shrink-0 text-turmeric">
          <ClipboardList size={18} aria-hidden="true" />
        </span>
        <p className="text-sm text-text-secondary">
          There is no &ldquo;mark as done&rdquo; here on purpose. A pupil counts as having
          finished an assignment when they have actually done the work — completed the
          lesson, passed the quiz, beaten the level — so nobody has to remember to hand
          anything in, and this page can never disagree with their progress.
        </p>
      </div>

      <QueryState
        isLoading={classrooms.isLoading}
        isError={classrooms.isError}
        error={classrooms.error}
        refetch={classrooms.refetch}
        isEmpty={!classrooms.isLoading && classList.length === 0}
        emptyTitle="No classes yet"
        emptyMessage="Assignments are set for a class. Create a class first, then come back."
      >
        <div>
          <label
            htmlFor="class-picker"
            className="mb-1.5 block text-sm font-semibold text-text-primary"
          >
            Class
          </label>
          <select
            id="class-picker"
            value={activeId}
            onChange={(e) => setClassroomId(e.target.value)}
            className="rounded-lg border border-k-border bg-surface px-3 py-2 text-text-primary focus:border-turmeric focus:outline-none focus:ring-2 focus:ring-turmeric/40"
          >
            {classList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.studentCount != null ? ` (${c.studentCount})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5">
          <QueryState
            isLoading={query.isLoading}
            isError={query.isError}
            error={query.error}
            refetch={query.refetch}
            isEmpty={!query.isLoading && !query.isError && items.length === 0}
            emptyTitle="No work set for this class"
            emptyMessage="Use “Set work” to give them something with a deadline. Completion is tracked from their progress automatically."
          >
            <div className="space-y-4">
              {items.map((item) => (
                <AssignmentRow
                  key={item.id}
                  item={item}
                  classroomId={activeId}
                  onArchive={setConfirm}
                />
              ))}
            </div>
          </QueryState>
        </div>
      </QueryState>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Set work for this class"
      >
        <AssignmentForm
          classroomId={activeId}
          onDone={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm ? `Archive “${confirm.title}”?` : ''}
        message="It disappears from the class's list and from every pupil's, but stays in the record — last term's work is part of their history, so it is archived rather than deleted."
        confirmLabel="Archive"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          try {
            await archiveAssignment({
              id: confirm.id,
              classroomId: activeId,
              archive: true,
            }).unwrap();
          } catch {
            /* the list re-reads from the server either way */
          }
          setConfirm(null);
        }}
      />
    </div>
  );
}

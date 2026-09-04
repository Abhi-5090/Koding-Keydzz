import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Pencil,
  Trash2,
  HelpCircle,
  Zap,
  X,
  ArrowLeftRight,
  Loader2,
  GripVertical,
} from 'lucide-react';
import {
  useGetQuizzesQuery,
  useGetQuizQuery,
  useCreateQuizMutation,
  useUpdateQuizMutation,
  useDeleteQuizMutation,
  useGetWorldsQuery,
  useGetWorldLessonsQuery,
} from '../features/admin/adminApi';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import FormField from '../components/ui/FormField';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PageHeader from '../components/ui/PageHeader';
import { useCan } from '../features/auth/useCan';
import QueryState from '../components/ui/QueryState';
import AnimatedIcon from '../components/ui/AnimatedIcon';
import { formatApiError } from '../utils/apiError';

function asList(data) {
  if (Array.isArray(data)) return data;
  return data?.quizzes || [];
}

const QUESTION_TYPES = ['mcq', 'fillblank', 'match', 'dragdrop'];
const TYPE_LABELS = {
  mcq: 'Multiple Choice',
  fillblank: 'Fill in the Blank',
  match: 'Match Pairs',
  dragdrop: 'Drag & Drop (order)',
};

const uid = () => `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const emptyQuiz = {
  title: '',
  world: '',
  lesson: '',
  xpReward: 50,
  questions: [],
};

// Build a fresh question in the exact payload shape:
//   { type, prompt, options?, answer, points }
// (`_id` is a client-only React key stripped before sending.)
function newQuestion(type = 'mcq') {
  const base = { _id: uid(), type, prompt: '', points: 10 };
  if (type === 'mcq') return { ...base, options: ['', ''], answer: 0 };
  if (type === 'fillblank') return { ...base, answer: [''] };
  if (type === 'match') return { ...base, answer: [{ left: '', right: '' }] };
  if (type === 'dragdrop') return { ...base, answer: ['', ''] };
  return base;
}

// Normalise a server question (which now includes answers) into the editor shape.
function hydrateQuestion(raw) {
  const type = raw?.type || 'mcq';
  const base = {
    _id: uid(),
    type,
    prompt: raw?.prompt || '',
    points: raw?.points ?? 10,
  };
  if (type === 'mcq') {
    return {
      ...base,
      options:
        Array.isArray(raw.options) && raw.options.length
          ? raw.options
          : ['', ''],
      answer: typeof raw.answer === 'number' ? raw.answer : 0,
    };
  }
  if (type === 'fillblank') {
    const ans = Array.isArray(raw.answer)
      ? raw.answer
      : raw.answer != null
        ? [String(raw.answer)]
        : [''];
    return { ...base, answer: ans.length ? ans : [''] };
  }
  if (type === 'match') {
    const pairs = Array.isArray(raw.answer)
      ? raw.answer.map((p) => ({ left: p?.left ?? '', right: p?.right ?? '' }))
      : [{ left: '', right: '' }];
    return {
      ...base,
      answer: pairs.length ? pairs : [{ left: '', right: '' }],
    };
  }
  if (type === 'dragdrop') {
    const items = Array.isArray(raw.answer) ? raw.answer.map(String) : ['', ''];
    return { ...base, answer: items.length ? items : ['', ''] };
  }
  return base;
}

/** An id from either a populated object or a bare id. */
const idOf = (v) =>
  v && typeof v === 'object' ? v.id || v._id || '' : v || '';
/** A display label from a populated world/lesson, never the object itself. */
const labelOf = (v) => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return v.name || v.title || '';
};

function hydrateQuiz(quiz) {
  return {
    id: quiz.id,
    title: quiz.title || '',
    /**
     * The API READS these back as objects — `world: {id, name, slug}`,
     * `lesson: {id, title}` — but WRITES expect an ObjectId. Seeding the raw
     * object caused two separate faults: the list rendered an object as a
     * React child (error #31, which crashed the whole page), and saving sent a
     * name where an id was required, so the request came back "Validation
     * failed". Both are fixed by normalising to the id here.
     */
    world: idOf(quiz.world),
    lesson: idOf(quiz.lesson),
    xpReward: quiz.xpReward ?? 50,
    questions: (quiz.questions || []).map(hydrateQuestion),
  };
}

// Turn the editor state back into the API body shape.
function dehydrateQuestion(q) {
  const base = {
    type: q.type,
    prompt: q.prompt.trim(),
    points: Number(q.points) || 0,
  };
  if (q.type === 'mcq') {
    const options = q.options.map((o) => o.trim());
    return { ...base, options, answer: q.answer };
  }
  if (q.type === 'fillblank') {
    return { ...base, answer: q.answer.map((a) => a.trim()).filter(Boolean) };
  }
  if (q.type === 'match') {
    return {
      ...base,
      answer: q.answer
        .map((p) => ({ left: p.left.trim(), right: p.right.trim() }))
        .filter((p) => p.left || p.right),
    };
  }
  if (q.type === 'dragdrop') {
    return { ...base, answer: q.answer.map((i) => i.trim()).filter(Boolean) };
  }
  return base;
}

function buildPayload(data) {
  return {
    title: data.title.trim(),
    // Already normalised to an id by hydrateQuiz / the pickers below.
    world: idOf(data.world) || undefined,
    lesson: idOf(data.lesson) || undefined,
    xpReward: Number(data.xpReward) || 0,
    questions: data.questions.map(dehydrateQuestion),
  };
}

// ---- Per-question editor ----
function QuestionEditor({ question, onChange, onRemove, index }) {
  const update = (patch) => onChange({ ...question, ...patch });
  const changeType = (type) =>
    onChange({
      ...newQuestion(type),
      _id: question._id,
      prompt: question.prompt,
      points: question.points,
    });

  return (
    <div className="rounded-xl border border-k-border bg-malt/40 p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-turmeric/20 text-xs font-bold text-turmeric">
          {index + 1}
        </span>
        <select
          value={question.type}
          onChange={(e) => changeType(e.target.value)}
          className="k-input min-w-0 flex-1"
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          value={question.points}
          onChange={(e) => update({ points: e.target.value })}
          aria-label="Points"
          title="Points"
          className="k-input w-20 shrink-0"
          placeholder="Pts"
        />
        <button
          onClick={onRemove}
          aria-label="Remove question"
          className="shrink-0 rounded-lg p-1.5 text-text-secondary hover:text-error"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <FormField
        label="Prompt"
        name="prompt"
        value={question.prompt}
        onChange={(e) => update({ prompt: e.target.value })}
        placeholder="Ask a question..."
      />

      {question.type === 'mcq' && (
        <div className="mt-3 space-y-2">
          <p className="k-label">Options (select the correct one)</p>
          {question.options.map((opt, i) => (
            <div key={i} className="flex min-w-0 items-center gap-2">
              <input
                type="radio"
                name={`ans_${question._id}`}
                checked={question.answer === i}
                onChange={() => update({ answer: i })}
                className="h-4 w-4 shrink-0 accent-turmeric"
              />
              <input
                value={opt}
                onChange={(e) =>
                  update({
                    options: question.options.map((o, j) =>
                      j === i ? e.target.value : o,
                    ),
                  })
                }
                placeholder={`Option ${i + 1}`}
                className="k-input min-w-0 flex-1"
              />
              {question.options.length > 2 && (
                <button
                  onClick={() =>
                    update({
                      options: question.options.filter((_, j) => j !== i),
                      answer:
                        question.answer >= i
                          ? Math.max(0, question.answer - 1)
                          : question.answer,
                    })
                  }
                  aria-label="Remove option"
                  className="shrink-0 text-text-secondary hover:text-error"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
          <Button
            size="sm"
            variant="ghost"
            icon={Plus}
            onClick={() => update({ options: [...question.options, ''] })}
          >
            Add option
          </Button>
        </div>
      )}

      {question.type === 'fillblank' && (
        <div className="mt-3 space-y-2">
          <p className="k-label">Accepted answer(s)</p>
          {question.answer.map((ans, i) => (
            <div key={i} className="flex min-w-0 items-center gap-2">
              <input
                value={ans}
                onChange={(e) =>
                  update({
                    answer: question.answer.map((a, j) =>
                      j === i ? e.target.value : a,
                    ),
                  })
                }
                placeholder={`Accepted answer ${i + 1}`}
                className="k-input min-w-0 flex-1"
              />
              {question.answer.length > 1 && (
                <button
                  onClick={() =>
                    update({
                      answer: question.answer.filter((_, j) => j !== i),
                    })
                  }
                  aria-label="Remove accepted answer"
                  className="shrink-0 text-text-secondary hover:text-error"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
          <Button
            size="sm"
            variant="ghost"
            icon={Plus}
            onClick={() => update({ answer: [...question.answer, ''] })}
          >
            Add accepted answer
          </Button>
        </div>
      )}

      {question.type === 'dragdrop' && (
        <div className="mt-3 space-y-2">
          <p className="k-label">Items (in correct order)</p>
          {question.answer.map((it, i) => (
            <div key={i} className="flex min-w-0 items-center gap-2">
              <GripVertical
                size={14}
                className="shrink-0 text-text-secondary/70"
              />
              <span className="shrink-0 text-xs text-text-secondary/70">
                {i + 1}.
              </span>
              <input
                value={it}
                onChange={(e) =>
                  update({
                    answer: question.answer.map((x, j) =>
                      j === i ? e.target.value : x,
                    ),
                  })
                }
                placeholder={`Item ${i + 1}`}
                className="k-input min-w-0 flex-1"
              />
              {question.answer.length > 2 && (
                <button
                  onClick={() =>
                    update({
                      answer: question.answer.filter((_, j) => j !== i),
                    })
                  }
                  aria-label="Remove item"
                  className="shrink-0 text-text-secondary hover:text-error"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
          <Button
            size="sm"
            variant="ghost"
            icon={Plus}
            onClick={() => update({ answer: [...question.answer, ''] })}
          >
            Add item
          </Button>
        </div>
      )}

      {question.type === 'match' && (
        <div className="mt-3 space-y-2">
          <p className="k-label flex items-center gap-1">
            Pairs (left{' '}
            <ArrowLeftRight size={12} className="inline text-text-secondary" />{' '}
            right)
          </p>
          {question.answer.map((pair, i) => (
            <div key={i} className="flex min-w-0 items-center gap-2">
              <input
                value={pair.left}
                onChange={(e) =>
                  update({
                    answer: question.answer.map((p, j) =>
                      j === i ? { ...p, left: e.target.value } : p,
                    ),
                  })
                }
                placeholder="Left"
                className="k-input min-w-0 flex-1"
              />
              <ArrowLeftRight
                size={14}
                className="shrink-0 text-text-secondary"
              />
              <input
                value={pair.right}
                onChange={(e) =>
                  update({
                    answer: question.answer.map((p, j) =>
                      j === i ? { ...p, right: e.target.value } : p,
                    ),
                  })
                }
                placeholder="Right"
                className="k-input min-w-0 flex-1"
              />
              {question.answer.length > 1 && (
                <button
                  onClick={() =>
                    update({
                      answer: question.answer.filter((_, j) => j !== i),
                    })
                  }
                  aria-label="Remove pair"
                  className="shrink-0 text-text-secondary hover:text-error"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
          <Button
            size="sm"
            variant="ghost"
            icon={Plus}
            onClick={() =>
              update({ answer: [...question.answer, { left: '', right: '' }] })
            }
          >
            Add pair
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Quizzes() {
  /**
   * Worlds, for the picker below.
   *
   * The quiz API accepts an ObjectId for `world`/`lesson`, so these cannot be
   * free-text boxes: anything typed into one produced "Validation failed" on
   * save, with no indication of why. A picker can only produce a valid id.
   */
  const { data: worldsData } = useGetWorldsQuery();
  const { data, isError, isLoading, error, refetch } = useGetQuizzesQuery();
  const [createQuiz, { isLoading: creating }] = useCreateQuizMutation();
  const [updateQuiz, { isLoading: updating }] = useUpdateQuizMutation();
  const [deleteQuiz, { isLoading: deleting }] = useDeleteQuizMutation();

  const quizzes = asList(data);

  const [modal, setModal] = useState(null); // { mode, data }
  const [editId, setEditId] = useState(null); // drives the getQuiz fetch for edits
  const [confirm, setConfirm] = useState(null);
  const [formError, setFormError] = useState('');

  /**
   * World and lesson pickers.
   *
   * The lesson list is scoped to the CHOSEN world and only fetched once one is
   * picked — a flat list of every lesson on the platform would be unusable,
   * and a lesson from a different world than the quiz would be a nonsense
   * pairing the API would then have to reject.
   */
  const worldList = Array.isArray(worldsData)
    ? worldsData
    : worldsData?.worlds || [];
  const selectedWorldId = idOf(modal?.data?.world);
  const { data: lessonsData } = useGetWorldLessonsQuery(selectedWorldId, {
    skip: !selectedWorldId,
  });
  const lessonList = Array.isArray(lessonsData)
    ? lessonsData
    : lessonsData?.lessons || [];

  const worldOptions = [
    { value: '', label: 'No world' },
    ...worldList.map((w) => ({ value: String(w._id || w.id), label: w.name })),
  ];
  const lessonOptions = [
    {
      value: '',
      label: selectedWorldId ? 'No lesson' : 'Choose a world first',
    },
    ...lessonList.map((l) => ({
      value: String(l._id || l.id),
      label: l.title,
    })),
  ];

  // Load the full quiz (with answers) when editing.
  const {
    data: quizDetail,
    isFetching: loadingDetail,
    isError: detailError,
  } = useGetQuizQuery(editId, {
    skip: !editId,
  });

  // Hydrate the modal once the full quiz arrives.
  useEffect(() => {
    // Guard against stale detail from a previously-edited quiz.
    if (quizDetail && editId && quizDetail.id === editId) {
      setModal({ mode: 'edit', data: hydrateQuiz(quizDetail) });
    }
  }, [quizDetail, editId]);

  /**
   * Curriculum is GLOBAL — shared by every school — so only the platform owner
   * may write it. Teachers and school administrators hold `content:read` and
   * reach this page legitimately; every write control shown to them returned
   * 403. Hidden rather than disabled, because they can never do it.
   */
  const canWrite = useCan('content:write');

  const openCreate = () => {
    setFormError('');
    setEditId(null);
    setModal({ mode: 'create', data: { ...emptyQuiz, questions: [] } });
  };

  const openEdit = (quiz) => {
    setFormError('');
    setEditId(quiz.id);
    // Placeholder while the detailed quiz loads.
    setModal({ mode: 'edit', data: hydrateQuiz(quiz) });
  };

  const closeModal = () => {
    setModal(null);
    setEditId(null);
    setFormError('');
  };

  const setMeta = (e) =>
    setModal((m) => ({
      ...m,
      data: { ...m.data, [e.target.name]: e.target.value },
    }));

  const setQuestions = (questions) =>
    setModal((m) => ({ ...m, data: { ...m.data, questions } }));

  const save = async () => {
    setFormError('');
    if (!modal.data.title.trim()) {
      setFormError('A quiz title is required.');
      return;
    }
    const payload = buildPayload(modal.data);
    try {
      if (modal.mode === 'create') {
        await createQuiz(payload).unwrap();
      } else {
        await updateQuiz({ id: modal.data.id, ...payload }).unwrap();
      }
      closeModal();
    } catch (err) {
      setFormError(
        formatApiError(err, 'Could not save the quiz. Please try again.'),
      );
    }
  };

  const remove = async (quiz) => {
    try {
      await deleteQuiz(quiz.id).unwrap();
    } catch {
      /* list reflects server state */
    }
    setConfirm(null);
  };

  const detailLoading = modal?.mode === 'edit' && loadingDetail;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quizzes"
        subtitle={isLoading ? 'Loading…' : `${quizzes.length} quizzes`}
      >
        {canWrite ? (
          <Button icon={Plus} onClick={openCreate}>
            New Quiz
          </Button>
        ) : null}
      </PageHeader>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={refetch}
        isEmpty={quizzes.length === 0}
        loadingLabel="Loading quizzes…"
        emptyTitle="No quizzes yet"
        emptyMessage="Build a quiz with MCQ, fill-in-the-blank, match and drag & drop questions."
        emptyIcon={HelpCircle}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {quizzes.map((quiz, i) => {
            const count = quiz.questionCount ?? quiz.questions?.length ?? 0;
            return (
              <motion.div
                key={quiz.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="k-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="shrink-0 rounded-xl bg-turmeric/15 p-2.5 text-turmeric">
                      <HelpCircle size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-heading font-bold text-text-primary">
                        {quiz.title}
                      </h3>
                      <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-text-secondary/70">
                        {/* labelOf, not the value: these arrive as objects,
                            and rendering one as a React child is what crashed
                            this page (error #31). */}
                        {labelOf(quiz.world) && (
                          <span className="truncate">
                            {labelOf(quiz.world)}
                          </span>
                        )}
                        {labelOf(quiz.world) && labelOf(quiz.lesson) && (
                          <span className="text-text-secondary/70">·</span>
                        )}
                        {labelOf(quiz.lesson) && (
                          <span className="truncate">
                            {labelOf(quiz.lesson)}
                          </span>
                        )}
                        {!labelOf(quiz.world) && !labelOf(quiz.lesson) && (
                          <span className="text-text-secondary/70">
                            No world assigned
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  {canWrite ? (
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => openEdit(quiz)}
                        aria-label={`Edit ${quiz.title}`}
                        className="rounded-lg p-1.5 text-text-secondary hover:text-turmeric"
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => setConfirm(quiz)}
                        aria-label={`Delete ${quiz.title}`}
                        className="rounded-lg p-1.5 text-text-secondary hover:text-error"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full border border-k-border bg-malt/50 px-2.5 py-1 text-text-secondary">
                    {count} questions
                  </span>
                  {quiz.type && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-k-border bg-malt/50 px-2.5 py-1 capitalize text-text-secondary">
                      {TYPE_LABELS[quiz.type] || quiz.type}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full border border-k-border bg-malt/50 px-2.5 py-1 text-turmeric">
                    <Zap size={12} /> {quiz.xpReward ?? 0} XP
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </QueryState>

      <Modal
        open={!!modal}
        onClose={closeModal}
        size="lg"
        title={modal?.mode === 'create' ? 'New Quiz' : 'Edit Quiz'}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              onClick={save}
              loading={creating || updating}
              disabled={detailLoading}
            >
              Save Quiz
            </Button>
          </>
        }
      >
        {modal && detailLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-text-secondary/70">
            <AnimatedIcon
              icon={Loader2}
              size={26}
              animation="spin"
              className="text-turmeric"
            />
            <p className="text-sm">Loading quiz…</p>
          </div>
        ) : modal && detailError && modal.mode === 'edit' ? (
          <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
            Could not load this quiz for editing. Please close and try again.
          </p>
        ) : modal ? (
          <div className="space-y-4">
            <FormField
              label="Title"
              name="title"
              value={modal.data.title}
              onChange={setMeta}
              required
              placeholder="Loops Basics Quiz"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField
                label="World"
                name="world"
                as="select"
                value={modal.data.world}
                onChange={setMeta}
                options={worldOptions}
                hint="Which world this quiz belongs to"
              />
              <FormField
                label="Lesson"
                name="lesson"
                as="select"
                value={modal.data.lesson}
                onChange={setMeta}
                options={lessonOptions}
                hint={
                  modal.data.world
                    ? 'Lessons in the chosen world'
                    : 'Choose a world first'
                }
              />
              <FormField
                label="XP Reward"
                name="xpReward"
                type="number"
                value={modal.data.xpReward}
                onChange={setMeta}
              />
            </div>

            <div className="border-t border-k-border pt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="k-label mb-0">
                  Questions ({modal.data.questions.length})
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  icon={Plus}
                  onClick={() =>
                    setQuestions([...modal.data.questions, newQuestion('mcq')])
                  }
                >
                  Add Question
                </Button>
              </div>
              <div className="space-y-3">
                {modal.data.questions.length === 0 && (
                  <p className="py-3 text-center text-sm text-text-secondary/70">
                    No questions yet. Add one to get started.
                  </p>
                )}
                {modal.data.questions.map((q, i) => (
                  <QuestionEditor
                    key={q._id}
                    index={i}
                    question={q}
                    onChange={(updated) =>
                      setQuestions(
                        modal.data.questions.map((x) =>
                          x._id === q._id ? updated : x,
                        ),
                      )
                    }
                    onRemove={() =>
                      setQuestions(
                        modal.data.questions.filter((x) => x._id !== q._id),
                      )
                    }
                  />
                ))}
              </div>
            </div>
            {formError && (
              <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
                {formError}
              </p>
            )}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => remove(confirm)}
        loading={deleting}
        title="Delete quiz?"
        confirmLabel="Delete"
        message={`"${confirm?.title}" and all its questions will be permanently removed.`}
      />
    </div>
  );
}

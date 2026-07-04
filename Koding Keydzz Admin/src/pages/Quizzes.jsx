import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, HelpCircle, Zap, X, ArrowLeftRight } from 'lucide-react';
import {
  useGetQuizzesQuery,
  useCreateQuizMutation,
  useUpdateQuizMutation,
  useDeleteQuizMutation,
} from '../features/admin/adminApi';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import FormField from '../components/ui/FormField';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PageHeader from '../components/ui/PageHeader';
import QueryState from '../components/ui/QueryState';

function asList(data) {
  if (Array.isArray(data)) return data;
  return data?.quizzes || [];
}

const QUESTION_TYPES = ['mcq', 'dragdrop', 'fillblank', 'match'];
const TYPE_LABELS = {
  mcq: 'Multiple Choice',
  dragdrop: 'Drag & Drop',
  fillblank: 'Fill in the Blank',
  match: 'Match Pairs',
};

const emptyQuiz = {
  title: '',
  description: '',
  courseId: '',
  xpReward: 50,
  published: false,
  questions: [],
};

function newQuestion(type = 'mcq') {
  const base = { id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, type, prompt: '' };
  if (type === 'mcq') return { ...base, options: ['', ''], answer: 0 };
  if (type === 'fillblank') return { ...base, answer: '' };
  if (type === 'dragdrop') return { ...base, items: ['', ''] };
  if (type === 'match') return { ...base, pairs: [{ left: '', right: '' }] };
  return base;
}

// ---- Per-question editor ----
function QuestionEditor({ question, onChange, onRemove, index }) {
  const update = (patch) => onChange({ ...question, ...patch });

  const changeType = (type) => onChange({ ...newQuestion(type), id: question.id, prompt: question.prompt });

  return (
    <div className="rounded-xl border border-k-border bg-malt/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-turmeric/20 text-xs font-bold text-turmeric">
          {index + 1}
        </span>
        <select
          value={question.type}
          onChange={(e) => changeType(e.target.value)}
          className="k-input flex-1"
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
        <button onClick={onRemove} className="rounded-lg p-1.5 text-text-secondary hover:text-error">
          <Trash2 size={15} />
        </button>
      </div>

      <FormField label="Prompt" name="prompt" value={question.prompt} onChange={(e) => update({ prompt: e.target.value })} placeholder="Ask a question..." />

      {question.type === 'mcq' && (
        <div className="mt-3 space-y-2">
          <p className="k-label">Options (select the correct one)</p>
          {question.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name={`ans_${question.id}`}
                checked={question.answer === i}
                onChange={() => update({ answer: i })}
                className="h-4 w-4 accent-turmeric"
              />
              <input
                value={opt}
                onChange={(e) => update({ options: question.options.map((o, j) => (j === i ? e.target.value : o)) })}
                placeholder={`Option ${i + 1}`}
                className="k-input"
              />
              {question.options.length > 2 && (
                <button
                  onClick={() => update({
                    options: question.options.filter((_, j) => j !== i),
                    answer: question.answer >= i ? Math.max(0, question.answer - 1) : question.answer,
                  })}
                  className="text-text-secondary hover:text-error"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => update({ options: [...question.options, ''] })}>
            Add option
          </Button>
        </div>
      )}

      {question.type === 'fillblank' && (
        <div className="mt-3">
          <FormField label="Correct answer" name="answer" value={question.answer} onChange={(e) => update({ answer: e.target.value })} placeholder="Expected text" />
        </div>
      )}

      {question.type === 'dragdrop' && (
        <div className="mt-3 space-y-2">
          <p className="k-label">Items (correct order)</p>
          {question.items.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-text-secondary/60">{i + 1}.</span>
              <input
                value={it}
                onChange={(e) => update({ items: question.items.map((x, j) => (j === i ? e.target.value : x)) })}
                placeholder={`Item ${i + 1}`}
                className="k-input"
              />
              {question.items.length > 2 && (
                <button onClick={() => update({ items: question.items.filter((_, j) => j !== i) })} className="text-text-secondary hover:text-error">
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => update({ items: [...question.items, ''] })}>
            Add item
          </Button>
        </div>
      )}

      {question.type === 'match' && (
        <div className="mt-3 space-y-2">
          <p className="k-label flex items-center gap-1">
            Pairs (left <ArrowLeftRight size={12} className="inline text-text-secondary" /> right)
          </p>
          {question.pairs.map((pair, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={pair.left}
                onChange={(e) => update({ pairs: question.pairs.map((p, j) => (j === i ? { ...p, left: e.target.value } : p)) })}
                placeholder="Left"
                className="k-input"
              />
              <ArrowLeftRight size={14} className="shrink-0 text-text-secondary" />
              <span className="sr-only">matches</span>
              <input
                value={pair.right}
                onChange={(e) => update({ pairs: question.pairs.map((p, j) => (j === i ? { ...p, right: e.target.value } : p)) })}
                placeholder="Right"
                className="k-input"
              />
              {question.pairs.length > 1 && (
                <button onClick={() => update({ pairs: question.pairs.filter((_, j) => j !== i) })} className="text-text-secondary hover:text-error">
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => update({ pairs: [...question.pairs, { left: '', right: '' }] })}>
            Add pair
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Quizzes() {
  const { data, isError, isLoading, error, refetch } = useGetQuizzesQuery();
  const [createQuiz] = useCreateQuizMutation();
  const [updateQuiz] = useUpdateQuizMutation();
  const [deleteQuiz] = useDeleteQuizMutation();

  const quizzes = asList(data);

  const [modal, setModal] = useState(null); // {mode, data}
  const [confirm, setConfirm] = useState(null);
  const [formError, setFormError] = useState('');

  const setMeta = (e) =>
    setModal((m) => ({
      ...m,
      data: { ...m.data, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value },
    }));

  const setQuestions = (questions) => setModal((m) => ({ ...m, data: { ...m.data, questions } }));

  const save = async () => {
    setFormError('');
    const form = { ...modal.data, xpReward: Number(modal.data.xpReward) };
    try {
      if (modal.mode === 'create') {
        await createQuiz(form).unwrap();
      } else {
        await updateQuiz({ id: form.id, ...form }).unwrap();
      }
      setModal(null);
    } catch (err) {
      setFormError(err?.data?.message || 'Could not save the quiz. Please try again.');
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

  return (
    <div className="space-y-6">
      <PageHeader title="Quizzes" subtitle={isLoading ? 'Loading…' : `${quizzes.length} quizzes`}>
        <Button icon={Plus} onClick={() => { setFormError(''); setModal({ mode: 'create', data: { ...emptyQuiz, questions: [] } }); }}>
          New Quiz
        </Button>
      </PageHeader>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={refetch}
        isEmpty={quizzes.length === 0}
        loadingLabel="Loading quizzes…"
        emptyTitle="No quizzes yet"
        emptyMessage="Build a quiz with MCQ, drag & drop, fill-in-the-blank and match questions."
        emptyIcon={HelpCircle}
      >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {quizzes.map((quiz, i) => (
          <motion.div
            key={quiz.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="k-card p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-turmeric/15 p-2.5 text-turmeric">
                  <HelpCircle size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-bold text-text-primary">{quiz.title}</h3>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                      quiz.published ? 'border-success/30 bg-success/15 text-success' : 'border-k-border bg-malt text-text-secondary/70'
                    }`}>
                      {quiz.published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-text-secondary/70">{quiz.description}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setFormError(''); setModal({ mode: 'edit', data: { ...quiz, questions: quiz.questions || [] } }); }} className="rounded-lg p-1.5 text-text-secondary hover:text-turmeric">
                  <Pencil size={16} />
                </button>
                <button onClick={() => setConfirm(quiz)} className="rounded-lg p-1.5 text-text-secondary hover:text-error">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full border border-k-border bg-malt/50 px-2.5 py-1 text-text-secondary">
                {quiz.questions?.length ?? 0} questions
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-k-border bg-malt/50 px-2.5 py-1 text-turmeric">
                <Zap size={12} /> {quiz.xpReward} XP
              </span>
            </div>
          </motion.div>
        ))}
      </div>
      </QueryState>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        size="lg"
        title={modal?.mode === 'create' ? 'New Quiz' : 'Edit Quiz'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={save}>Save Quiz</Button>
          </>
        }
      >
        {modal && (
          <div className="space-y-4">
            <FormField label="Title" name="title" value={modal.data.title} onChange={setMeta} required placeholder="Loops Basics Quiz" />
            <FormField label="Description" name="description" as="textarea" value={modal.data.description} onChange={setMeta} />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Course ID" name="courseId" value={modal.data.courseId} onChange={setMeta} placeholder="crs_1" />
              <FormField label="XP Reward" name="xpReward" type="number" value={modal.data.xpReward} onChange={setMeta} />
            </div>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" name="published" checked={!!modal.data.published} onChange={setMeta} className="h-4 w-4 accent-turmeric" />
              Published
            </label>

            <div className="border-t border-k-border pt-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="k-label mb-0">Questions ({modal.data.questions.length})</p>
                <Button size="sm" variant="outline" icon={Plus} onClick={() => setQuestions([...modal.data.questions, newQuestion('mcq')])}>
                  Add Question
                </Button>
              </div>
              <div className="space-y-3">
                {modal.data.questions.length === 0 && (
                  <p className="py-3 text-center text-sm text-text-secondary/60">No questions yet. Add one to get started.</p>
                )}
                {modal.data.questions.map((q, i) => (
                  <QuestionEditor
                    key={q.id}
                    index={i}
                    question={q}
                    onChange={(updated) => setQuestions(modal.data.questions.map((x) => (x.id === q.id ? updated : x)))}
                    onRemove={() => setQuestions(modal.data.questions.filter((x) => x.id !== q.id))}
                  />
                ))}
              </div>
            </div>
            {formError && (
              <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{formError}</p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => remove(confirm)}
        title="Delete quiz?"
        confirmLabel="Delete"
        message={`"${confirm?.title}" and all its questions will be permanently removed.`}
      />
    </div>
  );
}

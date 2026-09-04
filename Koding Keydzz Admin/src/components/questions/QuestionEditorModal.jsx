import { useEffect, useState } from 'react';
import { AlertTriangle, Plus, Save, Trash2, Eye, EyeOff } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { formatApiError } from '../../utils/apiError';
import {
  useCreateQuestionMutation,
  useUpdateQuestionMutation,
} from '../../features/superadmin/superadminApi';

/**
 * Author one final-test question.
 *
 * FOUR TYPES, FOUR MARK SCHEMES. The form changes shape with the type, because
 * each is graded differently and each needs different things from the author:
 *
 *   mcq        options, and which one is right
 *   fillblank  every spelling that counts as correct
 *   coding     test cases the submitted program is run against
 *   task       what a correct submission achieves, in prose
 *
 * The server REFUSES a question with no mark scheme — such a question would be
 * drawn into a real test and score every pupil zero. This form's job is to
 * make that refusal unnecessary: the fields for the chosen type are required
 * here, so the author fixes it while they are still looking at it.
 *
 * Points are deliberately absent. A question is worth what its blueprint
 * section is worth; see the backend's config/finalTest.js for why.
 */

const TYPES = [
  { value: 'mcq', label: 'Multiple choice' },
  { value: 'fillblank', label: 'Fill in the blank' },
  { value: 'coding', label: 'Coding' },
  { value: 'task', label: 'Build task' },
];

const DIFFICULTIES = [
  { value: 'basic', label: 'Basic' },
  { value: 'advanced', label: 'Advanced (the one worth double)' },
];

const empty = {
  courseSlug: 'python',
  type: 'mcq',
  difficulty: 'basic',
  prompt: '',
  context: '',
  options: ['', ''],
  answerIndex: 0,
  acceptedAnswers: [''],
  language: 'python',
  starterCode: '',
  testCases: [{ stdin: '', expectedOutput: '', visible: true }],
  expectedOutcome: '',
  active: true,
};

function seed(question) {
  if (!question) return { ...empty };
  return {
    ...empty,
    ...question,
    options: question.options?.length ? question.options : ['', ''],
    acceptedAnswers: question.acceptedAnswers?.length ? question.acceptedAnswers : [''],
    testCases: question.testCases?.length
      ? question.testCases
      : [{ stdin: '', expectedOutput: '', visible: true }],
    answerIndex: question.answerIndex ?? 0,
  };
}

export default function QuestionEditorModal({ open, question, courses, onClose }) {
  const [form, setForm] = useState(() => seed(question));
  const [error, setError] = useState('');
  const [create, { isLoading: creating }] = useCreateQuestionMutation();
  const [update, { isLoading: updating }] = useUpdateQuestionMutation();
  const saving = creating || updating;
  const editing = Boolean(question?.id);

  useEffect(() => {
    if (open) {
      setForm(seed(question));
      setError('');
    }
  }, [open, question]);

  const set = (name, value) => setForm((f) => ({ ...f, [name]: value }));
  const onField = (e) => set(e.target.name, e.target.value);

  /** Client-side mirror of the server's mark-scheme check, so it never 400s. */
  const validate = () => {
    if (!form.prompt.trim()) return 'A question needs a prompt.';

    if (form.type === 'mcq') {
      const options = form.options.map((o) => o.trim()).filter(Boolean);
      if (options.length < 2) return 'A multiple-choice question needs at least two options.';
      if (form.answerIndex == null || !form.options[form.answerIndex]?.trim()) {
        return 'Mark which option is the correct one.';
      }
    }
    if (form.type === 'fillblank') {
      if (!form.acceptedAnswers.some((a) => a.trim())) {
        return 'Add at least one accepted answer, or the question cannot be marked.';
      }
    }
    if (form.type === 'coding') {
      if (!form.testCases.some((c) => c.expectedOutput.trim())) {
        return 'Add at least one test case with expected output.';
      }
    }
    if (form.type === 'task' && !form.expectedOutcome.trim()) {
      return 'Describe what a correct submission achieves, or the task cannot be graded.';
    }
    return '';
  };

  const submit = async (e) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    // Send only the fields that matter for this type. Posting an empty
    // `options` array on a coding question would be harmless but misleading in
    // the audit trail.
    const body = {
      courseSlug: form.courseSlug,
      type: form.type,
      difficulty: form.difficulty,
      prompt: form.prompt.trim(),
      context: form.context.trim(),
      active: form.active,
    };
    if (form.type === 'mcq') {
      body.options = form.options.map((o) => o.trim()).filter(Boolean);
      body.answerIndex = Number(form.answerIndex);
    }
    if (form.type === 'fillblank') {
      body.acceptedAnswers = form.acceptedAnswers.map((a) => a.trim()).filter(Boolean);
    }
    if (form.type === 'coding') {
      body.language = form.language;
      body.starterCode = form.starterCode;
      body.testCases = form.testCases
        .filter((c) => c.expectedOutput.trim())
        .map((c) => ({
          stdin: c.stdin,
          expectedOutput: c.expectedOutput,
          visible: Boolean(c.visible),
        }));
    }
    if (form.type === 'task') body.expectedOutcome = form.expectedOutcome.trim();

    try {
      if (editing) await update({ id: question.id, ...body }).unwrap();
      else await create(body).unwrap();
      onClose?.(true);
    } catch (err) {
      setError(formatApiError(err, 'Could not save the question. Please try again.'));
    }
  };

  const courseOptions = (courses || []).map((c) => ({ value: c.slug, label: c.title }));

  return (
    <Modal
      open={open}
      onClose={() => onClose?.(false)}
      size="lg"
      title={editing ? 'Edit question' : 'New question'}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField
            label="Course"
            name="courseSlug"
            as="select"
            value={form.courseSlug}
            onChange={onField}
            options={courseOptions}
            required
          />
          <FormField
            label="Type"
            name="type"
            as="select"
            value={form.type}
            onChange={onField}
            options={TYPES}
            required
          />
          <FormField
            label="Difficulty"
            name="difficulty"
            as="select"
            value={form.difficulty}
            onChange={onField}
            options={DIFFICULTIES}
            hint="Advanced marks the single harder question worth double"
          />
        </div>

        <FormField
          label="Question"
          name="prompt"
          as="textarea"
          rows={3}
          value={form.prompt}
          onChange={onField}
          required
          placeholder="What does the print() function do?"
        />

        <FormField
          label="Context"
          name="context"
          as="textarea"
          rows={3}
          value={form.context}
          onChange={onField}
          hint="Optional — a code snippet or brief shown above the question"
        />

        {/* ---- mcq ---- */}
        {form.type === 'mcq' && (
          <fieldset className="rounded-xl border border-k-border p-3">
            <legend className="k-label px-1">Options — select the correct one</legend>
            <div className="space-y-2">
              {form.options.map((option, i) => (
                <div key={i} className="flex items-center gap-2">
                  {/* A radio, not a number field: the correct answer is one of
                      these options, so it is chosen rather than typed. */}
                  <input
                    type="radio"
                    name="answerIndex"
                    checked={Number(form.answerIndex) === i}
                    onChange={() => set('answerIndex', i)}
                    className="accent-turmeric"
                    aria-label={`Option ${i + 1} is correct`}
                  />
                  <input
                    value={option}
                    onChange={(e) => {
                      const next = [...form.options];
                      next[i] = e.target.value;
                      set('options', next);
                    }}
                    className="k-input flex-1"
                    placeholder={`Option ${i + 1}`}
                    aria-label={`Option ${i + 1}`}
                  />
                  {form.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = form.options.filter((_, j) => j !== i);
                        set('options', next);
                        // Keep the correct answer pointing at the same option.
                        if (Number(form.answerIndex) >= next.length) {
                          set('answerIndex', next.length - 1);
                        }
                      }}
                      aria-label={`Remove option ${i + 1}`}
                      className="rounded-lg p-1.5 text-text-secondary hover:text-error"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {form.options.length < 6 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => set('options', [...form.options, ''])}
              >
                <Plus size={14} className="mr-1" /> Add option
              </Button>
            )}
          </fieldset>
        )}

        {/* ---- fillblank ---- */}
        {form.type === 'fillblank' && (
          <fieldset className="rounded-xl border border-k-border p-3">
            <legend className="k-label px-1">Accepted answers</legend>
            {/* Several spellings, because a child typing "True" must not be
                marked wrong for "true". Case, spacing and numeric form are
                already forgiven by the grader; genuine alternatives are not. */}
            <p className="mb-2 text-xs text-text-secondary/70">
              Any of these counts as correct. Case and spacing are ignored, and{' '}
              <code className="text-turmeric">3</code> already matches{' '}
              <code className="text-turmeric">3.0</code> — add real alternatives like
              &ldquo;forty-two&rdquo;.
            </p>
            <div className="space-y-2">
              {form.acceptedAnswers.map((answer, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={answer}
                    onChange={(e) => {
                      const next = [...form.acceptedAnswers];
                      next[i] = e.target.value;
                      set('acceptedAnswers', next);
                    }}
                    className="k-input flex-1"
                    placeholder="42"
                    aria-label={`Accepted answer ${i + 1}`}
                  />
                  {form.acceptedAnswers.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        set('acceptedAnswers', form.acceptedAnswers.filter((_, j) => j !== i))
                      }
                      aria-label={`Remove accepted answer ${i + 1}`}
                      className="rounded-lg p-1.5 text-text-secondary hover:text-error"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => set('acceptedAnswers', [...form.acceptedAnswers, ''])}
            >
              <Plus size={14} className="mr-1" /> Add another spelling
            </Button>
          </fieldset>
        )}

        {/* ---- coding ---- */}
        {form.type === 'coding' && (
          <>
            <FormField
              label="Starter code"
              name="starterCode"
              as="textarea"
              rows={4}
              value={form.starterCode}
              onChange={onField}
              hint="What the pupil sees in the editor before they begin"
            />
            <fieldset className="rounded-xl border border-k-border p-3">
              <legend className="k-label px-1">Test cases</legend>
              {/* Visible cases are the worked example. Hidden ones are what
                  stop a solution that just prints the answer it was shown. */}
              <p className="mb-2 text-xs text-text-secondary/70">
                The submitted program is run against every case, server-side. Marks are
                proportional to how many pass. Mark one <strong>visible</strong> as a worked
                example; keep the rest hidden, or a pupil can just print the answer.
              </p>
              <div className="space-y-3">
                {form.testCases.map((testCase, i) => (
                  <div key={i} className="rounded-lg bg-surface/60 p-2.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-text-secondary">
                        Case {i + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...form.testCases];
                            next[i] = { ...next[i], visible: !next[i].visible };
                            set('testCases', next);
                          }}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${
                            testCase.visible
                              ? 'bg-turmeric/15 text-turmeric'
                              : 'text-text-secondary'
                          }`}
                        >
                          {testCase.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                          {testCase.visible ? 'Shown as example' : 'Hidden'}
                        </button>
                        {form.testCases.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              set('testCases', form.testCases.filter((_, j) => j !== i))
                            }
                            aria-label={`Remove case ${i + 1}`}
                            className="rounded-lg p-1.5 text-text-secondary hover:text-error"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <label className="k-label" htmlFor={`stdin-${i}`}>
                          Input (stdin)
                        </label>
                        <textarea
                          id={`stdin-${i}`}
                          rows={2}
                          value={testCase.stdin}
                          onChange={(e) => {
                            const next = [...form.testCases];
                            next[i] = { ...next[i], stdin: e.target.value };
                            set('testCases', next);
                          }}
                          className="k-input font-mono text-xs"
                          placeholder="(leave blank if the program reads nothing)"
                        />
                      </div>
                      <div>
                        <label className="k-label" htmlFor={`expected-${i}`}>
                          Expected output <span className="text-error">*</span>
                        </label>
                        <textarea
                          id={`expected-${i}`}
                          rows={2}
                          value={testCase.expectedOutput}
                          onChange={(e) => {
                            const next = [...form.testCases];
                            next[i] = { ...next[i], expectedOutput: e.target.value };
                            set('testCases', next);
                          }}
                          className="k-input font-mono text-xs"
                          placeholder="5"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() =>
                  set('testCases', [
                    ...form.testCases,
                    { stdin: '', expectedOutput: '', visible: false },
                  ])
                }
              >
                <Plus size={14} className="mr-1" /> Add test case
              </Button>
            </fieldset>
          </>
        )}

        {/* ---- task ---- */}
        {form.type === 'task' && (
          <FormField
            label="Expected outcome"
            name="expectedOutcome"
            as="textarea"
            rows={4}
            value={form.expectedOutcome}
            onChange={onField}
            required
            hint="What a correct submission achieves. Used to grade the task — never shown to the pupil."
            placeholder="A page with a heading, a paragraph and a working link, laid out in two columns."
          />
        )}

        {error && (
          <p className="flex items-start gap-2 rounded-xl border border-error/50 bg-error/10 px-3 py-2 text-sm text-error">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-k-border pt-4">
          <Button type="button" variant="ghost" onClick={() => onClose?.(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            <Save size={16} className="mr-1.5" />
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add question'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import {
  useCreateLessonMutation,
  useUpdateLessonMutation,
} from '../../features/admin/adminApi';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import FormField from '../ui/FormField';
import { formatApiError } from '../../utils/apiError';

/**
 * Languages a lesson snippet can be written in.
 *
 * Mirrors backend src/config/courses.js `LANGUAGES`. JavaScript was removed
 * with the move to a course ladder — offering it here would let an author
 * write a snippet in a language the platform can no longer run.
 *
 * `c` and `html` are listed because their courses are staged and authors need
 * to be able to write their content before the runners land.
 */
const LANGUAGES = ['python', 'c', 'html'];

const uid = () => `r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const newSection = () => ({ _key: uid(), heading: '', body: '', bullets: [''] });
const newGuideStep = () => ({ _key: uid(), step: '', body: '' });

// Build the editor's flat form state from a lesson doc (may have a missing /
// partial `body`). Defaults keep every list an array and every field a string.
function hydrate(lesson) {
  const body = lesson?.body || {};
  const snippet = body.snippet || {};
  const tryIt = body.tryIt || {};
  const sections = Array.isArray(body.sections) ? body.sections : [];
  const guide = Array.isArray(body.guide) ? body.guide : [];
  const takeaways = Array.isArray(body.takeaways) ? body.takeaways : [];

  return {
    title: lesson?.title || '',
    order: lesson?.order ?? 0,
    xpReward: lesson?.xpReward ?? 100,
    language: lesson?.language || 'python',
    starterCode: lesson?.starterCode || '',

    tagline: body.tagline || '',
    intro: body.intro || '',

    sections: sections.length
      ? sections.map((s) => ({
          _key: uid(),
          heading: s?.heading || '',
          body: s?.body || '',
          bullets: Array.isArray(s?.bullets) && s.bullets.length ? [...s.bullets] : [''],
        }))
      : [],

    snippetLanguage: snippet.language || 'python',
    snippetCaption: snippet.caption || '',
    snippetLines: Array.isArray(snippet.lines) ? snippet.lines.join('\n') : '',

    tryLanguage: tryIt.language || '',
    tryStarter: tryIt.starter || '',
    tryChallenge: tryIt.challenge || '',
    tryHint: tryIt.hint || '',

    guide: guide.length
      ? guide.map((g) => ({ _key: uid(), step: g?.step || '', body: g?.body || '' }))
      : [],

    takeaways: takeaways.length ? [...takeaways] : [],
  };
}

// Turn the flat form state into the API payload's structured `body` object,
// stripping client-only `_key`s and empty rows/keys.
function buildBody(f) {
  const sections = f.sections
    .map((s) => ({
      heading: s.heading.trim(),
      body: s.body.trim(),
      bullets: s.bullets.map((b) => b.trim()).filter(Boolean),
    }))
    .filter((s) => s.heading || s.body || s.bullets.length);

  const guide = f.guide
    .map((g) => ({ step: g.step.trim(), body: g.body.trim() }))
    .filter((g) => g.step || g.body);

  const takeaways = f.takeaways.map((t) => t.trim()).filter(Boolean);

  const snippetLines = f.snippetLines.split('\n').filter((l, i, arr) => {
    // Keep interior blank lines but trim leading/trailing empties.
    if (l.trim()) return true;
    return i !== 0 && i !== arr.length - 1;
  });

  const body = {
    tagline: f.tagline.trim(),
    intro: f.intro.trim(),
    sections,
    guide,
    takeaways,
  };

  if (snippetLines.length || f.snippetCaption.trim()) {
    body.snippet = {
      language: f.snippetLanguage.trim() || 'python',
      caption: f.snippetCaption.trim(),
      lines: snippetLines,
    };
  }

  if (f.tryStarter.trim() || f.tryChallenge.trim() || f.tryHint.trim() || f.tryLanguage.trim()) {
    body.tryIt = {
      language: f.tryLanguage.trim(),
      starter: f.tryStarter,
      challenge: f.tryChallenge,
      hint: f.tryHint,
    };
  }

  return body;
}

// Small labelled block wrapper for the repeatable / grouped sections.
function Group({ title, action, children }) {
  return (
    <div className="rounded-xl border border-k-border bg-malt/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="k-label mb-0">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function LessonEditorModal({ open, onClose, worldId, lesson }) {
  const isEdit = !!lesson;
  const [createLesson, { isLoading: creating }] = useCreateLessonMutation();
  const [updateLesson, { isLoading: updating }] = useUpdateLessonMutation();

  const [form, setForm] = useState(() => hydrate(lesson));
  const [error, setError] = useState('');

  // Re-hydrate whenever the modal opens for a different lesson.
  useEffect(() => {
    if (open) {
      setForm(hydrate(lesson));
      setError('');
    }
  }, [open, lesson]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // ---- sections ----
  const updateSection = (key, patch) =>
    set({ sections: form.sections.map((s) => (s._key === key ? { ...s, ...patch } : s)) });
  const removeSection = (key) => set({ sections: form.sections.filter((s) => s._key !== key) });

  // ---- guide ----
  const updateGuide = (key, patch) =>
    set({ guide: form.guide.map((g) => (g._key === key ? { ...g, ...patch } : g)) });
  const removeGuide = (key) => set({ guide: form.guide.filter((g) => g._key !== key) });

  const save = async () => {
    setError('');
    if (!form.title.trim()) {
      setError('A lesson title is required.');
      return;
    }
    const payload = {
      title: form.title.trim(),
      order: Number(form.order) || 0,
      xpReward: Number(form.xpReward) || 0,
      language: form.language,
      starterCode: form.starterCode,
      body: buildBody(form),
    };
    try {
      if (isEdit) {
        await updateLesson({ id: lesson._id || lesson.id, world: worldId, ...payload }).unwrap();
      } else {
        await createLesson({ world: worldId, ...payload }).unwrap();
      }
      onClose();
    } catch (err) {
      setError(formatApiError(err, 'Could not save the lesson. Please try again.'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={isEdit ? 'Edit Lesson' : 'New Lesson'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={creating || updating}>
            Save Lesson
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Metadata */}
        <div className="space-y-4">
          <FormField
            label="Title"
            name="title"
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            required
            placeholder="Introduction to loops"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField
              label="Order"
              name="order"
              type="number"
              value={form.order}
              onChange={(e) => set({ order: e.target.value })}
            />
            <FormField
              label="XP Reward"
              name="xpReward"
              type="number"
              value={form.xpReward}
              onChange={(e) => set({ xpReward: e.target.value })}
            />
            <FormField
              label="Language"
              name="language"
              as="select"
              options={LANGUAGES}
              value={form.language}
              onChange={(e) => set({ language: e.target.value })}
            />
          </div>
          <FormField
            label="Starter Code"
            name="starterCode"
            as="textarea"
            rows={4}
            value={form.starterCode}
            onChange={(e) => set({ starterCode: e.target.value })}
            placeholder="# code students start with"
            className="font-mono"
          />
        </div>

        {/* Overview */}
        <div className="border-t border-k-border pt-4">
          <p className="k-label">Overview</p>
          <div className="space-y-4">
            <FormField
              label="Tagline"
              name="tagline"
              value={form.tagline}
              onChange={(e) => set({ tagline: e.target.value })}
              placeholder="A short one-liner"
            />
            <FormField
              label="Intro"
              name="intro"
              as="textarea"
              rows={3}
              value={form.intro}
              onChange={(e) => set({ intro: e.target.value })}
              placeholder="Set the scene for this lesson…"
            />
          </div>
        </div>

        {/* Sections */}
        <Group
          title={`Sections (${form.sections.length})`}
          action={
            <Button
              size="sm"
              variant="outline"
              icon={Plus}
              onClick={() => set({ sections: [...form.sections, newSection()] })}
            >
              Add Section
            </Button>
          }
        >
          {form.sections.length === 0 && (
            <p className="py-2 text-center text-sm text-text-secondary/70">No sections yet.</p>
          )}
          <div className="space-y-3">
            {form.sections.map((s, i) => (
              <div key={s._key} className="rounded-lg border border-k-border bg-card p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-turmeric/20 text-xs font-bold text-turmeric">
                    {i + 1}
                  </span>
                  <input
                    value={s.heading}
                    onChange={(e) => updateSection(s._key, { heading: e.target.value })}
                    placeholder="Section heading"
                    className="k-input min-w-0 flex-1"
                  />
                  <button
                    onClick={() => removeSection(s._key)}
                    aria-label="Remove section"
                    className="shrink-0 rounded-lg p-1.5 text-text-secondary hover:text-error"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <textarea
                  value={s.body}
                  onChange={(e) => updateSection(s._key, { body: e.target.value })}
                  placeholder="Section body"
                  rows={2}
                  className="k-input resize-none"
                />
                <div className="mt-2 space-y-2">
                  <p className="k-label mb-0">Bullets</p>
                  {s.bullets.map((b, bi) => (
                    <div key={bi} className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-text-secondary/70">•</span>
                      <input
                        value={b}
                        onChange={(e) =>
                          updateSection(s._key, {
                            bullets: s.bullets.map((x, j) => (j === bi ? e.target.value : x)),
                          })
                        }
                        placeholder={`Bullet ${bi + 1}`}
                        className="k-input min-w-0 flex-1"
                      />
                      {s.bullets.length > 1 && (
                        <button
                          onClick={() =>
                            updateSection(s._key, {
                              bullets: s.bullets.filter((_, j) => j !== bi),
                            })
                          }
                          aria-label="Remove bullet"
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
                    onClick={() => updateSection(s._key, { bullets: [...s.bullets, ''] })}
                  >
                    Add bullet
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Group>

        {/* Snippet */}
        <Group title="Code Snippet">
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                label="Language"
                name="snippetLanguage"
                value={form.snippetLanguage}
                onChange={(e) => set({ snippetLanguage: e.target.value })}
                placeholder="python"
              />
              <FormField
                label="Caption"
                name="snippetCaption"
                value={form.snippetCaption}
                onChange={(e) => set({ snippetCaption: e.target.value })}
                placeholder="What this snippet shows"
              />
            </div>
            <FormField
              label="Lines (one code line per row)"
              name="snippetLines"
              as="textarea"
              rows={5}
              value={form.snippetLines}
              onChange={(e) => set({ snippetLines: e.target.value })}
              placeholder={'for i in range(5):\n    print(i)'}
              className="font-mono"
              hint="Each line becomes one entry in the snippet."
            />
          </div>
        </Group>

        {/* Try It */}
        <Group title="Try It">
          <div className="space-y-3">
            <FormField
              label="Language"
              name="tryLanguage"
              value={form.tryLanguage}
              onChange={(e) => set({ tryLanguage: e.target.value })}
              placeholder="python"
            />
            <FormField
              label="Starter"
              name="tryStarter"
              as="textarea"
              rows={3}
              value={form.tryStarter}
              onChange={(e) => set({ tryStarter: e.target.value })}
              className="font-mono"
            />
            <FormField
              label="Challenge"
              name="tryChallenge"
              as="textarea"
              rows={2}
              value={form.tryChallenge}
              onChange={(e) => set({ tryChallenge: e.target.value })}
            />
            <FormField
              label="Hint"
              name="tryHint"
              as="textarea"
              rows={2}
              value={form.tryHint}
              onChange={(e) => set({ tryHint: e.target.value })}
            />
          </div>
        </Group>

        {/* Guide */}
        <Group
          title={`Guide (${form.guide.length})`}
          action={
            <Button
              size="sm"
              variant="outline"
              icon={Plus}
              onClick={() => set({ guide: [...form.guide, newGuideStep()] })}
            >
              Add Step
            </Button>
          }
        >
          {form.guide.length === 0 && (
            <p className="py-2 text-center text-sm text-text-secondary/70">No steps yet.</p>
          )}
          <div className="space-y-3">
            {form.guide.map((g, i) => (
              <div key={g._key} className="rounded-lg border border-k-border bg-card p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-turmeric/20 text-xs font-bold text-turmeric">
                    {i + 1}
                  </span>
                  <input
                    value={g.step}
                    onChange={(e) => updateGuide(g._key, { step: e.target.value })}
                    placeholder="Step title"
                    className="k-input min-w-0 flex-1"
                  />
                  <button
                    onClick={() => removeGuide(g._key)}
                    aria-label="Remove step"
                    className="shrink-0 rounded-lg p-1.5 text-text-secondary hover:text-error"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <textarea
                  value={g.body}
                  onChange={(e) => updateGuide(g._key, { body: e.target.value })}
                  placeholder="Step body"
                  rows={2}
                  className="k-input resize-none"
                />
              </div>
            ))}
          </div>
        </Group>

        {/* Takeaways */}
        <Group
          title={`Takeaways (${form.takeaways.length})`}
          action={
            <Button
              size="sm"
              variant="outline"
              icon={Plus}
              onClick={() => set({ takeaways: [...form.takeaways, ''] })}
            >
              Add Takeaway
            </Button>
          }
        >
          {form.takeaways.length === 0 && (
            <p className="py-2 text-center text-sm text-text-secondary/70">No takeaways yet.</p>
          )}
          <div className="space-y-2">
            {form.takeaways.map((t, i) => (
              <div key={i} className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-text-secondary/70">✓</span>
                <input
                  value={t}
                  onChange={(e) =>
                    set({ takeaways: form.takeaways.map((x, j) => (j === i ? e.target.value : x)) })
                  }
                  placeholder={`Takeaway ${i + 1}`}
                  className="k-input min-w-0 flex-1"
                />
                <button
                  onClick={() => set({ takeaways: form.takeaways.filter((_, j) => j !== i) })}
                  aria-label="Remove takeaway"
                  className="shrink-0 text-text-secondary hover:text-error"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        </Group>

        {error && (
          <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Pencil,
  Trash2,
  Globe,
  Layers,
  Lock,
  ChevronDown,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import {
  useGetWorldsQuery,
  useCreateWorldMutation,
  useUpdateWorldMutation,
  useDeleteWorldMutation,
  useGetWorldLessonsQuery,
  useDeleteLessonMutation,
} from '../features/admin/adminApi';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import FormField from '../components/ui/FormField';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PageHeader from '../components/ui/PageHeader';
import { useCan } from '../features/auth/useCan';
import QueryState from '../components/ui/QueryState';
import LessonEditorModal from '../components/worlds/LessonEditorModal';
import { formatApiError } from '../utils/apiError';

const emptyWorld = {
  name: '',
  slug: '',
  order: 1,
  requiredLevel: 1,
  description: '',
  icon: '',
  topics: '',
};

function asList(data) {
  if (Array.isArray(data)) return data;
  return data?.items || data?.worlds || [];
}

// The world's `topics` is an array on the server; the form edits it as a
// comma-separated string. These two helpers convert between the shapes.
const topicsToText = (topics) =>
  Array.isArray(topics) ? topics.join(', ') : '';
const textToTopics = (text) =>
  String(text || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

function worldToForm(world) {
  return {
    id: world._id || world.id,
    name: world.name || '',
    slug: world.slug || '',
    order: world.order ?? 1,
    requiredLevel: world.requiredLevel ?? 1,
    description: world.description || '',
    icon: world.icon || '',
    topics: topicsToText(world.topics),
  };
}

export default function Worlds() {
  /**
   * Curriculum is GLOBAL — shared by every school — so only the platform owner
   * may write it. Teachers and school administrators hold `content:read` and
   * reach this page legitimately; every write control shown to them returned
   * 403. Hidden rather than disabled, because they can never do it.
   */
  const canWrite = useCan('content:write');

  const { data, isError, isLoading, error, refetch } = useGetWorldsQuery();
  const [createWorld] = useCreateWorldMutation();
  const [updateWorld] = useUpdateWorldMutation();
  const [deleteWorld] = useDeleteWorldMutation();

  const worlds = [...asList(data)].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );

  const [expanded, setExpanded] = useState(null);
  const [worldModal, setWorldModal] = useState(null); // { mode, data }
  const [confirm, setConfirm] = useState(null); // { world }
  const [formError, setFormError] = useState('');

  const setField = (e) =>
    setWorldModal((m) => ({
      ...m,
      data: { ...m.data, [e.target.name]: e.target.value },
    }));

  const saveWorld = async () => {
    setFormError('');
    const f = worldModal.data;
    if (!f.name.trim() || !f.slug.trim()) {
      setFormError('A name and a slug are required.');
      return;
    }
    const payload = {
      name: f.name.trim(),
      slug: f.slug.trim().toLowerCase(),
      order: Number(f.order) || 0,
      requiredLevel: Number(f.requiredLevel) || 1,
      description: f.description.trim(),
      icon: f.icon.trim(),
      topics: textToTopics(f.topics),
    };
    try {
      if (worldModal.mode === 'create') {
        await createWorld(payload).unwrap();
      } else {
        await updateWorld({ id: f.id, ...payload }).unwrap();
      }
      setWorldModal(null);
    } catch (err) {
      setFormError(
        formatApiError(err, 'Could not save the world. Please try again.'),
      );
    }
  };

  const removeWorld = async (world) => {
    try {
      await deleteWorld(world._id || world.id).unwrap();
    } catch {
      /* the list reflects server state on refetch */
    }
    setConfirm(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Worlds"
        subtitle={isLoading ? 'Loading…' : `${worlds.length} learning worlds`}
      >
        {canWrite ? (
          <Button
            icon={Plus}
            onClick={() => {
              setFormError('');
              setWorldModal({ mode: 'create', data: { ...emptyWorld } });
            }}
          >
            New World
          </Button>
        ) : null}
      </PageHeader>

      <div className="k-card flex items-start gap-3 px-5 py-3 text-sm text-text-secondary">
        <Globe size={18} className="mt-0.5 shrink-0 text-turmeric" />
        <p>
          Worlds are what students explore in the app — their order, unlock
          level and topics come from here. Expand a world to author its
          interactive lessons.
        </p>
      </div>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={refetch}
        isEmpty={worlds.length === 0}
        loadingLabel="Loading worlds…"
        emptyTitle="No worlds yet"
        emptyMessage="Create your first world to start building the student journey."
        emptyIcon={Globe}
      >
        <div className="grid grid-cols-1 gap-4">
          {worlds.map((world, i) => {
            const id = world._id || world.id;
            const isOpen = expanded === id;
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="k-card overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-turmeric/15 font-heading text-sm font-extrabold text-turmeric">
                        {world.order}
                      </div>
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <h3 className="truncate font-heading font-bold text-text-primary">
                            {world.name}
                          </h3>
                          <span className="shrink-0 rounded-full border border-k-border bg-malt px-2 py-0.5 font-mono text-xs text-text-secondary/70">
                            {world.slug}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-text-secondary/70">
                          {world.description || 'No description.'}
                        </p>
                      </div>
                    </div>
                    {canWrite ? (
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => {
                            setFormError('');
                            setWorldModal({
                              mode: 'edit',
                              data: worldToForm(world),
                            });
                          }}
                          className="rounded-lg p-1.5 text-text-secondary hover:bg-surface hover:text-turmeric"
                          aria-label={`Edit ${world.name}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => setConfirm({ world })}
                          className="rounded-lg p-1.5 text-text-secondary hover:bg-surface hover:text-error"
                          aria-label={`Delete ${world.name}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <Tag icon={Lock}>
                      Unlocks at Lv {world.requiredLevel ?? 1}
                    </Tag>
                    <Tag icon={Layers}>
                      {(world.topics || []).length} topics
                    </Tag>
                  </div>

                  {(world.topics || []).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {world.topics.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-k-border bg-malt/50 px-2.5 py-0.5 text-xs text-text-secondary"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setExpanded(isOpen ? null : id)}
                    className="mt-4 flex w-full items-center justify-between rounded-xl border border-k-border bg-malt/40 px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:text-turmeric"
                  >
                    <span className="inline-flex items-center gap-2">
                      <BookOpen size={15} /> Manage lessons
                    </span>
                    {isOpen ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </button>
                </div>

                {isOpen && <WorldLessons worldId={id} worldName={world.name} />}
              </motion.div>
            );
          })}
        </div>
      </QueryState>

      {/* World create / edit */}
      <Modal
        open={!!worldModal}
        onClose={() => setWorldModal(null)}
        title={worldModal?.mode === 'create' ? 'New World' : 'Edit World'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setWorldModal(null)}>
              Cancel
            </Button>
            <Button onClick={saveWorld}>Save World</Button>
          </>
        }
      >
        {worldModal && (
          <div className="space-y-4">
            <FormField
              label="Name"
              name="name"
              value={worldModal.data.name}
              onChange={setField}
              required
              placeholder="Coding Forest"
            />
            <FormField
              label="Slug"
              name="slug"
              value={worldModal.data.slug}
              onChange={setField}
              required
              placeholder="coding-forest"
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Order"
                name="order"
                type="number"
                value={worldModal.data.order}
                onChange={setField}
              />
              <FormField
                label="Unlock Level"
                name="requiredLevel"
                type="number"
                value={worldModal.data.requiredLevel}
                onChange={setField}
              />
            </div>
            <FormField
              label="Description"
              name="description"
              as="textarea"
              value={worldModal.data.description}
              onChange={setField}
              placeholder="What students explore in this world."
            />
            <FormField
              label="Topics (comma-separated)"
              name="topics"
              value={worldModal.data.topics}
              onChange={setField}
              placeholder="Variables, Stored Values, Input, Output"
            />
            <FormField
              label="Icon (optional)"
              name="icon"
              value={worldModal.data.icon}
              onChange={setField}
              placeholder="forest"
            />
            {formError && (
              <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
                {formError}
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => removeWorld(confirm.world)}
        title="Delete world?"
        confirmLabel="Delete"
        message={`"${confirm?.world?.name}" will be permanently removed. Its lessons are not automatically deleted.`}
      />
    </div>
  );
}

// Lessons for one world. Rendered only when a world card is expanded, so the
// per-world lessons query fires lazily (one hook, one open world at a time).
function WorldLessons({ worldId, worldName }) {
  // Called again here rather than threaded through props: the lesson controls
  // are this component's own, and a prop would be one more thing to forget.
  const canWrite = useCan('content:write');

  const { data, isLoading, isError, error, refetch } =
    useGetWorldLessonsQuery(worldId);
  const [deleteLesson] = useDeleteLessonMutation();

  const lessons = [...(Array.isArray(data) ? data : data?.items || [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );

  const [lessonModal, setLessonModal] = useState(null); // { lesson } (null lesson = create)
  const [confirm, setConfirm] = useState(null); // { lesson }

  const removeLesson = async (lesson) => {
    try {
      await deleteLesson(lesson._id || lesson.id).unwrap();
    } catch {
      /* list reflects server state */
    }
    setConfirm(null);
  };

  return (
    <div className="border-t border-k-border bg-malt/30 p-4">
      {canWrite ? (
        <div className="mb-3 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            icon={Plus}
            onClick={() => setLessonModal({ lesson: null })}
          >
            Add Lesson
          </Button>
        </div>
      ) : null}

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={refetch}
        isEmpty={lessons.length === 0}
        loadingLabel="Loading lessons…"
        emptyTitle="No lessons yet"
        emptyMessage="Add the first lesson for this world."
        emptyIcon={BookOpen}
      >
        <div className="space-y-2">
          {lessons.map((lesson) => (
            <div
              key={lesson._id || lesson.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-k-border bg-card px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-turmeric/20 text-xs font-bold text-turmeric">
                  {lesson.order}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {lesson.title}
                  </p>
                  <p className="truncate text-xs text-text-secondary/70">
                    {lesson.xpReward ?? 0} XP ·{' '}
                    {lesson.body?.sections?.length ?? 0} sections
                    {lesson.body?.tryIt?.starter ? ' · interactive' : ''}
                  </p>
                </div>
              </div>
              {canWrite ? (
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => setLessonModal({ lesson })}
                    className="rounded-lg p-1.5 text-text-secondary hover:text-turmeric"
                    aria-label={`Edit ${lesson.title}`}
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => setConfirm({ lesson })}
                    className="rounded-lg p-1.5 text-text-secondary hover:text-error"
                    aria-label={`Delete ${lesson.title}`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </QueryState>

      <LessonEditorModal
        open={!!lessonModal}
        onClose={() => setLessonModal(null)}
        worldId={worldId}
        lesson={lessonModal?.lesson || null}
      />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => removeLesson(confirm.lesson)}
        title="Delete lesson?"
        confirmLabel="Delete"
        message={`Lesson "${confirm?.lesson?.title}" in ${worldName} will be permanently removed.`}
      />
    </div>
  );
}

function Tag({ children, icon: Icon }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-k-border bg-malt/50 px-2.5 py-1 text-text-secondary">
      {Icon && <Icon size={12} />}
      {children}
    </span>
  );
}

import { useState } from 'react';
import { useCan } from '../features/auth/useCan';
import { motion } from 'framer-motion';
import {
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  Users as UsersIcon,
  Layers,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  useGetCoursesQuery,
  useGetWorldsQuery,
  useCreateCourseMutation,
  useUpdateCourseMutation,
  useDeleteCourseMutation,
  useCreateLessonMutation,
  useUpdateLessonMutation,
  useDeleteLessonMutation,
} from '../features/admin/adminApi';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import FormField from '../components/ui/FormField';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PageHeader from '../components/ui/PageHeader';
import QueryState from '../components/ui/QueryState';
import { formatApiError } from '../utils/apiError';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

const emptyCourse = {
  title: '',
  description: '',
  world: '',
  level: LEVELS[0],
  published: true,
};
const emptyLesson = { title: '', xp: 50, duration: 10, order: 1 };

function asList(data) {
  if (Array.isArray(data)) return data;
  return data?.courses || [];
}

export default function Courses() {
  const { data, isError, isLoading, error, refetch } = useGetCoursesQuery();
  const { data: worldsData } = useGetWorldsQuery();
  const [createCourse] = useCreateCourseMutation();
  const [updateCourse] = useUpdateCourseMutation();
  const [deleteCourse] = useDeleteCourseMutation();
  const [createLesson] = useCreateLessonMutation();
  const [updateLesson] = useUpdateLessonMutation();
  const [deleteLesson] = useDeleteLessonMutation();

  /**
   * Curriculum is GLOBAL — shared by every school on the platform — so only
   * the platform owner may write it. Teachers and school administrators hold
   * `content:read` and reach this page legitimately, but every write control
   * shown to them returned 403. Hidden rather than disabled: a disabled button
   * still implies "you could do this", and they never can.
   */
  const canWrite = useCan('content:write');

  const courses = asList(data);

  // Real worlds drive the course "world" select. The course stores the world's
  // _id (Course.world is an ObjectId ref); we show the name and map back for
  // display. An empty option keeps world optional.
  const worldList = Array.isArray(worldsData)
    ? worldsData
    : worldsData?.items || [];
  const worldOptions = [
    { value: '', label: '— No world —' },
    ...worldList.map((w) => ({ value: w._id || w.id, label: w.name })),
  ];
  const worldName = (id) => {
    if (!id) return 'No world';
    const w = worldList.find(
      (x) => (x._id || x.id) === (id?._id || id?.id || id),
    );
    return w?.name || (id?.name ?? '—');
  };

  const [expanded, setExpanded] = useState(null);
  const [courseModal, setCourseModal] = useState(null); // {mode, data}
  const [lessonModal, setLessonModal] = useState(null); // {courseId, mode, data}
  const [confirm, setConfirm] = useState(null); // {type, course, lesson}
  const [formError, setFormError] = useState('');

  const saveCourse = async () => {
    setFormError('');
    const form = courseModal.data;
    // Normalise world to a bare id string, and drop it when empty (the backend
    // expects an ObjectId or nothing — an empty string fails validation).
    const worldId = form.world?._id || form.world?.id || form.world || '';
    const payload = { ...form, world: worldId };
    if (!worldId) delete payload.world;
    try {
      if (courseModal.mode === 'create') {
        await createCourse(payload).unwrap();
      } else {
        await updateCourse({ id: form.id, ...payload }).unwrap();
      }
      setCourseModal(null);
    } catch (err) {
      setFormError(
        formatApiError(err, 'Could not save the course. Please try again.'),
      );
    }
  };

  const removeCourse = async (course) => {
    try {
      await deleteCourse(course.id).unwrap();
    } catch {
      /* table reflects server state */
    }
    setConfirm(null);
  };

  const saveLesson = async () => {
    setFormError('');
    const { courseId, mode, data: form } = lessonModal;
    const nums = {
      xp: Number(form.xp),
      duration: Number(form.duration),
      order: Number(form.order),
    };
    try {
      if (mode === 'create') {
        await createLesson({ courseId, ...form, ...nums }).unwrap();
      } else {
        await updateLesson({ id: form.id, ...form, ...nums }).unwrap();
      }
      setLessonModal(null);
    } catch (err) {
      setFormError(
        formatApiError(err, 'Could not save the lesson. Please try again.'),
      );
    }
  };

  const removeLesson = async (course, lesson) => {
    try {
      await deleteLesson(lesson.id).unwrap();
    } catch {
      /* table reflects server state */
    }
    setConfirm(null);
  };

  const setCourseField = (e) =>
    setCourseModal((m) => ({
      ...m,
      data: {
        ...m.data,
        [e.target.name]:
          e.target.type === 'checkbox' ? e.target.checked : e.target.value,
      },
    }));
  const setLessonField = (e) =>
    setLessonModal((m) => ({
      ...m,
      data: { ...m.data, [e.target.name]: e.target.value },
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Courses"
        subtitle={isLoading ? 'Loading…' : `${courses.length} courses`}
      >
        {canWrite ? (
          <Button
            icon={Plus}
            onClick={() => {
              setFormError('');
              setCourseModal({ mode: 'create', data: { ...emptyCourse } });
            }}
          >
            New Course
          </Button>
        ) : null}
      </PageHeader>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={refetch}
        isEmpty={courses.length === 0}
        loadingLabel="Loading courses…"
        emptyTitle="No courses yet"
        emptyMessage="Create your first course to start building lessons."
        emptyIcon={BookOpen}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {courses.map((course, i) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="k-card overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="shrink-0 rounded-xl bg-turmeric/15 p-2.5 text-turmeric">
                      <BookOpen size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <h3 className="truncate font-heading font-bold text-text-primary">
                          {course.title}
                        </h3>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            course.published
                              ? 'border-success/30 bg-success/15 text-success'
                              : 'border-k-border bg-malt text-text-secondary/70'
                          }`}
                        >
                          {course.published ? 'Published' : 'Draft'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-text-secondary/70">
                        {course.description}
                      </p>
                    </div>
                  </div>
                  {canWrite ? (
                    <div className="flex shrink-0 gap-1">
                      <button
                        aria-label={`Edit ${course.title}`}
                        onClick={() => {
                          setFormError('');
                          setCourseModal({ mode: 'edit', data: { ...course } });
                        }}
                        className="rounded-lg p-1.5 text-text-secondary hover:bg-surface hover:text-turmeric"
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        aria-label={`Delete ${course.title}`}
                        onClick={() => setConfirm({ type: 'course', course })}
                        className="rounded-lg p-1.5 text-text-secondary hover:bg-surface hover:text-error"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <Tag>{worldName(course.world)}</Tag>
                  <Tag>{course.level}</Tag>
                  <Tag icon={Layers}>
                    {course.lessons?.length ?? course.lessonsCount ?? 0} lessons
                  </Tag>
                  <Tag icon={UsersIcon}>{course.enrolled ?? 0} enrolled</Tag>
                </div>

                <button
                  onClick={() =>
                    setExpanded(expanded === course.id ? null : course.id)
                  }
                  className="mt-4 flex w-full items-center justify-between rounded-xl border border-k-border bg-malt/40 px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:text-turmeric"
                >
                  <span>Lessons ({course.lessons?.length ?? 0})</span>
                  {expanded === course.id ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </button>
              </div>

              {expanded === course.id && (
                <div className="border-t border-k-border bg-malt/30 p-4">
                  <div className="mb-3 flex justify-end">
                    {canWrite ? (
                      <Button
                        size="sm"
                        variant="outline"
                        icon={Plus}
                        onClick={() => {
                          setFormError('');
                          setLessonModal({
                            courseId: course.id,
                            mode: 'create',
                            data: {
                              ...emptyLesson,
                              order: (course.lessons?.length || 0) + 1,
                            },
                          });
                        }}
                      >
                        Add Lesson
                      </Button>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    {(course.lessons || []).length === 0 && (
                      <p className="py-3 text-center text-sm text-text-secondary/70">
                        No lessons yet.
                      </p>
                    )}
                    {(course.lessons || []).map((lesson) => (
                      <div
                        key={lesson.id}
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
                              {lesson.xp} XP · {lesson.duration} min
                            </p>
                          </div>
                        </div>
                        {canWrite ? (
                          <div className="flex shrink-0 gap-1">
                            <button
                              aria-label={`Edit lesson ${lesson.title}`}
                              onClick={() => {
                                setFormError('');
                                setLessonModal({
                                  courseId: course.id,
                                  mode: 'edit',
                                  data: { ...lesson },
                                });
                              }}
                              className="rounded-lg p-1.5 text-text-secondary hover:text-turmeric"
                            >
                              <Pencil size={14} aria-hidden="true" />
                            </button>
                            <button
                              aria-label={`Delete lesson ${lesson.title}`}
                              onClick={() =>
                                setConfirm({ type: 'lesson', course, lesson })
                              }
                              className="rounded-lg p-1.5 text-text-secondary hover:text-error"
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </QueryState>

      {/* Course modal */}
      <Modal
        open={!!courseModal}
        onClose={() => setCourseModal(null)}
        title={courseModal?.mode === 'create' ? 'New Course' : 'Edit Course'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCourseModal(null)}>
              Cancel
            </Button>
            <Button onClick={saveCourse}>Save Course</Button>
          </>
        }
      >
        {courseModal && (
          <div className="space-y-4">
            <FormField
              label="Title"
              name="title"
              value={courseModal.data.title}
              onChange={setCourseField}
              required
              placeholder="Intro to Coding Logic"
            />
            <FormField
              label="Description"
              name="description"
              as="textarea"
              value={courseModal.data.description}
              onChange={setCourseField}
              placeholder="What will students learn?"
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="World"
                name="world"
                as="select"
                options={worldOptions}
                value={
                  courseModal.data.world?._id ||
                  courseModal.data.world?.id ||
                  courseModal.data.world ||
                  ''
                }
                onChange={setCourseField}
              />
              <FormField
                label="Level"
                name="level"
                as="select"
                options={LEVELS}
                value={courseModal.data.level}
                onChange={setCourseField}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                name="published"
                checked={!!courseModal.data.published}
                onChange={setCourseField}
                className="h-4 w-4 accent-turmeric"
              />
              Published
            </label>
            {formError && (
              <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
                {formError}
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Lesson modal */}
      <Modal
        open={!!lessonModal}
        onClose={() => setLessonModal(null)}
        title={lessonModal?.mode === 'create' ? 'New Lesson' : 'Edit Lesson'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLessonModal(null)}>
              Cancel
            </Button>
            <Button onClick={saveLesson}>Save Lesson</Button>
          </>
        }
      >
        {lessonModal && (
          <div className="space-y-4">
            <FormField
              label="Lesson Title"
              name="title"
              value={lessonModal.data.title}
              onChange={setLessonField}
              required
            />
            <div className="grid grid-cols-3 gap-3">
              <FormField
                label="Order"
                name="order"
                type="number"
                value={lessonModal.data.order}
                onChange={setLessonField}
              />
              <FormField
                label="XP"
                name="xp"
                type="number"
                value={lessonModal.data.xp}
                onChange={setLessonField}
              />
              <FormField
                label="Mins"
                name="duration"
                type="number"
                value={lessonModal.data.duration}
                onChange={setLessonField}
              />
            </div>
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
        onConfirm={() =>
          confirm?.type === 'course'
            ? removeCourse(confirm.course)
            : removeLesson(confirm.course, confirm.lesson)
        }
        title={confirm?.type === 'course' ? 'Delete course?' : 'Delete lesson?'}
        confirmLabel="Delete"
        message={
          confirm?.type === 'course'
            ? `"${confirm?.course?.title}" and all its lessons will be permanently removed.`
            : `Lesson "${confirm?.lesson?.title}" will be permanently removed.`
        }
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

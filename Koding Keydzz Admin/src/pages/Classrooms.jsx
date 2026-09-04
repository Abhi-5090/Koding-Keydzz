import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  School,
  Plus,
  Search,
  Users,
  GraduationCap,
  Archive,
  ArchiveRestore,
  Pencil,
  UserPlus,
  UserMinus,
  Info,
  TrendingUp,
} from 'lucide-react';
import {
  useGetClassroomsQuery,
  useGetClassroomQuery,
  useCreateClassroomMutation,
  useUpdateClassroomMutation,
  useUpdateClassroomRosterMutation,
  useArchiveClassroomMutation,
  useGetStaffQuery,
  useGetStudentsQuery,
  useGetClassroomAnalyticsQuery,
} from '../features/admin/adminApi';
import { selectAuth } from '../features/auth/authSlice';
import PageHeader from '../components/ui/PageHeader';
import QueryState from '../components/ui/QueryState';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import FormField from '../components/ui/FormField';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  StatTile,
  MeterRow,
  StatusChip,
  BarBreakdown,
  ChartPanel,
  ChartEmpty,
} from '../components/charts/Primitives';
import useChartTheme from '../components/charts/useChartTheme';
import { formatApiError } from '../utils/apiError';

/**
 * Classes — the link between teachers and pupils.
 *
 * An administrator creates classes, assigns teachers, and puts pupils on the
 * roster. A teacher sees only their own classes here and can adjust the roster
 * but not create or delete a class.
 *
 * WRITTEN FOR NON-TECHNICAL USERS: "Class", "Teachers", "Pupils" — the words a
 * school uses. Roster editing is a two-list picker rather than a tag input,
 * because a picker is obvious and a tag input is not.
 */

function hasCapability(user, cap) {
  return Array.isArray(user?.capabilities) && user.capabilities.includes(cap);
}

/** Create / edit a class. */
function ClassForm({ initial, facultyOptions, onSubmit, onCancel, saving, error }) {
  const editing = Boolean(initial?.id);
  const [form, setForm] = useState({
    name: initial?.name || '',
    grade: initial?.grade || '',
    section: initial?.section || '',
    subject: initial?.subject || '',
    academicYear: initial?.academicYear || '',
    faculty: (initial?.faculty || []).map((f) => f.id),
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const toggleFaculty = (id) =>
    setForm((f) => ({
      ...f,
      faculty: f.faculty.includes(id)
        ? f.faculty.filter((x) => x !== id)
        : [...f.faculty, id],
    }));

  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      name: form.name.trim(),
      grade: form.grade.trim(),
      section: form.section.trim(),
      subject: form.subject.trim(),
      academicYear: form.academicYear.trim(),
      faculty: form.faculty,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormField
        label="Class name"
        name="name"
        value={form.name}
        onChange={set('name')}
        placeholder="e.g. Grade 5 — Section A"
        required
        hint="Whatever your school calls it. This is what teachers will see."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Grade" name="grade" value={form.grade} onChange={set('grade')} placeholder="e.g. 5" hint="Optional" />
        <FormField label="Section" name="section" value={form.section} onChange={set('section')} placeholder="e.g. A" hint="Optional" />
        <FormField label="Year" name="academicYear" value={form.academicYear} onChange={set('academicYear')} placeholder="e.g. 2026-27" hint="Optional" />
      </div>
      <FormField
        label="Subject"
        name="subject"
        value={form.subject}
        onChange={set('subject')}
        placeholder="e.g. Python Basics"
        hint="Optional"
      />

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-text-primary">
          Who teaches this class?
        </legend>
        <p className="mb-2 text-xs text-text-secondary/70">
          Teachers you tick here will see this class and its pupils when they sign in.
          You can change this at any time.
        </p>
        {facultyOptions.length ? (
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-k-border bg-surface/40 p-2">
            {facultyOptions.map((f) => (
              <label
                key={f.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-card"
              >
                <input
                  type="checkbox"
                  checked={form.faculty.includes(f.id)}
                  onChange={() => toggleFaculty(f.id)}
                  className="accent-turmeric"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-text-primary">{f.name}</span>
                  {f.title && (
                    <span className="block truncate text-xs text-text-secondary/70">
                      {f.title}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-k-border bg-surface/40 p-3 text-sm text-text-secondary">
            No teachers added yet. Add one on the <strong>Teachers &amp;
            administrators</strong> page first, then come back.
          </p>
        )}
      </fieldset>

      {error && (
        <p className="rounded-lg border border-error/40 bg-error/10 p-3 text-sm text-error">
          {formatApiError(error, 'Could not save this class.')}
        </p>
      )}

      <div className="flex justify-end gap-3 border-t border-k-border pt-4">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={saving}>
          {editing ? 'Save changes' : 'Create class'}
        </Button>
      </div>
    </form>
  );
}

/** Two-list roster picker: everyone on the left, this class on the right. */
function RosterPicker({ classroom, onClose }) {
  const [search, setSearch] = useState('');
  const studentsQuery = useGetStudentsQuery({ search, limit: 100 });
  const [updateRoster, state] = useUpdateClassroomRosterMutation();

  const inClass = useMemo(
    () => new Set((classroom.students || []).map((s) => s.id)),
    [classroom.students]
  );
  const all = studentsQuery.data?.items || [];
  const available = all.filter((s) => !inClass.has(String(s._id)));

  const add = (id) => updateRoster({ id: classroom.id, add: [id] });
  const remove = (id) => updateRoster({ id: classroom.id, remove: [id] });

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-k-border bg-surface/50 p-3">
        <Info size={16} className="mt-0.5 shrink-0 text-turmeric" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-text-secondary">
          Pupils in this class are visible to its teachers. Removing a pupil here does not
          delete their account — it only takes them off this class list.
        </p>
      </div>

      <label className="relative block">
        <span className="sr-only">Search pupils</span>
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/70"
          aria-hidden="true"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pupils by name or username…"
          className="w-full rounded-xl border border-k-border bg-card py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary/70 focus:border-turmeric/60 focus:outline-none"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-text-secondary">
            Not in this class ({available.length})
          </h4>
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-k-border bg-surface/40 p-2">
            {available.length ? (
              available.map((s) => (
                <div key={s._id} className="flex items-center gap-2 rounded-lg p-2 hover:bg-card">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-text-primary">{s.name}</span>
                    <span className="block truncate text-xs text-text-secondary/70">
                      {s.rollNumber ? `Roll ${s.rollNumber}` : s.username}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => add(String(s._id))}
                    disabled={state.isLoading}
                    aria-label={`Add ${s.name} to this class`}
                    className="shrink-0 rounded-lg p-1.5 text-success transition-colors hover:bg-success/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
                  >
                    <UserPlus size={15} aria-hidden="true" />
                  </button>
                </div>
              ))
            ) : (
              <p className="p-3 text-xs text-text-secondary/70">
                {search ? 'No pupils match that search.' : 'Every pupil is already in this class.'}
              </p>
            )}
          </div>
        </section>

        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-text-secondary">
            In this class ({classroom.students?.length || 0})
          </h4>
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-k-border bg-surface/40 p-2">
            {classroom.students?.length ? (
              classroom.students.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg p-2 hover:bg-card">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-text-primary">{s.name}</span>
                    <span className="block truncate text-xs text-text-secondary/70">
                      {s.rollNumber ? `Roll ${s.rollNumber}` : s.username} · {s.xp} XP
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    disabled={state.isLoading}
                    aria-label={`Remove ${s.name} from this class`}
                    className="shrink-0 rounded-lg p-1.5 text-error transition-colors hover:bg-error/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-error"
                  >
                    <UserMinus size={15} aria-hidden="true" />
                  </button>
                </div>
              ))
            ) : (
              <p className="p-3 text-xs text-text-secondary/70">
                No pupils yet. Add them from the left.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="flex justify-end border-t border-k-border pt-4">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

/** Per-class analytics panel. */
function ClassInsight({ classroomId }) {
  const q = useGetClassroomAnalyticsQuery({ id: classroomId, days: 30 });
  const d = q.data;

  return (
    <QueryState
      isLoading={q.isLoading}
      isError={q.isError}
      error={q.error}
      refetch={q.refetch}
      loadingLabel="Loading class report…"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile index={0} label="Pupils" value={d?.kpis?.students?.value ?? 0} delta={null} direction="flat" icon={Users} />
          <StatTile index={1} label="Active this week" value={d?.kpis?.activeStudents?.value ?? 0} delta={null} direction="flat" hint={`${d?.engagement?.engagementRate ?? 0}%`} icon={TrendingUp} />
          <StatTile index={2} label="Average score" value={`${d?.engagement?.classAverageScore ?? 0}%`} delta={null} direction="flat" icon={TrendingUp} />
          <StatTile index={3} label="Need help" value={d?.kpis?.needingAttention?.value ?? 0} delta={null} direction="flat" tone="inverse" icon={GraduationCap} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ChartPanel index={0} title="Hardest quizzes" subtitle="Lowest pass rate first" height={220}>
            <BarBreakdown
              data={(d?.quizDifficulty || []).slice(0, 6).map((x) => ({
                label: x.title.length > 24 ? `${x.title.slice(0, 22)}…` : x.title,
                value: x.passRate,
              }))}
              horizontal
              suffix="%"
              colorFor={(row) =>
                row.value >= 70 ? STATUS.good : row.value >= 40 ? STATUS.warning : STATUS.critical
              }
              emptyMessage="No quizzes attempted yet"
            />
          </ChartPanel>

          <ChartPanel index={1} title="Pupils needing help" subtitle="Most urgent first" height="auto">
            {d?.needingAttention?.length ? (
              <ul className="flex flex-col gap-2 py-1">
                {d.needingAttention.slice(0, 8).map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-text-primary">{s.name}</span>
                      <span className="block truncate text-xs text-text-secondary/70">
                        {s.attention.slice(0, 2).join(' · ')}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-text-secondary">
                      {s.quizzesAttempted ? `${s.avgScore}%` : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <ChartEmpty message="Everyone is on track" />
            )}
          </ChartPanel>
        </div>
      </div>
    </QueryState>
  );
}

export default function Classrooms() {
  const { STATUS } = useChartTheme();
  const { user } = useSelector(selectAuth);
  const canWrite = hasCapability(user, 'classroom:write');

  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [rosterId, setRosterId] = useState(null);
  const [insightId, setInsightId] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(null);

  const query = useGetClassroomsQuery({
    search,
    ...(showArchived ? { includeArchived: 'true' } : {}),
  });
  const staffQuery = useGetStaffQuery({ role: 'faculty', limit: 100 });
  const detailQuery = useGetClassroomQuery(editingId ?? rosterId, {
    skip: !editingId && !rosterId,
  });

  const [createClassroom, createState] = useCreateClassroomMutation();
  const [updateClassroom, updateState] = useUpdateClassroomMutation();
  const [archiveClassroom] = useArchiveClassroomMutation();

  const items = query.data?.items || [];
  const facultyOptions = (staffQuery.data?.items || []).filter((s) => s.role === 'faculty');

  const handleCreate = async (payload) => {
    try {
      await createClassroom(payload).unwrap();
      setCreateOpen(false);
    } catch {
      /* surfaced in the form */
    }
  };

  const handleUpdate = async (payload) => {
    try {
      await updateClassroom({ id: editingId, ...payload }).unwrap();
      setEditingId(null);
    } catch {
      /* surfaced in the form */
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes"
        subtitle={
          canWrite
            ? "Group pupils into classes and assign teachers to them"
            : 'The classes you teach'
        }
      >
        {canWrite && (
          <Button icon={Plus} onClick={() => setCreateOpen(true)}>
            Create a class
          </Button>
        )}
      </PageHeader>

      {canWrite && (
        <div className="k-card flex items-start gap-3 p-4">
          <Info size={18} className="mt-0.5 shrink-0 text-turmeric" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-text-secondary">
            A teacher only sees the pupils in the classes you assign them — so creating
            classes is what turns a teacher account into a useful one. A pupil can be in
            more than one class.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex-1 min-w-[220px]">
          <span className="sr-only">Search classes</span>
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/70"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search classes…"
            className="w-full rounded-xl border border-k-border bg-card py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary/70 focus:border-turmeric/60 focus:outline-none"
          />
        </label>
        {canWrite && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="accent-turmeric"
            />
            Show archived classes
          </label>
        )}
      </div>

      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        refetch={query.refetch}
        isEmpty={!items.length}
        emptyIcon={School}
        emptyTitle={search ? 'No matches' : canWrite ? 'No classes yet' : 'No classes assigned to you'}
        emptyMessage={
          search
            ? 'Try a different search.'
            : canWrite
              ? 'Create your first class, assign a teacher to it, then add pupils to the roster.'
              : 'Ask your administrator to add you to a class. Once they do, your pupils and their progress appear here.'
        }
        loadingLabel="Loading classes…"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => (
            <article key={c.id} className={`k-card p-5 ${c.archived ? 'opacity-60' : ''}`}>
              <header className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-heading text-base font-bold text-text-primary">
                    {c.name}
                  </h3>
                  <p className="truncate text-xs text-text-secondary/70">
                    {[c.subject, c.academicYear].filter(Boolean).join(' · ') || 'No subject set'}
                  </p>
                </div>
                {c.archived && <StatusChip tone="neutral" icon={Archive}>Archived</StatusChip>}
              </header>

              <dl className="mb-4 grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-text-secondary/70">Pupils</dt>
                  <dd className="font-heading text-xl font-extrabold tabular-nums text-text-primary">
                    {c.studentCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-text-secondary/70">Teachers</dt>
                  <dd className="font-heading text-xl font-extrabold tabular-nums text-text-primary">
                    {c.facultyCount}
                  </dd>
                </div>
              </dl>

              {c.faculty?.length ? (
                <p className="mb-4 truncate text-xs text-text-secondary">
                  <GraduationCap size={11} className="mr-1 inline" aria-hidden="true" />
                  {c.faculty.map((f) => f.name).join(', ')}
                </p>
              ) : (
                <p className="mb-4 text-xs text-amber-400/90">
                  No teacher assigned yet
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" icon={TrendingUp} onClick={() => setInsightId(c.id)}>
                  Report
                </Button>
                <Button size="sm" variant="outline" icon={Users} onClick={() => setRosterId(c.id)}>
                  Pupils
                </Button>
                {canWrite && (
                  <>
                    <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditingId(c.id)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={c.archived ? ArchiveRestore : Archive}
                      onClick={() => setConfirmArchive(c)}
                    >
                      {c.archived ? 'Restore' : 'Archive'}
                    </Button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </QueryState>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a class" size="lg">
        <ClassForm
          facultyOptions={facultyOptions}
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          saving={createState.isLoading}
          error={createState.error}
        />
      </Modal>

      <Modal
        open={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        title={`Edit ${detailQuery.data?.name || 'class'}`}
        size="lg"
      >
        {detailQuery.data && (
          <ClassForm
            initial={detailQuery.data}
            facultyOptions={facultyOptions}
            onSubmit={handleUpdate}
            onCancel={() => setEditingId(null)}
            saving={updateState.isLoading}
            error={updateState.error}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(rosterId)}
        onClose={() => setRosterId(null)}
        title={`Pupils in ${detailQuery.data?.name || 'this class'}`}
        size="xl"
      >
        {detailQuery.data && (
          <RosterPicker classroom={detailQuery.data} onClose={() => setRosterId(null)} />
        )}
      </Modal>

      <Modal
        open={Boolean(insightId)}
        onClose={() => setInsightId(null)}
        title="Class report"
        size="xl"
      >
        {insightId && <ClassInsight classroomId={insightId} />}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmArchive)}
        onClose={() => setConfirmArchive(null)}
        onConfirm={async () => {
          await archiveClassroom({
            id: confirmArchive.id,
            archive: !confirmArchive.archived,
          });
          setConfirmArchive(null);
        }}
        title={
          confirmArchive?.archived
            ? `Restore ${confirmArchive?.name}?`
            : `Archive ${confirmArchive?.name}?`
        }
        message={
          confirmArchive?.archived
            ? 'The class becomes active again and its teachers regain access to it.'
            : 'The class is hidden and its teachers stop seeing these pupils. Nothing is deleted — past reports stay intact, and you can restore it at any time.'
        }
        confirmLabel={confirmArchive?.archived ? 'Restore' : 'Archive'}
      />
    </div>
  );
}

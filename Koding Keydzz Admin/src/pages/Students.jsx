import { useState } from 'react';
import {
  Eye,
  Ban,
  CheckCircle2,
  UserPlus,
  UploadCloud,
  KeyRound,
  Download,
  Copy,
  Check,
  Pencil,
  Trash2,
  AlertTriangle,
  Users as UsersIcon,
} from 'lucide-react';
import {
  useGetStudentsQuery,
  useSuspendStudentMutation,
  useCreateStudentMutation,
  useUpdateStudentMutation,
  useDeleteStudentMutation,
  useResetStudentPasswordMutation,
  exportStudentsCsv,
} from '../features/admin/adminApi';
import DataTable from '../components/ui/DataTable';
import AnimatedIcon from '../components/ui/AnimatedIcon';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import FormField from '../components/ui/FormField';
import QueryState from '../components/ui/QueryState';
import BulkUploadModal from '../components/students/BulkUploadModal';
import StudentDetailModal from '../components/students/StudentDetailModal';
import StudentEditModal, { GRADE_OPTIONS } from '../components/students/StudentEditModal';
import { formatApiError } from '../utils/apiError';

function StatusBadge({ status }) {
  const map = {
    active: 'bg-success/15 text-success border-success/30',
    idle: 'bg-turmeric/15 text-turmeric border-turmeric/30',
    suspended: 'bg-error/15 text-error border-error/30',
  };
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${map[status] || map.idle}`}
    >
      {status}
    </span>
  );
}

const emptyStudent = {
  firstName: '',
  lastName: '',
  grade: '',
  school: '',
  email: '',
  phone: '',
  username: '',
  password: '',
};

function asList(data) {
  if (Array.isArray(data)) return data;
  return data?.students || data?.items || [];
}

export default function Students() {
  const { data, isError, isLoading, error, refetch } = useGetStudentsQuery();
  const [suspendStudent, { isLoading: suspending }] = useSuspendStudentMutation();
  const [createStudent, { isLoading: addingStudent }] = useCreateStudentMutation();
  const [updateStudent, { isLoading: updating }] = useUpdateStudentMutation();
  const [deleteStudent, { isLoading: deleting }] = useDeleteStudentMutation();
  const [resetStudentPassword, { isLoading: resetting }] = useResetStudentPasswordMutation();

  const students = asList(data);

  const [viewing, setViewing] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyStudent);
  const [addError, setAddError] = useState('');
  const [addResult, setAddResult] = useState(null); // { name, username, password, email, phone }
  const [addCopied, setAddCopied] = useState(false);

  // Reset-password modal state.
  const [resetTarget, setResetTarget] = useState(null);
  const [resetMode, setResetMode] = useState('auto'); // 'auto' | 'manual'
  const [resetCustom, setResetCustom] = useState('');
  const [resetResult, setResetResult] = useState(null); // { student, password }
  const [resetError, setResetError] = useState('');
  const [resetCopied, setResetCopied] = useState(false);

  // Export state.
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const openReset = (student) => {
    setResetTarget(student);
    setResetMode('auto');
    setResetCustom('');
    setResetResult(null);
    setResetError('');
    setResetCopied(false);
  };

  const closeReset = () => {
    setResetTarget(null);
    setResetResult(null);
    setResetError('');
  };

  const handleResetPassword = async () => {
    setResetError('');
    const custom = resetMode === 'manual' ? resetCustom.trim() : '';
    if (resetMode === 'manual' && custom.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }
    try {
      const res = await resetStudentPassword({
        id: resetTarget.id,
        password: custom || undefined,
      }).unwrap();
      setResetResult({
        student: res?.student || resetTarget,
        password: res?.password || custom,
      });
    } catch (err) {
      setResetError(
        formatApiError(err, 'Could not reset the password. Please try again.')
      );
    }
  };

  const copyResetPassword = () => {
    if (!resetResult?.password) return;
    const username = resetResult.student?.username;
    const text = username
      ? `Username: ${username}\nPassword: ${resetResult.password}`
      : resetResult.password;
    navigator.clipboard?.writeText(text).catch(() => {});
    setResetCopied(true);
    setTimeout(() => setResetCopied(false), 1500);
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError('');
    try {
      await exportStudentsCsv();
    } catch {
      setExportError('Could not export the roster. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const onAddField = (e) =>
    setAddForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const closeAdd = () => {
    setAddOpen(false);
    setAddForm(emptyStudent);
    setAddError('');
    setAddResult(null);
    setAddCopied(false);
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setAddError('');
    if (!addForm.firstName.trim() || addForm.password.length < 6) {
      setAddError('First name and a password (min 6 characters) are required.');
      return;
    }
    try {
      const res = await createStudent({
        firstName: addForm.firstName.trim(),
        lastName: addForm.lastName.trim(),
        grade: addForm.grade || undefined,
        school: addForm.school.trim() || undefined,
        email: addForm.email.trim() || undefined,
        phone: addForm.phone.trim() || undefined,
        username: addForm.username.trim() || undefined,
        password: addForm.password,
      }).unwrap();
      const created = res?.student || res || {};
      setAddResult({
        name:
          created.name ||
          [addForm.firstName.trim(), addForm.lastName.trim()].filter(Boolean).join(' ').trim(),
        username: created.username || addForm.username.trim(),
        password: res?.password || addForm.password,
        email: created.email || addForm.email.trim(),
        phone: created.phone || addForm.phone.trim(),
      });
    } catch (err) {
      setAddError(
        err?.data?.details?.[0]?.message ||
          formatApiError(err, 'Could not add the student. Please try again.')
      );
    }
  };

  const copyAddCredentials = () => {
    if (!addResult) return;
    const text = `Username: ${addResult.username}\nPassword: ${addResult.password}`;
    navigator.clipboard?.writeText(text).catch(() => {});
    setAddCopied(true);
    setTimeout(() => setAddCopied(false), 1500);
  };

  const doSuspend = async () => {
    const target = confirmTarget;
    const next = !target.suspended;
    try {
      await suspendStudent({ id: target.id, suspended: next }).unwrap();
    } catch {
      /* keep dialog open is unnecessary; the table reflects server state */
    }
    setConfirmTarget(null);
  };

  const doDelete = async () => {
    try {
      await deleteStudent(deleteTarget.id).unwrap();
    } catch {
      /* the roster reflects server state on the next fetch */
    }
    setDeleteTarget(null);
  };

  const columns = [
    {
      key: 'name',
      header: 'Student',
      render: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-turmeric/20 text-xs font-bold text-turmeric">
            {(r.name || '?').charAt(0)}
          </div>
          <div className="min-w-0 max-w-[220px]">
            <p className="truncate font-medium text-text-primary">{r.name}</p>
            <p className="truncate text-xs text-text-secondary/70">{r.email || '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'username',
      header: 'Username',
      sortValue: (r) => r.username || '',
      render: (r) => (
        <span
          className="block max-w-[160px] truncate font-mono text-xs text-text-primary"
          title={r.username || ''}
        >
          {r.username || '—'}
        </span>
      ),
    },
    { key: 'grade', header: 'Grade' },
    {
      key: 'xp',
      header: 'XP',
      render: (r) => (
        <span className="font-semibold text-turmeric">{(r.xp ?? 0).toLocaleString()}</span>
      ),
    },
    { key: 'level', header: 'Level', render: (r) => `Lv ${r.level ?? 1}` },
    {
      key: 'completionRate',
      header: 'Progress',
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-malt">
            <div
              className="h-full rounded-full bg-turmeric"
              style={{ width: `${r.completionRate ?? 0}%` }}
            />
          </div>
          <span className="text-xs text-text-secondary">{r.completionRate ?? 0}%</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      searchable: false,
      render: (r) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewing(r)}
            title="View progress"
            aria-label={`View progress for ${r.name}`}
            className="rounded-lg p-1.5 text-text-secondary transition-colors duration-150 ease-out hover:bg-surface hover:text-turmeric active:scale-95"
          >
            <AnimatedIcon icon={Eye} size={16} animation="hover" />
          </button>
          <button
            onClick={() => setEditTarget(r)}
            title="Edit student"
            aria-label={`Edit ${r.name}`}
            className="rounded-lg p-1.5 text-text-secondary transition-colors duration-150 ease-out hover:bg-surface hover:text-turmeric active:scale-95"
          >
            <AnimatedIcon icon={Pencil} size={16} animation="hover" />
          </button>
          <button
            onClick={() => openReset(r)}
            title="Reset password"
            aria-label={`Reset password for ${r.name}`}
            className="rounded-lg p-1.5 text-text-secondary transition-colors duration-150 ease-out hover:bg-surface hover:text-turmeric active:scale-95"
          >
            <AnimatedIcon icon={KeyRound} size={16} animation="hover" />
          </button>
          <button
            onClick={() => setConfirmTarget(r)}
            title={r.suspended ? 'Reinstate' : 'Suspend'}
            aria-label={`${r.suspended ? 'Reinstate' : 'Suspend'} ${r.name}`}
            className={`rounded-lg p-1.5 transition-colors duration-150 ease-out active:scale-95 hover:bg-surface ${
              r.suspended ? 'text-success' : 'text-error'
            }`}
          >
            <AnimatedIcon icon={r.suspended ? CheckCircle2 : Ban} size={16} animation="pop" />
          </button>
          <button
            onClick={() => setDeleteTarget(r)}
            title="Delete student"
            aria-label={`Delete ${r.name}`}
            className="rounded-lg p-1.5 text-error transition-colors duration-150 ease-out hover:bg-surface active:scale-95"
          >
            <AnimatedIcon icon={Trash2} size={16} animation="pop" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        subtitle={isLoading ? 'Loading learners…' : `Managing ${students.length} learners`}
      >
        <Button
          variant="secondary"
          icon={Download}
          onClick={handleExport}
          loading={exporting}
        >
          Export Roster (CSV)
        </Button>
        <Button variant="secondary" icon={UploadCloud} onClick={() => setBulkOpen(true)}>
          Bulk Upload
        </Button>
        <Button icon={UserPlus} onClick={() => setAddOpen(true)}>
          Add Student
        </Button>
      </PageHeader>

      {exportError && (
        <p className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
          <AlertTriangle size={16} /> {exportError}
        </p>
      )}

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={refetch}
        isEmpty={students.length === 0}
        loadingLabel="Loading students…"
        emptyTitle="No students yet"
        emptyMessage="Add a student or bulk-upload a roster to get started."
        emptyIcon={UsersIcon}
      >
        <DataTable
          columns={columns}
          data={students}
          searchKeys={['name', 'username', 'email', 'grade', 'world']}
          pageSize={8}
        />
      </QueryState>

      {/* Full progress / detail view (GET /admin/students/:id) */}
      <StudentDetailModal
        open={!!viewing}
        onClose={() => setViewing(null)}
        studentId={viewing?.id}
        fallbackName={viewing?.name}
        role="admin"
      />

      <ConfirmDialog
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={doSuspend}
        loading={suspending}
        title={confirmTarget?.suspended ? 'Reinstate account?' : 'Suspend account?'}
        confirmLabel={confirmTarget?.suspended ? 'Reinstate' : 'Suspend'}
        variant={confirmTarget?.suspended ? 'primary' : 'danger'}
        message={
          confirmTarget?.suspended
            ? `Restore access for ${confirmTarget?.name}?`
            : `${confirmTarget?.name} will lose access to the platform until reinstated.`
        }
      />

      {/* Edit student (PATCH /admin/students/:id) */}
      <StudentEditModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        student={editTarget}
        loading={updating}
        onSubmit={(id, patch) => updateStudent({ id, ...patch }).unwrap()}
      />

      {/* Delete student (DELETE /admin/students/:id) */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        loading={deleting}
        title="Delete student?"
        confirmLabel="Delete"
        variant="danger"
        message={`Delete ${deleteTarget?.name}? This permanently removes the student and their progress. This cannot be undone.`}
      />

      {/* Add single student */}
      <Modal
        open={addOpen}
        onClose={closeAdd}
        title="Add Student"
        size="md"
        footer={
          addResult ? (
            <Button icon={CheckCircle2} onClick={closeAdd}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={closeAdd} disabled={addingStudent}>
                Cancel
              </Button>
              <Button onClick={handleAddStudent} loading={addingStudent} icon={UserPlus}>
                Add Student
              </Button>
            </>
          )
        }
      >
        {addResult ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              <CheckCircle2 size={16} /> {addResult.name || 'Student'} added.
            </div>

            <p className="text-sm text-text-secondary/80">
              Share these login credentials with the student. The password will not be shown
              again after you close this dialog.
            </p>

            <div className="space-y-3 rounded-xl border border-k-border bg-malt/40 p-4">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <span className="k-label mb-0 shrink-0">Username</span>
                <code className="min-w-0 select-all truncate font-mono text-sm font-bold text-turmeric" title={addResult.username}>
                  {addResult.username || '—'}
                </code>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <span className="k-label mb-0 shrink-0">Password</span>
                <code className="min-w-0 select-all truncate font-mono text-sm font-bold text-turmeric" title={addResult.password}>
                  {addResult.password}
                </code>
              </div>
              {addResult.email && (
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <span className="k-label mb-0 shrink-0">Email</span>
                  <span className="min-w-0 truncate text-sm text-text-secondary" title={addResult.email}>
                    {addResult.email}
                  </span>
                </div>
              )}
            </div>

            <Button
              variant="secondary"
              icon={addCopied ? Check : Copy}
              onClick={copyAddCredentials}
              className="w-full justify-center"
            >
              {addCopied ? 'Copied' : 'Copy username & password'}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleAddStudent} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="First Name"
                name="firstName"
                value={addForm.firstName}
                onChange={onAddField}
                placeholder="Aarav"
                required
              />
              <FormField
                label="Last Name"
                name="lastName"
                value={addForm.lastName}
                onChange={onAddField}
                placeholder="Sharma"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Grade"
                name="grade"
                as="select"
                value={addForm.grade}
                onChange={onAddField}
                options={GRADE_OPTIONS}
              />
              <FormField
                label="School"
                name="school"
                value={addForm.school}
                onChange={onAddField}
                placeholder="Springfield Public School"
              />
            </div>
            <FormField
              label="Username (optional)"
              name="username"
              value={addForm.username}
              onChange={onAddField}
              placeholder="aarav.sharma"
              hint="Auto-generated if blank. This is the student's login id."
            />
            <FormField
              label="Email (optional)"
              name="email"
              type="email"
              value={addForm.email}
              onChange={onAddField}
              placeholder="aarav@school.edu"
              hint="Young students may not have an email — leave it blank."
            />
            <FormField
              label="Phone"
              name="phone"
              value={addForm.phone}
              onChange={onAddField}
              placeholder="+91 98765 43210"
            />
            <FormField
              label="Password"
              name="password"
              value={addForm.password}
              onChange={onAddField}
              placeholder="Initial login password (min 6 characters)"
              required
            />
            {addError && (
              <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
                {addError}
              </p>
            )}
          </form>
        )}
      </Modal>

      {/* Reset password */}
      <Modal
        open={!!resetTarget}
        onClose={closeReset}
        title="Reset Password"
        size="md"
        footer={
          resetResult ? (
            <Button icon={CheckCircle2} onClick={closeReset}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={closeReset} disabled={resetting}>
                Cancel
              </Button>
              <Button icon={KeyRound} onClick={handleResetPassword} loading={resetting}>
                Reset Password
              </Button>
            </>
          )
        }
      >
        {resetTarget && !resetResult && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-turmeric/20 text-base font-bold text-turmeric">
                {(resetTarget.name || '?').charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-text-primary">{resetTarget.name}</p>
                <p className="truncate text-xs text-text-secondary/70">
                  {resetTarget.username || resetTarget.email || '—'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-k-border bg-malt/40 p-3 transition hover:border-turmeric/60">
                <input
                  type="radio"
                  name="resetMode"
                  className="mt-1 accent-turmeric"
                  checked={resetMode === 'auto'}
                  onChange={() => setResetMode('auto')}
                />
                <span>
                  <span className="block text-sm font-semibold text-text-primary">
                    Generate automatically
                  </span>
                  <span className="block text-xs text-text-secondary/70">
                    A secure password will be created for you to share.
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-k-border bg-malt/40 p-3 transition hover:border-turmeric/60">
                <input
                  type="radio"
                  name="resetMode"
                  className="mt-1 accent-turmeric"
                  checked={resetMode === 'manual'}
                  onChange={() => setResetMode('manual')}
                />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-text-primary">
                    Set a specific password
                  </span>
                  {resetMode === 'manual' && (
                    <input
                      type="text"
                      value={resetCustom}
                      onChange={(e) => setResetCustom(e.target.value)}
                      placeholder="New password (min 6 characters)"
                      aria-label="New password"
                      className="k-input mt-2"
                    />
                  )}
                </span>
              </label>
            </div>

            {resetError && (
              <p className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
                <AlertTriangle size={16} /> {resetError}
              </p>
            )}
          </div>
        )}

        {resetResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              <CheckCircle2 size={16} /> Password reset for {resetResult.student?.name}.
            </div>

            {resetResult.student?.username && (
              <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-k-border bg-malt/40 px-4 py-3">
                <span className="k-label mb-0 shrink-0">Username</span>
                <code
                  className="min-w-0 select-all truncate font-mono text-sm font-bold text-turmeric"
                  title={resetResult.student.username}
                >
                  {resetResult.student.username}
                </code>
              </div>
            )}

            <div>
              <p className="k-label mb-1.5">New password</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 select-all truncate rounded-xl border border-k-border bg-malt/60 px-4 py-3 font-mono text-lg font-bold tracking-wide text-turmeric">
                  {resetResult.password}
                </code>
                <Button
                  className="shrink-0"
                  variant="secondary"
                  icon={resetCopied ? Check : Copy}
                  onClick={copyResetPassword}
                >
                  {resetCopied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <p className="text-xs text-text-secondary/70">
              Share these credentials with{' '}
              {resetResult.student?.username || resetResult.student?.email || 'the student'} securely.
              They will not be shown again after you close this dialog.
            </p>
          </div>
        )}
      </Modal>

      <BulkUploadModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onComplete={() => refetch()}
      />
    </div>
  );
}

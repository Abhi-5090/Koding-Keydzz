import { useState } from 'react';
import {
  Eye,
  Ban,
  CheckCircle2,
  Zap,
  Award,
  Trophy,
  UserPlus,
  UploadCloud,
  KeyRound,
  Download,
  Copy,
  Check,
  AlertTriangle,
  Users as UsersIcon,
} from 'lucide-react';
import {
  useGetStudentsQuery,
  useSuspendStudentMutation,
  useCreateStudentMutation,
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

const emptyStudent = { firstName: '', lastName: '', email: '', phone: '', password: '' };

function asList(data) {
  if (Array.isArray(data)) return data;
  return data?.students || data?.items || [];
}

export default function Students() {
  const { data, isError, isLoading, error, refetch } = useGetStudentsQuery();
  const [suspendStudent, { isLoading: suspending }] = useSuspendStudentMutation();
  const [createStudent, { isLoading: addingStudent }] = useCreateStudentMutation();
  const [resetStudentPassword, { isLoading: resetting }] = useResetStudentPasswordMutation();

  const students = asList(data);

  const [viewing, setViewing] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyStudent);
  const [addError, setAddError] = useState('');

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
        err?.data?.message || 'Could not reset the password. Please try again.'
      );
    }
  };

  const copyResetPassword = () => {
    if (!resetResult?.password) return;
    navigator.clipboard?.writeText(resetResult.password).catch(() => {});
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

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setAddError('');
    if (!addForm.firstName.trim() || !addForm.email.trim() || addForm.password.length < 6) {
      setAddError('First name, email and a password (min 6 characters) are required.');
      return;
    }
    try {
      await createStudent({
        firstName: addForm.firstName.trim(),
        lastName: addForm.lastName.trim(),
        email: addForm.email.trim(),
        phone: addForm.phone.trim(),
        password: addForm.password,
      }).unwrap();
      setAddForm(emptyStudent);
      setAddOpen(false);
    } catch (err) {
      setAddError(
        err?.data?.details?.[0]?.message ||
          err?.data?.message ||
          'Could not add the student. Please try again.'
      );
    }
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

  const columns = [
    {
      key: 'name',
      header: 'Student',
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-turmeric/20 text-xs font-bold text-turmeric">
            {(r.name || '?').charAt(0)}
          </div>
          <div>
            <p className="font-medium text-text-primary">{r.name}</p>
            <p className="text-xs text-text-secondary/60">{r.email}</p>
          </div>
        </div>
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
          searchKeys={['name', 'email', 'grade', 'world']}
          pageSize={8}
        />
      </QueryState>

      {/* View progress modal */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Student Progress"
        size="md"
      >
        {viewing && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-turmeric/20 text-xl font-bold text-turmeric">
                {(viewing.name || '?').charAt(0)}
              </div>
              <div>
                <p className="font-heading text-lg font-bold text-text-primary">
                  {viewing.name}
                </p>
                <p className="text-sm text-text-secondary/70">{viewing.email}</p>
                <div className="mt-1">
                  <StatusBadge status={viewing.status} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Zap, label: 'Total XP', value: (viewing.xp ?? 0).toLocaleString() },
                { icon: Award, label: 'Coins', value: viewing.coins ?? 0 },
                { icon: Trophy, label: 'Badges', value: viewing.achievements ?? 0 },
              ].map((m) => (
                <div key={m.label} className="rounded-xl border border-k-border bg-malt/40 p-3 text-center">
                  <m.icon size={18} className="mx-auto mb-1 text-turmeric" />
                  <p className="font-heading text-lg font-bold text-text-primary">
                    {m.value}
                  </p>
                  <p className="text-xs text-text-secondary/60">{m.label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2 text-sm">
              <Row label="Grade" value={viewing.grade || '—'} />
              <Row label="Current World" value={viewing.world || '—'} />
              <Row label="Level" value={`Level ${viewing.level ?? 1}`} />
              <Row label="Course Completion" value={`${viewing.completionRate ?? 0}%`} />
              <Row
                label="Last Active"
                value={
                  viewing.lastActiveDays == null
                    ? '—'
                    : viewing.lastActiveDays === 0
                    ? 'Today'
                    : `${viewing.lastActiveDays} day(s) ago`
                }
              />
            </div>

            <div>
              <p className="k-label mb-1.5">Overall Progress</p>
              <div className="h-3 overflow-hidden rounded-full bg-malt">
                <div
                  className="h-full rounded-full bg-turmeric shadow-glow"
                  style={{ width: `${viewing.completionRate ?? 0}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

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

      {/* Add single student */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Student"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={addingStudent}>
              Cancel
            </Button>
            <Button onClick={handleAddStudent} loading={addingStudent} icon={UserPlus}>
              Add Student
            </Button>
          </>
        }
      >
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
          <FormField
            label="Email"
            name="email"
            type="email"
            value={addForm.email}
            onChange={onAddField}
            placeholder="aarav@school.edu"
            hint="The student logs in with this email."
            required
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
              <div>
                <p className="font-medium text-text-primary">{resetTarget.name}</p>
                <p className="text-xs text-text-secondary/60">{resetTarget.email}</p>
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

            <div>
              <p className="k-label mb-1.5">New password</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 select-all rounded-xl border border-k-border bg-malt/60 px-4 py-3 font-mono text-lg font-bold tracking-wide text-turmeric">
                  {resetResult.password}
                </code>
                <Button
                  variant="secondary"
                  icon={resetCopied ? Check : Copy}
                  onClick={copyResetPassword}
                >
                  {resetCopied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <p className="text-xs text-text-secondary/70">
              Share this password with {resetResult.student?.email || 'the student'} securely.
              It will not be shown again after you close this dialog.
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

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-k-border/50 py-2">
      <span className="text-text-secondary/70">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}

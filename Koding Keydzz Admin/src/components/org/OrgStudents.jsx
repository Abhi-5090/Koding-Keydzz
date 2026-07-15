import { useState } from 'react';
import {
  Users as UsersIcon,
  UserPlus,
  UploadCloud,
  Download,
  KeyRound,
  Ban,
  CheckCircle2,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import DataTable from '../ui/DataTable';
import StatCard from '../ui/StatCard';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import QueryState from '../ui/QueryState';
import AnimatedIcon from '../ui/AnimatedIcon';
import BulkUploadModal from '../students/BulkUploadModal';

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

function asList(data) {
  if (Array.isArray(data)) return data;
  return data?.students || data?.items || [];
}

const emptyStudent = { firstName: '', lastName: '', email: '', phone: '', username: '', password: '' };

/**
 * Shared org-student roster experience used by BOTH the super admin (per-org,
 * via :id endpoints) and the org admin (their own org, via /admin endpoints).
 *
 * The caller injects a "data source" so this component stays endpoint-agnostic:
 *   source = {
 *     useStudents()      -> RTK query result { data, isLoading, ... }
 *     useCreate()        -> [createFn, { isLoading }]  (createFn(body))
 *     useSuspend()       -> [suspendFn, { isLoading }] (suspendFn({ id, suspended }))
 *     useReset()         -> [resetFn,  { isLoading }]  (resetFn({ id, password? }))
 *     templatePath       -> bulk-upload template endpoint
 *     uploadPath         -> bulk-upload endpoint
 *     exportRoster?()    -> optional async fn that downloads a roster CSV
 *   }
 *
 * `count` (live student count) and `title` are passed by the wrapping page.
 */
export default function OrgStudents({ source, count, title = 'Students' }) {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = source.useStudents();
  const [createStudent, { isLoading: adding }] = source.useCreate();
  const [suspendStudent, { isLoading: suspending }] = source.useSuspend();
  const [resetStudentPassword, { isLoading: resetting }] = source.useReset();

  const students = asList(data);
  const liveCount = count ?? (data?.total ?? students.length);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyStudent);
  const [addError, setAddError] = useState('');
  const [addResult, setAddResult] = useState(null); // { name, username, password, email, phone }
  const [addCopied, setAddCopied] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState(null);

  const [resetTarget, setResetTarget] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const [resetError, setResetError] = useState('');
  const [copied, setCopied] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const onAddField = (e) => setAddForm((f) => ({ ...f, [e.target.name]: e.target.value }));

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
          err?.data?.message ||
          'Could not add the student. Please try again.'
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
    const t = confirmTarget;
    try {
      await suspendStudent({ id: t.id, suspended: !t.suspended }).unwrap();
    } catch {
      /* table reflects server state */
    }
    setConfirmTarget(null);
  };

  const openReset = (student) => {
    setResetTarget(student);
    setResetResult(null);
    setResetError('');
    setCopied(false);
  };

  const handleReset = async () => {
    setResetError('');
    try {
      const res = await resetStudentPassword({ id: resetTarget.id }).unwrap();
      setResetResult({ student: res?.student || resetTarget, password: res?.password });
    } catch (err) {
      setResetError(err?.data?.message || 'Could not reset the password. Please try again.');
    }
  };

  const copyPassword = () => {
    if (!resetResult?.password) return;
    const username = resetResult.student?.username;
    const text = username
      ? `Username: ${username}\nPassword: ${resetResult.password}`
      : resetResult.password;
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleExport = async () => {
    if (!source.exportRoster) return;
    setExporting(true);
    setExportError('');
    try {
      await source.exportRoster();
    } catch {
      setExportError('Could not export the roster. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const studentName = (r) =>
    r.name || [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || '—';

  const columns = [
    {
      key: 'name',
      header: 'Student',
      sortValue: (r) => studentName(r),
      render: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-turmeric/20 text-xs font-bold text-turmeric">
            {studentName(r).charAt(0)}
          </div>
          <div className="min-w-0 max-w-[220px]">
            <p className="truncate font-medium text-text-primary">{studentName(r)}</p>
            <p className="truncate text-xs text-text-secondary/60">{r.email || '—'}</p>
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
    { key: 'phone', header: 'Phone', render: (r) => r.phone || '—' },
    {
      key: 'xp',
      header: 'XP',
      render: (r) => <span className="font-semibold text-turmeric">{(r.xp ?? 0).toLocaleString()}</span>,
    },
    { key: 'level', header: 'Level', render: (r) => `Lv ${r.level ?? 1}` },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      searchable: false,
      render: (r) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openReset(r)}
            title="Reset password"
            aria-label={`Reset password for ${studentName(r)}`}
            className="rounded-lg p-1.5 text-text-secondary transition-colors duration-150 ease-out hover:bg-surface hover:text-turmeric active:scale-95"
          >
            <AnimatedIcon icon={KeyRound} size={16} animation="hover" />
          </button>
          <button
            onClick={() => setConfirmTarget(r)}
            title={r.suspended ? 'Reinstate' : 'Suspend'}
            aria-label={`${r.suspended ? 'Reinstate' : 'Suspend'} ${studentName(r)}`}
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Students" value={Number(liveCount).toLocaleString()} icon={UsersIcon} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-heading text-lg font-bold text-text-primary">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {source.exportRoster && (
            <Button variant="secondary" icon={Download} onClick={handleExport} loading={exporting}>
              Export Roster
            </Button>
          )}
          <Button variant="secondary" icon={UploadCloud} onClick={() => setBulkOpen(true)}>
            Bulk Upload Students
          </Button>
          <Button icon={UserPlus} onClick={() => setAddOpen(true)}>
            Add Student
          </Button>
        </div>
      </div>

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
        emptyMessage="Add a student or bulk-upload a roster from Excel to get started."
        emptyIcon={UsersIcon}
      >
        <DataTable
          columns={columns}
          data={students}
          searchKeys={['name', 'firstName', 'lastName', 'username', 'email', 'phone']}
          pageSize={10}
        />
      </QueryState>

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
              <Button variant="secondary" onClick={closeAdd} disabled={adding}>
                Cancel
              </Button>
              <Button onClick={handleAddStudent} loading={adding} icon={UserPlus}>
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
            ? `Restore access for ${studentName(confirmTarget || {})}?`
            : `${studentName(confirmTarget || {})} will lose access to the platform until reinstated.`
        }
      />

      {/* Reset password */}
      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title="Reset Password"
        size="md"
        footer={
          resetResult ? (
            <Button icon={CheckCircle2} onClick={() => setResetTarget(null)}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setResetTarget(null)} disabled={resetting}>
                Cancel
              </Button>
              <Button icon={KeyRound} onClick={handleReset} loading={resetting}>
                Reset Password
              </Button>
            </>
          )
        }
      >
        {resetTarget && !resetResult && (
          <div className="space-y-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-turmeric/20 text-base font-bold text-turmeric">
                {studentName(resetTarget).charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-text-primary">{studentName(resetTarget)}</p>
                <p className="truncate text-xs text-text-secondary/60">
                  {resetTarget.username || resetTarget.email || '—'}
                </p>
              </div>
            </div>
            <p className="text-sm text-text-secondary/80">
              A new secure password will be generated for this student to share.
            </p>
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
              <CheckCircle2 size={16} /> Password reset for {studentName(resetResult.student || {})}.
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
            {resetResult.password && (
              <div>
                <p className="k-label mb-1.5">New password</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 select-all truncate rounded-xl border border-k-border bg-malt/60 px-4 py-3 font-mono text-lg font-bold tracking-wide text-turmeric">
                    {resetResult.password}
                  </code>
                  <Button className="shrink-0" variant="secondary" icon={copied ? Check : Copy} onClick={copyPassword}>
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            )}
            <p className="text-xs text-text-secondary/70">
              Share these credentials securely. They will not be shown again after you close this
              dialog.
            </p>
          </div>
        )}
      </Modal>

      <BulkUploadModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onComplete={() => refetch()}
        templatePath={source.templatePath}
        uploadPath={source.uploadPath}
      />
    </div>
  );
}

export { StatusBadge };

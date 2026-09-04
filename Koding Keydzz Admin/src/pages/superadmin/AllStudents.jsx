import { useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  KeyRound,
  Eye,
  Pencil,
  Trash2,
  Search,
  Users as UsersIcon,
  AlertTriangle,
  Copy,
  Check,
  Building2,
} from 'lucide-react';
import {
  useGetSuperStudentsQuery,
  useSuspendSuperStudentMutation,
  useUpdateSuperStudentMutation,
  useDeleteSuperStudentMutation,
  useResetSuperStudentPasswordMutation,
} from '../../features/superadmin/superadminApi';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Button from '../../components/ui/Button';
import PageHeader from '../../components/ui/PageHeader';
import QueryState from '../../components/ui/QueryState';
import StudentDetailModal from '../../components/students/StudentDetailModal';
import StudentEditModal from '../../components/students/StudentEditModal';
import AssignOrgModal from '../../components/org/AssignOrgModal';
import { formatApiError } from '../../utils/apiError';

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

export default function AllStudents() {
  const [search, setSearch] = useState('');
  const [org, setOrg] = useState('');

  const { data, isError, isLoading, error, refetch } = useGetSuperStudentsQuery({
    search: search || undefined,
    org: org || undefined,
  });
  const [suspendStudent, { isLoading: suspending }] = useSuspendSuperStudentMutation();
  const [updateStudent, { isLoading: updating }] = useUpdateSuperStudentMutation();
  const [deleteStudent, { isLoading: deleting }] = useDeleteSuperStudentMutation();
  const [resetPassword, { isLoading: resetting }] = useResetSuperStudentPasswordMutation();

  const students = asList(data);

  const orgOptions = useMemo(() => {
    const set = new Map();
    students.forEach((s) => {
      const name = s.org?.name || s.orgName || (typeof s.org === 'string' ? s.org : '');
      if (name) set.set(name, name);
    });
    return Array.from(set.values()).sort();
  }, [students]);

  const [viewing, setViewing] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const [resetError, setResetError] = useState('');
  const [copied, setCopied] = useState(false);

  const doSuspend = async () => {
    const t = confirmTarget;
    try {
      await suspendStudent({ id: t.id, suspended: !t.suspended }).unwrap();
    } catch {
      /* table reflects server state */
    }
    setConfirmTarget(null);
  };

  const doDelete = async () => {
    try {
      await deleteStudent(deleteTarget.id).unwrap();
    } catch {
      /* table reflects server state */
    }
    setDeleteTarget(null);
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
      const res = await resetPassword({ id: resetTarget.id }).unwrap();
      setResetResult({
        student: res?.student || resetTarget,
        password: res?.password,
      });
    } catch (err) {
      setResetError(formatApiError(err, 'Could not reset the password. Please try again.'));
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

  const orgName = (r) =>
    r.org?.name || r.orgName || (typeof r.org === 'string' ? r.org : '') || '—';

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
    {
      key: 'org',
      header: 'Organization',
      sortValue: (r) => orgName(r),
      render: (r) => {
        // A pupil with no school is a real problem, not a blank field: no
        // admin can see them and every org-scoped query filters them out.
        // An em-dash hid that; this states it and offers the fix.
        const name = orgName(r);
        if (name === '—') {
          return (
            <button
              onClick={() => setAssignTarget(r)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-error/50 bg-error/10 px-2 py-1 text-xs font-semibold text-error transition-colors hover:bg-error/20"
              title={`${r.name} belongs to no school — click to assign one`}
            >
              <AlertTriangle size={12} aria-hidden="true" />
              No school — assign
            </button>
          );
        }
        return <span className="block max-w-[200px] truncate text-text-secondary">{name}</span>;
      },
    },
    {
      key: 'xp',
      header: 'XP',
      render: (r) => <span className="font-semibold text-turmeric">{(r.xp ?? 0).toLocaleString()}</span>,
    },
    { key: 'level', header: 'Level', render: (r) => `Lv ${r.level ?? 1}` },
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
            <Eye size={16} />
          </button>
          <button
            onClick={() => setEditTarget(r)}
            title="Edit student"
            aria-label={`Edit ${r.name}`}
            className="rounded-lg p-1.5 text-text-secondary transition-colors duration-150 ease-out hover:bg-surface hover:text-turmeric active:scale-95"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => setAssignTarget(r)}
            title={orgName(r) === '—' ? 'Assign to a school' : 'Move to another school'}
            aria-label={`Change the school for ${r.name}`}
            className="rounded-lg p-1.5 text-text-secondary transition-colors duration-150 ease-out hover:bg-surface hover:text-turmeric active:scale-95"
          >
            <Building2 size={16} />
          </button>
          <button
            onClick={() => openReset(r)}
            title="Reset password"
            aria-label={`Reset password for ${r.name}`}
            className="rounded-lg p-1.5 text-text-secondary transition-colors duration-150 ease-out hover:bg-surface hover:text-turmeric active:scale-95"
          >
            <KeyRound size={16} />
          </button>
          <button
            onClick={() => setConfirmTarget(r)}
            title={r.suspended ? 'Reinstate' : 'Suspend'}
            aria-label={`${r.suspended ? 'Reinstate' : 'Suspend'} ${r.name}`}
            className={`rounded-lg p-1.5 transition-colors duration-150 ease-out active:scale-95 hover:bg-surface ${
              r.suspended ? 'text-success' : 'text-error'
            }`}
          >
            {r.suspended ? <CheckCircle2 size={16} /> : <Ban size={16} />}
          </button>
          <button
            onClick={() => setDeleteTarget(r)}
            title="Delete student"
            aria-label={`Delete ${r.name}`}
            className="rounded-lg p-1.5 text-error transition-colors duration-150 ease-out hover:bg-surface active:scale-95"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="All Students"
        subtitle={isLoading ? 'Loading…' : `${students.length} students across all organizations`}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/70" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, username or email…"
            className="k-input pl-9"
          />
        </div>
        {orgOptions.length > 0 && (
          <select value={org} onChange={(e) => setOrg(e.target.value)} className="k-input w-full sm:w-56">
            <option value="">All organizations</option>
            {orgOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        )}
      </div>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={refetch}
        isEmpty={students.length === 0}
        loadingLabel="Loading students…"
        emptyTitle="No students found"
        emptyMessage="No students match the current filters."
        emptyIcon={UsersIcon}
      >
        <DataTable
          columns={columns}
          data={students}
          searchKeys={['name', 'username', 'email']}
          pageSize={10}
        />
      </QueryState>

      <StudentDetailModal
        open={!!viewing}
        onClose={() => setViewing(null)}
        studentId={viewing?.id}
        fallbackName={viewing?.name}
        role="superadmin"
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

      {/* Edit student (PATCH /superadmin/students/:id) */}
      <AssignOrgModal
        open={Boolean(assignTarget)}
        user={assignTarget}
        onClose={() => setAssignTarget(null)}
      />

      <StudentEditModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        student={editTarget}
        loading={updating}
        onSubmit={(id, patch) => updateStudent({ id, ...patch }).unwrap()}
      />

      {/* Delete student (DELETE /superadmin/students/:id) */}
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
                {(resetTarget.name || '?').charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-text-primary">{resetTarget.name}</p>
                <p className="truncate text-xs text-text-secondary/70">
                  {resetTarget.username || resetTarget.email || '—'} · {orgName(resetTarget)}
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
    </div>
  );
}

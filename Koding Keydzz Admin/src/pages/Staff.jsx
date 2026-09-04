import { useMemo, useState } from 'react';
import {
  GraduationCap,
  ShieldCheck,
  UserPlus,
  Search,
  KeyRound,
  Trash2,
  Ban,
  CheckCircle2,
  Copy,
  Check,
  Mail,
  Info,
  Printer,
} from 'lucide-react';
import {
  useGetStaffQuery,
  useCreateStaffMutation,
  useUpdateStaffMutation,
  useSuspendStaffMutation,
  useResetStaffPasswordMutation,
  useDeleteStaffMutation,
} from '../features/admin/adminApi';
import PageHeader from '../components/ui/PageHeader';
import QueryState from '../components/ui/QueryState';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import FormField from '../components/ui/FormField';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { StatusChip } from '../components/charts/Primitives';
import { formatApiError } from '../utils/apiError';

/**
 * Staff management — the people who run the school's account.
 *
 * WHY THIS PAGE EXISTS
 * --------------------
 * An organization used to get exactly ONE administrator, created when the
 * school was set up, with no way to add a colleague and no concept of a
 * teacher. This is where an administrator adds co-administrators and teachers,
 * and where teachers get assigned their classes (via the Classes page).
 *
 * WRITTEN FOR NON-TECHNICAL USERS
 * -------------------------------
 *   • "Teacher" and "Administrator", not "faculty" and "admin role" — the
 *     labels match what a school actually calls these people;
 *   • the difference between the two roles is spelled out on the page, not
 *     assumed;
 *   • there is no email delivery, so a new account's password is shown ONCE
 *     with a copy button and an explicit instruction to hand it over;
 *   • destructive actions confirm, and explain what will happen.
 */

const ROLE_LABEL = { admin: 'Administrator', faculty: 'Teacher' };

/** One-time credential panel. Shown after creating or resetting an account. */
function CredentialHandover({ staff, password, onDone }) {
  const [copied, setCopied] = useState(false);
  const text = `Koding Keydzz sign-in\nEmail: ${staff.email}\nPassword: ${password}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the text is on screen to copy by hand */
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-turmeric/40 bg-turmeric/10 p-4">
        <Info size={18} className="mt-0.5 shrink-0 text-turmeric" aria-hidden="true" />
        <p className="text-sm text-text-primary">
          <strong>Hand this over now.</strong> The password is shown only once and cannot
          be recovered — Koding Keydzz does not send emails. If you lose it, use
          &ldquo;Reset password&rdquo; to generate a new one.{' '}
          <strong>They will be asked to set their own password</strong> the first time
          they sign in, so you will not know it after that.
        </p>
      </div>

      <dl className="divide-y divide-k-border rounded-xl border border-k-border bg-surface/50">
        <div className="flex items-baseline justify-between gap-4 p-3">
          <dt className="text-xs uppercase tracking-wide text-text-secondary">Name</dt>
          <dd className="text-sm font-semibold text-text-primary">{staff.name}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 p-3">
          <dt className="text-xs uppercase tracking-wide text-text-secondary">Signs in with</dt>
          <dd className="break-all text-sm font-semibold text-text-primary">{staff.email}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 p-3">
          <dt className="text-xs uppercase tracking-wide text-text-secondary">Password</dt>
          <dd className="font-mono text-base font-bold tracking-wide text-turmeric">
            {password}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 p-3">
          <dt className="text-xs uppercase tracking-wide text-text-secondary">Role</dt>
          <dd className="text-sm font-semibold text-text-primary">
            {ROLE_LABEL[staff.role] || staff.role}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-3">
        <Button icon={copied ? Check : Copy} onClick={copy} variant="outline">
          {copied ? 'Copied' : 'Copy sign-in details'}
        </Button>
        <Button icon={Printer} onClick={() => window.print()} variant="outline">
          Print slip
        </Button>
        <Button onClick={onDone}>Done</Button>
      </div>

      {/*
        THE PRINTABLE HANDOVER SLIP.
        There is no email delivery, so the only ways a password reaches a new
        teacher are a screen someone reads aloud and a piece of paper. Paper is
        the better one: it can be handed over in person, it does not require
        the recipient to be standing at this desk, and it can be destroyed
        afterwards. Hidden on screen (`hidden print:block`) and printed alone —
        see the print rules in index.css.
      */}
      <div className="hidden print:block" aria-hidden="true">
        <div className="credential-slip">
          <h2>Koding Keydzz — your sign-in details</h2>
          <table>
            <tbody>
              <tr>
                <th>Name</th>
                <td>{staff.name}</td>
              </tr>
              <tr>
                <th>Sign in at</th>
                <td>{window.location.origin}</td>
              </tr>
              <tr>
                <th>Email</th>
                <td>{staff.email}</td>
              </tr>
              <tr>
                <th>Temporary password</th>
                <td className="slip-password">{password}</td>
              </tr>
              <tr>
                <th>Role</th>
                <td>{ROLE_LABEL[staff.role] || staff.role}</td>
              </tr>
            </tbody>
          </table>
          <p>
            You will be asked to choose your own password the first time you sign
            in. Until you do, you cannot use the rest of the portal. Keep this
            slip safe until then, and destroy it afterwards.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Add / edit form. */
function StaffForm({ initial, onSubmit, onCancel, saving, error }) {
  const editing = Boolean(initial?.id);
  const [form, setForm] = useState({
    role: initial?.role || 'faculty',
    name: initial?.name || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    title: initial?.title || '',
    subjects: (initial?.subjects || []).join(', '),
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      title: form.title.trim(),
      subjects: form.subjects
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    if (!editing) {
      payload.role = form.role;
      payload.email = form.email.trim();
    } else {
      payload.role = form.role;
      if (form.email.trim() !== (initial?.email || '')) payload.email = form.email.trim();
    }
    onSubmit(payload);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Role is the most consequential choice, so it is explained inline
          rather than left as two opaque words in a dropdown. */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-text-primary">
          What can this person do?
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              value: 'faculty',
              icon: GraduationCap,
              title: 'Teacher',
              blurb:
                'Sees and reports on the pupils in the classes you assign them. Can reset a pupil’s password. Cannot add or remove accounts.',
            },
            {
              value: 'admin',
              icon: ShieldCheck,
              title: 'Administrator',
              blurb:
                'Full access to this school: add pupils and staff, create classes, import rosters, see every report.',
            },
          ].map((opt) => {
            const active = form.role === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ${
                  active
                    ? 'border-turmeric bg-turmeric/10'
                    : 'border-k-border bg-surface/40 hover:border-turmeric/40'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={opt.value}
                  checked={active}
                  onChange={() => setForm((f) => ({ ...f, role: opt.value }))}
                  className="mt-1 accent-turmeric"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-text-primary">
                    <opt.icon size={15} aria-hidden="true" />
                    {opt.title}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-text-secondary/80">
                    {opt.blurb}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <FormField
        label="Full name"
        name="name"
        value={form.name}
        onChange={set('name')}
        placeholder="e.g. Priya Menon"
        required
      />
      <FormField
        label="Email address"
        name="email"
        type="email"
        value={form.email}
        onChange={set('email')}
        placeholder="e.g. priya.menon@school.edu"
        required={!editing}
        hint="Staff sign in with their email address. It must be unique."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Job title"
          name="title"
          value={form.title}
          onChange={set('title')}
          placeholder="e.g. Computing Teacher"
          hint="Optional"
        />
        <FormField
          label="Phone"
          name="phone"
          value={form.phone}
          onChange={set('phone')}
          placeholder="Optional"
        />
      </div>
      <FormField
        label="Subjects taught"
        name="subjects"
        value={form.subjects}
        onChange={set('subjects')}
        placeholder="e.g. Python, Algorithms"
        hint="Optional. Separate several with commas."
      />

      {error && (
        <p className="rounded-lg border border-error/40 bg-error/10 p-3 text-sm text-error">
          {formatApiError(error, 'Could not save. Please check the details and try again.')}
        </p>
      )}

      <div className="flex justify-end gap-3 border-t border-k-border pt-4">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {editing ? 'Save changes' : 'Add person'}
        </Button>
      </div>
    </form>
  );
}

export default function Staff() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [handover, setHandover] = useState(null); // { staff, password }
  const [confirm, setConfirm] = useState(null); // { kind, staff }

  const query = useGetStaffQuery({
    search,
    ...(roleFilter ? { role: roleFilter } : {}),
    limit: 100,
  });
  const [createStaff, createState] = useCreateStaffMutation();
  const [updateStaff, updateState] = useUpdateStaffMutation();
  const [suspendStaff] = useSuspendStaffMutation();
  const [resetPassword] = useResetStaffPasswordMutation();
  const [deleteStaff] = useDeleteStaffMutation();

  const items = query.data?.items || [];
  const counts = useMemo(
    () => ({
      admins: items.filter((s) => s.role === 'admin').length,
      faculty: items.filter((s) => s.role === 'faculty').length,
    }),
    [items]
  );

  const handleCreate = async (payload) => {
    try {
      const res = await createStaff(payload).unwrap();
      setAddOpen(false);
      setHandover({ staff: res.staff, password: res.password });
    } catch {
      /* surfaced by createState.error inside the form */
    }
  };

  const handleUpdate = async (payload) => {
    try {
      await updateStaff({ id: editing.id, ...payload }).unwrap();
      setEditing(null);
    } catch {
      /* surfaced in the form */
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const { kind, staff } = confirm;
    try {
      if (kind === 'suspend') {
        await suspendStaff({ id: staff.id, suspend: staff.status !== 'suspended' }).unwrap();
      } else if (kind === 'reset') {
        const res = await resetPassword({ id: staff.id }).unwrap();
        setHandover({ staff: res.staff, password: res.password });
      } else if (kind === 'delete') {
        await deleteStaff(staff.id).unwrap();
      }
    } catch (err) {
      // Server refusals here are meaningful (e.g. "the only administrator"), so
      // surface the message rather than failing silently.
      // eslint-disable-next-line no-alert
      alert(formatApiError(err, 'That action could not be completed.'));
    }
    setConfirm(null);
  };

  const confirmCopy = () => {
    if (!confirm) return {};
    const { kind, staff } = confirm;
    if (kind === 'suspend') {
      const on = staff.status !== 'suspended';
      return {
        title: on ? `Suspend ${staff.name}?` : `Reactivate ${staff.name}?`,
        message: on
          ? 'They will be signed out of every device immediately and cannot sign in until you reactivate them. Their classes and data are kept.'
          : 'They will be able to sign in again with their existing password.',
        confirmLabel: on ? 'Suspend' : 'Reactivate',
      };
    }
    if (kind === 'reset') {
      return {
        title: `Reset password for ${staff.name}?`,
        message:
          'A new password will be generated and shown once. They will be signed out of every device and must use the new password.',
        confirmLabel: 'Reset password',
      };
    }
    return {
      title: `Remove ${staff.name}?`,
      message:
        'They will lose access immediately and be unassigned from every class. Their record is kept so reports stay accurate, and the email address becomes free to reuse.',
      confirmLabel: 'Remove',
    };
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teachers & administrators"
        subtitle="The people who run your school's Koding Keydzz account"
      >
        <Button icon={UserPlus} onClick={() => setAddOpen(true)}>
          Add a person
        </Button>
      </PageHeader>

      {/* Plain-language explanation of the two roles, always visible. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="k-card flex items-start gap-3 p-4">
          <div className="rounded-xl bg-turmeric/15 p-2 text-turmeric">
            <GraduationCap size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-primary">
              {counts.faculty} {counts.faculty === 1 ? 'Teacher' : 'Teachers'}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-text-secondary/75">
              See only the pupils in the classes they are assigned. Assign classes on the
              Classes page.
            </p>
          </div>
        </div>
        <div className="k-card flex items-start gap-3 p-4">
          <div className="rounded-xl bg-turmeric/15 p-2 text-turmeric">
            <ShieldCheck size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-primary">
              {counts.admins} {counts.admins === 1 ? 'Administrator' : 'Administrators'}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-text-secondary/75">
              Full access to this school. You always need at least one.
            </p>
          </div>
        </div>
      </div>

      {/* Filters in one row above the list. */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex-1 min-w-[220px]">
          <span className="sr-only">Search staff by name or email</span>
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/70"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full rounded-xl border border-k-border bg-card py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary/70 focus:border-turmeric/60 focus:outline-none"
          />
        </label>
        <div className="inline-flex items-center gap-1 rounded-xl border border-k-border bg-card p-1" role="group" aria-label="Filter by role">
          {[
            { value: '', label: 'Everyone' },
            { value: 'faculty', label: 'Teachers' },
            { value: 'admin', label: 'Administrators' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRoleFilter(opt.value)}
              aria-pressed={roleFilter === opt.value}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric ${
                roleFilter === opt.value
                  ? 'bg-turmeric text-malt'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        refetch={query.refetch}
        isEmpty={!items.length}
        emptyIcon={GraduationCap}
        emptyTitle={search ? 'No matches' : 'No teachers or administrators yet'}
        emptyMessage={
          search
            ? 'Try a different name or email address.'
            : 'Add your first teacher so they can start tracking their classes.'
        }
        loadingLabel="Loading staff…"
      >
        <div className="k-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Teachers and administrators at this school</caption>
              <thead>
                <tr className="border-b border-k-border text-left text-xs uppercase tracking-wide text-text-secondary/70">
                  <th scope="col" className="px-5 py-3 font-semibold">Name</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Role</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Classes</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Pupils</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="border-b border-k-border/50 last:border-0">
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => setEditing(s)}
                        className="text-left font-semibold text-text-primary hover:text-turmeric focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
                      >
                        {s.name}
                      </button>
                      <div className="flex items-center gap-1 text-xs text-text-secondary/70">
                        <Mail size={11} aria-hidden="true" />
                        <span className="break-all">{s.email}</span>
                      </div>
                      {s.title && (
                        <div className="text-xs text-text-secondary/70">{s.title}</div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <StatusChip
                        tone={s.role === 'admin' ? 'good' : 'neutral'}
                        icon={s.role === 'admin' ? ShieldCheck : GraduationCap}
                      >
                        {ROLE_LABEL[s.role] || s.role}
                      </StatusChip>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-text-primary">
                      {s.role === 'faculty' ? (s.classrooms ?? 0) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-text-primary">
                      {s.role === 'faculty' ? (s.students ?? 0) : '—'}
                    </td>
                    <td className="px-3 py-3">
                      {s.status === 'suspended' ? (
                        <StatusChip tone="critical" icon={Ban}>Suspended</StatusChip>
                      ) : s.pendingInvite ? (
                        <StatusChip tone="warning">Not signed in yet</StatusChip>
                      ) : (
                        <StatusChip tone="good" icon={CheckCircle2}>Active</StatusChip>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setConfirm({ kind: 'reset', staff: s })}
                          title="Reset password"
                          aria-label={`Reset password for ${s.name}`}
                          className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface hover:text-turmeric focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
                        >
                          <KeyRound size={15} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirm({ kind: 'suspend', staff: s })}
                          title={s.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                          aria-label={`${s.status === 'suspended' ? 'Reactivate' : 'Suspend'} ${s.name}`}
                          className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface hover:text-turmeric focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
                        >
                          {s.status === 'suspended' ? (
                            <CheckCircle2 size={15} aria-hidden="true" />
                          ) : (
                            <Ban size={15} aria-hidden="true" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirm({ kind: 'delete', staff: s })}
                          title="Remove"
                          aria-label={`Remove ${s.name}`}
                          className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-error/15 hover:text-error focus-visible:outline focus-visible:outline-2 focus-visible:outline-error"
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </QueryState>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a teacher or administrator" size="lg">
        <StaffForm
          onSubmit={handleCreate}
          onCancel={() => setAddOpen(false)}
          saving={createState.isLoading}
          error={createState.error}
        />
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={`Edit ${editing?.name || ''}`} size="lg">
        {editing && (
          <StaffForm
            initial={editing}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
            saving={updateState.isLoading}
            error={updateState.error}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(handover)}
        onClose={() => setHandover(null)}
        title="Sign-in details"
        size="md"
      >
        {handover && (
          <CredentialHandover
            staff={handover.staff}
            password={handover.password}
            onDone={() => setHandover(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
        {...confirmCopy()}
      />
    </div>
  );
}

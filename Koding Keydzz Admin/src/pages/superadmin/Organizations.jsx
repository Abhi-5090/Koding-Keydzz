import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  CheckCircle2,
  RefreshCw,
  KeyRound,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import {
  useGetOrgsQuery,
  useCreateOrgMutation,
  useUpdateOrgMutation,
  useUpdateOrgAdminMutation,
  useDeleteOrgMutation,
} from '../../features/superadmin/superadminApi';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import PageHeader from '../../components/ui/PageHeader';
import QueryState from '../../components/ui/QueryState';
import OrgCard from '../../components/org/OrgCard';

function asList(data) {
  if (Array.isArray(data)) return data;
  return data?.orgs || data?.items || [];
}

// Generate a memorable-but-strong password for the admin helper.
function generatePassword() {
  const words = ['Coder', 'Loop', 'Byte', 'Pixel', 'Logic', 'Spark', 'Quest'];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(100 + Math.random() * 900);
  const sym = '!@#$%'[Math.floor(Math.random() * 5)];
  return `${w}@${n}${sym}`;
}

const emptyForm = { name: '', adminName: '', adminEmail: '', adminPassword: '' };

export default function Organizations() {
  const navigate = useNavigate();
  const { data, isError, isLoading, error, refetch } = useGetOrgsQuery();
  const [createOrg, { isLoading: creating }] = useCreateOrgMutation();
  const [updateOrg] = useUpdateOrgMutation();
  const [updateOrgAdmin, { isLoading: savingAdmin }] = useUpdateOrgAdminMutation();
  const [deleteOrg] = useDeleteOrgMutation();

  const orgs = asList(data);

  const openOrg = (org) => navigate(`/superadmin/orgs/${org.id}`);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showPw, setShowPw] = useState(false);
  const [formError, setFormError] = useState('');

  const [created, setCreated] = useState(null);

  const [statusTarget, setStatusTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [adminTarget, setAdminTarget] = useState(null);
  const [adminForm, setAdminForm] = useState({ adminName: '', adminEmail: '', adminPassword: '' });
  const [adminError, setAdminError] = useState('');

  const [copied, setCopied] = useState(false);

  const onField = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    const email = form.adminEmail.trim();
    if (form.name.trim().length < 2) {
      setFormError('Organization name must be at least 2 characters.');
      return;
    }
    if (form.adminName.trim().length < 2) {
      setFormError('Admin name must be at least 2 characters.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError('Enter a valid admin email address.');
      return;
    }
    if (form.adminPassword.length < 6) {
      setFormError('Admin password must be at least 6 characters.');
      return;
    }
    try {
      const res = await createOrg(form).unwrap();
      const newOrg = res?.org
        ? {
            ...res.org,
            admin: res.admin || { name: form.adminName, email: form.adminEmail },
          }
        : { name: form.name, code: res?.code, admin: { email: form.adminEmail } };
      setCreated({
        org: newOrg,
        adminEmail: form.adminEmail,
        adminPassword: form.adminPassword,
      });
      setCopied(false);
      setCreateOpen(false);
      setForm(emptyForm);
      setShowPw(false);
    } catch (err) {
      const detail = err?.data?.details?.[0]?.message;
      const apiUrl = import.meta.env.VITE_API_URL || 'the server';
      const msg =
        detail ||
        err?.data?.message ||
        (err?.status === 'FETCH_ERROR'
          ? `Can't reach the API at ${apiUrl}. Make sure the backend is running on :5500, then hard-refresh this page (Cmd+Shift+R).`
          : 'Could not create the organization. Please try again.');
      setFormError(msg);
    }
  };

  const doToggleStatus = async () => {
    const t = statusTarget;
    const next = t.status === 'active' ? 'suspended' : 'active';
    setStatusBusy(true);
    try {
      await updateOrg({ id: t.id, status: next }).unwrap();
    } catch {
      /* cards reflect server state */
    }
    setStatusBusy(false);
    setStatusTarget(null);
  };

  const doDelete = async () => {
    const t = deleteTarget;
    setDeleteBusy(true);
    try {
      await deleteOrg(t.id).unwrap();
    } catch {
      /* cards reflect server state */
    }
    setDeleteBusy(false);
    setDeleteTarget(null);
  };

  const openAdmin = (org) => {
    setAdminTarget(org);
    setAdminError('');
    setAdminForm({
      adminName: org.admin?.name || '',
      adminEmail: org.admin?.email || '',
      adminPassword: '',
    });
  };

  const saveAdmin = async (e) => {
    e.preventDefault();
    setAdminError('');
    const t = adminTarget;
    const body = { id: t.id };
    if (adminForm.adminName) body.adminName = adminForm.adminName;
    if (adminForm.adminEmail) body.adminEmail = adminForm.adminEmail;
    if (adminForm.adminPassword) body.adminPassword = adminForm.adminPassword;
    try {
      await updateOrgAdmin(body).unwrap();
      setAdminTarget(null);
    } catch (err) {
      setAdminError(err?.data?.message || 'Could not update the admin. Please try again.');
    }
  };

  const copyCreds = () => {
    if (!created) return;
    const text = [
      `Organization: ${created.org.name}`,
      `Org code: ${created.org.code}`,
      `Admin login: ${created.adminEmail}`,
      `Admin password: ${created.adminPassword}`,
    ].join('\n');
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        subtitle={isLoading ? 'Loading…' : `${orgs.length} organization(s) on the platform`}
      >
        <Button icon={Plus} onClick={() => setCreateOpen(true)}>
          Create Organization
        </Button>
      </PageHeader>

      {created && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="k-card border-success/40 p-4 sm:p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-success/15 p-2 text-success">
                <CheckCircle2 size={20} />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-text-primary">
                  Organization “{created.org.name}” created.
                </p>
                <p className="text-text-secondary/80">
                  Hand these login credentials to the org admin now.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon={copied ? Check : Copy}
                onClick={copyCreds}
              >
                {copied ? 'Copied' : 'Copy credentials'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreated(null)}>
                Dismiss
              </Button>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-k-border bg-malt/40 p-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-secondary/60">
                Organization
              </dt>
              <dd className="mt-0.5 text-sm font-medium text-text-primary">
                {created.org.name}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-secondary/60">
                Org code
              </dt>
              <dd className="mt-0.5 font-mono text-sm text-turmeric">{created.org.code}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-secondary/60">
                Admin login email
              </dt>
              <dd className="mt-0.5 break-all font-mono text-sm text-turmeric">
                {created.adminEmail}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-secondary/60">
                Admin password
              </dt>
              <dd className="mt-0.5 break-all font-mono text-sm text-turmeric">
                {created.adminPassword}
              </dd>
            </div>
          </dl>

          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-turmeric">
            <AlertTriangle size={14} /> Save these now — the password won&apos;t be shown again.
          </p>
        </motion.div>
      )}

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={refetch}
        isEmpty={orgs.length === 0}
        loadingLabel="Loading organizations…"
        emptyTitle="No organizations yet"
        emptyMessage="Create your first organization to onboard a school and its admin."
        emptyIcon={Building2}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {orgs.map((org, i) => (
            <OrgCard
              key={org.id || i}
              org={org}
              index={i}
              onOpen={openOrg}
              onResetAdmin={openAdmin}
              onSuspendToggle={(o) => setStatusTarget(o)}
              onDelete={(o) => setDeleteTarget(o)}
            />
          ))}
        </div>
      </QueryState>

      {/* Create Organization modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Organization"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={creating} icon={Building2}>
              Create Organization
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <FormField
            label="Organization Name"
            name="name"
            value={form.name}
            onChange={onField}
            placeholder="Sunrise Public School"
            required
          />

          <div className="rounded-xl border border-k-border bg-malt/40 p-4">
            <p className="mb-3 text-sm font-semibold text-text-primary">Org Admin Account</p>
            <div className="space-y-4">
              <FormField
                label="Admin Name"
                name="adminName"
                value={form.adminName}
                onChange={onField}
                placeholder="Ritu Sharma"
                required
              />
              <FormField
                label="Admin Email"
                name="adminEmail"
                type="email"
                value={form.adminEmail}
                onChange={onField}
                placeholder="admin@sunrise.edu"
                required
              />
              <div>
                <label htmlFor="org-admin-password" className="k-label">
                  Admin Password<span className="text-error"> *</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="org-admin-password"
                    name="adminPassword"
                    type={showPw ? 'text' : 'password'}
                    value={form.adminPassword}
                    onChange={onField}
                    placeholder="••••••••"
                    required
                    className="k-input min-w-0"
                  />
                  <Button className="shrink-0" type="button" size="sm" variant="secondary" onClick={() => setShowPw((s) => !s)}>
                    {showPw ? 'Hide' : 'Show'}
                  </Button>
                  <Button
                    className="shrink-0"
                    type="button"
                    size="sm"
                    variant="outline"
                    icon={RefreshCw}
                    onClick={() => {
                      setForm((f) => ({ ...f, adminPassword: generatePassword() }));
                      setShowPw(true);
                    }}
                  >
                    Generate
                  </Button>
                </div>
                <p className="mt-1 text-xs text-text-secondary/60">
                  These are the credentials the Org Admin will use to log in.
                </p>
              </div>
            </div>
          </div>

          {formError && (
            <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
              {formError}
            </p>
          )}
        </form>
      </Modal>

      {/* Reset admin credentials modal */}
      <Modal
        open={!!adminTarget}
        onClose={() => setAdminTarget(null)}
        title="Reset Admin Credentials"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdminTarget(null)} disabled={savingAdmin}>
              Cancel
            </Button>
            <Button onClick={saveAdmin} loading={savingAdmin} icon={KeyRound}>
              Save Changes
            </Button>
          </>
        }
      >
        <form onSubmit={saveAdmin} className="space-y-4">
          <p className="text-sm text-text-secondary/80">
            Update the admin account for <span className="text-turmeric">{adminTarget?.name}</span>.
            Leave a field blank to keep it unchanged.
          </p>
          <FormField
            label="Admin Name"
            name="adminName"
            value={adminForm.adminName}
            onChange={(e) => setAdminForm((f) => ({ ...f, adminName: e.target.value }))}
          />
          <FormField
            label="Admin Email"
            name="adminEmail"
            type="email"
            value={adminForm.adminEmail}
            onChange={(e) => setAdminForm((f) => ({ ...f, adminEmail: e.target.value }))}
          />
          <div>
            <label className="k-label">New Password</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={adminForm.adminPassword}
                onChange={(e) => setAdminForm((f) => ({ ...f, adminPassword: e.target.value }))}
                placeholder="Leave blank to keep current"
                className="k-input min-w-0"
              />
              <Button
                className="shrink-0"
                type="button"
                size="sm"
                variant="outline"
                icon={RefreshCw}
                onClick={() => setAdminForm((f) => ({ ...f, adminPassword: generatePassword() }))}
              >
                Generate
              </Button>
            </div>
          </div>
          {adminError && (
            <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
              {adminError}
            </p>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={doToggleStatus}
        loading={statusBusy}
        title={statusTarget?.status === 'active' ? 'Suspend organization?' : 'Activate organization?'}
        confirmLabel={statusTarget?.status === 'active' ? 'Suspend' : 'Activate'}
        variant={statusTarget?.status === 'active' ? 'danger' : 'primary'}
        message={
          statusTarget?.status === 'active'
            ? `${statusTarget?.name} and its admin will lose access until reactivated.`
            : `Restore access for ${statusTarget?.name}?`
        }
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        loading={deleteBusy}
        title="Delete organization?"
        confirmLabel="Delete"
        variant="danger"
        confirmText={deleteTarget?.name}
        message={`This permanently deletes ${deleteTarget?.name}, its admin, and ${
          deleteTarget
            ? Number(
                deleteTarget.studentCount ??
                  deleteTarget.studentsCount ??
                  deleteTarget.students ??
                  0
              ).toLocaleString()
            : 0
        } student(s). This cannot be undone.`}
      />
    </div>
  );
}

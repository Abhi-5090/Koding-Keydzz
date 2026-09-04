import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Building2, Check } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { formatApiError } from '../../utils/apiError';
import {
  useGetOrgsQuery,
  useAssignUserOrganizationMutation,
} from '../../features/superadmin/superadminApi';

/**
 * Put a user into a school, or move them between schools.
 *
 * WHAT THIS IS FOR
 * ----------------
 * Every user must belong to an organization. Accounts created by public
 * self-registration used to get none, which made them invisible to every
 * school admin while still being able to sign in. This is how one is re-homed.
 *
 * WHY IT WARNS BEFORE A MOVE
 * --------------------------
 * Assigning an orphan is harmless. MOVING someone who already has a school is
 * not: they are removed from every class they are on at the old school, and
 * their work goes with them into the new school's reports. That is rarely what
 * someone expects from a dropdown, so the consequence is stated before the
 * button is pressed rather than explained afterwards.
 */
export default function AssignOrgModal({ open, user, onClose }) {
  const { data: orgsData, isLoading: orgsLoading } = useGetOrgsQuery(undefined, { skip: !open });
  const [assign, { isLoading: saving }] = useAssignUserOrganizationMutation();

  const [orgId, setOrgId] = useState('');
  const [error, setError] = useState('');

  const currentOrgId = useMemo(() => {
    const o = user?.org;
    if (!o) return '';
    return typeof o === 'string' ? o : o.id || o._id || '';
  }, [user]);

  const currentOrgName = useMemo(() => {
    const o = user?.org;
    if (!o) return '';
    if (typeof o === 'string') return user?.orgName || '';
    return o.name || '';
  }, [user]);

  useEffect(() => {
    if (!open) return;
    setOrgId('');
    setError('');
  }, [open, user?.id]);

  const orgs = orgsData?.items || [];
  // A suspended or archived school cannot take new members, so it is not
  // offered — better than letting someone pick it and reading a refusal.
  const selectable = orgs.filter((o) => (o.status || 'active') === 'active');
  const chosen = selectable.find((o) => (o.id || o._id) === orgId);
  const isMove = Boolean(currentOrgId);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!orgId) {
      setError('Choose a school first.');
      return;
    }
    try {
      await assign({ id: user.id, org: orgId }).unwrap();
      onClose?.(true);
    } catch (err) {
      // The server's message is the useful one here — it names the clashing
      // roll number, or the school that is out of seats.
      setError(formatApiError(err, 'Could not assign this user. Please try again.'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => onClose?.(false)}
      title={isMove ? 'Move to another school' : 'Assign to a school'}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl border border-k-border bg-surface/60 p-3">
          <p className="truncate text-sm font-semibold text-text-primary">{user?.name}</p>
          <p className="truncate text-xs text-text-secondary">
            {user?.email || user?.username || '—'}
            {user?.role ? ` · ${roleLabel(user.role)}` : ''}
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs">
            <Building2 size={12} className="shrink-0 text-text-secondary" />
            {currentOrgName ? (
              <span className="text-text-secondary">
                Currently in <span className="text-text-primary">{currentOrgName}</span>
              </span>
            ) : (
              <span className="font-semibold text-error">
                Not in any school — nobody can manage this account
              </span>
            )}
          </p>
        </div>

        {/* Label and control written out rather than via <FormField>, which
            renders its own input from an `options` prop and ignores children —
            the per-option `disabled` below needs real <option> elements. The
            htmlFor/id pair is what makes the label clickable and readable to a
            screen reader. */}
        <div>
          <label htmlFor="assign-org" className="k-label">
            School <span className="text-error">*</span>
          </label>
          <select
            id="assign-org"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="k-input w-full"
            disabled={orgsLoading}
            required
          >
            <option value="">{orgsLoading ? 'Loading schools…' : 'Choose a school'}</option>
            {selectable.map((o) => {
              const id = o.id || o._id;
              return (
                <option key={id} value={id} disabled={id === currentOrgId}>
                  {o.name}
                  {o.code ? ` (${o.code})` : ''}
                  {id === currentOrgId ? ' — already in this school' : ''}
                </option>
              );
            })}
          </select>
        </div>

        {/* Stated BEFORE the action, because it is not reversible by picking
            the old school again — the class memberships are gone. */}
        {isMove && chosen && (
          <p className="flex items-start gap-2 rounded-xl border border-error/40 bg-error/10 px-3 py-2 text-xs text-error">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              Moving {user?.name} out of {currentOrgName} removes them from every class they
              are in there. Their progress and XP move with them to {chosen.name}.
            </span>
          </p>
        )}

        {!isMove && chosen && (
          <p className="flex items-start gap-2 rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">
            <Check size={14} className="mt-0.5 shrink-0" />
            <span>
              {chosen.name}&apos;s administrators will be able to see and manage this account.
            </span>
          </p>
        )}

        {error && (
          <p className="flex items-start gap-2 rounded-xl border border-error/50 bg-error/10 px-3 py-2 text-sm text-error">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={() => onClose?.(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !orgId}>
            {saving ? 'Saving…' : isMove ? 'Move' : 'Assign'}
            {!saving && <ArrowRight size={16} className="ml-1.5" />}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** School language, not data-model language. */
function roleLabel(role) {
  if (role === 'admin') return 'Administrator';
  if (role === 'faculty') return 'Teacher';
  if (role === 'student') return 'Pupil';
  return role;
}

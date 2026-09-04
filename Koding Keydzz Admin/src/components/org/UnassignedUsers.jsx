import { useState } from 'react';
import { AlertTriangle, Building2, UserX } from 'lucide-react';
import { useGetUnassignedUsersQuery } from '../../features/superadmin/superadminApi';
import AssignOrgModal from './AssignOrgModal';

/**
 * Users who belong to no organization.
 *
 * WHY THIS PANEL EXISTS AT ALL
 * ----------------------------
 * `User.org` defaults to null, and public self-registration used to never set
 * it. An account created that way is a tenant orphan, and the failure is
 * quiet in exactly the wrong way: the person can still sign in and use the
 * app, but no school owns them, so no admin can see or manage them, they
 * appear on no classroom, and every org-scoped query filters them out. There
 * was nowhere in the product that showed them.
 *
 * It covers EVERY role. The all-students table only lists pupils, so an
 * orphaned administrator or teacher was invisible even there — which is the
 * case that prompted this.
 *
 * The panel renders NOTHING when there is nothing wrong. A permanent "0
 * unassigned users" card trains people to ignore the space it occupies.
 */
export default function UnassignedUsers() {
  const { data, isLoading } = useGetUnassignedUsersQuery({ limit: 50 });
  const [assignTarget, setAssignTarget] = useState(null);

  const items = data?.items || [];
  if (isLoading || items.length === 0) return null;

  return (
    <>
      <section className="k-card border-error/40 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-full bg-error/15 p-2 text-error">
            <UserX size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-base font-bold text-text-primary">
              {items.length} {items.length === 1 ? 'person is' : 'people are'} not in any school
            </h2>
            {/* Says what is actually wrong, in the terms the reader cares
                about — not "org is null". */}
            <p className="mt-0.5 text-sm text-text-secondary">
              They can sign in, but no school can see or manage them, and they appear in no
              class or report. Assign each one to a school to fix it.
            </p>

            <ul className="mt-4 divide-y divide-k-border">
              {items.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {u.name || '(no name)'}
                    </p>
                    <p className="truncate text-xs text-text-secondary/70">
                      {u.email || u.username || '—'} · {roleLabel(u.role)}
                      {!u.lastLoginAt && ' · never signed in'}
                    </p>
                  </div>
                  <button
                    onClick={() => setAssignTarget(u)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-turmeric px-3 py-1.5 text-xs font-semibold text-malt transition-colors hover:bg-accent"
                  >
                    <Building2 size={13} aria-hidden="true" />
                    Assign a school
                  </button>
                </li>
              ))}
            </ul>

            {data?.total > items.length && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-text-secondary">
                <AlertTriangle size={12} aria-hidden="true" />
                Showing {items.length} of {data.total}. Assign these and the rest will appear.
              </p>
            )}
          </div>
        </div>
      </section>

      <AssignOrgModal
        open={Boolean(assignTarget)}
        user={assignTarget}
        onClose={() => setAssignTarget(null)}
      />
    </>
  );
}

/** School language, not data-model language. */
function roleLabel(role) {
  if (role === 'admin') return 'Administrator';
  if (role === 'faculty') return 'Teacher';
  if (role === 'student') return 'Pupil';
  return role;
}

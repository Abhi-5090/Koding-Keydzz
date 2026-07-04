import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2 } from 'lucide-react';
import { useGetOrgQuery } from '../../features/superadmin/superadminApi';
import Button from '../../components/ui/Button';
import QueryState from '../../components/ui/QueryState';
import AnimatedIcon from '../../components/ui/AnimatedIcon';
import OrgStudents from '../../components/org/OrgStudents';
import { OrgStatusBadge } from '../../components/org/OrgCard';
import { useSuperadminOrgSource } from '../../components/org/orgSources';

function unwrapOrg(data) {
  return data?.org || data || {};
}

export default function OrgDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useGetOrgQuery(id);
  const source = useSuperadminOrgSource(id);

  const org = unwrapOrg(data);
  const studentCount = org.studentCount ?? org.studentsCount ?? org.students ?? 0;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/superadmin/orgs')}
        className="inline-flex items-center gap-2 text-sm text-text-secondary transition hover:text-turmeric"
      >
        <ArrowLeft size={16} /> Back to Organizations
      </button>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={refetch}
        isEmpty={!org.id && !org.name}
        loadingLabel="Loading organization…"
        emptyTitle="Organization not found"
        emptyMessage="This organization may have been removed."
        emptyIcon={Building2}
      >
        <div className="k-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-turmeric/20 text-turmeric shadow-glow">
              <AnimatedIcon icon={Building2} size={26} animation="pop" className="text-turmeric" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-2xl font-extrabold text-text-primary">
                  {org.name}
                </h1>
                <OrgStatusBadge status={org.status} />
              </div>
              <p className="mt-0.5 text-sm text-text-secondary/70">
                Code <span className="font-mono text-turmeric">{org.code || '—'}</span> · Admin{' '}
                <span className="text-turmeric">{org.admin?.email || '—'}</span>
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-k-border bg-malt/40 px-6 py-3 text-center">
            <p className="font-heading text-4xl font-extrabold text-turmeric">
              {Number(studentCount).toLocaleString()}
            </p>
            <p className="text-xs uppercase tracking-wide text-text-secondary/70">Students</p>
          </div>
        </div>

        <OrgStudents source={source} count={studentCount} title="Student Roster" />
      </QueryState>
    </div>
  );
}

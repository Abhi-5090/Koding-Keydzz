import { useState } from 'react';
import { useSelector } from 'react-redux';
import { ArrowLeft, Building2 } from 'lucide-react';
import { selectOrg } from '../features/auth/authSlice';
import { useGetStudentsQuery } from '../features/admin/adminApi';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import AnimatedIcon from '../components/ui/AnimatedIcon';
import OrgCard, { OrgStatusBadge } from '../components/org/OrgCard';
import OrgStudents from '../components/org/OrgStudents';
import { useAdminOrgSource } from '../components/org/orgSources';

function asList(data) {
  if (Array.isArray(data)) return data;
  return data?.students || data?.items || [];
}

export default function MyOrganization() {
  const org = useSelector(selectOrg) || {};
  const source = useAdminOrgSource();

  // Live count from the org's own roster query (drives both card + detail).
  const { data } = useGetStudentsQuery();
  const studentCount = data?.total ?? asList(data).length;

  const [open, setOpen] = useState(false);

  const orgForCard = {
    id: org.id || 'my-org',
    name: org.name || 'My Organization',
    code: org.code || '—',
    status: org.status || 'active',
    studentCount,
    admin: org.admin || { email: org.adminEmail },
  };

  if (!open) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Organization"
          subtitle="Manage your school's student base and roster."
        />
        <div className="grid grid-cols-1 gap-4 sm:max-w-md">
          <OrgCard org={orgForCard} onOpen={() => setOpen(true)} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => setOpen(false)}
        className="inline-flex items-center gap-2 text-sm text-text-secondary transition hover:text-turmeric"
      >
        <ArrowLeft size={16} /> Back to My Organization
      </button>

      <div className="k-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-turmeric/20 text-turmeric shadow-glow">
            <AnimatedIcon icon={Building2} size={26} animation="pop" className="text-turmeric" />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate font-heading text-2xl font-extrabold text-text-primary">
                {orgForCard.name}
              </h1>
              <span className="shrink-0">
                <OrgStatusBadge status={orgForCard.status} />
              </span>
            </div>
            <p className="mt-0.5 truncate text-sm text-text-secondary/70">
              Code <span className="font-mono text-turmeric">{orgForCard.code}</span>
            </p>
          </div>
        </div>
        <div className="shrink-0 rounded-2xl border border-k-border bg-malt/40 px-6 py-3 text-center">
          <p className="font-heading text-4xl font-extrabold text-turmeric">
            {Number(studentCount).toLocaleString()}
          </p>
          <p className="text-xs uppercase tracking-wide text-text-secondary/70">Students</p>
        </div>
      </div>

      <OrgStudents source={source} count={studentCount} title="Student Roster" />
    </div>
  );
}

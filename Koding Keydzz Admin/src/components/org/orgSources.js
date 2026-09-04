// Data-source factories that adapt the two backend surfaces (super-admin
// per-org endpoints vs the org admin's own-org endpoints) to the shape
// <OrgStudents> expects. Keeping this here means the roster UI has zero
// knowledge of which role is using it.

import {
  useGetOrgStudentsQuery,
  useCreateOrgStudentMutation,
  useSuspendSuperStudentMutation,
  useUpdateSuperStudentMutation,
  useDeleteSuperStudentMutation,
  useResetSuperStudentPasswordMutation,
} from '../../features/superadmin/superadminApi';
import {
  useGetStudentsQuery,
  useCreateStudentMutation,
  useSuspendStudentMutation,
  useUpdateStudentMutation,
  useDeleteStudentMutation,
  useResetStudentPasswordMutation,
  exportStudentsCsv,
} from '../../features/admin/adminApi';

// Super admin acting on a specific org (id from the route).
export function useSuperadminOrgSource(orgId) {
  return {
    useStudents: () => useGetOrgStudentsQuery({ id: orgId }),
    useCreate: () => {
      const [fn, state] = useCreateOrgStudentMutation();
      // inject the org id so callers pass only the student body
      const create = (body) => fn({ id: orgId, ...body });
      return [create, state];
    },
    useSuspend: () => useSuspendSuperStudentMutation(),
    useUpdate: () => useUpdateSuperStudentMutation(),
    useDelete: () => useDeleteSuperStudentMutation(),
    useReset: () => useResetSuperStudentPasswordMutation(),
    templatePath: '/superadmin/students/template',
    uploadPath: `/superadmin/orgs/${orgId}/students/bulk`,
    // Per-student detail is fetched by student id via the superadmin endpoint.
    detailRole: 'superadmin',
  };
}

// Org admin acting on their own org (no id needed; the token scopes it).
export function useAdminOrgSource() {
  return {
    useStudents: () => useGetStudentsQuery(),
    useCreate: () => useCreateStudentMutation(),
    useSuspend: () => useSuspendStudentMutation(),
    useUpdate: () => useUpdateStudentMutation(),
    useDelete: () => useDeleteStudentMutation(),
    useReset: () => useResetStudentPasswordMutation(),
    templatePath: '/admin/students/template',
    uploadPath: '/admin/students/bulk',
    exportRoster: exportStudentsCsv,
    detailRole: 'admin',
  };
}

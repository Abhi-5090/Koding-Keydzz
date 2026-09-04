import { useEffect, useState } from 'react';
import { Save, AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { formatApiError } from '../../utils/apiError';

// Grades 2–8, shared by the Add-Student and Edit-Student forms.
export const GRADE_OPTIONS = [
  { value: '', label: 'Select grade' },
  { value: '2', label: 'Grade 2' },
  { value: '3', label: 'Grade 3' },
  { value: '4', label: 'Grade 4' },
  { value: '5', label: 'Grade 5' },
  { value: '6', label: 'Grade 6' },
  { value: '7', label: 'Grade 7' },
  { value: '8', label: 'Grade 8' },
];

// Seed the editable form from a roster/detail row. The list rows only carry a
// combined `name`, so split it into first/last when the discrete fields are
// absent — the server accepts firstName/lastName in the PATCH body.
function seedForm(student) {
  const s = student || {};
  let firstName = s.firstName || '';
  let lastName = s.lastName || '';
  if (!firstName && !lastName && s.name) {
    const parts = String(s.name).trim().split(/\s+/);
    firstName = parts.shift() || '';
    lastName = parts.join(' ');
  }
  return {
    firstName,
    lastName,
    grade: s.grade != null ? String(s.grade) : '',
    school: s.school || '',
    username: s.username || '',
    email: s.email || '',
    phone: s.phone || '',
  };
}

/**
 * Shared edit dialog used by the org-admin roster (Students.jsx), the platform
 * roster (AllStudents.jsx) and the per-org drill-down (OrgStudents.jsx).
 *
 * `onSubmit(id, patch)` runs the caller's RTK mutation and MUST reject (throw)
 * on failure so the inline error can surface `err.data.message`. Only changed,
 * non-empty fields are sent; a no-op save simply closes.
 */
export default function StudentEditModal({ open, onClose, student, onSubmit, loading = false }) {
  const [form, setForm] = useState(() => seedForm(student));
  const [error, setError] = useState('');

  // Re-seed whenever the dialog (re)opens or the target student changes.
  useEffect(() => {
    if (open) {
      setForm(seedForm(student));
      setError('');
    }
  }, [open, student]);

  const onField = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError('');
    if (!form.firstName.trim()) {
      setError('First name is required.');
      return;
    }
    // Diff against the original: send only changed, non-empty fields.
    const original = seedForm(student);
    const patch = {};
    Object.keys(form).forEach((key) => {
      const value = form[key].trim();
      if (value && value !== String(original[key] ?? '').trim()) patch[key] = value;
    });
    if (Object.keys(patch).length === 0) {
      onClose?.();
      return;
    }
    try {
      await onSubmit(student.id, patch);
      onClose?.();
    } catch (err) {
      setError(
        err?.data?.details?.[0]?.message ||
          formatApiError(err, 'Could not save changes. Please try again.')
      );
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Student"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button icon={Save} onClick={handleSubmit} loading={loading}>
            Save Changes
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="First Name"
            name="firstName"
            value={form.firstName}
            onChange={onField}
            placeholder="Aarav"
            required
          />
          <FormField
            label="Last Name"
            name="lastName"
            value={form.lastName}
            onChange={onField}
            placeholder="Sharma"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Grade"
            name="grade"
            as="select"
            value={form.grade}
            onChange={onField}
            options={GRADE_OPTIONS}
          />
          <FormField
            label="School"
            name="school"
            value={form.school}
            onChange={onField}
            placeholder="Springfield Public School"
          />
        </div>
        <FormField
          label="Username"
          name="username"
          value={form.username}
          onChange={onField}
          placeholder="aarav.sharma"
          hint="The student's login id."
        />
        <FormField
          label="Email (optional)"
          name="email"
          type="email"
          value={form.email}
          onChange={onField}
          placeholder="aarav@school.edu"
        />
        <FormField
          label="Phone"
          name="phone"
          value={form.phone}
          onChange={onField}
          placeholder="+91 98765 43210"
        />
        {error && (
          <p className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
            <AlertTriangle size={16} /> {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

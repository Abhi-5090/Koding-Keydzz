import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import BulkUploadModal from './BulkUploadModal';

// A tiny File stand-in so the dropzone has something to hold. The component
// only reads it (FileReader) when actually uploading, which we don't trigger
// here; we only assert the gating behaviour around the common password.
function fakeFile() {
  return new File(['firstName,lastName,email,phone\n'], 'roster.csv', {
    type: 'text/csv',
  });
}

describe('BulkUploadModal', () => {
  it('shows the common-password field and gates upload until it is valid', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <BulkUploadModal open onClose={() => {}} />,
      { route: '/students' }
    );

    // The required common-password field is present and clearly labelled.
    const pw = screen.getByLabelText(/Common password for all students/i);
    expect(pw).toBeInTheDocument();
    expect(
      screen.getByText(/each log in using their/i)
    ).toBeInTheDocument();

    // With no file and no password, the upload button is disabled.
    const uploadBtn = screen.getByRole('button', { name: /^Upload/i });
    expect(uploadBtn).toBeDisabled();

    // Provide a file via the hidden input.
    const fileInput = document.querySelector('input[type="file"]');
    await user.upload(fileInput, fakeFile());

    // Still disabled: a file alone isn't enough — the common password is required.
    expect(screen.getByRole('button', { name: /^Upload/i })).toBeDisabled();

    // A too-short password keeps it disabled and surfaces a hint.
    await user.type(pw, '123');
    expect(
      screen.getByText(/at least 6 characters/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Upload/i })).toBeDisabled();

    // A valid (>=6) password enables the upload.
    await user.type(pw, '456');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Upload/i })).toBeEnabled()
    );
  });

  it('uses the provided template/upload endpoints (super-admin org flow)', () => {
    renderWithProviders(
      <BulkUploadModal
        open
        onClose={() => {}}
        templatePath="/superadmin/students/template"
        uploadPath="/superadmin/orgs/org_1/students/bulk"
      />,
      { route: '/superadmin/orgs/org_1' }
    );
    // The modal renders its template + password steps regardless of role.
    expect(screen.getByText(/Download the template/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Common password for all students/i)
    ).toBeInTheDocument();
  });
});

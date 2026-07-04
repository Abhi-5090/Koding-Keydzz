import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Download,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  X,
} from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { bulkUploadStudents, downloadTemplate, downloadBlob } from '../../features/students/rosterHttp';

// The Excel template carries only student attributes. The common password is a
// separate UI field (applied to every student), NOT a spreadsheet column.
const TEMPLATE_COLUMNS = ['firstName', 'lastName', 'email', 'phone'];
const ACCEPT = '.xlsx,.xls,.csv';

// Map a few common header spellings (case / spacing) to our canonical keys so
// the preview still lines up if an admin tweaks the template headers slightly.
const HEADER_ALIASES = {
  firstname: 'firstName',
  'first name': 'firstName',
  lastname: 'lastName',
  'last name': 'lastName',
  email: 'email',
  'e-mail': 'email',
  phone: 'phone',
  mobile: 'phone',
};

function cell(row, key) {
  if (row[key] != null && row[key] !== '') return row[key];
  // tolerate alternate header casings present in the parsed row
  for (const rk of Object.keys(row)) {
    if (HEADER_ALIASES[String(rk).trim().toLowerCase()] === key) return row[rk];
  }
  return '';
}

function buildTemplateWorkbook() {
  const ws = XLSX.utils.json_to_sheet([], { header: TEMPLATE_COLUMNS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students');
  return wb;
}

// Generate a memorable-but-strong common password helper.
function generatePassword() {
  const words = ['Coder', 'Loop', 'Byte', 'Pixel', 'Logic', 'Spark', 'Quest'];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(100 + Math.random() * 900);
  const sym = '!@#$%'[Math.floor(Math.random() * 5)];
  return `${w}@${n}${sym}`;
}

/**
 * Bulk-upload students from Excel with one common password.
 *
 * Reusable across the admin (org-scoped) and super-admin (per-org) flows via props:
 *   templatePath  server template endpoint, e.g. '/admin/students/template'
 *   uploadPath    server bulk endpoint,     e.g. '/admin/students/bulk'
 *   onComplete    called with the server result after a successful upload
 */
export default function BulkUploadModal({
  open,
  onClose,
  onComplete,
  templatePath = '/admin/students/template',
  uploadPath = '/admin/students/bulk',
}) {
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [parseError, setParseError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const passwordValid = password.trim().length >= 6;
  const canUpload = Boolean(file) && passwordValid && !uploading;

  const reset = () => {
    setFile(null);
    setPreview([]);
    setParseError('');
    setResult(null);
    setCopied(false);
    setPassword('');
    setShowPw(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleDownloadTemplate = async () => {
    setParseError('');
    try {
      await downloadTemplate(templatePath);
      return;
    } catch {
      /* offline / no server -> generate locally below */
    }
    const wb = buildTemplateWorkbook();
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadBlob(
      new Blob([out], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      'students_template.xlsx'
    );
  };

  const parseFile = (f) => {
    setParseError('');
    setResult(null);
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        setPreview(rows);
        if (!rows.length) setParseError('The file appears to be empty.');
      } catch {
        setParseError('Could not read the file. Please use the provided template.');
        setPreview([]);
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (f) parseFile(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) parseFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    if (!passwordValid) {
      setParseError('Set a common password (at least 6 characters) before uploading.');
      return;
    }
    setUploading(true);
    setParseError('');
    try {
      const res = await bulkUploadStudents({
        path: uploadPath,
        file,
        password: password.trim(),
      });
      setResult({
        createdCount: res.createdCount ?? res.created?.length ?? 0,
        skippedCount: res.skippedCount ?? res.skipped?.length ?? 0,
        created: res.created || [],
        skipped: res.skipped || [],
      });
      onComplete?.(res);
    } catch (err) {
      const msg = err?.message || 'Upload failed. Please try again.';
      const network = /fetch|network|reach/i.test(msg);
      setParseError(
        network
          ? 'Could not reach the server. Please check your connection and try again.'
          : msg
      );
    } finally {
      setUploading(false);
    }
  };

  // Created rows may carry name as firstName/lastName or a combined name.
  const displayName = (c) =>
    c.name || [c.firstName, c.lastName].filter(Boolean).join(' ').trim();

  const credentialsCsv = () => {
    if (!result?.created?.length) return '';
    const header = 'name,email,phone,password';
    const lines = result.created.map(
      (c) => `${displayName(c)},${c.email ?? ''},${c.phone ?? ''},${c.password ?? password ?? ''}`
    );
    return [header, ...lines].join('\n');
  };

  const copyCredentials = () => {
    navigator.clipboard?.writeText(credentialsCsv()).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadCredentialsCsv = () => {
    downloadBlob(new Blob([credentialsCsv()], { type: 'text/csv' }), 'created_students.csv');
  };

  return (
    <Modal open={open} onClose={handleClose} title="Bulk Upload Students" size="xl">
      {!result ? (
        <div className="space-y-5">
          {/* Step 1: template */}
          <div className="flex flex-col gap-3 rounded-xl border border-k-border bg-malt/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">1. Download the template</p>
              <p className="text-xs text-text-secondary/70">
                Columns: {TEMPLATE_COLUMNS.join(', ')} · each student logs in with their email
              </p>
            </div>
            <Button variant="secondary" icon={Download} onClick={handleDownloadTemplate}>
              Download Excel Template
            </Button>
          </div>

          {/* Step 2: common password */}
          <div className="rounded-xl border border-turmeric/30 bg-turmeric/5 p-4">
            <label htmlFor="bulk-common-password" className="k-label">
              2. Common password for all students<span className="text-error"> *</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="bulk-common-password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                aria-label="Common password for all students"
                className="k-input"
              />
              <Button type="button" size="sm" variant="secondary" onClick={() => setShowPw((s) => !s)}>
                {showPw ? 'Hide' : 'Show'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={RefreshCw}
                onClick={() => {
                  setPassword(generatePassword());
                  setShowPw(true);
                }}
              >
                Generate
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-text-secondary/70">
              Every student in this file is created with this same password. They each log in using
              their <span className="font-semibold text-turmeric">email</span> as the username.
            </p>
            {password && !passwordValid && (
              <p className="mt-1 text-xs text-error">Password must be at least 6 characters.</p>
            )}
          </div>

          {/* Step 3: dropzone */}
          <div>
            <p className="mb-2 text-sm font-semibold text-text-primary">
              3. Upload your filled-in file
            </p>
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors duration-150 ease-out ${
                dragOver
                  ? 'border-turmeric bg-turmeric/10'
                  : 'border-k-border hover:border-turmeric/60'
              }`}
            >
              <UploadCloud size={28} className="text-turmeric" />
              <p className="text-sm text-text-primary">
                {file ? (
                  <span className="inline-flex items-center gap-2 font-medium">
                    <FileSpreadsheet size={16} className="text-turmeric" /> {file.name}
                  </span>
                ) : (
                  'Drag & drop or click to choose a file'
                )}
              </p>
              <p className="text-xs text-text-secondary/60">Accepts .xlsx, .xls or .csv</p>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={onPick}
              />
            </div>
          </div>

          {parseError && (
            <p className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
              <AlertTriangle size={16} /> {parseError}
            </p>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-text-primary">
                Preview ({preview.length} row{preview.length === 1 ? '' : 's'}, showing first 10)
              </p>
              <div className="max-h-64 overflow-auto rounded-xl border border-k-border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-malt/80 text-text-secondary">
                    <tr>
                      {TEMPLATE_COLUMNS.map((c) => (
                        <th key={c} className="px-3 py-2 font-semibold">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t border-k-border/50">
                        {TEMPLATE_COLUMNS.map((c) => (
                          <td key={c} className="px-3 py-2 text-text-primary">
                            {String(cell(row, c) ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-k-border pt-4">
            <Button variant="secondary" onClick={handleClose} disabled={uploading}>
              Cancel
            </Button>
            <Button icon={UploadCloud} onClick={handleUpload} loading={uploading} disabled={!canUpload}>
              Upload {preview.length ? `${preview.length} Student(s)` : ''}
            </Button>
          </div>
        </div>
      ) : (
        // ---- Result panel ----
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-center">
              <CheckCircle2 size={20} className="mx-auto mb-1 text-success" />
              <p className="font-heading text-2xl font-extrabold text-text-primary">
                {result.createdCount}
              </p>
              <p className="text-xs text-text-secondary/70">Created</p>
            </div>
            <div className="rounded-xl border border-error/30 bg-error/10 p-4 text-center">
              <AlertTriangle size={20} className="mx-auto mb-1 text-error" />
              <p className="font-heading text-2xl font-extrabold text-text-primary">
                {result.skippedCount}
              </p>
              <p className="text-xs text-text-secondary/70">Skipped</p>
            </div>
          </div>

          {result.created?.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-text-primary">Created students</p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" icon={copied ? Check : Copy} onClick={copyCredentials}>
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button size="sm" variant="outline" icon={Download} onClick={downloadCredentialsCsv}>
                    CSV
                  </Button>
                </div>
              </div>
              <div className="max-h-48 overflow-auto rounded-xl border border-k-border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-malt/80 text-text-secondary">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Name</th>
                      <th className="px-3 py-2 font-semibold">Email</th>
                      <th className="px-3 py-2 font-semibold">Phone</th>
                      <th className="px-3 py-2 font-semibold">Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.created.map((c, i) => (
                      <tr key={i} className="border-t border-k-border/50">
                        <td className="px-3 py-2 text-text-primary">{displayName(c)}</td>
                        <td className="px-3 py-2 text-text-secondary">{c.email}</td>
                        <td className="px-3 py-2 text-text-secondary">{c.phone || '—'}</td>
                        <td className="px-3 py-2 font-mono text-turmeric">{c.password || password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.skipped?.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-text-primary">Skipped rows</p>
              <div className="max-h-40 overflow-auto rounded-xl border border-k-border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-malt/80 text-text-secondary">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Row</th>
                      <th className="px-3 py-2 font-semibold">Email</th>
                      <th className="px-3 py-2 font-semibold">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.skipped.map((s, i) => (
                      <tr key={i} className="border-t border-k-border/50">
                        <td className="px-3 py-2 text-text-primary">{s.row}</td>
                        <td className="px-3 py-2 text-text-secondary">{s.email || '—'}</td>
                        <td className="px-3 py-2 text-error">{s.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-k-border pt-4">
            <Button variant="secondary" icon={X} onClick={reset}>
              Upload Another
            </Button>
            <Button icon={CheckCircle2} onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

import { useEffect, useId, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import AnimatedIcon from './AnimatedIcon';
import Modal from './Modal';
import Button from './Button';

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  variant = 'danger',
  loading = false,
  // Optional type-to-confirm guard: when provided, the confirm button stays
  // disabled until the admin types this exact string (e.g. the org name).
  confirmText,
}) {
  const inputId = useId();
  const [typed, setTyped] = useState('');

  // Clear the typed guard whenever the dialog (re)opens or its target changes.
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);
  useEffect(() => {
    setTyped('');
  }, [confirmText]);

  const guarded = typeof confirmText === 'string' && confirmText.length > 0;
  const matches = typed.trim() === confirmText;
  const confirmDisabled = loading || (guarded && !matches);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={variant}
            onClick={onConfirm}
            loading={loading}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-error/15 p-2.5 text-error">
          <AnimatedIcon icon={AlertTriangle} size={20} animation="pop" className="text-error" />
        </div>
        <p className="pt-1 text-sm text-text-secondary">{message}</p>
      </div>

      {guarded && (
        <div className="mt-4">
          <label htmlFor={inputId} className="k-label">
            Type <span className="font-mono font-semibold text-error">{confirmText}</span> to confirm
          </label>
          <input
            id={inputId}
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={confirmText}
            aria-label={`Type ${confirmText} to confirm`}
            className="k-input"
          />
        </div>
      )}
    </Modal>
  );
}

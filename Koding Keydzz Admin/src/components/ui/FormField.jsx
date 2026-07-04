export default function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  options,
  rows,
  as,
  hint,
  className = '',
}) {
  const id = `field-${name}`;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="k-label">
          {label}
          {required && <span className="text-error"> *</span>}
        </label>
      )}

      {as === 'select' || options ? (
        <select
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          className="k-input"
        >
          {options?.map((opt) => {
            const val = typeof opt === 'string' ? opt : opt.value;
            const lbl = typeof opt === 'string' ? opt : opt.label;
            return (
              <option key={val} value={val}>
                {lbl}
              </option>
            );
          })}
        </select>
      ) : as === 'textarea' ? (
        <textarea
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          rows={rows || 3}
          className="k-input resize-none"
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className="k-input"
        />
      )}

      {hint && <p className="mt-1 text-xs text-text-secondary/60">{hint}</p>}
    </div>
  );
}

export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-heading text-2xl font-extrabold text-text-primary">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-text-secondary/70">{subtitle}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}

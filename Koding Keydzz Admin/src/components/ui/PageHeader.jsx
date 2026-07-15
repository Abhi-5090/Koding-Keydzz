export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate font-heading text-2xl font-extrabold text-text-primary">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-text-secondary/70">{subtitle}</p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-3 sm:shrink-0">{children}</div>
      )}
    </div>
  );
}

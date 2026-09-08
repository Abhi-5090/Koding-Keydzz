import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  Search,
} from 'lucide-react';

export default function DataTable({
  columns,
  data = [],
  searchKeys,
  pageSize = 8,
  emptyMessage = 'No records found.',
  /**
   * What the search box filters, for anyone who cannot see the table it sits
   * above. Defaulted so no caller is forced to think about it, and overridable
   * so a table of pupils can say "Search students" rather than "Search rows".
   */
  searchLabel = 'Search rows',
  toolbar,
}) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  const keys = searchKeys || columns.filter((c) => c.searchable !== false).map((c) => c.key);

  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter((row) =>
      keys.some((k) => String(row[k] ?? '').toLowerCase().includes(q))
    );
  }, [data, query, keys]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    const copy = [...filtered];
    copy.sort((a, b) => {
      let av = col?.sortValue ? col.sortValue(a) : a[sortKey];
      let bv = col?.sortValue ? col.sortValue(b) : b[sortKey];
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key, sortable) => {
    if (sortable === false) return;
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className="k-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-k-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/70"
          />
          {/*
            `type="search"` and a real label.

            It had neither: a placeholder is not an accessible name, so a
            screen-reader user met an unlabelled text box on every table in
            the portal and had nothing to tell them what it filtered. The
            placeholder also vanishes as soon as anything is typed, which is
            exactly when a reminder is most useful.
          */}
          <input
            type="search"
            aria-label={searchLabel}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search..."
            className="k-input pl-9"
          />
        </div>
        {toolbar}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-k-border bg-malt/40 text-xs uppercase tracking-wide text-text-secondary">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 font-semibold transition-colors duration-150 ease-out ${
                    col.sortable === false ? '' : 'cursor-pointer select-none hover:text-turmeric'
                  }`}
                  onClick={() => toggleSort(col.key, col.sortable)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable !== false &&
                      (sortKey === col.key ? (
                        sortDir === 'asc' ? (
                          <ChevronUp size={13} />
                        ) : (
                          <ChevronDown size={13} />
                        )
                      ) : (
                        <ChevronsUpDown size={13} className="opacity-40" />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-text-secondary/70"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map((row, i) => (
                <tr
                  key={row.id || i}
                  className="k-stagger border-b border-k-border/50 transition-colors duration-150 ease-out hover:bg-surface/40"
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-text-primary">
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-k-border p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-text-secondary/70">
          Showing{' '}
          <span className="text-text-primary">
            {sorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–
            {Math.min(safePage * pageSize, sorted.length)}
          </span>{' '}
          of <span className="text-text-primary">{sorted.length}</span>
        </p>
        <div className="flex items-center gap-2">
          {/*
            ICON-ONLY BUTTONS NEED A NAME.
            axe flagged both of these as critical `button-name` violations: a
            screen reader announced "button" with no indication of what it
            does. The icon is decorative once the button itself is labelled,
            so it is hidden to avoid announcing it twice.
          */}
          <button
            type="button"
            aria-label="Previous page"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-k-border p-1.5 text-text-secondary transition-colors duration-150 ease-out hover:border-turmeric hover:text-turmeric active:scale-95 disabled:opacity-40"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          {/*
            Announced when it changes, so a screen-reader user knows the page
            moved — otherwise activating "Next page" gives no feedback at all.
          */}
          <span className="px-2 text-text-secondary" aria-live="polite">
            Page {safePage} / {totalPages}
          </span>
          <button
            type="button"
            aria-label="Next page"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-k-border p-1.5 text-text-secondary transition-colors duration-150 ease-out hover:border-turmeric hover:text-turmeric active:scale-95 disabled:opacity-40"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

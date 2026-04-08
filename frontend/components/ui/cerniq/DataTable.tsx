'use client';

import React, { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * DataTable — Bloomberg-density table primitive.
 *
 * Tight rows, monospace numerics, sortable headers, sticky header on long
 * lists. NO virtualization yet — add that the first time we hit a real
 * surface with >2k rows. Premature virtualization is its own kind of debt.
 */

export interface DataTableColumn<T> {
  key: string;
  header: string;
  /** Render cell — receives the row and the index. */
  cell: (row: T, index: number) => ReactNode;
  /** Optional sort key — when present, the header becomes clickable. */
  sortValue?: (row: T) => number | string;
  align?: 'left' | 'right';
  numeric?: boolean;
  width?: string; // any CSS width, e.g. '120px', '20%', 'minmax(...)'
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  /** Enables a single-row highlight when clicked. */
  selectable?: boolean;
  caption?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyMessage = 'No data',
  selectable = false,
  caption,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, columns, sortKey, sortDir]);

  function toggleSort(col: DataTableColumn<T>) {
    if (!col.sortValue) return;
    if (sortKey === col.key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {caption ? (
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
          {caption}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              {columns.map((col) => {
                const align = col.align === 'right' ? 'text-right' : 'text-left';
                const sortable = Boolean(col.sortValue);
                const isSorted = sortKey === col.key;
                const hide = col.hideOnMobile ? 'hidden sm:table-cell' : '';
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={{ width: col.width }}
                    className={`${align} ${hide} border-b border-slate-200 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600 ${
                      sortable ? 'cursor-pointer select-none hover:bg-slate-100' : ''
                    }`}
                    onClick={sortable ? () => toggleSort(col) : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {sortable && isSorted ? (
                        sortDir === 'asc' ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => {
              const key = rowKey(row, i);
              const isSelected = selectable && selectedKey === key;
              return (
                <tr
                  key={key}
                  className={`border-b border-slate-100 transition-colors last:border-b-0 ${
                    isSelected ? 'bg-blue-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                  } ${onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                  onClick={() => {
                    if (selectable) setSelectedKey(key);
                    onRowClick?.(row);
                  }}
                >
                  {columns.map((col) => {
                    const align = col.align === 'right' ? 'text-right' : 'text-left';
                    const num = col.numeric ? 'font-mono tabular-nums text-slate-900' : 'text-slate-700';
                    const hide = col.hideOnMobile ? 'hidden sm:table-cell' : '';
                    return (
                      <td key={col.key} className={`${align} ${num} ${hide} px-3 py-2`}>
                        {col.cell(row, i)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

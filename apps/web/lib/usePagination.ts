'use client';

import { useMemo, useState } from 'react';

/**
 * Client-side pagination. Slices `items` into pages of `perPage`, and clamps the
 * current page if the list shrinks (e.g. after a search/filter), so you never
 * end up on an empty page.
 */
export function usePagination<T>(items: T[], perPage = 10) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(page, pageCount - 1);
  const slice = useMemo(
    () => items.slice(current * perPage, current * perPage + perPage),
    [items, current, perPage],
  );
  return { page: current, setPage, pageCount, slice, total: items.length, perPage };
}

'use client';

import { Box, Pagination, Typography } from '@mui/material';

/** Centered numbered pager for card lists. Hidden when there's only one page. */
export function Pager({
  page, pageCount, total, perPage, onChange, unit = 'items',
}: {
  page: number; pageCount: number; total: number; perPage: number;
  onChange: (page: number) => void; unit?: string;
}) {
  if (total === 0) return null;
  const from = page * perPage + 1;
  const to = Math.min(total, page * perPage + perPage);
  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 2.5 }}>
      <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.5)' }}>
        {from}–{to} of {total} {unit}
      </Typography>
      {pageCount > 1 && (
        <Pagination
          page={page + 1} count={pageCount} shape="rounded"
          onChange={(_, v) => onChange(v - 1)}
          sx={{ '& .Mui-selected': { bgcolor: '#e2f2dc !important', color: '#2f6b2b', fontWeight: 800 } }}
        />
      )}
    </Box>
  );
}

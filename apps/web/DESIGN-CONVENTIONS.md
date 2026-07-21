# PicklePlay — UI conventions

Read this before building or changing any screen. These rules keep every page
consistent. When in doubt, copy an existing page that already follows them
(sessions, admin, host).

## Mobile-first (build this order)

- **Design and verify the mobile (xs) layout FIRST, then scale up to desktop.**
  Every new screen must look right on a phone before it's considered done.
- Default to a single column on `xs`; widen with responsive props:
  `gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }`,
  `direction={{ xs: 'column', md: 'row' }}`, `display: { xs: 'none', md: 'flex' }`.
- Never rely on a fixed horizontal row of items that can overflow on a phone —
  wrap (`flexWrap`), stack, or collapse into a drawer/menu (see `TopNav`).
- Tap targets ≥ 40px; avoid tiny inline controls crowded together on mobile.
- Sanity-check at ~375px wide. Horizontal scrolling is only acceptable for
  intentionally wide content (e.g. the tournament bracket), never page chrome.

## Forms & fields

- **Always use `LabeledField`** (`@/components/labeled-field`) for form inputs —
  bold label **above** the field, never MUI's floating `label=` prop. Works for
  text inputs and dropdowns (`select` + `<MenuItem>` children).
- For non-TextField controls (Rating, ToggleButtonGroup, color swatches), render
  the label yourself: `<Typography variant="body2" fontWeight={700} mb={0.75}>`.
- A field + button on one row: wrap fields in `<Box sx={{ flex: 1 }}>`, use
  `<Stack direction="row" spacing={1.5} alignItems="flex-end">`, and nudge the
  button with `sx={{ mb: '1px' }}` so it lines up with the input bottoms.

## Spacing rhythm (use these, don't invent new values)

- **Page container:** `<Box sx={{ maxWidth: …, mx: 'auto', p: { xs: 2, md: 3 } }}>`.
- **Between top-level cards / sections:** `mt: 2.5` (or wrap the sequence in
  `<Stack spacing={2.5}>`). Do not mix `mt: 2`, `mt: 0.5`, etc.
- **Inside a card:** `<CardContent sx={{ p: { xs: 2, md: 3 } }}>`; stack rows with
  `<Stack spacing={2}>`.
- **Chip/inline gaps:** `spacing={1}`–`spacing={1.5}`. **Grid gutters:** `spacing={2}`.

## Alignment

- **Equal-height cards in a row:** give the `Card` `sx={{ height: '100%' }}` and
  its `CardContent` `display:'flex'; flexDirection:'column'`. Reserve optional
  lines (e.g. a subtitle) so cards don't jump heights — render `{sub ?? ' '}`.
- **Section header pattern:** `<Stack direction="row" spacing={1.25}
  alignItems="baseline">` with an h4/h5 title + a muted `body2` subtitle.
- Right-align money/actions in a row with `sx={{ ml: 'auto' }}`.

## Color tokens (match the design system)

- Actions/primary green `#2f6b2b` (hover `#24551f`); court/live green `#4c9a44`.
- Card tints `#f4f7f2` / `#f7faf5`, borders `#e7efe2`; amber accents `#fdf1d7` /
  `#b07f24`; destructive `#a04a35`.
- Court palette + the shared `avatarSrcFor`, `Stars`, `QueueRow`, `CourtCard`,
  `UpNextCard`, `CoverageTile` all live in `@/components/board` — reuse them,
  don't re-draw courts/queues per page.

## Modals

- Confirmations use `ConfirmDialog` (`@/components/confirm-dialog`), never
  `window.confirm`. Other dialogs: `maxWidth="xs" fullWidth`, bold `DialogTitle`,
  actions padded `sx={{ px: 3, pb: 2.5 }}`.

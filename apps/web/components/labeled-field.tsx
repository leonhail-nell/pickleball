'use client';

import { Box, TextField, Typography, type TextFieldProps } from '@mui/material';

/**
 * PickleQ-style form field: a bold label ABOVE the input, no floating MUI label.
 *
 * ⭐ PROJECT CONVENTION — use this for every form field in the app. Do NOT use a
 * bare `<TextField label=…>` (floating label) in forms; it's inconsistent with
 * the login/registration/create-session forms. Works for text inputs and for
 * dropdowns too — pass `select` and `<MenuItem>` children:
 *
 *   <LabeledField label="Email" type="email" value={…} onChange={…} />
 *   <LabeledField label="Skill level" select value={tier} onChange={…}>…</LabeledField>
 *
 * For a standalone control that isn't a TextField (Rating, ToggleButtonGroup,
 * color swatches), render the label yourself as:
 *   <Typography variant="body2" fontWeight={700} mb={0.75}>Label</Typography>
 */
export function LabeledField({
  label, hint, ...props
}: { label: string; hint?: string } & Omit<TextFieldProps, 'label'>) {
  return (
    <Box>
      <Typography variant="body2" fontWeight={700} mb={0.5}>
        {label}
        {props.required && <Box component="span" sx={{ color: 'text.secondary' }}> *</Box>}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
          {hint}
        </Typography>
      )}
      <TextField {...props} required={props.required} label={undefined} fullWidth size="small" />
    </Box>
  );
}

'use client';

import { Box, TextField, Typography, type TextFieldProps } from '@mui/material';

/** PickleQ-style form field: bold label above the input, no floating MUI label. */
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

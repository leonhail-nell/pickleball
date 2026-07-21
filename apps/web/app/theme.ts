'use client';

import { createTheme } from '@mui/material/styles';

/** Smooth, modern light theme (PickleQ-inspired): mint canvas, crisp near-black
 *  type, vivid court-green actions, soft borders and shadows. */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#22c55e', dark: '#16a34a', contrastText: '#ffffff' },
    secondary: { main: '#16a34a' },
    success: { main: '#16a34a' },
    warning: { main: '#f59e0b' },
    error: { main: '#ef4444' },
    background: { default: '#f0fdf4', paper: '#ffffff' },
    text: { primary: '#111827', secondary: '#6b7280' },
    divider: 'rgba(17,24,39,0.10)',
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily:
      '"Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    fontWeightRegular: 500,
    fontWeightMedium: 700,
    fontWeightBold: 800,
    h1: { fontWeight: 900, letterSpacing: '-0.02em' },
    h2: { fontWeight: 900, letterSpacing: '-0.02em' },
    h3: { fontWeight: 900, letterSpacing: '-0.01em' },
    h4: { fontWeight: 800, letterSpacing: '-0.01em' },
    h5: { fontWeight: 800 },
    h6: { fontWeight: 800 },
    subtitle1: { fontWeight: 700 },
    subtitle2: { fontWeight: 700 },
    body1: { fontWeight: 500 },
    body2: { fontWeight: 500 },
    button: { fontWeight: 800, textTransform: 'none' },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          background: '#ffffff',
          border: '1px solid rgba(17,24,39,0.08)',
          backgroundImage: 'none',
          boxShadow: '0 1px 3px rgba(17,24,39,0.06), 0 1px 2px rgba(17,24,39,0.04)',
          transition: 'box-shadow 160ms ease, transform 160ms ease',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          paddingInline: 18,
          boxShadow: 'none',
          '&:hover': { boxShadow: '0 2px 8px rgba(34,197,94,0.25)' },
        },
        contained: { '&:active': { transform: 'scale(0.98)' } },
        outlined: { borderColor: 'rgba(17,24,39,0.18)', color: '#111827', background: '#ffffff' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 700 },
        outlined: { borderColor: 'rgba(17,24,39,0.15)' },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 12, background: '#ffffff' },
        notchedOutline: { borderColor: 'rgba(17,24,39,0.15)' },
      },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: 12 } },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          background: '#ffffff',
          backgroundImage: 'none',
          border: '1px solid rgba(17,24,39,0.08)',
          boxShadow: '0 20px 60px rgba(17,24,39,0.18)',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          background: '#ffffff',
          backgroundImage: 'none',
          border: '1px solid rgba(17,24,39,0.08)',
          boxShadow: '0 8px 24px rgba(17,24,39,0.12)',
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          background: '#ffffff',
          backgroundImage: 'none',
          border: '1px solid rgba(17,24,39,0.08)',
        },
      },
    },
  },
});

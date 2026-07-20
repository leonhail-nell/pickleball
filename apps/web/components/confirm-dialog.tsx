'use client';

import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

export interface ConfirmState {
  title: string;
  message: string;
  confirmLabel?: string;
  /** Red confirm button for destructive actions (default true). */
  danger?: boolean;
  onConfirm: () => void;
}

/**
 * Design-system confirmation modal — replaces window.confirm().
 *
 * Usage:
 *   const [confirm, setConfirm] = useState<ConfirmState | null>(null);
 *   setConfirm({ title, message, confirmLabel, onConfirm: () => … });
 *   <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
 */
export function ConfirmDialog({
  state, onClose,
}: {
  state: ConfirmState | null;
  onClose: () => void;
}) {
  const danger = state?.danger ?? true;
  return (
    <Dialog open={!!state} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, letterSpacing: '-0.01em', pb: 0.75 }}>
        {state?.title}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.6)' }}>
          {state?.message}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 0.5 }}>
        <Button onClick={onClose} sx={{ color: '#5a6b56', fontWeight: 700 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            state?.onConfirm();
            onClose();
          }}
          sx={
            danger
              ? { bgcolor: '#a04a35', fontWeight: 700, '&:hover': { bgcolor: '#8a3d2b' } }
              : { bgcolor: '#2f6b2b', fontWeight: 700, '&:hover': { bgcolor: '#24551f' } }
          }
        >
          {state?.confirmLabel ?? 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

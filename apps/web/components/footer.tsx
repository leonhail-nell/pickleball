import { Box, Container, Divider, Link, Stack, Typography } from '@mui/material';

/** Shared footer: copyright year + Privacy / Terms. */
export function Footer() {
  return (
    <Box component="footer" sx={{ mt: 'auto' }}>
      <Divider />
      <Container maxWidth="lg" sx={{ py: 3, textAlign: 'center' }}>
        <Stack spacing={1} alignItems="center">
          <Typography variant="body2" color="text.secondary">
            © {new Date().getFullYear()} PicklePlay — fair play, every rotation.
          </Typography>
          <Stack direction="row" spacing={2.5} justifyContent="center">
            <Link href="/privacy" underline="hover" variant="body2" color="text.secondary">
              Privacy
            </Link>
            <Link href="/terms" underline="hover" variant="body2" color="text.secondary">
              Terms
            </Link>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

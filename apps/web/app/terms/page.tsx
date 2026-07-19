import { TopNav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { Box, Card, CardContent, Typography } from '@mui/material';

export default function TermsPage() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopNav />
      <Box sx={{ maxWidth: 760, mx: 'auto', p: 3, width: '100%' }}>
        <Typography variant="h4" fontWeight={800} mb={2}>Terms of Service</Typography>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography paragraph color="text.secondary">
              PicklePlay is a tool for organizing pickleball open play — sessions, fair
              court rotation, check-ins, standings, and club management. By creating an
              account you agree to use it for that purpose and to treat other players
              with respect.
            </Typography>
            <Typography paragraph color="text.secondary">
              Matchups are drawn by a cryptographically random, audited shuffle.
              Organizers may override assignments; every override is logged and visibly
              flagged. Ratings and standings are provided for fun and fair matchmaking —
              they are not official DUPR or UTPR ratings.
            </Typography>
            <Typography paragraph color="text.secondary">
              The free plan supports sessions of up to 5 courts. Venue Pro unlocks
              larger sessions; fees, trials, and billing terms are shown at the time of
              purchase. Clubs are responsible for their own drop-in fees and refunds.
            </Typography>
            <Typography color="text.secondary">
              The service is provided as-is, without warranty. Organizers may remove
              players who abuse the platform or other participants.
            </Typography>
          </CardContent>
        </Card>
      </Box>
      <Footer />
    </Box>
  );
}

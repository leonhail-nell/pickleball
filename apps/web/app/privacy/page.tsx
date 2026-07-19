import { TopNav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { Box, Card, CardContent, Typography } from '@mui/material';

export default function PrivacyPage() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopNav />
      <Box sx={{ maxWidth: 760, mx: 'auto', p: 3, width: '100%' }}>
        <Typography variant="h4" fontWeight={800} mb={2}>Privacy Policy</Typography>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography paragraph color="text.secondary">
              PicklePlay collects only what it needs to run open play: your name, email,
              skill rating, an optional profile photo, and your game results. This
              information is used to organize sessions, build fair matchups, and show
              standings to other participants of the sessions you join.
            </Typography>
            <Typography paragraph color="text.secondary">
              Your email is never shown to other players and is never sold or shared with
              third parties. Game results and leaderboards are visible to anyone with a
              link to a session you played in. Profile photos are optional and can be
              removed at any time from your profile page.
            </Typography>
            <Typography paragraph color="text.secondary">
              If you sign in with Google, we receive only your name and email address —
              never your password or other account data. Payment records kept by your
              club (drop-in fees, memberships) are visible to that club&apos;s organizers
              only.
            </Typography>
            <Typography color="text.secondary">
              To have your account and data deleted, contact your club organizer or the
              site administrator.
            </Typography>
          </CardContent>
        </Card>
      </Box>
      <Footer />
    </Box>
  );
}

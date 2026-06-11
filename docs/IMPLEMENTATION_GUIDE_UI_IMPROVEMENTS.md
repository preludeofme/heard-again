# UI/UX Improvements - Implementation Guide

## Overview

This document provides step-by-step instructions for implementing the remaining UI/UX improvements identified in the account/settings review.

## Priority 1: Usage Warnings & Upgrade CTAs

### Location: `UI/src/pages/account.tsx` - Subscription Tab

**Goal**: Show warnings at 80%, 90%, and 100% usage with upgrade/purchase links

**Key Points**:
- Limits apply to **GPU-based voice generation only**
- **Playback of generated audio is unlimited** even after quota exceeded
- Provide clear upgrade path and "buy minutes" option

**Implementation Steps**:

1. After line 503 (after "Current Usage" heading), add warning logic:

```tsx
{subscription && subscription.plan?.planType !== 'FREE' && (
  <>
    {/* Generation Limit Warning - 90% threshold */}
    {subscription.usage.generationMinutesUsed >= subscription.plan.entitlements.generationMinutesIncluded * 0.9 &&
     subscription.usage.generationMinutesUsed < subscription.plan.entitlements.generationMinutesIncluded && (
      <Alert severity="warning" sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Approaching voice generation limit
        </Typography>
        <Typography variant="body2">
          You've used {Math.round((subscription.usage.generationMinutesUsed / subscription.plan.entitlements.generationMinutesIncluded) * 100)}% of your {subscription.plan.entitlements.generationMinutesIncluded} included minutes.
        </Typography>
      </Alert>
    )}
    
    {/* Generation Limit Reached - 100% threshold */}
    {subscription.usage.generationMinutesUsed >= subscription.plan.entitlements.generationMinutesIncluded && (
      <Alert severity="error" sx={{ mb: 2 }} icon={<RecordVoiceOver />}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Voice generation limit reached
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          You've used all {subscription.plan.entitlements.generationMinutesIncluded} included minutes this billing period. 
          Generated audio can still be played back unlimited - only new generation is restricted.
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button size="small" variant="outlined" onClick={() => setIsChangePlanDialogOpen(true)}>
            Upgrade Plan
          </Button>
          <Button size="small" variant="text" onClick={() => router.push('/account?tab=credits')}>
            Buy Extra Minutes
          </Button>
        </Stack>
      </Alert>
    )}
    
    {/* Storage Limit Warning - 80% threshold */}
    {subscription.plan.entitlements.storageQuotaBytes > 0 &&
     subscription.usage.storageBytesUsed >= subscription.plan.entitlements.storageQuotaBytes * 0.8 && (
      <Alert severity={subscription.usage.storageBytesUsed >= subscription.plan.entitlements.storageQuotaBytes ? 'error' : 'warning'} sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {subscription.usage.storageBytesUsed >= subscription.plan.entitlements.storageQuotaBytes 
            ? 'Storage limit reached' 
            : 'Approaching storage limit'}
        </Typography>
        <Typography variant="body2">
          {formatBytes(subscription.usage.storageBytesUsed)} of {formatBytes(subscription.plan.entitlements.storageQuotaBytes)} used.
        </Typography>
      </Alert>
    )}
  </>
)}
```

2. Update the usage label at line 504 to clarify:
```tsx
<Typography variant="subtitle2" sx={{ mb: 2 }}>
  Current Usage
  <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary', fontWeight: 400 }}>
    (GPU-based voice generation only — playback is unlimited)
  </Typography>
</Typography>
```

3. Add color-coding to the generation progress bar (around line 534):
```tsx
<LinearProgress
  variant="determinate"
  value={Math.min(
    ((subscription.usage?.generationMinutesUsed || 0) / subscription.plan.entitlements.generationMinutesIncluded) * 100,
    100
  )}
  sx={{
    mt: 1,
    '& .MuiLinearProgress-bar': {
      backgroundColor: subscription.usage.generationMinutesUsed >= subscription.plan.entitlements.generationMinutesIncluded
        ? '#d32f2f'  // Red when exceeded
        : subscription.usage.generationMinutesUsed >= subscription.plan.entitlements.generationMinutesIncluded * 0.8
        ? '#ed6c02'  // Orange when approaching
        : undefined,  // Default color otherwise
    },
  }}
/>
```

---

## Priority 2: Plan Comparison Table

### Location: `UI/src/pages/account.tsx` - New section after Available Plans

**Goal**: Side-by-side comparison of all 4 tiers to encourage upgrades

**Implementation**:

Add this component after the "Available Plans" card (around line 625):

```tsx
{/* Plan Comparison Table */}
<Card sx={{ mt: 3 }}>
  <CardContent>
    <Typography variant="h6" sx={{ mb: 2 }}>
      Compare Plans
    </Typography>
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Feature</TableCell>
            <TableCell align="center">Free Local</TableCell>
            <TableCell align="center">Connected</TableCell>
            <TableCell align="center">Hybrid</TableCell>
            <TableCell align="center">Cloud</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>Voice Generation</TableCell>
            <TableCell align="center">Unlimited</TableCell>
            <TableCell align="center">20 min/mo</TableCell>
            <TableCell align="center">60 min/mo</TableCell>
            <TableCell align="center">120 min/mo</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Cloud GPU</TableCell>
            <TableCell align="center"><Check color="success" /></TableCell>
            <TableCell align="center"><Close color="disabled" /></TableCell>
            <TableCell align="center"><Check color="success" /></TableCell>
            <TableCell align="center"><Check color="success" /></TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Members</TableCell>
            <TableCell align="center">1</TableCell>
            <TableCell align="center">10</TableCell>
            <TableCell align="center">10</TableCell>
            <TableCell align="center">20</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Voice Profiles</TableCell>
            <TableCell align="center">2</TableCell>
            <TableCell align="center">10</TableCell>
            <TableCell align="center">20</TableCell>
            <TableCell align="center">50</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Storage</TableCell>
            <TableCell align="center">Unlimited</TableCell>
            <TableCell align="center">-</TableCell>
            <TableCell align="center">-</TableCell>
            <TableCell align="center">10 GB</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Price</TableCell>
            <TableCell align="center">$0</TableCell>
            <TableCell align="center">$1/mo</TableCell>
            <TableCell align="center">$5/mo</TableCell>
            <TableCell align="center">$10/mo</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
    <Typography variant="caption" sx={{ mt: 2, display: 'block', color: 'text.secondary' }}>
      * Limits apply to AI voice generation only. Playback of existing audio is always unlimited.
    </Typography>
  </CardContent>
</Card>
```

---

## Priority 3: Buy Minutes / Purchase Credits UI

### New Page: `UI/src/pages/account/credits.tsx` OR Modal in Account Page

**Goal**: Allow users to purchase one-time usage credits (e.g., 10 min for $2)

**Backend Required**:
- New API endpoint: `POST /api/billing/purchase-credits`
- Stripe integration for one-time payments
- Update `Subscription.generationMinutesIncluded` or create `UsageCredit` table

**Simplest Implementation**: Add "Buy Minutes" section in account page:

```tsx
<Card sx={{ mt: 3 }}>
  <CardContent>
    <Typography variant="h6" sx={{ mb: 2 }}>
      Need More Voice Minutes?
    </Typography>
    <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
      Purchase extra generation minutes that don't expire. Perfect for occasional use.
    </Typography>
    <Grid container spacing={2}>
      {[
        { minutes: 10, price: 2 },
        { minutes: 30, price: 5 },
        { minutes: 60, price: 9 },
      ].map((option) => (
        <Grid size={4} key={option.minutes}>
          <Card 
            variant="outlined" 
            sx={{ 
              p: 2, 
              cursor: 'pointer',
              '&:hover': { borderColor: 'primary.main' }
            }}
            onClick={() => {/* Open purchase modal */}}
          >
            <Typography variant="h6" align="center">
              {option.minutes} min
            </Typography>
            <Typography variant="body2" align="center" color="text.secondary">
              ${option.price}
            </Typography>
          </Card>
        </Grid>
      ))}
    </Grid>
  </CardContent>
</Card>
```

---

## Priority 4: Familyspace Deletion Voting Visualization

### Location: `UI/src/pages/familyspaces/[id]/settings.tsx` - Delete Dialog

**Current State**: Shows "X of Y members have voted"

**Improvement**: Add visual progress and member avatars

```tsx
<DialogContent>
  <Typography variant="body1" sx={{ mb: 2 }}>
    Familyspace deletion requires consensus from active members.
  </Typography>
  
  {/* Progress Bar */}
  <Box sx={{ mb: 2 }}>
    <Typography variant="body2" sx={{ mb: 1 }}>
      {deletionVotes} of {votesNeeded} members have approved
    </Typography>
    <LinearProgress 
      variant="determinate" 
      value={(deletionVotes / votesNeeded) * 100}
      sx={{ height: 8, borderRadius: 4 }}
    />
  </Box>
  
  {/* Member List with Vote Status */}
  <List dense>
    {members.map((member) => (
      <ListItem key={member.id}>
        <ListItemAvatar>
          <Avatar src={member.avatarUrl}>
            {member.displayName?.[0]}
          </Avatar>
        </ListItemAvatar>
        <ListItemText 
          primary={member.displayName || member.email}
          secondary={
            deletionVoters.includes(member.id) 
              ? '✓ Approved' 
              : 'Has not voted yet'
          }
          secondaryTypographyProps={{
            color: deletionVoters.includes(member.id) ? 'success.main' : 'text.secondary'
          }}
        />
      </ListItem>
    ))}
  </List>
  
  <Alert severity="info" sx={{ mt: 2 }}>
    <Typography variant="caption">
      Members who don't vote within 7 days will be counted as abstaining.
    </Typography>
  </Alert>
</DialogContent>
```

---

## Summary Checklist

- [ ] Add usage warning banners (80%, 90%, 100%)
- [ ] Add "generation only, playback unlimited" clarification
- [ ] Color-code progress bars (green → orange → red)
- [ ] Add "Upgrade Plan" and "Buy Minutes" buttons in warnings
- [ ] Add plan comparison table
- [ ] Add purchase credits UI
- [ ] Add deletion voting visualization
- [ ] Test on mobile (375px viewport)

## Files to Modify

1. `UI/src/pages/account.tsx` - Warnings, comparison table, credits
2. `UI/src/pages/familyspaces/[id]/settings.tsx` - Voting visualization
3. `UI/src/pages/api/billing/purchase-credits.ts` - New API (backend)
4. `prisma/schema.prisma` - Add `UsageCredit` table (optional)

## Estimated Effort

- Warnings & messaging: 1 hour
- Comparison table: 30 min
- Purchase credits: 3-4 hours (frontend + backend)
- Voting visualization: 1 hour
- **Total: ~6 hours**

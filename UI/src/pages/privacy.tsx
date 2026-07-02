import React from 'react'
import {
  Box,
  Typography,
  Container,
  Button,
  useTheme,
  Divider,
  Paper,
  Stack,
} from '@mui/material'
import Head from 'next/head'
import Link from 'next/link'
import {
  Shield as ShieldIcon,
  VerifiedUser as VerifiedIcon,
  CloudOff as LocalIcon,
  Download as ExportIcon,
  DeleteForever as DeleteIcon,
} from '@mui/icons-material'
import { PublicHeader } from '../components/layout/PublicHeader'

export default function PrivacyPolicyPage() {
  const theme = useTheme()

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Head>
        <title>Privacy Policy - Heard Again</title>
      </Head>

      <PublicHeader />

      {/* Main Content */}
      <Box component="main" sx={{ py: { xs: 8, md: 12 }, flexGrow: 1 }}>
        <Container maxWidth="md">
          <Typography
            variant="h2"
            sx={{
              fontFamily: 'var(--font-newsreader), serif',
              color: 'primary.main',
              mb: 2,
              fontSize: { xs: '2.5rem', md: '3.5rem' },
            }}
          >
            Privacy Policy
          </Typography>
          <Typography variant="body1" sx={{ color: 'secondary.main', mb: 6, fontSize: '1.125rem' }}>
            Last updated: May 9, 2026
          </Typography>

          {/* Privacy Promise Box */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 4, md: 6 },
              mb: 8,
              borderRadius: 4,
              bgcolor: 'rgba(208, 227, 230, 0.2)',
              border: '1px solid',
              borderColor: 'rgba(22, 51, 74, 0.1)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Typography variant="h4" sx={{ color: 'primary.main', fontFamily: 'var(--font-newsreader), serif', fontStyle: 'italic', mb: 3 }}>
                Our Privacy Promise
              </Typography>
              <Typography variant="h6" sx={{ color: 'secondary.main', mb: 4, fontWeight: 600 }}>
                Your family’s memories are yours.
              </Typography>
              
              <Stack spacing={2.5}>
                {[
                  { icon: <ShieldIcon color="primary" />, text: "We do not sell your data." },
                  { icon: <ShieldIcon color="primary" />, text: "We do not use your family content for advertising." },
                  { icon: <VerifiedIcon color="primary" />, text: "We do not train public AI models on your stories, recordings, photos, documents, voice profiles, or generated audio." },
                  { icon: <ExportIcon color="primary" />, text: "You can export or delete your data at any time." },
                  { icon: <LocalIcon color="primary" />, text: "You can cloud-host with us or self-host Heard Again yourself." },
                ].map((item, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                    {item.icon}
                    <Typography variant="body1" sx={{ color: 'primary.main', fontWeight: 500, lineHeight: 1.4 }}>
                      {item.text}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Paper>

          <Box sx={{ '& > *': { mb: 6 } }}>
            <Box>
              <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700, mb: 3 }}>
                Our Commitment to You
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 2 }}>
                At Heard Again, we believe your family’s stories, memories, photos, and voices deserve to be protected with care.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 2 }}>
                We are stewards of your family legacy, not owners of your data.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 3 }}>
                Our goal is to give families a safe, private place to preserve the people, voices, and stories they never want to lose.
              </Typography>
              
              <Box sx={{ bgcolor: 'background.paper', p: 3, borderRadius: 2, borderLeft: '4px solid', borderColor: 'primary.main' }}>
                <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, fontWeight: 600 }}>
                  • We do not sell your data.<br />
                  • We do not sell your family’s memories.<br />
                  • We do not use your family content for advertising.<br />
                  • We do not use your stories, recordings, images, documents, voice profiles, or generated audio to train public AI models or models used by other customers.
                </Typography>
              </Box>
              
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mt: 3, fontStyle: 'italic' }}>
                Your family’s memories belong to your family.
              </Typography>
            </Box>

            <Divider />

            <Box>
              <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700, mb: 3 }}>
                1. Information We Collect
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 3 }}>
                We collect information you provide directly to Heard Again when you use the service.
              </Typography>

              <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 700, mb: 1 }}>
                Account Information
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 2 }}>
                This may include: Name, Email address, Password or authentication credentials, Account settings, and Billing information, if you choose a paid plan.
              </Typography>
              <Typography variant="body2" sx={{ color: 'secondary.main', mb: 4 }}>
                Payment information may be processed by a third-party payment provider. Heard Again does not store your full payment card details.
              </Typography>

              <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 700, mb: 1 }}>
                Family Stories and Media
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 2 }}>
                You may choose to upload or create: Written stories, Audio recordings, Voice messages, Images, Documents, Letters, Family history details, and Contributor notes and memories.
              </Typography>
              <Typography variant="body2" sx={{ color: 'secondary.main', mb: 4 }}>
                This content is stored in your private family space and is only available to users you invite or authorize.
              </Typography>

              <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 700, mb: 1 }}>
                Voice Profiles
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 2 }}>
                If you choose to use voice features, Heard Again may process audio samples to create a voice profile.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 2, fontWeight: 600 }}>
                Voice profiles are optional.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 3 }}>
                We only create a voice profile when the feature is intentionally enabled and the required consent is provided. Voice profiles are used only to provide the voice-related features requested within your family space.
              </Typography>
              
              <Box component="ul" sx={{ color: 'text.primary', lineHeight: 1.8 }}>
                <li>We do not sell voice profiles.</li>
                <li>We do not use voice profiles for advertising.</li>
                <li>We do not use voice profiles to train public AI models.</li>
                <li>We do not use one family’s voice profile to benefit another family’s account.</li>
              </Box>
            </Box>

            <Box>
              <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700, mb: 3 }}>
                2. How We Use Your Information
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 3 }}>
                We use your information only to provide, protect, and improve Heard Again for your account.
              </Typography>
              <Box component="ul" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 3 }}>
                <li>Creating and managing your account</li>
                <li>Storing your family stories, recordings, photos, and documents</li>
                <li>Allowing invited contributors to add memories</li>
                <li>Providing transcription, organization, search, and storytelling features</li>
                <li>Providing optional voice-related features</li>
                <li>Securing your account and preventing unauthorized access</li>
                <li>Processing payments, if you choose a paid plan</li>
                <li>Communicating with you about your account, security, service updates, or support requests</li>
                <li>Maintaining and improving the reliability, safety, and performance of the platform</li>
              </Box>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8 }}>
                When we improve transcription, organization, or voice features, we do so only to provide the service to your family space. We do not use your private family content to train models for other users or for unrelated commercial purposes.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700, mb: 3 }}>
                3. Voice Consent and Responsible Use
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 2 }}>
                Heard Again is designed for respectful family preservation.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 2 }}>
                You should only upload recordings, create voice profiles, or generate voice-based memories when you have the appropriate rights or permission to do so.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 2 }}>
                For living people, you should not create or use a voice profile without their permission.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 3 }}>
                For deceased loved ones, families should use voice features respectfully and only when they have the appropriate family rights or permission to preserve and use those recordings.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, fontWeight: 600 }}>
                You can delete voice profiles at any time from your account settings.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700, mb: 3 }}>
                4. Data Ownership and Self-Hosting
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 4 }}>
                You own your data. Heard Again is designed to support both hosted and self-hosted use.
              </Typography>

              <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 700, mb: 1 }}>
                Hosted Service
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 3 }}>
                If you use our hosted service, we store your family content securely and provide tools to manage, export, and delete your data. You can export your family history, stories, and media at any time.
              </Typography>

              <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 700, mb: 1 }}>
                Self-Hosted Use
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 2 }}>
                If you choose to self-host Heard Again, your data remains on the systems you control.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8 }}>
                Self-hosting gives technically inclined families the ability to preserve their family legacy on their own hardware and manage storage, access, backups, and security themselves.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700, mb: 3 }}>
                5. Sharing and Invited Contributors
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 2 }}>
                Your family space is private by default. You decide who can access it.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 2 }}>
                When you invite family members, friends, or contributors, they may be able to view or add stories, recordings, images, documents, or other memories depending on the permissions you give them.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 3 }}>
                You are responsible for choosing who you invite and what access they receive.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, fontWeight: 600 }}>
                We do not make your family space public without your action.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700, mb: 3 }}>
                6. Third-Party Service Providers
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 3 }}>
                We may use trusted service providers to operate Heard Again. These may include providers for: Cloud hosting, File storage, Database hosting, Payment processing, Email delivery, Transcription, Voice processing, Security monitoring, Error logging, and Customer support.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 2 }}>
                These providers may process limited information only as needed to provide services to Heard Again.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, fontWeight: 600 }}>
                They are not allowed to sell your family content or use it for their own advertising purposes.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700, mb: 3 }}>
                7. Security
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 3 }}>
                We use reasonable administrative, technical, and organizational safeguards to protect your information. This includes encryption of data in transit and at rest, access controls, authentication protections, and monitoring designed to prevent unauthorized access.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 3 }}>
                Access to your family space is restricted to you and the people you explicitly invite.
              </Typography>
              <Typography variant="body2" sx={{ color: 'secondary.main' }}>
                No system can be guaranteed to be 100% secure, but we design Heard Again with privacy and family trust as core requirements.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700, mb: 3 }}>
                8. Data Retention and Deletion
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 3 }}>
                You can access, correct, export, or delete your data. You may delete: Individual stories, recordings, images, documents, voice profiles, family spaces, or your entire account.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 3 }}>
                When you delete content, we remove it from active systems. Backup copies may remain for a limited period as part of routine security and system backup processes.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8 }}>
                If you delete your account, we will delete or de-identify your account information and family content unless we are required to keep limited information for legal, security, or billing reasons.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700, mb: 3 }}>
                9. Children and Family Content
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 2 }}>
                Heard Again is intended for use by adults and families under adult supervision. Children should not create accounts without a parent or guardian.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8 }}>
                Parents or guardians are responsible for deciding whether to upload stories, images, recordings, or other information about children.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700, mb: 3 }}>
                10. Your Rights and Choices
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8, mb: 3 }}>
                Depending on where you live, you may have privacy rights related to your personal information, including the right to access, correct, export, or delete your data.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8 }}>
                You can manage many of these choices in your <strong>Privacy Settings</strong> page or by contacting us directly for help with privacy requests.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700, mb: 3 }}>
                11. Changes to This Policy
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8 }}>
                We may update this Privacy Policy from time to time. If we make material changes, we will notify you through the service, by email, or by another reasonable method. The updated policy will include a new “Last updated” date.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700, mb: 3 }}>
                12. Contact Us
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.8 }}>
                If you have questions about this Privacy Policy or how your family data is handled, contact us at:<br />
                <Typography component="a" href="mailto:privacy@heardagain.com" sx={{ color: 'primary.main', fontWeight: 600, textDecoration: 'underline' }}>
                  privacy@heardagain.com
                </Typography>
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          bgcolor: 'rgba(208, 227, 230, 0.3)',
          py: 4,
          px: { xs: 4, md: 8 },
          mt: 'auto',
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: 'var(--font-newsreader), serif',
                  fontStyle: 'italic',
                  color: 'primary.main',
                }}
              >
                Heard Again
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'secondary.main', display: 'block' }}
              >
                &copy; {new Date().getFullYear()} Heard Again. A sanctuary for identity.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
              <Link href="/privacy" style={{ textDecoration: 'none' }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'secondary.main',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  Privacy Policy
                </Typography>
              </Link>
              <Link href="/terms" style={{ textDecoration: 'none' }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'secondary.main',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  Terms of Service
                </Typography>
              </Link>
              <Link href="/#faq" style={{ textDecoration: 'none' }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'secondary.main',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  FAQ
                </Typography>
              </Link>
              <Link href="/contact" style={{ textDecoration: 'none' }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'secondary.main',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  Contact Us
                </Typography>
              </Link>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  )
}


export async function getServerSideProps() { return { props: {} } }

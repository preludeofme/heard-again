import { Box, Typography } from '@mui/material'
import { PostLink } from './post-link'

export const meta = {
  slug: 'self-hosted-vs-hosted-family-archive' as const,
  title: 'Self-Hosted or Hosted? An Honest Answer About Your Family Archive',
  date: '2026-10-04',
  excerpt:
    'Heard Again is open source, so you can run it yourself for free. Here is a straight comparison of what self-hosting really costs you in hardware, time, and risk — and when paying us is the better call.',
  tags: ['self-hosting', 'open source', 'data sovereignty', 'digital legacy', 'privacy'],
  author: {
    name: 'Ryan Buck',
    bio: 'Founder of Heard Again. Helping families preserve the voices and stories that matter most.',
  },
  readTime: '8 min read',
}

export function BlogContent() {
  return (
    <Box component="article">
      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Heard Again is open source. You can download it, run it on your own machine, and never pay us
        a cent. That is not a loophole in our business model — it is the point. We wrote about
        why in{' '}
        <PostLink href="/blog/why-open-source-matters-for-family-memories">
          why open source matters for your family&apos;s digital legacy
        </PostLink>
        , and nothing in this post walks that back.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        But &ldquo;you can self-host it&rdquo; is not the same as &ldquo;you should self-host it.&rdquo;
        Most comparison posts written by a company that sells hosting are quietly rigged. This one
        tries not to be. Below is what each option actually asks of you, with real numbers, so you can
        pick the one that fits your household instead of the one that fits our revenue.
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        The Short Version
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        <strong>Self-host if</strong> you already run a home server, you are comfortable with Docker
        and backups, and the idea of your family&apos;s recordings living on someone else&apos;s
        hardware bothers you more than the maintenance will.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        <strong>Let us host it if</strong> the person in your family who cares most about these
        recordings is not the person who would be maintaining the server — or if that is the same
        person and they already have enough to do.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        That is genuinely the whole decision. The rest of this post is the detail behind it.
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        What Self-Hosting Actually Needs
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        There are two very different tiers here, and conflating them is how people end up
        disappointed.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        <strong>The archive on its own</strong> — photos, documents, audio files, the family tree,
        sharing and consent controls — is modest. Four CPU cores, 8&nbsp;GB of RAM, 20&nbsp;GB of free
        disk to start, and Docker. That runs comfortably on a mid-range mini PC, an old desktop, or a
        decent NAS. If this is all you want, self-hosting is a reasonable weekend project.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        <strong>Voice cloning and narration are a different animal.</strong> Generating speech in a
        relative&apos;s voice runs a text-to-speech model locally, and that wants eight or more CPU
        cores, 32&nbsp;GB of RAM, an NVIDIA GPU with 24&nbsp;GB of VRAM — an RTX 3090 or 4090 class
        card — and another 50&nbsp;GB of disk for models and generated audio. That is not a casual
        requirement. A used 3090 is still several hundred dollars, and it will draw real power
        whenever it works.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        There is a middle path: run the archive locally and point the voice features at a cloud
        endpoint, so you keep your files on your own disk and rent the GPU only when you generate
        something. Heard Again supports that split directly — you choose local, cloud, or hybrid for
        compute and for data separately when you register a self-hosted instance.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Worth saying before you agonise over it: whichever side you land on, you are not locking the
        data in. The tree exports to GEDCOM, which every genealogy program reads, and the audio
        exports as ordinary files. The one thing that does not travel cleanly is the link between the
        two — GEDCOM carries people, not recordings — so if you expect to move between setups, read{' '}
        <PostLink href="/blog/gedcom-import-with-audio">
          what survives a GEDCOM import and what you have to reattach
        </PostLink>{' '}
        before you build a filing habit you will have to undo.
      </Typography>

      <Box
        sx={{
          borderLeft: '4px solid #16334a',
          pl: 3,
          py: 2,
          my: 4,
          backgroundColor: '#fcf9f4',
          borderRadius: '0 8px 8px 0',
        }}
      >
        <Typography
          variant="body1"
          sx={{ color: '#16334a', fontStyle: 'italic', fontSize: '1.1rem', lineHeight: 1.7 }}
        >
          &ldquo;Self-hosting is free in money and expensive in attention. Hosting is the
          reverse.&rdquo;
        </Typography>
      </Box>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        The Cost Nobody Prices In
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        The hardware is the easy part to budget. The hard part is the standing commitment. A
        self-hosted archive needs someone to apply updates, watch the disk fill up, renew
        certificates, and — above all — verify that the backups restore. Not that backups{' '}
        <em>run</em>. That they <em>restore</em>. An untested backup is a rumour.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Then there is the question most home-server guides skip: what happens to this machine when
        you are not able to look after it any more? A family archive is meant to outlive the person
        who built it. If the recordings live on a box in your basement, and only you know the disk
        layout and the admin password, you have built a single point of failure with your family&apos;s
        memories inside it. The{' '}
        <PostLink href="/blog/how-to-preserve-family-memories-digitally">
          practical rules for preserving family memories digitally
        </PostLink>{' '}
        — more than one copy, in more than one place, labelled so a stranger could understand them —
        apply to self-hosters most of all, because nobody else is applying them for you.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        None of this is an argument against self-hosting. Plenty of people run exactly this kind of
        setup well. It is an argument for being honest with yourself about whether you are one of
        them, before the archive matters.
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        What You Give Up by Paying Us
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Fairness cuts both ways, so here is the honest list. On a hosted plan, your files sit on our
        infrastructure rather than yours. You are trusting our access controls and our operational
        discipline. You are accepting a storage allowance instead of &ldquo;however big a disk I feel
        like buying.&rdquo; And you are taking on a recurring bill, which is a different kind of
        commitment than a one-off hardware purchase.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        What stays the same either way: the software is the same software, the consent controls are
        the same controls, and your data is exportable. Because the project is open source, a hosted
        plan is not a trapdoor. If you outgrow us or stop trusting us, you can take the export and
        run the same stack yourself. That is the part that should make paying us feel safe rather than
        binding.
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        When Paying Is Simply the Right Answer
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Here is the plain reason to pay, with no marketing on it. The recordings you most want to keep
        are usually the ones you have the least time to look after — because the reason they are
        urgent is that someone is ageing, or ill, or you have just found a box of tapes and the
        family is already asking questions. Standing up a server is the wrong task to take on in that
        week. A hosted plan starts at <strong>$4.99 a month</strong> for storage and sharing with no
        AI features, and <strong>$9.99</strong> if you want voice generation included — which is less
        than the electricity bill on a 24&nbsp;GB GPU, let alone the card. You can{' '}
        <PostLink href="/#pricing">compare the plans on the pricing page</PostLink>. You are buying
        the backups, the updates, and someone to email when it breaks.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        And you can change your mind later. Start hosted while the recording matters most, export and
        self-host once things calm down. Or run your own instance and keep a hosted copy as the
        off-site backup you were never going to get around to building. Those are both sensible.
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        Decide the Hosting Later, Record Today
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        One last thing, and it is the most important paragraph here. This whole decision is reversible.
        The conversation you have not recorded yet is not. If you are weighing hosting options while
        there is a relative whose voice you have never captured, you are optimising the wrong step.
        Go{' '}
        <PostLink href="/blog/record-grandparents-voices-before-stories-go-quiet">
          record the conversation on your phone
        </PostLink>{' '}
        first. Sort out where it lives afterwards. The file can be moved. The afternoon cannot be
        rescheduled.
      </Typography>
    </Box>
  )
}

export const SelfHostedVsHostedPost = {
  meta,
  content: BlogContent,
} as const

import { Box, Typography } from '@mui/material'
import { PostLink } from './post-link'

export const meta = {
  slug: 'how-to-clone-a-deceased-relatives-voice' as const,
  title: "How to Clone a Deceased Relative's Voice — and the Questions to Answer First",
  date: '2026-10-26',
  excerpt:
    'Voice cloning from an old recording is now technically straightforward. This is an honest guide to how it works, what audio you need, who in the family should be asked, and the cases where the right answer is not to do it.',
  tags: ['voice cloning', 'AI ethics', 'consent', 'family voices', 'legacy'],
  author: {
    name: 'Ryan Buck',
    bio: 'Founder of Heard Again. Helping families preserve the voices and stories that matter most.',
  },
  readTime: '9 min read',
}

export function BlogContent() {
  return (
    <Box component="article">
      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        People search for this quietly. Usually within a year of losing someone, usually after finding
        a voicemail they cannot bring themselves to delete. The question is simple and it is not
        morbid: there is a recording of a voice I loved, and the technology apparently exists, so can I
        hear them say something again?
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Technically, yes. It has got much easier in the last few years, and this post explains how it
        actually works. But I build this software for a living, and I would be doing you a disservice
        if I handed over the instructions without the part that matters more — which is deciding
        whether to, and who gets a say.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        So: the questions first, then the method.
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        The Consent Problem You Cannot Solve
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Start with the hardest fact. The one person whose permission matters most cannot give it.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        That is not a reason to never proceed, but it does change what you are doing. You are not
        getting consent; you are making a judgement on someone&apos;s behalf. The honest standard is
        not &ldquo;would this comfort me?&rdquo; but &ldquo;would they have been alright with
        this?&rdquo; Those are different questions and only the second one is about them.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Some of the time you will have real evidence. A grandparent who loved gadgets and would have
        found it hilarious. A parent who was private, disliked being photographed, and would have hated
        it. Sometimes you genuinely have no idea — and in that case, the fact that you cannot answer it
        is itself information. Our fuller argument on this is in{' '}
        <PostLink href="/blog/ai-voice-cloning-ethics-family-consent">
          AI voice cloning and your family: ethics, consent, and what you should know
        </PostLink>
        , and it is worth reading before you upload anything.
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        Ask the Rest of the Family Before, Not After
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        This is the practical mistake I see most often. Someone makes a voice clone privately, as a
        personal comfort, then plays it at a family gathering as a surprise. It very often does not go
        the way they hoped.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Grief is not synchronised. A sibling eighteen months out and a widow four months out are in
        completely different places, and a synthesised voice can land as a gift for one person and a
        violation for another. Neither reaction is wrong. But one of them is avoidable by asking first.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Tell the people closest to them what you are considering, before you build it. Give them a
        clear way to say no, or to say &ldquo;not yet,&rdquo; without having to argue for it. And treat
        a no as a no — including a no that arrives after you have already made it. &ldquo;I have
        already done the work&rdquo; is not a reason for someone else to have to hear it.
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
          &ldquo;You are not getting consent. You are making a judgement on someone&apos;s behalf —
          and the honest test is whether they would have been alright with it, not whether it would
          comfort you.&rdquo;
        </Typography>
      </Box>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        Decide What It Is For
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Write down, in one sentence, what you want the clone to say and why. The answer tells you a
        great deal.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Uses that tend to sit well with families: narrating letters or a memoir the person actually
        wrote, so their written words arrive in their own voice. Reading a children&apos;s book for a
        grandchild who was born too late to meet them. Providing the voice for a family story that was
        theirs to tell. In each case the words are genuinely theirs, or clearly presented as not being
        theirs.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Uses that tend to cause harm: putting opinions in their mouth, especially about living family
        members or anything contested. Having them &ldquo;speak&rdquo; about their own death.
        Generating new reassurance — a voice telling you it is alright, or that it forgives you — for
        something that was never resolved while they were alive. That last one is the most tempting and
        the most damaging, because it answers a need the real person never got the chance to answer, and
        it tends to stall grief rather than ease it.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        One more plain thing: a voice clone is not a bereavement treatment, and this post is not
        clinical advice. If you are turning to it because the loss is unmanageable rather than because
        you have a specific thing you want narrated, a grief counsellor will do more for you than any
        model will. That is not a brush-off. It is the most useful sentence in this article.
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        What Audio You Actually Need
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        If you have decided to go ahead, the material matters more than the tool. Modern voice cloning
        works from a reference recording, and the quality of the result tracks the quality of that
        reference almost exactly.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        You are looking for <strong>clean, continuous speech from one speaker</strong>. A few
        uninterrupted minutes of someone talking normally beats an hour of a noisy family dinner. The
        things that wreck a clone are background music, a television, several people talking over each
        other, heavy phone-line compression, and the person laughing or shouting rather than speaking.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        In practice, good sources are: a recorded interview, a long voicemail, a speech at a wedding
        where they were miked, a digitised cassette, or a video where they talk to camera at length.
        Extract the audio, then trim it down to the cleanest continuous stretch you can find rather
        than feeding in everything you have.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        If your best source is an old tape, digitise it properly before you do anything else — our{' '}
        <PostLink href="/blog/restore-old-cassette-recording-family-member">
          guide to restoring an old cassette recording
        </PostLink>{' '}
        covers capturing it once at full quality and cleaning it up without flattening the voice. And
        resist over-processing here especially: aggressive noise reduction strips out exactly the
        breathiness and texture that make a clone sound like a person.
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        How the Process Works
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        The mechanics are not complicated. In Heard Again, you upload the reference audio as an asset,
        create a voice profile linked to the person in your family tree, and record the consent
        decision alongside it — who made the call, what the attestation says, and separate switches for
        whether generation is permitted, whether the audio may be processed in the cloud, and whether
        the result may be shared. Those are stored as a record, not a checkbox you clicked once, and
        consent can be revoked later, which stops further generation.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        From there you type the text you want narrated, pick a delivery style — warm, gentle, excited,
        nostalgic — and generate. Each generation is a job you can see, and the output is a file
        attached to that person rather than something that vanishes into a chat window.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Two design choices worth naming, because they are the ones I would want to know about as a
        user. The reference recording is kept as the source of the profile, so you can always see what
        a clone was built from. And generated audio is tracked as generated — we are not interested in
        building a product where a family cannot tell, in ten years, which recordings were real.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        You can also run all of this on your own hardware. It is open source, and local voice
        generation needs a reasonably serious GPU — the trade-offs are laid out in{' '}
        <PostLink href="/blog/self-hosted-vs-hosted-family-archive">
          our honest comparison of self-hosting and hosted plans
        </PostLink>
        .
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        Label It, Every Time
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Whatever you generate, mark it as synthesised. In the filename, in the note beside it, and out
        loud before you play it to anyone.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        This is not a legal formality, it is about the archive you are leaving. Your family&apos;s
        collection will outlive your memory of which files you made. If a great-grandchild cannot tell
        the difference between a recording of their ancestor and a sentence a model produced in 2026,
        you have contaminated the real recordings — and the real ones are the irreplaceable part.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Be careful about where synthetic audio goes, too. A convincing clone of a family
        member&apos;s voice is exactly the material used in phone scams against relatives. Keep it
        inside the family, under your own access controls, and off public platforms.
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        Where to Keep It
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        The reference recording, the consent record, and anything you generate belong together,
        attached to the person they concern. Scattered across a phone, a laptop, and a cloud drive,
        they lose the context that makes them meaningful and the controls that make them safe.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        The plain reason to pay: the original recording of a person who has died is a file that cannot
        be replaced, and consent decisions about a voice are not something you want living in a text
        thread. A hosted plan starts at <strong>$4.99 a month</strong> for storage, sharing, and
        consent tools, and <strong>$9.99</strong> if you want voice generation included — with managed
        backups, so the irreplaceable source audio is not sitting on one laptop. You can{' '}
        <PostLink href="/#pricing">compare the plans on the pricing page</PostLink>.
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        The Better Version of This Question
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Almost everyone who reaches this page is working from too little audio. Thirty seconds of
        voicemail. One video where they are mostly off-camera. The clone is a workaround for a shortage
        that was created years earlier, when nobody thought to press record.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        If there is anyone still living whose voice you would one day want, that is the thing to act on
        this week — and it is a far better outcome than anything on this page.{' '}
        <PostLink href="/blog/preserve-family-voices-before-its-too-late">
          Preserving family voices before it is too late
        </PostLink>{' '}
        makes the case, and{' '}
        <PostLink href="/blog/record-grandparents-voices-before-stories-go-quiet">
          the practical guide to recording your grandparents
        </PostLink>{' '}
        has the questions to ask. A real recording of someone saying something they chose to say will
        always be worth more than the most convincing imitation of it.
      </Typography>
    </Box>
  )
}

export const CloneDeceasedRelativeVoicePost = {
  meta,
  content: BlogContent,
} as const

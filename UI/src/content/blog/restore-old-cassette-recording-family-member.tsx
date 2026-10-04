import { Box, Typography } from '@mui/material'
import { PostLink } from './post-link'

export const meta = {
  slug: 'restore-old-cassette-recording-family-member' as const,
  title: "How to Restore an Old Cassette Recording of a Family Member",
  date: '2026-10-19',
  excerpt:
    'A step-by-step guide to rescuing a cassette of a relative speaking — how to play it safely, digitise it once and properly, clean it up without destroying the voice, and store it so this is the last time you have to do it.',
  tags: ['cassette', 'audio restoration', 'digital preservation', 'family voices', 'oral history'],
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
        Somebody in your family has a shoebox with a cassette in it. Maybe it is a labelled interview,
        maybe it is an unmarked tape that turned up when a house was cleared. Either way, there is a
        voice on it, the tape is thirty or forty years old, and you would like to hear it again without
        wrecking it.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        This is a doable afternoon project. It is also a project with one unforgiving rule: the tape
        gets a limited number of safe plays, so you want the first proper play to be the one you are
        recording. Here is the order that protects the original.
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        First, Understand What You Are Working With
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Cassette tape is a thin plastic ribbon with a magnetic coating. Two things go wrong with age.
        The binder holding the coating to the ribbon can absorb moisture and go sticky, which makes the
        tape squeal and drag. And the tape can set into its wound shape, so the layers print a faint
        echo of themselves onto each other. Neither is usually fatal, but both get worse with heat,
        damp, and time.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        The practical consequence: do not assume you have another decade to get around to this. A tape
        stored in a loft or a garage has had a harder life than one in a wardrobe. If the box has been
        somewhere hot, move it somewhere cool and dry today, and schedule the digitising rather than
        intending it.
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        Before You Press Play
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        <strong>Look at the tape in the window.</strong> Hold the cassette up. If the tape looks
        slack, wind it gently taut with a pencil in the hub — a slack tape is the one that gets eaten.
        If you can see visible mould, a crease, or a snapped end, stop and consider a professional
        transfer service. A bad first play on a damaged tape can destroy the only copy of a voice. That
        is one of the few situations where paying a specialist is obviously correct.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        <strong>Clean the player, not the tape.</strong> Most audible problems on a first attempt are
        the machine&apos;s fault, not the tape&apos;s. Clean the heads, the pinch roller, and the
        capstan with isopropyl alcohol on a cotton bud, and let them dry fully. Muffled, lifeless
        playback is nearly always a dirty head. Do not apply anything wet to the tape itself.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        <strong>Use the best deck you can borrow.</strong> A proper tape deck with line-out beats a
        portable player with a headphone socket, and both beat a cheap USB cassette converter. If you
        only have the cheap converter, you can still get a usable result — just know that the
        limitation is the hardware, and that a better transfer later is possible if you keep the tape.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        <strong>Fast-forward and rewind once, fully, before recording.</strong> One full pass in each
        direction helps re-tension an old wind and reduces squeal on the real play. Do this with the
        deck, not by hand.
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
          &ldquo;The tape has a limited number of safe plays left. Make sure the first good one is the
          one you are recording.&rdquo;
        </Typography>
      </Box>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        Capture It Once, Properly
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Run the deck&apos;s line-out into a computer or audio interface and record with free software
        such as Audacity. Record at <strong>48&nbsp;kHz, 24-bit, to WAV</strong>. Not MP3. This file is
        your master, and you only want to make it once — compression is a decision you can always
        apply later and never undo.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Set your levels so the loudest moments peak somewhere around &minus;6&nbsp;dB. Leaving
        headroom is deliberate: a recording that is a bit quiet can be raised, while one that clipped
        has lost information permanently. Old tapes are also uneven, so a passage can be much louder
        than the one before it.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        <strong>Record the whole side in one unbroken pass, including the silence.</strong> Do not stop
        and start to skip quiet stretches. The gaps are where unlabelled material hides — a second
        conversation recorded over the end of the tape, someone talking in another room, a few seconds
        of a voice you were not expecting. Capture everything, then split it afterwards. Do both sides,
        even the one you were told is blank.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        When the pass finishes, <strong>copy that WAV somewhere else immediately</strong>, before you
        touch it. Everything from here happens on duplicates.
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        Cleaning Up Without Ruining the Voice
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        This is where most restorations go wrong, and the error is always the same: doing too much. Tape
        hiss is annoying, and the tools that remove it are powerful enough to remove the breath and
        warmth of the speaker along with it. An over-processed voice sounds thin, watery, and slightly
        robotic — and the family will hear it instantly, even if they cannot name what changed.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Work in this order, listening on headphones, and stop at the first point where it sounds
        acceptable:
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        <strong>1. Fix the speed if it is wrong.</strong> If the voice sounds noticeably too high or
        low — someone in the family will tell you &ldquo;that is not how she sounded&rdquo; — adjust
        playback speed before anything else. A few percent is usually enough.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        <strong>2. Remove rumble, not air.</strong> A gentle high-pass filter around 60–80&nbsp;Hz
        takes out mains hum and handling thumps without touching speech.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        <strong>3. Reduce hiss conservatively.</strong> Sample a few seconds of tape with no speech as
        your noise profile, then apply the mildest setting that helps. Then back it off further. You
        are aiming to make the hiss recede, not disappear. Residual hiss sounds like an old tape;
        over-reduced audio sounds like a machine.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        <strong>4. Even out the volume last,</strong> and lightly. A little compression helps when the
        speaker drifts away from the microphone. A lot of compression makes every cough as loud as
        every word.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Then do the test that actually matters: play the cleaned version and the raw master to someone
        who knew the person. Ask which one sounds more like them. It is not always the cleaner one,
        and that answer is the one to trust. Keep both files regardless.
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        Label It While You Still Know
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        You have the context in your head right now — whose voice it is, roughly when it was recorded,
        who else is in the room, which relative owned the tape. In two years you will not. Write it
        down today.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Name files so a stranger could understand them:{' '}
        <code>nan-hughes-interview-side-a-raw-1987.wav</code> and{' '}
        <code>nan-hughes-interview-side-a-cleaned-1987.wav</code>. Alongside them, keep a short note:
        who is speaking, the date as precisely as you can manage, where the tape came from, and
        anything you noticed during the transfer. If there are passages you could not make out, note
        the timestamps — a relative listening later may well recognise what you could not.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Keep the physical cassette. Do not throw it out because you have a digital copy. Better decks
        and better software exist in the future, and the tape is the only thing a future transfer can
        start from. The wider rules for making digital copies last are in{' '}
        <PostLink href="/blog/how-to-preserve-family-memories-digitally">
          how to preserve family memories digitally
        </PostLink>{' '}
        — more than one copy, in more than one place, in a format that will still open.
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        A Word on What You Might Hear
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Worth saying plainly, because people are often caught out by it: hearing a voice you have not
        heard in years can hit much harder than you expect. The technical work is absorbing enough that
        you can forget what you are actually about to listen to, and then it arrives all at once in the
        middle of a job you thought was about cables and sample rates.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        There is no right way to handle that. Some people want to do the first listen alone. Some would
        rather have someone sitting with them. Some stop halfway and come back a week later, and the
        tape waits perfectly well. If the recording is of someone you have lost, the only real advice
        is to give yourself permission to do this slowly, and to not be surprised by your own reaction.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        It is also worth deciding, before you share it, who in the family would want to hear it and who
        might not want it arriving unannounced in a group chat. Sending it with a sentence of warning
        costs nothing.
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        Where the Restored File Should Live
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        A rescued recording sitting in a folder called <code>Downloads</code> on one laptop is a
        recording you have rescued from a tape and left in a different kind of danger. Put it somewhere
        it is attached to the person it belongs to, where the rest of the family can hear it, and where
        it is backed up without anyone having to remember to do so.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        If you already keep the family tree in a genealogy program, that is the shortest route to
        having a person to attach it to — export the tree and import it, and Nan Hughes already exists
        with her dates and her parents, so the file has somewhere to go. The one thing the export will
        not bring with it is the audio itself;{' '}
        <PostLink href="/blog/gedcom-import-with-audio">
          what a GEDCOM import does and does not carry
        </PostLink>{' '}
        covers why, and how the recordings get attached afterwards.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Heard Again is open source and you can run it on your own hardware for free if you want to. The
        plain reason to pay for hosting instead: you have just spent an afternoon producing a file that
        cannot be produced again, and this is the wrong file to be your only copy on your only disk. A
        hosted plan starts at <strong>$4.99 a month</strong> and includes managed backups, family
        sharing so other relatives can listen and add their own context, and the consent controls that
        let you decide what gets shared and with whom. You can{' '}
        <PostLink href="/#pricing">compare the plans on the pricing page</PostLink>.
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        And the Tapes Nobody Made
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Restoring a cassette teaches an uncomfortable lesson, which is how few of them there are. One
        tape, for a whole person. Whoever pressed record in 1987 gave you something nobody else in the
        family can give you now, and they probably did it casually.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        You are in that position today for the relatives who are still here. The phone in your pocket is
        a better recorder than that deck ever was, and it takes a willingness to ask.{' '}
        <PostLink href="/blog/record-grandparents-voices-before-stories-go-quiet">
          The guide to recording your grandparents
        </PostLink>{' '}
        covers how to ask without making it strange and which questions actually open people up. Do
        that this month, and nobody has to restore anything in forty years&apos; time.
      </Typography>
    </Box>
  )
}

export const RestoreCassetteRecordingPost = {
  meta,
  content: BlogContent,
} as const

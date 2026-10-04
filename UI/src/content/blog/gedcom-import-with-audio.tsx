import { Box, Typography } from '@mui/material'
import { PostLink } from './post-link'

export const meta = {
  slug: 'gedcom-import-with-audio' as const,
  title: "GEDCOM Import With Audio: What Transfers, What Doesn't, and How to Attach Recordings",
  date: '2026-10-12',
  excerpt:
    'GEDCOM moves names, dates, places, and relationships. It does not carry your audio. Here is what actually survives an import, and the practical way to get recordings attached to the right people afterwards.',
  tags: ['GEDCOM', 'genealogy', 'family tree', 'voice recording', 'digital preservation'],
  author: {
    name: 'Ryan Buck',
    bio: 'Founder of Heard Again. Helping families preserve the voices and stories that matter most.',
  },
  readTime: '7 min read',
}

export function BlogContent() {
  return (
    <Box component="article">
      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        If you have spent years in Ancestry, FamilySearch, Gramps, or Family Tree Maker, your tree
        almost certainly exports as a GEDCOM file. And if you have also collected recordings —
        interviews, voicemails, digitised tapes — the obvious question is whether they come along for
        the ride.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        The short answer is no, and it is worth understanding why, because it changes how you plan the
        move.
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        GEDCOM Is a Text Format, Not a Container
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        A GEDCOM file is plain text. Open one and you will see individuals, families, names, birth and
        death events, places, and the links between people. It is a genuinely useful standard and the
        reason you are not locked into any one genealogy product.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        What it does not do is hold your media. The standard has a multimedia record that can point{' '}
        <em>at</em> a file — a path or a filename — but the audio itself stays outside the GEDCOM. So
        when you export, you typically get one of three things: a bare <code>.ged</code> file with no
        media references at all, a <code>.ged</code> with file paths that only made sense on the
        machine that wrote it, or a zip archive with a media folder beside the <code>.ged</code>.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Even in the best case, those pointers are brittle. Paths break, filenames get mangled by
        different operating systems, and different programs disagree about how to write the records in
        the first place. Any tool that promised to reliably reassemble your audio from a GEDCOM alone
        would be overpromising.
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
          &ldquo;GEDCOM carries the skeleton of a family. The voices are the part you have to carry
          yourself.&rdquo;
        </Typography>
      </Box>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        What a Heard Again Import Actually Does
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        In Heard Again, GEDCOM import is one tab in the Import Wizard. You upload the <code>.ged</code>
        {' '}file, and the import runs as a background job you can watch — it is not a
        hold-your-breath page refresh. It reads the individuals and families, creates or updates the
        matching people in your familyspace, and preserves the relationships between them. Place names
        found in the file are geocoded afterwards, so events land on a map rather than staying as free
        text.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Two details matter if you are importing into a tree that already exists. First, you can
        optionally link the imported records to a person you already have — useful when you are
        grafting a branch onto an existing tree rather than starting from scratch. Second, you can
        turn on deduplication, which compares the incoming people against your current records and
        produces a merge proposal rather than silently combining anyone. You review the matches, with
        a confidence score on each, and decide. Nothing in your existing tree is overwritten because a
        name happened to look similar.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        The import job reports what it did — how many individuals and families were parsed, how many
        records were created or updated — so you can sanity-check the result instead of guessing.
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        Getting the Audio In: The Order That Works
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Because audio travels separately, the reliable approach is to import the tree first and the
        recordings second. The tree gives you the people to attach things to.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        <strong>Step one: rename the files before you upload anything.</strong> This is the step people
        skip and regret. Do it while your old program is still open in front of you and you can still
        tell which recording is which. A name like{' '}
        <code>mary-okeefe-1931-emigration-interview-2019.mp3</code> survives any migration.{' '}
        <code>Recording_0412.m4a</code> survives nothing. If you have more than a handful of files,
        batch-rename them in a spreadsheet first.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        <strong>Step two: import the GEDCOM.</strong> Let the job finish and spot-check a few people
        you know well, especially anyone with an unusual name, a remarriage, or an adoption. Those are
        where GEDCOM exports most often go odd.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        <strong>Step three: bulk-upload the audio.</strong> The Import Wizard has a separate Bulk
        Audio tab that takes many files at once, so you are not uploading a hundred recordings
        one at a time. They land as assets in your familyspace, ready to be attached.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        <strong>Step four: attach each recording to its person and write the context down.</strong>{' '}
        Who is speaking, roughly when it was recorded, and one line about what it is. This is the only
        manual part of the process and it is also the part that gives the archive its value. A file
        attached to a named person with a sentence of context is a memory. The same file loose in a
        folder is a maintenance problem for whoever comes after you.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        If you are also moving photos and documents at the same time, the broader checklist in{' '}
        <PostLink href="/blog/how-to-preserve-family-memories-digitally">
          how to preserve family memories digitally
        </PostLink>{' '}
        covers naming, formats, and keeping redundant copies, and it applies to this migration almost
        line for line.
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        A Tree Full of Names and No Voices
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Here is what usually happens when someone finishes an import. They look at a tree with four
        hundred people in it, and audio attached to two of them. That is not a failure of the import.
        It is the honest state of most family archives: decades of careful research into names and
        dates, and almost no recordings of the people who are still here to be recorded.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        Treat the gap as a to-do list. Every living person on that tree is a recording you could still
        make this month. The{' '}
        <PostLink href="/blog/record-grandparents-voices-before-stories-go-quiet">
          guide to recording your grandparents
        </PostLink>{' '}
        has the questions that work and how to ask without making it awkward, and{' '}
        <PostLink href="/blog/preserve-family-voices-before-its-too-late">
          why family voices are worth preserving at all
        </PostLink>{' '}
        is the case for doing it before the calendar decides for you. Research can be done later by
        anyone. A voice can only be recorded by someone who is in the room.
      </Typography>

      <Typography
        variant="h2"
        sx={{ fontFamily: 'var(--font-newsreader), serif', color: '#16334a', mt: 4, mb: 2 }}
      >
        Doing This Without Standing Up a Server
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        You can run Heard Again yourself — it is open source, and a GEDCOM import plus a pile of audio
        files runs fine on modest hardware. If that is your preference, do it.
      </Typography>

      <Typography variant="body1" sx={{ color: '#546669', lineHeight: 1.8, mb: 2 }}>
        The plain reason to pay instead: an import like this is the moment your archive goes from
        scattered to consolidated, and that is exactly when you want backups you did not have to
        configure. A hosted plan starts at <strong>$4.99 a month</strong> for storage, sharing, and
        consent controls, with managed backups and updates included, and the family sharing that makes
        other relatives able to add their own recordings instead of emailing them to you. You can{' '}
        <PostLink href="/#pricing">see what each plan includes on the pricing page</PostLink>. Either
        way the software is the same — paying buys you someone else doing the operations.
      </Typography>
    </Box>
  )
}

export const GedcomImportWithAudioPost = {
  meta,
  content: BlogContent,
} as const

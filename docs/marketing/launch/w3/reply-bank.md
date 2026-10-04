# Reply bank — W3

Prepared answers so nothing has to be improvised at 1am on launch day or under pressure
in a genealogy thread. Edit the wording to sound like Ryan. Do not paste them twice in
the same thread.

Banned words everywhere: resurrect, reanimate, bring back, digital immortality, closure.

---

## Reddit — genealogy threads

**"What are you building?"**

> An open-source project called Heard Again. It's for recording and keeping family
> voices and stories — the recording itself, the transcript, and a place for the family
> to keep both. I'm still working out what people actually need, which is why I wanted
> to ask here rather than assume.

No link unless they ask for one.

**"Link?" / "Where can I find it?"**

> Site is heardagain.com, code is at github.com/preludeofme/heard-again. It's MIT, so
> you can run the whole thing on your own machine for free if you'd rather not involve
> me at all.

**"So you're advertising."**

> Fair hit — I did build it, and I should have said so up front. The question in the post
> is real, though, and I'll take the answers either way. Happy to delete if the mods
> prefer.

Say it once. Do not argue after that. If the thread turns, stop replying.

**"Isn't AI voice cloning of dead people ghoulish?"**

> Keeping a recording of what someone said is not the same act as making them say new
> things. We only clone from a sample the person recorded themselves, while they were
> alive, knowing what it was for. No consent, no voice. I'd rather drop the feature than
> get that wrong.

**"My relative won't let me record them."**

> Common, and usually it isn't about the recording. "Interview" makes people perform.
> Try asking about one specific thing instead — a photo, a house, a recipe — and ask if
> you can record so you don't lose the details. If they still say no, that's an answer,
> and it's theirs to give.

**"What gear should I use?"**

> Your phone. Genuinely. Indoors, away from a fridge or a TV, phone on the table between
> you rather than held. A $20 lavalier clip helps if you want one. The recording that
> exists beats the perfect one you kept meaning to set up.

**"How do I keep these files for 50 years?"**

> Keep an uncompressed master (WAV) and make compressed copies for sharing. Three copies,
> two kinds of storage, one off-site. Write the metadata into the filename — who, when,
> roughly what — because the sidecar file always gets separated from the audio eventually.

---

## ProductHunt comments

**"How is this different from StoryWorth / Remento / Ancestry?"**

> Those are mostly built around prompts and a printed book at the end, and your material
> lives on their servers. Heard Again is built around the audio, and it's open source —
> you can run the whole thing yourself and we never hold your family's recordings at all.
> If you like the book format, honestly StoryWorth is good at it. We're for people who
> want the archive.

**"Is it really open source or is it open-core?"**

> MIT, the whole application. The cloud plans pay for hosting, GPU time for voice
> synthesis, and support. There is no feature held back from the self-hosted build.

**"What happens to my data if you shut down?"**

> Export everything, any time, in standard formats — audio files and plain-text
> transcripts, not a proprietary blob. And the server you'd move to is the same code,
> free. That's most of why it's open source.

**"How hard is self-hosting?"**

> Docker Compose, Postgres, and a GPU only if you want voice synthesis. Everything else
> runs on a normal machine or a NAS. The README has the walkthrough; if you hit something
> confusing, open an issue — a confusing README is a bug.

**"What's the pricing?"**

> Free and unlimited if you self-host. Cloud starts at $4.99/month and goes to $39.99 for
> the family tier. Prices are on the landing page: heardagain.com/#pricing.
>
> Note that $4.99 Cloud Access Lite has no voice generation minutes — voice starts on
> Starter at $9.99.

Do **not** write `heardagain.com/pricing` in a reply yet. Checked 2026-10-04: that URL
returns `307 → /login?callbackUrl=%2Fpricing`, so it drops a stranger on a login form.
`heardagain.com/#pricing` returns 200 and the `id="pricing"` section is present in the
live HTML. A real `/pricing` page exists in the repo (commit `6b56a810`) but is **not
pushed**, so it is not deployed. Once it is live, swap this line back to the clean URL.

**"Why did you build this?"**

Point at the maker comment, don't repeat it in full. One line:

> Short version is in the maker comment above — I can't remember what my grandmother
> sounded like, and there's no recording anywhere that would fix that.

**Someone shares their own loss in a comment.**

Stop. Do not sell. Reply as a person:

> Thank you for telling me that. I'm sorry.

And nothing else, unless they asked a question.

---

## Escalate to Ryan, do not answer

- Anyone asking about using the product on a relative who has already died.
- Anyone describing a recent death.
- Legal questions: who owns a cloned voice, estate rights, consent after death.
- Press or podcast requests.
- Any accusation of harm, deception, or data misuse.

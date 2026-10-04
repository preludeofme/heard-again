# ProductHunt gallery — built and ready

Five images, 1270×760 PNG, in the order they should be uploaded.

| # | File | What it is | Source |
|---|---|---|---|
| 1 | `01-hero.png` | Wordmark, tagline, the three brand chips | Rebuilt to match `heardagain.com/og-image.png` |
| 2 | `02-why.png` | The reason the product exists | The live site's own hero photograph |
| 3 | `03-what-it-does.png` | Voice Lab, Scrapbook, Transcription | **Real screenshot** of heardagain.com |
| 4 | `04-open-source.png` | MIT licence, self-hosting, data ownership | **Real screenshot** of heardagain.com |
| 5 | `05-start.png` | Closing invitation, both URLs, honest pricing line | Built |

Images 3 and 4 are live screenshots taken from `https://www.heardagain.com/` on
2026-10-04, not mockups. Nothing in the gallery shows a feature the product does
not have, and nothing claims a user count or a testimonial.

Typography and palette come from the live site — Newsreader for display,
Manrope for body, navy `#0b2b45` on cream `#f8ebd6`, with the logo waveform
gradient as the footer rule on every frame. The set reads as one piece, and it
matches the site a visitor lands on.

---

## Gallery captions

ProductHunt shows a caption under each image. Paste these in order.

**1.** Heard Again — an open-source platform for preserving the voices and stories that matter most.

**2.** Record the stories you'll want to hear again — while the people who remember them are still here to explain them.

**3.** A private voice lab, a family scrapbook, and a transcription pipeline, in one archive linked to your family tree.

**4.** Fully open source under the MIT licence. Inspect the code, run it on your own server, or use a cloud plan from $4.99/month.

**5.** Start your family archive this week. Free to self-host, open source, consent-first.

---

## Photography licence

`src/photo-family-sunset.jpg` is the Unsplash photograph already in use as the
hero image on heardagain.com. The Unsplash Licence permits commercial use
without attribution, and reusing the site's own hero keeps the listing and the
landing page visually continuous. No image was bought and nothing was spent.

---

## Rebuilding

```bash
node docs/marketing/launch/w3/producthunt-gallery/build.mjs
```

Needs `/usr/bin/chromium-browser` and network access for Google Fonts. Edit the
templates in `build.mjs`, re-run, and the five PNGs are regenerated at exactly
1270×760. `src/` holds the photograph and the two screenshot crops.

To refresh the screenshots after a landing-page change, re-capture
`src/shot-features.png` and `src/shot-selfhosted.png` from the live site and
re-run the build.

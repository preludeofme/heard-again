# Heard Again — Image Asset Requirements & Generation Prompts

**File:** `docs/marketing/IMAGE_ASSET_REQUIREMENTS.md`
**Date:** July 2, 2026
**Platforms:** DALL-E 3 (ChatGPT/OpenAI) + ComfyUI (Flux / Stable Diffusion local)

---

## Overview

This document lists every image asset needed for the Heard Again marketing and advertising launch. Each asset includes:
1. **Purpose** — where it'll be used (Facebook, Google Ads, Instagram, Pinterest, landing page, etc.)
2. **Format specs** — size, orientation, resolution
3. **DALL-E 3 prompt** — optimized for ChatGPT/DALL-E (detailed, clean, safe for content policy)
4. **ComfyUI / Flux prompt** — optimized for local generation (shorter, more technical, SD/Flux style)

---

## Quick Reference: All Images Needed

| # | Asset Name | Format | Use Case | Platform |
|---|-----------|--------|----------|----------|
| 1 | **og-image.png** | 1200×630 | Social share preview | All social |
| 2 | **Hero — Generations at Table** | 1920×900 | Landing page hero (Variant B test) | Website |
| 3 | **Grandma's Music Box** | 1080×1080 | Instagram square ad | FB/IG Ads |
| 4 | **Family Tree with Voice** | 1000×1500 | Pinterest pin | Pinterest |
| 5 | **Letters You Can Hear** | 1200×628 | Facebook feed ad | FB Ads |
| 6 | **Stories at Sundown** | 1200×628 | Facebook feed ad | FB Ads |
| 7 | **Porch Swing — Golden Hour** | 1200×628 | Google Display ad | Google Ads |
| 8 | **Recipes That Remember** | 1000×1500 | Pinterest pin | Pinterest |
| 9 | **Voice Constellation** | 1080×1080 | Instagram square ad | IG Ads |
| 10 | **Pocket Watch** | 1200×628 | Facebook feed ad | FB Ads |
| 11 | **Card Catalog of Lives** | 1000×1500 | Pinterest pin | Pinterest |
| 12 | **Phonograph Encore** | 1080×1080 | Instagram square ad | IG Ads |
| 13 | **Google Display Banner** | 728×90 | Google Display Network banner | Google Ads |
| 14 | **Google Display Square** | 300×250 | Google Display Network | Google Ads |
| 15 | **Google Display Leaderboard** | 468×60 | Google Display Network | Google Ads |

---

## Asset 1: OG Image (Social Share Preview)

**Already created** — your ChatGPT-generated version at `/UI/public/og-image.png`. Update it if you want to tweak the design.

---

## Asset 2: Hero — Generations at Table

**Purpose:** Landing page hero image — candid family moment, warm, nostalgic, NOT stock-photo.
**Format:** 1920×900, wide landscape
**Color palette:** Warm amber, cream, soft teal backdrop, golden-hour light
**No:** Laptops, phones, staged smiles, corporate office vibes

### DALL-E 3 Prompt
> A warm, intentionally filmic photo of three generations gathered around a rustic wooden kitchen table. An elderly grandmother in her 80s is laughing mid-sentence, seated at the head of the table. A parent in their 40s sits beside her, holding a small vintage-looking microphone toward her. A child around 10 leans in, chin on hand, listening with rapt attention. Room is bathed in golden sunset light streaming through a nearby window. The scene feels candid and real — not posed, not staged. On the table: an open photo album, a teacup with steam, a single dried flower in a small vase. Warm wood tones, cream walls, soft amber light. No cell phones, no laptops, no modern electronics visible. The mood is joyful, intimate, and timeless. 1920×900.

### ComfyUI / Flux Prompt
> candid family portrait, three generations around wooden kitchen table, elderly grandmother laughing mid-sentence, parent holding vintage microphone, child leaning in listening, golden hour sunlight from window, rustic kitchen interior, warm amber and cream tones, photorealistic, filmic quality, natural lighting, shallow depth of field, no phones no laptops, joyful intimate mood, 1920x900 landscape

**Parameters:** CFG 3.5, Steps 25, Sampler: DPM++ 2M Karras

---

## Asset 3: Grandma's Music Box

**Purpose:** Instagram square ad (Concept 1 from the ad doc)
**Format:** 1080×1080 square

### DALL-E 3 Prompt
> An antique wooden music box sits open on a sunlit windowsill. The interior velvet lining is a soft dusty purple (#9C69AC). From inside the box, instead of a ballerina, a shimmering golden audio waveform rises upward like curling smoke. Dust motes dance in the afternoon sunlight around the golden waveform. The wood is dark polished mahogany with brass hinges. Soft white lace curtain in the background. Warm amber and cream tones dominate. No people. The scene evokes nostalgia, memory, and warmth — old technology meeting something magical. 1080×1080 square.

### ComfyUI / Flux Prompt
> antique wooden music box open on sunlit windowsill, dusty purple velvet interior, golden shimmering audio waveform rising like smoke from inside, dust motes dancing in light, dark mahogany wood, brass hinges, lace curtain background, warm amber and cream tones, macro detail, photorealistic, nostalgic mood, no people, 1080x1080

---

## Asset 4: Family Tree with Voice

**Purpose:** Pinterest vertical pin (Concept 2)
**Format:** 1000×1500 vertical

### DALL-E 3 Prompt
> A hand-illustrated family tree on aged parchment paper. The trunk and branches are drawn in warm brown ink. Each leaf on the tree is a tiny green audio waveform icon in sage green (#8EC384). At the branch junctions where different family members connect, small golden dots mark where their stories begin. A soft watercolor wash in sage green and cream fills the background. The tree has roots that spread across the bottom of the parchment, and each root tip has a tiny glowing audio icon. No people. Antique illustration style — think vintage botanical print meets family heirloom. 1000×1500 vertical.

### ComfyUI / Flux Prompt
> hand-drawn family tree illustration on aged parchment, warm brown ink, leaves as tiny sage green audio waveform icons, golden connection dots at branch junctions, watercolor wash background in sage and cream, roots with glowing audio tips, vintage botanical illustration style, family heirloom aesthetic, no people, 1000x1500

---

## Asset 5: Letters You Can Hear

**Purpose:** Facebook feed ad (Concept 3)
**Format:** 1200×628

### DALL-E 3 Prompt
> A pair of vintage worn-leather headphones rests on top of an aged handwritten letter on a rustic wooden desk. The letter is slightly yellowed, covered in elegant cursive handwriting. A dried lavender sprig lies beside the letter. Soft window light creates a warm glow. Purple-tinted (#9C69AC) shadows fall across the composition. The headphones are brown leather with gold-colored metal adjustments. The wood desk has a warm, well-worn patina. No people. The mood is intimate, nostalgic, and quiet — like finding a love letter in an attic. 1200×628 landscape.

### ComfyUI / Flux Prompt
> vintage leather headphones resting on aged handwritten letter, rustic wooden desk, yellowed paper with cursive handwriting, dried lavender sprig, soft window light, purple-tinted shadows, warm brown wood patina, no people, intimate nostalgic mood, photorealistic macro, 1200x628

---

## Asset 6: Stories at Sundown

**Purpose:** Facebook feed ad (Concept 4)
**Format:** 1200×628

### DALL-E 3 Prompt
> A wooden porch swing hangs empty on a wraparound veranda during the golden hour. An elderly hand with wrinkled skin and a gold wedding band rests on the swing's arm. On the seat beside the hand sits a cup of tea with a faint wisp of steam, next to a small vintage microphone on a short stand. Long golden shadows stretch across the wooden porch planks. The sky beyond is a gradient from warm amber sunset to deep teal (#3F6271). A large oak tree frames the scene in silhouette. Warm, nostalgic, bittersweet — the idea that someone just stepped away. 1200×628.

### ComfyUI / Flux Prompt
> empty wooden porch swing on veranda, golden hour sunset, elderly hand on swing arm, gold wedding band, teacup with steam beside vintage microphone on stand, long shadows on wood planks, amber to teal sky gradient, oak tree silhouette, warm nostalgic mood, photorealistic, 1200x628

---

## Asset 7: Google Display — Porch & Memories

**Purpose:** Google Display Network responsive ad (wider crop)
**Format:** 1200×628 (same scene, alternate crop/angle)

### DALL-E 3 Prompt
> Golden hour sunlight spills across an empty wooden porch swing on a wraparound veranda. In the foreground, a well-worn leather journal lies open on the swing seat, with elegant handwriting visible on one page. Beside it, a fountain pen rests in the crease. A soft purple and teal gradient sky fills the background. The scene is bathed in warm amber light. No people. The mood is contemplative, peaceful — the kind of evening that makes you want to call your grandmother. 1200×628.

### ComfyUI / Flux Prompt
> wooden porch swing with open leather journal, fountain pen, golden hour light, amber and teal gradient sky, wraparound veranda, no people, contemplative mood, warm nostalgic, photorealistic, 1200x628

---

## Asset 8: Recipes That Remember

**Purpose:** Pinterest vertical pin (Concept 5)
**Format:** 1000×1500 vertical

### DALL-E 3 Prompt
> Close-up of a rustic kitchen shelf holding mismatched glass spice jars with handwritten labels. One jar is pulled slightly forward from the others — its label reads "Grandma's Apple Pie — tap to hear the story" in delicate cursive script. Behind the jars, a faded recipe card is tucked into a well-worn cookbook. Warm light spills from a nearby window across the jars. A small purple (#9C69AC) waveform icon is printed below the label text. The palette is warm terracotta, cream, and sage green. No people. Cozy, intimate kitchen detail. 1000×1500 vertical.

### ComfyUI / Flux Prompt
> rustic kitchen shelf with glass spice jars, handwritten labels, one jar pulled forward labeled "Grandma's Apple Pie" with small purple waveform icon, faded recipe card in cookbook, warm window light, terracotta cream and sage palette, cozy kitchen detail, no people, macro shot, 1000x1500

---

## Asset 9: Voice Constellation

**Purpose:** Instagram square ad (Concept 6)
**Format:** 1080×1080 square

### DALL-E 3 Prompt
> A dark midnight sky seen from a hilltop looking upward. The stars are arranged in the shape of a human voice audio waveform, glowing in soft purple (#9C69AC) and teal (#3F6271) against the deep indigo night. A faint golden thread connects the brightest stars like a constellation map. At the bottom edge, silhouettes of pine trees frame the scene. No people visible — just the cosmic waveform above the treeline. The mood is awe-inspiring, peaceful, eternal. Stars scattered naturally throughout the rest of the sky. 1080×1080 square.

### ComfyUI / Flux Prompt
> night sky from hilltop, stars arranged as audio waveform constellation, glowing purple and teal, golden thread connecting stars, pine tree silhouettes at bottom, deep indigo sky, ethereal cosmic mood, no people, 1080x1080

---

## Asset 10: Pocket Watch (Time Told in Stories)

**Purpose:** Facebook feed ad (Concept 7)
**Format:** 1200×628

### DALL-E 3 Prompt
> An open vintage pocket watch rests on a worn leather armchair. Instead of traditional clock hands, a tiny golden audio waveform arcs between the 12 and 6 positions inside the watch face. The inner casing is engraved with a single name and a date in elegant script. Outside the watch, the waveform expands upward, fading into translucent golden threads against a soft cream and amber background. The watch chain drapes over the edge of the leather chair. No people. The mood is contemplative, timeless, intimate. 1200×628.

### ComfyUI / Flux Prompt
> open vintage pocket watch on leather armchair, golden audio waveform replacing clock hands, engraved inner casing with name and date, waveform expanding upward as translucent golden threads, watch chain over chair edge, cream and amber background, no people, timeless contemplative mood, photorealistic macro, 1200x628

---

## Asset 11: Card Catalog of Lives

**Purpose:** Pinterest vertical pin (Concept 9)
**Format:** 1000×1500 vertical

### DALL-E 3 Prompt
> A vintage wooden card catalog cabinet with many small brass-handled drawers fills the frame. One drawer is pulled open — inside, instead of index cards, there are tiny audio cassette tapes with handwritten paper labels: "Dad's Fishing Stories," "Mama's Lullabies," "Trip to the Coast 1978." The drawer's metal label holder reads "HEARD AGAIN" in embossed letters. A warm library lamp casts a soft pool of light on the open drawer. Rich dark wood tones, cream labels, brass hardware. No people. The mood is quiet, library-like, archival. 1000×1500 vertical.

### ComfyUI / Flux Prompt
> vintage wooden card catalog cabinet, open drawer with tiny audio cassette tapes with handwritten labels, "Dad's Fishing Stories" "Mama's Lullabies", brass label holder reads "HEARD AGAIN" in embossed letters, warm library lamp light, dark wood, cream labels, archival mood, no people, 1000x1500

---

## Asset 12: Phonograph Encore

**Purpose:** Instagram square ad (Concept 10)
**Format:** 1080×1080 square

### DALL-E 3 Prompt
> A vintage phonograph with a flared brass horn sits on an antique wooden side table. Instead of a traditional vinyl record on the turntable, a translucent disc glows with a soft violet-purple light (#9C69AC). A luminous purple and teal audio waveform spirals around the brass horn like an ethereal aura. A single dried violet flower is tucked into the brass rim. The room is dim except for the warm purple glow emanating from the phonograph, casting mysterious shadows. The setting is an intimate, slightly dark room — like a listening parlor from a bygone era. No people. The mood is magical, reverent, nostalgic. 1080×1080 square.

### ComfyUI / Flux Prompt
> vintage phonograph with flared brass horn on antique wooden table, glowing violet-purple translucent disc, luminous waveform spiraling around brass horn as aura, single dried violet in brass rim, dark room lit by purple glow, mysterious nostalgic mood, no people, photorealistic, 1080x1080

---

## Asset 13: Google Display Banner

**Purpose:** Google Display Network leaderboard banner
**Format:** 728×90 wide banner

### DALL-E 3 Prompt
> A horizontal banner, 728×90. On the left side, a small vintage microphone silhouette in gold. In the center, minimal text space. On the right, warm amber light fading into a soft gradient of purple (#9C69AC) to teal (#3F6271). Very simple, clean design — an abstract warm gradient background with subtle audio waveform lines in the brand colors. No people. The layout leaves generous negative space for Google ad copy overlay. Elegant, editorial style. 728×90.

### ComfyUI / Flux Prompt
> horizontal 728x90 banner, abstract warm gradient background, amber to purple to teal, subtle audio waveform lines as decorative element, vintage microphone silhouette on left in gold, clean editorial design, lots of negative space, brand colors, no text in image, 728x90

---

## Asset 14: Google Display Rectangle

**Purpose:** Google Display Network mid-page
**Format:** 300×250 rectangle

### DALL-E 3 Prompt
> A small square advertisement. Abstract warm cream background with a subtle gradient. In the center, a minimalist golden audio waveform icon (10 bars, gently varying heights) in the brand's teal (#3F6271) and purple (#9C69AC). Below the icon, subtle golden glow. Very clean, simple, editorial style. No people, no text in image. Professional, warm, modern. Leaves room for headline copy overlay. 300×250.

### ComfyUI / Flux Prompt
> 300x250 abstract ad background, warm cream gradient, minimalist golden and teal audio waveform centered, subtle purple glow, clean editorial style, no text, no people, brand colors, 300x250

---

## Asset 15: Google Display Leaderboard (Narrow)

**Purpose:** Google Display Network narrow banner
**Format:** 468×60

### DALL-E 3 Prompt
> A very wide, short banner at 468×60. Subtle warm amber and cream gradient background. A thin audio waveform in teal (#3F6271) and purple (#9C69AC) runs horizontally across the center of the banner as a decorative element. The waveform is low opacity, elegant, like a watermark. No people, no text in image. Leaves full room for Google ad copy. Clean brand presence. 468×60.

### ComfyUI / Flux Prompt
> 468x60 banner, warm amber gradient background, thin horizontal audio waveform in teal and purple as decorative element, low opacity elegant watermark style, no people, no text, clean brand presence, 468x60

---

## Summary: Quick Reference Table

| Asset | Format | Platform | DALL-E | ComfyUI |
|-------|--------|----------|--------|---------|
| OG Image (existing) | 1200×630 | All social | ✅ Done | ✅ Done |
| Generations at Table | 1920×900 | Landing page | ✅ Prompt | ✅ Prompt |
| Music Box Waveform | 1080×1080 | Instagram | ✅ Prompt | ✅ Prompt |
| Family Tree with Voice | 1000×1500 | Pinterest | ✅ Prompt | ✅ Prompt |
| Letters You Can Hear | 1200×628 | Facebook | ✅ Prompt | ✅ Prompt |
| Stories at Sundown | 1200×628 | Facebook | ✅ Prompt | ✅ Prompt |
| Porch & Journal | 1200×628 | Google Display | ✅ Prompt | ✅ Prompt |
| Recipes That Remember | 1000×1500 | Pinterest | ✅ Prompt | ✅ Prompt |
| Voice Constellation | 1080×1080 | Instagram | ✅ Prompt | ✅ Prompt |
| Pocket Watch | 1200×628 | Facebook | ✅ Prompt | ✅ Prompt |
| Card Catalog | 1000×1500 | Pinterest | ✅ Prompt | ✅ Prompt |
| Phonograph Encore | 1080×1080 | Instagram | ✅ Prompt | ✅ Prompt |
| Google Banner (wide) | 728×90 | Google Display | ✅ Prompt | ✅ Prompt |
| Google Rectangle | 300×250 | Google Display | ✅ Prompt | ✅ Prompt |
| Google Banner (narrow) | 468×60 | Google Display | ✅ Prompt | ✅ Prompt |

---

## Generation Workflow

### DALL-E 3 (ChatGPT)
1. Open ChatGPT (paid subscription)
2. Paste each DALL-E 3 prompt above into the chat
3. After generation, download the image
4. Save to `/home/trubuck-design/Projects/Personal/heard-again/UI/public/marketing/[asset-name].png`

### ComfyUI (Local)
1. Load your Flux or SDXL workflow in ComfyUI
2. Set width/height to match the asset specs
3. Paste the ComfyUI prompt as the positive prompt
4. Run generation
5. Save to the same marketing folder

### Naming Convention
Save all files to: `UI/public/marketing/` with these filenames:
- `hero-generations.png`
- `music-box-waveform.png`
- `family-tree-voice.png`
- `letters-you-can-hear.png`
- `stories-at-sundown.png`
- `porch-journal.png`
- `recipes-that-remember.png`
- `voice-constellation.png`
- `pocket-watch.png`
- `card-catalog.png`
- `phonograph-encore.png`
- `google-banner-728x90.png`
- `google-rectangle-300x250.png`
- `google-banner-468x60.png`

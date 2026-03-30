# Design System Strategy: The Digital Heirloom

## 1. Overview & Creative North Star: "The Living Archive"
This design system is built to transcend the "utility" phase of technology and move into the realm of "legacy." Our Creative North Star is **The Living Archive**. 

We are not building a voice recorder; we are building a sanctuary for identity. To achieve this, the UI must break away from the rigid, grid-locked "SaaS" look. We utilize **intentional asymmetry**, allowing elements to breathe with uneven but balanced margins. We embrace **tonal depth**, where surfaces feel like stacked sheets of heavy cotton paper rather than flat digital pixels. This is a "Warm Minimalism" that feels human, empathetic, and timeless.

---

## 2. Colors & Surface Architecture
The palette is rooted in the earth (creams and warm grays) to ground the high-tech nature of voice cloning in something organic.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning. Structural boundaries must be defined solely through background color shifts. Use `surface-container-low` (#f6f3ee) for large sections sitting on a `surface` (#fcf9f4) background. 

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. To create depth without "techy" shadows:
- **Base Layer:** `surface` (#fcf9f4)
- **Secondary Content Areas:** `surface-container-low` (#f6f3ee)
- **Interactive Cards:** `surface-container-lowest` (#ffffff)
- **Deep Inset Elements:** `surface-dim` (#dcdad5)

### The Glass & Gradient Rule
For floating elements (like music players or recording modals), use **Glassmorphism**. Apply `surface-container-lowest` at 80% opacity with a `24px` backdrop blur. 
- **Signature Textures:** For primary CTAs, do not use flat hex codes. Apply a subtle linear gradient from `primary` (#16334a) to `primary-container` (#2e4a62) at a 135-degree angle to provide a "soulful" luster.

---

## 3. Typography: The Editorial Voice
Our typography pairing balances the "Old World" authority of a serif with the modern clarity of a geometric sans.

- **Display & Headlines (Newsreader):** This refined serif carries the emotional weight of the brand. Use `display-lg` (3.5rem) for high-impact landing moments and `headline-md` (1.75rem) for story titles.
- **UI & Body (Manrope):** This sans-serif provides a clean, neutral counterpoint. Use `body-lg` (1rem) for legacy narratives and `label-md` (0.75rem) for technical metadata.
- **Hierarchy Note:** To achieve an editorial feel, increase line-height for body text to `1.6` and use generous `16` (5.5rem) or `20` (7rem) spacing between headline groups and body content.

---

## 4. Elevation & Depth
We eschew traditional "Material" shadows in favor of **Ambient Tonal Layering**.

- **The Layering Principle:** Depth is achieved by "stacking." A `surface-container-lowest` card placed on a `surface-container-low` background creates a natural lift.
- **Ambient Shadows:** If a floating effect is required (e.g., a "Create" button), use an extra-diffused shadow: `box-shadow: 0 10px 40px rgba(28, 28, 25, 0.06)`. The shadow color is a tinted version of `on-surface`, never pure black.
- **The "Ghost Border" Fallback:** If a boundary is strictly required for accessibility, use `outline-variant` (#c3c7cd) at **15% opacity**. Never use a 100% opaque border.

---

## 5. Components

### Buttons
- **Primary:** Gradient fill (`primary` to `primary-container`), white text, `xl` (1.5rem) roundedness. 
- **Secondary:** `secondary-container` (#d0e3e6) background with `on-secondary-container` (#546669) text.
- **Interaction:** On hover, shift the gradient opacity; do not use heavy "glow" effects.

### Cards & Lists
- **The Divider Ban:** Never use horizontal lines to separate list items. Use the spacing scale (`3` or `4`) to create separation or alternate background shades between `surface-container-lowest` and `surface-container`.
- **Legacy Cards:** Use `xl` (1.5rem) corner radius. These should feel like physical artifacts.

### Voice Waveform Inputs
- Avoid clinical, thin-line waveforms. Use rounded bars with `primary` (#16334a) coloring and `tertiary-fixed-dim` (#e0c29a) for the background track. It should look soft and tactile.

### Input Fields
- **Styling:** Use `surface-container-high` (#ebe8e3) for the input track with no border. Upon focus, transition the background to `surface-container-lowest` and add a "Ghost Border" at 20% opacity.

---

## 6. Do's and Don'ts

### Do:
- **Use Intentional Asymmetry:** If an image is on the left, let the text on the right sit slightly lower to create a relaxed, human rhythm.
- **Embrace Whitespace:** If a screen feels "full," use the next step up in the spacing scale (`10` or `12`).
- **Use "Tonal" Micro-interactions:** Buttons should gently change color (e.g., `surface-container-low` to `surface-container-high`) rather than abruptly jumping.

### Don't:
- **Don't Use Pure Black:** Use `on-surface` (#1c1c19) for all text to keep the "Warm Minimalism" vibe.
- **Don't Use Sharp Corners:** Every element must have at least a `DEFAULT` (0.5rem) radius to avoid looking "clinical."
- **Don't Use Standard Grids:** Avoid the "3-column card row" whenever possible. Try overlapping cards or varying widths to feel more like a scrap-book or heirloom archive.

---

## 7. Signature Spacing Scale
*Reference these values for all layout decisions:*
- **Structural Gaps (Sections):** `16` (5.5rem) or `20` (7rem).
- **Component Padding:** `4` (1.4rem) or `5` (1.7rem).
- **Tight Groupings (Label + Input):** `2` (0.7rem).
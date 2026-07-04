This file documents where to place the Heard Again logo throughout the app.

## Files with "Heard Again" text that should be replaced with logo+text

### Priority 1 — Public-facing brand touchpoints (logo image + text combo)

1. **UI/src/components/layout/PublicHeader.tsx** (line 88-101)
   - Current: `<Typography>Heard Again</Typography>` with Newsreader italic font
   - Replace with: logo image (nav-logo.png) stacked above "Heard Again" text
   - Use: Image = nav-logo.png at 120x32 + small typography text
   - This is the primary public header on landing/login/signup pages

2. **UI/src/components/layout/Layout.tsx** (line 234)
   - Current: "Heard Again" text in the app sidebar/header for logged-in users
   - Replace with: smaller logo + text combo
   - Use: Image = heard-again-logo-120.png at 120x32

3. **UI/src/components/pages/CreateAccountPage.tsx** (line 451)
   - Current: "Heard Again" text as brand header on signup page
   - Replace with: logo above "Heard Again"
   - Use: Image = nav-logo.png at 120x32

4. **UI/src/components/pages/LoginPage.tsx** (line 390)
   - Current: "Heard Again" text as brand header on login page
   - Replace with: logo above "Heard Again"

5. **UI/src/pages/forgot-password.tsx** (line 222)
   - Current: "Heard Again" text
   - Replace with: logo above "Heard Again"

6. **UI/src/components/pages/LandingPage.tsx** (line 739 in footer)
   - Current: "Heard Again" text in footer
   - Keep as text-only or add small logo

### Priority 2 — Footer and auth pages (text references only, no logo needed)

7. **UI/src/pages/terms.tsx** (line 141) - Footer text
8. **UI/src/pages/privacy.tsx** - Various text references
9. CreateAccountPage.tsx, LoginPage.tsx, forgot-password.tsx (line 457, 396, 228) - Copyright text

### Priority 3 — Page titles (keep text-only, these are <title> tags)
- chat.tsx, family-tree.tsx, favorites.tsx, etc.
- These are HTML <title> tags, keep as text.

## Implementation approach

For each replacement (Priority 1):
1. Add an `<Image>` component (next/image) or `<Box component="img">` tag
2. Stack logo above the "Heard Again" text 
3. Make the entire thing a clickable Link to /
4. Use the appropriate logo size from the pre-generated files:
   - PublicHeader: nav-logo.png (120x32) + text
   - Auth pages (CreateAccount/Login): heard-again-logo-120.png (120x32) + text  
   - Layout sidebar: heard-again-logo-120.png (120x32) + text

## Logo sizes available in UI/public/
- heard-again-logo-transparent.png (original/extracted - 1370x360)
- heard-again-logo-32.png (32x10 - favicon use)
- heard-again-logo-48.png (48x14 - tiny)
- heard-again-logo-64.png (64x18 - mobile)
- heard-again-logo-120.png (120x32 - nav/header standard)
- heard-again-logo-180.png (180x48 - larger displays)
- nav-logo.png (120x32 - optimized for nav)
- favicon.png (48x14 - favicon)
- og-image.png (1200x630 - social sharing)

## Misc Updates

[x] familyspace/new - when user clicks create new familyspace it routes to a 404 page
    [x] created /familyspace/new page with creation form and switch+redirect flow
    [x] feedback: I tested the new page/flow and it does create the new family space however it doesn't switch to it after you create it. once created it should automatically switch to the new family space. 
    [x] feedback: when clicking the new family from the dropdown in the header received an error "Failed to switch familyspace"
    [x] feedback: Need to ensure that with the new family space, the user is generated as the first member of the family for the family tree. 
[x] narrative timeline
    [x] moved text down (pt: 4 → pt: 10 / 80px) so it no longer overlaps the year glyph
[x] Recent users drop down shows recent users from other profiles/userspaces. It gives you a 404 error but it shouldn't even show them in the list
    [x] filter recentToShow against allMembers so cross-space entries are excluded
[x] Keepsake Drawer
    [x] changed wording to "Scanned letters, pictures, news articles, and more"
    [x] Upload on profile Memories tab now opens inline file picker with personId (no navigation away)
[x] profile page
    [x] voice signature "Create Voice Profile" link always shown when no voice profiles exist (regardless of bio)
    [x] bio shown as quote only when voice profiles exist
    [x] Need to update on the profile it shows "Timeline" and also "Narrative" which also needs filters for events, stories, milestones (similar to the family profile Legacy page)
[x] Legacy page / keepsakes
    [x] export zip excluded from document list via exportOutputs: { none: {} } filter in documents API
    [x] filter out familyspace-export-1778332017632.ged GED files and gedcom files

[x] Contribute 
    [x] "Record a Voice Memory" now routes to /stories/contribute?storyType=voice (with subjectId if person selected)
    [x] stories/contribute page reads storyType=voice param and defaults to audio recorder tab

[x] family search 
    [x] Unified MemberSwitcherFlyout used as single search component across the app
    [x] Replace the search component on the family tree with the new combined component.
        [x] Desktop toolbar: search icon opens MemberSwitcherFlyout (anchored to button)
        [x] Mobile: same search icon opens MemberSwitcherFlyout (replaces full-screen dialog)
        [x] onMemberSelect centers on node if visible, else sets as new tree root
    [x] Replace the search component on the stories contribute page with the new combined component.
        [x] "Who is this about?" screen uses MemberSwitcherFlyout flyout instead of FamilyMemberSelect
    [x] Header already uses MemberSwitcherFlyout natively — no change needed
    [x] feedback: The new combined member search component is not working on the header. it doesn't find any members when i start typing a name. it should find multiple family members for "Ryan" however it doesn't find any
[x] Need to create an Invite page to invitte a new member to the family space. should also allow for customization on their permissions so if it's just a family friend it's only ability is to create stories, and only see public/friends memories etc.  but family members can see everything
[x] Need to build out the schema to allow for users to select permissions on stories so it's public, family only, friends & family
    [x] Need to add the option to the ui on stories so you can set it when creating stories or editing stories
[x] Gedcom import 
    [x] Ensure that our schema and parsing works with v7 gedcom files. review /home/trubuck-design/Projects/Personal/heard-again/docs/archived-dev-docs/gedcom7-rc.pdf
    [x] Make sure notes/sources/etc that are not person specific info is logged appropriately such as stories/narratives etc. 
[x] Family Tree
    [x] Need to make a visual distinction between blood family and in laws. so that when looking at a large tree you can see who is actually blood family and who married in, especially when looking at a line that has a lot of members in the same line (i.e. 5 siblings with 5 spouses, the spouses should have a different line style or color to distinguish them from blood family.)
    [x] Expand button - "Load All" button with AccountTree icon that loads the entire familyspace tree (all members), not just the ancestor/descendant view

[ ] Timeline
    [x] Redesigned horizontal timeline layout — replaced large empty colored square with compact companion panel (person avatars + event type badge), alternating above/below the center dot
[x] PNG Export
    [x] Redesigned export to use Trigger.dev + server-side SVG generation (no Puppeteer, no RunPod required)
    [x] SVG is generated from the same layout algorithm the UI uses — exact same positions, tight bounding box, no extra whitespace
    [x] Sharp rasterizes SVG → PNG at 144 DPI (2× retina) using vector text for maximum legibility
    [x] Direct Prisma query in the task — no session cookie passing, no render URL, no browser overhead
    

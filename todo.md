## Misc Updates

[x] Update landing page for:
    [x] SEO (whatever would draw the most people for family history, legacy preservation, etc.) 
    [x] Add something about being open source
[x] integrate resend for sending invite emails, password resets, mfa, etc. 
[x] make the getting started collapsible
[x] Need to research some ways to get the runpod endpoint (or serverless pods) to start up faster and work more reliably
[x] add a create new voice on profile page in the voice signature component
[x] defect: on the profile page, clicking on a different family member begins to navigate to the family member, but then it is redirected or reloads the original page. If i remember we were having this issue before and it had to do with the global state around the selected profile. To change the person the user is viewing, we should be going to the global state for the selected person and changing it there and NOT just navigating to the new person's profile
[x] stories comment still shows only "Family Member" it should show "Ryan Buck (Family Member)" which is the user's person profile
[x] the heart/favorite doesn't save state when the user has favorited the story, the story shows that there was one person who favorited the story but it doesn't show that user has already favorited it
[x] the family tree in the profile does not render the profile avatar images
[x] the get started component "Share first memory" link should take you to the create story page not the contribute page

[x] family tree not creating initial user person node (only with more than one family tree created)
    - steps to recreate: create account, click create new family tree, fill out the family tree name, then go to family tree (you will not see the user's person node)
[x] recent person is still leaking from non-selected family trees
    - steps to recreate: log in to an account with multiple family trees, go to the family tree and open a profile or two, then change family trees and click the person selector and you will see the family members from another tree
[x] Invite family members button needs to take you to the members tab on family space admin
    [x] need to create a parameter routing for /familyspace/[familyid]/settings?tab=overview|members|settings|data
    [x] make sure invite family member goes to the members parameter route
[x] Replace the "Start your Living Legacy" with the new collapsible Get Started component. Do not need the duplicate component
[ ] add location lookup service (open source if possible) so that we can track specific locations and not just have free-form locations that could be "walmart parkinglot" or something like that.
    [ ] once we have locations fully enabled, we could add a map component to show where families have migrated over time with an animation and then a heatmap
    [ ] probably need to adjust the schema to allow for locations maybe gps coordinates 
    [ ] connect to google maps api for this (make sure location fields have an autocomplete functionality so it validates the entry). just use city/state nothing more complicated than that
    [ ] check the gedcom if there's already location data that we can use and import
    
[ ] Feature: Support video file uploads with automatic audio extraction (e.g., extracting audio tracks from uploaded MP4, MOV files for transcription and Voice Lab training)